<?php
// api/get_tailscale_info.php
// Returns Tailscale connection status and URL
header('Content-Type: application/json');

try {
    // Try to get Tailscale status from the container
    // This will work if we're running in Docker
    $tailscaleStatus = shell_exec('docker exec election-tailscale tailscale status --json 2>/dev/null');
    
    if ($tailscaleStatus) {
        $status = json_decode($tailscaleStatus, true);
        
        // Extract the MagicDNS name
        $magicDNSName = '';
        $ipAddress = '';
        $isConnected = false;
        
        if (isset($status['Self'])) {
            $magicDNSName = $status['Self']['DNSName'] ?? '';
            $ipAddress = $status['Self']['TailscaleIPs'][0] ?? '';
            $isConnected = true;
            
            // Remove trailing dot from DNS name
            $magicDNSName = rtrim($magicDNSName, '.');
            
            // Construct full URL
            $fullUrl = 'https://' . $magicDNSName;
        }
        
        echo json_encode([
            'success' => true,
            'connected' => $isConnected,
            'url' => $fullUrl ?? null,
            'hostname' => 'czshs-vote',
            'dns_name' => $magicDNSName,
            'ip' => $ipAddress,
            'message' => $isConnected ? 'Tailscale is connected' : 'Tailscale is not connected'
        ]);
        
    } else {
        // Fallback: provide expected URL format
        echo json_encode([
            'success' => true,
            'connected' => 'unknown',
            'url' => null,
            'hostname' => 'czshs-vote',
            'message' => 'Tailscale status unavailable. Expected URL: https://czshs-vote.tail97fe4a.ts.net',
            'help' => 'Check Tailscale Admin Console for exact URL'
        ]);
    }
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'connected' => false,
        'message' => 'Error checking Tailscale status',
        'error' => $e->getMessage()
    ]);
}
?>