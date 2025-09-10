// app.js

let provider;
let signer;
let userAddress = null;

// Contract ABIs + addresses (adjust if needed)
const JODA_ABI_URL = "JODA.json";
const SALE_ABI_URL = "JODASale.json";
const STAKING_ABI_URL = "JODAStaking.json";

let jodaContract, saleContract, stakingContract;

// Contract addresses (replace with yours)
const JODA_ADDRESS = "0x...";       // Token
const SALE_ADDRESS = "0x...";       // Sale
const STAKING_ADDRESS = "0x...";    // Staking

// Elements
const statusEl = document.getElementById("status");
const connectBtn = document.getElementById("connectBtn");
const disconnectBtn = document.getElementById("disconnectBtn");
const walletAddressEl = document.getElementById("walletAddress");

// -------------------- INIT --------------------
async function init() {
  try {
    if (typeof window.ethereum === "undefined") {
      statusEl.textContent = "MetaMask not detected ❌";
      return;
    }

    // Load ethers.js provider
    provider = new ethers.BrowserProvider(window.ethereum);

    // Read-only state
    signer = null;
    userAddress = null;

    statusEl.textContent = "Ready (read-only)";
    connectBtn.style.display = "inline-block";
    disconnectBtn.style.display = "none";

    // Preload contract ABIs
    const [jodaABI, saleABI, stakingABI] = await Promise.all([
      fetch(JODA_ABI_URL).then(r => r.json()),
      fetch(SALE_ABI_URL).then(r => r.json()),
      fetch(STAKING_ABI_URL).then(r => r.json())
    ]);

    jodaContract = new ethers.Contract(JODA_ADDRESS, jodaABI, provider);
    saleContract = new ethers.Contract(SALE_ADDRESS, saleABI, provider);
    stakingContract = new ethers.Contract(STAKING_ADDRESS, stakingABI, provider);

  } catch (err) {
    console.error("Init error:", err);
    statusEl.textContent = "Error initializing app (check console)";
  }
}

// -------------------- CONNECT --------------------
async function connectWallet() {
  try {
    if (!provider) {
      statusEl.textContent = "No provider";
      return;
    }

    signer = await provider.getSigner();
    userAddress = await signer.getAddress();

    statusEl.textContent = "✅ Connected";
    walletAddressEl.textContent = userAddress;

    connectBtn.style.display = "none";
    disconnectBtn.style.display = "inline-block";

    // Reconnect contracts with signer
    jodaContract = jodaContract.connect(signer);
    saleContract = saleContract.connect(signer);
    stakingContract = stakingContract.connect(signer);

  } catch (err) {
    console.error("Wallet connection failed:", err);
    statusEl.textContent = "❌ Connection failed";
  }
}

// -------------------- DISCONNECT --------------------
function disconnectWallet() {
  signer = null;
  userAddress = null;
  walletAddressEl.textContent = "";

  statusEl.textContent = "Disconnected";
  connectBtn.style.display = "inline-block";
  disconnectBtn.style.display = "none";

  // Reset to read-only provider
  jodaContract = jodaContract.connect(provider);
  saleContract = saleContract.connect(provider);
  stakingContract = stakingContract.connect(provider);
}

// -------------------- EVENTS --------------------
window.addEventListener("load", init);
connectBtn?.addEventListener("click", connectWallet);
disconnectBtn?.addEventListener("click", disconnectWallet);
