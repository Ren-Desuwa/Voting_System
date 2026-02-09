<?php
// api/save_party_batch.php
require '../db.php';
header('Content-Type: application/json');

// Enable error reporting
ini_set('display_errors', 0);
error_reporting(E_ALL);

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Invalid request method');
    }

    $pdo->beginTransaction();

    // 1. COLLECT PARTY DATA
    $partyId = $_POST['party_id'] ?? '';
    $name = trim($_POST['party_name'] ?? 'Untitled Party');
    $slogan = trim($_POST['party_slogan'] ?? '');
    $color = $_POST['party_color'] ?? '#cccccc';

    // 2. HANDLE PARTY LOGO
    $logoUrl = null;
    if (!empty($partyId)) {
        $stmt = $pdo->prepare("SELECT logo_url FROM parties WHERE id = ?");
        $stmt->execute([$partyId]);
        $logoUrl = $stmt->fetchColumn();
    }
    if (isset($_FILES['party_logo']) && $_FILES['party_logo']['error'] === UPLOAD_ERR_OK) {
        $ext = pathinfo($_FILES['party_logo']['name'], PATHINFO_EXTENSION);
        $filename = 'party_' . time() . '_' . uniqid() . '.' . $ext;
        $targetDir = '../assets/parties/';
        if (!is_dir($targetDir)) mkdir($targetDir, 0777, true);
        if (move_uploaded_file($_FILES['party_logo']['tmp_name'], $targetDir . $filename)) {
            $logoUrl = 'assets/parties/' . $filename;
        }
    }

    // 3. SAVE PARTY
    if (empty($partyId)) {
        $stmt = $pdo->prepare("INSERT INTO parties (name, slogan, color, logo_url) VALUES (?, ?, ?, ?)");
        $stmt->execute([$name, $slogan, $color, $logoUrl]);
        $partyId = $pdo->lastInsertId();
    } else {
        $stmt = $pdo->prepare("UPDATE parties SET name=?, slogan=?, color=?, logo_url=? WHERE id=?");
        $stmt->execute([$name, $slogan, $color, $logoUrl, $partyId]);
    }

    // 4. HANDLE CANDIDATES (FIXED LOGIC)
    $cand_ids = $_POST['cand_ids'] ?? [];
    $cand_names = $_POST['cand_names'] ?? [];
    $cand_positions = $_POST['cand_positions'] ?? [];
    
    // Normalize arrays
    $cand_ids = array_values($cand_ids);
    $cand_names = array_values($cand_names);
    $cand_positions = array_values($cand_positions);

    // Filter to find which IDs are kept
    $validCandIds = array_filter($cand_ids); 

    // --- DELETION LOGIC ---
    if (!empty($partyId)) {
        if (empty($validCandIds)) {
            // CASE A: No old IDs were sent back. 
            // This means the user deleted ALL existing candidates (or added only new ones).
            // WIPE CLEAN.
            $stmt = $pdo->prepare("DELETE FROM candidates WHERE party_id = ?");
            $stmt->execute([$partyId]);
        } else {
            // CASE B: Some old IDs were kept. Delete the rest.
            $placeholders = implode(',', array_fill(0, count($validCandIds), '?'));
            $sql = "DELETE FROM candidates WHERE party_id = ? AND id NOT IN ($placeholders)";
            $params = array_merge([$partyId], $validCandIds);
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
        }
    }

    // --- INSERT / UPDATE LOOP ---
    $count = count($cand_names);
    for ($i = 0; $i < $count; $i++) {
        $cName = trim($cand_names[$i]);
        $cPos = $cand_positions[$i];
        $cId = $cand_ids[$i] ?? '';

        if (empty($cName) || empty($cPos)) continue;

        // Handle Photo
        $cPhotoUrl = null;
        if (!empty($cId)) {
            $stmt = $pdo->prepare("SELECT photo_url FROM candidates WHERE id = ?");
            $stmt->execute([$cId]);
            $cPhotoUrl = $stmt->fetchColumn();
        }

        // Check for file uploads (handles cand_photos_0 OR cand_photos[])
        $key = 'cand_photos_' . $i;
        if (isset($_FILES[$key]) && $_FILES[$key]['error'] === UPLOAD_ERR_OK) {
            $f = $_FILES[$key];
            $ext = pathinfo($f['name'], PATHINFO_EXTENSION);
            $filename = 'cand_' . time() . '_' . $i . '.' . $ext;
            $targetDir = '../assets/candidates/';
            if (!is_dir($targetDir)) mkdir($targetDir, 0777, true);
            if (move_uploaded_file($f['tmp_name'], $targetDir . $filename)) {
                $cPhotoUrl = 'assets/candidates/' . $filename;
            }
        }

        if (empty($cId)) {
            $stmt = $pdo->prepare("INSERT INTO candidates (party_id, position_id, full_name, photo_url) VALUES (?, ?, ?, ?)");
            $stmt->execute([$partyId, $cPos, $cName, $cPhotoUrl]);
        } else {
            $stmt = $pdo->prepare("UPDATE candidates SET position_id=?, full_name=?, photo_url=? WHERE id=?");
            $stmt->execute([$cPos, $cName, $cPhotoUrl, $cId]);
        }
    }

    // 5. AUTO-DELETE PARTY IF NO CANDIDATES REMAIN
    // Check if party has any candidates left after all operations
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM candidates WHERE party_id = ?");
    $stmt->execute([$partyId]);
    $candidateCount = $stmt->fetchColumn();
    
    if ($candidateCount == 0) {
        // No candidates left - delete the party
        $stmt = $pdo->prepare("DELETE FROM parties WHERE id = ?");
        $stmt->execute([$partyId]);
        
        $pdo->commit();
        echo json_encode([
            'success' => true, 
            'message' => 'Party had no candidates and was automatically deleted.',
            'deleted' => true
        ]);
        exit;
    }

    $pdo->commit();
    echo json_encode(['success' => true, 'message' => 'Party saved successfully!', 'id' => $partyId]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}
?>