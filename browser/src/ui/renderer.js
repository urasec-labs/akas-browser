// === State ===
let tabs = [{ id: 0, title: "Yeni Sekme", url: "newtab", isNewTab: true }];
let activeTabId = 0;
let nextTabId = 1;
let currentZoom = 100;
let bookmarks = [];
let historyData = [];
let activeWebview = null;
let currentTheme = "dark";
let suggestionsActiveIndex = -1;
let suggestionsVisible = false;

const HOME_PAGE = "newtab";
const NEW_TAB_FILE = "new-tab.html";

// === DOM Elements ===
const tabsContainer = document.getElementById("tabs-container");
const newTabBtn = document.getElementById("new-tab-btn");
const urlInput = document.getElementById("url-input");
const urlDisplay = document.getElementById("url-display");
const urlDomain = document.getElementById("url-domain");
const urlRest = document.getElementById("url-rest");
const lockIcon = document.getElementById("lock-icon");
const bookmarkStar = document.getElementById("bookmark-star");
const urlBarContainer = document.getElementById("url-bar-container");
const suggestionsDropdown = document.getElementById("suggestions-dropdown");
const backBtn = document.getElementById("back-btn");
const forwardBtn = document.getElementById("forward-btn");
const reloadBtn = document.getElementById("reload-btn");
const stopBtn = document.getElementById("stop-btn");
const homeBtn = document.getElementById("home-btn");
const loadingBar = document.getElementById("loading-bar");
const settingsModal = document.getElementById("settings-modal");
const findBar = document.getElementById("find-bar");
const findInput = document.getElementById("find-input");
const findCount = document.getElementById("find-count");
const zoomDisplay = document.getElementById("zoom-display");
const bookmarksPanel = document.getElementById("bookmarks-panel");
const historyPanel = document.getElementById("history-panel");
const bookmarksList = document.getElementById("bookmarks-list");
const historyList = document.getElementById("history-list");
const themeToggle = document.getElementById("theme-toggle");
const themeIconMoon = document.getElementById("theme-icon-moon");
const themeIconSun = document.getElementById("theme-icon-sun");

// === URL Display ===
function updateUrlDisplay(url) {
    if (!url || url === "newtab" || (url.startsWith("file://") && url.includes("new-tab.html"))) {
        urlDomain.textContent = "";
        urlRest.textContent = "";
        urlInput.value = "";
        urlInput.placeholder = "AKAS Browser'da arama yapin...";
        lockIcon.style.display = "none";
        return;
    }
    lockIcon.style.display = "flex";
    urlInput.value = url;
    urlInput.placeholder = "";
    try {
        const parsed = new URL(url);
        const domain = parsed.hostname;
        const isSecure = parsed.protocol === "https:";
        lockIcon.classList.toggle("insecure", !isSecure);
        const rest = parsed.pathname + parsed.search + parsed.hash;
        urlDomain.textContent = domain;
        urlRest.textContent = rest === "/" ? "" : rest;
    } catch {
        urlDomain.textContent = url;
        urlRest.textContent = "";
    }
    updateBookmarkStar(url);
}

async function updateBookmarkStar(url) {
    const isBookmarked = bookmarks.some(b => b.url === url);
    bookmarkStar.classList.toggle("active", isBookmarked);
}

// === Tab Management ===
function createTab(url) {
    const tabId = nextTabId++;
    const isNewTab = !url || url === "newtab";
    const tabUrl = isNewTab ? "newtab" : url;
    const tab = { id: tabId, title: "Yeni Sekme", url: tabUrl, isNewTab };
    tabs.push(tab);
    const webview = document.createElement("webview");
    webview.id = "web-view-" + tabId;
    webview.className = "browser-webview";
    webview.setAttribute("partition", "persist:akas-session");
    if (isNewTab) {
        webview.setAttribute("src", window.akasAPI.getNewTabUrl());
    } else {
        webview.setAttribute("src", tabUrl);
    }
    document.querySelector(".browser-view-container").appendChild(webview);
    addTabUI(tab);
    switchTab(tabId);
    return tabId;
}

