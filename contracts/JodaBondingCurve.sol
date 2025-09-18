// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.5/contracts/security/ReentrancyGuard.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.5/contracts/access/Ownable.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.5/contracts/token/ERC20/IERC20.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.5/contracts/utils/Address.sol";

import "./JodaToken.sol";
import "./IBasicUsdOracle.sol";

contract JodaBondingCurve is ReentrancyGuard, Ownable {
    using Address for address;

    JodaToken public immutable joda;
    IBasicUsdOracle public immutable oracle;
    address public immutable treasury;

    uint256 public constant MAX_CURVE_SOLD = 900_000_000e18; // 900M JODA
    uint256 public totalSold;

    uint256 public constant DAILY_CAP_USD = 1000e18; // $1000/day per wallet
    mapping(address => uint256) public dailySpent;
    mapping(address => uint256) public lastReset;

    uint256 public launchStart;
    uint256 public launchWindow;
    uint256 public cooldown;

    bool public paused;

    event Purchased(address indexed buyer, uint256 amountIn, uint256 amountOut, address quoteToken);
    event Paused(bool status);

    constructor(
        address _joda,
        address _oracle,
        address _treasury,
        uint256 _launchWindow,
        uint256 _cooldown
    ) {
        joda = JodaToken(_joda);
        oracle = IBasicUsdOracle(_oracle);
        treasury = _treasury;
        launchStart = block.timestamp;
        launchWindow = _launchWindow;
        cooldown = _cooldown;
    }

    modifier notPaused() {
        require(!paused, "PAUSED");
        _;
    }

    function setPaused(bool _p) external onlyOwner {
        paused = _p;
        emit Paused(_p);
    }

    function _checkLimits(address user, address quoteToken, uint256 amountIn) internal {
        (address wbnb, address usdt, address usdc) = oracle.quoteTokens();
        require(quoteToken == wbnb || quoteToken == usdt || quoteToken == usdc, "UNSUPPORTED");

        uint256 usdAmount = oracle.toUsd(quoteToken, amountIn);

        if (block.timestamp > lastReset[user] + 1 days) {
            dailySpent[user] = 0;
            lastReset[user] = block.timestamp;
        }

        require(dailySpent[user] + usdAmount <= DAILY_CAP_USD, "DAILY_CAP");
        dailySpent[user] += usdAmount;

        if (block.timestamp < launchStart + launchWindow) {
            require(block.timestamp > lastReset[user] + cooldown, "COOLDOWN");
        }
    }

    function _calculateOut(uint256 amountUsd) public pure returns (uint256) {
        // Example bonding curve: linear 1 USD → 10 JODA
        return amountUsd * 10;
    }

    function buy(address quoteToken, uint256 amountIn, address ref, uint256 minOut)
        external
        payable
        nonReentrant
        notPaused
    {
        bool isNative = (quoteToken == address(0));
        uint256 usdAmount = oracle.toUsd(isNative ? msg.sender : quoteToken, amountIn);
        _checkLimits(msg.sender, isNative ? address(0) : quoteToken, amountIn);

        uint256 amountOut = _calculateOut(usdAmount);
        require(amountOut >= minOut, "SLIPPAGE");
        require(totalSold + amountOut <= MAX_CURVE_SOLD, "SOLD_OUT");

        totalSold += amountOut;
        joda.mint(msg.sender, amountOut);

        if (isNative) {
            Address.sendValue(payable(treasury), msg.value);
        } else {
            IERC20(quoteToken).transferFrom(msg.sender, treasury, amountIn);
        }

        emit Purchased(msg.sender, amountIn, amountOut, quoteToken);

        if (ref != address(0) && ref != msg.sender) {
            uint256 refReward = amountOut / 10; // 10% referral
            joda.mint(ref, refReward);
        }
    }
}
