<?php
// api/get_tailscale_info.php
header('Content-Type: application/json');

// Define file paths
$statusFile = 'ts_status.json';
$ipFile = '../local_ip.txt'; // <--- This looks for the file created by start_server.sh

try {
    // 1. Get Tailscale URL (Remote)
    $foundUrl = null;
    $isConnected = false;

    if (file_exists($statusFile)) {
        $json = file_get_contents($statusFile);
        $data = json_decode($json, true);
        if (isset($data['Self']['DNSName'])) {
            $dns = rtrim($data['Self']['DNSName'], '.');
            $foundUrl = "https://" . $dns;
            $isConnected = true;
        }
    }

    // 2. Get Local LAN IP (The Fix)
    $lanIp = null;

    // PRIORITY: Check the file written by your start_server.sh script
    if (file_exists($ipFile)) {
        $fileContent = file_get_contents($ipFile);
        $lanIp = trim($fileContent); // Remove any accidental spaces or newlines
    }
    
    // Fallback: If file is missing, try to guess (usually gets Docker IP, but better than nothing)
    if (!$lanIp) {
        $localIpRaw = shell_exec("hostname -I"); 
        $localIps = explode(" ", trim($localIpRaw));
        $lanIp = $localIps[0] ?? gethostbyname(gethostname());
    }

    // 3. Send both to the JavaScript
    echo json_encode([
        'success' => true,
        'connected' => $isConnected,
        'url' => $foundUrl,
        'lan_ip' => $lanIp, // <--- This is what the Green Box uses
        'message' => $foundUrl ? "Online" : "Tailscale Offline"
    ]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>