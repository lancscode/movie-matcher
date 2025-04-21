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

// Logging function
function tmdbLog($message) {
    $logFile = __DIR__ . '/tmdb_debug.log';
    $timestamp = date('Y-m-d H:i:s');
    file_put_contents($logFile, "[$timestamp] $message\n", FILE_APPEND);
}

// TMDB API functions
define('TMDB_API_KEY', '448b5d0657afed9fe1dfa62f72538c98'); // Replace with your actual TMDB API key
define('TMDB_BASE_URL', 'https://api.themoviedb.org/3');

function fetchMoviesFromTMDB($count = 20, $page = 1, $category = 'popular') {
    // Log the request
    tmdbLog("Fetching movies - Category: $category, Page: $page, Count: $count");
    
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
    
    tmdbLog("TMDB API URL: $url");
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    
    $response = curl_exec($ch);
    
    if (curl_errno($ch)) {
        $error = curl_error($ch);
        tmdbLog("Curl error: $error");
        curl_close($ch);
        return [];
    }
    
    curl_close($ch);
    
    $data = json_decode($response, true);
    
    if (!isset($data['results']) || !is_array($data['results'])) {
        tmdbLog("Invalid response from TMDB API: " . substr($response, 0, 500) . "...");
        return [];
    }
    
    $movies = array_slice($data['results'], 0, $count);
    tmdbLog("TMDB returned " . count($movies) . " movies");
    
    // Log a sample of movie data including vote_average
    if (!empty($movies) && isset($movies[0])) {
        $sampleMovie = $movies[0];
        $voteAverage = isset($sampleMovie['vote_average']) ? $sampleMovie['vote_average'] : 'not set';
        tmdbLog("Sample movie: ID={$sampleMovie['id']}, Title={$sampleMovie['title']}, Vote Average={$voteAverage}");
    }
    
    // Log movie IDs to verify consistency
    $movieIds = array_map(function($movie) { return $movie['id']; }, $movies);
    tmdbLog("Movie IDs: " . implode(', ', $movieIds));
    
    return $movies;
}
?>