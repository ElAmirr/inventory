const { app, BrowserWindow } = require('electron');
const path = require('path');
let server = null;
try {
    const expressApp = require('./backend/server');
    const PORT = 3001;
    server = expressApp.listen(PORT, () => {
        console.log(`Express API running on port ${PORT} from Electron main process`);
    });
} catch (e) {
    console.log('Failed to start Express from Electron (Likely ABI mismatch in dev mode). Relying on standalone server_dev.js.');
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false, // Security best practice
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // In development mode, point to Vite's local dev server
    // In production mode, load the static built files from React
    const isDev = !app.isPackaged;

    if (isDev) {
        win.loadURL('http://localhost:5173');
        win.webContents.openDevTools();
    } else {
        win.loadFile(path.join(__dirname, 'frontend/dist/index.html'));
    }
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('will-quit', () => {
    if (server) {
        server.close();
    }
});
