const express = require('express');
const db = require('./db');
const { verifyToken, requireAdmin } = require('./auth');

const router = express.Router();

// GET all customers
router.get('/', verifyToken, (req, res) => {
    try {
        const customers = db.prepare('SELECT * FROM customers ORDER BY name').all();
        res.json(customers);
    } catch (e) {
        res.status(500).json({ error: 'Database error' });
    }
});

// GET single customer
router.get('/:id', verifyToken, (req, res) => {
    try {
        const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
        if (!customer) return res.status(404).json({ error: 'Customer not found' });
        res.json(customer);
    } catch (e) {
        res.status(500).json({ error: 'Database error' });
    }
});

// POST create customer
router.post('/', verifyToken, (req, res) => {
    const { name, company_name, tax_id, matricule_fiscal, address, phone } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    try {
        const result = db.prepare(`
            INSERT INTO customers (name, company_name, tax_id, matricule_fiscal, address, phone)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(name, company_name, tax_id, matricule_fiscal, address, phone);

        res.status(201).json({ id: result.lastInsertRowid, name, company_name, tax_id, matricule_fiscal, address, phone });
    } catch (e) {
        res.status(500).json({ error: 'Database error' });
    }
});

// GET sales history for a customer
router.get('/:id/sales', verifyToken, (req, res) => {
    try {
        const sales = db.prepare(`
            SELECT s.id, s.type, s.invoice_number, s.total_cents, s.discount_cents, 
                   s.tax_cents, s.payment_method, s.created_at,
                   u.username as cashier_name
            FROM sales s
            JOIN users u ON u.id = s.user_id
            WHERE s.customer_id = ? AND s.status = 'completed'
            ORDER BY s.created_at DESC
        `).all(req.params.id);

        // For each sale, fetch its items
        const itemsStmt = db.prepare(`
            SELECT si.quantity, si.unit_price_cents, si.line_total_cents, p.name as product_name
            FROM sale_items si
            JOIN products p ON p.id = si.product_id
            WHERE si.sale_id = ?
        `);
        const result = sales.map(s => ({ ...s, items: itemsStmt.all(s.id) }));
        res.json(result);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Database error' });
    }
});

// PUT update customer
router.put('/:id', verifyToken, (req, res) => {
    const { name, company_name, tax_id, matricule_fiscal, address, phone } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    try {
        const info = db.prepare(`
            UPDATE customers
            SET name = ?, company_name = ?, tax_id = ?, matricule_fiscal = ?, address = ?, phone = ?
            WHERE id = ?
        `).run(name, company_name, tax_id, matricule_fiscal, address, phone, req.params.id);

        if (info.changes === 0) return res.status(404).json({ error: 'Customer not found' });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Database error' });
    }
});

// DELETE customer (admin only, or cashiers if authorized... let's say admin only)
router.delete('/:id', verifyToken, requireAdmin, (req, res) => {
    try {
        // Prevent deletion if they made purchases, or allow cascading. Better to fail if sales exist:
        const sales = db.prepare('SELECT count(*) as cnt FROM sales WHERE customer_id = ?').get(req.params.id);
        if (sales && sales.cnt > 0) {
            return res.status(400).json({ error: 'Cannot delete customer with past sales' });
        }

        const info = db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
        if (info.changes === 0) return res.status(404).json({ error: 'Customer not found' });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
