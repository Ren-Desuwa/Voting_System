<?php
// vote/api/manage_election.php
error_reporting(E_ALL);
ini_set('display_errors', 0); // Disable echo errors to keep JSON valid
header('Content-Type: application/json');

require '../db.php';
require 'generate_results.php'; // Required for file generation

$action = $_POST['action'] ?? '';

// Calculate absolute path to election.html
$targetFile = dirname(__DIR__) . '/election.html';

// Prepare Debug Response
$response = [
    'success' => false, 
    'debug' => [
        'target_file' => $targetFile,
        'directory_writable' => is_writable(dirname($targetFile)),
        'file_exists' => file_exists($targetFile),
        'file_writable' => (file_exists($targetFile) ? is_writable($targetFile) : 'N/A')
    ]
];

try {
    // =========================================================
    // ACTION 1: GET STATUS (Optional: Force File Regeneration)
    // =========================================================
    if ($action === 'get_status') {
        $stmt = $pdo->query("SELECT setting_value FROM settings WHERE setting_key = 'election_status'");
        $status = $stmt->fetchColumn() ?: 'not_started';
        
        // CHECK FOR FORCE SYNC FLAG
        if (isset($_POST['force_sync']) && $_POST['force_sync'] == '1') {
            $bytes = false;
            
            // Regenerate the file based on current DB status
            if ($status === 'active') {
                $bytes = generatePlaceholderPage("active", $targetFile);
            } elseif ($status === 'paused') {
                $bytes = generatePlaceholderPage("paused", $targetFile);
            } elseif ($status === 'ended') {
                $bytes = generateFinalReport($pdo, $targetFile);
            } else {
                $bytes = generatePlaceholderPage("not_started", $targetFile);
            }
            
            // Capture debug info
            if ($bytes !== false) {
                $response['debug']['write_status'] = "SUCCESS";
                $response['debug']['bytes_written'] = $bytes;
            } else {
                $response['debug']['write_status'] = "FAILED";
                $response['debug']['system_error'] = error_get_last();
            }
        }
        
        $response['success'] = true;
        $response['status'] = $status;
        echo json_encode($response);
        exit;
    }

    // =========================================================
    // ACTION 2: UPDATE STATUS (Clicked a Button)
    // =========================================================
    if ($action === 'update_status') {
        $newStatus = $_POST['status'] ?? '';
        $now = date('Y-m-d H:i:s');
        
        $response['debug']['action'] = "Updating to $newStatus";

        // 1. Update Database
        $pdo->prepare("REPLACE INTO settings (setting_key, setting_value) VALUES ('election_status', ?)")
            ->execute([$newStatus]);

        // 2. Logic & File Generation
        $bytesWritten = false;

        if ($newStatus === 'active') {
            // Set Start Time if missing
            $check = $pdo->query("SELECT setting_value FROM settings WHERE setting_key = 'election_start_time'")->fetchColumn();
            if ($check == '2026-01-01 00:00:00' || !$check) {
                $pdo->prepare("UPDATE settings SET setting_value = ? WHERE setting_key = 'election_start_time'")->execute([$now]);
            }
            $bytesWritten = generatePlaceholderPage("active", $targetFile);
        } 
        elseif ($newStatus === 'paused') {
            $bytesWritten = generatePlaceholderPage("paused", $targetFile);
        }
        elseif ($newStatus === 'ended') {
            $pdo->prepare("UPDATE settings SET setting_value = ? WHERE setting_key = 'election_end_time'")->execute([$now]);
            $bytesWritten = generateFinalReport($pdo, $targetFile);
        }
        elseif ($newStatus === 'not_started') {
            $bytesWritten = generatePlaceholderPage("not_started", $targetFile);
        }

        // 3. Return Result
        if ($bytesWritten !== false) {
            $response['success'] = true;
            $response['debug']['write_status'] = "SUCCESS";
            $response['debug']['bytes_written'] = $bytesWritten;
        } else {
            $response['debug']['write_status'] = "FAILED";
            $response['debug']['system_error'] = error_get_last();
        }
        
        echo json_encode($response);
        exit;
    }

} catch (Exception $e) {
    $response['error'] = $e->getMessage();
    echo json_encode($response);
    exit;
}
?>