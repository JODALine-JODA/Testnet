// ===== JODA Web App (ethers v6) =====

// ---------- 0) Config ----------
const RPC = "https://data-seed-prebsc-1-s1.binance.org:8545/";
const ADDRS = {
  token:   "0xB2EFA488040B036E50a18C9d2D8110AF743c5504",
  sale:    "0x9146aEE05EbCFD30950D4E964cE256e32E1CbcfD",
  staking: "0xee5ef7b0140a061032613F157c8366D5a29ABB95",
};

// Load ABIs (kept external, next to this file)
async function loadAbi(name){
  const r = await fetch(`${name}.json`);
  return r.json();
}

// ---------- 1) Helpers ----------
const $ = (id)=>document.getElementById(id);
const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));

function toast(msg){
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2600);
}

function copyText(id){
  const el = $(id);
  if(!el) return;
  navigator.clipboard.writeText(el.textContent || el.value || '').then(()=>toast('Copied'));
}

function short(addr){ return addr ? addr.slice(0,6)+'…'+addr.slice(-4) : '—'; }

function setThemeToggle(){
  const root = document.documentElement;
  const btn = $('themeBtn');
  const saved = localStorage.getItem('joda_theme');
  if(saved==='light') root.classList.add('light');
  btn.onclick = ()=>{
    root.classList.toggle('light');
    localStorage.setItem('joda_theme', root.classList.contains('light')?'light':'dark');
  };
}

function showContractAddresses(){
  $('saleAddr').textContent     = ADDRS.sale;
  $('stakingAddr').textContent  = ADDRS.staking;
  $('tokenAddr').textContent    = ADDRS.token;
  $('saleAddr2').textContent    = ADDRS.sale;
  $('stakingAddr2').textContent = ADDRS.staking;
}

// ---------- 2) State ----------
let provider, roProvider, signer, user;
let token, sale, staking;
let TOKEN_ABI, SALE_ABI, STAKING_ABI;

// ---------- 3) UI: Tabs + Drawer ----------
function setupTabs(){
  const tabs = [
    ['tabBuy',      'buy'],
    ['tabStake',    'stake'],
    ['tabContracts','contracts'],
    ['tabAffiliate','affiliate'],
  ];
  function activate(key){
    tabs.forEach(([btn,sec])=>{
      $(btn).classList.toggle('active', sec===key);
      document.getElementById(sec).style.display = (sec===key)?'grid':'none';
    });
  }
  tabs.forEach(([btn,sec])=> $(btn).onclick=()=>activate(sec));
  activate('affiliate'); // show affiliate first
}
function setupDrawer(){
  const drawer = $('drawer');
  $('menuBtn').onclick = ()=> drawer.classList.toggle('open');
  drawer.addEventListener('click', e=>{
    if(e.target.tagName==='A') drawer.classList.remove('open');
  });
}

// ---------- 4) Blockchain setup ----------
async function makeContracts(p){
  token   = new ethers.Contract(ADDRS.token,   TOKEN_ABI, p);
  sale    = new ethers.Contract(ADDRS.sale,    SALE_ABI, p);
  staking = new ethers.Contract(ADDRS.staking, STAKING_ABI, p);
}

async function ensureBscTestnet(){
  // no-op on GitHub pages (read-only allowed); MetaMask path handled at connect
  return;
}

async function connectWallet(){
  try{
    await ensureBscTestnet();
    provider = new ethers.BrowserProvider(window.ethereum);
    const acc = await provider.send('eth_requestAccounts', []);
    signer = await provider.getSigner();
    user = ethers.getAddress(acc[0]);

    $('userAddr').textContent = user;
    $('connectBtn').style.display = 'none';
    $('disconnectBtn').style.display = '';
    $('status').textContent = 'Ready (MetaMask detected)';
    $('status').className = 'pill ok';

    await refreshAll();
    updateReferralUI();
  }catch(e){
    console.error(e);
    toast('Wallet connection failed');
  }
}

function disconnectWallet(){
  user = undefined; signer = undefined; provider = undefined;
  $('userAddr').textContent = '—';
  $('connectBtn').style.display = '';
  $('disconnectBtn').style.display = 'none';
  $('status').textContent = 'Ready (read-only)';
  $('status').className = 'pill muted';
}

// ---------- 5) Reads ----------
async function refreshSale(){
  try{
    const active = await sale.saleActive();
    $('saleActive').textContent = active ? 'Yes' : 'No';
    $('saleActive').className = active ? 'ok' : 'bad';

    const minWei = await sale.minBuyWei();
    const minBnb = Number(ethers.formatEther(minWei));
    $('minBuyBnb').textContent = minBnb.toFixed(2);

    const tPerBnbWei = await sale.tokensPerBNB();
    // Display as real tokens (18 decimals)
    const tPerBnb = Number(ethers.formatUnits(tPerBnbWei, 18));
    $('tokensPerBnb').textContent = tPerBnb.toLocaleString();

    const avail = await sale.availableTokens();
    $('available').textContent = Number(ethers.formatUnits(avail, 18)).toLocaleString();
  }catch(e){
    console.error(e);
  }
}

async function refreshBalances(){
  try{
    const p = provider || roProvider;
    if(!p) return;
    const who = user || ADDRS.sale; // fallback address for display
    const bnb = await p.getBalance(who);
    $('bnbBal').textContent = Number(ethers.formatEther(bnb)).toFixed(6);

    const bal = await token.balanceOf(who);
    $('jodaBal').textContent = Number(ethers.formatUnits(bal,18)).toLocaleString();
  }catch(e){ console.error(e); }
}

