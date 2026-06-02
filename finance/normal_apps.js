// --- CONFIGURATION & UTILITIES ---
// KR - NAVER data, US, MKT - YAHOO data

const DEFAULT_WATCHLISTS = {
    indicators: { title: '📈 MKT', tickers: ['KRW=X', '^KS11', '^KQ11', '^IXIC', '^DJI', '^GSPC', 'BTC-USD'] },
    kr: { title: '🇰🇷 KR', tickers: ['005930', '000660', '373220', '005380', '035420'] },            
    us: { title: '🇺🇸 US', tickers: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META'] }
};

const GAS_PROXY_URL = "https://script.google.com/macros/s/AKfycbydYWqn3tZL25dE8UPMyN9mV19R1YKFZKpF-aml_25Z_YvA_qElw-LpxNO_Y8_sOzCV/exec";
const NAVER_GAS_PROXY_URL = "https://script.google.com/macros/s/AKfycbygC4GrK-2abZUpWWCxD4ZVfFVzd-gjbGvyYBTWNP26J7zwkwbrWwttXNC-geENS1Nykw/exec"; 
const NEWS_GAS_PROXY_URL = "https://script.google.com/macros/s/AKfycbwSD8MOLPrYjwTBVQX_Tq6pu-gTHlOeR7p0hUY2pHGACNc2NA6f4zICduC05ypO_EN6/exec"; 

const CHO_HANGUL = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
function getChosung(str) {
    let result = '';
    for (let i = 0; i < str.length; i++) {
        let code = str.charCodeAt(i) - 44032; 
        if (code > -1 && code < 11172) result += CHO_HANGUL[Math.floor(code / 588)];
        else result += str.charAt(i); 
    }
    return result;
}

function escapeHTML(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag]));
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => { clearTimeout(timeout); func(...args); };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

const DRAG_ICON = `<svg viewBox="0 0 24 24"><line x1="6" y1="6" x2="18" y2="6"/><line x1="6" y1="10" x2="18" y2="10"/><line x1="6" y1="14" x2="18" y2="14"/><line x1="6" y1="18" x2="18" y2="18"/></svg>`;
const TRASH_ICON = `<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`;
const CHEVRON_ICON = `<svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>`;
const SEARCH_ICON = `<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
const PLUS_ICON = `<svg class="icon-svg" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
const SPINNER_SVG = `<svg class="spinner" viewBox="0 0 50 50"><circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle></svg>`;
const EMPTY_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>`;

let localTickerDB = [];
let state = {
    watchlists: JSON.parse(localStorage.getItem('marketdash_watchlists')) || JSON.parse(JSON.stringify(DEFAULT_WATCHLISTS)),
    sectionOrder: JSON.parse(localStorage.getItem('marketdash_sectionOrder')) || ['indicators', 'kr', 'us'],
    expanded: JSON.parse(localStorage.getItem('marketdash_expanded')) || { indicators: true, kr: true, us: true },
    theme: localStorage.getItem('marketdash_theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
    countdown: 60,
    intervalId: null,
    lastNewsFetch: 0 // 뉴스 오버로딩 방지 타임스탬프
};

const rowNodes = new Map(); let sortables = []; 
function getSafeId(ticker) { return 'id_' + ticker.replace(/[^a-zA-Z0-9]/g, '_'); }

// --- INITIALIZATION ---
async function init() {
    if (!state.sectionOrder || state.sectionOrder.length === 0) state.sectionOrder = Object.keys(state.watchlists);
    await initTickerDB(); 

    applyTheme(); renderLayout(); startTimer(); 
    
    try {
        const cachedDataStr = localStorage.getItem('marketdash_price_cache');
        if (cachedDataStr) {
            const cachedData = JSON.parse(cachedDataStr);
            if (Object.keys(cachedData).length > 0) {
                updateDOMWithData(Object.values(cachedData));
            }
        }
    } catch (e) {
        console.warn("캐시 데이터가 손상되어 초기화합니다.", e);
        localStorage.removeItem('marketdash_price_cache');
    }

    const lastFetchTime = parseInt(localStorage.getItem('marketdash_last_fetch_time') || '0');
    const now = Date.now();
    
    if (now - lastFetchTime < 60000) {
        state.countdown = Math.ceil(60 - ((now - lastFetchTime) / 1000));
        const countdownEl = document.getElementById('countdown');
        if (countdownEl) countdownEl.textContent = state.countdown;
        fetchNews(); 
    } else {
        fetchData(); 
    }

    initSwipeToDelete(); 
    
    const btnRefresh = document.getElementById('btn-refresh');
    if (btnRefresh) btnRefresh.addEventListener('click', forceRefresh);

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-wrapper')) {
            document.querySelectorAll('.autocomplete-list').forEach(el => el.style.display = 'none');
            document.querySelectorAll('.input-guide').forEach(el => el.style.display = 'none');
        }
        const settingsDropdown = document.getElementById('settings-dropdown');
        if (settingsDropdown && !e.target.closest('.settings-wrapper')) {
            settingsDropdown.classList.remove('active');
        }
    });
}

function processTickerDB(data) {
    return data.map(q => ({
        ...q, cs_s: getChosung(q.s || '').toLowerCase(), cs_n: getChosung(q.n || '').toLowerCase()
    }));
}

async function initTickerDB() {
    try {
        const response = await fetch(`./finance/tickers_n.json?v=${new Date().getTime()}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const rawData = await response.json();
        localTickerDB = processTickerDB(rawData);
    } catch (error) {
        console.error("Failed to load ticker DB:", error);
        localTickerDB = processTickerDB([
            { s: "AAPL", n: "Apple Inc.", e: "NASDAQ" }, 
            { s: "005930", n: "삼성전자", e: "NAVER" }
        ]);
    }
}

