// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "./IBasicUsdOracle.sol";

/**
 * Minimal test oracle:
 * - WBNB has 18 decimals, priced via constant PRICE_WBNB (USD with 18 decimals).
 * - USDT/USDC have 6 decimals, priced at $1.00 (USD with 18 decimals).
 * - Returns USD with 18 decimals.
 */
contract SimpleMockOracle is IBasicUsdOracle {
    address public immutable wbnb;
    address public immutable usdt;
    address public immutable usdc;

    uint256 public constant PRICE_WBNB = 300e18; // 1 WBNB = $300 (adjust if you like)
    uint256 public constant PRICE_USD   = 1e18;  // 1 USDT/USDC = $1

    constructor(address _wbnb, address _usdt, address _usdc) {
        require(_wbnb != address(0), "wbnb=0");
        require(_usdt != address(0), "usdt=0");
        require(_usdc != address(0), "usdc=0");
        wbnb = _wbnb;
        usdt = _usdt;
        usdc = _usdc;
    }

    function quoteTokens() external view returns (address, address, address) {
        return (wbnb, usdt, usdc);
    }

    function toUsd(address quoteToken, uint256 amount) external view returns (uint256 usd18) {
        if (quoteToken == wbnb) {
            // amount(18dp) * price(18dp) / 1e18 = USD 18dp
            return amount * PRICE_WBNB / 1e18;
        } else if (quoteToken == usdt || quoteToken == usdc) {
            // amount(6dp) * $1(18dp) / 1e6 = USD 18dp
            return amount * PRICE_USD / 1e6;
        } else {
            revert("unknown token");
        }
    }
}
