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

// ─── Helper: save PDF and open with system viewer (Fallback) ──────────────────
async function printToPdfAndOpen(webContents) {
    try {
        const { fs } = require('fs'); // fallback if not global
        const fileSys = fs || require('fs');
        const pdfBuffer = await webContents.printToPDF({
            printBackground: true,
            pageSize: 'A4',
            marginsType: 1 // minimal margins
        });
        const tmpPath = path.join(app.getPath('temp'), `impression-${Date.now()}.pdf`);
        fileSys.writeFileSync(tmpPath, pdfBuffer);
        const { shell } = require('electron');
        shell.openPath(tmpPath);
    } catch (err) {
        dialog.showErrorBox('Erreur PDF', `Impossible de générer le PDF :\n${err.message}`);
    }
}

// ─── Helper: Smart Print (Try Silent, Fallback to PDF) ────────────────────────
function printSmart(webContents, parentWindowToClose = null) {
    webContents.print(
        { silent: true, printBackground: true },
        async (success, errorType) => {
            if (!success) {
                console.log(`Silent print failed (${errorType}). Falling back to PDF...`);
                await printToPdfAndOpen(webContents);
            }
            if (parentWindowToClose) {
                setTimeout(() => parentWindowToClose.destroy(), 1500);
            }
        }
    );
}

// ─── Print IPC: print current window ──────────────────────────────────────────
ipcMain.on('print-current', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        printSmart(win.webContents);
    }
});

// ─── Print IPC: render arbitrary HTML then print ─────────────────────────────
ipcMain.on('print-html', (event, htmlContent) => {
    const workerWin = new BrowserWindow({ show: false });
    workerWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    workerWin.webContents.once('did-finish-load', () => {
        // Wait for fonts/layout to settle before generating PDF or printing
        setTimeout(() => {
            printSmart(workerWin.webContents, workerWin);
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
