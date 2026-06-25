// --- CONFIGURATION & UTILITIES ---
// KR - NAVER data, US, MKT - YAHOO data

const DEFAULT_WATCHLISTS = {
    indicators: { title: '📈 MKT', tickers: ['KRW=X', '^KS11', '^KQ11', '^IXIC', '^DJI', '^GSPC', 'BTC-USD'] },
    kr: { title: '🇰🇷 KR', tickers: ['005930', '000660', '373220', '005380', '035420'] },            
    us: { title: '🇺🇸 US', tickers: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META'] }
};

const YAHOO_FINANCE_PROXY_URL = "https://script.google.com/macros/s/AKfycbxzBxcv3llVtcWyWoldEHkpyNBgWSn0D2_j_SYLEf6r-a4zMZ4VpOE6cxtwPQw_wvKt6Q/exec";
const NAVER_FINANCE_PROXY_URL = "https://script.google.com/macros/s/AKfycbyXf76mrHHn3F5_ZEO8i813IyPv3e24f7K8B7N16cKNfZo1D5seaeUBOhtsyK_ciuBwjQ/exec"; 
const TREND_CHART_GAS_PROXY_URL = "https://script.google.com/macros/s/AKfycby4YZ1sOdQPfde-nrzAN0vUjhRP1Phn9C1ppFY2m8YHywGz-7GhNcHLU19PFCLeqm3u/exec";
const NEWS_GAS_PROXY_URL = "https://script.google.com/macros/s/AKfycbwMythtWEujVqeRH992u_XFFnluWkxJKOC6HvHyu52UYCVpxffqxOIxaiMqsR94Pe86/exec"; 
const KNIGHT_GAS_PROXY_URL = "https://script.google.com/macros/s/AKfycbxNL4-6PqMSqylMQBP0CdqSKS0LYEK7Yn7tbFtiuIfbKlQGcAanznYX85r0CpxQ8J1f_Q/exec";

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
const TRASH_ICON = `<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`;
const CHEVRON_ICON = `<svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>`;
const SEARCH_ICON = `<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
const PLUS_ICON = `<svg class="icon-svg" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
const SPINNER_SVG = `<svg class="spinner" viewBox="0 0 50 50"><circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle></svg>`;
const EMPTY_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="21"/></svg>`;

let localTickerDB = [];
let trendChartInstance = null;
let tabScrollCache = { dashboard: 0, news: 0 };
let currentTrendMarketType = localStorage.getItem('marketdash_trend_tab') || 'ALL'; 

let state = {
    watchlists: JSON.parse(localStorage.getItem('marketdash_watchlists')) || JSON.parse(JSON.stringify(DEFAULT_WATCHLISTS)),
    sectionOrder: JSON.parse(localStorage.getItem('marketdash_sectionOrder')) || ['indicators', 'kr', 'us'],
    expanded: JSON.parse(localStorage.getItem('marketdash_expanded')) || { indicators: true, kr: true, us: true },
    theme: localStorage.getItem('marketdash_theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
    countdown: 60,
    intervalId: null,
    lastNewsFetch: 0 
};

const rowNodes = new Map(); 
let sortables = []; 
function getSafeId(ticker) { return 'id_' + ticker.replace(/[^a-zA-Z0-9]/g, '_'); }

// --- INITIALIZATION ---
async function init() {
    applyTheme(); 
    if (!state.sectionOrder || state.sectionOrder.length === 0) state.sectionOrder = Object.keys(state.watchlists);

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
        const lastFetchStr = localStorage.getItem('marketdash_last_fetch_time');
        const lastFetch = lastFetchStr ? parseInt(lastFetchStr, 10) : 0;
        const diffSec = Math.floor((Date.now() - lastFetch) / 1000);

        if (diffSec >= 60) {
            // 1. 60초가 지났다면 정상적으로 새로고침
            forceRefresh();
        } else {
            // 2. 60초 이내라면 백그라운드에서 흘러간 시간만큼 타이머만 교정 (데이터 호출 X)
            state.countdown = 60 - diffSec;
            updateTimerUI(state.countdown);
        }
    }
});
    await initTickerDB(); 
    renderLayout(); 

    const savedTab = localStorage.getItem('marketdash_active_tab');
    if (savedTab === 'news') {
        document.body.classList.add('show-news');
        const tabNewsBtn = document.getElementById('tab-btn-news');
        if (tabNewsBtn) tabNewsBtn.classList.add('active');
    }

    // --- 60초 캐싱 로직 적용 ---
    const lastFetchStr = localStorage.getItem('marketdash_last_fetch_time');
    const lastFetch = lastFetchStr ? parseInt(lastFetchStr, 10) : 0;
    const diffSec = Math.floor((Date.now() - lastFetch) / 1000);

    if (diffSec >= 0 && diffSec < 60) {
        try {
            const cachedQuotes = JSON.parse(localStorage.getItem('marketdash_quotes_cache')) || {};
            const quotesArray = Object.values(cachedQuotes);
            if (quotesArray.length > 0) updateDOMWithData(quotesArray);
        } catch(e) {}
        
        state.countdown = 60 - diffSec;
        updateTimerUI(state.countdown);
        startTimer();
        
        const allMarkets = ['ALL', 'KOSPI', 'KOSDAQ'];
        allMarkets.forEach(m => fetchMarketTrend(m, m !== currentTrendMarketType));
        
        if ((Date.now() - state.lastNewsFetch) > 60000) fetchNews();
        
    } else {
        forceRefresh(); 
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
        if (!e.target.closest('#trend-chart-wrapper')) {
            if (typeof window.hideChartTooltip === 'function') window.hideChartTooltip();
        }
    });

    document.addEventListener('touchstart', (e) => {
        if (!e.target.closest('#trend-chart-wrapper')) {
            if (typeof window.hideChartTooltip === 'function') window.hideChartTooltip();
        }
    }, { passive: true });
}

function processTickerDB(data) {
    return data.map(q => ({
        ...q, cs_s: getChosung(q.s || '').toLowerCase(), cs_n: getChosung(q.n || '').toLowerCase()
    }));
}

async function initTickerDB() {
    try {
        const response = await fetch(`./f2/tickers_n.json?v=${new Date().getTime()}`);
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

window.switchMobileTab = function(tabName) {
    const currentTab = document.body.classList.contains('show-news') ? 'news' : 'dashboard';
    tabScrollCache[currentTab] = window.scrollY;

    localStorage.setItem('marketdash_active_tab', tabName);

    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(btn => btn.classList.remove('active'));
    
    if(tabName === 'news') {
        document.body.classList.add('show-news');
        const tabNewsBtn = document.getElementById('tab-btn-news');
        if (tabNewsBtn) tabNewsBtn.classList.add('active');
        
        const container = document.getElementById('news-container');
        const isStale = (Date.now() - state.lastNewsFetch) > 60000;
        const isEmpty = !container || container.children.length === 0 || container.querySelector('.empty-state');
        
        if (isStale || isEmpty) {
            fetchNews(); 
        }
    } else {
        document.body.classList.remove('show-news');
        const tabDashBtn = document.getElementById('tab-btn-dashboard');
        if (tabDashBtn) tabDashBtn.classList.add('active');
    }

    setTimeout(() => {
        window.scrollTo(0, tabScrollCache[tabName] || 0);
    }, 10);
}

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
            ? "Please choose a ticker from the search list only." 
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
                                <th class="hide-mobile col-range">Day Range</th>
                                <th class="hide-mobile col-vol">Volume</th>
                                <th class="hide-mobile col-cap">Market Cap</th>
                                <th class="hide-mobile actions-col"></th>
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
    
    if (!query || query.trim() === '') {
        if(list) list.style.display = 'none'; 
        if(guide) guide.style.display = 'none'; 
        return;
    }
    
    query = query.trim().toLowerCase();
    
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
            <td class="hide-mobile sub-data" id="range-${sid}">-</td>
            <td class="hide-mobile sub-data" id="vol-${sid}">-</td>
            <td class="hide-mobile sub-data" id="cap-${sid}">-</td>
            <td class="hide-mobile actions-col"><button class="action-icon-btn danger" onclick="confirmRemoveTicker('${safeTicker}')">${TRASH_ICON}</button></td>
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
    const targetUrl = `${YAHOO_FINANCE_PROXY_URL}?symbols=${encodeURIComponent(symbolsStr)}&t=${Date.now()}`;

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
    const targetUrl = `${NAVER_FINANCE_PROXY_URL}?symbols=${encodeURIComponent(symbolsStr)}&t=${Date.now()}`;

    try {
        const text = await fetchWithRetry(targetUrl);
        if (text.trim().startsWith('<')) throw new Error("Naver GAS proxy permission denied.");
        const data = JSON.parse(text);
        if (data && data.quoteResponse && data.quoteResponse.result) return data.quoteResponse.result;
        else if (data && data.error) throw new Error(data.error);
        throw new Error("Invalid data structure from Naver proxy.");
    } catch (e) { console.error("Failed to fetch Naver data:", e); throw e; }
}

async function fetchAndProcessKnight() {
    try {
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const kstTime = new Date(utc + (9 * 3600000));
        const timeNum = kstTime.getHours() * 100 + kstTime.getMinutes();
        
        const day = kstTime.getDay();
        const isEveningOpen = (day >= 1 && day <= 5) && (timeNum >= 1800);
        const isMorningOpen = (day >= 2 && day <= 6) && (timeNum <= 530);
        const isNightSession = isEveningOpen || isMorningOpen;

        const intervalMs = isNightSession ? (15 * 60 * 1000) : (120 * 60 * 1000);

        const lastFetchTime = parseInt(localStorage.getItem('knight_last_fetch_time') || '0', 10);
        const cachedDataStr = localStorage.getItem('knight_cached_data');

        if (Date.now() - lastFetchTime < intervalMs && cachedDataStr) {
            const cachedData = JSON.parse(cachedDataStr);
            cachedData.marketState = isNightSession ? "REGULAR" : "CLOSED";
            updateDOMWithData([cachedData]); 
            return; 
        }

        const url = `${KNIGHT_GAS_PROXY_URL}?t=${Date.now()}`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (data && data.quoteResponse && data.quoteResponse.result && data.quoteResponse.result.length > 0) {
            const resultData = data.quoteResponse.result[0];
            resultData.marketState = isNightSession ? "REGULAR" : "CLOSED";
            
            localStorage.setItem('knight_cached_data', JSON.stringify(resultData));
            localStorage.setItem('knight_last_fetch_time', Date.now().toString());

            updateDOMWithData([resultData]); 
        }
    } catch(e) {
        console.error("KNIGHT 야간선물 크롤링 에러:", e);
        
        const fallbackDataStr = localStorage.getItem('knight_cached_data');
        if (fallbackDataStr) {
            const fallbackData = JSON.parse(fallbackDataStr);
            fallbackData.marketState = "CLOSED_H"; 
            updateDOMWithData([fallbackData]);
        }
    }
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
        let fetchFunc = fetchYahooFinance;
        if (sectionId === 'kr') fetchFunc = fetchNaverFinance;

        let data = [];

        if (ticker === 'KNIGHT') {
            const url = `${KNIGHT_GAS_PROXY_URL}?t=${Date.now()}`;
            const res = await fetch(url);
            const knightData = await res.json();
            if (knightData && knightData.quoteResponse && knightData.quoteResponse.result) {
                data = knightData.quoteResponse.result;
                
                const now = new Date();
                const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
                const kstTime = new Date(utc + (9 * 3600000));
                const timeNum = kstTime.getHours() * 100 + kstTime.getMinutes();
                
                const day = kstTime.getDay();
                const isEveningOpen = (day >= 1 && day <= 5) && (timeNum >= 1800);
                const isMorningOpen = (day >= 2 && day <= 6) && (timeNum <= 530);
                const isNightSession = isEveningOpen || isMorningOpen;
                
                data[0].marketState = isNightSession ? "REGULAR" : "CLOSED";
            }
        } else {
            data = await fetchFunc([ticker]);
        }
        
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
function toggleThemeDropdown() { 
    state.theme = state.theme === 'dark' ? 'light' : 'dark'; 
    localStorage.setItem('marketdash_theme', state.theme); 
    applyTheme(); 
    toggleSettingsMenu(); 
    if (trendChartInstance) fetchMarketTrend(); 
}
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

async function fetchData() {
    localStorage.setItem('marketdash_last_fetch_time', Date.now().toString());
    const fetchPromises = []; 

    // 🕒 1. 현재 한국 시간(KST) 및 주말 여부 계산
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const kstTime = new Date(utc + (9 * 3600000));
    const day = kstTime.getDay();
    const timeNum = kstTime.getHours() * 100 + kstTime.getMinutes();
    
    // 토요일(6), 일요일(0)이거나 평일 오후 8시(2000) 이후 ~ 다음날 오전 8시(800) 이전인 경우
    const isKrMarketClosedCompletely = (day === 0 || day === 6) || (timeNum > 2000 || timeNum < 800);

    for (const sectionId of state.sectionOrder) {
        if (!state.expanded[sectionId]) continue;
        let symbols = state.watchlists[sectionId].tickers;
        if (symbols.length === 0) continue;

        // 2. 야간 선물(KNIGHT)은 밤에 작동해야 하므로 먼저 처리 후 symbols에서 제외
        if (symbols.includes('KNIGHT')) {
            fetchAndProcessKnight(); 
            symbols = symbols.filter(sym => sym !== 'KNIGHT'); 
        }

        if (symbols.length === 0) continue;

        // 🚀 3. KR 섹션 일반 종목 최적화 필터
        // 주식 시장이 아예 닫힌 시간대이고, 이미 로컬 스토리지에 캐시 데이터가 존재한다면 통신 패스!
        if (sectionId === 'kr' && isKrMarketClosedCompletely) {
            try {
                const cachedQuotes = JSON.parse(localStorage.getItem('marketdash_quotes_cache')) || {};
                const hasAllCache = symbols.every(sym => cachedQuotes[sym]);
                
                if (hasAllCache) {
                    // 이미 전일 최종 데이터가 로컬에 있으므로 네트워크 요청을 생략하고 넘어갑니다.
                    continue; 
                }
            } catch(e) {}
        }

        // 4. 나머지 활성화된 마켓 및 시간대 분기 처리 (기존 로직 동일)
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
function updateTimerUI(seconds) {
    const pie = document.getElementById('timer-pie');
    if (pie) {
        const maxOffset = 31.4159;
        const pct = seconds / 60; 
        const offset = pct * maxOffset; 
        pie.style.strokeDashoffset = offset;
    }
}

// --- 전체 데이터 새로고침 함수 ---
function forceRefresh() { 
    if (typeof window.hideChartTooltip === 'function') window.hideChartTooltip(); 
    state.countdown = 60; 
    updateTimerUI(state.countdown); 
    localStorage.setItem('marketdash_last_fetch_time', '0'); 
    state.lastNewsFetch = 0; 
    fetchData(); 
    
    // 백그라운드 포함 3개 탭 모두 동시 최신화
    const allMarkets = ['ALL', 'KOSPI', 'KOSDAQ'];
    allMarkets.forEach(market => {
        const isBackground = (market !== currentTrendMarketType);
        fetchMarketTrend(market, isBackground);
    });

    startTimer(); 
}

function startTimer() {
    if (state.intervalId) clearInterval(state.intervalId);
    state.intervalId = setInterval(() => {
        
        // 👉 화면을 안 보고 있을 때는 타이머를 완전히 일시 정지시킵니다.
        if (document.hidden) return; 

        state.countdown--;
        if (state.countdown <= 0) forceRefresh(); 
        else updateTimerUI(state.countdown); 
    }, 1000);
}

function updateDOMWithData(quotes) {
    requestAnimationFrame(() => {
        // 1. 기존 캐시 데이터 불러오기
        let cachedQuotes = {};
        try { cachedQuotes = JSON.parse(localStorage.getItem('marketdash_quotes_cache')) || {}; } catch(e) {}

        // 2. KR 종목 전일 장마감 데이터 보존 처리
        quotes.forEach(quote => {
            const ticker = quote.symbol;
            const dbMatch = localTickerDB.find(q => q.s.toUpperCase() === ticker.toUpperCase());
            const isKR = dbMatch ? (dbMatch.e === 'NAVER') : /^\d/.test(ticker);

            if (isKR) {
                const cached = cachedQuotes[ticker];
                
                // 아직 당일 거래량이 발생하지 않은 상태(0 또는 undefined)일 때
                if (cached && (!quote.regularMarketVolume || quote.regularMarketVolume === 0)) {
                    // 네이버 API가 변동값을 0으로 리셋해서 보냈다면, 캐시된 전일 최종 데이터를 그대로 사용
                    if (quote.regularMarketChange === 0) {
                        quote.regularMarketChange = cached.regularMarketChange || 0;
                        quote.regularMarketChangePercent = cached.regularMarketChangePercent || 0;
                    }
                }
            }
            
            // 보정된 데이터로 캐시 객체 업데이트
            cachedQuotes[ticker] = quote;
        });

        // 3. 보정된 최신 상태를 로컬 스토리지에 저장
        localStorage.setItem('marketdash_quotes_cache', JSON.stringify(cachedQuotes));

        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const kstTime = new Date(utc + (9 * 3600000));
        const timeNum = kstTime.getHours() * 100 + kstTime.getMinutes();

        quotes.forEach(quote => {
            const ticker = quote.symbol; 
            const nodes = rowNodes.get(ticker);
            if (!nodes || !nodes.row) return;

            const dbMatch = localTickerDB.find(q => q.s.toUpperCase() === ticker.toUpperCase());
            const isKR = dbMatch ? (dbMatch.e === 'NAVER') : /^\d/.test(ticker);

            const regPrice = quote.regularMarketPrice || 0; 
            const regChange = quote.regularMarketChange || 0;
            const regPct = quote.regularMarketChangePercent || 0; 

            let preData = null;
            if (quote.preMarketPrice !== undefined && quote.preMarketPrice !== null) {
                const change = quote.preMarketPrice - regPrice;
                const pct = regPrice ? (change / regPrice * 100) : 0;
                const vol = quote.preMarketVolume || 0; 
                preData = { price: quote.preMarketPrice, change: change, pct: pct, label: 'pre', time: quote.preMarketTime || 0, volume: vol };
            }

            let postData = null;
            if (quote.postMarketPrice !== undefined && quote.postMarketPrice !== null) {
                const change = quote.postMarketPrice - regPrice;
                const pct = regPrice ? (change / regPrice * 100) : 0;
                const vol = quote.postMarketVolume || 0;
                postData = { price: quote.postMarketPrice, change: change, pct: pct, label: 'post', time: quote.postMarketTime || 0, volume: vol };
            }

            const regTime = quote.regularMarketTime || 0;
            const preTime = preData ? preData.time : 0;
            const postTime = postData ? postData.time : 0;
            
            let targetState = 'REGULAR';
            const mState = (quote.marketState || '').toUpperCase();

            if (mState.includes('PRE') && preData) {
                targetState = 'PRE';
            } else if (mState.includes('POST') && postData) {
                targetState = 'POST';
            } else if (mState === 'CLOSED') {
                if (preData && postData) targetState = preTime > postTime ? 'PRE' : 'POST';
                else if (postData) targetState = 'POST';
                else if (preData) targetState = 'PRE';
            } else {
                const maxTime = Math.max(regTime, preTime, postTime);
                if (maxTime > 0) {
                    if (maxTime === postTime && postTime > regTime && postData) {
                        targetState = 'POST';
                    } else if (maxTime === preTime && preTime > regTime && preData) {
                        targetState = 'PRE';
                    }
                }
            }

            if (targetState === 'PRE') {
                if (isKR) {
                    if (!preData || preData.volume === 0) targetState = 'CLOSED_H';
                } else {
                    if (!preData || Math.abs(preData.price - regPrice) === 0) targetState = 'CLOSED_H';
                }
            } else if (targetState === 'POST') {
                if (isKR) {
                    if (!postData || postData.volume === 0) targetState = 'CLOSED_H';
                } else {
                    if (!postData || Math.abs(postData.price - regPrice) === 0) targetState = 'CLOSED_H';
                }
            } else {
                const qType = (quote.quoteType || '').toUpperCase();
                const isCrypto = qType === 'CRYPTOCURRENCY' || ticker.includes('-');
                const isFXorFuture = qType === 'CURRENCY' || qType === 'FUTURE' || ticker.endsWith('=X') || ticker.endsWith('=F');
                const isIndex = qType === 'INDEX' || ticker.startsWith('^');

                if (isCrypto) {
                    targetState = 'REGULAR';
                } else if (isFXorFuture || isIndex) {
                    // --- 지수/환율/선물 타임스탬프 팩트체크 로직 적용 ---
                    const nowSec = Math.floor(Date.now() / 1000);
                    if ((nowSec - regTime) > 900) {
                        targetState = 'CLOSED_H'; 
                    } else {
                        targetState = 'REGULAR'; 
                    }
                } else {
                    if (mState === 'CLOSED' || mState.includes('POST') || mState.includes('PRE')) {
                        targetState = 'CLOSED_H';
                    }
                }
            }
 
            let isExtLive = false;
            
            if (isKR) {
                if (kstTime.getDay() !== 0 && kstTime.getDay() !== 6) { 
                    if (targetState === 'PRE' && timeNum >= 800 && timeNum < 900) {
                        isExtLive = true;
                    } else if (targetState === 'POST' && timeNum >= 1530 && timeNum <= 2000) {
                        isExtLive = true;
                    }
                }
            } else {
                if (targetState === 'PRE' && mState === 'PRE') {
                    isExtLive = true;
                } else if (targetState === 'POST' && mState === 'POST') {
                    isExtLive = true;
                }
            }

            let mainPrice = regPrice;
            let mainChange = regChange;
            let mainPct = regPct;
            let mainIcon = ''; 
            let subHtml = '';

            const liveExtStyle = isExtLive ? 'color: var(--red); font-weight: 700;' : '';

            if (targetState === 'PRE') {
                mainPrice = preData.price;
                mainChange = preData.change;
                mainPct = preData.pct;
                mainIcon = `<span class="main-ext-label" style="${liveExtStyle}">${preData.label}</span>`; 
                
                const regIsUp = regChange >= 0;
                const regColor = regIsUp ? 'up' : 'down';
                const regSign = regIsUp ? '+' : '';
                subHtml = `<span class="ext-label">closed</span>${formatNum(regPrice)} <span class="${regColor}">(${regSign}${formatPct(regPct)}%)</span>`;
                
            } else if (targetState === 'POST') {
                mainPrice = postData.price;
                mainChange = postData.change;
                mainPct = postData.pct;
                mainIcon = `<span class="main-ext-label" style="${liveExtStyle}">${postData.label}</span>`; 
                
                const regIsUp = regChange >= 0;
                const regColor = regIsUp ? 'up' : 'down';
                const regSign = regIsUp ? '+' : '';
                subHtml = `<span class="ext-label">closed</span>${formatNum(regPrice)} <span class="${regColor}">(${regSign}${formatPct(regPct)}%)</span>`;
                
            } else if (targetState === 'CLOSED_H') {
                mainPrice = regPrice;
                mainChange = regChange;
                mainPct = regPct;
                mainIcon = `<span class="main-ext-label">closed</span>`;
                subHtml = '';
            } else {
                mainPrice = regPrice;
                mainChange = regChange;
                mainPct = regPct;
                mainIcon = ''; 
                
                if (preData) {
                    const preIsUp = preData.change >= 0;
                    const preColor = preIsUp ? 'up' : 'down';
                    const preSign = preIsUp ? '+' : '';
                    subHtml = `<span class="ext-label">${preData.label}</span>${formatNum(preData.price)} <span class="${preColor}">(${preSign}${formatPct(preData.pct)}%)</span>`;
                }
            }

            const isUp = mainChange >= 0;
            const colorClass = isUp ? 'up' : 'down'; 
            const sign = isUp ? '+' : '-'; 
            const arrow = isUp ? '▲' : '▼';
            
            const oldPriceStr = nodes.price.getAttribute('data-price');
            const oldPrice = oldPriceStr ? parseFloat(oldPriceStr) : null;
            if (oldPrice !== null && oldPrice !== mainPrice) {
                nodes.row.classList.remove('flash-up', 'flash-down');
                setTimeout(() => {
                    if (nodes && nodes.row) {
                        nodes.row.classList.add(mainPrice > oldPrice ? 'flash-up' : 'flash-down');
                    }
                }, 10);
            }
            
            nodes.price.setAttribute('data-price', mainPrice);
            
            const dbInfo = localTickerDB.find(q => q.s.toUpperCase() === ticker.toUpperCase());
            nodes.name.textContent = (dbInfo ? dbInfo.n : null) || quote.shortName || quote.longName || ticker;
            
            nodes.price.innerHTML = mainIcon + formatNum(mainPrice);
            nodes.extPrice.innerHTML = subHtml;
            
            nodes.change.innerHTML = `<span class="${colorClass}">${sign}${formatChangeNum(mainChange)}</span>`;
            nodes.pct.innerHTML = `<span class="badge ${colorClass}"><span class="arrow">${arrow}</span>${formatPct(Math.abs(mainPct))}%</span>`;
            
            nodes.vol.textContent = (quote.regularMarketVolume && quote.regularMarketVolume > 0) ? formatCompact(quote.regularMarketVolume) : '-'; 
            nodes.cap.textContent = formatCompact(quote.marketCap);
            
            if (quote.regularMarketDayLow && quote.regularMarketDayHigh) {
                const low = formatNum(quote.regularMarketDayLow);
                const high = formatNum(quote.regularMarketDayHigh);
                nodes.range.innerHTML = `${low} <span style="opacity: 0.5; margin: 0 2px;">-</span> ${high}`;
            } else {
                nodes.range.innerHTML = '-';
            }
        });
    });
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
    let result = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
    
    if (result.endsWith('.00')) {
        return result.slice(0, -3); 
    }
    
    if (result.includes('.')) {
        const parts = result.split('.');
        return `${parts[0]}<span class="decimal">.${parts[1]}</span>`;
    }
    
    return result;
}

function formatChangeNum(num) {
    if (num === undefined || num === null || isNaN(num)) return '-';
    let result = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(num));
    
    if (result.endsWith('.00')) {
        return result.slice(0, -3);
    }
    
    return result;
}

function formatPct(num) {
    if (num === undefined || num === null || isNaN(num)) return '-';
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
}
function formatCompact(num) {
    if (!num || isNaN(num)) return '-';
    return new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short', maximumFractionDigits: 2 }).format(num);
}

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

// --- 백그라운드 갱신 로직이 포함된 차트 렌더 함수 ---
async function fetchMarketTrend(marketType = currentTrendMarketType, isBackground = false) {
    if (!isBackground) {
        const tabs = document.querySelectorAll('.trend-tab-btn');
        if (tabs.length > 0) {
            tabs.forEach(btn => btn.classList.remove('active'));
            const activeTab = Array.from(tabs).find(btn => btn.getAttribute('onclick').includes(marketType));
            if (activeTab) activeTab.classList.add('active');
        }

        if (currentTrendMarketType !== marketType && trendChartInstance) {
            trendChartInstance.destroy();
            trendChartInstance = null;
        }

        currentTrendMarketType = marketType;
        localStorage.setItem('marketdash_trend_tab', currentTrendMarketType);
    }

    const container = document.getElementById('trend-chart-wrapper');
    if (!container) return;

    const chartLoader = document.getElementById('chart-loading-overlay');

    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const kstTime = new Date(utc + (9 * 3600000));
    
    const isWeekend = (kstTime.getDay() === 0 || kstTime.getDay() === 6);
    const timeNum = kstTime.getHours() * 100 + kstTime.getMinutes();
    
    const isMarketOpen = !isWeekend && (timeNum >= 900 && timeNum <= 1610);
    
    const cacheKey = `market_trend_last_known_${marketType}`;
    let cached = null;
    try { 
        cached = JSON.parse(localStorage.getItem(cacheKey)); 
    } catch(e) { console.warn("Trend cache parse error"); }

    const kstOptions = { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' };
    const todayStr = new Intl.DateTimeFormat('ko-KR', kstOptions).format(kstTime).replace(/\s/g, ''); 

    let needsFetch = true;

    if (cached && cached.data) {
        const hasFinalDataCache = cached.data.some(d => {
            const t = parseInt(d.time.substring(0, 4), 10);
            return t >= 1600;
        });
        const isCacheToday = (cached.dateStr === todayStr);
        const cacheAgeMs = Date.now() - (cached.lastFetchTime || 0);

        const isLiveCache = isCacheToday && isMarketOpen && !hasFinalDataCache;
        
        if (currentTrendMarketType === marketType) {
            renderTrendChart(cached.data, cached.dateStr || todayStr, isLiveCache);
        }

        if (isMarketOpen) {
            if (cacheAgeMs < 60000) needsFetch = false;
        } else {
            if (hasFinalDataCache) {
                if (isCacheToday || timeNum < 900 || isWeekend) {
                    needsFetch = false;
                }
            } else {
                needsFetch = true;
            }
        }
    }

    if (!needsFetch) {
        if (!isBackground && chartLoader) chartLoader.style.display = 'none';
        return;
    }

    if (!isBackground && chartLoader && !trendChartInstance) {
        chartLoader.style.display = 'flex';
    }

    try {
        const url = `${TREND_CHART_GAS_PROXY_URL}?tradeType=KRX&marketType=${marketType}&t=${Date.now()}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("Trend fetch failed");
        
        const json = await response.json();
        
        if (json.success && json.data && Array.isArray(json.data.content)) {
            const data = json.data.content;

            if (data.length === 0) return;

            let actualDateStr = todayStr; 
            const apiDate = json.data.bizdate || json.data.bizDate || json.data.businessDate;
            
            if (apiDate && typeof apiDate === 'string' && apiDate.length >= 8) {
                const y = apiDate.substring(0, 4);
                const m = apiDate.substring(4, 6);
                const d = apiDate.substring(6, 8);
                actualDateStr = `${y}.${m}.${d}.`;
            } else if (data[0] && data[0].date) {
                const dStr = String(data[0].date);
                if (dStr.length >= 8) {
                    actualDateStr = `${dStr.substring(0,4)}.${dStr.substring(4,6)}.${dStr.substring(6,8)}.`;
                }
            }

            const hasFinalData = data.some(d => {
                const t = parseInt(d.time.substring(0, 4), 10);
                return t >= 1600;
            });
            
            const isLiveAPI = (actualDateStr === todayStr) && isMarketOpen && !hasFinalData;

            localStorage.setItem(cacheKey, JSON.stringify({
                dateStr: actualDateStr,
                data: data,
                lastFetchTime: Date.now() 
            }));

            if (currentTrendMarketType === marketType) {
                renderTrendChart(data, actualDateStr, isLiveAPI);
            }

        } else {
            throw new Error("Invalid trend data structure");
        }
    } catch (error) {
        console.error(`Trend Chart Error (${marketType}):`, error);
        if (!cached && currentTrendMarketType === marketType) {
            container.innerHTML = '<div class="empty-state"><p class="error-text">Failed to load trend data.</p></div>';
        }
    } finally {
        if (!isBackground && chartLoader) chartLoader.style.display = 'none';
    }
}

