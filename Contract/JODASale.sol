// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title JODASale
 * @notice Direct sale of JODA for BNB at an owner-settable rate.
 *         - tokensPerBNB = JODA per 1 BNB, in token-wei (18 decimals).
 *         - Contract must be funded with JODA (send tokens here).
 *         - BNB collected is forwarded to `treasury`.
 *         - Enforces a minimum buy (`minBuyWei`) in BNB-wei.
 */
contract JODASale is Ownable {
    IERC20 public immutable token;
    address payable public treasury;

    // JODA tokens per 1 BNB (in token-wei, 18 decimals)
    uint256 public tokensPerBNB;

    // Minimum purchase in BNB-wei (e.g., ~$30 worth of BNB)
    uint256 public minBuyWei;

    // Optional sale toggle
    bool public saleActive = true;

    event Bought(address indexed buyer, uint256 bnbIn, uint256 tokensOut);
    event TokensPerBNBUpdated(uint256 newRate);
    event TreasuryUpdated(address newTreasury);
    event MinBuyWeiUpdated(uint256 newMinBuyWei);
    event SaleActiveSet(bool active);
    event SweptTokens(address to, uint256 amount);
    event SweptBNB(address to, uint256 amount);

    /**
     * @param token_         JODA token address
     * @param treasury_      where received BNB is sent
     * @param tokensPerBNB_  JODA per 1 BNB (token-wei, 18 decimals)
     * @param minBuyWei_     minimum buy in BNB-wei
     */
    constructor(
        address token_,
        address payable treasury_,
        uint256 tokensPerBNB_,
        uint256 minBuyWei_
    ) Ownable(msg.sender) {
        require(token_ != address(0) && treasury_ != address(0), "zero addr");
        require(tokensPerBNB_ > 0, "rate=0");
        token = IERC20(token_);
        treasury = treasury_;
        tokensPerBNB = tokensPerBNB_;
        minBuyWei = minBuyWei_;
    }

    // -------- Views --------
    function availableTokens() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    // -------- Owner controls --------
    function setTokensPerBNB(uint256 newRate) external onlyOwner {
        require(newRate > 0, "rate=0");
        tokensPerBNB = newRate;
        emit TokensPerBNBUpdated(newRate);
    }

    function setTreasury(address payable newTreasury) external onlyOwner {
        require(newTreasury != address(0), "zero addr");
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }

    /// @notice Set the minimum buy in BNB-wei (e.g., ~$30 worth of BNB)
    function setMinBuyWei(uint256 newMinBuyWei) external onlyOwner {
        minBuyWei = newMinBuyWei;
        emit MinBuyWeiUpdated(newMinBuyWei);
    }

    function setSaleActive(bool active) external onlyOwner {
        saleActive = active;
        emit SaleActiveSet(active);
    }

    // -------- Buying --------
    receive() external payable { buy(); }

    function buy() public payable {
        require(saleActive, "sale inactive");
        require(msg.value >= minBuyWei, "below minimum buy");

        // tokensOut = msg.value (BNB-wei) * tokensPerBNB (token-wei per 1 BNB)
        uint256 tokensOut = msg.value * tokensPerBNB;
        require(token.transfer(msg.sender, tokensOut), "token transfer failed");

        // forward BNB to treasury
        (bool ok, ) = treasury.call{value: msg.value}("");
        require(ok, "treasury transfer failed");

        emit Bought(msg.sender, msg.value, tokensOut);
    }

    // -------- Safety / Recovery --------
    function sweepTokens(address to, uint256 amount) external onlyOwner {
        require(token.transfer(to, amount), "sweep tokens failed");
        emit SweptTokens(to, amount);
    }

    function sweepBNB(address payable to, uint256 amount) external onlyOwner {
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "sweep bnb failed");
        emit SweptBNB(to, amount);
    }
}
