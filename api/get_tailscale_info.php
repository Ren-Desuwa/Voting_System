<?php
// api/get_tailscale_info.php
// FIXED: Reads the "Real" status injected by the host
header('Content-Type: application/json');

$statusFile = 'ts_status.json';

try {
    $foundUrl = null;
    $isConnected = false;

    // 1. Check if the status file exists (Created by our startup script)
    if (file_exists($statusFile)) {
        $json = file_get_contents($statusFile);
        $data = json_decode($json, true);

        // Look for the "MagicDNS" name in the official JSON status
        if (isset($data['Self']['DNSName'])) {
            $dns = rtrim($data['Self']['DNSName'], '.');
            // This grabs the REAL name, including "-1", "-2", etc.
            $foundUrl = "https://" . $dns;
            $isConnected = true;
        }
    }

    // 2. Fallback: If file is missing, try to guess (but warn the user)
    if (!$foundUrl) {
        $message = "Tailscale status file not found. Please run the 'Refresh Status' command.";
    } else {
        $message = "Online: $foundUrl";
    }

    echo json_encode([
        'success' => true,
        'connected' => $isConnected,
        'url' => $foundUrl,
        'hostname' => $foundUrl ? parse_url($foundUrl, PHP_URL_HOST) : 'unknown',
        'message' => $message
    ]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>