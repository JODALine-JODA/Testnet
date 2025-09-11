/* app.js — JODALINE (JODA) dApp core for BSC Testnet
 * - Requires ethers v6 loaded via CDN BEFORE this script
 * - Loads ABIs from local JSON files (JODA.json, JODASale.json, JODAStaking.json)
 * - Theme toggle (dark/light) + wallet hydration so “Connecting…” is accurate on load
 */

(() => {
  // ------------------ Small DOM helpers ------------------
  const $ = (id) => document.getElementById(id);
  const setText = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  const setValue = (id, v) => { const el = $(id); if (el) el.value = v; };
  const on = (id, evt, fn) => { const el = $(id); if (el) el.addEventListener(evt, fn); };

  const statusEl = $('status');
  const banner = (msg, style = 'info') => {
    if (!statusEl) return;
    const color =
      style === 'ok'   ? '#27c093' :
      style === 'warn' ? '#e2b007' :
      style === 'err'  ? '#ff4d4d' : '#6cb1ff';
    statusEl.textContent = msg;
    statusEl.style.color = color;
  };

  // ------------------ Theme toggle (always available) ------------------
  (function themeInit() {
    const root = document.documentElement;
    const btn = $('themeToggle');
    const saved = localStorage.getItem('theme') || 'dark';
    root.setAttribute('data-theme', saved);
    if (btn) btn.textContent = saved === 'light' ? '🌙 Dark' : '🌞 Light';

    btn?.addEventListener('click', () => {
      const now = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      root.setAttribute('data-theme', now);
      localStorage.setItem('theme', now);
      if (btn) btn.textContent = now === 'light' ? '🌙 Dark' : '🌞 Light';
    });
  })();

  // ------------------ i18n (short core, add more keys if needed) ------------------
  const i18n = {
    en: {
      shopTitle: "Shop online • Get JODA back",
      shopLead:  "Use JODALINE’s shopping flow — every time you spend, you get rewarded back in JODA tokens.",
      buyTitle:  "Buy JODA",
      stakeTitle:"Stake JODA",
      yourBalance:"Your Balances",
      saleStatus:"Sale Status",
      howWorks:  "How it works",
      connected: "Connected to MetaMask",
      connect:   "Connect Wallet",
      connectedShort: "Connected",
      notConnected:"Wallet detected — not connected",
      readonly:  "Read-only",
    }
    // (Your other languages can stay in your file if you had them – omitted here for brevity)
  };

  // ------------------ Chain config (BSC Testnet) ------------------
  const BSC_TESTNET_ID = 97;
  const BSC_TESTNET_PARAMS = {
    chainId: '0x61',
    chainName: 'BSC Testnet',
    nativeCurrency: { name: 'BNB', symbol: 'tBNB', decimals: 18 },
    rpcUrls: ['https://data-seed-prebsc-1-s1.binance.org:8545/'],
    blockExplorerUrls: ['https://testnet.bscscan.com/'],
  };

  // ------------------ Addresses (latest you provided) ------------------
  const ADDR = {
    TOKEN:   '0xB2EFA488040B036E50A18C9d2D8110AF743c5504',
    SALE:    '0x9146aEE05EbCFD30950D4E964cE256e32E1CbcfD',
    STAKING: '0xEe5eF7b0140a061032613F157c8366D5a29ABB95',
  };

  // ------------------ State ------------------
  let provider = null;      // ethers.BrowserProvider or ethers.JsonRpcProvider
  let signer = null;        // ethers.Signer (when connected)
  let accounts = [];
  let token = null, sale = null, staking = null;
  let abiToken = null, abiSale = null, abiStaking = null;

  // ------------------ UI elements ------------------
  const connectBtn = $('connectBtn');
  const disconnectBtn = $('disconnectBtn');
  const buyInput = $('buyAmount');
  const buyBtn   = $('buyBtn');

  const stakeAmount = $('stakeAmount');
  const stakeMonths = $('stakeMonths');
  const approveBtn  = $('approveBtn');
  const stakeBtn    = $('stakeBtn');

  const saleActiveEl = $('saleActive');
  const saleMinEl    = $('saleMin');
  const saleRateEl   = $('saleRate');
  const saleAvailEl  = $('saleAvail');

  const balBNBEl     = $('balanceBNB');
  const balJODAEl    = $('balanceJODA');

  const addrUserEl   = $('addrUser');
  const addrStakingEl= $('addrStaking');
  const addrSaleEl   = $('addrSale');

  const langSel = $('languageSelector');
  const savedLang = localStorage.getItem('lang') || 'en';

  function setLang(lang) {
    const d = i18n[lang] || i18n.en;
    setText('shopTitle', d.shopTitle);
    setText('shopLead',  d.shopLead);
    setText('buyTitle',  d.buyTitle);
    setText('stakeTitle',d.stakeTitle);
    setText('balanceTitle', d.yourBalance);
    setText('saleStatusTitle', d.saleStatus);
    setText('howTitle',  d.howWorks);
    const state = $('walletState');
    if (state) state.textContent = accounts.length
      ? (d.connected || 'Connected to MetaMask')
      : (window.ethereum ? (d.notConnected || 'Wallet detected — not connected') : (d.readonly || 'Read-only'));
    if (connectBtn) connectBtn.textContent = accounts.length ? (d.connectedShort || 'Connected') : (d.connect || 'Connect Wallet');
    localStorage.setItem('lang', lang);
  }
  setLang(savedLang);
  langSel?.addEventListener('change', e => setLang(e.target.value));

  // ------------------ ABIs ------------------
  async function loadABIs() {
    const fetchJSON = async (path) => (await fetch(path)).json();
    [abiToken, abiSale, abiStaking] = await Promise.all([
      fetchJSON('JODA.json'),
      fetchJSON('JODASale.json'),
      fetchJSON('JODAStaking.json'),
    ]);
  }

  // ------------------ Provider selection ------------------
  async function chooseProvider() {
    const hasMM = typeof window.ethers !== 'undefined' &&
                  typeof window.ethereum !== 'undefined' &&
                  window.ethereum.isMetaMask;
    if (hasMM) {
      provider = new ethers.BrowserProvider(window.ethereum, 'any');
      const net = await provider.getNetwork();
      if (Number(net.chainId) !== BSC_TESTNET_ID) {
        banner('Wrong network. Switching to BSC Testnet...', 'warn');
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: BSC_TESTNET_PARAMS.chainId }],
          });
        } catch (err) {
          if (err.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [BSC_TESTNET_PARAMS],
            });
          } else {
            throw err;
          }
        }
      }
      banner('MetaMask detected', 'ok');
    } else {
      provider = new ethers.JsonRpcProvider(BSC_TESTNET_PARAMS.rpcUrls[0]);
      banner(i18n[savedLang].readonly || 'Read-only mode', 'warn');
    }
  }

  // ------------------ Contracts ------------------
  async function buildContracts() {
    if (!abiToken || !abiSale || !abiStaking) throw new Error('ABIs not loaded');
    token   = new ethers.Contract(ADDR.TOKEN,   abiToken,   provider);
    sale    = new ethers.Contract(ADDR.SALE,    abiSale,    provider);
    staking = new ethers.Contract(ADDR.STAKING, abiStaking, provider);
  }
  function withSigner() {
    if (!signer) throw new Error('Connect wallet first.');
    token   = token.connect(signer);
    sale    = sale.connect(signer);
    staking = staking.connect(signer);
  }

  // ------------------ Wallet hydration (fix “Connecting…”) ------------------
  async function hydrateConnection() {
    try {
      if (!window.ethereum) return;
      const accs = await window.ethereum.request({ method: 'eth_accounts' });
      accounts = accs || [];
      signer = accounts.length ? await provider.getSigner() : null;
      if (signer) withSigner();
      paintAddresses();
      paintConnectionBadge(!!signer);
      banner(
        accounts.length
          ? (i18n[savedLang]?.connected || 'Connected to MetaMask')
          : (i18n[savedLang]?.notConnected || 'Wallet detected — not connected'),
        accounts.length ? 'ok' : 'info'
      );
    } catch (e) {
      console.warn('hydrateConnection()', e);
    }
  }

  // ------------------ Painters ------------------
  function paintConnectionBadge(connected = !!signer) {
    const d = i18n[localStorage.getItem('lang') || 'en'] || i18n.en;
    if (connectBtn) connectBtn.textContent = connected ? (d.connectedShort || 'Connected') : (d.connect || 'Connect Wallet');
    setText('walletState',
      connected ? (d.connected || 'Connected to MetaMask') :
      (window.ethereum ? (d.notConnected || 'Wallet detected — not connected') : (d.readonly || 'Read-only'))
    );
  }
  function paintAddresses() {
    if (addrUserEl)    addrUserEl.value = accounts[0] || '';
    if (addrStakingEl) addrStakingEl.value = ADDR.STAKING;
    if (addrSaleEl)    addrSaleEl.value = ADDR.SALE;

    const linkBox = $('refLink'), copyBtn = $('copyRef');
    if (linkBox) {
      const base = 'https://buy-joda.link/?ref=';
      linkBox.value = base + (accounts[0] || 'your-wallet');
      copyBtn?.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(linkBox.value); copyBtn.textContent='Copied'; setTimeout(()=>copyBtn.textContent='Copy',1200); } catch {}
      });
    }
  }

  // ------------------ Reads ------------------
  async function refreshSale() {
    try {
      const active = await sale.saleActive?.();
      const minBuy = await sale.minBuy?.();         // wei
      const perBNB = await sale.tokensPerBNB?.();   // token-wei per 1 BNB
      const avail  = await sale.availableTokens?.();
      let dec = 18;
      try { dec = await token.decimals(); } catch {}

      if (saleActiveEl) saleActiveEl.textContent = active ? 'Yes' : 'No';
      if (saleMinEl)    saleMinEl.textContent    = minBuy ? ethers.formatEther(minBuy) : '--';
      if (saleRateEl)   saleRateEl.textContent   = perBNB ? Number(ethers.formatUnits(perBNB, dec)).toLocaleString() : '--';
      if (saleAvailEl)  saleAvailEl.textContent  = avail ? Number(ethers.formatUnits(avail, dec)).toLocaleString() : '--';
    } catch (e) { console.warn('refreshSale()', e); }
  }
  async function refreshBalances() {
    try {
      const who = signer ? await signer.getAddress() : null;
      if (balBNBEl && who) {
        const bal = await provider.getBalance(who);
        balBNBEl.textContent = Number(ethers.formatEther(bal)).toLocaleString();
      }
      if (balJODAEl && who) {
        const dec = await token.decimals();
        const raw = await token.balanceOf(who);
        balJODAEl.textContent = Number(ethers.formatUnits(raw, dec)).toLocaleString(undefined, { maximumFractionDigits: 9 });
      }
    } catch (e) { console.warn('refreshBalances()', e); }
  }
  async function fullRefresh() {
    await Promise.all([refreshSale(), refreshBalances()]);
  }
  function startAutoRefresh() {
    setInterval(refreshBalances, 20000);
  }

  // ------------------ UI wiring ------------------
  function wireUI() {
    if (connectBtn) {
      connectBtn.addEventListener('click', async () => {
        try {
          if (!window.ethereum) return banner('No wallet provider found.', 'err');
          banner('Connecting...');
          accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
          signer = await provider.getSigner();
          withSigner();
          paintAddresses();
          paintConnectionBadge(true);
          banner(i18n[savedLang].connected || 'Connected to MetaMask', 'ok');
          await fullRefresh();
        } catch (e) {
          console.error(e);
          banner(e.shortMessage || e.message || 'Connection failed', 'err');
        }
      });
    }

    if (disconnectBtn) {
      disconnectBtn.addEventListener('click', () => {
        signer = null;
        accounts = [];
        buildContracts(); // back to read-only
        paintConnectionBadge(false);
        banner('Disconnected (UI only)', 'warn');
      });
    }

    if (buyBtn && buyInput) {
      buyBtn.addEventListener('click', async () => {
        try {
          if (!signer) throw new Error('Connect wallet first.');
          withSigner();
          const bnb = (buyInput.value || '0').trim();
          if (!bnb || Number(bnb) <= 0) throw new Error('Enter BNB amount.');
          const value = ethers.parseEther(bnb);
          const tx = await sale.buy({ value });
          banner('Buying... awaiting confirmation');
          await tx.wait();
          banner('Buy confirmed', 'ok');
          await fullRefresh();
        } catch (e) {
          console.error(e);
          banner(e.shortMessage || e.message || 'Buy failed', 'err');
        }
      });
    }

    if (approveBtn && stakeAmount) {
      approveBtn.addEventListener('click', async () => {
        try {
          if (!signer) throw new Error('Connect wallet first.');
          withSigner();
          const amt = (stakeAmount.value || '').trim();
          if (!amt || Number(amt) <= 0) throw new Error('Enter JODA amount.');
          const dec = await token.decimals();
          const weiAmt = ethers.parseUnits(amt, dec);
          const tx = await token.approve(ADDR.STAKING, weiAmt);
          banner('Approving...', 'info');
          await tx.wait();
          banner('Approved', 'ok');
        } catch (e) {
          console.error(e);
          banner(e.shortMessage || e.message || 'Approve failed', 'err');
        }
      });
    }

    if (stakeBtn && stakeAmount && stakeMonths) {
      stakeBtn.addEventListener('click', async () => {
        try {
          if (!signer) throw new Error('Connect wallet first.');
          withSigner();
          const amt = (stakeAmount.value || '').trim();
          const months = Number(stakeMonths.value || '0');
          if (!amt || Number(amt) <= 0) throw new Error('Enter JODA amount.');
          if (![3,6,12,24,36].includes(months)) throw new Error('Pick a valid lockup (3, 6, 12, 24, 36).');
          const dec = await token.decimals();
          const weiAmt = ethers.parseUnits(amt, dec);
          const tx = await staking.stake(weiAmt, months);
          banner('Staking... awaiting confirmation', 'info');
          await tx.wait();
          banner('Stake confirmed', 'ok');
          await fullRefresh();
        } catch (e) {
          console.error(e);
          banner(e.shortMessage || e.message || 'Stake failed', 'err');
        }
      });
    }

    // Wallet events
    if (window.ethereum) {
      window.ethereum.on?.('accountsChanged', async (accs) => {
        accounts = accs || [];
        signer = accounts.length ? await provider.getSigner() : null;
        if (signer) withSigner(); else await buildContracts();
        paintAddresses();
        paintConnectionBadge(!!signer);
        await fullRefresh();
      });
      window.ethereum.on?.('chainChanged', async () => {
        try {
          provider = new ethers.BrowserProvider(window.ethereum, 'any');
          signer = accounts.length ? await provider.getSigner() : null;
          await buildContracts();
          if (signer) withSigner();
          await fullRefresh();
        } catch (e) { console.error(e); }
      });
    }
  }

  // ------------------ Boot ------------------
  window.addEventListener('DOMContentLoaded', async () => {
    try {
      // ethers present?
      if (typeof window.ethers === 'undefined') {
        banner('Error: ethers.js not loaded (check CDN <script> in index.html).', 'err');
        console.error('ethers.js not found. Ensure the two CDN tags are above app.js.');
        return;
      }

      banner('Loading…');
      await loadABIs();
      await chooseProvider();
      await buildContracts();
      wireUI();
      await hydrateConnection(); // <— ensures “Connecting…” becomes correct on load
      await fullRefresh();
      startAutoRefresh();
    } catch (e) {
      console.error(e);
      banner(`Init error: ${e.message || e}`, 'err');
    }
  });
})();
