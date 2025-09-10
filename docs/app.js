/* ================================
   JODA dApp – Buy & Stake (BSC Testnet)
   Full app.js – 2025-09-10
   ================================ */

/* ---------- Helpers ---------- */
const $ = (id) => document.getElementById(id);
const fmt = (n, d = 6) => Number(n).toLocaleString(undefined, { maximumFractionDigits: d });
const toEth = (wei) => Number(ethers.formatEther(wei));
const toWei = (eth) => ethers.parseEther(String(eth ?? 0));
const toUnits = (wei, decimals = 18) => Number(ethers.formatUnits(wei, decimals));
const fromUnits = (n, decimals = 18) => ethers.parseUnits(String(n ?? 0), decimals);

/* ---------- UI Elements (optional) ---------- */
const statusEl       = $("status");            // text: Ready / Connected / …
const connectBtn     = $("connectBtn");        // button
const disconnectBtn  = $("disconnectBtn");     // button (hidden by default)

const walletAddress  = $("walletAddress");     // input/display for user wallet
const yourWallet     = $("yourWallet");        // (duplicate display, optional)

// Sale stats
const saleActiveEl   = $("saleActive");
const minBuyEl       = $("minBuy");            // BNB (not wei)
const rateEl         = $("tokensPerBNB");      // tokens (not wei)
const availEl        = $("available");         // JODA (18dp)

// Balances
const bnbBalEl       = $("bnbBalance");
const jodaBalEl      = $("jodaBalance");

// Buy form
const buyBnbInput    = $("buyBnb");
const buyBtn         = $("buyBtn");
const buyMsg         = $("buyMsg");

// Headers / addresses (optional info bars)
const headerWallet   = $("hdrWallet");
const headerSale     = $("hdrSale");
const headerStaking  = $("hdrStaking");

/* ---------- Addresses (BSC Testnet) ---------- */
const TOKEN_ADDRESS   = "0xB2EFA488040B036E50a18C9d2D8110AF743c5504";
const SALE_ADDRESS    = "0x9146aEE05EbCFD30950D4E964cE256e32E1CbcfD";
const STAKING_ADDRESS = "0xee5ef7b0140a061032613F157c8366D5a29ABB95";

/* ---------- State ---------- */
let provider;    // ethers.Provider (BrowserProvider or JsonRpcProvider)
let signer;      // ethers.Signer (when connected)
let user;        // connected address (string) or undefined

let token;       // ethers.Contract (IERC20)
let sale;        // ethers.Contract (JODASale)
let staking;     // ethers.Contract (JODAStaking)

