import {
  BrowserProvider, JsonRpcProvider, Contract,
  formatEther, parseEther, formatUnits, parseUnits
} from "https://cdn.jsdelivr.net/npm/ethers@6.13.0/dist/ethers.min.js";

/* ---------- 1) EDIT YOUR CONTRACT ADDRESSES (Testnet) ---------- */
const TOKEN_ADDRESS   = "0xB2EFA488040B036E50a18C9d2D8110AF743c5504";
const SALE_ADDRESS    = "0x9146aEE05EbCFD30950D4E964cE256e32E1CbcfD";
const STAKING_ADDRESS = "0xee5ef7b0140a061032613F157c8366D5a29ABB95";

/* ---------- 2) ABIs (fetched from local JSON files) ------------ */
async function loadJson(path){ const r = await fetch(path); if(!r.ok) throw new Error(`Fetch failed: ${path}`); return r.json(); }
const TOKEN_ABI   = await loadJson("./JODA.json");
const SALE_ABI    = await loadJson("./JODASale.json");
const STAKE_ABI   = await loadJson("./JODAStaking.json");

/* ---------- 3) DOM helpers ------------------------------------ */
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);
const toast = (msg) => { const t=$("#toast"); t.textContent=msg; t.style.display="inline-block"; setTimeout(()=>t.style.display="none", 3800); };

let provider, signer, user, token, sale, staking;
let poller=null;

/* ---------- 4) Network helpers -------------------------------- */
async function ensureBscTestnet(){
  const chainId = await provider.send("eth_chainId",[]);
  // BSC Testnet = 0x61
  if (chainId !== "0x61"){
    await provider.send("wallet_switchEthereumChain",[{chainId:"0x61"}]);
  }
}

/* ---------- 5) Contracts -------------------------------------- */
function makeContracts(prov){
  provider = prov;
  token   = new Contract(TOKEN_ADDRESS,  TOKEN_ABI,  provider);
  sale    = new Contract(SALE_ADDRESS,   SALE_ABI,   provider);
  staking = new Contract(STAKING_ADDRESS,STAKE_ABI,  provider);

  // addresses on page
  $("#addrSale").textContent    = SALE_ADDRESS;
  $("#addrStaking").textContent = STAKING_ADDRESS;
  $("#cToken").textContent      = TOKEN_ADDRESS;
  $("#cSale").textContent       = SALE_ADDRESS;
  $("#cStaking").textContent    = STAKING_ADDRESS;
}

/* ---------- 6) Read-only refresh ------------------------------ */
async function refreshAll(){
  try{
    // sale status
    const [active,minBuyWei,tknPerBnbWei] = await Promise.all([
      sale.saleActive(),
      sale.minBuyWei(),
      sale.tokensPerBNB()
    ]);
    $("#saleActive").textContent = active ? "Yes" : "No";
    $("#minBuy").textContent     = Number(formatEther(minBuyWei)).toFixed(2);
    // tokensPerBNB is token-wei per 1 BNB -> show human tokens
    $("#tknPerBnb").textContent  = Number(formatUnits(tknPerBnbWei,18)).toLocaleString();

    // available = token.balanceOf(sale)
    const avail = await token.balanceOf(SALE_ADDRESS);
    $("#available").textContent  = Number(formatUnits(avail,18)).toLocaleString();

    // if wallet connected, balances:
    if(signer){
      const [balBNB, balJODA] = await Promise.all([
        provider.getBalance(user),
        token.balanceOf(user)
      ]);
      $("#balBNB").textContent  = Number(formatEther(balBNB)).toFixed(6);
      $("#balJODA").textContent = Number(formatUnits(balJODA,18)).toLocaleString();
    }

  }catch(e){
    console.error(e);
    $("#status").textContent = "Read error (see console)";
  }
}

/* ---------- 7) Connect / Disconnect --------------------------- */
async function connect(){
  try{
    if(!window.ethereum){ toast("MetaMask not found"); return; }
    const webProv = new BrowserProvider(window.ethereum);
    await ensureBscTestnet.call({send:(m,a)=>window.ethereum.request({method:m,params:a})}); // pre-switch using raw
    provider = webProv;
    await ensureBscTestnet();
    const accs = await window.ethereum.request({method:"eth_requestAccounts"});
    user = accs[0];
    signer = await provider.getSigner();

    makeContracts(provider);
    $("#addrUser").textContent = user;
    $("#status").textContent = "Connected";
    $("#connectBtn").style.display="none";
    $("#disconnectBtn").style.display="inline-block";

    await refreshAll();
    if(poller) clearInterval(poller);
    poller = setInterval(refreshAll, 20000);

    // build affiliate link
    const base = location.href.split("?")[0];
    const aff  = `${base}?ref=${user}`;
    $("#affLink").value = aff;
    $("#openAff").href  = aff;

  }catch(e){
    console.error(e);
    $("#status").textContent = "Wallet: connection failed";
    toast("Wallet connection failed");
  }
}

