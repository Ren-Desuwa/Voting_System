<?php
require '../db.php';
header('Content-Type: application/json');

try {
    // 1. Get Global Settings (Total Voters)
    $stmt = $pdo->query("SELECT setting_value FROM settings WHERE setting_key = 'total_voters'");
    $totalEnrolled = (int)($stmt->fetch()['setting_value'] ?? 0);

    // 2. Global: Total Votes Cast (Unique Voters)
    $stmt = $pdo->query("SELECT COUNT(DISTINCT voter_id) FROM votes");
    $globalVotesCast = (int)$stmt->fetchColumn();
    $globalPending = max(0, $totalEnrolled - $globalVotesCast);

    // 3. Global: Party Rankings (For Dashboard Bar Graph)
    $stmt = $pdo->query("
        SELECT p.name, p.color, COUNT(v.id) as vote_count 
        FROM parties p 
        LEFT JOIN candidates c ON p.id = c.party_id 
        LEFT JOIN votes v ON c.id = v.candidate_id 
        GROUP BY p.id
    ");
    $globalParties = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 4. Per-Position Data (The Core Logic)
    // We fetch all positions, then for each, fetch the candidates and their specific vote counts
    $stmt = $pdo->query("SELECT * FROM positions ORDER BY priority ASC");
    $positions = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $positionStats = [];

    foreach($positions as $pos) {
        // Get candidates for this position with their vote counts
        // We use LEFT JOIN so candidates with 0 votes still appear
        $cStmt = $pdo->prepare("
            SELECT 
                c.id, c.full_name, c.photo_url, 
                p.name as party_name, p.color as party_color,
                COUNT(v.id) as votes
            FROM candidates c
            JOIN parties p ON c.party_id = p.id
            LEFT JOIN votes v ON c.id = v.candidate_id
            WHERE c.position_id = ?
            GROUP BY c.id
        ");
        $cStmt->execute([$pos['id']]);
        $candidates = $cStmt->fetchAll(PDO::FETCH_ASSOC);

        // Calculate total votes cast FOR THIS POSITION specifically
        $totalVotesForPos = 0;
        foreach($candidates as $c) {
            $totalVotesForPos += $c['votes'];
        }

        // Calculate Remaining (Total Enrolled - Votes cast for this position)
        $remaining = max(0, $totalEnrolled - $totalVotesForPos);

        $positionStats[] = [
            'id' => $pos['id'],
            'title' => $pos['title'],
            'candidates' => $candidates,
            'total_votes' => $totalVotesForPos,
            'remaining' => $remaining
        ];
    }

    echo json_encode([
        'success' => true,
        'global' => [
            'total_enrolled' => $totalEnrolled,
            'votes_cast' => $globalVotesCast,
            'pending' => $globalPending,
            'parties' => $globalParties
        ],
        'positions' => $positionStats
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>