<?php
// api/clear_sessions.php
// Clears all active sessions (forces all clients to re-authenticate)
require '../db.php';
header('Content-Type: application/json');

try {
    // Delete all sessions
    $stmt = $pdo->query("DELETE FROM sessions");
    $deletedCount = $stmt->rowCount();
    
    echo json_encode([
        'success' => true,
        'message' => "Cleared {$deletedCount} session(s). All clients must re-enter PIN.",
        'cleared_count' => $deletedCount
    ]);
    
} catch(Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>