const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

const PORT = 3001;
let server = null;

// ─── Start the Express backend ────────────────────────────────────────────────
function startBackend() {
    return new Promise((resolve, reject) => {
        try {
            const expressApp = require('./backend/server');
            server = expressApp.listen(PORT, '127.0.0.1', () => {
                console.log(`Backend running on port ${PORT}`);
                resolve();
            });
            server.on('error', reject);
        } catch (err) {
            reject(err);
        }
    });
}

// ─── Poll until the health endpoint is up ─────────────────────────────────────
function waitForBackend(retries = 20, delayMs = 500) {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const check = () => {
            const req = http.get(`http://127.0.0.1:${PORT}/api/health`, (res) => {
                if (res.statusCode === 200) {
                    resolve();
                } else {
                    retry();
                }
            });
            req.on('error', retry);
            req.setTimeout(300, () => { req.destroy(); retry(); });
        };
        const retry = () => {
            attempts++;
            if (attempts >= retries) return reject(new Error('Backend did not start in time'));
            setTimeout(check, delayMs);
        };
        check();
    });
}

// ─── Create the main window ───────────────────────────────────────────────────
function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 820,
        show: false,
        backgroundColor: '#f8f9fb',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    const isDev = !app.isPackaged;

    if (isDev) {
        win.loadURL('http://localhost:5173');
        win.webContents.openDevTools();
    } else {
        win.loadFile(path.join(__dirname, 'frontend/dist/index.html'));
    }

    win.once('ready-to-show', () => win.show());
}

// ─── Helper: print content directly to default printer ────────────────────────
function printDirect(webContents) {
    webContents.print(
        { silent: true, printBackground: true },
        (success, errorType) => {
            if (!success) {
                dialog.showErrorBox(
                    'Erreur d\'impression',
                    `Impossible d'imprimer. Vérifiez qu'une imprimante par défaut est configurée.\n\nDétail : ${errorType}`
                );
            }
        }
    );
}

// ─── Print IPC: print current page directly ───────────────────────────────────
ipcMain.on('print-current', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        printDirect(win.webContents);
    }
});

// ─── Print IPC: render arbitrary HTML then print directly ─────────────────────
ipcMain.on('print-html', (event, htmlContent) => {
    const workerWin = new BrowserWindow({ show: false });
    workerWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    workerWin.webContents.once('did-finish-load', () => {
        // Wait for fonts/layout to settle before printing
        setTimeout(() => {
            printDirect(workerWin.webContents);
            // Close the window after a reasonable time to allow the print job to spool
            setTimeout(() => workerWin.destroy(), 3000);
        }, 600);
    });
});


// ─── App entry point ─────────────────────────────────────────────────────────
app.whenReady().then(async () => {
    const isDev = !app.isPackaged;

    if (!isDev) {
        try {
            await startBackend();
            await waitForBackend();
        } catch (err) {
            dialog.showErrorBox(
                'Erreur de démarrage',
                `Le serveur n'a pas pu démarrer :\n\n${err.message}\n\nL'application va se fermer.`
            );
            app.quit();
            return;
        }
    }

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
    if (server) server.close();
});