function addTabUI(tab) {
    const tabEl = document.createElement("div");
    tabEl.className = "tab";
    tabEl.dataset.tabId = tab.id;
    tabEl.innerHTML = '<span class="tab-favicon"></span><span class="tab-title">' + tab.title + '</span><button class="tab-close" title="Kapat">&times;</button>';
    tabEl.addEventListener("click", (e) => {
        if (!e.target.classList.contains("tab-close")) switchTab(tab.id);
    });
    tabEl.querySelector(".tab-close").addEventListener("click", (e) => {
        e.stopPropagation();
        closeTab(tab.id);
    });
    tabEl.addEventListener("mousedown", (e) => {
        if (e.button === 1) { e.preventDefault(); closeTab(tab.id); }
    });
    tabsContainer.appendChild(tabEl);
}

function switchTab(tabId) {
    activeTabId = tabId;
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    const tabEl = document.querySelector(".tab[data-tab-id=\"" + tabId + "\"]");
    if (tabEl) tabEl.classList.add("active");
    document.querySelectorAll(".browser-webview").forEach(w => w.classList.remove("active"));
    const wv = document.getElementById("web-view-" + tabId);
    if (wv) { wv.classList.add("active"); activeWebview = wv; }
    if (tab.isNewTab) { updateUrlDisplay("newtab"); }
    else { updateUrlDisplay(tab.url); }
    document.title = tab.title === "Yeni Sekme" ? "AKAS Browser" : tab.title + " - AKAS Browser";
    updateNavButtons();
}

function closeTab(tabId) {
    if (tabs.length === 1) return;
    const idx = tabs.findIndex(t => t.id === tabId);
    if (idx === -1) return;
    const wv = document.getElementById("web-view-" + tabId);
    if (wv) wv.remove();
    tabs.splice(idx, 1);
    const tabEl = document.querySelector(".tab[data-tab-id=\"" + tabId + "\"]");
    if (tabEl) tabEl.remove();
    if (activeTabId === tabId) {
        switchTab(tabs[Math.min(idx, tabs.length - 1)].id);
    }
}

function updateTabTitle(tabId, title) {
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
        tab.title = title;
        const tabEl = document.querySelector(".tab[data-tab-id=\"" + tabId + "\"] .tab-title");
        if (tabEl) tabEl.textContent = title;
    }
}

function updateTabUrl(tabId, url) {
    const tab = tabs.find(t => t.id === tabId);
    if (tab) { tab.url = url; tab.isNewTab = false; }
}

// === Navigation ===
function navigateTo(url) {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = "https://" + url;
    }
    hideSuggestions();
    const wv = document.getElementById("web-view-" + activeTabId);
    if (wv) wv.src = url;
}

function updateNavButtons() {
    const wv = document.getElementById("web-view-" + activeTabId);
    if (!wv) return;
    backBtn.style.opacity = wv.canGoBack() ? "1" : "0.3";
    forwardBtn.style.opacity = wv.canGoForward() ? "1" : "0.3";
}

function updateLoadingBar(loading) {
    if (loading) {
        loadingBar.style.display = "block";
        loadingBar.style.width = "0%";
        let p = 0;
        loadingBar._interval = setInterval(() => {
            p += Math.random() * 15;
            if (p > 90) p = 90;
            loadingBar.style.width = p + "%";
        }, 200);
    } else {
        clearInterval(loadingBar._interval);
        loadingBar.style.width = "100%";
        setTimeout(() => { loadingBar.style.display = "none"; loadingBar.style.width = "0%"; }, 200);
    }
}

