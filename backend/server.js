const express = require('express');
const cors = require('cors');
const db = require('./db');
const runMigrations = require('./migrations');
const { router: authRouter } = require('./auth');
const inventoryRouter = require('./inventory');
const customersRouter = require('./customers');
const salesRouter = require('./sales');
const reportsRouter = require('./reports');
const adminRouter = require('./admin')(db);

// Run migrations on startup
runMigrations();

const app = express();
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', authRouter);
app.use('/api', inventoryRouter);
app.use('/api/customers', customersRouter);
app.use('/api', salesRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/admin', adminRouter);

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date() });
});

// Simple Hello World endpoint to verify connectivity
app.get('/api/hello', (req, res) => {
    res.json({ message: 'Hello from Express API server!' });
});

module.exports = app;
