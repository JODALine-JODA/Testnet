// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "./IBasicUsdOracle.sol";

contract MockUsdOracle is IBasicUsdOracle {
    address public immutable wbnb;
    address public immutable usdt;
    address public immutable usdc;

    constructor(address _wbnb, address _usdt, address _usdc) {
        wbnb = _wbnb;
        usdt = _usdt;
        usdc = _usdc;
    }

    function quoteTokens() external view override returns (address, address, address) {
        return (wbnb, usdt, usdc);
    }

    // Test assumption: 1 BNB = $300 ; 1 USDT/USDC = $1
    function toUsd(address quoteToken, uint256 amount) external view override returns (uint256 usd18) {
        if (quoteToken == wbnb) return amount * 300;
        if (quoteToken == usdt || quoteToken == usdc) return amount;
        revert("UNSUPPORTED");
    }
}
