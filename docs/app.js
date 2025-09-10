/* ================================
   JODA dApp – Buy & Stake (BSC Testnet)
   app.js with ABI fallbacks + clearer status
   ================================ */

/* ---------- Helpers ---------- */
const $ = (id) => document.getElementById(id);
const fmt = (n, d = 6) => Number(n).toLocaleString(undefined, { maximumFractionDigits: d });
const toEth = (wei) => Number(ethers.formatEther(wei));
const toWei = (eth) => ethers.parseEther(String(eth ?? 0));
const toUnits = (wei, decimals = 18) => Number(ethers.formatUnits(wei, decimals));
const fromUnits = (n, decimals = 18) => ethers.parseUnits(String(n ?? 0), decimals);

/* ---------- UI Elements ---------- */
const statusEl       = $("status");
const connectBtn     = $("connectBtn");
const disconnectBtn  = $("disconnectBtn");

const walletAddress  = $("walletAddress");
const yourWallet     = $("yourWallet");

const saleActiveEl   = $("saleActive");
const minBuyEl       = $("minBuy");
const rateEl         = $("tokensPerBNB");
const availEl        = $("available");

const bnbBalEl       = $("bnbBalance");
const jodaBalEl      = $("jodaBalance");

const buyBnbInput    = $("buyBnb");
const buyBtn         = $("buyBtn");
const buyMsg         = $("buyMsg");

const headerWallet   = $("hdrWallet");
const headerSale     = $("hdrSale");
const headerStaking  = $("hdrStaking");

/* ---------- Addresses (BSC Testnet) ---------- */
const TOKEN_ADDRESS   = "0xB2EFA488040B036E50a18C9d2D8110AF743c5504";
const SALE_ADDRESS    = "0x9146aEE05EbCFD30950D4E964cE256e32E1CbcfD";
const STAKING_ADDRESS = "0xee5ef7b0140a061032613F157c8366D5a29ABB95";

/* ---------- State ---------- */
let provider;
let signer;
let user;

let token;
let sale;
let staking;

