// === JODA Web3 Frontend ===

// Your deployed contract addresses on BSC Testnet
const JODA_ADDRESS = "0xB2EFA488040B036E50a18C9d2D8110AF743c5504";      // JODA.sol
const JODASale_ADDRESS = "0x9146aEE05EbCFD30950D4E964cE256e32E1CbcfD";  // JODASale.sol
const JODAStaking_ADDRESS = "0xee5ef7b0140a061032613F157c8366D5a29ABB95"; // JODAStaking.sol

let web3;
let accounts;
let JODA, JODASale, JODAStaking;

// === Load ABI helper ===
async function loadAbi(fileName) {
  const response = await fetch(fileName);
  return await response.json();
}

// === Init Web3 + Contracts ===
async function init() {
  if (window.ethereum) {
    web3 = new Web3(window.ethereum);
    try {
      accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      document.getElementById("walletAddress").innerText = "Connected: " + accounts[0];

      // Load ABIs
      const JODA_ABI = await loadAbi("JODA.json");
      const JODASale_ABI = await loadAbi("JODASale.json");
      const JODAStaking_ABI = await loadAbi("JODAStaking.json");

      // Create contract instances
      JODA = new web3.eth.Contract(JODA_ABI, JODA_ADDRESS);
      JODASale = new web3.eth.Contract(JODASale_ABI, JODASale_ADDRESS);
      JODAStaking = new web3.eth.Contract(JODAStaking_ABI, JODAStaking_ADDRESS);

      console.log("Contracts loaded successfully ✅");
    } catch (error) {
      console.error("User denied account access or error:", error);
    }
  } else {
    alert("Please install MetaMask!");
  }
}

// === Example Calls ===

// Read total supply
async function getTotalSupply() {
  const supply = await JODA.methods.totalSupply().call();
  document.getElementById("status").innerText = "Total Supply: " + web3.utils.fromWei(supply, "ether") + " JODA";
}

// Buy tokens
async function buyTokens() {
  const value = web3.utils.toWei("0.1", "ether"); // Example: buy with 0.1 BNB
  await JODASale.methods.buy().send({ from: accounts[0], value });
  document.getElementById("status").innerText = "Bought tokens!";
}

// Stake tokens
async function stakeTokens() {
  const amount = web3.utils.toWei("50", "ether"); // Example: stake 50 JODA
  await JODA.methods.approve(JODAStaking_ADDRESS, amount).send({ from: accounts[0] });
  await JODAStaking.methods.stake(amount).send({ from: accounts[0] });
  document.getElementById("status").innerText = "Staked 50 JODA!";
}

window.addEventListener("load", init);