// === Suggestions ===
async function showSuggestions(query) {
    if (!query || query.length < 1) { hideSuggestions(); return; }
    const q = query.toLowerCase();
    let results = [];
    const hist = historyData.filter(h =>
        (h.title && h.title.toLowerCase().includes(q)) || (h.url && h.url.toLowerCase().includes(q))
    ).slice(0, 5);
    const bms = bookmarks.filter(b =>
        (b.title && b.title.toLowerCase().includes(q)) || (b.url && b.url.toLowerCase().includes(q))
    ).slice(0, 5);
    bms.forEach(b => results.push({ title: b.title, url: b.url, type: "Yer Imi" }));
    hist.forEach(h => {
        if (!results.find(r => r.url === h.url)) results.push({ title: h.title, url: h.url, type: "Gecmis" });
    });
    if (!urlInput.value.match(/^[a-zA-Z]+:\/\//) && urlInput.value.includes(".")) {
        const domain = urlInput.value.split("/")[0];
        if (!results.find(r => r.url.includes(domain))) {
            results.push({ title: urlInput.value, url: "https://" + urlInput.value, type: "Git" });
        }
    }
    if (results.length === 0) {
        results.push({ title: query, url: "https://www.google.com/search?q=" + encodeURIComponent(query), type: "Google" });
    }
    suggestionsActiveIndex = -1;
    suggestionsVisible = true;
    suggestionsDropdown.innerHTML = results.map((r, i) => {
        let hostname = "";
        try { hostname = new URL(r.url).hostname; } catch { hostname = r.url; }
        const letter = (r.title || hostname || "?")[0].toUpperCase();
        return '<div class="suggestion-item" data-index="' + i + '" data-url="' + r.url + '">' +
            '<div class="suggestion-icon">' + letter + '</div>' +
            '<div class="suggestion-text"><div class="suggestion-title">' + (r.title || hostname) + '</div>' +
            '<div class="suggestion-url">' + hostname + '</div></div>' +
            '<span class="suggestion-type">' + r.type + '</span></div>';
    }).join("");
    suggestionsDropdown.style.display = "block";
    suggestionsDropdown.querySelectorAll(".suggestion-item").forEach(item => {
        item.addEventListener("mousedown", (e) => {
            e.preventDefault();
            navigateTo(item.dataset.url);
        });
    });
}

function hideSuggestions() {
    suggestionsVisible = false;
    suggestionsActiveIndex = -1;
    suggestionsDropdown.style.display = "none";
    suggestionsDropdown.innerHTML = "";
}

// === Webview Events ===
function setupWebviewEvents(webview, tabId) {
    webview.addEventListener("did-start-loading", () => {
        if (activeTabId === tabId) updateLoadingBar(true);
        const tabEl = document.querySelector(".tab[data-tab-id=\"" + tabId + "\"] .tab-favicon");
        if (tabEl) tabEl.innerHTML = '<div class="spinner"></div>';
    });
    webview.addEventListener("did-stop-loading", () => {
        if (activeTabId === tabId) {
            updateLoadingBar(false);
            reloadBtn.style.display = "flex";
            stopBtn.style.display = "none";
            updateNavButtons();
        }
        const tabEl = document.querySelector(".tab[data-tab-id=\"" + tabId + "\"] .tab-favicon");
        if (tabEl) tabEl.innerHTML = "";
    });
    webview.addEventListener("did-navigate", (e) => {
        updateTabUrl(tabId, e.url);
        if (activeTabId === tabId) { updateUrlDisplay(e.url); updateNavButtons(); }
        window.akasAPI.addHistory({ url: e.url, title: webview.getTitle() || e.url });
        loadHistory();
    });
    webview.addEventListener("did-navigate-in-page", (e) => {
        updateTabUrl(tabId, e.url);
        if (activeTabId === tabId) updateUrlDisplay(e.url);
    });
    webview.addEventListener("page-title-updated", (e) => {
        updateTabTitle(tabId, e.title || "Yeni Sekme");
        if (activeTabId === tabId) {
            document.title = e.title ? e.title + " - AKAS Browser" : "AKAS Browser";
        }
    });
    webview.addEventListener("page-favicon-updated", (e) => {
        if (e.favicons && e.favicons[0]) {
            const tabEl = document.querySelector(".tab[data-tab-id=\"" + tabId + "\"] .tab-favicon");
            if (tabEl) tabEl.innerHTML = '<img src="' + e.favicons[0] + '" width="14" height="14" style="border-radius:3px">';
        }
    });
    webview.addEventListener("did-fail-load", (e) => {
        if (e.errorCode === -3) return;
        if (activeTabId === tabId) updateLoadingBar(false);
    });
    webview.addEventListener("dom-ready", () => { if (activeTabId === tabId) updateNavButtons(); });
    webview.addEventListener("new-window", (e) => { e.preventDefault(); navigateTo(e.url); });
    webview.addEventListener("did-finish-load", () => {
        window.akasAPI.addHistory({ url: webview.getURL(), title: webview.getTitle() });
    });
}

// === Zoom ===
function setZoom(level) {
    currentZoom = Math.max(25, Math.min(500, level));
    const wv = document.getElementById("web-view-" + activeTabId);
    if (wv) wv.setZoomFactor(currentZoom / 100);
    zoomDisplay.textContent = currentZoom + "%";
}

// === Bookmarks ===
async function loadBookmarks() {
    bookmarks = await window.akasAPI.getBookmarks();
    renderBookmarks();
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab && tab.url !== "newtab") updateBookmarkStar(tab.url);
}

