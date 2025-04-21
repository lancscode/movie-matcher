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
require_once 'tmdb_api.php';

// Get parameters from query string
$session_id = $_GET['session_id'] ?? '';
$user_number = $_GET['user_number'] ?? 1;
$category = $_GET['category'] ?? 'popular'; // Get the category from the request, default to popular

if (empty($session_id)) {
    echo json_encode(['success' => false, 'error' => 'Session ID is required']);
    exit;
}

// Check if session exists
$stmt = $conn->prepare("SELECT * FROM sessions WHERE session_id = ?");
$stmt->bind_param("s", $session_id);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    echo json_encode(['success' => false, 'error' => 'Session not found']);
    $stmt->close();
    $conn->close();
    exit;
}

// Update session last_active timestamp
$stmt = $conn->prepare("UPDATE sessions SET last_active = CURRENT_TIMESTAMP WHERE session_id = ?");
$stmt->bind_param("s", $session_id);
$stmt->execute();

// Get already swiped movies for this user in this session
$stmt = $conn->prepare("
    SELECT movie_id FROM preferences 
    WHERE session_id = ? AND user_number = ?
");
$stmt->bind_param("si", $session_id, $user_number);
$stmt->execute();
$result = $stmt->get_result();

$swiped_movies = [];
while ($row = $result->fetch_assoc()) {
    $swiped_movies[] = $row['movie_id'];
}

// Important change: Skip the database query and always fetch fresh movies from TMDB
// This ensures that the category selection works as expected
$limit = 20; // Number of movies to return
$movies = [];

// Fetch movies from TMDB based on the selected category
$fetched_movies = fetchMoviesFromTMDB($limit, null, $category);

// Process the fetched movies
foreach ($fetched_movies as $movie) {
    // Skip movies that the user has already swiped on
    if (in_array($movie['id'], $swiped_movies)) {
        continue;
    }
    
    $release_year = !empty($movie['release_date']) ? intval(substr($movie['release_date'], 0, 4)) : null;
    
    // Insert into database (but we don't need to wait for this)
    $stmt = $conn->prepare("
        INSERT IGNORE INTO movies (movie_id, title, poster_path, release_year, overview) 
        VALUES (?, ?, ?, ?, ?)
    ");
    
    $stmt->bind_param("issis", 
        $movie['id'], 
        $movie['title'], 
        $movie['poster_path'], 
        $release_year, 
        $movie['overview']
    );
    $stmt->execute();
    
    // Add to our response array
    $movies[] = [
        'movie_id' => $movie['id'],
        'title' => $movie['title'],
        'poster_path' => $movie['poster_path'],
        'release_year' => $release_year,
        'overview' => $movie['overview']
    ];
    
    if (count($movies) >= $limit) {
        break;
    }
}

echo json_encode(['success' => true, 'movies' => $movies]);

$stmt->close();
$conn->close();
?>