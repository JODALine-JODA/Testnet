/* app.js — JODALINE (JODA) dApp for BSC Testnet
 * - Requires ethers v6 loaded via CDN BEFORE this script
 * - Loads ABIs from local JSON files in the same folder
 * - Multi-language UI (persisted in localStorage)
 * - Buy / Approve / Stake flows + balances
 */

document.addEventListener('DOMContentLoaded', async () => {
  // ------------------ DOM helpers ------------------
  const $ = (id) => document.getElementById(id);
  const setText = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  const banner = (msg, type = 'info') => {
    const el = $('status');
    if (!el) return;
    const color =
      type === 'ok'   ? '#27c093' :
      type === 'warn' ? '#e2b007' :
      type === 'err'  ? '#ff4d4d' : '#6cb1ff';
    el.textContent = msg;
    el.style.color = color;
  };
  document.addEventListener('DOMContentLoaded', () => {
  const langBtn = document.getElementById('langBtn');
  const langSel = document.getElementById('languageSelector');
  if (langBtn && langSel) {
    langBtn.addEventListener('click', () => langSel.click());
  }
});

  // ------------------ Sanity checks ------------------
  if (!window.ethers) {
    banner('Error: ethers.js not loaded — refresh (Ctrl+F5).', 'err');
    return;
  }

  // ------------------ Language dictionary ------------------
  const i18n = {
    en: { shopTitle:"Shop online • Get JODA back", shopLead:"Use JODALINE’s shopping flow — every time you spend, you get rewarded back in JODA tokens.", buyTitle:"Buy JODA", stakeTitle:"Stake JODA", yourBalance:"Your Balances", saleStatus:"Sale Status", howWorks:"How it works", connected:"Connected to MetaMask", connect:"Connect Wallet", connectedShort:"Connected", notConnected:"Wallet detected — not connected", readonly:"Read-only" },
    es: { shopTitle:"Compra online • Recibe JODA", shopLead:"Usa JODALINE — cada vez que gastas, recibes JODA.", buyTitle:"Comprar JODA", stakeTitle:"Apostar JODA", yourBalance:"Tus saldos", saleStatus:"Estado de venta", howWorks:"Cómo funciona", connected:"Conectado a MetaMask", connect:"Conectar Billetera", connectedShort:"Conectado", notConnected:"Billetera detectada — no conectada", readonly:"Solo lectura" },
    fr: { shopTitle:"Achetez en ligne • Recevez JODA", shopLead:"Avec JODALINE — chaque dépense vous récompense en JODA.", buyTitle:"Acheter JODA", stakeTitle:"Staker JODA", yourBalance:"Vos soldes", saleStatus:"Statut de vente", howWorks:"Comment ça marche", connected:"Connecté à MetaMask", connect:"Connecter le portefeuille", connectedShort:"Connecté", notConnected:"Portefeuille détecté — non connecté", readonly:"Lecture seule" },
    de: { shopTitle:"Online einkaufen • JODA zurück", shopLead:"Mit JODALINE — jedes Mal wirst du in JODA belohnt.", buyTitle:"JODA kaufen", stakeTitle:"JODA staken", yourBalance:"Deine Guthaben", saleStatus:"Verkaufsstatus", howWorks:"So funktioniert es", connected:"Mit MetaMask verbunden", connect:"Wallet verbinden", connectedShort:"Verbunden", notConnected:"Wallet erkannt — nicht verbunden", readonly:"Nur lesen" },
    it: { shopTitle:"Acquista online • Ottieni JODA", shopLead:"Con JODALINE — ogni spesa ti premia in JODA.", buyTitle:"Compra JODA", stakeTitle:"Metti in staking JODA", yourBalance:"I tuoi saldi", saleStatus:"Stato di vendita", howWorks:"Come funziona", connected:"Connesso a MetaMask", connect:"Connetti Wallet", connectedShort:"Connesso", notConnected:"Wallet rilevato — non connesso", readonly:"Sola lettura" },
    pt: { shopTitle:"Compre online • Receba JODA", shopLead:"Com a JODALINE — sempre que gastar, recebe JODA.", buyTitle:"Comprar JODA", stakeTitle:"Fazer stake de JODA", yourBalance:"Seus saldos", saleStatus:"Status de venda", howWorks:"Como funciona", connected:"Conectado ao MetaMask", connect:"Conectar Carteira", connectedShort:"Conectado", notConnected:"Carteira detectada — não conectada", readonly:"Somente leitura" },
    ru: { shopTitle:"Покупайте онлайн • Получайте JODA", shopLead:"С JODALINE — за каждую покупку вы получаете токены JODA.", buyTitle:"Купить JODA", stakeTitle:"Стейкинг JODA", yourBalance:"Ваши балансы", saleStatus:"Статус продажи", howWorks:"Как это работает", connected:"Подключено к MetaMask", connect:"Подключить кошелёк", connectedShort:"Подключено", notConnected:"Кошелёк найден — не подключен", readonly:"Только чтение" },
    uk: { shopTitle:"Купуйте онлайн • Отримуйте JODA", shopLead:"З JODALINE — за кожну витрату ви отримуєте JODA.", buyTitle:"Купити JODA", stakeTitle:"Стейкінг JODA", yourBalance:"Ваші баланси", saleStatus:"Статус продажу", howWorks:"Як це працює", connected:"Підключено до MetaMask", connect:"Підключити гаманець", connectedShort:"Підключено", notConnected:"Гаманець знайдено — не підключено", readonly:"Лише читання" },
    sq: { shopTitle:"Bli online • Merr JODA", shopLead:"Me JODALINE — sa herë që shpenzon, shpërblehesh me JODA.", buyTitle:"Bli JODA", stakeTitle:"Stake JODA", yourBalance:"Saldot e tua", saleStatus:"Statusi i shitjes", howWorks:"Si funksionon", connected:"Lidhur me MetaMask", connect:"Lidhu me Portofolin", connectedShort:"Lidhur", notConnected:"Portofoli u gjet — jo i lidhur", readonly:"Vetëm lexim" },
    tr: { shopTitle:"Çevrimiçi alışveriş • JODA kazan", shopLead:"JODALINE ile — her harcamada JODA ile ödüllendirilirsin.", buyTitle:"JODA Satın Al", stakeTitle:"JODA Stake Et", yourBalance:"Bakiyelerin", saleStatus:"Satış Durumu", howWorks:"Nasıl çalışır", connected:"MetaMask’e bağlandı", connect:"Cüzdanı Bağla", connectedShort:"Bağlandı", notConnected:"Cüzdan algılandı — bağlı değil", readonly:"Salt okunur" },
    ar: { shopTitle:"تسوّق عبر الإنترنت • احصل على JODA", shopLead:"مع JODALINE — في كل مرة تنفق فيها، تكافأ برموز JODA.", buyTitle:"شراء JODA", stakeTitle:"تكديس JODA", yourBalance:"أرصدةك", saleStatus:"حالة البيع", howWorks:"كيف تعمل", connected:"متصل بـ MetaMask", connect:"اتصل بالمحفظة", connectedShort:"متصل", notConnected:"تم اكتشاف محفظة — غير متصل", readonly:"قراءة فقط" },
    fa: { shopTitle:"آنلاین خرید کنید • JODA بگیرید", shopLead:"با JODALINE — هر بار که خرج می‌کنید، با توکن‌های JODA پاداش می‌گیرید.", buyTitle:"خرید JODA", stakeTitle:"استیک کردن JODA", yourBalance:"موجودی‌های شما", saleStatus:"وضعیت فروش", howWorks:"چطور کار می‌کند", connected:"به MetaMask متصل شد", connect:"اتصال کیف پول", connectedShort:"متصل", notConnected:"کیف پول شناسایی شد — متصل نیست", readonly:"فقط خواندنی" },
    hi: { shopTitle:"ऑनलाइन खरीदें • JODA पाएं", shopLead:"JODALINE के साथ — हर खर्च पर JODA टोकन मिलते हैं.", buyTitle:"JODA खरीदें", stakeTitle:"JODA स्टेक करें", yourBalance:"आपके बैलेंस", saleStatus:"सेल स्टेटस", howWorks:"कैसे काम करता है", connected:"MetaMask से कनेक्टेड", connect:"वॉलेट कनेक्ट करें", connectedShort:"कनेक्टेड", notConnected:"वॉलेट मिला — कनेक्ट नहीं", readonly:"केवल-पढ़ने के लिए" },
    ur: { shopTitle:"آن لائن خریدیں • JODA حاصل کریں", shopLead:"JODALINE کے ساتھ — ہر خرچ پر JODA ٹوکن ملتے ہیں.", buyTitle:"JODA خریدیں", stakeTitle:"JODA اسٹیک کریں", yourBalance:"آپ کے بیلنس", saleStatus:"سیل اسٹیٹس", howWorks:"یہ کیسے کام کرتا ہے", connected:"MetaMask سے منسلک", connect:"والیٹ کنیکٹ کریں", connectedShort:"منسلک", notConnected:"والیٹ ملا — کنیکٹ نہیں", readonly:"صرف مطالعہ" },
    zh: { shopTitle:"线上购物 • 返还 JODA", shopLead:"使用 JODALINE — 每次消费都可获得 JODA 代币奖励。", buyTitle:"购买 JODA", stakeTitle:"质押 JODA", yourBalance:"你的余额", saleStatus:"销售状态", howWorks:"如何运作", connected:"已连接 MetaMask", connect:"连接钱包", connectedShort:"已连接", notConnected:"检测到钱包 — 未连接", readonly:"只读" },
    ja: { shopTitle:"オンラインで購入 • JODAを受け取る", shopLead:"JODALINE では支出のたびにJODAトークンで報酬。", buyTitle:"JODAを購入", stakeTitle:"JODAをステーキング", yourBalance:"残高", saleStatus:"販売状況", howWorks:"使い方", connected:"MetaMask に接続中", connect:"ウォレット接続", connectedShort:"接続済み", notConnected:"ウォレット検出 — 未接続", readonly:"読み取り専用" },
    ko: { shopTitle:"온라인 쇼핑 • JODA 받기", shopLead:"JODALINE — 지출할 때마다 JODA로 보상.", buyTitle:"JODA 구매", stakeTitle:"JODA 스테이킹", yourBalance:"내 잔액", saleStatus:"판매 상태", howWorks:"작동 방식", connected:"MetaMask 연결됨", connect:"지갑 연결", connectedShort:"연결됨", notConnected:"지갑 감지 — 미연결", readonly:"읽기 전용" },
    sw: { shopTitle:"Nunua mtandaoni • Pata JODA", shopLead:"Ukitumia JODALINE — kila unapotumia, unazawadiwa JODA.", buyTitle:"Nunua JODA", stakeTitle:"Weka JODA kama dau", yourBalance:"Salio lako", saleStatus:"Hali ya mauzo", howWorks:"Jinsi inavyofanya kazi", connected:"Imeunganishwa na MetaMask", connect:"Unganisha Wallet", connectedShort:"Imeunganishwa", notConnected:"Wallet imegunduliwa — haijaunganishwa", readonly:"Kusoma tu" },
    am: { shopTitle:"በመስመር ላይ ይግዙ • የJODA ይቀበሉ", shopLead:"በJODALINE — ሁሉን ጊዜ ሲወጡ በJODA ታሳለፋሉ።", buyTitle:"JODA ይግዙ", stakeTitle:"JODA ይስታኩ", yourBalance:"ሂሳብዎ", saleStatus:"የሽያጭ ሁኔታ", howWorks:"እንዴት እንደሚሰራ", connected:"ከMetaMask ጋር ተገናኝቷል", connect:"ዋሌት አገናኝ", connectedShort:"ተገናኝቷል", notConnected:"ዋሌት ተገኘ — አልተገናኘም", readonly:"ንባብ ብቻ" },
    yo: { shopTitle:"Ra lori ayelujara • Gba JODA", shopLead:"Pẹlu JODALINE — gbogbo inawo ni ere JODA.", buyTitle:"Ra JODA", stakeTitle:"Fi JODA sílẹ̀", yourBalance:"Awọn ìdọ́gba rẹ", saleStatus:"Ipo tita", howWorks:"Bí ó ṣe ń ṣiṣẹ́", connected:"Asopọ sí MetaMask", connect:"So àpamọ́ pọ̀", connectedShort:"Ti sopọ̀", notConnected:"Àpamọ́ rí — kò sopọ̀", readonly:"Kíkà nìkan" },
    ha: { shopTitle:"Siyan kaya a yanar gizo • Samu JODA", shopLead:"Tare da JODALINE — duk lokacin da ka kashe kudi, ana ba ka JODA.", buyTitle:"Sayi JODA", stakeTitle:"Ajiye JODA", yourBalance:"Ma'auni naka", saleStatus:"Matsayin sayarwa", howWorks:"Yadda yake aiki", connected:"An haɗa da MetaMask", connect:"Haɗa Wallet", connectedShort:"An haɗa", notConnected:"An gano Wallet — ba a haɗa ba", readonly:"Karatu kawai" },
    pl: { shopTitle:"Kupuj online • Odbieraj JODA", shopLead:"Z JODALINE — za każdy wydatek otrzymujesz JODA.", buyTitle:"Kup JODA", stakeTitle:"Stakuj JODA", yourBalance:"Twoje salda", saleStatus:"Status sprzedaży", howWorks:"Jak to działa", connected:"Połączono z MetaMask", connect:"Połącz portfel", connectedShort:"Połączono", notConnected:"Wykryto portfel — nie połączono", readonly:"Tylko do odczytu" },
    el: { shopTitle:"Αγοράστε online • Κερδίστε JODA", shopLead:"Με το JODALINE — κάθε δαπάνη σας ανταμείβεται με JODA.", buyTitle:"Αγορά JODA", stakeTitle:"Stake JODA", yourBalance:"Υπόλοιπά σας", saleStatus:"Κατάσταση πώλησης", howWorks:"Πώς λειτουργεί", connected:"Συνδέθηκε με MetaMask", connect:"Συνδέστε πορτοφόλι", connectedShort:"Συνδέθηκε", notConnected:"Βρέθηκε πορτοφόλι — μη συνδεδεμένο", readonly:"Μόνο ανάγνωση" },
    nl: { shopTitle:"Online winkelen • Ontvang JODA", shopLead:"Met JODALINE — elke uitgave wordt beloond met JODA-tokens.", buyTitle:"JODA kopen", stakeTitle:"JODA staken", yourBalance:"Je saldi", saleStatus:"Verkoopstatus", howWorks:"Hoe het werkt", connected:"Verbonden met MetaMask", connect:"Wallet verbinden", connectedShort:"Verbonden", notConnected:"Wallet gedetecteerd — niet verbonden", readonly:"Alleen-lezen" },
    ro: { shopTitle:"Cumpără online • Primește JODA", shopLead:"Cu JODALINE — pentru fiecare cheltuială ești răsplătit în JODA.", buyTitle:"Cumpără JODA", stakeTitle:"Stake JODA", yourBalance:"Soldurile tale", saleStatus:"Starea vânzării", howWorks:"Cum funcționează", connected:"Conectat la MetaMask", connect:"Conectează portofelul", connectedShort:"Conectat", notConnected:"Portofel detectat — neconectat", readonly:"Doar citire" },
  };

  let accounts = [];
  function applyLang(lang) {
    const d = i18n[lang] || i18n.en;
    setText('shopTitle', d.shopTitle);
    setText('shopLead', d.shopLead);
    setText('buyTitle', d.buyTitle);
    setText('stakeTitle', d.stakeTitle);
    setText('balanceTitle', d.yourBalance);
    setText('saleStatusTitle', d.saleStatus);
    setText('howTitle', d.howWorks);

    const connectBtn = $('connectBtn');
    if (connectBtn) connectBtn.textContent = accounts.length ? d.connectedShort : d.connect;

    const state = $('walletState');
    if (state) state.textContent = accounts.length
      ? d.connected
      : (window.ethereum ? d.notConnected : d.readonly);

    localStorage.setItem('lang', lang);
  }
  const langSel = $('languageSelector');
  const savedLang = localStorage.getItem('lang') || 'en';
  if (langSel) {
    langSel.value = savedLang;
    langSel.addEventListener('change', e => applyLang(e.target.value));
  }
  applyLang(savedLang);

  // ------------------ Theme toggle ------------------
  const themeBtn = $('themeToggle');
  const storedTheme = localStorage.getItem('theme') || 'dark';
  document.body.classList.toggle('light', storedTheme === 'light');
  document.body.classList.toggle('dark', storedTheme !== 'light');
  if (themeBtn) {
    themeBtn.textContent = storedTheme === 'light' ? '🌙' : '☀️';
    themeBtn.onclick = () => {
      const nowLight = !document.body.classList.contains('light');
      document.body.classList.toggle('light', nowLight);
      document.body.classList.toggle('dark', !nowLight);
      localStorage.setItem('theme', nowLight ? 'light' : 'dark');
      themeBtn.textContent = nowLight ? '🌙' : '☀️';
    };
  }

  // ------------------ Chain config ------------------
  const BSC_TESTNET_ID = 97;
  const BSC_TESTNET_PARAMS = {
    chainId: '0x61',
    chainName: 'BSC Testnet',
    nativeCurrency: { name: 'BNB', symbol: 'tBNB', decimals: 18 },
    rpcUrls: ['https://data-seed-prebsc-1-s1.binance.org:8545/'],
    blockExplorerUrls: ['https://testnet.bscscan.com/'],
  };

  // ------------------ Addresses (edit if you redeploy) ------------------
  const ADDR = {
    TOKEN:   '0xB2EFA488040B036E50A18C9d2D8110AF743c5504',
    SALE:    '0x9146aEE05EbCFD30950D4E964cE256e32E1CbcfD',
    STAKING: '0xEe5eF7b0140a061032613F157c8366D5a29ABB95',
  };

  // ------------------ State ------------------
  let provider = null;        // ethers.BrowserProvider | JsonRpcProvider
  let signer = null;          // ethers.Signer
  let token = null, sale = null, staking = null;
  let abiToken = null, abiSale = null, abiStaking = null;

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

  // ------------------ Init sequence ------------------
  try {
    banner('Loading…');
    await loadABIs();
    await chooseProvider();
    await buildContracts();
    paintAddresses();
    paintConnectionBadge();
    wireUI();
    await fullRefresh();
    startAutoRefresh();
    banner('Ready', 'ok');
  } catch (e) {
    console.error(e);
    banner(`Init error: ${e.message || e}`, 'err');
  }

  // ------------------ Load ABIs ------------------
  async function loadABIs() {
    const fetchJSON = async (path) => (await fetch(path)).json();
    [abiToken, abiSale, abiStaking] = await Promise.all([
      fetchJSON('JODA.json'),
      fetchJSON('JODASale.json'),
      fetchJSON('JODAStaking.json'),
    ]);
  }

  // ------------------ Provider / network ------------------
  async function chooseProvider() {
    const hasMM = typeof window.ethereum !== 'undefined' && window.ethereum.isMetaMask;
    if (hasMM) {
      provider = new ethers.BrowserProvider(window.ethereum, 'any');
      const net = await provider.getNetwork();
      if (Number(net.chainId) !== BSC_TESTNET_ID) {
        banner('Switching to BSC Testnet…', 'warn');
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
      banner(i18n[savedLang].readonly || 'Read-only', 'warn');
    }
  }

  // ------------------ Contracts ------------------
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

  // ------------------ UI wire-up ------------------
  function wireUI() {
    if (connectBtn) {
      connectBtn.onclick = async () => {
        try {
          if (!window.ethereum) return banner('No wallet provider.', 'err');
          banner('Connecting…');
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
      };
    }

    if (disconnectBtn) {
      disconnectBtn.onclick = () => {
        signer = null;
        accounts = [];
        buildContracts(); // back to read-only
        paintConnectionBadge(false);
        banner('Disconnected (UI only)', 'warn');
      };
    }

    if (buyBtn && buyInput) {
      buyBtn.onclick = async () => {
        try {
          if (!signer) throw new Error('Connect wallet first.');
          withSigner();
          const bnb = (buyInput.value || '0').trim();
          if (!bnb || Number(bnb) <= 0) throw new Error('Enter BNB amount.');
          const value = ethers.parseEther(bnb);
          const tx = await sale.buy({ value });
          banner('Buying… awaiting confirmation');
          await tx.wait();
          banner('Buy confirmed', 'ok');
          await fullRefresh();
        } catch (e) {
          console.error(e);
          banner(e.shortMessage || e.message || 'Buy failed', 'err');
        }
      };
    }

    if (approveBtn && stakeAmount) {
      approveBtn.onclick = async () => {
        try {
          if (!signer) throw new Error('Connect wallet first.');
          withSigner();
          const amt = (stakeAmount.value || '').trim();
          if (!amt || Number(amt) <= 0) throw new Error('Enter JODA amount.');
          const dec = await token.decimals();
          const weiAmt = ethers.parseUnits(amt, dec);
          const tx = await token.approve(ADDR.STAKING, weiAmt);
          banner('Approving…');
          await tx.wait();
          banner('Approved', 'ok');
        } catch (e) {
          console.error(e);
          banner(e.shortMessage || e.message || 'Approve failed', 'err');
        }
      };
    }

    if (stakeBtn && stakeAmount && stakeMonths) {
      stakeBtn.onclick = async () => {
        try {
          if (!signer) throw new Error('Connect wallet first.');
          withSigner();
          const amt = (stakeAmount.value || '').trim();
          const months = Number(stakeMonths.value || '0');
          if (!amt || Number(amt) <= 0) throw new Error('Enter JODA amount.');
          if (![3,6,12,24,36].includes(months)) throw new Error('Pick 3, 6, 12, 24, or 36 months.');
          const dec = await token.decimals();
          const weiAmt = ethers.parseUnits(amt, dec);
          const tx = await staking.stake(weiAmt, months);
          banner('Staking… awaiting confirmation');
          await tx.wait();
          banner('Stake confirmed', 'ok');
          await fullRefresh();
        } catch (e) {
          console.error(e);
          banner(e.shortMessage || e.message || 'Stake failed', 'err');
        }
      };
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

  // ------------------ Painters ------------------
  function paintConnectionBadge(connected = !!signer) {
    const lang = localStorage.getItem('lang') || 'en';
    const d = i18n[lang] || i18n.en;
    const btn = $('connectBtn');
    const state = $('walletState');
    if (btn) btn.textContent = connected ? (d.connectedShort || 'Connected') : (d.connect || 'Connect Wallet');
    if (state) state.textContent =
      connected ? (d.connected || 'Connected to MetaMask') :
      (window.ethereum ? (d.notConnected || 'Wallet detected — not connected') : (d.readonly || 'Read-only'));
  }

  function paintAddresses() {
    if (addrUserEl)   addrUserEl.value = accounts[0] || '';
    if (addrStakingEl)addrStakingEl.value = ADDR.STAKING;
    if (addrSaleEl)   addrSaleEl.value = ADDR.SALE;

    const linkBox = $('refLink'), copyBtn = $('copyRef');
    if (linkBox) {
      const base = 'https://buy-joda.link/?ref=';
      linkBox.value = base + (accounts[0] || 'your-wallet');
      copyBtn && (copyBtn.onclick = async () => {
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

      let dec = 18; try { dec = await token.decimals(); } catch {}

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
}); // end of main DOMContentLoaded

// --- Language globe trigger ---
document.addEventListener('DOMContentLoaded', () => {
  const langBtn = document.getElementById('langBtn');
  const langSel = document.getElementById('languageSelector');
  if (langBtn && langSel) {
    langBtn.addEventListener('click', () => langSel.click());
  }
});