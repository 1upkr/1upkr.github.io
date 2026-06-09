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
        tickers: ['005930', '000660', '373220', '035720', '035420'] 
    },
    'us': { 
        title: '🇺🇸 US', 
        tickers: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META'] 
    }
};

const GAS_PROXY_URL = 'https://script.google.com/macros/s/AKfycbydYWqn3tZL25dE8UPMyN9mV19R1YKFZKpF-aml_25Z_YvA_qElw-LpxNO_Y8_sOzCV/exec';
const NAVER_GAS_PROXY_URL = 'https://script.google.com/macros/s/AKfycbygC4GrK-2abZUpWWCxD4ZVfFVzd-gjbGvyYBTWNP26J7zwkwbrWwttXNC-geENS1Nykw/exec';
const NEWS_GAS_PROXY_URL = 'https://script.google.com/macros/s/AKfycbwqQ_W0qB3W7yX2Ww8kG2yX5q8Q9Z8Y7Z6x8Y7Z6x8Y7Z6x8Y7Z/exec'; 

const CHO_HANGUL = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

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

function saveWatchlists() {
    localStorage.setItem('marketdash_watchlists', JSON.stringify(state.watchlists));
}

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

window.switchMobileTab = function(tabName) {
    localStorage.setItem('marketdash_active_tab', tabName);
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    if (tabName === 'news') {
        document.body.classList.add('show-news');
        const btn = document.getElementById('tab-btn-news');
        if (btn) btn.classList.add('active');
        const container = document.getElementById('news-container');
        if (!container || container.children.length === 0 || container.querySelector('.empty-state')) {
            fetchNews();
        }
    } else {
        document.body.classList.remove('show-news');
        const btn = document.getElementById('tab-btn-dashboard');
        if (btn) btn.classList.add('active');
    }
};

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
        const response = await fetch('https://1up.kr/data/tickers.json?t=' + new Date().getTime());
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

function cacheRowNodes(ticker) {
    const safeId = getSafeId(ticker);
    rowNodes.set(ticker, {
        row: document.getElementById('row-' + safeId),
        symbol: document.getElementById('symbol-' + safeId),
        name: document.getElementById('name-' + safeId),
        price: document.getElementById('price-' + safeId),
        extPrice: document.getElementById('ext-price-' + safeId),
        change: document.getElementById('change-' + safeId),
        pct: document.getElementById('pct-' + safeId),
        vol: document.getElementById('vol-' + safeId),
        cap: document.getElementById('cap-' + safeId),
        range: document.getElementById('range-' + safeId)
    });
}

function checkEmptyState(key) {
    const tbody = document.getElementById('tbody-' + key);
    const empty = document.getElementById('empty-' + key);
    const table = document.getElementById('table-' + key);
    if (tbody && empty && table) {
        const isEmpty = tbody.children.length === 0;
        empty.style.display = isEmpty ? 'flex' : 'none';
        table.style.display = isEmpty ? 'none' : 'table';
    }
}

// =========================================================
// 7. 검색, 폼 이벤트, 모달 및 설정 (UI Events)
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

        if (isChosung) {
            return (item.cs_s && item.cs_s.includes(value)) || (item.cs_n && item.cs_n.includes(value));
        } else {
            return (item.s && item.s.toLowerCase().includes(value)) || (item.n && item.n.toLowerCase().includes(value));
        }
    }).slice(0, 10);

    if (matches.length > 0) {
        if (listEl) {
            listEl.innerHTML = matches.map(item => {
                const s = escapeHTML(item.s);
                const n = escapeHTML(item.n);
                const e = escapeHTML(item.e);
                return `
                    <li onclick="selectAutocomplete('${s}', '${sectionKey}')">
                        <div class="ac-info">
                            <span class="ac-symbol">${s}</span>
                            <span class="ac-name">${n}</span>
                        </div>
                        <span class="ac-exch">${e}</span>
                    </li>
                `;
            }).join('');
            listEl.style.display = 'block';
        }
        if (guideEl) guideEl.style.display = 'none';
    } else {
        if (listEl) listEl.style.display = 'none';
        if (guideEl) guideEl.style.display = 'block';
    }
}

