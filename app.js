import {
  BrowserProvider,
  JsonRpcProvider,
  Contract,
  formatUnits,
  parseUnits
} from "https://cdn.jsdelivr.net/npm/ethers@6.13.0/dist/ethers.min.js";

// RPC and contract addresses
const RPC = "https://data-seed-prebsc-1-s1.binance.org:8545";
const TOKEN_ADDRESS   = "0xB2EFA488040B036E50a18C9d2D8110AF743c5504";
const SALE_ADDRESS    = "0x9146aEE05EbCFD30950D4E964cE256e32E1CbcfD";
const STAKING_ADDRESS = "0xee5ef7b0140a061032613F157c8366D5a29ABB95";

// Load ABI JSON files
async function loadABI(path) {
  const res = await fetch(path);
  return await res.json();
}

let provider, token, sale, staking;

async function init() {
  try {
    provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    // Load ABIs
    const TOKEN_ABI   = await loadABI("abi/JODA.json");
    const SALE_ABI    = await loadABI("abi/JODASale.json");
    const STAKING_ABI = await loadABI("abi/JODAStaking.json");

    // Create contract instances
    token   = new Contract(TOKEN_ADDRESS, TOKEN_ABI, signer);
    sale    = new Contract(SALE_ADDRESS, SALE_ABI, signer);
    staking = new Contract(STAKING_ADDRESS, STAKING_ABI, signer);

    document.getElementById("status").textContent = "✅ Connected";

  } catch (err) {
    console.error(err);
    document.getElementById("status").textContent = "❌ Failed to connect";
  }
}

init();