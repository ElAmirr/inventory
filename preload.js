const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    printCurrent: () => ipcRenderer.send('print-current'),
    printHtml: (html) => ipcRenderer.send('print-html', html)
});
