<?php
// Set strong no-cache headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once 'db_connect.php';
require_once 'tmdb_api.php';

// Get parameters
$session_id = $_GET['session_id'] ?? '';
$user_number = isset($_GET['user_number']) ? intval($_GET['user_number']) : 1;

if (empty($session_id)) {
    echo json_encode(['success' => false, 'error' => 'Session ID is required']);
    exit;
}

// Function to get session movies
function getSessionMovies($conn, $session_id) {
    // Check if movies exist for this session
    $stmt = $conn->prepare("SELECT COUNT(*) as count FROM session_movies WHERE session_id = ?");
    $stmt->bind_param("s", $session_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    
    if ($row['count'] === 0) {
        return false;
    }
    
    // Get movies in display order
    $stmt = $conn->prepare("
        SELECT sm.movie_id, sm.display_order
        FROM session_movies sm
        WHERE sm.session_id = ?
        ORDER BY sm.display_order ASC
    ");
    $stmt->bind_param("s", $session_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $session_movies = [];
    while ($row = $result->fetch_assoc()) {
        $session_movies[] = $row;
    }
    
    return $session_movies;
}

// Main execution flow with explicit locking
try {
    // Get session info
    $stmt = $conn->prepare("SELECT * FROM sessions WHERE session_id = ? FOR UPDATE");
    $stmt->bind_param("s", $session_id);
    $conn->begin_transaction();
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        $conn->rollback();
        echo json_encode(['success' => false, 'error' => 'Session not found']);
        exit;
    }
    
    $session = $result->fetch_assoc();
    $category = $session['category'] ?? 'popular';
    
    // Check if we need to initialize session movies
    $session_movies = getSessionMovies($conn, $session_id);
    
    if ($session_movies === false) {
        // No movies yet - initialize them (only first user will do this due to locking)
        $page = (crc32($session_id) % 50) + 1;
        $movies_to_add = fetchMoviesFromTMDB(20, $page, $category);
        
        if (!empty($movies_to_add)) {
            // Insert movies in a deterministic order
            for ($i = 0; $i < count($movies_to_add); $i++) {
                $movie = $movies_to_add[$i];
                $movie_id = $movie['id'];
                $release_year = !empty($movie['release_date']) ? intval(substr($movie['release_date'], 0, 4)) : null;
                $vote_average = isset($movie['vote_average']) ? floatval($movie['vote_average']) : null;
                
                // First insert into movies table - Modified to include vote_average
                $stmt = $conn->prepare("
                    INSERT IGNORE INTO movies (movie_id, title, poster_path, release_year, vote_average, overview) 
                    VALUES (?, ?, ?, ?, ?, ?)
                ");
                $stmt->bind_param("issids", 
                    $movie_id, 
                    $movie['title'], 
                    $movie['poster_path'], 
                    $release_year,
                    $vote_average, 
                    $movie['overview']
                );
                $stmt->execute();
                
                // Then insert into session_movies table with display order
                $stmt = $conn->prepare("
                    INSERT IGNORE INTO session_movies (session_id, movie_id, display_order) 
                    VALUES (?, ?, ?)
                ");
                $stmt->bind_param("sii", $session_id, $movie_id, $i);
                $stmt->execute();
            }
            
            // Get the freshly added movies
            $session_movies = getSessionMovies($conn, $session_id);
        }
    }
    
    // Now get the user's swiped movies
    $stmt = $conn->prepare("
        SELECT movie_id FROM preferences 
        WHERE session_id = ? AND user_number = ?
    ");
    $stmt->bind_param("si", $session_id, $user_number);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $swiped_movie_ids = [];
    while ($row = $result->fetch_assoc()) {
        $swiped_movie_ids[] = $row['movie_id'];
    }
    
    // Commit transaction
    $conn->commit();
    
    // Now get the full movie details including filtering out swiped ones
    $movies_to_return = [];
    if (!empty($session_movies)) {
        // Create a list of movie IDs ordered by display_order
        $ordered_movie_ids = [];
        foreach ($session_movies as $movie) {
            $ordered_movie_ids[] = $movie['movie_id'];
        }
        
        if (!empty($ordered_movie_ids)) {
            // Get all movie details in a single query
            $ids_string = implode(',', $ordered_movie_ids);
            $query = "SELECT * FROM movies WHERE movie_id IN ($ids_string)";
            $result = $conn->query($query);
            
            $movies_by_id = [];
            while ($row = $result->fetch_assoc()) {
                $movies_by_id[$row['movie_id']] = $row;
            }
            
            // Now construct the final array in the correct order, filtering out swiped movies
            foreach ($ordered_movie_ids as $movie_id) {
                if (!in_array($movie_id, $swiped_movie_ids) && isset($movies_by_id[$movie_id])) {
                    $movies_to_return[] = $movies_by_id[$movie_id];
                }
            }
        }
    }
    
    echo json_encode([
        'success' => true, 
        'movies' => $movies_to_return, 
        'category' => $category,
        'debug' => [
            'session_id' => $session_id,
            'user_number' => $user_number,
            'total_session_movies' => count($session_movies),
            'filtered_movies' => count($movies_to_return),
            'swiped_movies' => count($swiped_movie_ids)
        ]
    ]);
    
} catch (Exception $e) {
    if ($conn->inTransaction()) {
        $conn->rollback();
    }
    echo json_encode([
        'success' => false, 
        'error' => 'Database error: ' . $e->getMessage()
    ]);
}

$conn->close();
?>