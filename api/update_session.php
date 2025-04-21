<?php
// Set content type first to ensure JSON output
header('Content-Type: application/json');

// Set CORS headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    // Just return with 200 OK
    http_response_code(200);
    exit();
}

// Prevent PHP errors from displaying as HTML
ini_set('display_errors', 0);
error_reporting(E_ALL);

try {
    require_once 'db_connect.php';

    // Get data from request
    $data = json_decode(file_get_contents('php://input'), true);
    $session_id = $data['session_id'] ?? '';
    
    // Check which properties we're updating
    $updateFields = [];
    $updateParams = [];
    $updateTypes = '';
    
    // Handle category update
    if (isset($data['category'])) {
        $updateFields[] = "category = ?";
        $updateParams[] = $data['category'];
        $updateTypes .= 's'; // string type
    }
    
    // Add other updateable fields here in the future
    // Example: if (isset($data['some_property'])) { ... }
    
    // Validate required data
    if (empty($session_id)) {
        echo json_encode(['success' => false, 'error' => 'Session ID is required']);
        exit;
    }
    
    if (empty($updateFields)) {
        echo json_encode(['success' => false, 'error' => 'No fields to update']);
        exit;
    }
    
    // Construct the update query
    $updateQuery = "UPDATE sessions SET " . implode(', ', $updateFields) . " WHERE session_id = ?";
    $updateParams[] = $session_id;
    $updateTypes .= 's'; // Add session_id parameter type
    
    // Prepare and execute the update
    $stmt = $conn->prepare($updateQuery);
    
    // Bind parameters dynamically
    $bindParams = array($updateTypes);
    for ($i = 0; $i < count($updateParams); $i++) {
        $bindParams[] = &$updateParams[$i];
    }
    call_user_func_array(array($stmt, 'bind_param'), $bindParams);
    
    if ($stmt->execute()) {
        if ($stmt->affected_rows > 0) {
            // Get the updated session data
            $getStmt = $conn->prepare("SELECT * FROM sessions WHERE session_id = ?");
            $getStmt->bind_param('s', $session_id);
            $getStmt->execute();
            $result = $getStmt->get_result();
            $session = $result->fetch_assoc();
            
            echo json_encode([
                'success' => true, 
                'message' => 'Session updated successfully',
                'session' => $session
            ]);
        } else {
            echo json_encode(['success' => false, 'error' => 'Session not found or no changes made']);
        }
    } else {
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $stmt->error]);
    }
    
    $stmt->close();
    $conn->close();
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => 'Server error: ' . $e->getMessage()]);
}
?>