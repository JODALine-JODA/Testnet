/* === Config: Testnet addresses === */
const TOKEN_ADDRESS   = "0xB2EFA488040B036E50a18C9d2D8110AF743c5504";
const SALE_ADDRESS    = "0x9146aEE05EbCFD30950D4E964cE256e32E1CbcfD";
const STAKING_ADDRESS = "0xee5ef7b0140a061032613F157c8366D5a29ABB95";
const RPC_FALLBACK    = "https://data-seed-prebsc-1-s1.binance.org:8545";

/* ABIs (loaded from JSON files in the same folder) */
let TOKEN_ABI, SALE_ABI, STAKING_ABI;

/* Ethers globals */
let provider, browserProvider, signer, user, token, sale, staking;

/* Helpers */
const $ = (q)=>document.querySelector(q);
const fmt = (n, d=6)=> Number(n).toLocaleString(undefined,{maximumFractionDigits:d});
const toEth  = (wei)=> Number(ethers.formatEther(wei));
const toJoda = (wei)=> Number(ethers.formatUnits(wei, 18));

function toast(msg, kind="ok"){
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = msg;
  $('#toast').appendChild(el);
  setTimeout(()=>el.remove(), 4200);
}

function short(addr){ if(!addr) return "—"; return addr.slice(0,6)+"…"+addr.slice(-4); }

/* Theme */
(function(){
  const saved = localStorage.getItem('joda_theme') || 'dark';
  document.body.className = saved === 'light' ? 'theme-light' : 'theme-dark';
  $('#themeBtn')?.addEventListener('click', ()=>{
    const now = document.body.classList.contains('theme-dark') ? 'light' : 'dark';
    document.body.className = now === 'light' ? 'theme-light' : 'theme-dark';
    localStorage.setItem('joda_theme', now);
  });
})();

/* Tabs */
function showTab(id){
  for(const el of document.querySelectorAll('.panel')) el.style.display='none';
  $(id).style.display = '';
  for(const b of document.querySelectorAll('.tabs button')) b.classList.remove('active');
  const map = { '#buyTab':'#tabBuy', '#stakeTab':'#tabStake', '#contractsTab':'#tabContracts', '#affiliateTab':'#tabAffiliate' };
  $(map[id])?.classList.add('active');
}
$('#tabBuy').onclick      = ()=>showTab('#buyTab');
$('#tabStake').onclick    = ()=>showTab('#stakeTab');
$('#tabContracts').onclick= ()=>showTab('#contractsTab');
$('#tabAffiliate').onclick= ()=>showTab('#affiliateTab');

/* Copy buttons in Contracts panel */
document.addEventListener('click', (e)=>{
  const btn = e.target.closest('button.copy');
  if(!btn) return;
  const target = btn.getAttribute('data-copy');
  const val = $(target).value;
  navigator.clipboard.writeText(val).then(()=>toast('Copied address'));
});

/* Affiliate */
function updateAffiliateUI(){
  const base = location.origin + location.pathname.replace(/index\.html?$/,'');
  const link = `${base}?ref=${user || ''}`;
  $('#affLink').value = link;
  $('#copyAff').onclick = ()=>navigator.clipboard.writeText(link).then(()=>toast('Affiliate link copied'));
  const ref = new URLSearchParams(location.search).get('ref');
  if(ref){
    const el = $('#refNotice');
    el.style.display = '';
    el.textContent = `Referred by ${short(ref)}`;
  }
}

