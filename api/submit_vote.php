<?php
require '../db.php';
header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true);

try {
    $pdo->beginTransaction();

    // 1. Create a "Ghost" Voter entry
    // We generate a random unique ID like "walkin_65c3a..." so the DB constraint is happy
    $ghostCode = 'walkin_' . uniqid(); 
    
    // Insert into voters table to get a valid ID
    $stmt = $pdo->prepare("INSERT INTO voters (voter_code, is_active) VALUES (?, 0)");
    $stmt->execute([$ghostCode]);
    $voterId = $pdo->lastInsertId();

    // 2. Insert Votes linked to this new ID
    $stmtVote = $pdo->prepare("INSERT INTO votes (voter_id, position_id, candidate_id) VALUES (?, ?, ?)");
    
    foreach ($input as $posKey => $candidateId) {
        if (!$candidateId) continue;
        
        // Extract ID from "pos_1"
        $posId = str_replace('pos_', '', $posKey);
        $valToInsert = ($candidateId === 'abstain') ? null : $candidateId;
        $stmtVote->execute([$voterId, $posId, $valToInsert]); //
    }

    $pdo->commit();
    echo json_encode(['success' => true]);

} catch (Exception $e) {
    $pdo->rollBack();
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>