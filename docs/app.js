/* app.js — JODALINE (JODA) dApp for BSC Testnet
   - ethers v6 must load before this (two CDN tags in index.html)
   - Wallet connect/disconnect
   - Load ABIs (JODA.json, JODASale.json, JODAStaking.json)
   - Buy (value in BNB), Approve, Stake
   - Language + Theme toggle persistence
   - Affiliate panel: referral link + “Go shopping” placeholder
*/

// ---------- Theme toggle ----------
(function themeInit() {
  const root = document.documentElement;
  const btn = document.getElementById('themeToggle');
  const saved = localStorage.getItem('theme') || 'dark';
  root.setAttribute('data-theme', saved);
  if (btn) btn.textContent = saved === 'light' ? '🌙 Dark' : '☀️ Light';
  btn?.addEventListener('click', () => {
    const now = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    root.setAttribute('data-theme', now);
    localStorage.setItem('theme', now);
    if (btn) btn.textContent = now === 'light' ? '🌙 Dark' : '☀️ Light';
  });
})();

document.addEventListener('DOMContentLoaded', async () => {
  // ---------- Helpers ----------
  const $  = (id) => document.getElementById(id);
  const setText = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  const banner = (msg, style='info') => {
    const el = $('status'); if (!el) return;
    const c = { ok:'#27c093', warn:'#e2b007', err:'#ff4d4d', info:'#6cb1ff' }[style] || '#6cb1ff';
    el.textContent = msg; el.style.color = c;
  };

  if (!window.ethers) {
    banner('Error: ethers.js not loaded. Refresh (Ctrl+F5).', 'err');
    return;
  }

  // ---------- i18n (keep it lightweight; expand later) ----------
  const i18n = {
    en:{ connect:'Connect Wallet', connected:'Connected to MetaMask',
        shopTitle:'Shop online • Get JODA back',
        buyTitle:'Buy JODA', stakeTitle:'Stake JODA',
        yourBalance:'Your Balances', saleStatus:'Sale Status',
        how:'How it works', reg:'Register', login:'Login' },
    de:{ connect:'Wallet verbinden', connected:'Mit MetaMask verbunden',
        shopTitle:'Online einkaufen • JODA zurück',
        buyTitle:'JODA kaufen', stakeTitle:'JODA staken',
        yourBalance:'Deine Guthaben', saleStatus:'Verkaufsstatus',
        how:'So funktioniert es', reg:'Registrieren', login:'Anmelden' },
    fr:{ connect:'Connecter le portefeuille', connected:'Connecté à MetaMask',
        shopTitle:'Achetez en ligne • Recevez JODA',
        buyTitle:'Acheter JODA', stakeTitle:'Staker JODA',
        yourBalance:'Vos soldes', saleStatus:'Statut de vente',
        how:'Comment ça marche', reg:'Créer un compte', login:'Se connecter' },
  };
  function applyLang(lang) {
    const d = i18n[lang] || i18n.en;
    setText('shopTitle', d.shopTitle);
    setText('buyTitle', d.buyTitle);
    setText('stakeTitle', d.stakeTitle);
    setText('balanceTitle', d.yourBalance);
    setText('saleStatusTitle', d.saleStatus);
    setText('howTitle', d.how);
    const btn = $('connectBtn');
    if (btn) btn.textContent = accounts.length ? d.connected : d.connect;
    const regBtn = $('regBtn'), loginBtn = $('loginBtn');
    if (regBtn) regBtn.textContent = d.reg;
    if (loginBtn) loginBtn.textContent = d.login;
    localStorage.setItem('lang', lang);
  }
  const savedLang = localStorage.getItem('lang') || 'en';
  applyLang(savedLang);
  $('languageSelector')?.addEventListener('change', e => applyLang(e.target.value));

  // ---------- Chain / addresses ----------
  const BSC = { id: 97, hex: '0x61',
    rpc: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
    exp: 'https://testnet.bscscan.com/' };
  const ADDR = {
    TOKEN:   '0xB2EFA488040B036E50A18C9d2D8110AF743c5504',
    SALE:    '0x9146aEE05EbCFD30950D4E964cE256e32E1CbcfD',
    STAKING: '0xEe5eF7b0140a061032613F157c8366D5a29ABB95',
  };

  // ---------- State ----------
  let provider, signer, accounts = [];
  let token, sale, staking;
  let abiToken, abiSale, abiStaking;

  // ---------- ABIs ----------
  async function loadABIs() {
    const j = async p => (await fetch(p)).json();
    [abiToken, abiSale, abiStaking] = await Promise.all([
      j('JODA.json'), j('JODASale.json'), j('JODAStaking.json')
    ]);
  }

  // ---------- Provider ----------
  async function chooseProvider() {
    if (window.ethereum) {
      provider = new ethers.BrowserProvider(window.ethereum, 'any');
      const net = await provider.getNetwork();
      if (Number(net.chainId) !== BSC.id) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: BSC.hex }]
          });
        } catch (e) {
          if (e.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: BSC.hex,
                chainName: 'BSC Testnet',
                nativeCurrency: { name:'BNB', symbol:'tBNB', decimals:18 },
                rpcUrls: [BSC.rpc],
                blockExplorerUrls: [BSC.exp],
              }]
            });
          } else { throw e; }
        }
      }
      banner('MetaMask detected', 'ok');
    } else {
      provider = new ethers.JsonRpcProvider(BSC.rpc);
      banner('Read-only mode (no wallet)', 'warn');
    }
  }

  // ---------- Contracts ----------
  async function buildContracts() {
    token   = new ethers.Contract(ADDR.TOKEN,   abiToken,   provider);
    sale    = new ethers.Contract(ADDR.SALE,    abiSale,    provider);
    staking = new ethers.Contract(ADDR.STAKING, abiStaking, provider);
  }
  function withSigner() {
    if (!signer) throw new Error('Connect wallet first');
    token = token.connect(signer);
    sale = sale.connect(signer);
    staking = staking.connect(signer);
  }

  // ---------- UI wiring ----------
  const connectBtn = $('connectBtn');
  const disconnectBtn = $('disconnectBtn');
  connectBtn?.addEventListener('click', async () => {
    try {
      accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      signer = await provider.getSigner();
      withSigner();
      applyLang(localStorage.getItem('lang') || 'en');
      banner('Connected to MetaMask', 'ok');
      paintAddresses();
      refreshAll();
    } catch (e) {
      console.error(e);
      banner('Connection failed', 'err');
    }
  });
  disconnectBtn?.addEventListener('click', () => {
    signer = null; accounts = [];
    buildContracts(); // back to read-only
    banner('Disconnected (UI only)', 'warn');
    paintAddresses();
  });

  // BUY
  $('buyBtn')?.addEventListener('click', async () => {
    try {
      if (!signer) throw new Error('Connect wallet first');
      withSigner();
      const bnb = ( $('buyAmount')?.value || '0' ).trim();
      if (!bnb || Number(bnb) <= 0) throw new Error('Enter BNB amount');
      const tx = await sale.buy({ value: ethers.parseEther(bnb) });
      banner('Buying… awaiting confirmation');
      await tx.wait();
      banner('Buy confirmed', 'ok');
      refreshAll();
    } catch (e) {
      console.error(e);
      banner(e.shortMessage || e.message || 'Buy failed', 'err');
    }
  });

  // APPROVE then STAKE
  $('approveBtn')?.addEventListener('click', async () => {
    try {
      if (!signer) throw new Error('Connect wallet first');
      withSigner();
      const amt = ( $('stakeAmount')?.value || '' ).trim();
      const dec = await token.decimals();
      const wei = ethers.parseUnits(amt || '0', dec);
      if (wei <= 0n) throw new Error('Enter amount');
      const tx = await token.approve(ADDR.STAKING, wei);
      banner('Approving…');
      await tx.wait();
      banner('Approved', 'ok');
    } catch (e) {
      console.error(e);
      banner(e.shortMessage || e.message || 'Approve failed', 'err');
    }
  });
  $('stakeBtn')?.addEventListener('click', async () => {
    try {
      if (!signer) throw new Error('Connect wallet first');
      withSigner();
      const amt = ( $('stakeAmount')?.value || '' ).trim();
      const months = Number( $('stakeMonths')?.value || '0' );
      if (![3,6,12,24,36].includes(months)) throw new Error('Pick 3/6/12/24/36 months');
      const dec = await token.decimals();
      const wei = ethers.parseUnits(amt || '0', dec);
      if (wei <= 0n) throw new Error('Enter amount');
      const tx = await staking.stake(wei, months);
      banner('Staking… awaiting confirmation');
      await tx.wait();
      banner('Stake confirmed', 'ok');
      refreshAll();
    } catch (e) {
      console.error(e);
      banner(e.shortMessage || e.message || 'Stake failed', 'err');
    }
  });

  // ---------- Affiliate / Referral ----------
  function paintAddresses() {
    const me = accounts[0] || '';
    const addrUser = $('addrUser'); if (addrUser) addrUser.value = me;
    const addrSale = $('addrSale'); if (addrSale) addrSale.value = ADDR.SALE;
    const addrSt  = $('addrStaking'); if (addrSt) addrSt.value = ADDR.STAKING;

    const link = $('refLink');
    const base = 'https://buy-joda.link/?ref=';
    if (link) link.value = base + (me || 'your-wallet');
  }
  $('copyRef')?.addEventListener('click', async () => {
    try {
      const v = $('refLink')?.value || '';
      await navigator.clipboard.writeText(v);
      $('copyRef').textContent = 'Copied';
      setTimeout(()=> $('copyRef').textContent='Copy', 1200);
    } catch {}
  });
  $('goShop')?.addEventListener('click', () => {
    // Placeholder: you can replace with your “authorized partners” page
    alert('Shopping hub coming soon: only authorized stores will open from here.');
  });

  // ---------- Register / Login (client-side only) ----------
  $('regBtn')?.addEventListener('click', () => {
    const name = ($('regName')?.value || '').trim();
    const email = ($('regEmail')?.value || '').trim();
    if (!name || !email || !email.includes('@')) {
      return banner('Enter a valid name & email to register', 'warn');
    }
    localStorage.setItem('joda_user', JSON.stringify({ name, email, created: Date.now() }));
    banner('Registered (local) — confirmation email flow will come later.', 'ok');
  });

  $('loginBtn')?.addEventListener('click', () => {
    const email = ($('loginEmail')?.value || '').trim();
    const saved = JSON.parse(localStorage.getItem('joda_user') || '{}');
    if (!email || !saved.email || saved.email !== email) {
      return banner('Login failed (demo). Register first.', 'err');
    }
    banner(`Logged in as ${saved.name}`, 'ok');
  });

  // ---------- Reads ----------
  async function refreshSale() {
    try {
      const active = await sale.saleActive?.();
      const minBuy = await sale.minBuy?.();
      const perBNB = await sale.tokensPerBNB?.();
      const avail  = await sale.availableTokens?.();
      let dec = 18; try { dec = await token.decimals(); } catch {}
      setText('saleActive', active ? 'Yes' : 'No');
      setText('saleMin', minBuy ? ethers.formatEther(minBuy) : '--');
      setText('saleRate', perBNB ? Number(ethers.formatUnits(perBNB, dec)).toLocaleString() : '--');
      setText('saleAvail', avail ? Number(ethers.formatUnits(avail, dec)).toLocaleString() : '--');
    } catch (e) { /* silent */ }
  }
  async function refreshBalances() {
    try {
      if (!signer) return;
      const me = await signer.getAddress();
      const bnb = await provider.getBalance(me);
      setText('balanceBNB', Number(ethers.formatEther(bnb)).toLocaleString());
      const dec = await token.decimals();
      const raw = await token.balanceOf(me);
      setText('balanceJODA', Number(ethers.formatUnits(raw, dec)).toLocaleString(undefined, { maximumFractionDigits: 6 }));
    } catch {}
  }
  async function refreshAll() {
    paintAddresses();
    await Promise.all([refreshSale(), refreshBalances()]);
  }

  // ---------- Wallet events ----------
  if (window.ethereum) {
    window.ethereum.on?.('accountsChanged', async (accs) => {
      accounts = accs || [];
      signer = accounts.length ? await provider.getSigner() : null;
      if (signer) withSigner(); else await buildContracts();
      paintAddresses();
      refreshAll();
    });
    window.ethereum.on?.('chainChanged', async () => {
      provider = new ethers.BrowserProvider(window.ethereum, 'any');
      signer = accounts.length ? await provider.getSigner() : null;
      await buildContracts();
      if (signer) withSigner();
      refreshAll();
    });
  }

  // ---------- Init ----------
  try {
    banner('Initializing…');
    await loadABIs();
    await chooseProvider();
    await buildContracts();
    paintAddresses();
    banner('Ready', 'ok');
    refreshAll();
    setInterval(refreshBalances, 20000);
  } catch (e) {
    console.error(e);
    banner('Init failed', 'err');
  }
});

