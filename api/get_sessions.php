<?php
// api/get_sessions.php
// Returns all active sessions for admin viewing
require '../db.php';
header('Content-Type: application/json');

try {
    $stmt = $pdo->query("
        SELECT id, ip_address, user_agent, created_at, expires_at 
        FROM sessions 
        WHERE expires_at > NOW() AND is_active = 1 
        ORDER BY created_at DESC
    ");
    
    $sessions = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'sessions' => $sessions,
        'count' => count($sessions)
    ]);
    
} catch(Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>