window.selectAutocomplete = function(symbol, sectionKey) {
    const inputEl = document.getElementById('input-' + sectionKey);
    const listEl = document.getElementById('autocomplete-' + sectionKey);
    const guideEl = document.getElementById('guide-' + sectionKey);

    if (inputEl) inputEl.value = symbol;
    if (listEl) listEl.style.display = 'none';
    if (guideEl) guideEl.style.display = 'none';
};

async function handleAddTicker(e, key) {
    e.preventDefault();
    const input = document.getElementById('input-' + key);
    const btn = document.getElementById('btn-add-' + key);
    const list = document.getElementById('autocomplete-' + key);
    const val = input.value.trim().toUpperCase();

    if (!val || state.watchlists[key].tickers.includes(val)) {
        input.value = '';
        if (list) list.style.display = 'none';
        return;
    }

    if (key === 'kr') {
        const isValid = localTickerDB.find(t => t.s.toUpperCase() === val && t.e === 'NAVER');
        if (!isValid) {
            alert('검색 결과에서 선택해주세요.');
            input.value = '';
            if (list) list.style.display = 'none';
            return;
        }
    }

    const originalBtnHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = SPINNER_SVG;
    if (list) list.style.display = 'none';

    try {
        const fetchFunc = key === 'kr' ? fetchNaverFinance : fetchYahooFinance;
        const data = await fetchFunc([val]);
        if (!data || data.length === 0 || data[0].regularMarketPrice === undefined) {
            alert(val + ' 종목 데이터를 불러올 수 없습니다.');
            return;
        }
        state.watchlists[key].tickers.push(val);
        saveWatchlists();
        const tbody = document.getElementById('tbody-' + key);
        if (tbody) tbody.insertAdjacentHTML('beforeend', generateRowHTML(val));
        cacheRowNodes(val);
        checkEmptyState(key);
        updateDOMWithData([data[0]]);
        input.value = '';
        fetchNews();
    } catch (err) {
        alert('오류: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalBtnHtml;
    }
}

function toggleSection(e, key) {
    if (e.target.closest('.search-wrapper') || e.target.closest('.action-icon-btn.btn-add-symbol')) return;
    const sec = document.getElementById('section-' + key);
    if (!sec) return;
    sec.classList.toggle('collapsed');
    state.expanded[key] = !sec.classList.contains('collapsed');
    localStorage.setItem('marketdash_expanded', JSON.stringify(state.expanded));
}

function toggleAddForm(e, key) {
    e.stopPropagation();
    const sec = document.getElementById('section-' + key);
    const form = document.getElementById('form-' + key);
    if (!sec || !form) return;
    if (sec.classList.contains('collapsed')) {
        sec.classList.remove('collapsed');
        state.expanded[key] = true;
        localStorage.setItem('marketdash_expanded', JSON.stringify(state.expanded));
    }
    form.classList.toggle('active');
    if (form.classList.contains('active')) document.getElementById('input-' + key).focus();
}

function confirmRemoveTicker(ticker) {
    targetTickerToDelete = ticker;
    const titleEl = document.getElementById('delete-target-ticker');
    if (titleEl) titleEl.textContent = ticker;
    const modal = document.getElementById('delete-modal');
    if (modal) modal.classList.add('active');
    const confirmBtn = document.getElementById('confirm-delete-btn');
    if (confirmBtn) {
        confirmBtn.onclick = () => {
            if (targetTickerToDelete) executeRemoveTicker(targetTickerToDelete);
            closeDeleteModal();
        };
    }
}

function closeDeleteModal() {
    targetTickerToDelete = null;
    const modal = document.getElementById('delete-modal');
    if (modal) modal.classList.remove('active');
}

function executeRemoveTicker(ticker) {
    for (const key in state.watchlists) {
        if (state.watchlists[key].tickers.includes(ticker)) {
            state.watchlists[key].tickers = state.watchlists[key].tickers.filter(t => t !== ticker);
            saveWatchlists();
            const safeId = getSafeId(ticker);
            const row = document.getElementById('row-' + safeId);
            if (row) row.remove();
            rowNodes.delete(ticker);
            checkEmptyState(key);
            fetchNews();
            break;
        }
    }
}

function toggleSettingsMenu() {
    const el = document.getElementById('settings-dropdown');
    if (el) el.classList.toggle('active');
}

function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
}