/* Load ABIs then init providers */
(async function init(){
  try{
    // Load ABIs
    const [t,s,k] = await Promise.all([
      fetch('./JODA.json').then(r=>r.json()),
      fetch('./JODASale.json').then(r=>r.json()),
      fetch('./JODAStaking.json').then(r=>r.json())
    ]);
    TOKEN_ABI = t; SALE_ABI = s; STAKING_ABI = k;

    // Provider(s)
    if(window.ethereum){
      browserProvider = new ethers.BrowserProvider(window.ethereum);
      provider = browserProvider;
      $('#mmBadge').classList.add('ok');
      $('#mmBadge').textContent = 'MetaMask detected';
    }else{
      provider = new ethers.JsonRpcProvider(RPC_FALLBACK);
      $('#mmBadge').textContent = 'MetaMask not found';
    }

    $('#netBadge').textContent = 'BSC Testnet';

    // Contracts (read-only first)
    token   = new ethers.Contract(TOKEN_ADDRESS,   TOKEN_ABI,   provider);
    sale    = new ethers.Contract(SALE_ADDRESS,    SALE_ABI,    provider);
    staking = new ethers.Contract(STAKING_ADDRESS, STAKING_ABI, provider);

    // Fill contracts panel
    $('#tokenAddrShort').textContent = short(TOKEN_ADDRESS);
    $('#saleAddrShort').textContent  = short(SALE_ADDRESS);
    $('#stakeAddrShort').textContent = short(STAKING_ADDRESS);
    $('#tokenAddrFull').value = TOKEN_ADDRESS;
    $('#saleAddrFull').value  = SALE_ADDRESS;
    $('#stakeAddrFull').value = STAKING_ADDRESS;

    // Buttons
    $('#connectBtn').onclick = connect;
    $('#disconnectBtn').onclick = disconnect;
    $('#buyBtn').onclick = doBuy;
    $('#approveBtn').onclick = doApprove;
    $('#stakeBtn').onclick = doStake;

    updateAffiliateUI();
    await refreshAll();
    $('#status').textContent = 'Ready';
  }catch(e){
    console.error(e);
    $('#status').textContent = 'Error initializing app';
    toast('Init error', 'err');
  }
})();

/* Connect / Disconnect */
async function connect(){
  if(!browserProvider){ toast('MetaMask not found','err'); return; }
  try{
    const accounts = await browserProvider.send('eth_requestAccounts', []);
    signer = await browserProvider.getSigner();
    user = await signer.getAddress();
    $('#connectBtn').style.display='none';
    $('#disconnectBtn').style.display='';
    $('#walletShort').textContent = short(user);
    $('#status').innerHTML = 'Ready <span class="ok pill">MetaMask connected</span>';
    token   = token.connect(signer);
    sale    = sale.connect(signer);
    staking = staking.connect(signer);
    updateAffiliateUI();
    await refreshAll();
  }catch(e){
    console.error(e);
    toast('Wallet connection failed','err');
  }
}
function disconnect(){
  signer = undefined; user = undefined;
  $('#connectBtn').style.display='';
  $('#disconnectBtn').style.display='none';
  $('#walletShort').textContent = '—';
  $('#status').textContent = 'Disconnected';
}

/* Refresh data */
async function refreshAll(){
  try{
    // Sale
    const [active, minBuyWei, rateWei, availWei] = await Promise.all([
      sale.saleActive(), sale.minBuyWei(), sale.tokensPerBNB(), sale.availableTokens()
    ]);
    $('#saleActive').textContent   = active ? 'Yes' : 'No';
    $('#minBuyBnb').textContent    = fmt(toEth(minBuyWei), 6);
    // HUMAN TOKENS (not wei)
    $('#tokensPerBnbHuman').textContent = fmt(toJoda(rateWei), 6);
    $('#availableTokens').textContent   = fmt(toJoda(availWei), 6);

    // Balances (if wallet)
    if(user){
      const [bnbBalWei, jodaWei] = await Promise.all([
        provider.getBalance(user), token.balanceOf(user)
      ]);
      $('#bnbBal').textContent  = fmt(toEth(bnbBalWei), 6);
      $('#jodaBal').textContent = fmt(toJoda(jodaWei), 6);
    }else{
      $('#bnbBal').textContent  = '—';
      $('#jodaBal').textContent = '—';
    }

    await refreshStakeList();
  }catch(e){
    console.error(e);
  }
}

