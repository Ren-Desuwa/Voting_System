<?php
$archive_db = $_GET['db'] ?? '';
if (!$archive_db) die("Error: No election archive specified.");

try {
    // Connect to the SEALED database using READ-ONLY user
    $pdo = new PDO("mysql:host=db;dbname=$archive_db;charset=utf8mb4", "public_auditor", "czshs_secure_audit_2026");
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch (Exception $e) {
    die("<h1>Access Denied</h1><p>The sealed vault could not be opened.</p>");
}

// Fetch Winners
$positions = $pdo->query("SELECT * FROM positions ORDER BY priority ASC")->fetchAll();
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Official Election Canvass - CZSHS</title>
    <link rel="stylesheet" href="css/style.css">
    <style>
        body { background: #f4f4f9; padding: 40px 20px; text-align: center; }
        
        .canvass-container {
            max-width: 850px;
            margin: 0 auto;
            background: white;
            padding: 50px;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.1);
            position: relative;
            border-top: 8px solid var(--primary-color);
        }

        .header-logo { width: 100px; height: 100px; margin-bottom: 15px; }
        
        h1 { color: #333; margin: 10px 0 5px; font-size: 28px; text-transform: uppercase; letter-spacing: 1px; }
        p.subtitle { color: #666; margin: 0; font-size: 16px; font-weight: 500; }

        .official-seal {
            position: absolute;
            top: 40px; right: 40px;
            width: 110px; height: 110px;
            border: 4px double #c0392b;
            color: #c0392b;
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-weight: bold; transform: rotate(-15deg);
            font-size: 14px; text-align: center;
            opacity: 0.9;
            background: rgba(255, 255, 255, 0.9);
        }

        .winner-card {
            display: flex; align-items: center;
            background: #fff;
            border: 1px solid #eee;
            border-left: 5px solid #ccc;
            padding: 20px;
            margin-bottom: 20px;
            border-radius: 8px;
            text-align: left;
            transition: transform 0.2s;
        }
        .winner-card:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,0,0,0.05); }

        .winner-img {
            width: 70px; height: 70px;
            border-radius: 50%; object-fit: cover;
            margin-right: 20px;
            border: 3px solid #f0f0f0;
        }

        .winner-details h3 { margin: 0 0 5px; font-size: 20px; color: #2c3e50; }
        .pos-title { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px; font-weight: bold; }
        
        .vote-count { margin-left: auto; font-size: 24px; font-weight: bold; color: var(--primary-dark); }
        .footer { margin-top: 40px; font-size: 12px; color: #aaa; border-top: 1px solid #eee; padding-top: 20px; }
    </style>
</head>
<body>

<div class="canvass-container">
    <div class="official-seal">OFFICIAL<br>SEALED<br>RESULTS</div>

    <div class="header">
        <img src="assets/CZSHS_logo.png" class="header-logo" alt="CZSHS Logo">
        <h1>Official Election Canvass</h1>
        <p class="subtitle">Cielito Zamora Senior High School</p>
        <p style="margin-top:5px; font-size: 0.9em; color: var(--primary-dark);"><strong><?php echo date("F j, Y"); ?></strong></p>
    </div>

    <div style="margin-top: 40px; text-align: left;">
    <?php foreach($positions as $pos): 
        $stmt = $pdo->prepare("
            SELECT c.*, p.name as party_name, p.color as party_color, COUNT(v.id) as vote_count
            FROM candidates c
            JOIN parties p ON c.party_id = p.id
            LEFT JOIN votes v ON c.id = v.candidate_id
            WHERE c.position_id = ?
            GROUP BY c.id
            ORDER BY vote_count DESC LIMIT 1
        ");
        $stmt->execute([$pos['id']]);
        $winner = $stmt->fetch();
    ?>
        <?php if($winner): ?>
        <div class="winner-card" style="border-left-color: <?php echo $winner['party_color']; ?>;">
            <img src="<?php echo $winner['photo_url'] ? $winner['photo_url'] : 'assets/candidates/default.png'; ?>" class="winner-img">
            <div class="winner-details">
                <div class="pos-title"><?php echo $pos['title']; ?></div>
                <h3><?php echo $winner['full_name']; ?></h3>
                <span style="color: <?php echo $winner['party_color']; ?>; font-weight: bold;"><?php echo $winner['party_name']; ?></span>
            </div>
            <div class="vote-count">
                <?php echo $winner['vote_count']; ?> <span style="font-size:14px; font-weight:normal; color:#888;">votes</span>
            </div>
        </div>
        <?php endif; ?>
    <?php endforeach; ?>
    </div>

    <div class="footer">
        <strong>Database Signature:</strong> <?php echo htmlspecialchars($archive_db); ?><br>
        This document acts as the official final record for the election. Generated automatically by the Secure Voting System.
    </div>
</div>

</body>
</html>