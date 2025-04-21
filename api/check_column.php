<?php
// Set CORS headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Enable error reporting for debugging
ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once 'db_connect.php';

try {
    // Check if the vote_average column exists in the movies table
    $columnExists = false;
    $result = $conn->query("SHOW COLUMNS FROM movies LIKE 'vote_average'");
    
    if ($result && $result->num_rows > 0) {
        $columnExists = true;
    }
    
    // Get table structure
    $tablesResult = $conn->query("SHOW TABLES");
    $tables = [];
    
    if ($tablesResult) {
        while ($row = $tablesResult->fetch_row()) {
            $tables[] = $row[0];
        }
    }
    
    // Check movies table structure
    $moviesStructure = [];
    if (in_array('movies', $tables)) {
        $columnsResult = $conn->query("DESCRIBE movies");
        if ($columnsResult) {
            while ($row = $columnsResult->fetch_assoc()) {
                $moviesStructure[] = $row;
            }
        }
    }
    
    echo json_encode([
        'success' => true,
        'vote_average_exists' => $columnExists,
        'tables' => $tables,
        'movies_structure' => $moviesStructure
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

$conn->close();
?>