<?php
// Set CORS headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept, Authorization');
header('Access-Control-Max-Age: 86400');

// Handle preflight OPTIONS requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Get the endpoint parameter
$endpoint = isset($_GET['endpoint']) ? $_GET['endpoint'] : '';

// Clean the endpoint value (remove any leading slash and .php extension)
$endpoint = ltrim($endpoint, '/');
$endpoint = str_replace('.php', '', $endpoint);

if (empty($endpoint)) {
    echo json_encode(['success' => false, 'error' => 'No endpoint specified']);
    exit();
}

// Build the target file path
$target_file = __DIR__ . '/api/' . $endpoint . '.php';

if (!file_exists($target_file)) {
    echo json_encode([
        'success' => false, 
        'error' => 'Endpoint not found: ' . $endpoint,
        'path' => $target_file
    ]);
    exit();
}

// Include the API file
include($target_file);
?>