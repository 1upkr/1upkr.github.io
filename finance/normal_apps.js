// =========================================================
// 1. 초기 설정 및 상수 정의 (Constants & Defaults)
// =========================================================
const DEFAULT_WATCHLISTS = {
    'indicators': { 
        title: '📈 MKT', 
        tickers: ['KRW=X', '^KS11', '^KQ11', '^IXIC', '^DJI', '^GSPC', 'BTC-USD'] 
    },
    'kr': { 
        title: '🇰🇷 KR', 
        tickers: ['005930', '000660', '373220', '035720', '035420'] // 삼성전자, SK하이닉스 등
    },
    'us': { 
        title: '🇺🇸 US', 
        tickers: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META'] 
    }
};

const GAS_PROXY_URL = 'https://script.google.com/macros/s/AKfycbydYWqn3tZL25dE8UPMyN9mV19R1YKFZKpF-aml_25Z_YvA_qElw-LpxNO_Y8_sOzCV/exec';
const NAVER_GAS_PROXY_URL = 'https://script.google.com/macros/s/AKfycbygC4GrK-2abZUpWWCxD4ZVfFVzd-gjbGvyYBTWNP26J7zwkwbrWwttXNC-geENS1Nykw/exec';
const NEWS_GAS_PROXY_URL = 'https://script.google.com/macros/s/AKfycb.../exec'; // 뉴스 프록시 URL

const CHO_HANGUL = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

// SVG 아이콘 모음
const DRAG_ICON = '<svg viewBox="0 0 24 24"><line x1="6" y1="6" x2="18" y2="6"/><line x1="6" y1="10" x2="18" y2="10"/><line x1="6" y1="14" x2="18" y2="14"/><line x1="6" y1="18" x2="18" y2="18"/></svg>';
const TRASH_ICON = '<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
const CHEVRON_ICON = '<svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>';
const SEARCH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';
const PLUS_ICON = '<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
const SPINNER_SVG = '<svg class="spinner" viewBox="0 0 50 50"><circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle></svg>';
const EMPTY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>';

// =========================================================
// 2. 상태 관리 (State Management)
// =========================================================
let localTickerDB = [];
let memoryPriceCache = {};

try {
    memoryPriceCache = JSON.parse(localStorage.getItem('marketdash_price_cache')) || {};
} catch (e) {
    memoryPriceCache = {};
}

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
let targetTickerToDelete = null;

// =========================================================
// 3. 유틸리티 함수 (Utilities)
// =========================================================
function getChosung(str) {
    let result = '';
    for (let i = 0; i < str.length; i++) {
        let code = str.charCodeAt(i) - 44032;
        if (code > -1 && code < 11172) {
            result += CHO_HANGUL[Math.floor(code / 588)];
        } else {
            result += str.charAt(i);
        }
    }
    return result;
}

