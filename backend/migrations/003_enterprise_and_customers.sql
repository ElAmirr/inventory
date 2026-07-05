-- Migration 003: Enterprise settings and expanded customer schema

-- Create settings table a key-value store for enterprise information
CREATE TABLE IF NOT EXISTS settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES 
('store_name', 'RETAIL SHOP'),
('store_mf', '1234567/X/A/B/000'),
('store_address', '123 Avenue des Champs-Élysées, 75008 Paris, France'),
('store_phone', '+33 1 23 45 67 89');

-- Expand customer schema (address and tax_id already exist but we add specific phone and matricule_fiscal)
ALTER TABLE customers ADD COLUMN matricule_fiscal TEXT;
ALTER TABLE customers ADD COLUMN phone TEXT;