// --- SWIPE TO DELETE GESTURE LOGIC ---
function initSwipeToDelete() {
    let touchStartX = 0;
    let touchStartY = 0;
    let swipingRow = null;
    let isSwiping = false;
    let isScrolling = false;

    const dashboard = document.getElementById('dashboard');
    if (!dashboard) return;

    dashboard.addEventListener('touchstart', e => {
        const row = e.target.closest('tr[data-ticker]');
        if (!row || e.target.closest('.drag-handle') || e.target.closest('.action-icon-btn')) return;
        
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        swipingRow = row;
        isSwiping = false;
        isScrolling = false; 
        row.style.transition = 'none'; 
    }, { passive: true });

    dashboard.addEventListener('touchmove', e => {
        if (!swipingRow) return;
        
        const touchCurrentX = e.touches[0].clientX;
        const touchCurrentY = e.touches[0].clientY;
        const diffX = touchCurrentX - touchStartX;
        const diffY = touchCurrentY - touchStartY;
        
        const absDiffX = Math.abs(diffX);
        const absDiffY = Math.abs(diffY);

        if (!isSwiping && !isScrolling && (absDiffX > 10 || absDiffY > 10)) {
            if (absDiffX > absDiffY * 1.5 && diffX < 0) {
                isSwiping = true;
            } else {
                isScrolling = true; 
            }
        }

        if (isScrolling) return;

        if (isSwiping && diffX < 0) { 
            if (e.cancelable) e.preventDefault();
            const moveX = Math.max(diffX, -150); 
            swipingRow.style.transform = `translateX(${moveX}px)`;
            swipingRow.style.opacity = 1 - (Math.abs(moveX) / 200); 
        }
    }, { passive: false });

    dashboard.addEventListener('touchend', e => {
        if (!swipingRow) return;
        const touchCurrentX = e.changedTouches[0].clientX;
        const diffX = touchCurrentX - touchStartX;

        swipingRow.style.transition = 'all 0.3s ease';
        
        if (isSwiping && diffX < -80) {
            const ticker = swipingRow.dataset.ticker;
            confirmRemoveTicker(ticker); 
        } 
        
        swipingRow.style.transform = 'translateX(0)';
        swipingRow.style.opacity = '1';
        swipingRow = null;
        isSwiping = false;
        isScrolling = false;
    });
}

// --- MOBILE TAB LOGIC ---
window.switchMobileTab = function(tabName) {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(btn => btn.classList.remove('active'));
    
    if(tabName === 'news') {
        document.body.classList.add('show-news');
        if(tabs[1]) tabs[1].classList.add('active');
        
        const container = document.getElementById('news-container');
        const isStale = (Date.now() - state.lastNewsFetch) > 60000;
        const isEmpty = !container || container.children.length === 0 || container.querySelector('.empty-state');
        
        // 60초가 완전히 경과했거나 리스트가 완전히 비어있을 때만 데이터를 실제 갱신(스피너 작동)하도록 처리
        if (isStale || isEmpty) {
            fetchNews(); 
        }
    } else {
        document.body.classList.remove('show-news');
        if(tabs[0]) tabs[0].classList.add('active');
    }
}

