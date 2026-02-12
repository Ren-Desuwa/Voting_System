<?php
// api/submit_vote.php
require '../db.php';
header('Content-Type: application/json');

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $token = $_SERVER['HTTP_X_AUTH_TOKEN'] ?? ''; // Expect token in headers

    // 1. SECURITY CHECK: Is Session Still Valid (PIN match)?
    $stmtSession = $pdo->prepare("
        SELECT s.* FROM sessions s
        JOIN settings st ON st.setting_key = 'daily_pin'
        WHERE s.session_token = ? 
        AND s.expires_at > NOW() 
        AND s.is_active = 1
    ");
    $stmtSession->execute([$token]);
    if (!$stmtSession->fetch()) {
        echo json_encode(['success' => false, 'message' => 'Session expired. PIN changed or day ended.']);
        exit;
    }

    // 2. SECURITY CHECK: Is Election Active?
    $stmt = $pdo->query("SELECT setting_value FROM settings WHERE setting_key = 'election_status'");
    $status = $stmt->fetchColumn();

    if ($status !== 'active') {
        echo json_encode(['success' => false, 'message' => 'Election is currently CLOSED.']);
        exit;
    }

    // 2. Process Vote
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) throw new Exception("No Data");

    $pdo->beginTransaction();

    $ghostCode = 'walkin_' . uniqid(); 
    $stmt = $pdo->prepare("INSERT INTO voters (voter_code, is_active) VALUES (?, 0)");
    $stmt->execute([$ghostCode]);
    $voterId = $pdo->lastInsertId();

    $stmtVote = $pdo->prepare("INSERT INTO votes (voter_id, position_id, candidate_id) VALUES (?, ?, ?)");
    
    foreach ($input as $posKey => $candidateId) {
        if (!$candidateId) continue;
        $posId = str_replace('pos_', '', $posKey);
        $valToInsert = ($candidateId === 'abstain') ? null : $candidateId;
        $stmtVote->execute([$voterId, $posId, $valToInsert]);
    }

    $pdo->commit();
    echo json_encode(['success' => true]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>