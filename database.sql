-- ═══════════════════════════════════════════════════════════
-- iSpark Invoice Management System — MySQL Database Setup
-- Run this ONCE to create all tables and default admin user
-- ═══════════════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS stem_invoice CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE stem_invoice;

-- ─── Users ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    username   VARCHAR(150) UNIQUE NOT NULL,
    email      VARCHAR(254) UNIQUE NOT NULL,
    password   VARCHAR(255) NOT NULL,
    first_name VARCHAR(150) DEFAULT '',
    last_name  VARCHAR(150) DEFAULT '',
    role       ENUM('admin','manager','accountant') DEFAULT 'manager',
    phone      VARCHAR(20) DEFAULT '',
    is_active  TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Schools ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schools (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(200) NOT NULL,
    contact    VARCHAR(100) NOT NULL,
    email      VARCHAR(254) UNIQUE NOT NULL,
    phone      VARCHAR(20) NOT NULL,
    students   INT DEFAULT 0,
    address    TEXT DEFAULT '',
    district   VARCHAR(100) DEFAULT '',
    state      VARCHAR(100) DEFAULT '',
    pincode    VARCHAR(10) DEFAULT '',
    status     VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Invoices ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    school_id      INT NOT NULL,
    invoice_type   ENUM('monthly','quarterly') NOT NULL,
    invoice_date   DATE NOT NULL,
    invoice_month  VARCHAR(7) DEFAULT '',
    financial_year VARCHAR(4) DEFAULT '',
    due_date       DATE NOT NULL,
    students       INT NOT NULL,
    rate           DECIMAL(10,2) NOT NULL,
    subtotal       DECIMAL(12,2) NOT NULL,
    gst            DECIMAL(12,2) NOT NULL,
    total          DECIMAL(12,2) NOT NULL,
    status         ENUM('draft','sent','paid','overdue','cancelled') DEFAULT 'draft',
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
);

-- ─── Payments ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id    INT NOT NULL,
    amount        DECIMAL(12,2) NOT NULL,
    tds_deducted  TINYINT(1) DEFAULT 0,
    tds_amount    DECIMAL(12,2) DEFAULT 0,
    net_amount    DECIMAL(12,2) DEFAULT 0,
    mode          ENUM('bank_transfer','cheque','upi','cash') NOT NULL,
    reference     VARCHAR(100) DEFAULT '',
    date          DATE NOT NULL,
    status        ENUM('completed','pending','failed') DEFAULT 'completed',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

-- ─── Sessions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    token      VARCHAR(512) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ─── Default Admin User ───────────────────────────────────
-- Username: admin  |  Password: admin123
INSERT IGNORE INTO users (username, email, password, first_name, last_name, role, phone, is_active)
VALUES (
  'admin',
  'admin@isparklearning.com',
  '$2y$10$TKh8H1.PfYkAfom1fBFe0.Op/mVrU1IbFfDaThTQnMIHvFLFW2Cqu',
  'Admin', 'User', 'admin', '9444014483', 1
);
-- Password hash above = 'admin123'
-- To set a different password, run in PHP:
--   echo password_hash('your_password', PASSWORD_BCRYPT);
-- Then UPDATE users SET password='<hash>' WHERE username='admin';