// --- RENDERING & UI ---
function renderLayout() {
    const dashboard = document.getElementById('dashboard');
    if (!dashboard) return;
    
    dashboard.innerHTML = ''; rowNodes.clear();
    sortables.forEach(s => s.destroy()); sortables = [];
    const fragment = document.createDocumentFragment();

    state.sectionOrder.forEach(sectionId => {
        const sectionData = state.watchlists[sectionId];
        if (!sectionData) return;

        const isExpanded = state.expanded[sectionId];
        const isEmpty = sectionData.tickers.length === 0;
        const sectionContainer = document.createElement('div');
        sectionContainer.className = `section-container ${isExpanded ? '' : 'collapsed'}`;
        sectionContainer.id = `section-${sectionId}`;
        sectionContainer.dataset.id = sectionId;

        const guideText = sectionId === 'kr' 
            ? "Please choose a ticker from the search results only." 
            : "Please enter only the ticker symbol from Yahoo Finance.";

        sectionContainer.innerHTML = `
            <div class="section-header">
                <div class="section-header-left" onclick="toggleSection(event, '${sectionId}')">
                    <h2>${sectionData.title}</h2>
                </div>
                <div class="section-header-right">
                    <button class="action-icon-btn btn-add-symbol" onclick="toggleAddForm(event, '${sectionId}')">${PLUS_ICON}</button>
                    <div class="action-icon-btn drag-handle">${DRAG_ICON}</div>
                    <button class="action-icon-btn toggle-btn" onclick="toggleSection(event, '${sectionId}')">${CHEVRON_ICON}</button>
                </div>
            </div>
            <div class="section-body">
                <form class="add-ticker-form" onsubmit="handleAddTicker(event, '${sectionId}')">
                    <div class="search-wrapper">
                        <div class="input-guide" id="guide-${sectionId}">${guideText}</div>
                        ${SEARCH_ICON}
                        <input type="text" id="input-${sectionId}" placeholder="Quote Lookup" autocomplete="off">
                        <ul class="autocomplete-list" id="autocomplete-${sectionId}"></ul>
                    </div>
                    <button type="submit" id="btn-add-${sectionId}">
                        ${PLUS_ICON}<span>Add tickers</span>
                    </button>
                </form>
                <div class="table-wrapper">
                    <div class="empty-state" id="empty-${sectionId}" style="display: ${isEmpty ? 'flex' : 'none'};">
                        ${EMPTY_ICON}
                        <p>Nothing here yet. <br>Tap the <strong>+ button</strong> at the top to add stocks.</p>
                    </div>
                    <table style="display: ${isEmpty ? 'none' : 'table'};" id="table-${sectionId}">
                        <thead>
                            <tr>
                                <th class="left-align col-symbol">Symbol</th>
                                <th class="col-price">Price</th>
                                <th class="col-change">Change</th>
                                <th class="hide-mobile col-vol">Volume</th>
                                <th class="hide-mobile col-cap">Market Cap</th>
                                <th class="hide-mobile col-range">52W Range</th>
                                <th class="actions-col"></th>
                                <th class="handle-col"></th>
                            </tr>
                        </thead>
                        <tbody id="tbody-${sectionId}">
                            ${sectionData.tickers.map(ticker => generateRowHTML(ticker)).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        fragment.appendChild(sectionContainer);
    });

    dashboard.appendChild(fragment);

    state.sectionOrder.forEach(sectionId => {
        const sectionData = state.watchlists[sectionId];
        if (sectionData) sectionData.tickers.forEach(ticker => cacheRowNodes(ticker));
        
        const inputEl = document.getElementById(`input-${sectionId}`);
        if(inputEl) {
            const debouncedSearch = debounce((e) => handleAutocomplete(e.target.value, sectionId), 150);
            inputEl.addEventListener('input', debouncedSearch);
            inputEl.addEventListener('focus', debouncedSearch);
        }
    });

    initDragAndDrop();
}

function handleAutocomplete(query, sectionId) {
    const list = document.getElementById(`autocomplete-${sectionId}`);
    const guide = document.getElementById(`guide-${sectionId}`);
    const btn = document.getElementById(`btn-add-${sectionId}`);

    if (btn && btn.disabled) return;
    if(!query) return; 
    query = query.trim().toLowerCase();
    
    if (query.length < 1) {
        if(list) list.style.display = 'none'; 
        if(guide) guide.style.display = 'none'; 
        return;
    }
    
    const isChosungQuery = /[ㄱ-ㅎ]/.test(query) && !/[가-힣]/.test(query);
    const isKrSection = sectionId === 'kr';

    const matchedQuotes = localTickerDB.filter(q => {
        if (isKrSection && q.e !== "NAVER") return false;
        if (!isKrSection && q.e === "NAVER") return false;
        if (isChosungQuery) return (q.cs_s && q.cs_s.includes(query)) || (q.cs_n && q.cs_n.includes(query));
        else return (q.s && q.s.toLowerCase().includes(query)) || (q.n && q.n.toLowerCase().includes(query));
    }).slice(0, 8); 

    if (matchedQuotes.length > 0) {
        if(list) list.innerHTML = matchedQuotes.map(q => {
            const safeSymbol = escapeHTML(q.s); const safeName = escapeHTML(q.n); const safeExch = escapeHTML(q.e);
            return `
            <li onclick="selectAutocomplete('${safeSymbol}', '${sectionId}')">
                <div class="ac-info"><span class="ac-symbol">${safeSymbol}</span><span class="ac-name">${safeName}</span></div>
                <span class="ac-exch">${safeExch}</span>
            </li>
        `}).join('');
        if(list) list.style.display = 'block'; 
        if(guide) guide.style.display = 'none';
    } else {
        if(list) list.style.display = 'none'; 
        if(guide) guide.style.display = 'block';
    }
}

window.selectAutocomplete = function(symbol, sectionId) {
    const input = document.getElementById(`input-${sectionId}`);
    const list = document.getElementById(`autocomplete-${sectionId}`);
    const guide = document.getElementById(`guide-${sectionId}`);
    const btn = document.getElementById(`btn-add-${sectionId}`);
    if(input) input.value = symbol; 
    if(list) list.style.display = 'none'; 
    if(guide) guide.style.display = 'none'; 
    if(btn) btn.click(); 
};

function generateRowHTML(ticker) {
    const sid = getSafeId(ticker);
    const safeTicker = escapeHTML(ticker);
    return `
        <tr id="row-${sid}" data-ticker="${safeTicker}">
            <td class="left-align col-symbol">
                <div class="asset-col">
                    <span class="symbol" id="symbol-${sid}" title="${safeTicker}">${safeTicker}</span>
                    <span class="name" id="name-${sid}"><span class="skeleton sm"></span></span>
                </div>
            </td>
            <td class="col-price" id="price-cell-${sid}">
                <div class="price" id="price-${sid}"><span class="skeleton"></span></div>
                <div class="extended-price" id="ext-price-${sid}"></div>
            </td>
            <td class="col-change" id="change-cell-${sid}">
                <div class="change-cell">
                    <div id="change-${sid}"><span class="skeleton"></span></div>
                    <div id="pct-${sid}"><span class="skeleton sm"></span></div>
                </div>
            </td>
            <td class="hide-mobile sub-data" id="vol-${sid}">-</td>
            <td class="hide-mobile sub-data" id="cap-${sid}">-</td>
            <td class="hide-mobile sub-data" id="range-${sid}">-</td>
            <td class="actions-col"><button class="action-icon-btn danger" onclick="confirmRemoveTicker('${safeTicker}')">${TRASH_ICON}</button></td>
            <td class="handle-col"><div class="action-icon-btn drag-handle">${DRAG_ICON}</div></td>
        </tr>
    `;
}

function checkEmptyState(sectionId) {
    const tbody = document.getElementById(`tbody-${sectionId}`);
    const emptyState = document.getElementById(`empty-${sectionId}`);
    const table = document.getElementById(`table-${sectionId}`);
    if(tbody && emptyState && table) {
        const isEmpty = tbody.children.length === 0;
        emptyState.style.display = isEmpty ? 'flex' : 'none';
        table.style.display = isEmpty ? 'none' : 'table';
    }
}

// --- DATA FETCHING & LOGIC ---
async function fetchWithRetry(url, maxRetries = 3, baseDelayMs = 1000) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.text();
        } catch (error) {
            if (attempt === maxRetries - 1) throw error; 
            await new Promise(res => setTimeout(res, baseDelayMs * Math.pow(2, attempt)));
        }
    }
}

async function fetchYahooFinance(symbols) {
    if (symbols.length === 0) return [];
    if (!navigator.onLine) throw new Error("No network connection.");

    const symbolsStr = symbols.join(',');
    const targetUrl = `${GAS_PROXY_URL}?symbols=${encodeURIComponent(symbolsStr)}&t=${Date.now()}`;

    try {
        const text = await fetchWithRetry(targetUrl);
        if (text.trim().startsWith('<')) throw new Error("GAS permission denied or limit reached.");
        const data = JSON.parse(text);
        if (data && data.quoteResponse && data.quoteResponse.result) return data.quoteResponse.result;
        else if (data && data.error) throw new Error(data.error);
        throw new Error("Invalid data structure.");
    } catch (e) { console.error("Failed to fetch data:", e); throw e; }
}

async function fetchNaverFinance(symbols) {
    if (symbols.length === 0) return [];
    if (!navigator.onLine) throw new Error("No network connection.");

    const symbolsStr = symbols.join(',');
    const targetUrl = `${NAVER_GAS_PROXY_URL}?symbols=${encodeURIComponent(symbolsStr)}&t=${Date.now()}`;

    try {
        const text = await fetchWithRetry(targetUrl);
        if (text.trim().startsWith('<')) throw new Error("Naver GAS proxy permission denied.");
        const data = JSON.parse(text);
        if (data && data.quoteResponse && data.quoteResponse.result) return data.quoteResponse.result;
        else if (data && data.error) throw new Error(data.error);
        throw new Error("Invalid data structure from Naver proxy.");
    } catch (e) { console.error("Failed to fetch Naver data:", e); throw e; }
}

async function handleAddTicker(e, sectionId) {
    e.preventDefault();
    const inputEl = document.getElementById(`input-${sectionId}`);
    const btnEl = document.getElementById(`btn-add-${sectionId}`);
    const listEl = document.getElementById(`autocomplete-${sectionId}`);
    const guideEl = document.getElementById(`guide-${sectionId}`);
    const ticker = inputEl.value.trim().toUpperCase();
    
    if (!ticker || state.watchlists[sectionId].tickers.includes(ticker)) {
        inputEl.value = ''; 
        if (listEl) listEl.style.display = 'none'; 
        if (guideEl) guideEl.style.display = 'none'; 
        return;
    }

    if (sectionId === 'kr') {
        const isValidNaver = localTickerDB.some(q => q.s.toUpperCase() === ticker && q.e === "NAVER");
        if (!isValidNaver) {
            alert('KR stocks: search list only.');
            inputEl.value = '';
            if (listEl) listEl.style.display = 'none';
            return;
        }
    }

    const originalBtnContent = `${PLUS_ICON}<span>Add tickers</span>`;
    if (btnEl) {
        btnEl.disabled = true; 
        btnEl.innerHTML = `${SPINNER_SVG}<span>Adding....</span>`; 
    }
    if (listEl) listEl.style.display = 'none';
    if (guideEl) guideEl.style.display = 'none';

    try {
        const fetchFunc = sectionId === 'kr' ? fetchNaverFinance : fetchYahooFinance;
        const data = await fetchFunc([ticker]);
        if (!data || data.length === 0 || data[0].regularMarketPrice === undefined) {
            alert(`${ticker} not found.`); return;
        }
        state.watchlists[sectionId].tickers.push(ticker); saveWatchlists();
        const tbody = document.getElementById(`tbody-${sectionId}`);
        if (tbody) tbody.insertAdjacentHTML('beforeend', generateRowHTML(ticker));
        cacheRowNodes(ticker); checkEmptyState(sectionId); 
        updateDOMWithData([data[0]]); 
        if (inputEl) inputEl.value = '';
        if (listEl) listEl.style.display = 'none';
        fetchNews();
    } catch (err) {
        alert(`오류: ${err.message}`);
    } finally {
        if (btnEl) {
            btnEl.disabled = false; 
            btnEl.innerHTML = originalBtnContent;
        }
    }
}

function executeRemoveTicker(ticker) {
    let sectionIdToUpdate = null;
    for (const sectionId in state.watchlists) {
        if (state.watchlists[sectionId].tickers.includes(ticker)) {
            state.watchlists[sectionId].tickers = state.watchlists[sectionId].tickers.filter(t => t !== ticker);
            sectionIdToUpdate = sectionId;
            break;
        }
    }
    saveWatchlists();
    const sid = getSafeId(ticker); const row = document.getElementById(`row-${sid}`);
    if (row) row.remove(); rowNodes.delete(ticker);
    if(sectionIdToUpdate) checkEmptyState(sectionIdToUpdate);
    fetchNews(); 
}

function cacheRowNodes(ticker) {
    const sid = getSafeId(ticker);
    rowNodes.set(ticker, {
        row: document.getElementById('row-' + sid), symbol: document.getElementById('symbol-' + sid),
        name: document.getElementById('name-' + sid), price: document.getElementById('price-' + sid),
        extPrice: document.getElementById('ext-price-' + sid), change: document.getElementById('change-' + sid),
        pct: document.getElementById('pct-' + sid), vol: document.getElementById('vol-' + sid),
        cap: document.getElementById('cap-' + sid), range: document.getElementById('range-' + sid)
    });
}

function initDragAndDrop() {
    const dashboard = document.getElementById('dashboard');
    if (!dashboard) return;
    
    Sortable.create(dashboard, {
        handle: '.drag-handle', animation: 200, ghostClass: 'sortable-ghost', delay: 100, delayOnTouchOnly: true,
        onEnd: function () {
            state.sectionOrder = Array.from(dashboard.querySelectorAll('.section-container')).map(el => el.dataset.id);
            localStorage.setItem('marketdash_sectionOrder', JSON.stringify(state.sectionOrder));
        }
    });

    state.sectionOrder.forEach(sectionId => {
        const tbody = document.getElementById(`tbody-${sectionId}`);
        if (tbody) {
            Sortable.create(tbody, {
                handle: '.drag-handle', animation: 200, ghostClass: 'sortable-ghost', delay: 100, delayOnTouchOnly: true,
                onEnd: function () {
                    state.watchlists[sectionId].tickers = Array.from(tbody.querySelectorAll('tr')).map(el => el.dataset.ticker);
                    saveWatchlists(); checkEmptyState(sectionId);
                }
            });
        }
    });
}

function toggleSection(e, sectionId) {
    if (e.target.closest('.action-icon-btn') && !e.target.closest('.toggle-btn')) return; 
    const container = document.getElementById(`section-${sectionId}`);
    if (!container) return;
    container.classList.toggle('collapsed');
    state.expanded[sectionId] = !container.classList.contains('collapsed');
    localStorage.setItem('marketdash_expanded', JSON.stringify(state.expanded));
    if (state.expanded[sectionId]) forceRefresh();
}

function toggleAddForm(e, sectionId) {
    e.stopPropagation();
    const container = document.getElementById(`section-${sectionId}`);
    if (!container) return;
    const form = container.querySelector('.add-ticker-form');
    if (container.classList.contains('collapsed')) {
        container.classList.remove('collapsed');
        state.expanded[sectionId] = true;
        localStorage.setItem('marketdash_expanded', JSON.stringify(state.expanded));
        forceRefresh();
    }
    if (form) form.classList.toggle('active');
    container.classList.toggle('edit-mode');
    if (form && form.classList.contains('active')) form.querySelector('input').focus();
}

let targetTickerToDelete = null;
function confirmRemoveTicker(ticker) {
    targetTickerToDelete = ticker;
    const delTarget = document.getElementById('delete-target-ticker');
    if (delTarget) delTarget.textContent = ticker;
    const delModal = document.getElementById('delete-modal');
    if (delModal) delModal.classList.add('active');
    const btn = document.getElementById('confirm-delete-btn');
    if (btn) {
        btn.onclick = () => {
            if (targetTickerToDelete) { executeRemoveTicker(targetTickerToDelete); closeDeleteModal(); }
        };
    }
}
function closeDeleteModal() { targetTickerToDelete = null; document.getElementById('delete-modal').classList.remove('active'); }

function toggleSettingsMenu() { const el = document.getElementById('settings-dropdown'); if (el) el.classList.toggle('active'); }
function applyTheme() { document.documentElement.setAttribute('data-theme', state.theme); }
function toggleThemeDropdown() { state.theme = state.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('marketdash_theme', state.theme); applyTheme(); toggleSettingsMenu(); }
function exportSettings() {
    const data = { watchlists: state.watchlists, sectionOrder: state.sectionOrder, expanded: state.expanded, theme: state.theme };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url;
    a.download = `1up_finance_settings_${new Date().toISOString().slice(0,10)}.json`; a.click();
    URL.revokeObjectURL(url); toggleSettingsMenu();
}
function triggerImport() { const el = document.getElementById('import-file'); if(el) el.click(); toggleSettingsMenu(); }
function importSettings(event) {
    const file = event.target.files[0]; if (!file) return; const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data.watchlists && data.sectionOrder) {
                localStorage.setItem('marketdash_watchlists', JSON.stringify(data.watchlists));
                localStorage.setItem('marketdash_sectionOrder', JSON.stringify(data.sectionOrder));
                if(data.expanded) localStorage.setItem('marketdash_expanded', JSON.stringify(data.expanded));
                if(data.theme) localStorage.setItem('marketdash_theme', data.theme);
                alert('Settings successfully restored.'); location.reload(); 
            } else alert('Invalid settings file.');
        } catch (err) { alert('File read error occurred.'); }
    };
    reader.readAsText(file); event.target.value = ''; 
}
function resetToDefaults() {
    toggleSettingsMenu();
    if(confirm("Reset all settings to default?")) {
        localStorage.clear(); state.watchlists = JSON.parse(JSON.stringify(DEFAULT_WATCHLISTS));
        state.sectionOrder = ['indicators', 'kr', 'us']; renderLayout(); forceRefresh();
    }
}
function openAboutModal() { toggleSettingsMenu(); const el = document.getElementById('about-modal'); if (el) el.classList.add('active'); }
function closeAboutModal() { const el = document.getElementById('about-modal'); if (el) el.classList.remove('active'); }
function saveWatchlists() { localStorage.setItem('marketdash_watchlists', JSON.stringify(state.watchlists)); }

// FetchData 
async function fetchData() {
    localStorage.setItem('marketdash_last_fetch_time', Date.now().toString());
    const fetchPromises = []; 

    for (const sectionId of state.sectionOrder) {
        if (!state.expanded[sectionId]) continue;
        const symbols = state.watchlists[sectionId].tickers;
        if (symbols.length === 0) continue;

        const chunkSize = 100; 
        const fetchFunc = sectionId === 'kr' ? fetchNaverFinance : fetchYahooFinance;

        for (let i = 0; i < symbols.length; i += chunkSize) {
            const chunk = symbols.slice(i, i + chunkSize);
            const promise = fetchFunc(chunk)
                .then(results => {
                    updateDOMWithData(results); 
                    markMissingData(chunk, results);
                })
                .catch(error => { 
                    markAllError(chunk, error.message); 
                });
            fetchPromises.push(promise);
        }
    }
    await Promise.all(fetchPromises);
    fetchNews();
}

function forceRefresh() { 
    state.countdown = 60; 
    const el = document.getElementById('countdown');
    if (el) el.textContent = state.countdown;
    localStorage.setItem('marketdash_last_fetch_time', '0'); 
    state.lastNewsFetch = 0; 
    fetchData(); 
}

function startTimer() {
    if (state.intervalId) clearInterval(state.intervalId);
    state.intervalId = setInterval(() => {
        state.countdown--;
        if (state.countdown <= 0) forceRefresh(); else {
            const el = document.getElementById('countdown');
            if (el) el.textContent = state.countdown;
        }
    }, 1000);
}

// Update DOM 
function updateDOMWithData(quotes) {
    requestAnimationFrame(() => {
        quotes.forEach(quote => {
            const ticker = quote.symbol; const nodes = rowNodes.get(ticker);
            if (!nodes || !nodes.row) return;

            const price = quote.regularMarketPrice || 0; const change = quote.regularMarketChange || 0;
            const pct = quote.regularMarketChangePercent || 0; const isUp = change >= 0;
            const colorClass = isUp ? 'up' : 'down'; const sign = isUp ? '+' : ''; const arrow = isUp ? '▲' : '▼';
            
            const oldPriceStr = nodes.price.getAttribute('data-price');
            const oldPrice = oldPriceStr ? parseFloat(oldPriceStr) : null;
            if (oldPrice !== null && oldPrice !== price) {
                nodes.row.classList.remove('flash-up', 'flash-down');
                setTimeout(() => {
                    if (nodes && nodes.row) {
                        nodes.row.classList.add(price > oldPrice ? 'flash-up' : 'flash-down');
                    }
                }, 10);
            }
            nodes.price.setAttribute('data-price', price);
            nodes.name.textContent = quote.shortName || quote.longName || ticker;
            nodes.price.textContent = formatNum(price);
            
            let extOptions = [];
            if (quote.preMarketPrice) extOptions.push({ price: quote.preMarketPrice, pct: quote.preMarketChangePercent || 0, label: '🔜', time: quote.preMarketTime || 0 });
            if (quote.postMarketPrice) extOptions.push({ price: quote.postMarketPrice, pct: quote.postMarketChangePercent || 0, label: '🔚', time: quote.postMarketTime || 0 });

            let extPrice, extChangePct, extLabel;
            if (extOptions.length > 0) {
                const latestExt = extOptions.reduce((prev, current) => (prev.time > current.time) ? prev : current);
                extPrice = latestExt.price; extChangePct = latestExt.pct; extLabel = latestExt.label;
            }

            if (extPrice && extLabel) {
                const isExtUp = extChangePct >= 0; const extColorClass = isExtUp ? 'up' : 'down'; const extSign = isExtUp ? '+' : '';
                nodes.extPrice.innerHTML = `<span class="ext-label">${extLabel}</span> ${formatNum(extPrice)} <span class="${extColorClass}">(${extSign}${formatPct(extChangePct)}%)</span>`;
            } else nodes.extPrice.innerHTML = '';
            
            nodes.change.innerHTML = `<span class="${colorClass}">${sign}${formatNum(change)}</span>`;
            nodes.pct.innerHTML = `<span class="badge ${colorClass}"><span class="arrow">${arrow}</span>${formatPct(Math.abs(pct))}%</span>`;
            nodes.vol.textContent = formatCompact(quote.regularMarketVolume); nodes.cap.textContent = formatCompact(quote.marketCap);
            if (quote.fiftyTwoWeekLow && quote.fiftyTwoWeekHigh) nodes.range.textContent = `${formatNum(quote.fiftyTwoWeekLow)} - ${formatNum(quote.fiftyTwoWeekHigh)}`; else nodes.range.textContent = '-';
        });
    });

    try {
        const localCacheStr = localStorage.getItem('marketdash_price_cache');
        const localCache = localCacheStr ? JSON.parse(localCacheStr) : {};
        quotes.forEach(q => { localCache[q.symbol] = q; });
        localStorage.setItem('marketdash_price_cache', JSON.stringify(localCache));
    } catch (e) {
        console.warn("캐시 저장 중 에러가 발생하여 초기화합니다.", e);
        localStorage.setItem('marketdash_price_cache', '{}');
    }
}

function markMissingData(requestedSymbols, results) {
    const returnedSymbols = new Set(results.map(r => r.symbol));
    requestedSymbols.forEach(sym => { if (!returnedSymbols.has(sym)) setErrorState(sym, 'No Data'); });
}
function markAllError(symbols, errMsg) { symbols.forEach(sym => setErrorState(sym, errMsg)); }

function setErrorState(ticker, msg) {
    const nodes = rowNodes.get(ticker); if (!nodes) return;
    requestAnimationFrame(() => {
        nodes.name.textContent = 'Error'; nodes.price.innerHTML = `<span class="error-text">${escapeHTML(msg)}</span>`;
        nodes.extPrice.innerHTML = ''; nodes.change.innerHTML = ''; nodes.pct.innerHTML = '';
        nodes.vol.textContent = '-'; nodes.cap.textContent = '-'; nodes.range.textContent = '-';
    });
}

function formatNum(num) {
    if (num === undefined || num === null || isNaN(num)) return '-';
    const abs = Math.abs(num); let decimals = 2;
    if (abs > 0 && abs < 0.1) decimals = 4; else if (abs > 10000) decimals = 0; 
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(num);
}
function formatPct(num) {
    if (num === undefined || num === null || isNaN(num)) return '-';
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
}
function formatCompact(num) {
    if (!num || isNaN(num)) return '-';
    return new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short', maximumFractionDigits: 2 }).format(num);
}

// --- NEWS FETCHING & RENDERING LOGIC ---
async function fetchNews() {
    const spinner = document.getElementById('news-spinner');
    const container = document.getElementById('news-container');
    
    if (spinner) spinner.style.display = 'block';

    let allTickers = [];
    Object.values(state.watchlists).forEach(section => {
        allTickers = allTickers.concat(section.tickers);
    });

    if (!container) return; 

    if (allTickers.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No tickers to fetch news for.</p></div>';
        if (spinner) spinner.style.display = 'none';
        return;
    }

    try {
        const url = `${NEWS_GAS_PROXY_URL}?symbols=${encodeURIComponent(allTickers.join(','))}&t=${Date.now()}`;
        const response = await fetch(url);
        
        if (!response.ok) throw new Error("Network response was not ok");
        const newsData = await response.json();
        
        state.lastNewsFetch = Date.now();
        renderNews(newsData);
    } catch (error) {
        console.error("News fetch error:", error);
        container.innerHTML = `<div class="empty-state"><p class="error-text">Failed to load news.</p></div>`;
    } finally {
        if (spinner) spinner.style.display = 'none';
    }
}

function renderNews(newsList) {
    const container = document.getElementById('news-container');
    if (!container) return;

    if (!newsList || newsList.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No recent news found.</p></div>';
        return;
    }

    const now = Date.now();
    const kstFormatter = new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    const html = newsList.map(news => {
        const diffMins = Math.floor((now - news.time) / 60000);
        let timeDisplay = '';
        
        // 10분 미만 기사 -> n분 전 표기 / 10분 이상 기사 -> 한국 시각 고유 출고 시간(HH:MM) 표기
        if (diffMins >= 0 && diffMins < 10) {
            timeDisplay = diffMins === 0 ? '방금' : `${diffMins}분 전`;
        } else {
            timeDisplay = kstFormatter.format(new Date(news.time));
        }

        const sourceTagClass = news.source === 'Naver' ? 'tag-naver' : 'tag-yahoo';
        const tickerLabel = news.ticker ? news.ticker : news.source; 

        return `
            <a href="${news.link}" target="_blank" rel="noopener noreferrer" class="news-item">
                <div class="news-title">
                    ${escapeHTML(news.title)} 
                </div>
                <div class="news-meta">
                    <span class="news-time ${diffMins < 10 ? 'recent' : ''}">${timeDisplay}</span>
                    <span class="news-tag ${sourceTagClass}">${escapeHTML(tickerLabel)} - ${escapeHTML(news.source)}</span>
                </div>
            </a>
        `;
    }).join('');

    container.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', init);
