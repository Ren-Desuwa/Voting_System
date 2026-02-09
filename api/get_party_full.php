<?php
// api/get_party_full.php
// Fetches complete party information including all candidates
require '../db.php';
header('Content-Type: application/json');

try {
    $partyName = $_GET['name'] ?? '';
    
    if(empty($partyName)) {
        echo json_encode(['success' => false, 'message' => 'Party name required']);
        exit;
    }
    
    // 1. Get Party Details
    $stmt = $pdo->prepare("SELECT * FROM parties WHERE name = ?");
    $stmt->execute([$partyName]);
    $party = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if(!$party) {
        echo json_encode(['success' => false, 'message' => 'Party not found']);
        exit;
    }
    
    // 2. Get All Candidates for This Party
    $stmt = $pdo->prepare("
        SELECT c.*, p.title as position_title 
        FROM candidates c 
        LEFT JOIN positions p ON c.position_id = p.id 
        WHERE c.party_id = ? 
        ORDER BY c.id ASC
    ");
    $stmt->execute([$party['id']]);
    $party['candidates'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'data' => $party
    ]);
    
} catch(Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>