function disconnect(){
  signer = null; user = null;
  $("#addrUser").textContent = "—";
  $("#status").textContent = "Ready (read-only)";
  $("#connectBtn").style.display="inline-block";
  $("#disconnectBtn").style.display="none";
  if(poller) clearInterval(poller);
  poller=null;
  refreshAll();
}

/* ---------- 8) Buy -------------------------------------------- */
async function doBuy(){
  try{
    if(!signer) return toast("Connect wallet first");
    const bnb = $("#bnbToSpend").value.trim();
    if(!bnb || Number(bnb)<=0) return toast("Enter BNB amount");
    const minBuy = await sale.minBuyWei();
    if(parseEther(bnb) < minBuy){
      return toast(`Min buy is ${Number(formatEther(minBuy)).toFixed(2)} BNB`);
    }

    const saleWithSigner = sale.connect(signer);
    // optional: referral capture
    const urlRef = new URLSearchParams(location.search).get("ref");
    // (no on-chain referral param in this contract; off-chain tracking only)

    $("#buyBtn").disabled = true;
    const tx = await saleWithSigner.buy({value: parseEther(bnb)});
    $("#status").textContent = "Buying… waiting for confirmation";
    const r  = await tx.wait();
    toast(`Buy confirmed in block ${r.blockNumber}`);
    await refreshAll();
  }catch(e){
    console.error(e);
    toast(e?.info?.error?.message ?? e.message ?? "Buy failed");
  }finally{
    $("#buyBtn").disabled = false;
  }
}

/* ---------- 9) Stake (approve + stake) ------------------------ */
async function doApprove(){
  try{
    if(!signer) return toast("Connect wallet first");
    const amt = $("#stakeAmount").value.trim();
    if(!amt || Number(amt)<=0) return toast("Enter stake amount");
    $("#approveBtn").disabled=true;
    const tokenS = token.connect(signer);
    const tx = await tokenS.approve(STAKING_ADDRESS, parseUnits(amt,18));
    $("#stakeMsg").textContent = "Approving…";
    await tx.wait();
    $("#stakeMsg").textContent = "Approved.";
    toast("Approved");
  }catch(e){
    console.error(e);
    toast(e?.info?.error?.message ?? e.message ?? "Approve failed");
  }finally{
    $("#approveBtn").disabled=false;
  }
}
async function doStake(){
  try{
    if(!signer) return toast("Connect wallet first");
    const amt = $("#stakeAmount").value.trim();
    const months = Number($("#stakeMonths").value);
    if(!amt || Number(amt)<=0) return toast("Enter stake amount");
    $("#stakeBtn").disabled=true;
    const stakeS = staking.connect(signer);
    const tx = await stakeS.stake(parseUnits(amt,18), months);
    $("#stakeMsg").textContent = "Staking…";
    await tx.wait();
    $("#stakeMsg").textContent = "Staked!";
    toast("Stake confirmed");
  }catch(e){
    console.error(e);
    toast(e?.info?.error?.message ?? e.message ?? "Stake failed");
  }finally{
    $("#stakeBtn").disabled=false;
  }
}

/* ---------- 10) UI wiring ------------------------------------- */
function wire(){
  // tabs
  $$(".tab").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      $$(".tab").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      const id = btn.dataset.tab;
      $$(".tabpane").forEach(p=>p.classList.remove("show"));
      $("#"+id).classList.add("show");
    });
  });

  // copy buttons
  $$("[data-copy]").forEach(b=>{
    b.addEventListener("click", ()=>{
      const t = $(b.dataset.copy)?.textContent ?? "";
      navigator.clipboard.writeText(t);
      toast("Copied");
    });
  });

  $("#connectBtn").addEventListener("click", connect);
  $("#disconnectBtn").addEventListener("click", disconnect);
  $("#buyBtn").addEventListener("click", doBuy);
  $("#approveBtn").addEventListener("click", doApprove);
  $("#stakeBtn").addEventListener("click", doStake);

  // affiliate inputs
  $("#copyAff").addEventListener("click", ()=>{
    navigator.clipboard.writeText($("#affLink").value);
    toast("Affiliate link copied");
  });

  // initial provider: try MetaMask read-only, else public RPC
  if(window.ethereum){
    const prov = new BrowserProvider(window.ethereum);
    makeContracts(prov);
    $("#status").textContent = "Ready (MetaMask detected)";
  }else{
    // Public BSC testnet RPC
    const RPC = "https://data-seed-prebsc-1-s1.binance.org:8545/";
    makeContracts(new JsonRpcProvider(RPC));
    $("#status").textContent = "Ready (RPC)";
  }

  refreshAll();
}

/* ---------- 11) Boot ------------------------------------------ */
wire();
