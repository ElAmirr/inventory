const express = require('express');
const db = require('./db');
const { verifyToken } = require('./auth');

const router = express.Router();

// customer routes moved to customers.js

// Helper for generating sequential facture numbers
function generateInvoiceNumber(db) {
    const year = new Date().getFullYear();
    // Get the highest invoice number for this year
    const row = db.prepare(`
        SELECT invoice_number FROM sales 
        WHERE type = 'facture' AND invoice_number LIKE ?
        ORDER BY id DESC LIMIT 1
    `).get(`INV-${year}-%`);

    let nextNum = 1;
    if (row && row.invoice_number) {
        const parts = row.invoice_number.split('-');
        if (parts.length === 3) {
            nextNum = parseInt(parts[2], 10) + 1;
        }
    }

    return `INV-${year}-${nextNum.toString().padStart(4, '0')}`;
}

// Create Sale
router.post('/sales', verifyToken, (req, res) => {
    const { type, total_cents, discount_cents, tax_cents, customer_id, payment_method, items } = req.body;

    if (type !== 'ticket' && type !== 'facture') return res.status(400).json({ error: 'Invalid sale type' });
    if (type === 'facture' && !customer_id) return res.status(400).json({ error: 'Facture requires a customer' });
    if (!items || !items.length) return res.status(400).json({ error: 'Sale must have items' });

    try {
        const result = db.transaction(() => {
            let invoiceNum = null;
            if (type === 'facture') {
                invoiceNum = generateInvoiceNumber(db);
            }

            // Insert master record
            const saleResult = db.prepare(`
                INSERT INTO sales (type, invoice_number, total_cents, discount_cents, tax_cents, user_id, customer_id, payment_method)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(type, invoiceNum, total_cents, discount_cents, tax_cents, req.user.id, customer_id || null, payment_method);

            const saleId = saleResult.lastInsertRowid;

            // Insert items and adjust stock
            const insertItem = db.prepare(`
                INSERT INTO sale_items (sale_id, product_id, quantity, unit_price_cents, line_total_cents)
                VALUES (?, ?, ?, ?, ?)
            `);

            const updateStock = db.prepare('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?');
            const insertHistory = db.prepare(`
                INSERT INTO inventory_transactions (product_id, change_qty, reason, user_id)
                VALUES (?, ?, ?, ?)
            `);

            for (const item of items) {
                // Ensure sufficient stock (could throw error here but retail often allows negative stock if scanning quickly, we'll allow it but log)
                insertItem.run(saleId, item.product_id, item.quantity, item.unit_price_cents, item.line_total_cents);
                updateStock.run(item.quantity, item.product_id);
                insertHistory.run(item.product_id, -item.quantity, 'sale', req.user.id);
            }

            return { sale_id: saleId, invoice_number: invoiceNum };
        })();

        res.status(201).json(result);
    } catch (e) {
        console.error('Sale error', e);
        res.status(500).json({ error: 'Failed to process sale' });
    }
});

// GET sales history
router.get('/sales', verifyToken, (req, res) => {
    // optional date range
    const { start_date, end_date } = req.query;
    let query = `
        SELECT s.*, u.username as cashier_name, c.name as customer_name 
        FROM sales s
        JOIN users u ON u.id = s.user_id
        LEFT JOIN customers c ON c.id = s.customer_id
        WHERE 1=1
    `;
    const params = [];

    if (start_date) {
        query += ' AND s.created_at >= ?';
        params.push(start_date);
    }
    if (end_date) {
        query += ' AND s.created_at <= ?';
        params.push(end_date);
    }

    // Cashiers only see their own
    if (req.user.role === 'cashier') {
        query += ' AND s.user_id = ?';
        params.push(req.user.id);
    }

    query += ' ORDER BY s.created_at DESC LIMIT 500';

    try {
        const sales = db.prepare(query).all(...params);
        res.json(sales);
    } catch (e) {
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
