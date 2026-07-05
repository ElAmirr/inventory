const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // We can add IPC communication here if needed later
    // e.g., getDatabasePath: () => ipcRenderer.invoke('get-db-path')
});
