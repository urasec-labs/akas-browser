const { app, BrowserWindow, session, ipcMain, shell, dialog, Menu, clipboard, nativeTheme } = require('electron');
const path = require('path');
const net = require('net');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let isTorActive = false;

const blocklists = require('./security/blocklists');
const blockedDomains = [...blocklists.trackers, ...blocklists.ads];

const userDataPath = app.getPath('userData');
const bookmarksPath = path.join(userDataPath, 'bookmarks.json');
const historyPath = path.join(userDataPath, 'history.json');
const settingsPath = path.join(userDataPath, 'settings.json');

function loadJSON(filePath, fallback) {
    try {
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch {}
    return fallback;
}

function saveJSON(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch {}
}

let bookmarks = loadJSON(bookmarksPath, []);
let history = loadJSON(historyPath, []);
let settings = loadJSON(settingsPath, {
    theme: 'dark',
    fingerprintProtection: true,
    autoUpdate: true,
    blockTrackers: true,
    blockAds: true,
    safeBrowsing: true
});

function checkTorConnection() {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(1500);
        socket.on('connect', () => { isTorActive = true; socket.destroy(); resolve(true); });
        socket.on('timeout', () => { isTorActive = false; socket.destroy(); resolve(false); });
        socket.on('error', () => { isTorActive = false; resolve(false); });
        socket.connect(9050, '127.0.0.1');
    });
}

function requestNewTorIdentity() {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(3000);
        let authenticated = false;
        socket.on('connect', () => { socket.write('AUTHENTICATE ""\r\n'); });
        socket.on('data', (data) => {
            const msg = data.toString();
            if (msg.includes('250') && !authenticated) {
                authenticated = true;
                socket.write('SIGNAL NEWNYM\r\n');
            } else if (msg.includes('250') && authenticated) {
                socket.destroy();
                resolve({ success: true, message: 'Yeni Tor devresi başarıyla talep edildi.' });
            }
        });
        socket.on('timeout', () => { socket.destroy(); resolve({ success: false, message: 'Tor kontrol bağlantısı zaman aşımına uğradı (9051).' }); });
        socket.on('error', () => { resolve({ success: false, message: 'Tor kontrol portuna erişilemedi (9051).' }); });
        socket.connect(9051, '127.0.0.1');
    });
}

function isDomainBlocked(url) {
    try {
        const hostname = new URL(url).hostname;
        if (blockedDomains.some(d => hostname.includes(d))) return true;
        const tld = '.' + hostname.split('.').pop();
        if (blocklists.suspiciousTLDs.includes(tld)) return true;
        return false;
    } catch { return false; }
}

async function createWindow() {
    await checkTorConnection();

    const isDark = settings.theme !== 'light';

    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        backgroundColor: isDark ? '#0a0e1a' : '#f8f9fa',
        title: 'AKAS Browser',
        webPreferences: {
            preload: path.join(__dirname, 'ui/preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webviewTag: true,
            sandbox: false
        }
    });

    const akasSession = session.fromPartition('persist:akas-session');

    if (isTorActive) {
        await akasSession.setProxy({ proxyRules: 'socks5://127.0.0.1:9050', proxyBypassRules: '<local>' });
    }

    akasSession.webRequest.onHeadersReceived((details, callback) => {
        const headers = { ...details.responseHeaders };
        delete headers['x-frame-options'];
        delete headers['content-security-policy'];
        delete headers['x-content-security-policy'];
        callback({ responseHeaders: headers });
    });

    akasSession.webRequest.onBeforeRequest((details, callback) => {
        if (settings.blockTrackers || settings.blockAds) {
            if (isDomainBlocked(details.url)) {
                callback({ cancel: true });
                return;
            }
        }
        callback({ cancel: false });
    });

    akasSession.webRequest.onBeforeSendHeaders((details, callback) => {
        details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
        delete details.requestHeaders['X-Powered-By'];
        callback({ cancel: false, requestHeaders: details.requestHeaders });
    });

    akasSession.setPermissionRequestHandler((webContents, permission, callback) => {
        callback(true);
    });

    mainWindow.loadFile(path.join(__dirname, 'ui/index.html'));

    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('tor-status', { active: isTorActive });
        mainWindow.webContents.send('theme-changed', settings.theme);
    });

    mainWindow.on('closed', () => { mainWindow = null; });

    if (settings.autoUpdate) {
        try {
            autoUpdater.autoDownload = false;
            autoUpdater.autoInstallOnAppQuit = true;
            autoUpdater.checkForUpdates().catch(() => {});
        } catch (e) {}
    }
}

