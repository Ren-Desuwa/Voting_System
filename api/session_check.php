<?php
// api/session_check.php
// Validates if a session token is still valid
require '../db.php';
header('Content-Type: application/json');

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $token = $input['token'] ?? '';
    
    if(empty($token)) {
        echo json_encode(['valid' => false, 'message' => 'No token provided']);
        exit;
    }
    
    // Check if token exists and is not expired
    $stmt = $pdo->prepare("
        SELECT * FROM sessions 
        WHERE session_token = ? 
        AND expires_at > NOW() 
        AND is_active = 1
        LIMIT 1
    ");
    $stmt->execute([$token]);
    $session = $stmt->fetch();
    
    if($session) {
        echo json_encode([
            'valid' => true,
            'expires_at' => $session['expires_at'],
            'message' => 'Session is valid'
        ]);
    } else {
        echo json_encode([
            'valid' => false,
            'message' => 'Session expired or invalid'
        ]);
    }
    
} catch(Exception $e) {
    http_response_code(500);
    echo json_encode(['valid' => false, 'message' => 'Server error']);
}
?>