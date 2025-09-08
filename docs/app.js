// ===== Config =====
const SALE_ADDRESS    = "0x9146aEE05EbCFD30950D4E964cE256e32E1CbcfD";
const STAKING_ADDRESS = "0xee5ef7b0140a061032613F157c8366D5a29ABB95";
const REFRESH_MS = 20000;

// ===== Ethers setup =====
const provider = new ethers.providers.Web3Provider(window.ethereum || {}, "any");
let signer, sale, staking, token; // token is read from sale.token()
let saleRateWei = null, minBuyWei = null;

// ===== DOM =====
const $ = (id)=>document.getElementById(id);
const els = {
  toast: $('toast'), status: $('status'),
  connect: $('connectBtn'), disconnect: $('disconnectBtn'),
  theme: $('themeBtn'),
  tabBuy: $('tabBuy'), tabStake: $('tabStake'),
  buySec: $('buySection'), stakeSec: $('stakeSection'),
  buyAmount: $('buyAmount'), buyBtn: $('buyBtn'), buyPrev: $('buyPreview'), buyRes: $('buyResult'),
  stakeAmt: $('stakeAmount'), stakeMonths: $('stakeMonths'), stakeBtn: $('stakeBtn'), stakeList: $('stakeList'),
  saleActive: $('saleActive'), minBuyBnb: $('minBuyBnb'), rateWei: $('rateWei'), available: $('available'),
  balBNB: $('balBNB'), balJODA: $('balJODA'),
  wal: $('walletAddress'), saleAddr: $('saleAddr'), stAddr: $('stakeAddr'),
  copyUser: $('copyUser'), copySale: $('copySale'), copyStake: $('copyStake'),
};

// ===== UI helpers =====
const short = (a)=>a?`${a.slice(0,6)}…${a.slice(-4)}`:'—';
function toast(msg, kind=''){ els.toast.textContent = msg; els.toast.className = `toast ${kind}`; els.toast.hidden=false; setTimeout(()=>els.toast.hidden=true, 4200); }
function setStatus(msg, cls='muted'){ els.status.textContent = msg; els.status.className = `center ${cls}`; }

// Theme
(function initTheme(){
  const saved = localStorage.getItem('joda-theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
  els.theme.onclick = ()=>{
    const cur = document.documentElement.getAttribute('data-theme')==='light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', cur);
    localStorage.setItem('joda-theme', cur);
  };
})();

// ===== ABI loader & contracts =====
async function loadABI(p){ const r = await fetch(p); return r.json(); }

async function makeContracts(signerOrProvider){
  const saleAbi = await loadABI('JODASale.json');
  const stakeAbi = await loadABI('JODAStaking.json');
  sale = new ethers.Contract(SALE_ADDRESS, saleAbi, signerOrProvider);
  staking = new ethers.Contract(STAKING_ADDRESS, stakeAbi, signerOrProvider);
  els.saleAddr.textContent = SALE_ADDRESS; els.stAddr.textContent = STAKING_ADDRESS;
  // resolve token address for balances
  try{
    const tokenAddr = await sale.token();
    const tokenAbi = await loadABI('JODA.json');
    token = new ethers.Contract(tokenAddr, tokenAbi, signerOrProvider);
  }catch{}
}

// ===== Wallet connect / disconnect =====
async function getConnection(){
  if (!window.ethereum) return { connected:false };
  try{
    const accs = await window.ethereum.request({ method:'eth_accounts' });
    return { connected: !!accs[0], address: accs[0] };
  }catch{ return { connected:false }; }
}

function applyWalletUI({connected,address}){
  if (connected){
    els.connect.textContent = 'Connected ✓';
    els.connect.disabled = true;
    els.disconnect.disabled = false;
    els.wal.textContent = address ? address : '—';
    setStatus('Ready (MetaMask detected)', 'ok');
  }else{
    els.connect.textContent = 'Connect Wallet';
    els.connect.disabled = false;
    els.disconnect.disabled = true;
    els.wal.textContent = '—';
    setStatus('Connect wallet to continue');
  }
}

