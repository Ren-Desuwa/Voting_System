<?php
require '../db.php';
$action = $_GET['action'] ?? 'list';

if ($action == 'list') {
    $stmt = $pdo->query("SELECT * FROM positions ORDER BY id ASC");
    echo json_encode($stmt->fetchAll());
} 
elseif ($action == 'add' && $_SERVER['REQUEST_METHOD'] == 'POST') {
    $stmt = $pdo->prepare("INSERT INTO positions (title) VALUES (?)");
    $stmt->execute([$_POST['title']]);
} 
elseif ($action == 'delete') {
    $stmt = $pdo->prepare("DELETE FROM positions WHERE id = ?");
    $stmt->execute([$_GET['id']]);
}
?>