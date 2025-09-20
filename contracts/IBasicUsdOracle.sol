// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IBasicUsdOracle {
    /// @notice Convert quoteToken amount to USD (18 decimals)
    function toUsd(address quoteToken, uint256 amount) external view returns (uint256 usd18);

    /// @notice Return the 3 supported quote tokens (order matters for your UI/tests)
    function quoteTokens() external view returns (address wbnb, address usdt, address usdc);
}
