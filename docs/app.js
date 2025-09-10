/* app.js – JODA site core
 * Works with ethers v6 (loaded in index.html via CDN)
 * Read-only fallback via public BSC testnet RPC when wallet not connected.
 */

// ====== Fix: ensure ethers.js is loaded ======
if (typeof ethers === "undefined") {
  const statusEl = document.getElementById("status");
  if (statusEl) statusEl.innerText = "Error: ethers.js not loaded.";
  console.error("Ethers.js not found. Check the CDN <script> in index.html.");
  throw new Error("Ethers.js not loaded");
}

// ---------------- Config ----------------
(() => {
  const BSC_TESTNET_ID = 97;
  const BSC_TESTNET_PARAMS = {
    chainId: '0x61',
    chainName: 'BSC Testnet',
    nativeCurrency: { name: 'BNB', symbol: 'tBNB', decimals: 18 },
    rpcUrls: ['https://data-seed-prebsc-1-s1.binance.org:8545/'],
    blockExplorerUrls: ['https://testnet.bscscan.com/'],
  };
  
  // Your deployed contracts (testnet)
  const ADDR = {
    TOKEN:   '0xB2EFA488040B036E50a18C9d2D8110AF743c5504',
    SALE:    '0x9146aEE05EbCFD30950D4E964cE256e32E1CbcfD',
    STAKING: '0xEe5Ef7b0140a061032613F157c8366D5a29ABB95',
  };

  // ---------- State ----------
  let provider = null;     // ethers.Provider (BrowserProvider or JsonRpcProvider)
  let signer   = null;     // ethers.Signer (when connected)
  let token, sale, staking; // ethers.Contract instances (bound to provider or signer)

  // ---------- DOM helpers ----------
  const $ = (id) => document.getElementById(id);
  const statusEl = $('status');
  const connectBtn = $('connectBtn');
  const disconnectBtn = $('disconnectBtn');
  const walletAddressEl = $('walletAddress');

  const setStatus = (msg, tone='') => {
    statusEl.textContent = msg;
    statusEl.classList.remove('ok','warn','danger');
    if (tone) statusEl.classList.add(tone);
  };

  const short = (addr) => addr ? `${addr.slice(0,6)}…${addr.slice(-4)}` : '';

  // ---------- ABI loading ----------
  async function loadABIs() {
    const [tokenAbi, saleAbi, stakingAbi] = await Promise.all([
      fetch('JODA.json').then(r=>r.json()),
      fetch('JODASale.json').then(r=>r.json()),
      fetch('JODAStaking.json').then(r=>r.json()),
    ]);
    return { tokenAbi, saleAbi, stakingAbi };
  }

  // ---------- Provider setup ----------
  async function makeContracts(boundTo) {
    const { tokenAbi, saleAbi, stakingAbi } = await loadABIs();
    token   = new ethers.Contract(ADDR.TOKEN,   tokenAbi,   boundTo);
    sale    = new ethers.Contract(ADDR.SALE,    saleAbi,    boundTo);
    staking = new ethers.Contract(ADDR.STAKING, stakingAbi, boundTo);
  }

  async function setupReadOnly() {
    // Public RPC read-only
    provider = new ethers.JsonRpcProvider(BSC_TESTNET_PARAMS.rpcUrls[0]);
    signer = null;
    await makeContracts(provider);
    setStatus('Ready (read-only RPC)', 'ok');
    updateUIConnected(false);
    refreshAll().catch(console.error);
  }

  function updateUIConnected(isConnected, addr='') {
    if (isConnected) {
      connectBtn.textContent = 'Connected';
      connectBtn.disabled = true;
      disconnectBtn?.classList.remove('hidden');
      walletAddressEl && (walletAddressEl.textContent = short(addr));
    } else {
      connectBtn.textContent = 'Connect Wallet';
      connectBtn.disabled = false;
      disconnectBtn?.classList.add('hidden');
      walletAddressEl && (walletAddressEl.textContent = '');
    }
  }

  async function ensureBscTestnet(eth) {
    const chainIdHex = await eth.request({ method: 'eth_chainId' });
    if (chainIdHex === BSC_TESTNET_PARAMS.chainId) return true;

    // try switch
    try {
      await eth.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BSC_TESTNET_PARAMS.chainId }],
      });
      return true;
    } catch (e) {
      // chain not added → try to add
      if (e.code === 4902 || String(e.message).includes('Unrecognized chain ID')) {
        await eth.request({
          method: 'wallet_addEthereumChain',
          params: [BSC_TESTNET_PARAMS],
        });
        return true;
      }
      throw e;
    }
  }

  // ---------- Connect / Disconnect ----------
  async function connect() {
    if (!window.ethereum) {
      setStatus('No provider found — install MetaMask', 'danger');
      window.open('https://metamask.io/download/', '_blank');
      return;
    }
    try {
      setStatus('Requesting wallet permission…');
      await ensureBscTestnet(window.ethereum);

      provider = new ethers.BrowserProvider(window.ethereum, 'any'); // 'any' to get chain events
      const accounts = await provider.send('eth_requestAccounts', []);
      signer = await provider.getSigner();
      await makeContracts(signer);

      const addr = await signer.getAddress();
      setStatus('Connected to MetaMask', 'ok');
      updateUIConnected(true, addr);

      // listeners
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      await refreshAll();
    } catch (e) {
      console.error(e);
      setStatus(e?.message ?? 'Connection failed', 'danger');
      updateUIConnected(false);
    }
  }

  async function disconnect() {
    // There’s no programmatic “disconnect” for MetaMask; we just drop signer and revert to read-only.
    window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
    window.ethereum?.removeListener('chainChanged', handleChainChanged);
    await setupReadOnly();
  }

  async function handleAccountsChanged(accs) {
    if (!accs || accs.length === 0) {
      await disconnect();
      return;
    }
    // Re-bind signer to the first account
    signer = await provider.getSigner();
    await makeContracts(signer);
    const addr = await signer.getAddress();
    setStatus('Account changed', 'ok');
    updateUIConnected(true, addr);
    await refreshAll();
  }

  async function handleChainChanged(_cid) {
    // Re-init to enforce testnet
    await connect();
  }

  // ---------- Reads (example refreshers you already had) ----------
  async function refreshAll() {
    // Example UI IDs you may already have:
    // saleActive, minBuy, tokensPerBNB, availableTokens, bnbBal, jodaBal
    try {
      const [active, minBuyWei, rateWei, avail] = await Promise.all([
        sale.saleActive(),
        sale.minBuyWei(),
        sale.tokensPerBNB(),
        sale.availableTokens(),
      ]);

      const bnbBal = await provider.getBalance(ADDR.SALE);
      const userAddr = signer ? await signer.getAddress() : null;
      const jodaBal = userAddr ? await token.balanceOf(userAddr) : 0n;

      // Update UI
      const toEth = (w) => Number(ethers.formatEther(w));
      $('saleActive') && ($('saleActive').textContent = active ? 'Yes' : 'No');
      $('minBuy') && ($('minBuy').textContent = toEth(minBuyWei).toFixed(2));
      $('rate') && ($('rate').textContent = Number(ethers.formatUnits(rateWei, 18)).toLocaleString());
      $('available') && ($('available').textContent = Number(ethers.formatUnits(avail, 18)).toLocaleString());
      $('bnbBal') && ($('bnbBal').textContent = toEth(bnbBal).toFixed(6));
      $('jodaBal') && ($('jodaBal').textContent = userAddr ? Number(ethers.formatUnits(jodaBal, 18)).toLocaleString() : '—');
    } catch (e) {
      console.error(e);
      setStatus('Read failed — check RPC or ABIs', 'warn');
    }
  }

  // ---------- Wire buttons ----------
  connectBtn?.addEventListener('click', connect);
  disconnectBtn?.addEventListener('click', disconnect);

  // ---------- Bootstrap ----------
  async function init() {
    // No provider? show link & go read-only.
    if (!window.ethereum) {
      setStatus('No provider found — install MetaMask', 'warn');
      updateUIConnected(false);
      await setupReadOnly();
      return;
    }

    // Provider exists → build read-only first (fast), then try silent bind
    setStatus('MetaMask detected — read-only until connected', 'ok');
    provider = new ethers.BrowserProvider(window.ethereum, 'any');
    await makeContracts(provider);
    updateUIConnected(false);
    await refreshAll();

    // Try to detect already-connected account (some wallets expose selectedAddress)
    try {
      const accs = await provider.send('eth_accounts', []);
      if (accs && accs.length) {
        await connect(); // upgrades to signer-bound + installs listeners
      }
    } catch (e) {
      // ignore
      console.debug('Silent connect skipped:', e?.message);
    }
  }

  // kick off
  init();
})();
