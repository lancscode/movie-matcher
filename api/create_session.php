<?php
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

require_once 'db_connect.php';

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

// Insert the new session
$stmt = $conn->prepare("INSERT INTO sessions (session_id) VALUES (?)");
$stmt->bind_param("s", $session_id);

if ($stmt->execute()) {
    echo json_encode(['success' => true, 'session_id' => $session_id]);
} else {
    echo json_encode(['success' => false, 'error' => $conn->error]);
}

$stmt->close();
$conn->close();
?>