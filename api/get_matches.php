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

// Get session ID from query parameter
$session_id = $_GET['session_id'] ?? '';

if (empty($session_id)) {
    echo json_encode(['success' => false, 'error' => 'Session ID is required']);
    exit;
}

// Get matches
$stmt = $conn->prepare("
    SELECT m.match_id, m.movie_id, m.discovered_at, mv.title, mv.poster_path, mv.release_year, mv.vote_average, mv.overview
    FROM matches m
    JOIN movies mv ON m.movie_id = mv.movie_id
    WHERE m.session_id = ?
    ORDER BY m.discovered_at DESC
");
$stmt->bind_param("s", $session_id);
$stmt->execute();
$result = $stmt->get_result();

$matches = [];
while ($row = $result->fetch_assoc()) {
    $matches[] = $row;
}

echo json_encode(['success' => true, 'matches' => $matches]);

$stmt->close();
$conn->close();
?>