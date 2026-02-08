<?php
require '../db.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $key = $_POST['key'];
    $val = $_POST['value'];
    // Update or Insert
    $stmt = $pdo->prepare("REPLACE INTO settings (setting_key, setting_value) VALUES (?, ?)");
    $stmt->execute([$key, $val]);
} else {
    $key = $_GET['key'];
    $stmt = $pdo->prepare("SELECT setting_value as value FROM settings WHERE setting_key = ?");
    $stmt->execute([$key]);
    echo json_encode($stmt->fetch() ?: ['value' => 0]);
}
?>