async function refreshStakes(){
  try{
    if(!user){ $('stakeList').textContent = 'Connect wallet to see stakes.'; return; }
    const count = await staking.stakeCount(user);
    if(count == 0){ $('stakeList').textContent = 'No stakes yet.'; return; }
    let out = '';
    for(let i=0;i<Number(count);i++){
      const s = await staking.stakes(user, i);
      const amt = Number(ethers.formatUnits(s.amount,18));
      const months = Number(s.durationDays)/30;
      const start = new Date(Number(s.startTime)*1000).toLocaleDateString();
      out += `• #${i+1}: ${amt} JODA · ${months}m · start ${start} ${s.claimed?'(withdrawn)':''}<br/>`;
    }
    $('stakeList').innerHTML = out;
  }catch(e){ console.error(e); }
}

async function refreshAll(){
  await refreshSale();
  await refreshBalances();
  await refreshStakes();
}

// ---------- 6) Writes ----------
async function doBuy(){
  if(!signer) return toast('Connect wallet');
  const val = $('buyBnb').value.trim();
  if(!val) return;
  try{
    $('buyBtn').disabled = true;
    const tx = await sale.connect(signer).buy({ value: ethers.parseEther(val) });
    const r = await tx.wait();
    $('buyMsg').textContent = `Buy confirmed: ${r.hash.slice(0,10)}…`;
    await refreshAll();
  }catch(e){
    console.error(e);
    $('buyMsg').textContent = e?.info?.error?.message ?? e.message ?? 'Buy failed';
  }finally{
    $('buyBtn').disabled = false;
  }
}

async function approveStake(){
  if(!signer) return toast('Connect wallet');
  try{
    $('approveBtn').disabled = true;
    const amt = $('stakeAmt').value.trim();
    if(!amt) return;
    const wei = ethers.parseUnits(amt,18);
    const tx = await token.connect(signer).approve(ADDRS.staking, wei);
    await tx.wait();
    $('stakeMsg').textContent = 'Approved.';
  }catch(e){
    console.error(e);
    $('stakeMsg').textContent = e?.info?.error?.message ?? e.message ?? 'Approve failed';
  }finally{
    $('approveBtn').disabled = false;
  }
}

async function doStake(){
  if(!signer) return toast('Connect wallet');
  try{
    $('stakeBtn').disabled = true;
    const amt = $('stakeAmt').value.trim();
    const months = Number($('stakeMonths').value);
    if(!amt || !months) return;
    const wei = ethers.parseUnits(amt,18);
    const tx = await staking.connect(signer).stake(wei, months);
    await tx.wait();
    $('stakeMsg').textContent = 'Staked!';
    await refreshAll();
  }catch(e){
    console.error(e);
    $('stakeMsg').textContent = e?.info?.error?.message ?? e.message ?? 'Stake failed';
  }finally{
    $('stakeBtn').disabled = false;
  }
}

// ---------- 7) Affiliate (front & simple) ----------
function getRefFromUrl(){
  const u = new URL(window.location.href);
  const ref = u.searchParams.get('ref');
  return ref && ethers.isAddress(ref) ? ethers.getAddress(ref) : null;
}

function updateReferralUI(){
  const base = window.location.origin + window.location.pathname;
  const code = user || '—';
  $('refCode').value = code;
  $('refLink').value = user ? `${base}?ref=${user}` : `${base}`;
  $('refMsg').textContent = user ? 'Share your link to earn JODA on purchases.' : 'Connect wallet to generate your link.';
}

function decorateStoreUrl(){
  const raw = $('storeUrl').value.trim();
  if(!raw){ toast('Paste a store link'); return; }
  // Placeholder: when you integrate with real merchants, add parameters here.
  // For now just append ?ref=address if connected.
  const u = new URL(raw);
  if(user) u.searchParams.set('ref', user);
  $('storeUrl').value = u.toString();
  $('refMsg').textContent = 'Link decorated (demo).';
  toast('Decorated');
}

// ---------- 8) Init ----------
async function init(){
  setThemeToggle();
  setupTabs();
  setupDrawer();
  showContractAddresses();

  // read-only provider
  try{
    roProvider = new ethers.JsonRpcProvider(RPC);
    $('status').textContent = 'Ready (read-only)';
    $('status').className   = 'pill muted';
  }catch(e){ console.error(e); }

  // load ABIs + contracts
  [TOKEN_ABI, SALE_ABI, STAKING_ABI] = await Promise.all([
    loadAbi('JODA'),
    loadAbi('JODASale'),
    loadAbi('JODAStaking'),
  ]);
  await makeContracts(roProvider);

  // wire buttons
  $('connectBtn').onclick   = connectWallet;
  $('disconnectBtn').onclick= disconnectWallet;
  $('buyBtn').onclick       = doBuy;
  $('approveBtn').onclick   = approveStake;
  $('stakeBtn').onclick     = doStake;
  $('copyRefBtn').onclick   = ()=>copyText('refLink');
  $('decorateBtn').onclick  = decorateStoreUrl;

  // put ref (if any) on the panel
  updateReferralUI();

  // initial data + periodic refresh
  await refreshAll();
  setInterval(refreshAll, 20000);
}

// kick
init().catch(console.error);
