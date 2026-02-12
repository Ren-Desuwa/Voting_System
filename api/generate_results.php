<?php
// vote/api/generate_results.php

function generatePlaceholderPage($status, $filePath) {
    $titles = [
        'not_started' => ['title' => 'ELECTION NOT STARTED', 'color' => '#f39c12', 'msg' => 'Voting lines are currently closed.', 'icon' => '🗳️'],
        'active'      => ['title' => 'ELECTION ACTIVE', 'color' => '#27ae60', 'msg' => 'Voting is currently ongoing.', 'icon' => '✅'],
        'paused'      => ['title' => 'VOTING PAUSED', 'color' => '#c0392b', 'msg' => 'The election has been temporarily suspended.', 'icon' => '⏸️']
    ];
    
    $t = $titles[$status] ?? $titles['not_started'];
    
    // Minified style for brevity, exact same look
    $html = "<!DOCTYPE html>
    <html lang='en'>
    <head>
        <meta charset='UTF-8'>
        <meta name='viewport' content='width=device-width, initial-scale=1.0'>
        <title>{$t['title']}</title>
        <meta http-equiv='refresh' content='10'>
        <style>
            body { display: flex; justify-content: center; align-items: center; min-height: 100vh; margin:0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); font-family: 'Segoe UI', sans-serif; }
            .card { background: white; padding: 60px 40px; border-radius: 20px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.3); max-width: 500px; width:90%; border-top: 8px solid {$t['color']}; }
            h1 { color: {$t['color']}; margin: 15px 0; font-size: 2em; }
            p { color: #666; font-size: 1.1em; line-height: 1.6; }
            .icon { font-size: 5em; display:block; margin-bottom: 20px; animation: pulse 2s infinite; }
            @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
        </style>
    </head>
    <body>
        <div class='card'>
            <div class='icon'>{$t['icon']}</div>
            <h1>{$t['title']}</h1>
            <p>{$t['msg']}</p>
            <p style='font-size:0.8em; margin-top:20px; color:#ccc'>Last Updated: " . date('H:i:s') . "</p>
        </div>
    </body>
    </html>";
    
    return file_put_contents($filePath, $html);
}

function generateFinalReport($pdo, $filePath) {
    // 1. Get Settings
    $start = $pdo->query("SELECT setting_value FROM settings WHERE setting_key = 'election_start_time'")->fetchColumn();
    $end = $pdo->query("SELECT setting_value FROM settings WHERE setting_key = 'election_end_time'")->fetchColumn();
    
    // 2. Fetch Data
    $positions = $pdo->query("SELECT * FROM positions ORDER BY priority ASC")->fetchAll();
    $totalVoters = $pdo->query("SELECT setting_value FROM settings WHERE setting_key = 'total_voters'")->fetchColumn();
    $votesCast = $pdo->query("SELECT COUNT(DISTINCT voter_id) FROM votes WHERE voted_at >= '$start' AND voted_at <= '$end'")->fetchColumn();
    $turnout = ($totalVoters > 0) ? round(($votesCast / $totalVoters) * 100, 1) : 0;

    $contentHtml = "";

    foreach($positions as $pos) {
        // Fetch candidates and votes
        $stmt = $pdo->prepare("SELECT c.full_name, c.photo_url, p.name as party_name, p.color, COUNT(v.id) as votes FROM candidates c JOIN parties p ON c.party_id = p.id LEFT JOIN votes v ON c.id = v.candidate_id AND v.voted_at BETWEEN ? AND ? WHERE c.position_id = ? GROUP BY c.id ORDER BY votes DESC");
        $stmt->execute([$start, $end, $pos['id']]);
        $candidates = $stmt->fetchAll();

        // Check for winner
        $winner = $candidates[0] ?? null;
        
        // Build Winner HTML
        if($winner) {
            $photo = $winner['photo_url'] ?: 'assets/candidates/default.png';
            $contentHtml .= "
            <div class='winner-card' style='border-left: 5px solid {$winner['color']}'>
                <img src='$photo' class='winner-photo'>
                <div class='winner-info'>
                    <small>{$pos['title']}</small>
                    <h3>{$winner['full_name']}</h3>
                    <div style='color:{$winner['color']}'>{$winner['party_name']}</div>
                </div>
                <div class='winner-votes'>{$winner['votes']}<span>VOTES</span></div>
            </div>";
        }
    }

    // 3. Generate Full HTML (Cleaned up CSS)
    $html = "<!DOCTYPE html>
    <html lang='en'>
    <head>
    <meta charset='UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1.0'><title>Results</title>
    <style>
        body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; font-family: 'Segoe UI', sans-serif; min-height: 100vh; }
        .container { max-width: 900px; margin: 0 auto; background: white; border-radius: 20px; padding: 40px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
        .header { text-align: center; border-bottom: 3px solid #eacb66; margin-bottom: 40px; padding-bottom: 20px; }
        .header h1 { color: #2c3e50; text-transform: uppercase; margin: 0 0 10px 0; }
        .winner-card { background: #f8f9fa; border-radius: 12px; padding: 20px; display: flex; align-items: center; margin-bottom: 20px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
        .winner-photo { width: 70px; height: 70px; border-radius: 50%; object-fit: cover; margin-right: 20px; border: 3px solid #eacb66; }
        .winner-info { flex: 1; }
        .winner-info h3 { margin: 5px 0; color: #2c3e50; }
        .winner-info small { text-transform: uppercase; color: #999; font-weight: bold; letter-spacing: 1px; }
        .winner-votes { text-align: center; font-size: 1.8em; font-weight: bold; color: #2c3e50; line-height: 1; }
        .winner-votes span { display: block; font-size: 0.4em; color: #999; font-weight: normal; margin-top: 5px; }
        .stats { display: flex; justify-content: space-around; background: linear-gradient(135deg, #eacb66 0%, #ca8230 100%); color: white; padding: 20px; border-radius: 12px; text-align: center; margin-top: 40px; }
        .stat-val { font-size: 2em; font-weight: bold; }
    </style>
    </head>
    <body>
        <div class='container'>
            <div class='header'>
                <h1>🏆 Official Results</h1>
                <div>Finalized: " . date('M d, Y h:i A') . "</div>
            </div>
            
            <h2 style='color:#34495e; border-bottom: 2px solid #eee; padding-bottom:10px;'>Winners Circle</h2>
            $contentHtml

            <div class='stats'>
                <div><div class='stat-val'>$votesCast</div><div>Votes Cast</div></div>
                <div><div class='stat-val'>$turnout%</div><div>Turnout</div></div>
                <div><div class='stat-val'>$totalVoters</div><div>Total Voters</div></div>
            </div>
        </div>
    </body>
    </html>";

    return file_put_contents($filePath, $html);
}
?>