function renderBookmarks() {
    if (bookmarks.length === 0) {
        bookmarksList.innerHTML = '<div class="panel-empty">Henuz yer imi eklenmemis</div>';
        return;
    }
    bookmarksList.innerHTML = bookmarks.map(bm => {
        const letter = (bm.title || bm.url || "?")[0].toUpperCase();
        return '<div class="panel-item" data-url="' + bm.url + '">' +
            '<div class="panel-item-icon">' + letter + '</div>' +
            '<div class="panel-item-info"><div class="panel-item-title">' + (bm.title || bm.url) + '</div>' +
            '<div class="panel-item-url">' + bm.url + '</div></div>' +
            '<button class="panel-item-remove" data-id="' + bm.id + '" title="Kaldir">&times;</button></div>';
    }).join("");
    bookmarksList.querySelectorAll(".panel-item").forEach(item => {
        item.addEventListener("click", (e) => {
            if (!e.target.classList.contains("panel-item-remove")) {
                navigateTo(item.dataset.url);
                bookmarksPanel.classList.remove("open");
            }
        });
    });
    bookmarksList.querySelectorAll(".panel-item-remove").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            bookmarks = await window.akasAPI.removeBookmark(parseInt(btn.dataset.id));
            renderBookmarks();
        });
    });
}

// === History ===
async function loadHistory() {
    historyData = await window.akasAPI.getHistory();
    renderHistory();
}

function renderHistory() {
    if (historyData.length === 0) {
        historyList.innerHTML = '<div class="panel-empty">Gecmis bos</div>';
        return;
    }
    historyList.innerHTML = historyData.slice(0, 50).map(h => {
        const letter = (h.title || h.url || "?")[0].toUpperCase();
        return '<div class="panel-item" data-url="' + h.url + '">' +
            '<div class="panel-item-icon">' + letter + '</div>' +
            '<div class="panel-item-info"><div class="panel-item-title">' + (h.title || h.url) + '</div>' +
            '<div class="panel-item-url">' + h.url + '</div>' +
            '<div class="panel-item-date">' + new Date(h.visitedAt).toLocaleDateString("tr-TR") + '</div></div>' +
            '<button class="panel-item-remove" data-id="' + h.id + '" title="Kaldir">&times;</button></div>';
    }).join("");
    historyList.querySelectorAll(".panel-item").forEach(item => {
        item.addEventListener("click", (e) => {
            if (!e.target.classList.contains("panel-item-remove")) {
                navigateTo(item.dataset.url);
                historyPanel.classList.remove("open");
            }
        });
    });
    historyList.querySelectorAll(".panel-item-remove").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            historyData = await window.akasAPI.removeHistoryItem(parseInt(btn.dataset.id));
            renderHistory();
        });
    });
}

// === Find in Page ===
let findActive = false;
function toggleFind() {
    findActive = !findActive;
    findBar.classList.toggle("open", findActive);
    if (findActive) { findInput.focus(); findInput.select(); }
}

function closeFind() {
    findActive = false;
    findBar.classList.remove("open");
    const wv = document.getElementById("web-view-" + activeTabId);
    if (wv && wv.stopFindInPage) wv.stopFindInPage("clearSelection");
}

function findInPage(direction) {
    const text = findInput.value.trim();
    if (!text) return;
    const wv = document.getElementById("web-view-" + activeTabId);
    if (wv && wv.findInPage) {
        wv.findInPage(text, { forward: direction !== "backward", findNext: true });
    }
}

