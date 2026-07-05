// Standalone entry point for the Express server (dev mode without Electron)
const app = require('./backend/server');

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Express API running on http://localhost:${PORT}`);
});
