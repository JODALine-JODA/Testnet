// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockUsdOracle {
    address public immutable wbnb;
    address public immutable usdt;
    address public immutable usdc;

    constructor(address _wbnb, address _usdt, address _usdc) {
        wbnb = _wbnb; usdt = _usdt; usdc = _usdc;
    }

    function quoteTokens() external view returns (address, address, address) {
        return (wbnb, usdt, usdc);
    }

    function toUsd(address quoteToken, uint256 amount) external view returns (uint256 usd18) {
        if (quoteToken == wbnb) {
            return amount * 300; // assume 1 BNB = $300
        }
        if (quoteToken == usdt || quoteToken == usdc) {
            return amount; // 1 USDT/USDC = $1
        }
        revert("UNSUPPORTED");
    }
}