async function refreshStakeList(){
  const wrap = $('#stakeList');
  wrap.innerHTML = 'Loading…';
  try{
    if(!user){ wrap.textContent = 'Connect wallet to view stakes.'; return; }
    const count = await staking.stakeCount(user);
    if(Number(count) === 0){ wrap.textContent = 'No stakes yet.'; return; }
    const rows = [];
    for(let i=0;i<Number(count);i++){
      const s = await staking.stakes(user, i);
      const amount = fmt(toJoda(s.amount),6);
      const start  = Number(s.startTime) * 1000;
      const days   = Number(s.durationDays);
      const endMs  = start + days*24*3600*1000;
      const now    = Date.now();
      const canW   = await staking.canWithdraw(user, i);
      const left   = Math.max(0, Math.ceil((endMs-now)/1000));
      const leftTxt = left === 0 ? 'Ready' : secondsToDHMS(left);

      rows.push(`
        <div class="row">
          <div>
            <div class="tiny muted">Stake #${i}</div>
            <div>${amount} JODA • ${days} days • ends ${new Date(endMs).toLocaleString()}</div>
            <div class="tiny muted">Status: ${canW ? 'Withdrawable' : 'Locked'} • ${leftTxt}</div>
          </div>
          <div>
            <button ${canW ? '' : 'disabled'} data-w="${i}">Withdraw</button>
          </div>
        </div>
      `);
    }
    wrap.innerHTML = rows.join('');
    // bind withdraws
    wrap.querySelectorAll('button[data-w]').forEach(btn=>{
      btn.onclick = ()=>doWithdraw(Number(btn.getAttribute('data-w')), btn);
    });
  }catch(e){
    console.error(e);
    wrap.textContent = 'Failed to load stakes.';
  }
}
function secondsToDHMS(s){
  const d=Math.floor(s/86400); s%=86400;
  const h=Math.floor(s/3600); s%=3600;
  const m=Math.floor(s/60); const sec=s%60;
  return `${d}d ${h}h ${m}m ${sec}s`;
}

/* Actions */
async function doBuy(){
  if(!signer){ toast('Connect wallet','err'); return; }
  try{
    const bnb = parseFloat($('#buyBnb').value || '0');
    if(!(bnb>0)) return toast('Enter BNB amount','err');
    const minBuy = toEth(await sale.minBuyWei());
    if(bnb < minBuy) return toast(`Min buy is ${minBuy} BNB`,'err');

    const tx = await sale.buy({ value: ethers.parseEther(String(bnb)) });
    toast('Buy submitted…');
    const r = await tx.wait();
    toast(`Buy confirmed • block ${r.blockNumber}`);
    await refreshAll();
  }catch(e){ console.error(e); toast(e?.info?.error?.message || e.message,'err'); }
}

async function doApprove(){
  if(!signer){ toast('Connect wallet','err'); return; }
  try{
    const amt = parseFloat($('#stakeAmt').value || '0');
    if(!(amt>0)) return toast('Enter stake amount','err');
    const wei = ethers.parseUnits(String(amt), 18);
    const tx = await token.approve(STAKING_ADDRESS, wei);
    toast('Approve submitted…');
    await tx.wait();
    toast('Approve confirmed');
  }catch(e){ console.error(e); toast(e?.info?.error?.message || e.message,'err'); }
}
async function doStake(){
  if(!signer){ toast('Connect wallet','err'); return; }
  try{
    const amt = parseFloat($('#stakeAmt').value || '0');
    const months = parseInt($('#stakeMonths').value,10);
    if(!(amt>0)) return toast('Enter stake amount','err');
    const wei = ethers.parseUnits(String(amt), 18);
    const tx = await staking.stake(wei, months);
    toast('Stake submitted…');
    await tx.wait();
    toast('Stake confirmed');
    $('#stakeAmt').value = '';
    await refreshAll();
  }catch(e){ console.error(e); toast(e?.info?.error?.message || e.message,'err'); }
}
async function doWithdraw(id, btn){
  if(!signer){ toast('Connect wallet','err'); return; }
  try{
    btn.disabled = true;
    const tx = await staking.withdraw(id);
    toast('Withdraw submitted…');
    await tx.wait();
    toast('Withdraw confirmed');
    await refreshAll();
  }catch(e){ console.error(e); toast(e?.info?.error?.message || e.message,'err'); }
  finally{ btn.disabled = false; }
}

/* Periodic refresh */
setInterval(()=>refreshAll().catch(console.error), 20000);
