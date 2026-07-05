const express = require('express');
const db = require('./db');
const { verifyToken, requireAdmin } = require('./auth');

const router = express.Router();

// GET all products
router.get('/products', verifyToken, (req, res) => {
    try {
        const products = db.prepare('SELECT * FROM products ORDER BY name').all();
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// GET low stock products (convenience route)
router.get('/products/low-stock', verifyToken, (req, res) => {
    try {
        const products = db.prepare('SELECT * FROM products WHERE stock_quantity <= reorder_threshold ORDER BY stock_quantity ASC').all();
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// GET single product by ID or barcode
router.get('/products/:id', verifyToken, (req, res) => {
    try {
        const { id } = req.params;
        // Check if id is numeric or barcode
        let product;
        if (!isNaN(id)) {
            product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
        }
        if (!product) {
            product = db.prepare('SELECT * FROM products WHERE barcode = ?').get(id);
        }

        if (!product) return res.status(404).json({ error: 'Product not found' });
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// POST new product (Admin only)
router.post('/products', verifyToken, requireAdmin, (req, res) => {
    const { name, sku, barcode, category, cost_price, selling_price, stock_quantity, reorder_threshold } = req.body;

    if (!name) return res.status(400).json({ error: 'Product name is required' });

    try {
        const insert = db.prepare(`
            INSERT INTO products (name, sku, barcode, category, cost_price, selling_price, stock_quantity, reorder_threshold)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = db.transaction(() => {
            const res = insert.run(
                name, sku || null, barcode || null, category || null,
                cost_price || 0, selling_price || 0, stock_quantity || 0, reorder_threshold || 0
            );

            // If initially added with stock, log the historical transaction
            if (stock_quantity > 0) {
                db.prepare(`
                    INSERT INTO inventory_transactions (product_id, change_qty, reason, user_id)
                    VALUES (?, ?, ?, ?)
                `).run(res.lastInsertRowid, stock_quantity, 'initial_stock', req.user.id);
            }
            return res.lastInsertRowid;
        })();

        res.status(201).json({ id: result });
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).json({ error: 'Barcode already exists' });
        }
        console.error(error);
        res.status(500).json({ error: 'Database error' });
    }
});

// PUT update product (Admin only)
router.put('/products/:id', verifyToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { name, sku, barcode, category, cost_price, selling_price, reorder_threshold } = req.body;

    try {
        const result = db.prepare(`
            UPDATE products 
            SET name = COALESCE(?, name),
                sku = ?,
                barcode = ?,
                category = ?,
                cost_price = COALESCE(?, cost_price),
                selling_price = COALESCE(?, selling_price),
                reorder_threshold = COALESCE(?, reorder_threshold)
            WHERE id = ?
        `).run(name, sku, barcode, category, cost_price, selling_price, reorder_threshold, id);

        if (result.changes === 0) return res.status(404).json({ error: 'Product not found' });
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error' });
    }
});

// DELETE product (Admin only)
router.delete('/products/:id', verifyToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    try {
        // Only allow deletion if no sales referencing it (or allow soft delete. We'll do simple delete but foreign keys might block it if attached to sale_items)
        db.prepare('DELETE FROM products WHERE id = ?').run(id);
        res.json({ success: true });
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
            return res.status(409).json({ error: 'Cannot delete product with existing sales history' });
        }
        res.status(500).json({ error: 'Database error' });
    }
});

// POST manual stock adjustment
router.post('/products/:id/stock', verifyToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { change_qty, reason } = req.body;

    if (!change_qty || !reason) {
        return res.status(400).json({ error: 'Change quantity and reason required' });
    }

    try {
        db.transaction(() => {
            const product = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(id);
            if (!product) throw new Error('NOT_FOUND');

            const newStock = product.stock_quantity + Number(change_qty);
            if (newStock < 0) throw new Error('NEGATIVE_STOCK');

            db.prepare('UPDATE products SET stock_quantity = ? WHERE id = ?').run(newStock, id);

            db.prepare(`
                INSERT INTO inventory_transactions (product_id, change_qty, reason, user_id)
                VALUES (?, ?, ?, ?)
            `).run(id, change_qty, reason, req.user.id);
        })();

        res.json({ success: true });
    } catch (error) {
        if (error.message === 'NOT_FOUND') return res.status(404).json({ error: 'Product not found' });
        if (error.message === 'NEGATIVE_STOCK') return res.status(400).json({ error: 'Adjustment would result in negative stock' });
        console.error(error);
        res.status(500).json({ error: 'Database error' });
    }
});

// GET inventory history (Admin only)
router.get('/transactions', verifyToken, requireAdmin, (req, res) => {
    try {
        const history = db.prepare(`
            SELECT it.*, p.name as product_name, u.username as user_name
            FROM inventory_transactions it
            JOIN products p ON p.id = it.product_id
            LEFT JOIN users u ON u.id = it.user_id
            ORDER BY it.timestamp DESC
            LIMIT 500
        `).all();
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
