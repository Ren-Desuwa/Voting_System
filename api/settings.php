<?php
require '../db.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $key = $_POST['key'] ?? '';
    $val = $_POST['value'] ?? '';
    
    // 1. Update the Setting (Standard behavior)
    $stmt = $pdo->prepare("REPLACE INTO settings (setting_key, setting_value) VALUES (?, ?)");
    $stmt->execute([$key, $val]);

    // 2. SECURITY TRIGGER: If the PIN is changed, invalidate ALL active sessions
    if ($key === 'daily_pin') {
        // This forces all currently logged-in users to re-enter the new PIN
        // We set is_active = 0 instead of DELETE to preserve login history logs
        $pdo->query("UPDATE sessions SET is_active = 0 WHERE is_active = 1");
        
        // Note: If you prefer to completely wipe the data, uncomment the line below:
        // $pdo->query("DELETE FROM sessions");
    }

    echo json_encode(['success' => true]);

} else {
    // GET Request - Fetch value
    $key = $_GET['key'] ?? '';
    $stmt = $pdo->prepare("SELECT setting_value as value FROM settings WHERE setting_key = ?");
    $stmt->execute([$key]);
    echo json_encode($stmt->fetch() ?: ['value' => 0]);
}
?>