const fs = require('fs');
const path = require('path');
const db = require('./db');

function runMigrations() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
        fs.mkdirSync(migrationsDir);
    }

    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

    const executedList = db.prepare('SELECT name FROM migrations').all();
    const executed = executedList.map(row => row.name);

    for (const file of files) {
        if (!executed.includes(file)) {
            console.log(`Running migration: ${file}`);
            const filePath = path.join(migrationsDir, file);
            const sql = fs.readFileSync(filePath, 'utf8');

            const transaction = db.transaction(() => {
                db.exec(sql);
                db.prepare('INSERT INTO migrations (name) VALUES (?)').run(file);
            });

            try {
                transaction();
                console.log(`Migration ${file} executed successfully.`);
            } catch (err) {
                console.error(`Migration ${file} failed:`, err);
                throw err;
            }
        }
    }
}

module.exports = runMigrations;
