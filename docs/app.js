// docs/app.js
// Ethers v6 (module import)
import {
  BrowserProvider,
  JsonRpcProvider,
  Contract,
  formatEther,
  parseEther,
  formatUnits,
  parseUnits,
} from "https://cdn.jsdelivr.net/npm/ethers@6.13.0/dist/ethers.min.js";

/* -----------------------------
   1) Contract addresses (BSC Testnet)
------------------------------ */
const TOKEN_ADDRESS   = "0xB2EFA488040B036E50a18C9d2D8110AF743c5504";
const SALE_ADDRESS    = "0x9146aEE05EbCFD30950D4E964cE256e32E1CbcfD";
const STAKING_ADDRESS = "0xee5ef7b0140a061032613F157c8366D5a29ABB95";

/* -----------------------------
   2) Helpers
------------------------------ */
const $ = (id) => document.getElementById(id);
const fmt = (n, d = 6) => Number(n).toFixed(d);
const toEth = (wei) => Number(formatEther(wei));
const bn = (x) => BigInt(x);

/* -----------------------------
   3) Global state
------------------------------ */
let provider;         // ethers provider (BrowserProvider or JsonRpcProvider)
let signer;           // ethers signer (when connected)
let userAddress = ""; // connected wallet address

let token, sale, staking;     // read-only contracts
let tokenW, saleW, stakingW;  // write (with signer) contracts

// BSC Testnet public RPC (fallback read-only)
const RPC = "https://data-seed-prebsc-1-s1.binance.org:8545/";

/* -----------------------------
   4) Load ABIs from JSON files in docs/
------------------------------ */
async function loadAbis() {
  const [tokenAbi, saleAbi, stakingAbi] = await Promise.all([
    fetch("./JODA.json").then((r) => r.json()),
    fetch("./JODASale.json").then((r) => r.json()),
    fetch("./JODAStaking.json").then((r) => r.json()),
  ]);
  return { tokenAbi, saleAbi, stakingAbi };
}

/* -----------------------------
   5) Make contracts for a given provider/signer
------------------------------ */
function makeContracts(p, abis) {
  token  = new Contract(TOKEN_ADDRESS,   abis.tokenAbi,  p);
  sale   = new Contract(SALE_ADDRESS,    abis.saleAbi,   p);
  staking= new Contract(STAKING_ADDRESS, abis.stakingAbi,p);

  if (signer) {
    tokenW   = token.connect(signer);
    saleW    = sale.connect(signer);
    stakingW = staking.connect(signer);
  } else {
    tokenW = saleW = stakingW = null;
  }
}

/* -----------------------------
   6) UI wiring
------------------------------ */
function wireUi() {
  // Tabs (Buy / Stake)
  $("tabBuy").addEventListener("click", () => {
    $("tabBuy").classList.add("active");
    $("tabStake").classList.remove("active");
    $("buyTab").style.display = "";
    $("stakeTab").style.display = "none";
  });

  $("tabStake").addEventListener("click", () => {
    $("tabStake").classList.add("active");
    $("tabBuy").classList.remove("active");
    $("buyTab").style.display = "none";
    $("stakeTab").style.display = "";
  });

  // Connect wallet
  $("connectBtn").addEventListener("click", connectWallet);

  // Estimate tokens for input BNB
  $("estimateBtn").addEventListener("click", estimateBuy);

  // Buy click
  $("buyBtn").addEventListener("click", doBuy);

  // Stake actions (enable if you’ve added the elements)
  const stakeBtn = $("stakeBtn");
  if (stakeBtn) stakeBtn.addEventListener("click", doStake);
}

/* -----------------------------
   7) Connect wallet (MetaMask)
------------------------------ */
async function connectWallet() {
  try {
    if (!window.ethereum) {
      alert("MetaMask not found. Please install it.");
      return;
    }

    // Ensure BSC Testnet (chainId 0x61)
    const chainId = await window.ethereum.request({ method: "eth_chainId" });
    if (chainId !== "0x61") {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x61" }],
        });
      } catch (switchErr) {
        if (switchErr.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: "0x61",
              chainName: "BSC Testnet",
              nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
              rpcUrls: [RPC],
              blockExplorerUrls: ["https://testnet.bscscan.com"],
            }],
          });
        } else {
          throw switchErr;
        }
      }
    }

    provider = new BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    userAddress = await signer.getAddress();
    $("walletAddress").textContent = userAddress;

    // Re-bind contracts with signer
    const abis = await loadAbis();
    makeContracts(provider, abis);

    $("status").textContent = "Connected (MetaMask)";
    await refreshAll();
  } catch (err) {
    console.error(err);
    alert(err?.info?.error?.message ?? err.message ?? "Failed to connect");
  }
}