function renderTrendChart(dataList, dateStr = "", isLive = false) {
    const canvas = document.getElementById('trend-chart-canvas');
    if (!canvas) return;

    let badgeContainer = document.getElementById('trend-date-badge');
    if (!badgeContainer) {
        badgeContainer = document.createElement('div');
        badgeContainer.id = 'trend-date-badge';
        badgeContainer.style.position = 'absolute';
        badgeContainer.style.right = '0';
        badgeContainer.style.bottom = '0'; 
        badgeContainer.style.display = 'flex';
        badgeContainer.style.alignItems = 'center'; 
        badgeContainer.style.gap = '4px';
        badgeContainer.style.zIndex = '10';
        
        const wrapper = document.getElementById('trend-chart-wrapper');
        if(wrapper) wrapper.appendChild(badgeContainer);
    }
    
    const badgeText = isLive ? 'LIVE' : 'CLOSED';
    const liveStyle = isLive ? 'color: var(--red);' : '';
    
    badgeContainer.innerHTML = `
        <span class="main-ext-label" style="margin: 0; font-size: 0.4rem; padding: 0.15rem 0.35rem; line-height: 1; transform: none; display: block; ${liveStyle}">${badgeText}</span>
        <span style="font-size: 0.7rem; font-weight: 600; color: var(--text-secondary); font-family: 'Inter', sans-serif; line-height: 1; display: block; transform: none;">${dateStr}</span>
    `;

    const sortedData = dataList.slice().reverse();
    
    const fixedLabels = [];
    for (let h = 9; h <= 16; h++) {
        for (let m = 0; m < 60; m += 5) {
            if (h === 16 && m > 0) continue;
            fixedLabels.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        }
    }

    const individualData = new Array(fixedLabels.length).fill(null);
    const foreignData = new Array(fixedLabels.length).fill(null);
    const institutionData = new Array(fixedLabels.length).fill(null);

    const instCodes = ['1000', '2000', '3000', '3100', '4000', '5000', '6000'];
    let maxDataIndex = -1;

    sortedData.forEach(d => {
        const t = d.time;
        if (!t || t.length < 4) return;

        const hh = parseInt(t.substring(0, 2), 10);
        const mm = parseInt(t.substring(2, 4), 10);
        const timeVal = hh * 100 + mm;

        if (timeVal >= 900 && timeVal <= 1610) {
            let label;
            if (timeVal >= 1600) {
                label = "16:00";
            } else {
                const bucketMm = Math.floor(mm / 5) * 5;
                label = `${String(hh).padStart(2, '0')}:${String(bucketMm).padStart(2, '0')}`;
            }

            const labelIdx = fixedLabels.indexOf(label);
            if (labelIdx !== -1) {
                let ind = 0, forgn = 0, inst = 0;
                if (Array.isArray(d.netAmounts)) {
                    d.netAmounts.forEach(item => {
                        const val = (parseFloat(item.diffValue) || 0) / 100000000;
                        if (item.investorGubun === '8000') ind = val;
                        else if (item.investorGubun === '9000') forgn = val;
                        else if (instCodes.includes(item.investorGubun)) inst += val;
                    });
                }

                individualData[labelIdx] = ind;
                foreignData[labelIdx] = forgn;
                institutionData[labelIdx] = inst;

                if (labelIdx > maxDataIndex) maxDataIndex = labelIdx;
            }
        }
    });

    let lastInd = 0, lastForgn = 0, lastInst = 0;
    for (let i = 0; i <= maxDataIndex; i++) {
        if (individualData[i] === null) {
            individualData[i] = lastInd;
            foreignData[i] = lastForgn;
            institutionData[i] = lastInst;
        } else {
            lastInd = individualData[i];
            lastForgn = foreignData[i];
            lastInst = institutionData[i];
        }
    }

    if (trendChartInstance) {
        trendChartInstance.data.datasets[0].data = individualData;
        trendChartInstance.data.datasets[1].data = foreignData;
        trendChartInstance.data.datasets[2].data = institutionData;
        trendChartInstance.update('none'); 
        return;
    }

    const ctx = canvas.getContext('2d');
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    
    const textPrimary = isDark ? '#e3e3e3' : '#18191a';
    const textSecondary = isDark ? '#a0a4a8' : '#5f6368';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';
    const tooltipBg = isDark ? 'rgba(30, 30, 30, 0.8)' : 'rgba(255, 255, 255, 0.8)';
    const tooltipBorder = isDark ? '#2b2b2b' : '#e2e6eb';

    const redColor = isDark ? '#ff453a' : '#eb0f29';
    const greenColor = isDark ? '#00c853' : '#00873c';
    const instColor = '#f5a623';

    const createGradient = (colorHex, r, g, b) => {
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.25)`);
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.0)`);
        return gradient;
    };

    trendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: fixedLabels,
            datasets: [
                { 
                    label: '개인', data: individualData, borderColor: redColor, 
                    backgroundColor: createGradient(redColor, isDark ? 255 : 235, isDark ? 69 : 15, isDark ? 58 : 41),
                    borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5, fill: true, tension: 0.4 
                },
                { 
                    label: '외국인', data: foreignData, borderColor: greenColor, 
                    backgroundColor: createGradient(greenColor, isDark ? 0 : 0, isDark ? 200 : 135, isDark ? 83 : 60),
                    borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5, fill: true, tension: 0.4 
                },
                { 
                    label: '기관', data: institutionData, borderColor: instColor, 
                    backgroundColor: createGradient(instColor, 245, 166, 35),
                    borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5, fill: true, tension: 0.4 
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            layout: {
                padding: { left: 0, right: 10 , top: 0, bottom: 22 }
            },
            plugins: {
                title: { display: false }, 
                legend: { 
                    position: 'top',
                    align: 'end', 
                    padding: 15, 
                    labels: { 
                        color: textSecondary, 
                        font: { family: "'Inter', sans-serif", size: 12, weight: 600 },
                        usePointStyle: false, boxWidth: 12, boxHeight: 4,
                        useBorderRadius: true, borderRadius: 2, padding: 15,
                        generateLabels: function(chart) {
                            const datasets = chart.data.datasets;
                            return datasets.map((dataset, i) => ({
                                text: dataset.label,
                                fillStyle: dataset.borderColor,
                                strokeStyle: 'transparent',
                                lineWidth: 0,
                                hidden: !chart.isDatasetVisible(i),
                                index: i,
                                datasetIndex: i,
                                borderRadius: 2,
                                fontColor: textSecondary 
                            }));
                        }
                    } 
                },
                tooltip: {
                    enabled: false,
                    position: 'nearest',
                    external: function(context) {
                        let tooltipEl = document.getElementById('chartjs-custom-tooltip');

                        if (!tooltipEl) {
                            tooltipEl = document.createElement('div');
                            tooltipEl.id = 'chartjs-custom-tooltip';
                            tooltipEl.style.background = tooltipBg;
                            tooltipEl.style.borderRadius = '8px';
                            tooltipEl.style.border = `1px solid ${tooltipBorder}`;
                            tooltipEl.style.pointerEvents = 'none';
                            tooltipEl.style.position = 'absolute';
                            tooltipEl.style.transition = 'all .08s ease'; 
                            tooltipEl.style.padding = '12px';
                            tooltipEl.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05)';
                            tooltipEl.style.zIndex = 90;
                            tooltipEl.style.whiteSpace = 'nowrap';
                            // --- 하드웨어 가속 스타일 추가 ---
                            tooltipEl.style.willChange = 'transform, opacity, left, top'; 
                            
                            context.chart.canvas.parentNode.appendChild(tooltipEl);
                            context.chart.canvas.parentNode.style.position = 'relative';
                        }

                        const tooltipModel = context.tooltip;
                        if (tooltipModel.opacity === 0) {
                            tooltipEl.style.opacity = 0;
                            return;
                        }

                        if (!tooltipModel.body || tooltipModel.dataPoints[0].parsed.y === null) {
                            tooltipEl.style.opacity = 0;
                            return;
                        }

                        if (tooltipModel.body) {
                            const titleLines = tooltipModel.title || [];
                            let innerHtml = `<div style="font-family:'Inter', sans-serif;">`;

                            titleLines.forEach(function(title) {
                                innerHtml += `<div style="font-weight:700; font-size:13px; color:${textPrimary}; margin-bottom:10px;">${title}</div>`;
                            });

                            innerHtml += `<div style="display:flex; flex-direction:column; gap:8px;">`;

                            tooltipModel.dataPoints.forEach(function(dp) {
                                const val = dp.parsed.y;
                                if (val === null) return;
                                const sign = val > 0 ? '+' : '';
                                const valColor = val > 0 ? greenColor : (val < 0 ? redColor : textPrimary);
                                const formattedVal = sign + new Intl.NumberFormat('ko-KR').format(Math.round(val)) + '억';
                                const borderColor = dp.dataset.borderColor;

                                innerHtml += `
                                    <div style="display:flex; align-items:center; font-size:12px; font-weight:600; justify-content:space-between; gap: 30px;">
                                        <div style="display:flex; align-items:center;">
                                            <span style="display:inline-block; width:12px; height:4px; background:${borderColor}; margin-right:8px; border-radius:2px;"></span>
                                            <span style="color:${textSecondary};">${dp.dataset.label}</span>
                                        </div>
                                        <span style="color:${valColor}; text-align:right;">${formattedVal}</span>
                                    </div>
                                `;
                            });
                            innerHtml += `</div></div>`;
                            tooltipEl.innerHTML = innerHtml;
                        }

                        tooltipEl.style.opacity = 1;
                        tooltipEl.style.transform = 'none';
                        
                        const ttWidth = tooltipEl.offsetWidth || 150;
                        const ttHeight = tooltipEl.offsetHeight || 130;
                        const chartWidth = context.chart.width;
                        const chartHeight = context.chart.height;
                        
                        // --- 툴팁 세로 중앙(Middle) 고정 로직 적용 ---
                        let targetLeft = tooltipModel.caretX - (ttWidth / 2);
                        let targetTop = (chartHeight / 2) - (ttHeight / 2); 
                        
                        if (targetLeft < 10) targetLeft = 10;
                        else if (targetLeft + ttWidth > chartWidth - 10) targetLeft = chartWidth - ttWidth - 10;
                        
                        tooltipEl.style.left = targetLeft + 'px';
                        tooltipEl.style.top = targetTop + 'px';
                    }
                }
            },
            scales: {
                x: { 
                    grid: { display: false }, 
                    ticks: { color: textSecondary, font: { family: "'Inter', sans-serif", size: 11 }, maxTicksLimit: 7, maxRotation: 0 } 
                },
                y: { 
                    grid: { color: gridColor, drawBorder: false, borderDash: [4, 4] }, 
                    ticks: { 
                        color: textSecondary, font: { family: "'Inter', sans-serif", size: 11 }, padding: 10,
                        crossAlign: 'near', 
                        callback: function(value) {
                            return new Intl.NumberFormat('ko-KR').format(value / 1000);
                        }
                    } 
                }
            }
        }
    });
}

