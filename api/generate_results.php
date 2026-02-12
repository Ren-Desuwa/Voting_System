<?php
// vote/api/generate_results.php

function generateFinalReport($pdo, $filePath) {
    // 1. Get Settings
    $start = $pdo->query("SELECT setting_value FROM settings WHERE setting_key = 'election_start_time'")->fetchColumn();
    $end = $pdo->query("SELECT setting_value FROM settings WHERE setting_key = 'election_end_time'")->fetchColumn();
    
    // Calculate ACTUAL Turnout
    $stmtTurnout = $pdo->prepare("SELECT COUNT(DISTINCT voter_id) FROM votes WHERE voted_at BETWEEN ? AND ?");
    $stmtTurnout->execute([$start, $end]);
    $activeTurnout = (int)$stmtTurnout->fetchColumn();

    $totalForCalc = $activeTurnout > 0 ? $activeTurnout : 1;

    // 2. Fetch Positions
    $positions = $pdo->query("SELECT * FROM positions ORDER BY priority ASC")->fetchAll();

    // PART 1: Build Summary Cards
    $summaryHtml = "";
    $detailsHtml = "";

    foreach($positions as $pos) {
        // Fetch candidates and valid votes
        $stmt = $pdo->prepare("
            SELECT c.id, c.full_name, c.photo_url, p.name as party_name, p.color, 
            COUNT(v.id) as votes 
            FROM candidates c 
            JOIN parties p ON c.party_id = p.id 
            LEFT JOIN votes v ON c.id = v.candidate_id AND v.voted_at BETWEEN ? AND ? 
            WHERE c.position_id = ? 
            GROUP BY c.id 
            ORDER BY votes DESC
        ");
        $stmt->execute([$start, $end, $pos['id']]);
        $candidates = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Calculate votes
        $votesCastForPos = 0;
        foreach($candidates as $c) { $votesCastForPos += $c['votes']; }
        
        $abstainCount = max(0, $activeTurnout - $votesCastForPos);
        
        // Determine Winner
        $topCandidate = $candidates[0] ?? null;
        $secondCandidate = $candidates[1] ?? null;
        
        $winnerType = 'candidate'; 
        $winnerText = '';
        $winnerPhoto = '';
        $winnerColor = '#ccc';
        $winnerSub = '';

        if ($topCandidate && $abstainCount > $topCandidate['votes']) {
            $winnerType = 'abstain';
            $winnerText = "Majority Abstained";
            $winnerSub = "Position Skipped";
            $winnerColor = "#95a5a6";
            $winnerPhoto = ""; 
        } elseif ($topCandidate && $secondCandidate && $topCandidate['votes'] > 0 && $topCandidate['votes'] == $secondCandidate['votes']) {
            $winnerType = 'tie';
            $winnerText = "Tie";
            $winnerSub = implode(" vs ", array_slice(array_column($candidates, 'full_name'), 0, 2));
            $winnerColor = "#f39c12";
            $winnerPhoto = ""; 
        } elseif ($topCandidate && $topCandidate['votes'] > 0) {
            $winnerType = 'candidate';
            $winnerText = $topCandidate['full_name'];
            $winnerSub = $topCandidate['party_name'];
            $winnerColor = $topCandidate['color'];
            $winnerPhoto = $topCandidate['photo_url'] ?: 'assets/candidates/default.png';
        } else {
            $winnerType = 'abstain';
            $winnerText = "No Votes";
            $winnerSub = "0 Turnout";
            $winnerColor = "#95a5a6";
        }

        // PART 1: SUMMARY CARD
        $icon = $winnerType === 'candidate' ? "<img src='{$winnerPhoto}' alt='Winner' class='summary-photo'>" : 
                ($winnerType === 'tie' ? "⚖️" : "🚫");
        
        $summaryHtml .= "
            <div class='summary-card' style='border-left: 4px solid {$winnerColor}'>
                <div class='summary-icon'>
                    {$icon}
                </div>
                <div class='summary-content'>
                    <div class='summary-position'>{$pos['title']}</div>
                    <div class='summary-winner'>{$winnerText}</div>
                    <div class='summary-party' style='color: {$winnerColor}'>{$winnerSub}</div>
                </div>
                <div class='summary-votes'>
                    <div class='vote-count'>" . ($topCandidate ? $topCandidate['votes'] : 0) . "</div>
                    <div class='vote-label'>votes</div>
                </div>
            </div>
        ";

        // PART 2: DETAILED BREAKDOWN
        
        // Create face-off visualization (top 2 candidates + abstain)
        $left = $topCandidate;
        $right = $secondCandidate;
        
        $leftPct = 0;
        $rightPct = 0;
        $abstainPct = 0;
        
        if ($totalForCalc > 0) {
            $leftPct = $left ? ($left['votes'] / $totalForCalc) * 100 : 0;
            $rightPct = $right ? ($right['votes'] / $totalForCalc) * 100 : 0;
            $abstainPct = ($abstainCount / $totalForCalc) * 100;
        }
        
        // Build face-off bar
        $faceoffHtml = "<div class='faceoff-container'>";
        
        // Left candidate
        if ($left) {
            $faceoffHtml .= "
                <div class='faceoff-side left'>
                    <div class='candidate-info'>
                        <div class='candidate-photo'>
                            <img src='{$left['photo_url']}' alt='{$left['full_name']}' onerror=\"this.src='assets/candidates/default.png'\">
                        </div>
                        <div class='candidate-details'>
                            <div class='candidate-name'>{$left['full_name']}</div>
                            <div class='candidate-party' style='color: {$left['color']}'>{$left['party_name']}</div>
                        </div>
                    </div>
                    <div class='vote-stats'>
                        <div class='stat-number' style='color: {$left['color']}'>{$left['votes']}</div>
                        <div class='stat-percent'>" . number_format($leftPct, 1) . "%</div>
                    </div>
                </div>
            ";
        }
        
        // Center abstain
        $faceoffHtml .= "
            <div class='faceoff-center'>
                <div class='abstain-label'>ABSTAINED</div>
                <div class='abstain-count'>{$abstainCount}</div>
                <div class='abstain-percent'>" . number_format($abstainPct, 1) . "%</div>
            </div>
        ";
        
        // Right candidate
        if ($right) {
            $faceoffHtml .= "
                <div class='faceoff-side right'>
                    <div class='vote-stats'>
                        <div class='stat-number' style='color: {$right['color']}'>{$right['votes']}</div>
                        <div class='stat-percent'>" . number_format($rightPct, 1) . "%</div>
                    </div>
                    <div class='candidate-info'>
                        <div class='candidate-photo'>
                            <img src='{$right['photo_url']}' alt='{$right['full_name']}' onerror=\"this.src='assets/candidates/default.png'\">
                        </div>
                        <div class='candidate-details'>
                            <div class='candidate-name'>{$right['full_name']}</div>
                            <div class='candidate-party' style='color: {$right['color']}'>{$right['party_name']}</div>
                        </div>
                    </div>
                </div>
            ";
        }
        
        $faceoffHtml .= "</div>";
        
        // Visual bar
        $visualBarHtml = "
            <div class='visual-bar'>
                <div class='bar-segment left' style='width: {$leftPct}%; background: " . ($left ? $left['color'] : '#ccc') . "'></div>
                <div class='bar-segment center' style='width: {$abstainPct}%; background: #95a5a6'></div>
                <div class='bar-segment right' style='width: {$rightPct}%; background: " . ($right ? $right['color'] : '#ccc') . "'></div>
            </div>
        ";
        
        // All candidates list
        $allCandidatesHtml = "<div class='all-candidates'>";
        $allCandidatesHtml .= "<h4>All Candidates</h4>";
        
        foreach($candidates as $c) {
            $pct = ($totalForCalc > 0) ? number_format(($c['votes'] / $totalForCalc) * 100, 1) : 0;
            $allCandidatesHtml .= "
                <div class='candidate-row'>
                    <div class='row-left'>
                        <div class='color-dot' style='background: {$c['color']}'></div>
                        <div class='row-info'>
                            <div class='row-name'>{$c['full_name']}</div>
                            <div class='row-party'>{$c['party_name']}</div>
                        </div>
                    </div>
                    <div class='row-right'>
                        <div class='row-votes'>{$c['votes']}</div>
                        <div class='row-percent'>{$pct}%</div>
                    </div>
                </div>
            ";
        }
        
        // Add abstain row
        $absPct = ($totalForCalc > 0) ? number_format($abstainPct, 1) : 0;
        $allCandidatesHtml .= "
            <div class='candidate-row abstain-row'>
                <div class='row-left'>
                    <div class='color-dot' style='background: #95a5a6'></div>
                    <div class='row-info'>
                        <div class='row-name'>Abstained / Skipped</div>
                        <div class='row-party'>Undervote</div>
                    </div>
                </div>
                <div class='row-right'>
                    <div class='row-votes'>{$abstainCount}</div>
                    <div class='row-percent'>{$absPct}%</div>
                </div>
            </div>
        ";
        
        $allCandidatesHtml .= "</div>";
        
        // Assemble detailed section
        $detailsHtml .= "
            <div class='detail-card' id='detail-{$pos['id']}'>
                <div class='detail-header'>
                    <h2>{$pos['title']}</h2>
                    <div class='turnout-badge'>Turnout: {$activeTurnout}</div>
                </div>
                
                {$faceoffHtml}
                {$visualBarHtml}
                {$allCandidatesHtml}
            </div>
        ";
    }

    // FULL PAGE HTML
    $html = "<!DOCTYPE html>
<html lang='en'>
<head>
<meta charset='UTF-8'>
<meta name='viewport' content='width=device-width, initial-scale=1.0'>
<title>Election Results</title>
<style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body { 
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        padding: 20px;
        min-height: 100vh;
    }
    
    .container { 
        max-width: 1200px; 
        margin: 0 auto;
    }
    
    .page-header {
        text-align: center;
        color: white;
        margin-bottom: 40px;
        padding: 40px 20px;
    }
    
    .page-header h1 {
        font-size: 2.5em;
        margin-bottom: 10px;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
    }
    
    .page-header p {
        opacity: 0.9;
        font-size: 1.1em;
    }
    
    /* ========== PART 1: SUMMARY SECTION ========== */
    .summary-section {
        background: white;
        border-radius: 20px;
        padding: 30px;
        margin-bottom: 40px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.1);
    }
    
    .summary-section h2 {
        font-size: 1.8em;
        margin-bottom: 25px;
        color: #2c3e50;
        text-align: center;
    }
    
    .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 20px;
    }
    
    .summary-card {
        display: flex;
        align-items: center;
        gap: 15px;
        padding: 20px;
        background: #f8f9fa;
        border-radius: 12px;
        border-left: 4px solid #ccc;
        transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .summary-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    
    .summary-icon {
        width: 60px;
        height: 60px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2em;
        background: white;
        border-radius: 12px;
    }
    
    .summary-photo {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 12px;
    }
    
    .summary-content {
        flex-grow: 1;
        min-width: 0;
    }
    
    .summary-position {
        font-size: 0.85em;
        color: #7f8c8d;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 5px;
    }
    
    .summary-winner {
        font-size: 1.1em;
        font-weight: bold;
        color: #2c3e50;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    
    .summary-party {
        font-size: 0.9em;
        font-weight: 600;
        margin-top: 3px;
    }
    
    .summary-votes {
        text-align: right;
        padding-left: 15px;
        border-left: 1px solid #dee2e6;
    }
    
    .vote-count {
        font-size: 1.5em;
        font-weight: bold;
        color: #2c3e50;
    }
    
    .vote-label {
        font-size: 0.8em;
        color: #95a5a6;
        text-transform: uppercase;
    }
    
    /* ========== PART 2: DETAILED SECTION ========== */
    .details-section {
        display: flex;
        flex-direction: column;
        gap: 30px;
    }
    
    .detail-card {
        background: white;
        border-radius: 20px;
        overflow: hidden;
        box-shadow: 0 10px 40px rgba(0,0,0,0.1);
    }
    
    .detail-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 25px 30px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .detail-header h2 {
        font-size: 1.6em;
    }
    
    .turnout-badge {
        background: rgba(255,255,255,0.2);
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 0.9em;
        backdrop-filter: blur(10px);
    }
    
    /* Face-off Container */
    .faceoff-container {
        display: flex;
        align-items: center;
        padding: 30px;
        gap: 20px;
    }
    
    .faceoff-side {
        flex: 1;
        display: flex;
        gap: 15px;
    }
    
    .faceoff-side.left {
        flex-direction: row;
    }
    
    .faceoff-side.right {
        flex-direction: row-reverse;
    }
    
    .candidate-info {
        display: flex;
        gap: 12px;
        align-items: center;
        flex: 1;
    }
    
    .faceoff-side.right .candidate-info {
        flex-direction: row-reverse;
        text-align: right;
    }
    
    .candidate-photo {
        width: 70px;
        height: 70px;
        border-radius: 50%;
        overflow: hidden;
        border: 3px solid #e0e0e0;
        flex-shrink: 0;
    }
    
    .candidate-photo img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    
    .candidate-name {
        font-weight: bold;
        font-size: 1.1em;
        color: #2c3e50;
    }
    
    .candidate-party {
        font-size: 0.9em;
        font-weight: 600;
    }
    
    .vote-stats {
        text-align: center;
        min-width: 80px;
    }
    
    .stat-number {
        font-size: 2em;
        font-weight: bold;
        line-height: 1;
    }
    
    .stat-percent {
        font-size: 1.1em;
        color: #7f8c8d;
        margin-top: 5px;
    }
    
    .faceoff-center {
        text-align: center;
        padding: 0 20px;
        min-width: 120px;
    }
    
    .abstain-label {
        font-size: 0.75em;
        color: #95a5a6;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 5px;
    }
    
    .abstain-count {
        font-size: 1.8em;
        font-weight: bold;
        color: #95a5a6;
    }
    
    .abstain-percent {
        font-size: 1em;
        color: #bdc3c7;
        margin-top: 3px;
    }
    
    /* Visual Bar */
    .visual-bar {
        display: flex;
        height: 30px;
        margin: 0 30px 30px 30px;
        border-radius: 15px;
        overflow: hidden;
        box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .bar-segment {
        transition: width 0.3s ease;
    }
    
    /* All Candidates */
    .all-candidates {
        padding: 30px;
        background: #f8f9fa;
    }
    
    .all-candidates h4 {
        font-size: 1.2em;
        color: #2c3e50;
        margin-bottom: 20px;
        text-transform: uppercase;
        letter-spacing: 1px;
    }
    
    .candidate-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px;
        background: white;
        border-radius: 10px;
        margin-bottom: 10px;
        transition: transform 0.2s;
    }
    
    .candidate-row:hover {
        transform: translateX(5px);
    }
    
    .candidate-row.abstain-row {
        opacity: 0.7;
    }
    
    .row-left {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;
    }
    
    .color-dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        flex-shrink: 0;
    }
    
    .row-name {
        font-weight: 600;
        color: #2c3e50;
    }
    
    .row-party {
        font-size: 0.85em;
        color: #7f8c8d;
        margin-top: 2px;
    }
    
    .row-right {
        display: flex;
        align-items: baseline;
        gap: 10px;
    }
    
    .row-votes {
        font-size: 1.3em;
        font-weight: bold;
        color: #2c3e50;
    }
    
    .row-percent {
        font-size: 1em;
        color: #95a5a6;
        min-width: 50px;
        text-align: right;
    }
    
    /* Footer */
    .page-footer {
        text-align: center;
        color: white;
        padding: 40px 20px;
        font-size: 0.9em;
        opacity: 0.8;
    }
    
    /* ========== MOBILE RESPONSIVE ========== */
    @media (max-width: 768px) {
        body { padding: 10px; }
        
        .page-header h1 { font-size: 1.8em; }
        .page-header { padding: 20px 10px; margin-bottom: 20px; }
        
        .summary-section { padding: 20px; }
        .summary-section h2 { font-size: 1.4em; }
        
        .summary-grid {
            grid-template-columns: 1fr;
            gap: 15px;
        }
        
        .summary-card {
            padding: 15px;
        }
        
        .summary-icon {
            width: 50px;
            height: 50px;
            font-size: 1.5em;
        }
        
        .summary-winner {
            font-size: 1em;
        }
        
        .summary-photo {
            display: none; /* Hide photos on mobile */
        }
        
        .summary-icon:has(.summary-photo) {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            font-size: 1.2em;
        }
        
        .summary-icon:has(.summary-photo)::before {
            content: '👤';
        }
        
        .detail-header {
            flex-direction: column;
            gap: 10px;
            padding: 20px;
        }
        
        .detail-header h2 { font-size: 1.3em; }
        
        .faceoff-container {
            flex-direction: column;
            padding: 20px;
            gap: 15px;
        }
        
        .faceoff-side {
            width: 100%;
        }
        
        .faceoff-side.left,
        .faceoff-side.right {
            flex-direction: row !important;
        }
        
        .faceoff-side.right .candidate-info {
            flex-direction: row !important;
            text-align: left !important;
        }
        
        .candidate-photo {
            width: 50px;
            height: 50px;
        }
        
        .candidate-name {
            font-size: 1em;
        }
        
        .stat-number {
            font-size: 1.5em;
        }
        
        .visual-bar {
            margin: 0 20px 20px 20px;
            height: 20px;
        }
        
        .all-candidates {
            padding: 20px;
        }
        
        .row-votes {
            font-size: 1.1em;
        }
    }
</style>
</head>
<body>
    <div class='container'>
        <div class='page-header'>
            <h1>🏆 Election Results</h1>
            <p>Official Final Results</p>
        </div>
        
        <!-- PART 1: SUMMARY -->
        <div class='summary-section'>
            <h2>Winners Overview</h2>
            <div class='summary-grid'>
                {$summaryHtml}
            </div>
        </div>
        
        <!-- PART 2: DETAILED BREAKDOWN -->
        <div class='details-section'>
            {$detailsHtml}
        </div>
        
        <div class='page-footer'>
            Official Report • Generated " . date('M d, Y h:i A') . "
        </div>
    </div>
</body>
</html>";

    return file_put_contents($filePath, $html);
}
function generateNoResultsPage($filePath) {
    $html = "<!DOCTYPE html>
    <html lang='en'>
    <head>
        <meta charset='UTF-8'>
        <meta name='viewport' content='width=device-width, initial-scale=1.0'>
        <title>Results Pending</title>
        <style>
            body { 
                display: flex; justify-content: center; align-items: center; 
                min-height: 100vh; margin: 0; 
                background: linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%); 
                font-family: 'Segoe UI', sans-serif; 
                color: #2c3e50;
            }
            .container { 
                text-align: center; background: white; 
                padding: 60px 40px; border-radius: 20px; 
                box-shadow: 0 15px 35px rgba(0,0,0,0.1); 
                max-width: 450px; width: 90%;
            }
            .icon { font-size: 5em; margin-bottom: 20px; display: inline-block; animation: float 3s ease-in-out infinite; }
            h1 { margin: 10px 0; font-size: 1.8em; }
            p { color: #7f8c8d; line-height: 1.6; }
            @keyframes float { 0% { transform: translateY(0px); } 50% { transform: translateY(-10px); } 100% { transform: translateY(0px); } }
        </style>
    </head>
    <body>
        <div class='container'>
            <div class='icon'>🗳️</div>
            <h1>Results Pending</h1>
            <p>The election has not yet concluded or the results have not been officially released.</p>
            <p style='font-size:0.85em; margin-top:30px; color:#bdc3c7;'>Please check back later.</p>
        </div>
    </body>
    </html>";

    return file_put_contents($filePath, $html);
}
?>