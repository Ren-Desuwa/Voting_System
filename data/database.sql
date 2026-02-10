-- Fixed Database Schema with Images
-- database.sql

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+08:00";

CREATE DATABASE IF NOT EXISTS voting_system;
USE voting_system;

-- 1. Settings Table
CREATE TABLE IF NOT EXISTS settings (
    setting_key VARCHAR(50) PRIMARY KEY,
    setting_value VARCHAR(255)
);

INSERT INTO settings (setting_key, setting_value) VALUES 
('total_voters', '500'),
('daily_pin', '1234'),
('pin_updated_date', CURDATE())
ON DUPLICATE KEY UPDATE setting_key=setting_key;

-- 2. Sessions Table
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

-- 3. Positions Table
CREATE TABLE IF NOT EXISTS positions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    max_votes INT DEFAULT 1,
    priority INT DEFAULT 99
);

INSERT INTO positions (id, title, priority) VALUES 
(1, 'President', 1),
(2, 'Vice President', 2),
(3, 'Secretary', 3),
(4, 'Treasurer', 4),
(5, 'Auditor', 5),
(6, 'Protocol Officer', 6),
(7, 'PIO', 7),
(8, 'Grade 12 Representative', 8)
ON DUPLICATE KEY UPDATE title=VALUES(title);

-- 4. Parties Table
CREATE TABLE IF NOT EXISTS parties (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slogan VARCHAR(255),
    color VARCHAR(20) DEFAULT '#cccccc',
    logo_url VARCHAR(255) DEFAULT NULL
);

INSERT INTO parties (id, name, slogan, color, logo_url) VALUES 
(1, 'SINAG', 'Lighting the Path Forward', '#f1c40f', NULL),
(2, 'IGNITE', 'Spark the Change', '#e74c3c', 'assets/candidates/Ignite/GROUP PHOTO.png'),
(3, 'Independent', 'Voice of the People', '#95a5a6', NULL)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- 5. Candidates Table
CREATE TABLE IF NOT EXISTS candidates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    position_id INT NOT NULL,
    party_id INT NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    photo_url VARCHAR(255) DEFAULT NULL,
    FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE CASCADE,
    FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE
);

-- Insert Candidates with EXACT filenames from your latest screenshot
INSERT INTO candidates (position_id, party_id, full_name, photo_url) VALUES 

-- === SINAG PARTY (Party ID 1) ===
(1, 1, 'Charles Arwin O. Garcia',  'assets/candidates/Sinag/Charles Arwin Garcia.png'),
(3, 1, 'Princess Elvie F. David',  'assets/candidates/Sinag/Princess Elvie David.jpg'),
(4, 1, 'Marievill R. Delos Reyes', 'assets/candidates/Sinag/Marievill Delos Reyes.jpeg'),
(5, 1, 'Louisa Anne B. Rivera',    'assets/candidates/Sinag/Louisa Anne Rivera.jpg'),
(7, 1, 'Jhaycelyn Delos Angeles',  'assets/candidates/Sinag/Jhaycelyn Delos Angeles.jpg'),
(6, 1, 'Jhamina Castro',           'assets/candidates/Sinag/Jhamina Castro.jpg'),
(8, 1, 'Santina M. Facistol',      'assets/candidates/Sinag/Santina M. Facistol.png'),

-- === IGNITE PARTY (Party ID 2) ===
(1, 2, 'Symon D. Bandivas',           'assets/candidates/Ignite/Symon D. Bandivas (President).png'),
(2, 2, 'Sharpaigne B. Delos Reyes',   'assets/candidates/Ignite/Sharpaigne B. Delos Reyes(Vice President).jpg'),
(3, 2, 'Sofia Allyson A. Oba',        'assets/candidates/Ignite/Sofia Allyson A. Oba (SECRETARY).jpg'),
(5, 2, 'Lyanna Mickael I. Delequeña', 'assets/candidates/Ignite/Lyanna Mickael I. Delequeña(Auditor).jpg'),
(6, 2, 'Paul Anthony H. Maluya',      'assets/candidates/Ignite/Paul Anthony H. Maluya (P.O).jpeg'),
(8, 2, 'Khristine H. Borja',          'assets/candidates/Ignite/Khristine H. Borja( GRADE 12 REPRESENTATIVE).png'),

-- === INDEPENDENT (Party ID 3) ===
(2, 3, 'Keisha Eunizce G. Atchico', 'assets/candidates/independent/Keisha.jpg')

ON DUPLICATE KEY UPDATE full_name=VALUES(full_name), photo_url=VALUES(photo_url);

-- 6. Voters Table
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
    candidate_id INT NULL,
    voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (voter_id) REFERENCES voters(id) ON DELETE CASCADE,
    FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE CASCADE,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    UNIQUE KEY unique_vote (voter_id, position_id)
);

-- 8. Cleanup old sessions
DELETE FROM sessions WHERE expires_at < NOW();

COMMIT;