autoUpdater.on('update-available', (info) => {
    if (mainWindow) {
        mainWindow.webContents.send('update-status', {
            type: 'available',
            version: info.version,
            releaseNotes: info.releaseNotes
        });
    }
});

autoUpdater.on('download-progress', (progress) => {
    if (mainWindow) {
        mainWindow.webContents.send('update-status', {
            type: 'downloading',
            percent: Math.round(progress.percent)
        });
    }
});

autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow) {
        mainWindow.webContents.send('update-status', {
            type: 'downloaded',
            version: info.version
        });
    }
});

autoUpdater.on('error', () => {});

app.whenReady().then(() => createWindow());
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// === Tor ===
ipcMain.handle('get-tor-status', async () => { await checkTorConnection(); return isTorActive; });
ipcMain.handle('new-tor-identity', async () => {
    const result = await requestNewTorIdentity();
    await checkTorConnection();
    return { success: isTorActive, ...result };
});

// === Settings ===
ipcMain.handle('get-settings', () => settings);
ipcMain.handle('set-settings', (e, newSettings) => {
    settings = { ...settings, ...newSettings };
    saveJSON(settingsPath, settings);
    return settings;
});

// === Theme ===
ipcMain.handle('get-theme', () => settings.theme || 'dark');
ipcMain.handle('set-theme', (e, theme) => {
    settings.theme = theme;
    saveJSON(settingsPath, settings);
    if (mainWindow) {
        mainWindow.webContents.send('theme-changed', theme);
    }
    return theme;
});

// === Auto Update ===
ipcMain.handle('check-for-updates', async () => {
    try {
        const result = await autoUpdater.checkForUpdates();
        return { success: true, updateInfo: result ? result.updateInfo : null };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

ipcMain.handle('download-update', async () => {
    try {
        await autoUpdater.downloadUpdate();
        return { success: true };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall(false, true);
});

// === Data ===
ipcMain.handle('clear-browsing-data', async () => {
    const s = session.fromPartition('persist:akas-session');
    await s.clearStorageData();
    await s.clearCache();
    history = [];
    saveJSON(historyPath, history);
    return true;
});

ipcMain.handle('get-blocklist-info', () => {
    return { trackers: blocklists.trackers.length, ads: blocklists.ads.length, total: blockedDomains.length };
});

// === Bookmarks ===
ipcMain.handle('get-bookmarks', () => bookmarks);
ipcMain.handle('add-bookmark', (e, bookmark) => {
    if (!bookmarks.find(b => b.url === bookmark.url)) {
        bookmarks.push({ ...bookmark, id: Date.now(), createdAt: new Date().toISOString() });
        saveJSON(bookmarksPath, bookmarks);
    }
    return bookmarks;
});
ipcMain.handle('remove-bookmark', (e, id) => {
    bookmarks = bookmarks.filter(b => b.id !== id);
    saveJSON(bookmarksPath, bookmarks);
    return bookmarks;
});
ipcMain.handle('is-bookmarked', (e, url) => !!bookmarks.find(b => b.url === url));

// === History ===
ipcMain.handle('get-history', () => history.slice(0, 100));
ipcMain.handle('add-history', (e, entry) => {
    history = history.filter(h => h.url !== entry.url);
    history.unshift({ ...entry, id: Date.now(), visitedAt: new Date().toISOString() });
    if (history.length > 500) history = history.slice(0, 500);
    saveJSON(historyPath, history);
    return true;
});
ipcMain.handle('clear-history', () => {
    history = [];
    saveJSON(historyPath, history);
    return true;
});
ipcMain.handle('remove-history-item', (e, id) => {
    history = history.filter(h => h.id !== id);
    saveJSON(historyPath, history);
    return history;
});

// === Screenshot ===
ipcMain.handle('take-screenshot', async (e, webContentsId) => {
    try {
        const wc = webContents.fromId(webContentsId);
        if (!wc) return { success: false, message: 'Webview bulunamadı' };
        const image = await wc.capturePage();
        const { filePath } = await dialog.showSaveDialog(mainWindow, {
            defaultPath: `screenshot-${Date.now()}.png`,
            filters: [{ name: 'PNG', extensions: ['png'] }]
        });
        if (filePath) {
            fs.writeFileSync(filePath, image.toPNG());
            return { success: true, path: filePath };
        }
        return { success: false, message: 'İptal edildi' };
    } catch (err) {
        return { success: false, message: err.message };
    }
});

// === Shell ===
ipcMain.handle('open-external', (e, url) => { shell.openExternal(url); return true; });
ipcMain.handle('show-item-in-folder', (e, path) => { shell.showItemInFolder(path); return true; });
