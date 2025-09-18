// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./JodaToken.sol";
import "./IBasicUsdOracle.sol";

contract JodaBondingCurve is ReentrancyGuard, Ownable2Step {
    using Address for address payable;

    uint256 public constant MAX_SUPPLY      = 1_000_000_000e18;
    uint256 public constant MAX_CURVE_SOLD  =   900_000_000e18;
    uint256 public constant PHASE_SIZE      =   100_000_000e18;
    uint256 public constant USD_WAD         = 1e18;
    uint256 public constant BUY_CAP_USD_DAY = 1_000e18;

    uint256 public totalSold;
    bool public paused;

    // Anchors (USD, 1e18) for start of each phase (0..8)
    uint256[9] public anchor = [
        100_000_000_000_000_000,   // 0.10
        600_000_000_000_000_000,   // 0.60
        1_000_000_000_000_000_000, // 1.00
        1_600_000_000_000_000_000, // 1.60
        3_000_000_000_000_000_000, // 3.00
        4_500_000_000_000_000_000, // 4.50
        8_000_000_000_000_000_000, // 8.00
        11_000_000_000_000_000_000,// 11.00
        20_000_000_000_000_000_000 // 20.00
    ];

    // Linear slopes (simplified for MVP, replaces exp phases for now)
    uint256[9] public k1 = [
        5_000_000_000,   // 0.10 -> 0.60
        4_000_000_000,   // 0.60 -> 1.00
        6_000_000_000,   // 1.00 -> 1.60
        14_000_000_000,  // 1.60 -> 3.00
        15_000_000_000,  // 3.00 -> 4.50
        35_000_000_000,  // 4.50 -> 8.00
        30_000_000_000,  // 8.00 -> 11.00
        90_000_000_000,  // 11.00 -> 20.00
        60_000_000_000   // 20.00 -> 26.00
    ];

    // Referral system
    uint256 public constant REFERRAL_BPS = 1000; // 10%
    mapping(address => address) public referrerOf;

    // Daily caps
    mapping(address => mapping(uint32 => uint256)) public usdBoughtByDay;

    // Launch guards
    uint256 public launchEndsAt;
    uint256 public cooldownSeconds;
    mapping(address => uint256) public lastTxAt;

    JodaToken public immutable joda;
    IBasicUsdOracle public oracle;
    address public treasury;

    event Purchase(address indexed buyer, uint256 tokens, uint256 usdIn, address quote, address referrer, uint256 refReward);

    constructor(address _joda, address _oracle, address _treasury, uint256 _launchWindow, uint256 _cooldown) {
        joda = JodaToken(_joda);
        oracle = IBasicUsdOracle(_oracle);
        treasury = _treasury;
        launchEndsAt = block.timestamp + _launchWindow;
        cooldownSeconds = _cooldown;
    }

    // === Admin ===
    function setPaused(bool p) external onlyOwner { paused = p; }
    function setOracle(address o) external onlyOwner { oracle = IBasicUsdOracle(o); }
    function setTreasury(address t) external onlyOwner { treasury = t; }

    // === Helpers ===
    function _phaseIndex(uint256 x) public pure returns (uint256) { return x / PHASE_SIZE; }
    function _phaseStart(uint256 p) public pure returns (uint256) { return p * PHASE_SIZE; }

    function priceAt(uint256 x) public view returns (uint256 usd18) {
        uint256 p = _phaseIndex(x);
        uint256 localX = x - _phaseStart(p);
        return anchor[p] + (k1[p] * localX) / 1e18;
    }

    function _integrate(uint256 x, uint256 dx) internal view returns (uint256 usd18) {
        uint256 rem = dx;
        uint256 cur = x;
        while (rem > 0) {
            uint256 p = _phaseIndex(cur);
            uint256 cap = _phaseStart(p) + PHASE_SIZE;
            uint256 chunk = rem <= (cap - cur) ? rem : (cap - cur);
            uint256 A = anchor[p];
            uint256 k = k1[p];
            uint256 offset = cur - _phaseStart(p);
            uint256 term1 = (A * chunk) / 1e18;
            uint256 term2 = (k * ( (offset * chunk) + (chunk * chunk)/2 )) / 1e18;
            usd18 += term1 + term2;
            cur += chunk;
            rem -= chunk;
        }
    }

    // === Buy flow ===
    receive() external payable { buyWithBNB(address(0), 0); }

    function buyWithBNB(address ref, uint256 minOut) public payable nonReentrant {
        (address wbnb,,) = oracle.quoteTokens();
        _buy(ref, minOut, wbnb, msg.value, true);
    }

    function buyWithToken(address token, uint256 amountIn, address ref, uint256 minOut) external nonReentrant {
        (,address usdt,address usdc) = oracle.quoteTokens();
        require(token == usdt || token == usdc, "UNSUPPORTED");
        IERC20(token).transferFrom(msg.sender, address(this), amountIn);
        _buy(ref, minOut, token, amountIn, false);
    }

    function _buy(address ref, uint256 minOut, address quote, uint256 amountIn, bool isNative) internal {
        require(!paused, "PAUSED");

        // 1) USD value
        uint256 usdIn = oracle.toUsd(quote, amountIn);

        // 2) Daily cap
        uint32 dayIdx = uint32(block.timestamp / 1 days);
        uint256 spent = usdBoughtByDay[msg.sender][dayIdx];
        require(spent + usdIn <= BUY_CAP_USD_DAY, "DAILY_CAP");
        usdBoughtByDay[msg.sender][dayIdx] = spent + usdIn;

        // 3) Solve tokensOut via bisection
        uint256 tokensOut = _solveTokensOut(usdIn);
        require(tokensOut >= minOut && tokensOut > 0, "SLIPPAGE");

        // 4) Referral
        address finalRef = _resolveReferrer(msg.sender, ref);
        uint256 refReward = finalRef == address(0) ? 0 : (tokensOut * REFERRAL_BPS) / 10_000;

        // 5) Supply check
        require(totalSold + tokensOut + refReward <= MAX_CURVE_SOLD, "CURVE_SOLD_OUT");

        // 6) Mint
        joda.mint(msg.sender, tokensOut);
        if (refReward > 0) joda.mint(finalRef, refReward);
        totalSold += tokensOut + refReward;

        // 7) Forward funds
        if (isNative) {
            payable(treasury).sendValue(address(this).balance);
        } else {
            IERC20(quote).transfer(treasury, amountIn);
        }

        emit Purchase(msg.sender, tokensOut, usdIn, quote, finalRef, refReward);
    }

    function _resolveReferrer(address buyer, address cand) internal returns (address r) {
        r = referrerOf[buyer];
        if (r == address(0) && cand != address(0) && cand != buyer) {
            referrerOf[buyer] = cand;
            r = cand;
        }
    }

    function _solveTokensOut(uint256 usdIn) internal view returns (uint256) {
        uint256 lo = 0;
        uint256 hi = MAX_CURVE_SOLD - totalSold;
        for (uint256 i=0;i<64;i++) {
            uint256 mid = (lo + hi)/2;
            uint256 cost = _integrate(totalSold, mid);
            if (cost == usdIn) return mid;
            if (cost < usdIn) lo = mid + 1;
            else hi = mid;
        }
        return lo > 0 ? lo - 1 : 0;
    }
}
