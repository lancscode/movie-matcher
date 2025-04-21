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

// Database connection with Ionos recommended settings
$host_name = 'db5017671070.hosting-data.io';
$database = 'dbs14131484';
$user_name = 'dbu3144917';
$password = 'mecga9-Sytren-qenzoh';

// Create connection
$conn = new mysqli($host_name, $user_name, $password, $database);

// Check connection
if ($conn->connect_error) {
    die(json_encode(['success' => false, 'error' => "Connection failed: " . $conn->connect_error]));
}

// Check if the tables exist
$tables = ['sessions', 'movies', 'preferences', 'matches'];
$missing_tables = [];

foreach ($tables as $table) {
    $result = $conn->query("SHOW TABLES LIKE '$table'");
    if ($result->num_rows == 0) {
        $missing_tables[] = $table;
    }
}

// Return response
echo json_encode([
    'success' => true, 
    'message' => 'Database connection successful', 
    'missing_tables' => $missing_tables,
    'db_info' => [
        'host' => $host_name,
        'database' => $database
    ]
]);

$conn->close();
?>