// === Theme ===
async function loadTheme() {
    try {
        const theme = await window.akasAPI.getTheme();
        currentTheme = theme || "dark";
        applyTheme(currentTheme);
    } catch {}
}

function applyTheme(theme) {
    currentTheme = theme;
    if (theme === "light") {
        document.body.classList.add("light-theme");
        themeIconMoon.style.display = "none";
        themeIconSun.style.display = "block";
    } else {
        document.body.classList.remove("light-theme");
        themeIconMoon.style.display = "block";
        themeIconSun.style.display = "none";
    }
    const wv = document.getElementById("web-view-" + activeTabId);
    if (wv) {
        wv.setBackgroundColor ? wv.setBackgroundColor(theme === "light" ? "#ffffff" : "#0a0e1a") : null;
    }
}

function toggleTheme() {
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    applyTheme(newTheme);
    window.akasAPI.setTheme(newTheme);
}

// === Initialize ===
function init() {
    const firstWv = document.getElementById("web-view-0");
    if (firstWv) {
        activeWebview = firstWv;
        setupWebviewEvents(firstWv, 0);
        firstWv.addEventListener("dom-ready", () => {
            firstWv.loadURL(window.akasAPI.getNewTabUrl());
        }, { once: true });
    }
    window.akasAPI.onTorStatus((data) => {
        const torIndicator = document.getElementById("tor-indicator");
        if (torIndicator) {
            torIndicator.textContent = data.active ? "Tor: Aktif" : "Tor: Yerel";
            torIndicator.className = data.active ? "status-badge active" : "status-badge inactive";
        }
    });
    window.akasAPI.onNavigate((url) => navigateTo(url));
    window.akasAPI.onThemeChanged((theme) => applyTheme(theme));
    window.akasAPI.onUpdateStatus((status) => {
        const banner = document.getElementById("update-banner");
        const bannerText = document.getElementById("update-banner-text");
        const downloadBtn = document.getElementById("update-download-btn");
        if (status.type === "available") {
            banner.style.display = "flex";
            bannerText.textContent = "AKAS Browser v" + status.version + " mevcut - Guncelleme hazir";
            downloadBtn.textContent = "Guncelle";
            downloadBtn.onclick = async () => {
                downloadBtn.textContent = "Indiriliyor...";
                await window.akasAPI.downloadUpdate();
            };
        } else if (status.type === "downloading") {
            bannerText.textContent = "Indiriliyor... %" + status.percent;
        } else if (status.type === "downloaded") {
            bannerText.textContent = "Guncelleme indirildi. Yeniden baslatilacak...";
            downloadBtn.textContent = "Simdi Yeniden Baslat";
            downloadBtn.onclick = () => window.akasAPI.installUpdate();
        }
    });
    loadBookmarks();
    loadHistory();
    loadTheme();
    const torIndicator = document.getElementById("tor-indicator");
    if (torIndicator) {
        torIndicator.addEventListener("click", async () => {
            const active = await window.akasAPI.getTorStatus();
            if (active) {
                const result = await window.akasAPI.newTorIdentity();
                alert(result.message);
            } else {
                alert("Tor SOCKS5 aktif degil (127.0.0.1:9050).");
            }
        });
    }
    const shieldIcon = document.getElementById("shield-icon");
    if (shieldIcon) {
        shieldIcon.addEventListener("click", async () => {
            const info = await window.akasAPI.getBlocklistInfo();
            alert("AKAS Shield Aktif\n\nEngellenen tracker: " + info.trackers + "\nEngellenen reklam: " + info.ads + "\nToplam engellenen: " + info.total);
        });
    }
}

// === Event Listeners ===
newTabBtn.addEventListener("click", () => createTab());

