-- Insert default admin user if it does not exist
-- Default username: admin, Password: admin (hash generated fresh)
INSERT INTO users (username, password_hash, role)
SELECT 'admin', '$2b$10$LZL0m27BmZn3RFxdUGFktugo6buYxMwVrTi.T78ozepmhOnpWFxc2', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin');