function escapeHTML(str) {
    if (typeof str !== 'string') return str;
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' };
    return str.replace(/[&<>'"]/g, m => map[m]);
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function getSafeId(str) {
    return 'id_' + str.replace(/[^a-zA-Z0-9]/g, '_');
}

const saveCacheToStorage = debounce(() => {
    try {
        localStorage.setItem('marketdash_price_cache', JSON.stringify(memoryPriceCache));
    } catch (e) {
        console.warn('Cache save failed', e);
    }
}, 2000);

// =========================================================
// 4. 초기화 및 메인 로직 (Initialization)
// =========================================================
async function init() {
    applyTheme();
    if (!state.sectionOrder || state.sectionOrder.length === 0) {
        state.sectionOrder = Object.keys(state.watchlists);
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (state.intervalId) clearInterval(state.intervalId);
        } else {
            const now = Date.now();
            const lastFetch = parseInt(localStorage.getItem('marketdash_last_fetch_time') || '0');
            if (now - lastFetch > 60000) forceRefresh();
            else startTimer();
        }
    });

    await initTickerDB();
    renderLayout();
    startTimer();

    if (Object.keys(memoryPriceCache).length > 0) {
        updateDOMWithData(Object.values(memoryPriceCache));
    }

    const lastFetchTime = parseInt(localStorage.getItem('marketdash_last_fetch_time') || '0');
    const now = Date.now();
    const activeTab = localStorage.getItem('marketdash_active_tab');

    if (activeTab === 'news') {
        const newsContainer = document.getElementById('news-container');
        const isStale = now - state.lastNewsFetch > 300000;
        const isEmpty = !newsContainer || newsContainer.children.length === 0 || newsContainer.querySelector('.empty-state');
        if (isStale || isEmpty) fetchNews();
        
        if (now - lastFetchTime < 60000) {
            state.countdown = Math.ceil(60 - (now - lastFetchTime) / 1000);
            const countdownEl = document.getElementById('countdown');
            if (countdownEl) countdownEl.textContent = state.countdown;
        } else {
            fetchData();
        }
    } else {
        if (now - lastFetchTime < 60000) {
            state.countdown = Math.ceil(60 - (now - lastFetchTime) / 1000);
            const countdownEl = document.getElementById('countdown');
            if (countdownEl) countdownEl.textContent = state.countdown;
            fetchNews();
        } else {
            fetchData();
        }
    }

    initSwipeToDelete();

    const refreshBtn = document.getElementById('btn-refresh');
    if (refreshBtn) refreshBtn.addEventListener('click', forceRefresh);

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-wrapper')) {
            document.querySelectorAll('.autocomplete-list').forEach(el => el.style.display = 'none');
            document.querySelectorAll('.input-guide').forEach(el => el.style.display = 'none');
        }
        const dropdown = document.getElementById('settings-dropdown');
        if (dropdown && !e.target.closest('.settings-wrapper')) {
            dropdown.classList.remove('active');
        }
    });
}

// =========================================================
// 5. 종목 검색 DB 처리 (Ticker DB)
// =========================================================
function processTickerDB(data) {
    return data.map(item => ({
        ...item,
        cs_s: getChosung(item.s || '').toLowerCase(),
        cs_n: getChosung(item.n || '').toLowerCase()
    }));
}

async function initTickerDB() {
    try {
        const response = await fetch('/data/tickers.json?t=' + new Date().getTime());
        if (!response.ok) throw new Error('HTTP error! status: ' + response.status);
        const data = await response.json();
        localTickerDB = processTickerDB(data);
    } catch (e) {
        console.error('Ticker DB Init Error', e);
        localTickerDB = processTickerDB([
            { s: 'AAPL', n: 'Apple Inc.', e: 'NASDAQ' },
            { s: '005930', n: '삼성전자', e: 'KOSPI' }
        ]);
    }
}

