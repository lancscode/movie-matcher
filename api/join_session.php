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

    if (empty($session_id)) {
        echo json_encode(['success' => false, 'error' => 'Session ID is required']);
        exit;
    }

    // Check if session exists
    $stmt = $conn->prepare("SELECT * FROM sessions WHERE session_id = ?");
    $stmt->bind_param("s", $session_id);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows > 0) {
        $session = $result->fetch_assoc();
        echo json_encode([
            'success' => true, 
            'session_id' => $session_id,
            'category' => $session['category'] ?? 'popular'
        ]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Session not found']);
    }

    $stmt->close();
    $conn->close();
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => 'Server error: ' . $e->getMessage()]);
}
?>