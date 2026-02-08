<?php
// api/auth_pin.php
// Validates PIN and creates a session token that lasts until end of day
require '../db.php';
header('Content-Type: application/json');

// Enable sessions
session_start();

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $enteredPin = $input['pin'] ?? '';
    
    if(empty($enteredPin)) {
        echo json_encode(['success' => false, 'message' => 'PIN is required']);
        exit;
    }
    
    // 1. Get the current daily PIN from settings
    $stmt = $pdo->prepare("SELECT setting_value FROM settings WHERE setting_key = 'daily_pin'");
    $stmt->execute();
    $result = $stmt->fetch();
    $correctPin = $result['setting_value'] ?? '';
    
    // 2. Validate PIN
    if($enteredPin !== $correctPin) {
        echo json_encode(['success' => false, 'message' => 'Incorrect PIN. Please try again.']);
        exit;
    }
    
    // 3. Generate unique session token
    $sessionToken = bin2hex(random_bytes(32));
    
    // 4. Calculate expiration (end of current day in Philippine Time)
    date_default_timezone_set('Asia/Manila');
    $expiresAt = date('Y-m-d 23:59:59');
    
    // 5. Get client info
    $ipAddress = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';
    
    // 6. Insert session into database
    $stmt = $pdo->prepare("
        INSERT INTO sessions (session_token, ip_address, user_agent, expires_at) 
        VALUES (?, ?, ?, ?)
    ");
    $stmt->execute([$sessionToken, $ipAddress, $userAgent, $expiresAt]);
    
    // 7. Also store in PHP session for backup
    $_SESSION['auth_token'] = $sessionToken;
    $_SESSION['authenticated'] = true;
    
    echo json_encode([
        'success' => true,
        'token' => $sessionToken,
        'expires_at' => $expiresAt,
        'message' => 'Authentication successful'
    ]);
    
} catch(Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
}
?>