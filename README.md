README — JODA (ERC20, capped, ownable)

Contract: JODA.sol
Network: BSC Testnet
Address: <fill latest>
ABI: abi/JODA.json

What this contract does

ERC20 token with hard cap (set in constructor).

Owner-only minting (mint) but never above cap.

Burn available to anyone for their own tokens.

Initial mint goes to the treasury (constructor arg).

Constructor (deployment)

cap (uint256, 18 decimals) – max supply in wei (e.g., 100M JODA → 100000000 * 1e18).

initialSupply (uint256, 18 decimals) – initial mint to treasury.

treasury (address) – receives initial mint.

Example you used

Cap: 100,000,000 JODA → 100000000000000000000000000

Initial: 20,000,000 JODA → 20000000000000000000000000

Core functions (owner)

mint(address to, uint256 amount) — mint more, respecting the cap.

transferOwnership(address newOwner) — standard OZ.

renounceOwnership() — don’t click this in test unless you intend to lose owner rights.

Common reads (blue buttons)

cap() — returns max supply (wei).

totalSupply() — current minted supply (wei).

balanceOf(address) — balance (wei).

decimals() — 18

name() / symbol() — “Jodaline” / “JODA”

owner() — current owner address.

Quick tests

totalSupply should equal initial mint right after deploy.

After mint(treasury, X), totalSupply increases by X and never beyond cap.

Safety

Never mint above cap; function reverts if attempted.

Keep the owner key safe; losing it means you can’t mint or transfer ownership.




README — JODASale (Direct token sale for BNB)
Contract: JODASale.sol
Network: BSC Testnet
Address: <fill latest>
ABI: abi/JODASale.json
Token sold: JODA at token = <JODA address>

What this contract does

Sells JODA for BNB at fixed owner-set rate tokensPerBNB (JODA-wei per 1 BNB).

Forwards received BNB to treasury immediately.

Enforces minimum buy (minBuyWei), and optional per-TX cap (perTxMaxWei if present in your version).

Owner can pause/resume sale (setSaleActive).

Deployment params

token — JODA token address.

treasury — wallet to receive BNB.

tokensPerBNB — JODA per 1 BNB in wei.

minBuyWei — minimum BNB per purchase (wei).

Your current test settings (for $0.50/JODA, BNB $300)

tokensPerBNB: 600000000000000000000 (600 * 1e18)

minBuyWei: 50000000000000000 (0.05 BNB)

Why: 1 BNB ($300) / $0.50 = 600 JODA → store 600 * 1e18.

Typical owner flow (after deploy)

Fund sale with JODA (so buyers can receive tokens):
In Remix, open JODA.sol → transfer(saleAddress, amount)
e.g., send 2,000,000 JODA → 2000000 * 1e18.

Set/adjust price
setTokensPerBNB(600000000000000000000) to match $0.50/JODA at BNB=$300.
(You can update later if market changes.)

Set min buy (optional)
setMinBuyWei(50000000000000000) → 0.05 BNB (≈ $15 at $300/BNB; adjust to match $30 if BNB price shifts).

(Optional) per-TX cap
If your version includes setPerTxMaxWei, use it to limit whales.

Enable sale
setSaleActive(true)

Buyer flow

In Remix: JODASale.sol → value (Wei) (e.g., 0.05 BNB → 50000000000000000) → click buy().
Contract computes tokensOut = msg.value * tokensPerBNB / 1e18 and transfers JODA to buyer.

Admin utilities

sweepTokens(address to, uint256 amount) — recover leftover JODA.

sweepBNB(address to, uint256 amount) — recover BNB (e.g., if sale was paused mid-send).

setTreasury(address) — update treasury.

setSaleActive(bool) — pause/unpause.

Common reads

availableTokens() — JODA balance in the sale contract.

minBuyWei() — current min.

tokensPerBNB() — current price.

owner() — owner address.

treasury() — current treasury.

Frequent errors & fixes

“below minimum buy”: increase value (Wei) or lower minBuyWei.

“token transfer failed”: you forgot to fund the sale with JODA or sale’s allowance/balance insufficient.

No BNB to treasury: ensure sale is active; buy() forwards to treasury.




README — JODAStaking (custodial staking with funded rewards)

Contract: JODAStaking.sol
Network: BSC Testnet
Address: <fill latest>
ABI: abi/JODAStaking.json
Token: JODA at <JODA address>

What this contract does

Users approve then stake JODA into this contract for a chosen term.

On withdrawal, they receive principal + reward.

Rewards are paid from this contract’s JODA balance — owner must fund it.

Setup (owner)

Fund rewards pool
From JODA, transfer(stakingAddress, amount) (e.g., 50,000 JODA for rewards).

Enable terms (months) and set rates

setTerm(uint32 months, bool enabled)

setRateBpsByMonths(uint32 months, uint32 rateBps)
Example:

3 months → enable + rateBps=800 (8%)

6 months → enable + rateBps=1500 (15%)

12 months → enable + rateBps=2600 (26%)

(Optional) Preview rewards for UX
previewReward(amount, months) → returns reward (wei) with your rates.

User flow

Approve spending to staking contract in JODA.sol:
approve(stakingAddress, amount)

Stake:
stake(uint256 amount, uint32 months) (months must be enabled; amount in wei).

Withdraw (after term):
withdraw(uint256 stakeId) → returns principal + reward.

Useful reads

canWithdraw(user, stakeId) → bool, amount ready, reward due, etc. (depending on your struct/interface)

stakes(address user) → stake list/structs.

rateBpsByMonths(uint32 months)

isValidTerm(uint32 months)

Admin utilities

ownerFund(uint256 amount) / ownerSweep(uint256 amount) — top up or recover unused rewards (naming can differ slightly based on your version).

transferOwnership(address) — standard OZ.

Frequent errors & fixes

Stake reverts: user didn’t approve enough JODA first.

Withdraw reverts: term not matured (canWithdraw is false) or contract’s JODA balance is insufficient for rewards.

No rewards paid: ensure the contract is funded with enough JODA to cover projected rewards.

Shared quick references

Wei helper

1 BNB = 1e18 wei

0.05 BNB = 50000000000000000 wei

Token math

JODA amounts use 18 decimals.

1,000 JODA = 1000 * 1e18.

Current (test) economics

Target price: $0.50/JODA, BNB assumed $300 → tokensPerBNB = 600e18.

Minimum buy: 0.05 BNB (5e16 wei) → ~30 JODA at the above price.

Adjust with setTokensPerBNB if the BNB price assumption changes.
