-- Fixed Database Schema with PIN Authentication
-- database.sql

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+08:00";

CREATE DATABASE IF NOT EXISTS voting_system;
USE voting_system;

-- 1. Settings Table (Stores global configuration)
CREATE TABLE IF NOT EXISTS settings (
    setting_key VARCHAR(50) PRIMARY KEY,
    setting_value VARCHAR(255)
);

INSERT INTO settings (setting_key, setting_value) VALUES 
('total_voters', '500'),
('daily_pin', '1234'),
('pin_updated_date', CURDATE())
ON DUPLICATE KEY UPDATE setting_key=setting_key;

-- 2. Sessions Table (For PIN-based authentication)
CREATE TABLE IF NOT EXISTS sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_token VARCHAR(64) UNIQUE NOT NULL,
    ip_address VARCHAR(45),
    user_agent VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    is_active TINYINT DEFAULT 1,
    INDEX idx_token (session_token),
    INDEX idx_expires (expires_at)
);

-- 3. Positions Table (Dynamic positions with priority ordering)
CREATE TABLE IF NOT EXISTS positions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    max_votes INT DEFAULT 1,
    priority INT DEFAULT 99
);

-- Insert sample positions
INSERT INTO positions (id, title, priority) VALUES 
(1, 'President', 1),
(2, 'Vice President', 2),
(3, 'Secretary', 3),
(4, 'Treasurer', 4),
(5, 'Grade 11 Representative', 5),
(6, 'Grade 12 Representative', 6)
ON DUPLICATE KEY UPDATE title=VALUES(title);

-- 4. Parties Table (With logo, slogan, color)
CREATE TABLE IF NOT EXISTS parties (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slogan VARCHAR(255),
    color VARCHAR(20) DEFAULT '#cccccc',
    logo_url VARCHAR(255)
);

-- Insert sample parties
INSERT INTO parties (id, name, slogan, color, logo_url) VALUES 
(1, 'SINAG', 'Lighting the Path Forward', '#f1c40f', NULL),
(2, 'IGNITE', 'Spark the Change', '#e74c3c', NULL),
(3, 'Independent', 'Voice of the People', '#95a5a6', NULL)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- 5. Candidates Table
CREATE TABLE IF NOT EXISTS candidates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    position_id INT NOT NULL,
    party_id INT NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    photo_url VARCHAR(255),
    FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE CASCADE,
    FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE
);

-- Insert sample candidates
INSERT INTO candidates (position_id, party_id, full_name, photo_url) VALUES 
-- President
(1, 1, 'Juan Dela Cruz', 'assets/candidates/Sample1.jpg'),
(1, 2, 'Maria Santos', 'assets/candidates/Sample2.jpg'),
(1, 3, 'Pedro Reyes', 'assets/candidates/Sample3.jpg'),
-- Vice President
(2, 1, 'Ana Garcia', 'assets/candidates/Sample4.jpg'),
(2, 2, 'Carlos Mendoza', NULL),
-- Secretary
(3, 1, 'Lisa Fernandez', NULL),
(3, 2, 'Miguel Torres', NULL),
-- Treasurer
(4, 1, 'Sofia Rodriguez', NULL),
(4, 2, 'Diego Martinez', NULL),
-- Grade 11 Rep
(5, 1, 'Elena Cruz', NULL),
(5, 2, 'Ramon Aquino', NULL),
(5, 3, 'Isabel Ramos', NULL),
-- Grade 12 Rep
(6, 1, 'Gabriel Santos', NULL),
(6, 2, 'Carmen Valdez', NULL)
ON DUPLICATE KEY UPDATE full_name=VALUES(full_name);

-- 6. Voters Table (For tracking unique voters)
CREATE TABLE IF NOT EXISTS voters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    voter_code VARCHAR(50) NOT NULL UNIQUE,
    is_active TINYINT DEFAULT 1
);

-- 7. Votes Table
CREATE TABLE IF NOT EXISTS votes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    voter_id INT NOT NULL,
    position_id INT NOT NULL,
    candidate_id INT NOT NULL,
    voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (voter_id) REFERENCES voters(id) ON DELETE CASCADE,
    FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE CASCADE,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    -- Constraint: One vote per position per voter
    UNIQUE KEY unique_vote (voter_id, position_id)
);

-- 8. Cleanup old sessions (runs on database initialization)
DELETE FROM sessions WHERE expires_at < NOW();

COMMIT;