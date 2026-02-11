<?php
// api/seal_election.php
require '../db.php';
header('Content-Type: application/json');

// Security check: You might want to add a session check here to ensure only Admin can run this
// session_start();
// if (!isset($_SESSION['is_admin'])) die(json_encode(['success'=>false, 'message'=>'Unauthorized']));

try {
    // 1. Generate Archive Name (e.g., voting_archive_2026_02_12_1530)
    $timestamp = date('Y_m_d_Hi');
    $archive_db = "voting_archive_" . $timestamp;
    $live_db = $db; // From db.php ('voting_system')

    // 2. Connect as ROOT to create new DBs
    $conn = new PDO("mysql:host=$host", $user, $pass);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // 3. Create the Archive Database
    $conn->exec("CREATE DATABASE `$archive_db`");

    // 4. Clone All Tables (Structure + Data)
    $tables = ['settings', 'positions', 'parties', 'candidates', 'voters', 'votes', 'sessions'];
    
    foreach ($tables as $table) {
        // Copy Structure
        $conn->exec("CREATE TABLE `$archive_db`.`$table` LIKE `$live_db`.`$table`");
        // Copy Data
        $conn->exec("INSERT INTO `$archive_db`.`$table` SELECT * FROM `$live_db`.`$table`");
    }

    // 5. Create/Update Read-Only Auditor User
    // This user can ONLY read the archive, never modify it
    $auditor_user = 'public_auditor';
    $auditor_pass = 'audit_secure_pass_2026';

    // Create user if not exists
    $conn->exec("CREATE USER IF NOT EXISTS '$auditor_user'@'%' IDENTIFIED BY '$auditor_pass'");
    
    // Grant SELECT only on the new archive
    $conn->exec("GRANT SELECT ON `$archive_db`.* TO '$auditor_user'@'%'");
    $conn->exec("FLUSH PRIVILEGES");

    // 6. Save a "Receipt" file so we know which databases are elections
    $historyFile = '../data/election_history.json';
    $history = file_exists($historyFile) ? json_decode(file_get_contents($historyFile), true) : [];
    
    $history[] = [
        'name' => 'Election Ended ' . date('M d, Y h:i A'),
        'db_name' => $archive_db,
        'sealed_at' => date('c'),
        'link' => "final_results.php?db=$archive_db"
    ];
    
    file_put_contents($historyFile, json_encode($history, JSON_PRETTY_PRINT));

    echo json_encode([
        'success' => true, 
        'message' => 'Election Sealed Successfully!',
        'redirect' => "final_results.php?db=$archive_db"
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>