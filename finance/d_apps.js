// --- CONFIGURATION & UTILITIES ---
const DEFAULT_WATCHLISTS = {
    indicators: { title: '📈 MKT', tickers: ['KRW=X', '^KS11', '^KQ11', '^IXIC', '^DJI', '^GSPC', 'BTC-USD'] },
    kr: { title: '🇰🇷 KR', tickers: ['005930.KS', '000660.KS', '373220.KS', '005380.KS', '035420.KS'] },            
    us: { title: '🇺🇸 US', tickers: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META'] }
};

const GAS_PROXY_URL = "https://script.google.com/macros/s/AKfycbydYWqn3tZL25dE8UPMyN9mV19R1YKFZKpF-aml_25Z_YvA_qElw-LpxNO_Y8_sOzCV/exec";

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
    intervalId: null
};

const rowNodes = new Map(); let sortables = []; 
function getSafeId(ticker) { return 'id_' + ticker.replace(/[^a-zA-Z0-9]/g, '_'); }

// --- INITIALIZATION ---
async function init() {
    if (!state.sectionOrder || state.sectionOrder.length === 0) state.sectionOrder = Object.keys(state.watchlists);
    await initTickerDB(); 

    applyTheme(); renderLayout(); startTimer(); fetchData(); 
    initSwipeToDelete(); 
    
    document.getElementById('btn-refresh').addEventListener('click', forceRefresh);
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-wrapper')) {
            document.querySelectorAll('.autocomplete-list').forEach(el => el.style.display = 'none');
            document.querySelectorAll('.input-guide').forEach(el => el.style.display = 'none');
        }
        if (!e.target.closest('.settings-wrapper')) document.getElementById('settings-dropdown').classList.remove('active');
    });
}

function processTickerDB(data) {
    return data.map(q => ({
        ...q, cs_s: getChosung(q.s || '').toLowerCase(), cs_n: getChosung(q.n || '').toLowerCase()
    }));
}