urlInput.addEventListener("keydown", (e) => {
    const items = suggestionsDropdown.querySelectorAll(".suggestion-item");
    if (suggestionsVisible && items.length > 0) {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            suggestionsActiveIndex = Math.min(suggestionsActiveIndex + 1, items.length - 1);
            items.forEach((item, i) => item.classList.toggle("active", i === suggestionsActiveIndex));
            if (items[suggestionsActiveIndex]) urlInput.value = items[suggestionsActiveIndex].dataset.url;
            return;
        }
        if (e.key === "ArrowUp") {
            e.preventDefault();
            suggestionsActiveIndex = Math.max(suggestionsActiveIndex - 1, -1);
            items.forEach((item, i) => item.classList.toggle("active", i === suggestionsActiveIndex));
            if (suggestionsActiveIndex >= 0 && items[suggestionsActiveIndex]) urlInput.value = items[suggestionsActiveIndex].dataset.url;
            return;
        }
        if (e.key === "Escape") { hideSuggestions(); return; }
    }
    if (e.key === "Enter") {
        hideSuggestions();
        const val = urlInput.value.trim();
        if (val) navigateTo(val);
    }
});

urlInput.addEventListener("input", () => showSuggestions(urlInput.value.trim()));
urlInput.addEventListener("focus", () => { urlInput.select(); if (urlInput.value.trim()) showSuggestions(urlInput.value.trim()); });
urlInput.addEventListener("blur", () => setTimeout(hideSuggestions, 200));
urlDisplay.addEventListener("click", () => { urlInput.focus(); urlInput.select(); });

bookmarkStar.addEventListener("click", async () => {
    const wv = document.getElementById("web-view-" + activeTabId);
    if (!wv) return;
    const url = wv.getURL();
    const title = wv.getTitle() || url;
    const existing = bookmarks.find(b => b.url === url);
    if (existing) { bookmarks = await window.akasAPI.removeBookmark(existing.id); }
    else { bookmarks = await window.akasAPI.addBookmark({ url, title }); }
    updateBookmarkStar(url);
    renderBookmarks();
});

backBtn.addEventListener("click", () => { const wv = document.getElementById("web-view-" + activeTabId); if (wv && wv.canGoBack()) wv.goBack(); });
forwardBtn.addEventListener("click", () => { const wv = document.getElementById("web-view-" + activeTabId); if (wv && wv.canGoForward()) wv.goForward(); });
reloadBtn.addEventListener("click", () => { const wv = document.getElementById("web-view-" + activeTabId); if (wv) wv.reload(); });
stopBtn.addEventListener("click", () => { const wv = document.getElementById("web-view-" + activeTabId); if (wv) wv.stop(); });

homeBtn.addEventListener("click", () => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab) {
        tab.isNewTab = true;
        tab.title = "Yeni Sekme";
        tab.url = "newtab";
        const wv = document.getElementById("web-view-" + activeTabId);
        if (wv) wv.loadURL(window.akasAPI.getNewTabUrl());
        updateUrlDisplay("newtab");
        const tabEl = document.querySelector(".tab[data-tab-id=\"" + activeTabId + "\"] .tab-title");
        if (tabEl) tabEl.textContent = "Yeni Sekme";
    }
});

// Zoom
document.getElementById("zoom-in").addEventListener("click", () => setZoom(currentZoom + 10));
document.getElementById("zoom-out").addEventListener("click", () => setZoom(currentZoom - 10));
document.getElementById("zoom-reset").addEventListener("click", () => setZoom(100));

// Find
document.getElementById("find-btn").addEventListener("click", toggleFind);
findInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") findInPage(e.shiftKey ? "backward" : "forward");
    if (e.key === "Escape") closeFind();
});
document.getElementById("find-next").addEventListener("click", () => findInPage("forward"));
document.getElementById("find-prev").addEventListener("click", () => findInPage("backward"));
document.getElementById("find-close").addEventListener("click", closeFind);

// DevTools
document.getElementById("devtools-btn").addEventListener("click", () => {
    const wv = document.getElementById("web-view-" + activeTabId);
    if (wv && wv.webContents) wv.webContents.openDevTools();
});

// Screenshot
document.getElementById("screenshot-btn").addEventListener("click", async () => {
    const wv = document.getElementById("web-view-" + activeTabId);
    if (wv) {
        const result = await window.akasAPI.takeScreenshot(wv.webContents.id);
        if (result.success) alert("Ekran goruntusu kaydedildi:\n" + result.path);
    }
});

