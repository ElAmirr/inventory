const express = require('express');
const db = require('./db');
const { verifyToken, requireAdmin } = require('./auth');

const router = express.Router();

// Get sales summary and profit
router.get('/summary', verifyToken, requireAdmin, (req, res) => {
    const { start_date, end_date } = req.query;

    // Default to last 30 days if no dates provided
    const startDateParam = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDateParam = end_date || new Date().toISOString().split('T')[0];

    try {
        const result = db.prepare(`
            SELECT 
                COUNT(*) as transaction_count,
                SUM(s.total_cents) as total_revenue,
                SUM(s.tax_cents) as total_tax,
                SUM(s.discount_cents) as total_discounts,
                SUM((
                    SELECT SUM(si.quantity * p.cost_price)
                    FROM sale_items si
                    JOIN products p ON p.id = si.product_id
                    WHERE si.sale_id = s.id
                )) as total_cost
            FROM sales s
            WHERE s.created_at >= ? AND s.created_at <= ? || ' 23:59:59'
            AND s.status = 'completed'
        `).get(startDateParam, endDateParam);

        result.total_profit = (result.total_revenue || 0) - (result.total_tax || 0) - (result.total_cost || 0);

        res.json(result);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Database error' });
    }
});

// Best Selling Products
router.get('/best-sellers', verifyToken, requireAdmin, (req, res) => {
    const { start_date, end_date } = req.query;
    const startDateParam = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDateParam = end_date || new Date().toISOString().split('T')[0];

    try {
        const result = db.prepare(`
            SELECT 
                p.id, p.name, p.barcode,
                SUM(si.quantity) as units_sold,
                SUM(si.line_total_cents) as revenue
            FROM sale_items si
            JOIN sales s ON s.id = si.sale_id
            JOIN products p ON p.id = si.product_id
            WHERE s.created_at >= ? AND s.created_at <= ? || ' 23:59:59'
            AND s.status = 'completed'
            GROUP BY p.id
            ORDER BY units_sold DESC
            LIMIT 20
        `).all(startDateParam, endDateParam);

        res.json(result);
    } catch (e) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Breakdown (Details vs Aggregates)
router.get('/breakdown', verifyToken, requireAdmin, (req, res) => {
    const { filter_type, start_date, end_date } = req.query;

    // Fallbacks
    const startDateParam = start_date || new Date().toISOString().split('T')[0];
    const endDateParam = end_date || new Date().toISOString().split('T')[0];

    try {
        if (filter_type === 'day') {
            // Detailed individual transactions for exactly one day
            const query = `
                SELECT s.id, s.invoice_number, s.total_cents, s.discount_cents, s.tax_cents, 
                       s.payment_method, s.created_at, s.type,
                       u.username as cashier_name, c.name as customer_name
                FROM sales s
                JOIN users u ON u.id = s.user_id
                LEFT JOIN customers c ON c.id = s.customer_id
                WHERE s.created_at >= ? AND s.created_at <= ? || ' 23:59:59'
                AND s.status = 'completed'
                ORDER BY s.created_at DESC
            `;
            const results = db.prepare(query).all(startDateParam, endDateParam);
            res.json({ type: 'details', data: results });
        } else {
            // Daily aggregates for week or month
            const query = `
                SELECT 
                    DATE(s.created_at) as sale_date,
                    COUNT(*) as transaction_count,
                    SUM(s.total_cents) as total_revenue
                FROM sales s
                WHERE s.created_at >= ? AND s.created_at <= ? || ' 23:59:59'
                AND s.status = 'completed'
                GROUP BY DATE(s.created_at)
                ORDER BY sale_date DESC
            `;
            const results = db.prepare(query).all(startDateParam, endDateParam);
            res.json({ type: 'aggregates', data: results });
        }
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