async function connect(){
  if (!window.ethereum){ toast('MetaMask not found', 'warn'); return; }
  try{
    await window.ethereum.request({ method:'eth_requestAccounts' });
    signer = provider.getSigner();
    await makeContracts(signer);
    applyWalletUI({connected:true,address:await signer.getAddress()});
    await refreshAll();
    toast('Wallet connected','ok');
  }catch(e){
    toast(e?.code===4001 ? 'Connection cancelled' : 'Connection failed','warn');
  }
}
function disconnect(){
  signer=null; sale=null; staking=null; token=null;
  applyWalletUI({connected:false});
  els.balBNB.textContent='—'; els.balJODA.textContent='—';
  els.stakeList.innerHTML='No stakes yet.'; 
  toast('Disconnected');
}

els.connect.onclick = connect;
els.disconnect.onclick = disconnect;
els.copyUser.onclick = async ()=>{ try{ await navigator.clipboard.writeText(els.wal.textContent); toast('Address copied','ok'); }catch{} };
els.copySale.onclick = async ()=>{ try{ await navigator.clipboard.writeText(SALE_ADDRESS); toast('Sale address copied','ok'); }catch{} };
els.copyStake.onclick = async ()=>{ try{ await navigator.clipboard.writeText(STAKING_ADDRESS); toast('Staking address copied','ok'); }catch{} };

if (window.ethereum){
  window.ethereum.on?.('accountsChanged', async (accs)=>{
    if (accs.length){ signer=provider.getSigner(); await makeContracts(signer); applyWalletUI({connected:true,address:accs[0]}); await refreshAll(); }
    else{ disconnect(); }
  });
  window.ethereum.on?.('chainChanged', ()=>window.location.reload());
}

// ===== Stats / balances / stakes =====
async function refreshSaleInfo(){
  if (!sale) return;
  try{
    const [active, minWei, rate, avail] = await Promise.all([
      sale.saleActive(), sale.minBuyWei(), sale.tokensPerBNB(), sale.availableTokens()
    ]);
    minBuyWei=minWei; saleRateWei=rate;
    els.saleActive.textContent = active ? 'Yes' : 'No';
    els.minBuyBnb.textContent  = ethers.utils.formatEther(minWei);
    els.rateWei.textContent    = rate.toString();
    els.available.textContent  = ethers.utils.formatUnits(avail,18);
    updateEstimate();
  }catch(e){ console.warn(e); }
}

function updateEstimate(){
  if (!saleRateWei) { els.buyPrev.textContent=''; return; }
  const val = parseFloat(els.buyAmount.value||'0');
  if (!val){ els.buyPrev.textContent=''; return; }
  try{
    const outWei = ethers.utils.parseEther(val.toString()).mul(saleRateWei);
    els.buyPrev.textContent = `~ You’ll receive ≈ ${ethers.utils.formatUnits(outWei,18)} JODA`;
  }catch{ els.buyPrev.textContent=''; }
}
els.buyAmount.addEventListener('input', updateEstimate);

async function refreshBalances(){
  if (!signer) return;
  try{
    const addr = await signer.getAddress();
    const [bnb, joda] = await Promise.all([
      provider.getBalance(addr),
      token ? token.balanceOf(addr) : Promise.resolve(ethers.constants.Zero)
    ]);
    els.balBNB.textContent  = ethers.utils.formatEther(bnb);
    els.balJODA.textContent = token ? ethers.utils.formatUnits(joda,18) : '—';
  }catch{}
}

function fmtTimeLeft(ms){
  if (ms<=0) return 'Ready';
  const s=Math.floor(ms/1000), d=Math.floor(s/86400), h=Math.floor((s%86400)/3600), m=Math.floor((s%3600)/60);
  return `${d}d ${h}h ${m}m`;
}