async function initTickerDB() {
    try {
        const response = await fetch(`./finance/tickers.json?v=${new Date().getTime()}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const rawData = await response.json();
        localTickerDB = processTickerDB(rawData);
    } catch (error) {
        console.error("티커 DB 로드 실패:", error);
        localTickerDB = processTickerDB([{ s: "AAPL", n: "Apple Inc.", e: "NASDAQ" }, { s: "005930.KS", n: "삼성전자", e: "KOSPI" }]);
    }
}

// --- SWIPE TO DELETE GESTURE LOGIC (모달 연동 및 스크롤 오작동 방지) ---
function initSwipeToDelete() {
    let touchStartX = 0;
    let touchStartY = 0;
    let swipingRow = null;
    
    let isSwiping = false;   // 가로 스와이프 상태
    let isScrolling = false; // 세로 스크롤 상태 (새로 추가됨)

    const dashboard = document.getElementById('dashboard');

    dashboard.addEventListener('touchstart', e => {
        const row = e.target.closest('tr[data-ticker]');
        if (!row || e.target.closest('.drag-handle') || e.target.closest('.action-icon-btn')) return;
        
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        swipingRow = row;
        
        // 터치 시작 시 상태 초기화
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

        // 1. 제스처의 방향을 결정하는 단계 (처음 10px 이상 움직였을 때 단 한 번만 판별)
        if (!isSwiping && !isScrolling && (absDiffX > 10 || absDiffY > 10)) {
            // 가로 이동 거리가 세로 이동 거리의 1.5배 이상이고, 왼쪽으로 밀 때(diffX < 0)만 스와이프로 간주
            if (absDiffX > absDiffY * 1.5 && diffX < 0) {
                isSwiping = true;
            } else {
                // 그 외의 대각선 움직임이나 세로 움직임은 모두 화면 스크롤로 간주
                isScrolling = true; 
            }
        }

        // 2. 세로 스크롤 중으로 판별되었다면, 행(row)을 가로로 움직이는 로직은 무시하고 브라우저 기본 스크롤에 맡김
        if (isScrolling) {
            return; 
        }

        // 3. 명확한 가로 스와이프 중일 때의 처리
        if (isSwiping && diffX < 0) { 
            if (e.cancelable) e.preventDefault(); // 스와이프 중 화면이 위아래로 흔들리는 것 방지
            const moveX = Math.max(diffX, -150); 
            swipingRow.style.transform = `translateX(${moveX}px)`;
            swipingRow.style.opacity = 1 - (Math.abs(moveX) / 200); 
        }
    }, { passive: false }); // preventDefault()를 사용해야 하므로 passive: false 유지

    dashboard.addEventListener('touchend', e => {
        if (!swipingRow) return;
        const touchCurrentX = e.changedTouches[0].clientX;
        const diffX = touchCurrentX - touchStartX;

        swipingRow.style.transition = 'all 0.3s ease';
        
        // 스와이프 모드였고, 충분히 왼쪽으로 밀었을 때만 삭제 모달 띄우기
        if (isSwiping && diffX < -80) {
            const ticker = swipingRow.dataset.ticker;
            confirmRemoveTicker(ticker); 
        } 
        
        // 위치 및 투명도 원상 복구
        swipingRow.style.transform = 'translateX(0)';
        swipingRow.style.opacity = '1';
        
        // 상태 초기화
        swipingRow = null;
        isSwiping = false;
        isScrolling = false;
    });
}

// --- RENDERING & UI ---
function renderLayout() {
    const dashboard = document.getElementById('dashboard');
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
                        <div class="input-guide" id="guide-${sectionId}">Please enter only the ticker symbol from Yahoo Finance.</div>
                        ${SEARCH_ICON}
                        <input type="text" id="input-${sectionId}" placeholder="Search Ticker or Company" autocomplete="off">
                        <ul class="autocomplete-list" id="autocomplete-${sectionId}"></ul>
                    </div>
                    <button type="submit" id="btn-add-${sectionId}">
                        ${PLUS_ICON}<span>Add<span class="hide-mobile-text"> tickers</span></span>
                    </button>
                </form>
                <div class="table-wrapper">
                    <div class="empty-state" id="empty-${sectionId}" style="display: ${isEmpty ? 'flex' : 'none'};">
                        ${EMPTY_ICON}
                        <p>등록된 관심 종목이 없습니다.<br>상단의 <strong>+ 버튼</strong>을 눌러 추가해보세요.</p>
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
    if(!query) return; 
    query = query.trim().toLowerCase();
    
    if (query.length < 1) {
        list.style.display = 'none'; guide.style.display = 'none'; return;
    }
    
    const isChosungQuery = /[ㄱ-ㅎ]/.test(query) && !/[가-힣]/.test(query);
    const matchedQuotes = localTickerDB.filter(q => {
        if (isChosungQuery) return (q.cs_s && q.cs_s.includes(query)) || (q.cs_n && q.cs_n.includes(query));
        else return (q.s && q.s.toLowerCase().includes(query)) || (q.n && q.n.toLowerCase().includes(query));
    }).slice(0, 8); 

    if (matchedQuotes.length > 0) {
        list.innerHTML = matchedQuotes.map(q => {
            const safeSymbol = escapeHTML(q.s); const safeName = escapeHTML(q.n); const safeExch = escapeHTML(q.e);
            return `
            <li onclick="selectAutocomplete('${safeSymbol}', '${sectionId}')">
                <div class="ac-info"><span class="ac-symbol">${safeSymbol}</span><span class="ac-name">${safeName}</span></div>
                <span class="ac-exch">${safeExch}</span>
            </li>
        `}).join('');
        list.style.display = 'block'; guide.style.display = 'none';
    } else {
        list.style.display = 'none'; guide.style.display = 'block';
    }
}

window.selectAutocomplete = function(symbol, sectionId) {
    const input = document.getElementById(`input-${sectionId}`);
    const list = document.getElementById(`autocomplete-${sectionId}`);
    const guide = document.getElementById(`guide-${sectionId}`);
    const btn = document.getElementById(`btn-add-${sectionId}`);
    input.value = symbol; list.style.display = 'none'; 
    if(guide) guide.style.display = 'none'; btn.click(); 
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
    if (!navigator.onLine) throw new Error("네트워크에 연결되어 있지 않습니다.");

    const symbolsStr = symbols.join(',');
    const targetUrl = `${GAS_PROXY_URL}?symbols=${encodeURIComponent(symbolsStr)}&t=${Date.now()}`;

    try {
        const text = await fetchWithRetry(targetUrl);
        if (text.trim().startsWith('<')) throw new Error("GAS 권한 또는 한도 초과 에러");
        const data = JSON.parse(text);
        
        if (data && data.quoteResponse && data.quoteResponse.result) return data.quoteResponse.result;
        else if (data && data.error) throw new Error(data.error);
        throw new Error("데이터 구조가 올바르지 않습니다.");
    } catch (e) { console.error("데이터 가져오기 최종 실패:", e); throw e; }
}

async function handleAddTicker(e, sectionId) {
    e.preventDefault();
    const inputEl = document.getElementById(`input-${sectionId}`);
    const btnEl = document.getElementById(`btn-add-${sectionId}`);
    const listEl = document.getElementById(`autocomplete-${sectionId}`);
    const guideEl = document.getElementById(`guide-${sectionId}`);
    const ticker = inputEl.value.trim().toUpperCase();
    
    if (!ticker || state.watchlists[sectionId].tickers.includes(ticker)) {
        inputEl.value = ''; listEl.style.display = 'none'; 
        if(guideEl) guideEl.style.display = 'none'; return;
    }

    const originalBtnContent = `${PLUS_ICON}<span>Add<span class="hide-mobile-text"> tickers</span></span>`;
    btnEl.disabled = true; btnEl.innerHTML = `${SPINNER_SVG}<span>Adding...</span>`; 
    listEl.style.display = 'none';
    if(guideEl) guideEl.style.display = 'none';

    try {
        const data = await fetchYahooFinance([ticker]);
        if (!data || data.length === 0 || !data[0].regularMarketPrice) {
            alert(`${ticker} not found. Search by Yahoo Finance ticker.`); return;
        }
        state.watchlists[sectionId].tickers.push(ticker); saveWatchlists();
        
        const tbody = document.getElementById(`tbody-${sectionId}`);
        tbody.insertAdjacentHTML('beforeend', generateRowHTML(ticker));
        cacheRowNodes(ticker); checkEmptyState(sectionId); 
        updateDOMWithData([data[0]]); inputEl.value = '';
    } catch (err) {
        alert(`오류: ${err.message}`);
    } finally {
        btnEl.disabled = false; btnEl.innerHTML = originalBtnContent;
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
}

function cacheRowNodes(ticker) {
    const sid = getSafeId(ticker);
    rowNodes.set(ticker, {
        row: document.getElementById(`row-${sid}`), symbol: document.getElementById(`symbol-${sid}`),
        name: document.getElementById(`name-${sid}`), price: document.getElementById(`price-${sid}`),
        extPrice: document.getElementById(`ext-price-${sid}`), change: document.getElementById(`change-${sid}`),
        pct: document.getElementById(`pct-${sid}`), vol: document.getElementById(`vol-${sid}`),
        cap: document.getElementById(`cap-${sid}`), range: document.getElementById(`range-${sid}`)
    });
}

function initDragAndDrop() {
    const dashboard = document.getElementById('dashboard');
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
    container.classList.toggle('collapsed');
    state.expanded[sectionId] = !container.classList.contains('collapsed');
    localStorage.setItem('marketdash_expanded', JSON.stringify(state.expanded));
    if (state.expanded[sectionId]) forceRefresh();
}

function toggleAddForm(e, sectionId) {
    e.stopPropagation();
    const container = document.getElementById(`section-${sectionId}`);
    const form = container.querySelector('.add-ticker-form');
    if (container.classList.contains('collapsed')) {
        container.classList.remove('collapsed');
        state.expanded[sectionId] = true;
        localStorage.setItem('marketdash_expanded', JSON.stringify(state.expanded));
        forceRefresh();
    }
    form.classList.toggle('active');
    container.classList.toggle('edit-mode');
    if (form.classList.contains('active')) form.querySelector('input').focus();
}

let targetTickerToDelete = null;
function confirmRemoveTicker(ticker) {
    targetTickerToDelete = ticker;
    document.getElementById('delete-target-ticker').textContent = ticker;
    document.getElementById('delete-modal').classList.add('active');
    document.getElementById('confirm-delete-btn').onclick = () => {
        if (targetTickerToDelete) { executeRemoveTicker(targetTickerToDelete); closeDeleteModal(); }
    };
}
function closeDeleteModal() { targetTickerToDelete = null; document.getElementById('delete-modal').classList.remove('active'); }

function toggleSettingsMenu() { document.getElementById('settings-dropdown').classList.toggle('active'); }
function applyTheme() { document.documentElement.setAttribute('data-theme', state.theme); }
function toggleThemeDropdown() { state.theme = state.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('marketdash_theme', state.theme); applyTheme(); toggleSettingsMenu(); }
function exportSettings() {
    const data = { watchlists: state.watchlists, sectionOrder: state.sectionOrder, expanded: state.expanded, theme: state.theme };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url;
    a.download = `1up_finance_settings_${new Date().toISOString().slice(0,10)}.json`; a.click();
    URL.revokeObjectURL(url); toggleSettingsMenu();
}
function triggerImport() { document.getElementById('import-file').click(); toggleSettingsMenu(); }
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
                alert('설정이 성공적으로 복원되었습니다.'); location.reload(); 
            } else alert('유효하지 않은 설정 파일입니다.');
        } catch (err) { alert('파일을 읽는 중 오류가 발생했습니다.'); }
    };
    reader.readAsText(file); event.target.value = ''; 
}
function resetToDefaults() {
    toggleSettingsMenu();
    if(confirm("현재 설정한 값을 기본값으로 초기화하시겠습니까?")) {
        localStorage.clear(); state.watchlists = JSON.parse(JSON.stringify(DEFAULT_WATCHLISTS));
        state.sectionOrder = ['indicators', 'kr', 'us']; renderLayout(); forceRefresh();
    }
}
function openAboutModal() { toggleSettingsMenu(); document.getElementById('about-modal').classList.add('active'); }
function closeAboutModal() { document.getElementById('about-modal').classList.remove('active'); }
function saveWatchlists() { localStorage.setItem('marketdash_watchlists', JSON.stringify(state.watchlists)); }

async function fetchData() {
    let symbolsToFetch = [];
    for (const sectionId of state.sectionOrder) {
        if (state.expanded[sectionId]) symbolsToFetch = symbolsToFetch.concat(state.watchlists[sectionId].tickers);
    }
    if (symbolsToFetch.length === 0) return;

    const chunkSize = 40;
    for (let i = 0; i < symbolsToFetch.length; i += chunkSize) {
        const chunk = symbolsToFetch.slice(i, i + chunkSize);
        try {
            const results = await fetchYahooFinance(chunk);
            updateDOMWithData(results); markMissingData(chunk, results);
        } catch (error) { markAllError(chunk, error.message); }
    }
}

function forceRefresh() { state.countdown = 60; document.getElementById('countdown').textContent = state.countdown; fetchData(); }
function startTimer() {
    if (state.intervalId) clearInterval(state.intervalId);
    state.intervalId = setInterval(() => {
        state.countdown--;
        if (state.countdown <= 0) forceRefresh(); else document.getElementById('countdown').textContent = state.countdown;
    }, 1000);
}

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
                nodes.row.classList.remove('flash-up', 'flash-down'); void nodes.row.offsetWidth; 
                nodes.row.classList.add(price > oldPrice ? 'flash-up' : 'flash-down');
            }
            nodes.price.setAttribute('data-price', price);
            nodes.name.textContent = quote.shortName || quote.longName || ticker;
            nodes.price.textContent = formatNum(price);
            
            let extOptions = [];
            if (quote.preMarketPrice) extOptions.push({ price: quote.preMarketPrice, pct: quote.preMarketChangePercent || 0, label: 'PRE', time: quote.preMarketTime || 0 });
            if (quote.postMarketPrice) extOptions.push({ price: quote.postMarketPrice, pct: quote.postMarketChangePercent || 0, label: 'POST', time: quote.postMarketTime || 0 });

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
    if (abs > 0 && abs < 0.1) decimals = 4; else if (abs > 1000) decimals = 0; 
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

document.addEventListener('DOMContentLoaded', init);
