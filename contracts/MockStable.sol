// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.5/contracts/token/ERC20/ERC20.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.5/contracts/access/Ownable.sol";

/**
 * Simple 6-decimal ERC20 for testnet stables (USDT/USDC).
 * Owner can mint; faucetMint is for quick local testing (safe to keep on testnet only).
 */
contract MockStable is ERC20, Ownable {
    constructor(string memory name_, string memory symbol_, address owner_) ERC20(name_, symbol_) {
        _transferOwnership(owner_);
    }

    function decimals() public pure override returns (uint8) {
        return 6; // mimic real USDT/USDC
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /// Faucet for testing (max 1,000 tokens per call = 1_000_000_000 with 6dp)
    function faucetMint(uint256 amount) external {
        require(amount > 0 && amount <= 1_000_000_000, "max 1,000 tokens (6dp)");
        _mint(msg.sender, amount);
    }
}
