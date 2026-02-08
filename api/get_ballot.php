<?php
require '../db.php';
header('Content-Type: application/json');

// 1. Fetch Positions
$stmt = $pdo->query("SELECT * FROM positions ORDER BY id ASC");
$positions = $stmt->fetchAll();

$response = ['positionNames' => [], 'candidates' => []];

foreach ($positions as $pos) {
    // We use the ID as the key (e.g., "pos_1")
    $key = 'pos_' . $pos['id'];
    $response['positionNames'][$key] = $pos['title'];
    
    // Fetch candidates for this position
    $stmtC = $pdo->prepare("SELECT id, full_name as name, photo_url as img, (SELECT name FROM parties WHERE id = candidates.party_id) as party FROM candidates WHERE position_id = ?");
    $stmtC->execute([$pos['id']]);
    $response['candidates'][$key] = $stmtC->fetchAll();
}

echo json_encode($response);
?>