// ===== CONTRACT CONFIG =====
const JODA_ADDR = "0xB2EFA488040B036E50a18C9d2D8110AF743c5504"; // update as needed
const SALE_ADDR = "0x9146aEE05EbCFD30950D4E964cE256e32E1CbcfD";
const STAKE_ADDR = "0xee5ef7b0140a061032613F157c8366D5a29ABB95";

// load ABIs
let JODA_ABI, SALE_ABI, STAKE_ABI;
async function loadABIs(){
  JODA_ABI = await (await fetch("JODA.json")).json();
  SALE_ABI = await (await fetch("JODASale.json")).json();
  STAKE_ABI = await (await fetch("JODAStaking.json")).json();
}

// global
let provider, signer, accounts, joda, sale, stake;

function $(id){ return document.getElementById(id); }

// ---- Toast helpers ----
function showToast(message, type='info', title){
  const stack = document.getElementById('toastStack');
  const wrap = document.createElement('div');
  wrap.className = `toast ${type}`;
  wrap.setAttribute('role','status');

  wrap.innerHTML = `
    <button class="close" aria-label="Dismiss">&times;</button>
    ${title ? `<div class="title">${title}</div>` : ''}
    <div class="msg">${escapeHtml(message)}</div>
  `;

  wrap.querySelector('.close').addEventListener('click', ()=>dismissToast(wrap));

  stack.appendChild(wrap);
  requestAnimationFrame(()=> wrap.classList.add('show'));

  const timeout = setTimeout(()=>dismissToast(wrap), 3200);
  wrap._timeout = timeout;
}

function dismissToast(node){
  if (!node) return;
  if (node._timeout) clearTimeout(node._timeout);
  node.classList.remove('show');
  setTimeout(()=> node.remove(), 220);
}

function escapeHtml(str=''){
  return String(str)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#39;');
}

// ---- Connect Wallet ----
async function doConnect(){
  try {
    await window.ethereum.request({ method:'eth_requestAccounts' });
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    accounts = await provider.send("eth_accounts", []);
    $("walletAddress").textContent = accounts[0];
    $("status").textContent = "✅ Connected";
    showToast("Wallet connected","success","Wallet");

    joda = new ethers.Contract(JODA_ADDR,JODA_ABI,signer);
    sale = new ethers.Contract(SALE_ADDR,SALE_ABI,signer);
    stake = new ethers.Contract(STAKE_ADDR,STAKE_ABI,signer);
  } catch(e){
    showToast("Connection failed","error","Wallet");
  }
}

// ---- Buy ----
async function doBuy(){
  try {
    const val = $("buyAmount").value;
    if (!val || val<=0) return showToast("Enter BNB amount","error","Buy");

    const wei = ethers.parseUnits(val,"ether");
    const tx = await sale.buy({ value: wei });
    await tx.wait();
    showToast("JODA purchased successfully","success","Buy");
  } catch(e){
    showToast(e?.info?.error?.message ?? e.message,"error","Buy");
  }
}

// ---- Stake ----
async function doStake(){
  try {
    const amt = $("stakeAmount").value;
    const months = $("stakeMonths").value;
    if (!amt || !months) return showToast("Enter amount + months","error","Stake");

    const wei = ethers.parseUnits(amt,"ether");
    const tx = await stake.stake(wei, months);
    await tx.wait();
    showToast("JODA staked successfully","success","Stake");
  } catch(e){
    showToast(e?.info?.error?.message ?? e.message,"error","Stake");
  }
}

async function doWithdraw(){
  try {
    const tx = await stake.withdraw();
    await tx.wait();
    showToast("Stake withdrawn","success","Withdraw");
  } catch(e){
    showToast(e?.info?.error?.message ?? e.message,"error","Withdraw");
  }
}

// ---- UI Tabs ----
$("tabBuy").onclick = ()=>{
  $("buySection").style.display="block";
  $("stakeSection").style.display="none";
};
$("tabStake").onclick = ()=>{
  $("buySection").style.display="none";
  $("stakeSection").style.display="block";
};

$("connectBtn").onclick = doConnect;
$("buyBtn").onclick = doBuy;
$("stakeBtn").onclick = doStake;
$("withdrawBtn").onclick = doWithdraw;

// init
loadABIs();
