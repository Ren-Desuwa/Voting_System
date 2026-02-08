<?php
// api/save_party_batch.php
// Handles saving/updating party and all candidates in one transaction
require '../db.php';
header('Content-Type: application/json');

try {
    $pdo->beginTransaction();
    
    $partyId = $_POST['party_id'] ?? null;
    $isUpdate = !empty($partyId);
    
    // ==========================================
    // 1. HANDLE PARTY LOGO UPLOAD
    // ==========================================
    $logoPath = null;
    if(!empty($_FILES['party_logo']['name']) && $_FILES['party_logo']['error'] === 0) {
        $uploadDir = '../assets/parties/';
        if(!is_dir($uploadDir)) {
            mkdir($uploadDir, 0777, true);
        }
        
        $extension = pathinfo($_FILES['party_logo']['name'], PATHINFO_EXTENSION);
        $logoPath = 'assets/parties/' . time() . '_' . uniqid() . '.' . $extension;
        
        if(!move_uploaded_file($_FILES['party_logo']['tmp_name'], '../' . $logoPath)) {
            throw new Exception('Failed to upload party logo');
        }
    }
    
    // ==========================================
    // 2. SAVE OR UPDATE PARTY
    // ==========================================
    if($isUpdate) {
        // UPDATE existing party
        $sql = "UPDATE parties SET name = ?, slogan = ?, color = ?";
        $params = [$_POST['party_name'], $_POST['party_slogan'], $_POST['party_color']];
        
        if($logoPath) {
            $sql .= ", logo_url = ?";
            $params[] = $logoPath;
        }
        
        $sql .= " WHERE id = ?";
        $params[] = $partyId;
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
    } else {
        // INSERT new party
        $stmt = $pdo->prepare("INSERT INTO parties (name, slogan, color, logo_url) VALUES (?, ?, ?, ?)");
        $stmt->execute([
            $_POST['party_name'], 
            $_POST['party_slogan'], 
            $_POST['party_color'], 
            $logoPath
        ]);
        $partyId = $pdo->lastInsertId();
    }
    
    // ==========================================
    // 3. HANDLE CANDIDATES
    // ==========================================
    if(isset($_POST['cand_names']) && is_array($_POST['cand_names'])) {
        $names = $_POST['cand_names'];
        $positions = $_POST['cand_positions'];
        $candIds = $_POST['cand_ids'] ?? [];
        
        // If updating, first delete removed candidates
        if($isUpdate) {
            $keepIds = array_filter($candIds); // IDs that should be kept
            if(!empty($keepIds)) {
                $placeholders = implode(',', array_fill(0, count($keepIds), '?'));
                $stmt = $pdo->prepare("DELETE FROM candidates WHERE party_id = ? AND id NOT IN ($placeholders)");
                $stmt->execute(array_merge([$partyId], $keepIds));
            } else {
                // Delete all if no IDs to keep
                $stmt = $pdo->prepare("DELETE FROM candidates WHERE party_id = ?");
                $stmt->execute([$partyId]);
            }
        }
        
        // Process each candidate
        for($i = 0; $i < count($names); $i++) {
            if(empty($names[$i]) || empty($positions[$i])) continue;
            
            $candId = $candIds[$i] ?? null;
            $photoPath = null;
            
            // Handle photo upload for this candidate
            $photoFieldName = 'cand_photos_' . $i;
            if(!empty($_FILES[$photoFieldName]['name']) && $_FILES[$photoFieldName]['error'] === 0) {
                $uploadDir = '../assets/candidates/';
                if(!is_dir($uploadDir)) {
                    mkdir($uploadDir, 0777, true);
                }
                
                $extension = pathinfo($_FILES[$photoFieldName]['name'], PATHINFO_EXTENSION);
                $photoPath = 'assets/candidates/' . time() . '_' . uniqid() . '.' . $extension;
                
                if(!move_uploaded_file($_FILES[$photoFieldName]['tmp_name'], '../' . $photoPath)) {
                    // Don't fail the whole operation if one photo fails
                    $photoPath = null;
                }
            }
            
            if(!empty($candId)) {
                // UPDATE existing candidate
                $sql = "UPDATE candidates SET full_name = ?, position_id = ?";
                $params = [$names[$i], $positions[$i]];
                
                if($photoPath) {
                    $sql .= ", photo_url = ?";
                    $params[] = $photoPath;
                }
                
                $sql .= " WHERE id = ?";
                $params[] = $candId;
                
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
            } else {
                // INSERT new candidate
                $stmt = $pdo->prepare("INSERT INTO candidates (party_id, position_id, full_name, photo_url) VALUES (?, ?, ?, ?)");
                $stmt->execute([$partyId, $positions[$i], $names[$i], $photoPath]);
            }
        }
    }
    
    $pdo->commit();
    echo json_encode(['success' => true, 'party_id' => $partyId]);

} catch(Exception $e) {
    $pdo->rollBack();
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>