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
// TMDB API functions
define('TMDB_API_KEY', '448b5d0657afed9fe1dfa62f72538c98'); // Replace with your actual TMDB API key
define('TMDB_BASE_URL', 'https://api.themoviedb.org/3');

function fetchMoviesFromTMDB($count = 20, $page = null, $category = 'popular') {
    if ($page === null) {
        // Get a random page between 1 and 50
        $page = rand(1, 50);
    }
    
    // Define valid categories and their endpoints
    $validCategories = [
        'popular' => '/movie/popular',
        'top_rated' => '/movie/top_rated',
        'now_playing' => '/movie/now_playing',
        'upcoming' => '/movie/upcoming',
        'trending_day' => '/trending/movie/day',
        'trending_week' => '/trending/movie/week'
    ];
    
    // Default to popular if category is not valid
    $endpoint = isset($validCategories[$category]) ? $validCategories[$category] : '/movie/popular';
    
    $url = TMDB_BASE_URL . $endpoint . "?api_key=" . TMDB_API_KEY . "&page=" . $page;
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    
    $response = curl_exec($ch);
    
    if (curl_errno($ch)) {
        error_log('Curl error: ' . curl_error($ch));
        curl_close($ch);
        return [];
    }
    
    curl_close($ch);
    
    $data = json_decode($response, true);
    
    if (!isset($data['results']) || !is_array($data['results'])) {
        error_log('Invalid response from TMDB API: ' . $response);
        return [];
    }
    
    return array_slice($data['results'], 0, $count);
}
?>