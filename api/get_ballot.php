<?php
// api/get_ballot.php
// This file provides the voting ballot data to the voter interface
// NOW UPDATED: Respects the priority order set in the admin panel

require '../db.php';
header('Content-Type: application/json');

try {
    // Fetch all positions ordered by priority (set in admin panel)
    $stmt = $pdo->query("SELECT * FROM positions ORDER BY priority ASC, id ASC");
    $positions = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $positionNames = [];
    $candidates = [];
    
    foreach ($positions as $pos) {
        $key = "pos_" . $pos['id'];
        $positionNames[$key] = $pos['title'];
        
        // Fetch candidates for this position with party info
        $stmt = $pdo->prepare("
            SELECT 
                c.id, 
                c.full_name as name, 
                c.photo_url as img,
                p.name as party,
                p.color as party_color
            FROM candidates c
            LEFT JOIN parties p ON c.party_id = p.id
            WHERE c.position_id = ?
            ORDER BY c.id ASC
        ");
        $stmt->execute([$pos['id']]);
        $candidates[$key] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    echo json_encode([
        'positionNames' => $positionNames,
        'candidates' => $candidates
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'error' => true,
        'message' => 'Failed to load ballot data: ' . $e->getMessage()
    ]);
}
?>