// Panels
document.getElementById("bookmarks-toggle").addEventListener("click", async () => {
    historyPanel.classList.remove("open");
    bookmarksPanel.classList.toggle("open");
    await loadBookmarks();
});
document.getElementById("history-toggle").addEventListener("click", async () => {
    bookmarksPanel.classList.remove("open");
    historyPanel.classList.toggle("open");
    await loadHistory();
});
document.querySelectorAll(".panel-close").forEach(btn => {
    btn.addEventListener("click", () => btn.closest(".side-panel").classList.remove("open"));
});

// Settings
document.getElementById("settings-btn").addEventListener("click", async () => {
    const info = await window.akasAPI.getBlocklistInfo();
    document.getElementById("tracker-count").textContent = info.trackers;
    document.getElementById("ad-count").textContent = info.ads;
    const torActive = await window.akasAPI.getTorStatus();
    document.getElementById("tor-status-detail").querySelector(".info-value").textContent = torActive ? "Aktif (SOCKS5:9050)" : "Pasif";
    settingsModal.style.display = "flex";
});
document.getElementById("close-modal").addEventListener("click", () => settingsModal.style.display = "none");
settingsModal.addEventListener("click", (e) => { if (e.target === settingsModal) settingsModal.style.display = "none"; });
document.getElementById("clear-data-btn").addEventListener("click", async () => {
    if (confirm("Tum gezinme verileri, onbellek ve gecmis silinecek. Emin misiniz?")) {
        await window.akasAPI.clearData();
        alert("Veriler temizlendi.");
        settingsModal.style.display = "none";
    }
});
document.getElementById("new-identity-btn").addEventListener("click", async () => {
    const result = await window.akasAPI.newTorIdentity();
    alert(result.message);
    settingsModal.style.display = "none";
});

// Theme Toggle
themeToggle.addEventListener("click", toggleTheme);

// Update Banner
document.getElementById("update-dismiss-btn").addEventListener("click", () => {
    document.getElementById("update-banner").style.display = "none";
});

// Keyboard Shortcuts
document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "t") { e.preventDefault(); createTab(); }
    if (e.ctrlKey && e.key === "w") { e.preventDefault(); closeTab(activeTabId); }
    if (e.ctrlKey && e.key === "l") { e.preventDefault(); urlInput.focus(); urlInput.select(); }
    if (e.ctrlKey && e.key === "r") { e.preventDefault(); const wv = document.getElementById("web-view-" + activeTabId); if (wv) wv.reload(); }
    if (e.ctrlKey && e.key === "f") { e.preventDefault(); toggleFind(); }
    if (e.ctrlKey && e.key === "b") { e.preventDefault(); document.getElementById("bookmarks-toggle").click(); }
    if (e.ctrlKey && e.key === "h") { e.preventDefault(); document.getElementById("history-toggle").click(); }
    if (e.ctrlKey && e.key === "=") { e.preventDefault(); setZoom(currentZoom + 10); }
    if (e.ctrlKey && e.key === "-") { e.preventDefault(); setZoom(currentZoom - 10); }
    if (e.ctrlKey && e.key === "0") { e.preventDefault(); setZoom(100); }
    if (e.key === "F12") { e.preventDefault(); document.getElementById("devtools-btn").click(); }
    if (e.altKey && e.key === "ArrowLeft") { e.preventDefault(); const wv = document.getElementById("web-view-" + activeTabId); if (wv && wv.canGoBack()) wv.goBack(); }
    if (e.altKey && e.key === "ArrowRight") { e.preventDefault(); const wv = document.getElementById("web-view-" + activeTabId); if (wv && wv.canGoForward()) wv.goForward(); }
    if (e.key === "Escape") { closeFind(); settingsModal.style.display = "none"; bookmarksPanel.classList.remove("open"); historyPanel.classList.remove("open"); hideSuggestions(); }
    if (e.ctrlKey && e.key >= "1" && e.key <= "9") { e.preventDefault(); const idx = parseInt(e.key) - 1; if (tabs[idx]) switchTab(tabs[idx].id); }
});

init();