function toggleThemeDropdown() {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('marketdash_theme', state.theme);
    applyTheme();
    toggleSettingsMenu();
}

function exportSettings() {
    const data = { watchlists: state.watchlists, sectionOrder: state.sectionOrder, expanded: state.expanded, theme: state.theme };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'marketdash_backup_' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
    toggleSettingsMenu();
}

function triggerImport() {
    const el = document.getElementById('import-file');
    if (el) el.click();
    toggleSettingsMenu();
}

function importSettings(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            if (data.watchlists && data.sectionOrder) {
                localStorage.setItem('marketdash_watchlists', JSON.stringify(data.watchlists));
                localStorage.setItem('marketdash_sectionOrder', JSON.stringify(data.sectionOrder));
                if (data.expanded) localStorage.setItem('marketdash_expanded', JSON.stringify(data.expanded));
                if (data.theme) localStorage.setItem('marketdash_theme', data.theme);
                alert('설정이 복원되었습니다.');
                location.reload();
            } else alert('잘못된 파일입니다.');
        } catch (err) {
            alert('파일 읽기 오류입니다.');
        }
    };
    reader.readAsText(file);
    e.target.value = '';
}

function resetToDefaults() {
    toggleSettingsMenu();
    if (confirm('모든 설정을 초기화하시겠습니까?')) {
        localStorage.clear();
        location.reload();
    }
}

function openAboutModal() {
    toggleSettingsMenu();
    const el = document.getElementById('about-modal');
    if (el) el.classList.add('active');
}

function closeAboutModal() {
    const el = document.getElementById('about-modal');
    if (el) el.classList.remove('active');
}

// =========================================================
// 8. 데이터 통신 및 화면 갱신 (Fetching & Data Swapping)
// =========================================================
async function fetchWithRetry(url, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return await res.text();
        } catch (err) {
            if (i === retries - 1) throw err;
            await new Promise(r => setTimeout(r, delay * Math.pow(2, i)));
        }
    }
}

async function fetchYahooFinance(symbols) {
    if (symbols.length === 0) return [];
    if (!navigator.onLine) throw new Error('No network connection.');
    const query = symbols.join(',');
    const url = GAS_PROXY_URL + '?symbols=' + encodeURIComponent(query) + '&t=' + Date.now();
    try {
        const text = await fetchWithRetry(url);
        if (text.trim().startsWith('<')) throw new Error('GAS proxy permission denied.');
        const data = JSON.parse(text);
        if (data && data.quoteResponse && data.quoteResponse.result) return data.quoteResponse.result;
        throw new Error('Invalid Data format');
    } catch (e) {
        console.error('Yahoo Fetch Error', e);
        throw e;
    }
}

async function fetchNaverFinance(symbols) {
    if (symbols.length === 0) return [];
    if (!navigator.onLine) throw new Error('No network connection.');
    const query = symbols.join(',');
    const url = NAVER_GAS_PROXY_URL + '?symbols=' + encodeURIComponent(query) + '&t=' + Date.now();
    try {
        const text = await fetchWithRetry(url);
        if (text.trim().startsWith('<')) throw new Error('Naver GAS proxy permission denied.');
        const data = JSON.parse(text);
        if (data && data.quoteResponse && data.quoteResponse.result) return data.quoteResponse.result;
        throw new Error('Invalid Data format');
    } catch (e) {
        console.error('Naver Fetch Error', e);
        throw e;
    }
}