async function refreshStakes(){
  if (!signer || !staking) { els.stakeList.innerHTML='No stakes yet.'; return; }
  try{
    const user = await signer.getAddress();
    // We’ll read sequentially; if contract exposes `stakeCount` & `stakes(user,i)` this is fine.
    const count = (await staking.stakeCount(user)).toNumber?.() ?? Number(await staking.stakeCount(user));
    if (!count){ els.stakeList.innerHTML='No stakes yet.'; return; }

    const container = document.createElement('div');
    for(let i=0;i<count;i++){
      const s = await staking.stakes(user,i);
      const amount = ethers.utils.formatUnits(s.amount,18);
      const end = (Number(s.startTime) + Number(s.durationDays)*86400) * 1000;
      const li = document.createElement('div');
      li.className='item';
      const left = Math.max(0, end - Date.now());
      li.innerHTML = `
        <div>Stake #${i+1} • ${amount} JODA</div>
        <div class="muted" data-end="${end}">${fmtTimeLeft(left)}</div>
        <div><button class="chip withdrawBtn" data-id="${i}" ${left>0?'disabled':''}>Withdraw</button></div>
      `;
      container.appendChild(li);
    }
    els.stakeList.innerHTML='';
    els.stakeList.appendChild(container);

    // attach withdraw listeners
    els.stakeList.querySelectorAll('.withdrawBtn').forEach(btn=>{
      btn.onclick = async ()=>{
        const id = Number(btn.dataset.id);
        try{
          btn.disabled=true; toast('Withdrawing…');
          const tx = await staking.withdraw(id);
          toast(`Pending: ${tx.hash}`);
          await tx.wait();
          toast('Withdraw confirmed','ok');
          await Promise.all([refreshBalances(), refreshStakes()]);
        }catch(e){
          console.error(e); toast('Withdraw failed','warn'); btn.disabled=false;
        }
      };
    });

  }catch(e){ console.warn(e); }
}

// live countdown updater
setInterval(()=>{
  document.querySelectorAll('[data-end]').forEach(el=>{
    const end = Number(el.getAttribute('data-end'));
    const left = Math.max(0, end - Date.now());
    el.textContent = fmtTimeLeft(left);
    const btn = el.parentElement?.nextElementSibling?.querySelector('button.withdrawBtn');
    if (btn && left<=0) btn.disabled=false;
  });
}, 1000);

// ===== Actions =====
els.buyBtn.onclick = async ()=>{
  if (!signer || !sale){ toast('Connect wallet first','warn'); return; }
  const val = els.buyAmount.value;
  if (!val || Number(val)<=0){ toast('Enter BNB amount','warn'); return; }
  try{
    toast('Submitting buy…');
    const tx = await sale.buy({ value: ethers.utils.parseEther(val) });
    toast(`Pending: ${tx.hash}`);
    await tx.wait();
    els.buyRes.textContent = `Buy confirmed: ${tx.hash}`;
    toast('Buy confirmed','ok');
    await Promise.all([refreshSaleInfo(), refreshBalances()]);
  }catch(e){ console.error(e); toast('Buy failed','warn'); }
};

els.stakeBtn.onclick = async ()=>{
  if (!signer || !staking){ toast('Connect wallet first','warn'); return; }
  const amt = els.stakeAmt.value, months = parseInt(els.stakeMonths.value||'3',10);
  if (!amt || Number(amt)<=0){ toast('Enter amount to stake','warn'); return; }
  try{
    toast('Submitting stake…');
    const tx = await staking.stake(ethers.utils.parseUnits(amt,18), months);
    toast(`Pending: ${tx.hash}`);
    await tx.wait();
    toast('Stake confirmed','ok');
    await Promise.all([refreshBalances(), refreshStakes()]);
  }catch(e){ console.error(e); toast('Stake failed','warn'); }
};

// Tabs
els.tabBuy.onclick   = ()=>{ els.tabBuy.classList.add('active'); els.tabStake.classList.remove('active'); els.buySec.style.display='block'; els.stakeSec.style.display='none'; };
els.tabStake.onclick = ()=>{ els.tabStake.classList.add('active'); els.tabBuy.classList.remove('active'); els.buySec.style.display='none'; els.stakeSec.style.display='block'; };

// ===== Master refresh =====
async function refreshAll(){
  await Promise.all([refreshSaleInfo(), refreshBalances(), refreshStakes()]);
}

// ===== Init =====
(async function init(){
  els.saleAddr.textContent = SALE_ADDRESS;
  els.stAddr.textContent   = STAKING_ADDRESS;

  try{ await makeContracts(provider); await refreshSaleInfo(); }catch{}

  const s = await getConnection();
  applyWalletUI(s);
  if (s.connected){
    signer = provider.getSigner();
    await makeContracts(signer);
    await refreshAll();
  }

  // periodic refresh
  setInterval(()=>{ if (signer) refreshAll(); }, REFRESH_MS);
})();
