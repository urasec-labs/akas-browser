const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

const appPath = __dirname;

contextBridge.exposeInMainWorld('akasAPI', {
    getAppPath: () => appPath,
    getNewTabUrl: () => `file:///${path.join(appPath, 'new-tab.html').replace(/\\/g, '/')}`,

    getTorStatus: () => ipcRenderer.invoke('get-tor-status'),
    newTorIdentity: () => ipcRenderer.invoke('new-tor-identity'),
    onTorStatus: (cb) => ipcRenderer.on('tor-status', (e, data) => cb(data)),

    clearData: () => ipcRenderer.invoke('clear-browsing-data'),
    getBlocklistInfo: () => ipcRenderer.invoke('get-blocklist-info'),

    getBookmarks: () => ipcRenderer.invoke('get-bookmarks'),
    addBookmark: (bm) => ipcRenderer.invoke('add-bookmark', bm),
    removeBookmark: (id) => ipcRenderer.invoke('remove-bookmark', id),
    isBookmarked: (url) => ipcRenderer.invoke('is-bookmarked', url),

    getHistory: () => ipcRenderer.invoke('get-history'),
    addHistory: (entry) => ipcRenderer.invoke('add-history', entry),
    clearHistory: () => ipcRenderer.invoke('clear-history'),
    removeHistoryItem: (id) => ipcRenderer.invoke('remove-history-item', id),

    takeScreenshot: (webContentsId) => ipcRenderer.invoke('take-screenshot', webContentsId),

    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    showItemInFolder: (path) => ipcRenderer.invoke('show-item-in-folder', path),

    onNavigate: (cb) => ipcRenderer.on('navigate-to', (e, url) => cb(url)),

    getSettings: () => ipcRenderer.invoke('get-settings'),
    setSettings: (settings) => ipcRenderer.invoke('set-settings', settings),

    getTheme: () => ipcRenderer.invoke('get-theme'),
    setTheme: (theme) => ipcRenderer.invoke('set-theme', theme),
    onThemeChanged: (cb) => ipcRenderer.on('theme-changed', (e, theme) => cb(theme)),

    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    onUpdateStatus: (cb) => ipcRenderer.on('update-status', (e, status) => cb(status)),
    downloadUpdate: () => ipcRenderer.invoke('download-update'),
    installUpdate: () => ipcRenderer.invoke('install-update'),
});