/* ---------- Minimal fallback ABIs (only the functions we use) ---------- */
const FALLBACK_TOKEN_ABI = [
  // balanceOf(address) -> uint256
  {"constant":true,"inputs":[{"name":"a","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  // decimals() -> uint8 (not used in math, but useful)
  {"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"stateMutability":"view","type":"function"}
];

const FALLBACK_SALE_ABI = [
  // saleActive() -> bool
  {"constant":true,"inputs":[],"name":"saleActive","outputs":[{"name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  // minBuyWei() -> uint256
  {"constant":true,"inputs":[],"name":"minBuyWei","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  // tokensPerBNB() -> uint256 (1e18 tokens per 1 BNB)
  {"constant":true,"inputs":[],"name":"tokensPerBNB","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  // availableTokens() -> uint256 (18 dp)
  {"constant":true,"inputs":[],"name":"availableTokens","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  // buy() payable
  {"inputs":[],"name":"buy","outputs":[],"stateMutability":"payable","type":"function"}
];

// We’re not calling staking yet, keep a tiny stub so the contract builds.
const FALLBACK_STAKING_ABI = [
  {"constant":true,"inputs":[],"name":"owner","outputs":[{"name":"","type":"address"}],"stateMutability":"view","type":"function"}
];

/* ---------- Status helpers ---------- */
function setStatus(text, color = "#a0aec0") {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.style.color = color;
}

function showConnectedUI() {
  connectBtn    && connectBtn.classList.add("hide");
  disconnectBtn && disconnectBtn.classList.remove("hide");
}

function showDisconnectedUI() {
  connectBtn    && connectBtn.classList.remove("hide");
  disconnectBtn && disconnectBtn.classList.add("hide");
}

/* ---------- Load ABIs (with fallback + error detail) ---------- */
async function loadAbi(path, fallbackAbi) {
  try {
    const res = await fetch(path, { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
    const json = await res.json();
    const abi = Array.isArray(json) ? json : (json.abi ?? null);
    if (!abi) throw new Error(`No "abi" array in ${path}`);
    return abi;
  } catch (e) {
    console.warn(`ABI fetch failed for ${path}:`, e);
    setStatus(`Using fallback ABI for ${path.replace('.json','')}`, "#f59e0b");
    return fallbackAbi;
  }
}

/* ---------- Build contracts ---------- */
async function makeContracts(currentProviderOrSigner) {
  const [TOKEN_ABI, SALE_ABI, STAKING_ABI] = await Promise.all([
    loadAbi("JODA.json",        FALLBACK_TOKEN_ABI),
    loadAbi("JODASale.json",    FALLBACK_SALE_ABI),
    loadAbi("JODAStaking.json", FALLBACK_STAKING_ABI),
  ]);

  token   = new ethers.Contract(TOKEN_ADDRESS,   TOKEN_ABI,   currentProviderOrSigner);
  sale    = new ethers.Contract(SALE_ADDRESS,    SALE_ABI,    currentProviderOrSigner);
  staking = new ethers.Contract(STAKING_ADDRESS, STAKING_ABI, currentProviderOrSigner);

  headerSale    && (headerSale.value    = SALE_ADDRESS);
  headerStaking && (headerStaking.value = STAKING_ADDRESS);
}

/* ---------- Chain guard ---------- */
async function ensureBscTestnet() {
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x61" }], // BSC Testnet
    });
  } catch (err) {
    if (err?.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: "0x61",
          chainName: "BSC Testnet",
          nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
          rpcUrls: ["https://data-seed-prebsc-1-s1.binance.org:8545/"],
          blockExplorerUrls: ["https://testnet.bscscan.com/"],
        }],
      });
    } else {
      throw err;
    }
  }
}

/* ---------- Read-only init ---------- */
async function initReadonly() {
  provider = new ethers.JsonRpcProvider("https://data-seed-prebsc-1-s1.binance.org:8545/");
  await makeContracts(provider);
  setStatus("Ready (RPC read-only)");
  await refreshAll();
}

/* ---------- Wallet-aware init ---------- */
async function init() {
  try {
    setStatus("Connecting…", "#93c5fd");

    if (typeof ethers === "undefined") {
      throw new Error("ethers library not loaded (check CDN <script> in index.html)");
    }

    if (window.ethereum) {
      // Build with BrowserProvider first so we can query even before connect
      provider = new ethers.BrowserProvider(window.ethereum);

      // Try chain switch silently; if it fails we still proceed and show error later
      try { await ensureBscTestnet(); } catch (e) { console.warn("Chain switch:", e); }

      await makeContracts(provider);

      const accounts = await provider.send("eth_accounts", []);
      if (accounts.length) {
        await handleConnected(accounts[0]);
      } else {
        setStatus("Ready (MetaMask detected)", "#10b981");
        showDisconnectedUI();
        await refreshAll();
      }

      window.ethereum.on?.("accountsChanged", async (accs) => {
        if (accs.length > 0) {
          await handleConnected(accs[0]);
        } else {
          user = undefined; signer = undefined;
          setStatus("Ready (MetaMask detected)", "#10b981");
          showDisconnectedUI();
          walletAddress && (walletAddress.value = "");
          yourWallet && (yourWallet.value = "");
          await makeContracts(provider);
          await refreshAll();
        }
      });

      window.ethereum.on?.("chainChanged", async () => {
        provider = new ethers.BrowserProvider(window.ethereum);
        if (user) signer = await provider.getSigner();
        await makeContracts(signer ?? provider);
        await refreshAll();
      });

    } else {
      await initReadonly();
    }
  } catch (err) {
    console.error("init() error:", err);
    setStatus(`Error initializing app: ${err.message ?? err}`, "#ef4444");
    if (!provider) {
      try { await initReadonly(); } catch {}
    }
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
    console.error("connectWallet error:", err);
    setStatus(`Connection failed: ${err?.message ?? err}`, "#ef4444");
  }
}

async function handleConnected(account) {
  user = account;
  signer = await provider.getSigner();
  await makeContracts(signer); // attach signer for writes

  setStatus("Connected", "#10b981");
  showConnectedUI();

  walletAddress && (walletAddress.value = account);
  yourWallet && (yourWallet.value    = account);
  headerWallet && (headerWallet.value = account);

  await refreshAll();
}

function disconnectWallet() {
  user = undefined;
  signer = undefined;
  makeContracts(provider);
  setStatus("Ready (MetaMask detected)", "#10b981");
  showDisconnectedUI();
  walletAddress && (walletAddress.value = "");
  yourWallet && (yourWallet.value = "");
  refreshAll();
}

/* ---------- Refreshers ---------- */
async function refreshSale() {
  if (!sale) return;
  try {
    const [active, minBuyWei, rateWei, availableWei] = await Promise.all([
      sale.saleActive?.() ?? sale.saleActive,
      sale.minBuyWei?.() ?? sale.minBuyWei,
      sale.tokensPerBNB?.() ?? sale.tokensPerBNB,
      sale.availableTokens?.() ?? sale.availableTokens
    ]);

    const minBuyBnb        = toEth(minBuyWei);
    const tokensPerBnb     = toUnits(rateWei, 18);
    const availableJoda    = toUnits(availableWei, 18);

    saleActiveEl && (saleActiveEl.textContent = active ? "Yes" : "No");
    minBuyEl     && (minBuyEl.textContent     = fmt(minBuyBnb, 6));
    rateEl       && (rateEl.textContent       = fmt(tokensPerBnb, 6));
    availEl      && (availEl.textContent      = fmt(availableJoda, 6));
  } catch (e) {
    console.warn("refreshSale()", e);
    setStatus(`Sale refresh error: ${e?.message ?? e}`, "#f59e0b");
  }
}

async function refreshBalances() {
  try {
    const [bnb, joda] = await Promise.all([
      user ? provider.getBalance(user) : Promise.resolve(0n),
      user ? token.balanceOf(user)     : Promise.resolve(0n),
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
    console.error("doBuy error:", e);
    alert(e?.info?.error?.message ?? e?.shortMessage ?? e?.message ?? "Buy failed");
  } finally {
    buyBtn && (buyBtn.disabled = false);
  }
}

/* ---------- Events ---------- */
connectBtn    && connectBtn.addEventListener("click", connectWallet);
disconnectBtn && disconnectBtn.addEventListener("click", disconnectWallet);
buyBtn        && buyBtn.addEventListener("click", doBuy);

/* ---------- Kickoff ---------- */
init();
setInterval(() => { refreshSale(); refreshBalances(); }, 20000);