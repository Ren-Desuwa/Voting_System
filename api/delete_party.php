<?php
// api/delete_party.php
require '../db.php';
header('Content-Type: application/json');

try {
    $partyId = $_POST['party_id'] ?? '';
    
    if (empty($partyId)) {
        throw new Exception("Party ID is required");
    }

    // Since we have ON DELETE CASCADE in the DB, this deletes candidates too.
    $stmt = $pdo->prepare("DELETE FROM parties WHERE id = ?");
    $stmt->execute([$partyId]);

    echo json_encode(['success' => true, 'message' => 'Party and its candidates deleted.']);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>