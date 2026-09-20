const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

const appPath = __dirname;

contextBridge.exposeInMainWorld('akasAPI', {
    // App info
    getAppPath: () => appPath,
    getNewTabUrl: () => `file:///${path.join(appPath, 'new-tab.html').replace(/\\/g, '/')}`,

    // Tor
    getTorStatus: () => ipcRenderer.invoke('get-tor-status'),
    newTorIdentity: () => ipcRenderer.invoke('new-tor-identity'),
    onTorStatus: (cb) => ipcRenderer.on('tor-status', (e, data) => cb(data)),

    // Data
    clearData: () => ipcRenderer.invoke('clear-browsing-data'),
    getBlocklistInfo: () => ipcRenderer.invoke('get-blocklist-info'),

    // Bookmarks
    getBookmarks: () => ipcRenderer.invoke('get-bookmarks'),
    addBookmark: (bm) => ipcRenderer.invoke('add-bookmark', bm),
    removeBookmark: (id) => ipcRenderer.invoke('remove-bookmark', id),
    isBookmarked: (url) => ipcRenderer.invoke('is-bookmarked', url),

    // History
    getHistory: () => ipcRenderer.invoke('get-history'),
    addHistory: (entry) => ipcRenderer.invoke('add-history', entry),
    clearHistory: () => ipcRenderer.invoke('clear-history'),
    removeHistoryItem: (id) => ipcRenderer.invoke('remove-history-item', id),

    // Screenshot
    takeScreenshot: (webContentsId) => ipcRenderer.invoke('take-screenshot', webContentsId),

    // Shell
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    showItemInFolder: (path) => ipcRenderer.invoke('show-item-in-folder', path),

    // Navigation from main
    onNavigate: (cb) => ipcRenderer.on('navigate-to', (e, url) => cb(url))
});
