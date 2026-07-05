const Database = require('better-sqlite3');
const path = require('path');

// Safely try to get Electron's userData path; fall back to a local dev file
let dbPath;
try {
    const { app } = require('electron');
    if (app && app.getPath) {
        dbPath = path.join(app.getPath('userData'), 'database.sqlite');
    } else {
        dbPath = path.join(__dirname, '..', 'dev_database.sqlite');
    }
} catch (e) {
    // Not running inside Electron (e.g. standalone Express for dev/testing)
    dbPath = path.join(__dirname, '..', 'dev_database.sqlite');
}

console.log(`Using database at: ${dbPath}`);

const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL'); // Better concurrent read performance

module.exports = db;
