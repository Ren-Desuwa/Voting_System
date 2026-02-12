<?php
// vote/api/manage_election.php
error_reporting(E_ALL);
ini_set('display_errors', 0);
header('Content-Type: application/json');

require '../db.php';
require 'generate_results.php'; 

$action = $_POST['action'] ?? '';
$targetFile = dirname(__DIR__) . '/election.html';

$response = [
    'success' => false, 
    'debug' => [
        'target_file' => $targetFile,
        'is_writable' => is_writable(dirname($targetFile))
    ]
];

try {
    // --- GET STATUS (With Auto-Heal) ---
    if ($action === 'get_status') {
        $stmt = $pdo->query("SELECT setting_value FROM settings WHERE setting_key = 'election_status'");
        $status = $stmt->fetchColumn() ?: 'not_started';
        
        // CHECK FOR FORCE SYNC (Run on page load or container start)
        if (isset($_POST['force_sync']) && $_POST['force_sync'] == '1') {
            $bytes = false;
            
            if ($status === 'ended') {
                // If ended, ensure results are visible
                $bytes = generateFinalReport($pdo, $targetFile);
            } elseif ($status === 'not_started') {
                // If not started (reset), ensure "Pending" page is visible
                $bytes = generateNoResultsPage($targetFile);
            }
            
            $response['debug']['force_sync_attempt'] = true;
            $response['debug']['bytes_written'] = $bytes;
        }
        // FAIL-SAFE: If file is missing completely, generate "No Results"
        elseif (!file_exists($targetFile)) {
             generateNoResultsPage($targetFile);
        }
        
        $response['success'] = true;
        $response['status'] = $status;
        echo json_encode($response);
        exit;
    }

    // --- UPDATE STATUS ---
    if ($action === 'update_status') {
        $newStatus = $_POST['status'] ?? '';
        $now = date('Y-m-d H:i:s');
        
        // 1. Update Database
        $pdo->prepare("REPLACE INTO settings (setting_key, setting_value) VALUES ('election_status', ?)")
            ->execute([$newStatus]);

        // 2. Logic & File Generation
        $bytesWritten = false;

        if ($newStatus === 'active') {
            $check = $pdo->query("SELECT setting_value FROM settings WHERE setting_key = 'election_start_time'")->fetchColumn();
            if ($check == '2026-01-01 00:00:00' || !$check) {
                $pdo->prepare("UPDATE settings SET setting_value = ? WHERE setting_key = 'election_start_time'")->execute([$now]);
            }
            // Active election = Do not change file (Keep it as "Pending")
        } 
        elseif ($newStatus === 'ended') {
            $pdo->prepare("UPDATE settings SET setting_value = ? WHERE setting_key = 'election_end_time'")->execute([$now]);
            // Election Over = Generate Real Results
            $bytesWritten = generateFinalReport($pdo, $targetFile);
        }
        elseif ($newStatus === 'not_started') {
            // Reset/Not Started = Generate "No Results" Page
            $bytesWritten = generateNoResultsPage($targetFile);
        }

        // 3. Return Success
        $response['success'] = true;
        $response['debug']['bytes_written'] = $bytesWritten;
        
        echo json_encode($response);
        exit;
    }

} catch (Exception $e) {
    $response['error'] = $e->getMessage();
    echo json_encode($response);
    exit;
}
?>