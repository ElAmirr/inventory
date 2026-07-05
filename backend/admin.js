const express = require('express');
const bcrypt = require('bcrypt');
const { verifyToken, requireAdmin } = require('./auth');

module.exports = (db) => {
    const router = express.Router();

    // Use admin middleware for all routes in this router
    router.use(verifyToken);
    router.use(requireAdmin);

    // ==========================================
    // USERS MANAGEMENT
    // ==========================================

    router.get('/users', (req, res) => {
        try {
            const users = db.prepare('SELECT id, username, role, created_at FROM users ORDER BY created_at DESC').all();
            res.json(users);
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'Failed to fetch users' });
        }
    });

    router.post('/users', async (req, res) => {
        const { username, password, role } = req.body;
        if (!username || !password || !role) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        try {
            const password_hash = await bcrypt.hash(password, 10);
            const insert = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)');
            const info = insert.run(username, password_hash, role);

            res.status(201).json({ id: info.lastInsertRowid, username, role });
        } catch (e) {
            console.error(e);
            if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                return res.status(400).json({ error: 'Username already exists' });
            }
            res.status(500).json({ error: 'Failed to create user' });
        }
    });

    router.delete('/users/:id', (req, res) => {
        const id = req.params.id;
        try {
            // Check if user exists
            const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(id);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Prevent deleting the very last admin
            if (user.role === 'admin') {
                const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get().count;
                if (adminCount <= 1) {
                    return res.status(400).json({ error: 'Cannot delete the last administrator account' });
                }
            }

            db.prepare('DELETE FROM users WHERE id = ?').run(id);
            res.json({ message: 'User deleted' });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'Failed to delete user' });
        }
    });

    // ==========================================
    // CATEGORIES MANAGEMENT
    // ==========================================

    router.get('/categories', (req, res) => {
        try {
            const categories = db.prepare('SELECT * FROM categories ORDER BY name ASC').all();
            res.json(categories);
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'Failed to fetch categories' });
        }
    });

    router.post('/categories', (req, res) => {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Missing category name' });
        }

        try {
            const insert = db.prepare('INSERT INTO categories (name) VALUES (?)');
            const info = insert.run(name);
            res.status(201).json({ id: info.lastInsertRowid, name });
        } catch (e) {
            console.error(e);
            if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                return res.status(400).json({ error: 'Category already exists' });
            }
            res.status(500).json({ error: 'Failed to create category' });
        }
    });

    router.delete('/categories/:id', (req, res) => {
        const id = req.params.id;
        try {
            db.prepare('DELETE FROM categories WHERE id = ?').run(id);
            res.json({ message: 'Category deleted' });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'Failed to delete category' });
        }
    });

    // ==========================================
    // SETTINGS MANAGEMENT (ENTERPRISE)
    // ==========================================

    router.get('/settings', (req, res) => {
        try {
            const rows = db.prepare('SELECT * FROM settings').all();
            const settings = {};
            rows.forEach(r => settings[r.setting_key] = r.setting_value);
            res.json(settings);
        } catch (e) {
            res.status(500).json({ error: 'Database error' });
        }
    });

    router.put('/settings', (req, res) => {
        const updates = req.body; // Expecting { store_name: "...", store_mf: "..." }
        try {
            const stmt = db.prepare('INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value');
            const transaction = db.transaction(() => {
                for (const [key, value] of Object.entries(updates)) {
                    stmt.run(key, value);
                }
            });
            transaction();
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: 'Database error' });
        }
    });

    return router;
};