async function fetchData() {
    localStorage.setItem('marketdash_last_fetch_time', Date.now().toString());
    const promises = [];

    for (const key of state.sectionOrder) {
        if (!state.expanded[key]) continue;
        const tickers = state.watchlists[key].tickers;
        if (tickers.length === 0) continue;

        const chunkSize = 10;
        const fetchFunc = key === 'kr' ? fetchNaverFinance : fetchYahooFinance;

        for (let i = 0; i < tickers.length; i += chunkSize) {
            const chunk = tickers.slice(i, i + chunkSize);
            const p = fetchFunc(chunk).then(data => {
                updateDOMWithData(data);
                markMissingData(chunk, data);
            }).catch(err => {
                markAllError(chunk, err.message);
            });
            promises.push(p);
        }
    }
    await Promise.all(promises);
    fetchNews();
}

function startTimer() {
    if (state.intervalId) clearInterval(state.intervalId);
    state.intervalId = setInterval(() => {
        state.countdown--;
        if (state.countdown <= 0) forceRefresh();
        else {
            const el = document.getElementById('countdown');
            if (el) el.textContent = state.countdown;
        }
    }, 1000);
}

function forceRefresh() {
    state.countdown = 60;
    const el = document.getElementById('countdown');
    if (el) el.textContent = state.countdown;
    localStorage.setItem('marketdash_last_fetch_time', '0');
    state.lastNewsFetch = 0;
    fetchData();
    startTimer();
}

function updateDOMWithData(dataArray) {
    requestAnimationFrame(() => {
        dataArray.forEach(data => {
            const symbol = data.symbol;
            const nodes = rowNodes.get(symbol);
            if (!nodes || !nodes.row) return;

            // 1. 기본값(정규장) 설정
            let mainPrice = data.regularMarketPrice || 0;
            let mainChange = data.regularMarketChange || 0;
            let mainPct = data.regularMarketChangePercent || 0;
            let extHtml = '';

            // 2. 연장장(프리/애프터) 데이터 수집
            let extData = [];
            if (data.preMarketPrice) {
                extData.push({ price: data.preMarketPrice, change: data.preMarketChange || 0, pct: data.preMarketChangePercent || 0, label: '🔜', time: data.preMarketTime || 0 });
            }
            if (data.postMarketPrice) {
                extData.push({ price: data.postMarketPrice, change: data.postMarketChange || 0, pct: data.postMarketChangePercent || 0, label: '🔚', time: data.postMarketTime || 0 });
            }

            // 3. 야후 파이낸스 상태값(marketState) 기반 스왑 로직 (프록시 누락 대비 방어코드 포함)
            const isRegularMarket = !data.marketState || data.marketState === 'REGULAR'; 

            if (!isRegularMarket && extData.length > 0) {
                const latestExt = extData.reduce((prev, curr) => prev.time > curr.time ? prev : curr);
                mainPrice = latestExt.price;
                mainChange = latestExt.change;
                mainPct = latestExt.pct;

                const regIsUp = (data.regularMarketChange || 0) >= 0;
                const regColor = regIsUp ? 'up' : 'down';
                const regSign = regIsUp ? '+' : '';
                extHtml = `<span class="ext-label">종가</span> ${formatNum(data.regularMarketPrice)} <span class="${regColor}">(${regSign}${formatPct(data.regularMarketChangePercent || 0)}%)</span>`;
            } else if (extData.length > 0) {
                const latestExt = extData.reduce((prev, curr) => prev.time > curr.time ? prev : curr);
                const extIsUp = latestExt.pct >= 0;
                const extColor = extIsUp ? 'up' : 'down';
                const extSign = extIsUp ? '+' : '';
                extHtml = `<span class="ext-label">${latestExt.label}</span> ${formatNum(latestExt.price)} <span class="${extColor}">(${extSign}${formatPct(latestExt.pct)}%)</span>`;
            }

            // 4. UI 렌더링 적용
            const isUp = mainChange >= 0;
            const colorClass = isUp ? 'up' : 'down';
            const sign = isUp ? '+' : '';
            const arrow = isUp ? '▲' : '▼';

            const prevPriceStr = nodes.price.getAttribute('data-price');
            const prevPrice = prevPriceStr ? parseFloat(prevPriceStr) : null;

            if (prevPrice !== null && prevPrice !== mainPrice) {
                nodes.row.classList.remove('flash-up', 'flash-down');
                setTimeout(() => {
                    if (nodes && nodes.row) {
                        nodes.row.classList.add(mainPrice > prevPrice ? 'flash-up' : 'flash-down');
                    }
                }, 10);
            }

            nodes.price.setAttribute('data-price', mainPrice);
            nodes.name.textContent = data.shortName || data.longName || symbol;
            nodes.price.textContent = formatNum(mainPrice);
            nodes.extPrice.innerHTML = extHtml; 

            nodes.change.innerHTML = `<span class="${colorClass}">${sign}${formatNum(mainChange)}</span>`;
            nodes.pct.innerHTML = `<span class="badge ${colorClass}"><span class="arrow">${arrow}</span>${formatPct(Math.abs(mainPct))}%</span>`;
            nodes.vol.textContent = formatCompact(data.regularMarketVolume);
            nodes.cap.textContent = formatCompact(data.marketCap);

            if (data.fiftyTwoWeekLow && data.fiftyTwoWeekHigh) {
                nodes.range.textContent = formatNum(data.fiftyTwoWeekLow) + ' - ' + formatNum(data.fiftyTwoWeekHigh);
            } else {
                nodes.range.textContent = '-';
            }
        });
    });

    dataArray.forEach(data => {
        memoryPriceCache[data.symbol] = data;
    });
    saveCacheToStorage();
}

