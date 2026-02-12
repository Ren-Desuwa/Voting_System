<?php
// vote/api/submit_vote.php
require '../db.php';
header('Content-Type: application/json');

try {
    // 1. DECODE INPUT
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Get token and votes from the JSON wrapper
    $token = $input['token'] ?? '';
    $votes = $input['votes'] ?? [];

    if (empty($token)) {
        throw new Exception('Authentication token missing.');
    }

    // 2. SECURITY CHECK: Is Session Valid?
    $stmtSession = $pdo->prepare("
        SELECT s.* FROM sessions s
        JOIN settings st ON st.setting_key = 'daily_pin'
        WHERE s.session_token = ? 
        AND s.expires_at > NOW() 
        AND s.is_active = 1
    ");
    $stmtSession->execute([$token]);
    if (!$stmtSession->fetch()) {
        throw new Exception('Session expired. Please re-login.');
    }

    // 3. SECURITY CHECK: Is Election Active?
    $stmt = $pdo->query("SELECT setting_value FROM settings WHERE setting_key = 'election_status'");
    $status = $stmt->fetchColumn();

    if ($status !== 'active') {
        throw new Exception('Election is currently CLOSED.');
    }

    // 4. PROCESS VOTES
    $pdo->beginTransaction();

    // Create Anonymous Voter Entry
    $ghostCode = 'voter_' . uniqid(); 
    $stmt = $pdo->prepare("INSERT INTO voters (voter_code, is_active) VALUES (?, 1)");
    $stmt->execute([$ghostCode]);
    $voterId = $pdo->lastInsertId();

    $stmtVote = $pdo->prepare("INSERT INTO votes (voter_id, position_id, candidate_id, voted_at) VALUES (?, ?, ?, NOW())");
    
    foreach ($votes as $posKey => $candidateId) {
        // Skip empty entries
        if ($candidateId === null || $candidateId === '') continue;
        
        // --- THE FIX IS HERE ---
        // Strip the 'pos_' prefix so 'pos_1' becomes just '1'
        $cleanPosId = str_replace('pos_', '', $posKey);
        
        // Handle Abstain
        $valToInsert = ($candidateId === 'abstain') ? null : $candidateId;
        
        $stmtVote->execute([$voterId, $cleanPosId, $valToInsert]);
    }

    // // 5. DISABLE SESSION (Prevent double voting)
    // $stmtDeactivate = $pdo->prepare("UPDATE sessions SET is_active = 0 WHERE session_token = ?");
    // $stmtDeactivate->execute([$token]);

    $pdo->commit();
    echo json_encode(['success' => true]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log("Vote Error: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Database Error: ' . $e->getMessage()]);
}
?>