/* -----------------------------
   8) Read-only init (no wallet)
------------------------------ */
async function initReadonly() {
  provider = new JsonRpcProvider(RPC);
  const abis = await loadAbis();
  makeContracts(provider, abis);
  $("status").textContent = "Ready (RPC)";
  await refreshAll();
}

/* -----------------------------
   9) Refresh sale + balances
------------------------------ */
async function refreshAll() {
  try {
    // Sale info
    const isActive = await sale.saleActive();
    const minBuyWei = await sale.minBuyWei();
    const rate = await sale.tokensPerBNB(); // “tokens per 1 BNB” in token-wei
    const avail = await sale.availableTokens(); // token-wei

    $("saleActive").textContent     = isActive ? "Yes" : "No";
    $("minBuy").textContent         = toEth(minBuyWei);
    $("tokensPerBNB").textContent   = formatUnits(rate, 0);
    $("available").textContent      = formatUnits(avail, 18);

    // Wallet balances if connected
    if (signer) {
      const balJoda = await token.balanceOf(userAddress);
      const balBNB  = await provider.getBalance(userAddress);
      $("walletJoda").textContent = `${formatUnits(balJoda,18)} JODA`;
      $("walletBnb").textContent  = `${fmt(toEth(balBNB),4)} BNB`;
    }
  } catch (e) {
    console.error(e);
  }
}

/* -----------------------------
   10) Estimation (BNB -> JODA)
   Contract uses: tokensOut = (msg.value * tokensPerBNB) / 1 ether
------------------------------ */
async function estimateBuy() {
  try {
    const valStr = $("buyBnb").value.trim() || "0";
    const wei = parseEther(valStr);                 // BNB -> wei
    const rate = await sale.tokensPerBNB();         // tokens per 1 BNB (token-wei)
    const tokensOut = (bn(wei) * bn(rate)) / bn(10n ** 18n);
    $("estimateOut").textContent = `${formatUnits(tokensOut,18)} JODA`;
  } catch (e) {
    console.error(e);
    alert("Estimate failed: " + (e?.message ?? e));
  }
}

/* -----------------------------
   11) Buy
------------------------------ */
async function doBuy() {
  try {
    if (!signer) return alert("Connect wallet first.");

    const valStr = $("buyBnb").value.trim() || "0";
    const wei = parseEther(valStr);

    const tx = await saleW.buy({ value: wei });
    $("status").textContent = "Buying… Waiting for confirmation…";
    await tx.wait();

    $("status").textContent = `Buy confirmed: ${tx.hash.slice(0,10)}…`;
    await refreshAll();
  } catch (e) {
    console.error(e);
    alert(e?.info?.error?.message ?? e.message ?? "Buy failed");
  }
}

/* -----------------------------
   12) Simple Staking (optional)
   Assumes inputs exist: stakeAmount, stakeMonths
------------------------------ */
async function doStake() {
  try {
    if (!signer) return alert("Connect wallet first.");
    const amtStr = $("stakeAmount").value.trim();
    const months = Number($("stakeMonths").value);
    if (!amtStr || months <= 0) return alert("Enter amount and months.");

    const amount = parseUnits(amtStr, 18);

    // Approve & stake
    let tx = await tokenW.approve(STAKING_ADDRESS, amount);
    $("stakeMsg").textContent = "Approving…";
    await tx.wait();

    tx = await stakingW.stake(amount, months);
    $("stakeMsg").textContent = "Staking…";
    await tx.wait();

    $("stakeMsg").textContent = "Stake submitted!";
    await refreshAll();
  } catch (e) {
    console.error(e);
    alert(e?.info?.error?.message ?? e.message ?? "Stake failed");
  }
}

/* -----------------------------
   13) Boot
------------------------------ */
async function init() {
  try {
    wireUi();

    if (window.ethereum) {
      // Try MetaMask for read-only first; fall back to RPC if it throws
      try {
        provider = new BrowserProvider(window.ethereum);
        const abis = await loadAbis();
        makeContracts(provider, abis);
        $("status").textContent = "Ready (MetaMask detected)";
      } catch {
        await initReadonly();
        return;
      }
    } else {
      await initReadonly();
      return;
    }

    await refreshAll();
  } catch (e) {
    console.error(e);
    $("status").textContent = "Init error";
  }
}

init();