// =========================================================
// 6. UI 렌더링 (UI Rendering)
// =========================================================
function renderLayout() {
    const dashboard = document.getElementById('dashboard');
    if (!dashboard) return;
    
    dashboard.innerHTML = '';
    rowNodes.clear();
    sortables.forEach(s => s.destroy());
    sortables = [];

    const fragment = document.createDocumentFragment();

    state.sectionOrder.forEach(key => {
        const sectionData = state.watchlists[key];
        if (!sectionData) return;

        const isExpanded = state.expanded[key];
        const isEmpty = sectionData.tickers.length === 0;
        const sectionEl = document.createElement('div');
        sectionEl.className = 'section-container ' + (isExpanded ? '' : 'collapsed');
        sectionEl.id = 'section-' + key;
        sectionEl.dataset.id = key;

        const guideText = key === 'kr' ? 'Please choose a ticker from the search results only.' : 'Enter symbol or company name';

        sectionEl.innerHTML = `
            <div class="section-header">
                <div class="section-header-left" onclick="toggleSection(event, '${key}')">
                    <button class="action-icon-btn toggle-btn">${CHEVRON_ICON}</button>
                    <h2>${sectionData.title}</h2>
                </div>
                <div class="section-header-right">
                    <button class="action-icon-btn btn-add-symbol" onclick="toggleAddForm(event, '${key}')">${PLUS_ICON}</button>
                    <button class="action-icon-btn drag-handle hide-mobile">${DRAG_ICON}</button>
                </div>
            </div>
            <div class="section-body">
                <form class="add-ticker-form" id="form-${key}" onsubmit="handleAddTicker(event, '${key}')">
                    <div class="search-wrapper">
                        ${SEARCH_ICON}
                        <input type="text" id="input-${key}" placeholder="Search..." autocomplete="off">
                        <ul class="autocomplete-list" id="autocomplete-${key}"></ul>
                        <div class="input-guide" id="guide-${key}">${guideText}</div>
                    </div>
                    <button type="submit" id="btn-add-${key}">${PLUS_ICON}<span class="hide-mobile-text">Add tickers</span></button>
                </form>
                <div class="table-wrapper">
                    <div class="empty-state" id="empty-${key}" style="display: ${isEmpty ? 'flex' : 'none'};">
                        ${EMPTY_ICON}
                        <p>No tickers added.</p>
                    </div>
                    <table style="display: ${isEmpty ? 'none' : 'table'};" id="table-${key}">
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
                        <tbody id="tbody-${key}">
                            ${sectionData.tickers.map(t => generateRowHTML(t)).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        fragment.appendChild(sectionEl);
    });

    dashboard.appendChild(fragment);

    state.sectionOrder.forEach(key => {
        const sectionData = state.watchlists[key];
        if (sectionData) sectionData.tickers.forEach(t => cacheRowNodes(t));

        const inputEl = document.getElementById('input-' + key);
        if (inputEl) {
            const onInput = debounce((e) => handleAutocomplete(e.target.value, key), 200);
            inputEl.addEventListener('input', onInput);
            inputEl.addEventListener('focus', onInput);
        }
    });

    initDragAndDrop();
}

function generateRowHTML(ticker) {
    const safeId = getSafeId(ticker);
    const escapedTicker = escapeHTML(ticker);
    return `
        <tr id="row-${safeId}" data-ticker="${escapedTicker}">
            <td class="left-align col-symbol">
                <div class="asset-col">
                    <span class="symbol" id="symbol-${safeId}" title="${escapedTicker}">${escapedTicker}</span>
                    <span class="name" id="name-${safeId}"><span class="skeleton sm"></span></span>
                </div>
            </td>
            <td class="col-price" id="price-cell-${safeId}">
                <div class="price" id="price-${safeId}"><span class="skeleton"></span></div>
                <div class="extended-price" id="ext-price-${safeId}"></div>
            </td>
            <td class="col-change" id="change-cell-${safeId}">
                <div class="change-cell">
                    <div id="change-${safeId}"><span class="skeleton"></span></div>
                    <div id="pct-${safeId}"></div>
                </div>
            </td>
            <td class="hide-mobile sub-data" id="vol-${safeId}">-</td>
            <td class="hide-mobile sub-data" id="cap-${safeId}">-</td>
            <td class="hide-mobile sub-data" id="range-${safeId}">-</td>
            <td class="actions-col">
                <button class="action-icon-btn danger" onclick="confirmRemoveTicker('${escapedTicker}')">${TRASH_ICON}</button>
            </td>
            <td class="handle-col">
                <div class="action-icon-btn drag-handle">${DRAG_ICON}</div>
            </td>
        </tr>
    `;
}

// =========================================================
// 7. 검색 및 자동완성 (Autocomplete)
// =========================================================
function handleAutocomplete(value, sectionKey) {
    const listEl = document.getElementById('autocomplete-' + sectionKey);
    const guideEl = document.getElementById('guide-' + sectionKey);
    const addBtn = document.getElementById('btn-add-' + sectionKey);

    if (addBtn && addBtn.disabled) return;

    if (!value || value.trim() === '') {
        if (listEl) listEl.style.display = 'none';
        if (guideEl) guideEl.style.display = 'none';
        return;
    }

    value = value.trim().toLowerCase();
    const isChosung = /[ㄱ-ㅎ]/.test(value) && !/[가-힣]/.test(value);
    const isKr = sectionKey === 'kr';

    const matches = localTickerDB.filter(item => {
        if (isKr && item.e !== 'NAVER') return false;
        if (!isKr && item.e === 'NAVER') return false;
