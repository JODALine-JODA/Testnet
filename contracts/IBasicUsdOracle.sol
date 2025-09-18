// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IBasicUsdOracle {
    function toUsd(address quoteToken, uint256 amount) external view returns (uint256 usd18);
    function quoteTokens() external view returns (address wbnb, address usdt, address usdc);
}
