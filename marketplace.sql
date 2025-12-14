-- database/marketplace.sql
CREATE DATABASE IF NOT EXISTS template_marketplace;
USE template_marketplace;

-- Admin credentials table
CREATE TABLE admins (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100),
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Platform settings
CREATE TABLE platform_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    platform_name VARCHAR(100) DEFAULT 'PromptTemplates',
    logo_url VARCHAR(255),
    contact_phone VARCHAR(20),
    contact_email VARCHAR(100),
    tiktok_url VARCHAR(255),
    facebook_url VARCHAR(255),
    mpesa_business_number VARCHAR(20),
    mpesa_passkey VARCHAR(255),
    mpesa_consumer_key VARCHAR(255),
    mpesa_consumer_secret VARCHAR(255),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Website templates
CREATE TABLE templates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    background_url VARCHAR(255),
    zip_file_url VARCHAR(255) NOT NULL,
    preview_html TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    downloads_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Users (for purchases)
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20) NOT NULL,
    full_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Purchases/payments
CREATE TABLE purchases (
    id INT PRIMARY KEY AUTO_INCREMENT,
    transaction_id VARCHAR(50) UNIQUE NOT NULL,
    user_id INT,
    template_id INT,
    amount DECIMAL(10,2) NOT NULL,
    mpesa_receipt VARCHAR(50),
    phone_number VARCHAR(20) NOT NULL,
    status ENUM('pending', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
    download_url VARCHAR(255),
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (template_id) REFERENCES templates(id)
);

-- Failed payment attempts
CREATE TABLE failed_payments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    transaction_id VARCHAR(50),
    phone_number VARCHAR(20),
    amount DECIMAL(10,2),
    error_message TEXT,
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO admins (username, password_hash, email) 
VALUES ('admin', '$2y$10$YourHashedPasswordHere', 'admin@marketplace.com');

INSERT INTO platform_settings (platform_name, contact_phone, contact_email) 
VALUES ('PromptTemplates', '+254 700 000 000', 'support@prompttemplates.com');