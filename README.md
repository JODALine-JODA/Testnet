JODA – Testnet Runbook
1) Contracts (BSC Testnet)

Token (JODA.sol)
Address: <paste-latest>
Decimals: 18
Cap: 100,000,000 JODA (1e26 wei)
Owner/Treasury: <owner address (MetaMask)>

Sale (JODASale.sol)
Address: <paste-latest>
token: <JODA address>
treasury: <owner address>
tokensPerBNB: <current value>
minBuyWei: <current value>
saleActive: true|false

Staking (JODAStaking.sol)
Address: <paste-latest>
token: <JODA address>
Terms enabled (months → APR bps):

3 → ?

6 → 2000 (example 20%)

12 → ?
(update with your values)


2) Quick Reference (Wei helpers)

1 BNB = 1_000_000_000_000_000_000 wei (1e18)

0.10 BNB = 100_000_000_000_000_000

0.05 BNB = 50_000_000_000_000_000

0.01 BNB = 10_000_000_000_000_000

JODA amounts (18 decimals)

10 JODA = 10 * 1e18 = 10000000000000000000

50 JODA = 50 * 1e18 = 50000000000000000000

100 JODA = 100 * 1e18 = 100000000000000000000


3) Sale math (fixed rate)

tokensOut = msg.value * tokensPerBNB / 1e18

For $0.50/JODA and $300/BNB → 600 JODA/BNB
⇒ tokensPerBNB = 600 * 1e18 = 600000000000000000000

Minimum buy (e.g., $30):
$30 / $300 = 0.1 BNB → minBuyWei = 100000000000000000

Update on-chain via owner:

setTokensPerBNB(newRate)

setSaleActive(true|false)

setMinBuyWei(newMinWei) (if present in your version, else it’s constructor-only)

4) Daily Quick Test (5–10 min)
A) Token (JODA)

name() → Jodaline

cap() → 100000000000000000000000000 (1e26)

mint(treasury, 100000000000000000000) → +100 JODA to treasury

balanceOf(treasury) increased

B) Sale (JODASale)

Fund sale with tokens: from JODA, transfer(<SaleAddress>, 5000000000000000000000) (=5,000 JODA)

Check availableTokens() on Sale → shows 5000e18

Check params:

token() = JODA address

treasury() = owner address

tokensPerBNB() = expected (e.g., 600e18)

minBuyWei() = expected (e.g., 0.1 BNB)

Test buy: In JODASale panel, set VALUE (top of Deploy & Run) to 100000000000000000 (0.1 BNB) → buy()

Buyer receives tokens

Treasury receives BNB


C) Staking

From JODA: approve(<Staking>, 100000000000000000000) (100 JODA)

In Staking: stake(100000000000000000000, 6) (100 JODA, 6 months)

stakes(msg.sender, 0) (or stakeCount(msg.sender)) → shows principal, startTime, duration

Attempt withdraw(0) before unlock → reverts (good)

(Optional owner test) ownerFund(500000000000000000000) → funds rewards

5) Common pitfalls & how to read errors

“below minimum buy”
Your VALUE (BNB) < minBuyWei. Raise VALUE or lower minBuyWei.

Token transfer failed
Sale contract doesn’t hold enough JODA. Fund it via JODA transfer(Sale, amount).

Decimals / totals look like 0
Wrong contract address selected in the “At Address” field.

MetaMask estimates fail
That’s normal on many reverts—fix input, then try again.


6) Routine owner ops (one-liners)

Fund sale:
JODA → transfer(<Sale>, <amountWei>)

Change price:
Sale → setTokensPerBNB(600000000000000000000) (example 600/BNB)

Pause/Resume:
Sale → setSaleActive(false) / true

Change treasury:
Sale → setTreasury(<newOwnerAddress>)

Staking: enable/adjust term:
Staking → setTerm(6, true) and setRateBpsByMonths(6, 2000) (example 20% APR)

7) What to record after each redeploy

Block explorer links for each contract

ABI snapshots (copied from Remix → /abi/*.json)

/deployments/bsc-testnet/*.json with the latest addresses

Any runtime parameters you set (tokensPerBNB, minBuyWei, enabled terms/rates)

Mini sanity list (before you stop for the day)

 name/symbol/decimals/cap look right on JODA

 Sale has tokens (availableTokens() > 0)

 A small buy (0.1 BNB) succeeds

 One stake succeeds & shows correct fields

 All new addresses saved in /deployments/bsc-testnet/*.json and ABIs updated
