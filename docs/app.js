/* app.js — JODALINE site core (BSC Testnet)
 * Requires ethers v6, which must be loaded in index.html via CDN BEFORE this script.
 * Safe DOM guards are used so the code runs even if some elements are missing in the template.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // ------------------ Helpers ------------------
  const $ = (id) => document.getElementById(id);
  const setText = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  const setValue = (id, v) => { const el = $(id); if (el) el.value = v; };
  const showCopyFor = (btnId, sourceSelector) => {
    const btn = $(btnId);
    if (!btn) return;
    btn.addEventListener('click', async () => {
      try {
        let text = "";
        if (sourceSelector.startsWith("#")) {
          const el = document.querySelector(sourceSelector);
          if (el) text = el.value || el.textContent || "";
        } else {
          text = sourceSelector;
        }
        await navigator.clipboard.writeText(text);
        btn.textContent = "Copied";
        setTimeout(() => (btn.textContent = "Copy"), 1200);
      } catch { /* ignore */ }
    });
  };

  const statusEl = $('status');
  const banner = (msg, style = 'info') => {
    if (!statusEl) return;
    const color =
      style === 'ok' ? '#27c093' :
      style === 'warn' ? '#e2b007' :
      style === 'err' ? '#ff4d4d' : '#6cb1ff';
    statusEl.textContent = msg;
    statusEl.style.color = color;
  };

  // ------------------ Ethers presence check ------------------
  if (typeof window.ethers === 'undefined') {
    banner('Error: ethers.js not loaded (check CDN <script> in index.html).', 'err');
    console.error('ethers.js not found. Ensure the two CDN tags are above app.js.');
    return;
  }

  // ------------------ Config (BSC Testnet) ------------------
  const BSC_TESTNET_ID = 97;
  const BSC_TESTNET_PARAMS = {
    chainId: '0x61',
    chainName: 'BSC Testnet',
    nativeCurrency: { name: 'BNB', symbol: 'tBNB', decimals: 18 },
    rpcUrls: ['https://data-seed-prebsc-1-s1.binance.org:8545/'],
    blockExplorerUrls: ['https://testnet.bscscan.com/'],
  };

  // Deployed addresses (testnet)
  const ADDR = {
    TOKEN:  '0xB2EFAA888040B036E50a18C9d2D8110AF743c5504',
    SALE:   '0x9164aEE05EbcFD03950D4DE964cE256e3E21CbcFD',
    STAKING:'0xEe5eF7bB0140a061032631F157c8366D5a29ABB95',
  };

  // ------------------ State ------------------
  let provider = null;          // ethers.Provider (BrowserProvider or JsonRpcProvider)
  let signer = null;            // ethers.Signer (when connected)
  let token = null, sale = null, staking = null; // ethers.Contract
  let abiToken = null, abiSale = null, abiStaking = null;
  let accounts = [];

  // ------------------ DOM refs (optional) ------------------
  const connectBtn = $('connectBtn');
  const disconnectBtn = $('disconnectBtn'); // optional, if present we wire it
  const badges = {
    wallet: $('addrUser'),
    staking: $('addrStaking'),
    sale: $('addrSale'),
  };

  const buyInput = $('buyInput') || $('buyAmount') || $('buyBNB') || $('buyAmountBNB');
  const buyBtn   = $('btnBuy')   || $('buyBtn');

  const stakeAmount = $('stakeAmount');
  const stakeMonths = $('stakeMonths');
  const approveBtn  = $('approveBtn');
  const stakeBtn    = $('stakeBtn');

  // stats / balances (optional targets)
  const saleActiveEl   = $('saleActive');
  const saleMinEl      = $('saleMin');
  const saleRateEl     = $('saleRate');
  const saleAvailEl    = $('saleAvail');

  const balBNBEl       = $('balanceBNB');
  const balJODAEl      = $('balanceJODA');

  // referral link box (optional)
  const linkBox = $('refLink');
  const linkCopyBtn = $('copyRef');

  // ------------------ Init ------------------
  try {
    banner('Detecting wallet...');
    await loadABIs();
    await pickProvider();             // sets provider (+ signer if wallet connected)
    await buildContracts();           // binds contracts to provider/signer
    paintAddresses();                 // fill quick IDs row if present
    wireUI();                         // buttons & events
    await fullRefresh();              // initial data
    startAutoRefresh();               // balances every ~20s
  } catch (e) {
    console.error(e);
    banner(`Init error: ${e.message || e}`, 'err');
  }

  // ------------------ ABIs ------------------
  async function loadABIs() {
    const fetchJson = async (path) => (await fetch(path)).json();
    // JSON files must be in the same folder as index.html/app.js (your /docs)
    [abiToken, abiSale, abiStaking] = await Promise.all([
      fetchJson('JODA.json'),
      fetchJson('JODASale.json'),
      fetchJson('JODAStaking.json'),
    ]);
  }

  // ------------------ Provider selection ------------------
  async function pickProvider() {
    const hasMM = typeof window.ethereum !== 'undefined' && window.ethereum.isMetaMask;
    if (hasMM) {
      provider = new ethers.BrowserProvider(window.ethereum, 'any'); // 'any' for chain changes
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
            // add then switch
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
      // Do not connect accounts automatically; leave for user click
    } else {
      // Read-only provider
      provider = new ethers.JsonRpcProvider(BSC_TESTNET_PARAMS.rpcUrls[0]);
      banner('Read-only mode (no wallet)', 'warn');
    }
  }

  // ------------------ Build contracts ------------------
  async function buildContracts() {
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

  // ------------------ Wire UI ------------------
  function wireUI() {
    // Connect
    if (connectBtn) {
      connectBtn.addEventListener('click', async () => {
        try {
          if (!window.ethereum) {
            banner('No wallet provider found.', 'err');
            return;
          }
          banner('Connecting...');
          accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
          signer = await provider.getSigner();
          withSigner();
          paintAddresses();
          paintConnectionBadge();
          banner('Connected to MetaMask', 'ok');
          await fullRefresh();
        } catch (e) {
          console.error(e);
          banner(e.message || 'Connection failed', 'err');
        }
      });
    }

    // Disconnect (UI only)
    if (disconnectBtn) {
      disconnectBtn.addEventListener('click', () => {
        signer = null;
        accounts = [];
        buildContracts();           // rebind to read-only provider
        paintConnectionBadge();
        banner('Disconnected (UI only)', 'warn');
      });
    }

    // Copy buttons for quick IDs / referral link
    showCopyFor('copyUser', '#addrUser');
    showCopyFor('copyStaking', '#addrStaking');
    showCopyFor('copySale', '#addrSale');
    if (linkCopyBtn && linkBox) showCopyFor('copyRef', '#refLink');

    // Buy
    if (buyBtn && buyInput) {
      buyBtn.addEventListener('click', async () => {
        try {
          if (!signer) throw new Error('Connect wallet first.');
          withSigner();
          // expect buyInput value in BNB (decimal)
          const bnb = (buyInput.value || '0').trim();
          if (!bnb || Number(bnb) <= 0) throw new Error('Enter BNB amount.');
          const value = ethers.parseEther(bnb);
          const tx = await sale.buy({ value });
          banner('Buying... waiting for confirmation');
          await tx.wait();
          banner('Buy confirmed', 'ok');
          await fullRefresh();
        } catch (e) {
          console.error(e);
          banner(e.shortMessage || e.message || 'Buy failed', 'err');
        }
      });
    }

    // Approve + Stake
    if (approveBtn && stakeAmount) {
      approveBtn.addEventListener('click', async () => {
        try {
          if (!signer) throw new Error('Connect wallet first.');
          withSigner();
          const amt = stakeAmount.value ? stakeAmount.value.trim() : '';
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
          const amt = stakeAmount.value ? stakeAmount.value.trim() : '';
          const months = Number(stakeMonths.value || '0');
          if (!amt || Number(amt) <= 0) throw new Error('Enter JODA amount.');
          if (![3, 6, 12, 24, 36].includes(months))
            throw new Error('Pick a valid lockup (3, 6, 12, 24, 36).');
          const dec = await token.decimals();
          const weiAmt = ethers.parseUnits(amt, dec);
          const tx = await staking.stake(weiAmt, months);
          banner('Staking...', 'info');
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
        paintConnectionBadge();
        await fullRefresh();
      });
      window.ethereum.on?.('chainChanged', async () => {
        // Recreate provider/signer on chain change
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

  // ------------------ Painters ------------------
  function paintConnectionBadge() {
    const connected = !!signer;
    if (connectBtn) connectBtn.textContent = connected ? 'Connected' : 'Connect Wallet';
    // Optional status label beside the button
    setText('walletState', connected
      ? 'Connected to MetaMask'
      : (window.ethereum ? 'Wallet detected — not connected' : 'Read-only'));
  }

  function paintAddresses() {
    // Fill top chips if present
    if (badges.wallet)   badges.wallet.value = accounts[0] || '';
    if (badges.staking)  badges.staking.value = ADDR.STAKING;
    if (badges.sale)     badges.sale.value = ADDR.SALE;

    // Referral link construction
    if (linkBox) {
      const base = 'https://buy-joda.link/?ref=';
      const tag  = (accounts[0] || 'your-wallet');
      linkBox.value = base + tag;
    }
  }

  // ------------------ Reads ------------------
  async function refreshSale() {
    try {
      const active = await sale.saleActive?.();
      const minBuy = await sale.minBuy?.();                   // wei
      const perBNB = await sale.tokensPerBNB?.();             // tokens per 1 BNB in token-decimals
      const avail  = await sale.availableTokens?.();          // token units (decimals)

      // Token decimals for human units
      let dec = 18;
      try { dec = await token.decimals(); } catch {}

      if (saleActiveEl) saleActiveEl.textContent = active ? 'Yes' : 'No';
      if (saleMinEl)    saleMinEl.textContent    = ethers.formatEther(minBuy ?? 0);
      if (saleRateEl)   saleRateEl.textContent   = perBNB ? Number(ethers.formatUnits(perBNB, dec)).toLocaleString() : '--';
      if (saleAvailEl)  saleAvailEl.textContent  = avail ? Number(ethers.formatUnits(avail, dec)).toLocaleString() : '--';
    } catch (e) {
      console.warn('refreshSale()', e);
    }
  }

  async function refreshBalances() {
    try {
      // BNB
      const who = signer ? await signer.getAddress() : null;
      if (balBNBEl && who) {
        const bal = await provider.getBalance(who);
        balBNBEl.textContent = Number(ethers.formatEther(bal)).toLocaleString();
      }
      // JODA
      if (balJODAEl && who) {
        const dec = await token.decimals();
        const raw = await token.balanceOf(who);
        balJODAEl.textContent = Number(ethers.formatUnits(raw, dec)).toLocaleString(undefined, { maximumFractionDigits: 9 });
      }
    } catch (e) {
      console.warn('refreshBalances()', e);
    }
  }

  async function fullRefresh() {
    await Promise.all([refreshSale(), refreshBalances()]);
  }

  function startAutoRefresh() {
    setInterval(refreshBalances, 20000); // 20s
  }
});