/* ---------- Load ABIs from JSON files ---------- */
async function loadAbi(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Failed to fetch ${path}`);
  const json = await res.json();
  return Array.isArray(json) ? json : (json.abi ?? []);
}

/* ---------- Build contracts for a given provider/signer ---------- */
async function makeContracts(currentProviderOrSigner) {
  const TOKEN_ABI   = await loadAbi("JODA.json");
  const SALE_ABI    = await loadAbi("JODASale.json");
  const STAKING_ABI = await loadAbi("JODAStaking.json");

  token   = new ethers.Contract(TOKEN_ADDRESS,   TOKEN_ABI,   currentProviderOrSigner);
  sale    = new ethers.Contract(SALE_ADDRESS,    SALE_ABI,    currentProviderOrSigner);
  staking = new ethers.Contract(STAKING_ADDRESS, STAKING_ABI, currentProviderOrSigner);

  headerSale && (headerSale.value = SALE_ADDRESS);
  headerStaking && (headerStaking.value = STAKING_ADDRESS);
}

/* ---------- Chain guard (force BSC Testnet) ---------- */
async function ensureBscTestnet() {
  // BSC Testnet: chainId 0x61 / 97
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x61" }]
    });
  } catch (err) {
    // If chain is not added
    if (err?.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: "0x61",
          chainName: "BSC Testnet",
          nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
          rpcUrls: ["https://data-seed-prebsc-1-s1.binance.org:8545/"],
          blockExplorerUrls: ["https://testnet.bscscan.com/"]
        }]
      });
    } else {
      throw err;
    }
  }
}

/* ---------- Status helpers ---------- */
function setStatus(text, color = "#a0aec0") {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.style.color = color;
}

function showConnectedUI() {
  connectBtn  && connectBtn.classList.add("hide");
  disconnectBtn && disconnectBtn.classList.remove("hide");
}

function showDisconnectedUI() {
  connectBtn  && connectBtn.classList.remove("hide");
  disconnectBtn && disconnectBtn.classList.add("hide");
}

/* ---------- Read-only init (no wallet needed) ---------- */
async function initReadonly() {
  // You can point this to a public RPC; using BSC testnet seed here.
  provider = new ethers.JsonRpcProvider("https://data-seed-prebsc-1-s1.binance.org:8545/");
  await makeContracts(provider);
  setStatus("Ready (read-only RPC)");
  await refreshAll(); // shows sale stats & (zero) user balances
}

/* ---------- Wallet-aware init ---------- */
async function init() {
  try {
    if (window.ethereum) {
      try {
        await ensureBscTestnet();
      } catch (e) {
        console.warn("Switch chain warning:", e);
      }

      // Build read-only first (for immediate UI)
      provider = new ethers.BrowserProvider(window.ethereum);
      await makeContracts(provider);

      // Try silent accounts
      const accounts = await provider.send("eth_accounts", []);
      if (accounts.length > 0) {
        await handleConnected(accounts[0]);
      } else {
        setStatus("Ready (MetaMask detected)", "#10b981");
        showDisconnectedUI();
        await refreshAll();
      }

      // React to account/chain changes
      window.ethereum.on?.("accountsChanged", async (accs) => {
        if (accs.length > 0) {
          await handleConnected(accs[0]);
        } else {
          user = undefined; signer = undefined;
          setStatus("Ready (MetaMask detected)", "#10b981");
          showDisconnectedUI();
          walletAddress && (walletAddress.value = "");
          yourWallet && (yourWallet.value = "");
          await makeContracts(provider); // back to provider only
          await refreshAll();
        }
      });

      window.ethereum.on?.("chainChanged", async () => {
        // On chain change, re-make provider/signer & refresh
        provider = new ethers.BrowserProvider(window.ethereum);
        if (user) signer = await provider.getSigner();
        await makeContracts(signer ?? provider);
        await refreshAll();
      });

    } else {
      await initReadonly();
    }
  } catch (err) {
    console.error(err);
    setStatus("Error initializing app", "#ef4444");
    // Fall back to read-only if anything failed
    if (!provider) await initReadonly();
  }
}

/* ---------- Connect / Disconnect ---------- */
async function connectWallet() {
  try {
    if (!window.ethereum) return setStatus("No wallet found", "#ef4444");
    await ensureBscTestnet();
    provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send("eth_requestAccounts", []);
    await handleConnected(accounts[0]);
  } catch (err) {
    console.error(err);
    setStatus("Connection failed", "#ef4444");
  }
}

async function handleConnected(account) {
  user = account;
  signer = await provider.getSigner();
  await makeContracts(signer); // attach signer for writes

  setStatus("Connected", "#10b981");
  showConnectedUI();

  if (walletAddress) walletAddress.value = account;
  if (yourWallet)    yourWallet.value    = account;
  if (headerWallet)  headerWallet.value  = account;

  await refreshAll();
}

function disconnectWallet() {
  // Programmatic disconnect isn’t supported by MetaMask; we just reset UI/state.
  user = undefined;
  signer = undefined;
  makeContracts(provider); // back to read-only
  setStatus("Ready (MetaMask detected)", "#10b981");
  showDisconnectedUI();
  if (walletAddress) walletAddress.value = "";
  if (yourWallet)    yourWallet.value    = "";
  refreshAll();
}

/* ---------- Refreshers ---------- */
async function refreshSale() {
  if (!sale) return;

  try {
    const [active, minBuyWei, rateWei, availableWei] = await Promise.all([
      sale.saleActive?.() ?? sale.saleActive,               // bool
      sale.minBuyWei?.() ?? sale.minBuyWei,                 // uint256
      sale.tokensPerBNB?.() ?? sale.tokensPerBNB,           // uint256 (in 1e18 units)
      sale.availableTokens?.() ?? sale.availableTokens      // uint256 (18dp)
    ]);

    // Convert displays
    const minBuyBnb = toEth(minBuyWei);
    const tokensPerBnbWhole = toUnits(rateWei, 18);
    const availableJoda = toUnits(availableWei, 18);

    saleActiveEl && (saleActiveEl.textContent = active ? "Yes" : "No");
    minBuyEl     && (minBuyEl.textContent     = fmt(minBuyBnb, 6));
    rateEl       && (rateEl.textContent       = fmt(tokensPerBnbWhole, 6));
    availEl      && (availEl.textContent      = fmt(availableJoda, 6));
  } catch (e) {
    console.warn("refreshSale()", e);
  }
}

async function refreshBalances() {
  try {
    const [bnb, joda] = await Promise.all([
      user ? provider.getBalance(user) : Promise.resolve(0n),
      user ? token.balanceOf(user) : Promise.resolve(0n),
    ]);

    bnbBalEl  && (bnbBalEl.textContent  = fmt(toEth(bnb), 6));
    jodaBalEl && (jodaBalEl.textContent = fmt(toUnits(joda, 18), 6));
  } catch (e) {
    console.warn("refreshBalances()", e);
  }
}

async function refreshAll() {
  await refreshSale();
  await refreshBalances();
}

/* ---------- Buy flow ---------- */
async function doBuy() {
  if (!sale) return;
  if (!buyBnbInput) return;

  try {
    const bnbStr = buyBnbInput.value.trim();
    if (!bnbStr) return alert("Enter BNB amount.");
    const valueWei = toWei(bnbStr);

    // Pre-check min buy
    const minBuyWei = await (sale.minBuyWei?.() ?? sale.minBuyWei);
    if (valueWei < minBuyWei) {
      const need = fmt(toEth(minBuyWei), 6);
      return alert(`Minimum buy is ${need} BNB.`);
    }

    if (!signer) return alert("Connect wallet first.");

    buyBtn && (buyBtn.disabled = true);
    buyMsg && (buyMsg.textContent = "Sending…");

    const tx = await sale.connect(signer).buy({ value: valueWei });
    const r  = await tx.wait();

    buyMsg && (buyMsg.textContent = `Buy confirmed: ${r?.hash?.slice(0, 10)}…`);
    await refreshAll();
  } catch (e) {
    console.error(e);
    alert(e?.info?.error?.message ?? e?.shortMessage ?? e?.message ?? "Buy failed");
  } finally {
    buyBtn && (buyBtn.disabled = false);
  }
}

/* ---------- Event wiring ---------- */
connectBtn    && connectBtn.addEventListener("click", connectWallet);
disconnectBtn && disconnectBtn.addEventListener("click", disconnectWallet);
buyBtn        && buyBtn.addEventListener("click", doBuy);

/* ---------- Kickoff ---------- */
init();

// Optional: auto-refresh some panels every 20s
setInterval(() => {
  refreshSale();
  refreshBalances();
}, 20000);
