<?php
// Set CORS headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    // Just return with 200 OK
    http_response_code(200);
    exit();
}

require_once 'db_connect.php';

// Get data from request
$data = json_decode(file_get_contents('php://input'), true);
$category = $data['category'] ?? 'popular'; // Default to popular if not specified

// Generate a random session ID (8 characters)
function generateSessionId($length = 8) {
    $characters = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    $session_id = '';
    for ($i = 0; $i < $length; $i++) {
        $session_id .= $characters[rand(0, strlen($characters) - 1)];
    }
    return $session_id;
}

// Create a new session
$session_id = generateSessionId();

// Check if session ID already exists, if so, generate a new one
$stmt = $conn->prepare("SELECT session_id FROM sessions WHERE session_id = ?");
$stmt->bind_param("s", $session_id);
$stmt->execute();
$result = $stmt->get_result();

while ($result->num_rows > 0) {
    $session_id = generateSessionId();
    $stmt->bind_param("s", $session_id);
    $stmt->execute();
    $result = $stmt->get_result();
}

// Insert the new session with the category
$stmt = $conn->prepare("INSERT INTO sessions (session_id, category) VALUES (?, ?)");
$stmt->bind_param("ss", $session_id, $category);

if ($stmt->execute()) {
    echo json_encode(['success' => true, 'session_id' => $session_id, 'category' => $category]);
} else {
    echo json_encode(['success' => false, 'error' => $conn->error]);
}

$stmt->close();
$conn->close();
?>