window.switchTrendMarket = function(marketType) {
    if (typeof window.hideChartTooltip === 'function') window.hideChartTooltip(); 
    fetchMarketTrend(marketType);
};

// --- 툴팁 및 호버 충돌 해결 로직 적용 ---
window.hideChartTooltip = function() {
    const tooltipEl = document.getElementById('chartjs-custom-tooltip');
    if (tooltipEl && tooltipEl.style.opacity === '1') {
        tooltipEl.style.opacity = '0';
        
        if (trendChartInstance) {
            try {
                trendChartInstance.setActiveElements([]); 
                trendChartInstance.tooltip.setActiveElements([], {x: 0, y: 0});
                requestAnimationFrame(() => {
                    trendChartInstance.update();
                });
            } catch(e) {}
        }
    }
};


// =========================================================
// SCROLL RESPONSIVE HEADER HIDE (가로 모드 전용)
// =========================================================
document.addEventListener('DOMContentLoaded', () => {
    let lastScrollY = window.scrollY;
    const scrollThreshold = 40; // 40px 이상 스크롤 시 작동

    function handleScroll() {
        const currentScrollY = window.scrollY;
        // style.css의 모바일 분기점(992px)과 일치시킴
        const isLandscape = window.matchMedia("(max-width: 992px) and (orientation: landscape)").matches;
        
        if (isLandscape) {
            // 아래로 스크롤 중일 때 숨김 처리
            if (currentScrollY > lastScrollY && currentScrollY > scrollThreshold) {
                document.body.classList.add('scrolled-down');
            } 
            // 위로 스크롤 하거나 최상단일 때 다시 노출
            else {
                document.body.classList.remove('scrolled-down');
            }
        } else {
            // 세로 모드일 경우 숨김 클래스 강제 제거 (버그 방지)
            document.body.classList.remove('scrolled-down');
        }
        
        lastScrollY = currentScrollY;
    }

    // 스크롤 및 화면 회전 이벤트 리스너 등록
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', () => {
        const isLandscape = window.matchMedia("(max-width: 992px) and (orientation: landscape)").matches;
        if (!isLandscape) {
            document.body.classList.remove('scrolled-down');
        }
    }, { passive: true });
});



window.addEventListener('scroll', window.hideChartTooltip, { passive: true });
window.addEventListener('resize', window.hideChartTooltip, { passive: true });

document.addEventListener('DOMContentLoaded', init);
