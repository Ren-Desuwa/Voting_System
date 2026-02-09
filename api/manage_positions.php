<?php
require '../db.php';

// Set JSON header
header('Content-Type: application/json');

$action = $_GET['action'] ?? 'list';

try {
    if ($action == 'list') {
        // List all positions ordered by priority (or id if priority doesn't exist yet)
        $stmt = $pdo->query("SELECT * FROM positions ORDER BY priority ASC, id ASC");
        echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    } 
    
    elseif ($action == 'add' && $_SERVER['REQUEST_METHOD'] == 'POST') {
        $title = $_POST['title'] ?? '';
        
        if (empty($title)) {
            echo json_encode(['success' => false, 'message' => 'Title is required']);
            exit;
        }
        
        // Get the max priority and add 1
        $stmt = $pdo->query("SELECT MAX(priority) as max_priority FROM positions");
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        $newPriority = ($result['max_priority'] ?? 0) + 1;
        
        // Insert with priority
        $stmt = $pdo->prepare("INSERT INTO positions (title, priority) VALUES (?, ?)");
        $success = $stmt->execute([$title, $newPriority]);
        
        if ($success) {
            echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Failed to add position']);
        }
    } 
    
    elseif ($action == 'delete') {
        $id = $_POST['id'] ?? $_GET['id'] ?? 0;
        
        if (!$id) {
            echo json_encode(['success' => false, 'message' => 'Invalid position ID']);
            exit;
        }
        
        // First, delete all candidates for this position
        $stmt = $pdo->prepare("DELETE FROM candidates WHERE position_id = ?");
        $stmt->execute([$id]);
        
        // Then delete the position
        $stmt = $pdo->prepare("DELETE FROM positions WHERE id = ?");
        $success = $stmt->execute([$id]);
        
        if ($success) {
            // Reorder remaining positions to fill the gap
            $stmt = $pdo->query("SELECT id FROM positions ORDER BY priority ASC, id ASC");
            $positions = $stmt->fetchAll(PDO::FETCH_COLUMN);
            
            foreach ($positions as $index => $posId) {
                $updateStmt = $pdo->prepare("UPDATE positions SET priority = ? WHERE id = ?");
                $updateStmt->execute([$index + 1, $posId]);
            }
            
            echo json_encode(['success' => true, 'message' => 'Position deleted successfully']);
        } else {
            echo json_encode(['success' => false, 'message' => 'Failed to delete position']);
        }
    }
    
    elseif ($action == 'reorder' && $_SERVER['REQUEST_METHOD'] == 'POST') {
        // Get JSON data from request body
        $json = file_get_contents('php://input');
        $data = json_decode($json, true);
        
        if (!isset($data['order']) || !is_array($data['order'])) {
            echo json_encode(['success' => false, 'message' => 'Invalid order data']);
            exit;
        }
        
        $order = $data['order'];
        
        // Update each position's priority in the database
        $pdo->beginTransaction();
        try {
            foreach ($order as $index => $positionId) {
                $priority = $index + 1; // 1-indexed (starts from 1)
                $stmt = $pdo->prepare("UPDATE positions SET priority = ? WHERE id = ?");
                $stmt->execute([$priority, $positionId]);
            }
            $pdo->commit();
            echo json_encode(['success' => true, 'message' => 'Position order updated successfully']);
        } catch (Exception $e) {
            $pdo->rollBack();
            echo json_encode(['success' => false, 'message' => 'Failed to update position order: ' . $e->getMessage()]);
        }
    }
    
    else {
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
    }
    
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}
?>