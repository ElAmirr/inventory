CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert some default categories
INSERT INTO categories (name) VALUES ('Vêtements');
INSERT INTO categories (name) VALUES ('Électronique');
INSERT INTO categories (name) VALUES ('Accessoires');
