<?php
// vote/api/manage_election.php
error_reporting(E_ALL);
ini_set('display_errors', 0); // Don't crash JSON with text errors
header('Content-Type: application/json');

require '../db.php';
require 'generate_results.php'; // <--- Imports the heavy lifting functions

$action = $_POST['action'] ?? '';

// Define the path explicitly using dirname to avoid ".." confusion
$targetFile = dirname(__DIR__) . '/election.html';

// Initialize Debug Response
$response = [
    'success' => false, 
    'debug' => [
        'target_file' => $targetFile,
        'is_writable' => is_writable(dirname($targetFile))
    ]
];

try {
    // --- GET STATUS ---
    if ($action === 'get_status') {
        $stmt = $pdo->query("SELECT setting_value FROM settings WHERE setting_key = 'election_status'");
        $status = $stmt->fetchColumn() ?: 'not_started';
        echo json_encode(['success' => true, 'status' => $status]);
        exit;
    }

    // --- UPDATE STATUS ---
    if ($action === 'update_status') {
        $newStatus = $_POST['status'] ?? '';
        $now = date('Y-m-d H:i:s');
        
        $response['debug']['action'] = "Updating to $newStatus";

        // 1. Update Database
        $pdo->prepare("REPLACE INTO settings (setting_key, setting_value) VALUES ('election_status', ?)")
            ->execute([$newStatus]);

        // 2. Logic & File Generation
        $bytesWritten = 0;

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

        // 3. Return Success
        $response['success'] = true;
        $response['debug']['bytes_written'] = $bytesWritten;
        $response['debug']['write_status'] = ($bytesWritten !== false) ? "SUCCESS" : "FAILED";
        
        echo json_encode($response);
        exit;
    }

} catch (Exception $e) {
    $response['error'] = $e->getMessage();
    echo json_encode($response);
    exit;
}
?>