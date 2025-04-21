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

// Get data from request
$data = json_decode(file_get_contents('php://input'), true);

$session_id = $data['session_id'] ?? '';
$movie_id = $data['movie_id'] ?? 0;
$user_number = $data['user_number'] ?? 1;
$liked = isset($data['liked']) ? ($data['liked'] ? 1 : 0) : 0;

if (empty($session_id) || empty($movie_id)) {
    echo json_encode(['success' => false, 'error' => 'Session ID and Movie ID are required']);
    exit;
}

// Insert preference
$stmt = $conn->prepare("
    INSERT INTO preferences (session_id, movie_id, user_number, liked) 
    VALUES (?, ?, ?, ?) 
    ON DUPLICATE KEY UPDATE liked = ?
");
$stmt->bind_param("siiii", $session_id, $movie_id, $user_number, $liked, $liked);

if ($stmt->execute()) {
    // If liked, check for a match
    if ($liked) {
        checkForMatch($conn, $session_id, $movie_id);
    }
    echo json_encode(['success' => true]);
} else {
    echo json_encode(['success' => false, 'error' => $stmt->error]);
}

// Helper function to check for match
function checkForMatch($conn, $session_id, $movie_id) {
    // Check if both users liked this movie
    $stmt = $conn->prepare("
        SELECT COUNT(*) AS like_count 
        FROM preferences 
        WHERE session_id = ? AND movie_id = ? AND liked = 1
    ");
    $stmt->bind_param("si", $session_id, $movie_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    
    // If both users liked it (like_count = 2), create a match
    if ($row['like_count'] == 2) {
        $stmt = $conn->prepare("
            INSERT IGNORE INTO matches (session_id, movie_id) 
            VALUES (?, ?)
        ");
        $stmt->bind_param("si", $session_id, $movie_id);
        $stmt->execute();
    }
}

$stmt->close();
$conn->close();
?>