function markMissingData(chunk, dataArray) {
    const symbols = new Set(dataArray.map(d => d.symbol));
    chunk.forEach(sym => {
        if (!symbols.has(sym)) setErrorState(sym, 'No data');
    });
}

function markAllError(chunk, msg) {
    chunk.forEach(sym => setErrorState(sym, msg));
}

function setErrorState(sym, msg) {
    const nodes = rowNodes.get(sym);
    if (!nodes) return;
    requestAnimationFrame(() => {
        nodes.name.textContent = 'Error';
        nodes.price.innerHTML = `<span class="error-text">${escapeHTML(msg)}</span>`;
        nodes.extPrice.innerHTML = '';
        nodes.change.innerHTML = '';
        nodes.pct.innerHTML = '';
        nodes.vol.textContent = '-';
        nodes.cap.textContent = '-';
        nodes.range.textContent = '-';
    });
}

// =========================================================
// 9. 포맷터 및 뉴스 연동 등 (Utils & News)
// =========================================================
function formatNum(val) {
    if (val === undefined || val === null || isNaN(val)) return '-';
    const abs = Math.abs(val);
    let dec = 0;
    if (abs > 0 && abs < 1) dec = 4;
    else if (abs > 1000) dec = 0;
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(val);
}

function formatPct(val) {
    if (val === undefined || val === null || isNaN(val)) return '-';
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

function formatCompact(val) {
    if (!val || isNaN(val)) return '-';
    return new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short', maximumFractionDigits: 2 }).format(val);
}

async function fetchNews() {
    const spinner = document.getElementById('news-spinner');
    const container = document.getElementById('news-container');
    if (spinner) spinner.style.display = 'block';

    let symbols = [];
    Object.values(state.watchlists).forEach(w => {
        symbols = symbols.concat(w.tickers);
    });

    if (!container) return;
    if (symbols.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No tickers to fetch news.</p></div>';
        if (spinner) spinner.style.display = 'none';
        return;
    }

    try {
        const url = NEWS_GAS_PROXY_URL + '?symbols=' + encodeURIComponent(symbols.join(',')) + '&t=' + Date.now();
        const res = await fetch(url);
        if (!res.ok) throw new Error('Network error');
        const data = await res.json();
        state.lastNewsFetch = Date.now();
        renderNews(data);
    } catch (e) {
        console.error(e);
        container.innerHTML = '<div class="empty-state"><p class="error-text">Failed to load news.</p></div>';
    } finally {
        if (spinner) spinner.style.display = 'none';
    }
}

function renderNews(data) {
    const container = document.getElementById('news-container');
    if (!container) return;
    if (!data || data.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No recent news found.</p></div>';
        return;
    }

    const now = Date.now();
    const formatter = new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

    const html = data.map(item => {
        const diffMin = Math.floor((now - item.time) / 60000);
        let timeStr = '';
        if (diffMin >= 0 && diffMin < 60) {
            timeStr = diffMin === 0 ? '방금' : diffMin + '분 전';
        } else {
            timeStr = formatter.format(new Date(item.time));
        }
        const tagClass = item.source === 'Naver' ? 'tag-naver' : 'tag-yahoo';
        const sourceName = item.publisher ? item.publisher : item.source;

        return `
            <a href="${item.link}" target="_blank" rel="noopener noreferrer" class="news-item">
                <div class="news-title">${escapeHTML(item.title)}</div>
                <div class="news-meta">
                    <span class="news-time ${diffMin < 60 ? 'recent' : ''}">${timeStr}</span>
                    <span class="news-tag ${tagClass}">${escapeHTML(sourceName)} - ${escapeHTML(item.symbol)}</span>
                </div>
            </a>
        `;
    }).join('');
    container.innerHTML = html;
}

function initSwipeToDelete() {
    let startX = 0, startY = 0, target = null, isSwiping = false, isScrolling = false;
    const dashboard = document.getElementById('dashboard');
    if (!dashboard) return;

    dashboard.addEventListener('touchstart', e => {
        const row = e.target.closest('tr');
        if (!row || e.target.closest('.action-icon-btn') || e.target.closest('.search-wrapper')) return;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        target = row;
        isSwiping = false;
        isScrolling = false;
        row.style.transition = 'none';
    }, { passive: true });

    dashboard.addEventListener('touchmove', e => {
        if (!target) return;
        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const diffX = currentX - startX;
        const diffY = currentY - startY;

        if (!isSwiping && !isScrolling) {
            if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
                if (Math.abs(diffX) > Math.abs(diffY) * 0.5 && diffX < 0) isSwiping = true;
                else isScrolling = true;
            }
        }
        if (isScrolling) return;
        if (isSwiping && diffX < 0) {
            if (e.cancelable) e.preventDefault();
            const moveX = Math.max(diffX, -100);
            target.style.transform = `translateX(${moveX}px)`;
            target.style.opacity = 1 - Math.abs(moveX) / 200;
        }
    }, { passive: false });

    dashboard.addEventListener('touchend', e => {
        if (!target) return;
        const diffX = e.changedTouches[0].clientX - startX;
        target.style.transition = 'all 0.3s ease';
        if (isSwiping && diffX < -50) {
            confirmRemoveTicker(target.dataset.ticker);
        }
        target.style.transform = 'translateX(0)';
        target.style.opacity = '1';
        target = null;
        isSwiping = false;
        isScrolling = false;
    });
}

function initDragAndDrop() {
    const dashboard = document.getElementById('dashboard');
    if (!dashboard) return;
    Sortable.create(dashboard, {
        handle: '.drag-handle',
        animation: 200,
        ghostClass: 'sortable-ghost',
        delay: 100,
        delayOnTouchOnly: true,
        onEnd: function() {
            state.sectionOrder = Array.from(dashboard.querySelectorAll('.section-container')).map(el => el.dataset.id);
            localStorage.setItem('marketdash_sectionOrder', JSON.stringify(state.sectionOrder));
        }
    });

    state.sectionOrder.forEach(key => {
        const tbody = document.getElementById('tbody-' + key);
        if (tbody) {
            Sortable.create(tbody, {
                handle: '.drag-handle',
                animation: 200,
                ghostClass: 'sortable-ghost',
                delay: 100,
                delayOnTouchOnly: true,
                onEnd: function() {
                    state.watchlists[key].tickers = Array.from(tbody.querySelectorAll('tr')).map(row => row.dataset.ticker);
                    saveWatchlists();
                    checkEmptyState(key);
                }
            });
        }
    });
}

// 10. 초기화 실행
document.addEventListener('DOMContentLoaded', init);
