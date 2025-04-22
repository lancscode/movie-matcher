import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Heart, X, Film, ArrowRight, Share2, Copy, Star, TrendingUp, Calendar, PlayCircle, RefreshCw, Users, Zap, ChevronLeft, Gift, MessageCircle, Check } from 'lucide-react';

const API_BASE_URL = '//georgetthomas.co.uk/api'; 
const TMDB_IMAGE_BASE = '//image.tmdb.org/t/p/w500';

// Main app component
export default function MovieMatcher() {
  // App states
  const [screen, setScreen] = useState('home'); // home, create, join, category, swiping, waiting, results, debug
  const [sessionId, setSessionId] = useState('');
  const [userNumber, setUserNumber] = useState(1);
  const [movies, setMovies] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [matches, setMatches] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('popular');
  const [debugInfo, setDebugInfo] = useState(null);
  const [waitingTimeElapsed, setWaitingTimeElapsed] = useState(0);
  const [matchesChecked, setMatchesChecked] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [expandedMovieId, setExpandedMovieId] = useState(null);
  
  // Improved swiping states
  const cardRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState(null);
  
  const sessionInputRef = useRef(null);
  const waitingTimerRef = useRef(null);
  
  // Throttle utility for smooth swiping
  const throttle = (func, delay) => {
    let lastCall = 0;
    return function(...args) {
      const now = Date.now();
      if (now - lastCall < delay) return;
      lastCall = now;
      return func(...args);
    };
  };
  
  // Toggle movie description expansion
  const toggleMovieDescription = (movieId) => {
    if (expandedMovieId === movieId) {
      setExpandedMovieId(null); // Close if already open
    } else {
      setExpandedMovieId(movieId); // Open the clicked movie
    }
  };
  
  // Improved swiping handlers
  const throttledMouseMove = useCallback(
    throttle((e) => {
      if (!isDragging) return;
      
      // Get the correct client position for both mouse and touch events
      const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
      const newOffsetX = clientX - startX;
      
      // Apply mild resistance at edges but allow free movement in the center
      let resistedOffset = newOffsetX;
      const maxOffset = 300; // Maximum allowed movement
      
      // Apply non-linear resistance only at extremes
      if (Math.abs(newOffsetX) > 100) {
        const excess = Math.abs(newOffsetX) - 100;
        const resistanceFactor = 0.9 - (excess / 1000); // Gradually increases resistance
        const resistedExcess = excess * resistanceFactor;
        resistedOffset = Math.sign(newOffsetX) * (100 + resistedExcess);
        
        // Cap at maximum offset
        resistedOffset = Math.max(Math.min(resistedOffset, maxOffset), -maxOffset);
      }
      
      setOffsetX(resistedOffset);
      
      // Update swipe direction for visual feedback - more responsive
      if (resistedOffset > 30) {
        setSwipeDirection('right');
      } else if (resistedOffset < -30) {
        setSwipeDirection('left');
      } else {
        setSwipeDirection(null);
      }
    }, 16), // ~60fps (1000ms/60 ≈ 16ms)
    [isDragging, startX]
  );

  const handleMouseDown = (e) => {
    // Prevent default to avoid text selection during swipe
    e.preventDefault();
    setIsDragging(true);
    // Get the correct client position for both mouse and touch events
    const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
    setStartX(clientX);
    // We don't reset offsetX here to allow for continuous dragging
  };

  const handleMouseMove = (e) => {
    // Call the throttled version
    throttledMouseMove(e);
  };

  // Special handler for touch to prevent page scrolling
  const handleTouchMove = useCallback((e) => {
    // Prevent page scrolling while swiping
    e.preventDefault();
    handleMouseMove(e);
  }, [handleMouseMove]);

  const handleMouseUp = (e) => {
    if (!isDragging) return;
    
    // Determine swipe action based on offset and apply threshold
    const swipeThreshold = 100; // Threshold for completing the action
    
    if (offsetX > swipeThreshold) {
      // Animate completion of right swipe
      setOffsetX(300);
      setTimeout(() => handleLike(), 200);
    } else if (offsetX < -swipeThreshold) {
      // Animate completion of left swipe
      setOffsetX(-300);
      setTimeout(() => handleDislike(), 200);
    } else {
      // Animate card back to center with spring-like effect
      setOffsetX(0);
      setSwipeDirection(null);
    }
    
    setIsDragging(false);
  };
  
  // Helper function to safely parse JSON regardless of content type
  const safelyParseJson = async (response) => {
    // Get the text response first
    const textResponse = await response.text();
    console.log("Response text (first 100 chars):", textResponse.substring(0, 100));
    
    // Try to parse it as JSON
    try {
      const data = JSON.parse(textResponse);
      console.log("Successfully parsed JSON:", data);
      return data;
    } catch (jsonError) {
      console.error("Got invalid JSON response:", textResponse);
      throw new Error(`Failed to parse response as JSON: ${jsonError.message}`);
    }
  };
  
  // Create a new session
  const createSession = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${API_BASE_URL}/create_session.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}) // Empty object as body
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
      }
      
      const data = await safelyParseJson(response);
      
      if (data.success) {
        setSessionId(data.session_id);
        setUserNumber(1);
        setScreen('category'); // Go to category selection
      } else {
        setError(data.error || 'Failed to create session');
      }
    } catch (err) {
      console.error('Create session error:', err);
      setError(`Network error: ${err.message}. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Join an existing session
  const joinSession = async () => {
    if (!sessionInputRef.current || !sessionInputRef.current.value.trim()) {
      setError('Please enter a session code');
      return;
    }
    
    const sessionCode = sessionInputRef.current.value.trim().toUpperCase();
    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${API_BASE_URL}/join_session.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ session_id: sessionCode })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
      }
      
      const data = await safelyParseJson(response);
      
      if (data.success) {
        setSessionId(sessionCode); // Use the uppercase code we sent
        setUserNumber(2);
        setSelectedCategory(data.category || 'popular'); // Use the category from the session
        setScreen('swiping'); // Skip category selection, go straight to swiping
        fetchMovies(sessionCode, 2);
      } else {
        setError(data.error || 'Session not found');
      }
    } catch (err) {
      console.error('Join session error:', err);
      setError(`Network error: ${err.message}. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Update session properties (like category)
  const updateSession = async (properties) => {
    if (!sessionId) {
      console.error("Attempted to update session with empty session ID");
      return { success: false, error: "Missing session ID" };
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/update_session.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          ...properties
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
      }
      
      const data = await safelyParseJson(response);
      return data;
    } catch (err) {
      console.error('Session update error:', err);
      return { success: false, error: err.message };
    }
  };
  
  // Save category and start swiping
  const selectCategoryAndStart = async (category) => {
    setSelectedCategory(category);
    setIsLoading(true);
    setError('');
    
    try {
      // Update the session with the selected category
      const updateResult = await updateSession({ category });
      
      if (updateResult.success) {
        setScreen('swiping');
        fetchMovies(sessionId, userNumber);
      } else {
        // Fallback: If update_session.php endpoint is not available
        // or fails, we'll just use the category parameter in the fetch
        console.warn('Could not update category on server, but continuing:', updateResult.error);
        setScreen('swiping');
        fetchMovies(sessionId, userNumber);
      }
    } catch (err) {
      console.error('Category selection error:', err);
      setError(`Network error: ${err.message}. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Helper function to process movies data and handle vote_average properly
  const processMoviesData = (movies) => {
    return movies.map(movie => ({
      ...movie,
      // Ensure vote_average is a number
      vote_average: movie.vote_average !== null && movie.vote_average !== undefined 
        ? parseFloat(movie.vote_average) 
        : null
    }));
  };
  
  // Fetch movies to swipe with robust error handling
  const fetchMovies = async (sessionId, userNum, debug = false) => {
    if (!sessionId) {
      console.error("Attempted to fetch movies with empty session ID");
      setError("Session ID is missing. Please go back to the home screen and try again.");
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    // Add a cache-busting parameter
    const timestamp = new Date().getTime();
    // Add category param if user has explicitly selected one
    const categoryParam = selectedCategory ? `&category=${selectedCategory}` : '';
    const url = `${API_BASE_URL}/get_movies.php?session_id=${sessionId}&user_number=${userNum}${categoryParam}&_=${timestamp}${debug ? '&debug=1' : ''}`;
    
    console.log(`Fetching movies from: ${url}`);
    
    try {
      // Create a new AbortController for this request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        signal: controller.signal,
        credentials: 'omit' // Don't send cookies
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
      }
      
      const data = await safelyParseJson(response);
      
      if (data.success) {
        // Clear existing movies first to prevent any state merging issues
        setMovies([]);
        
        // Then set the new movies after a short delay to ensure state update
        setTimeout(() => {
          if (data.movies && Array.isArray(data.movies)) {
            // Process movies to ensure vote_average is properly formatted
            const processedMovies = processMoviesData(data.movies);
            setMovies(processedMovies);
            setCurrentIndex(0);
            
            // Update category if provided
            if (data.category && data.category !== selectedCategory) {
              setSelectedCategory(data.category);
            }
            
            // Save debug info if available
            if (data.debug) {
              setDebugInfo(data);
            }
          } else {
            console.error("Invalid movies data:", data.movies);
            setError("Received invalid movie data from the server.");
          }
          
          setIsLoading(false);
        }, 50);
      } else {
        setError(data.error || 'Failed to fetch movies');
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Error fetching movies:', err);
      setError(`Network error: ${err.message}. Please try again.`);
      setIsLoading(false);
    }
  };
  
  // Fetch matches
  const fetchMatches = async (forceResults = false) => {
    if (!sessionId) {
      console.error("Attempted to fetch matches with empty session ID");
      setError("Session ID is missing. Please go back to the home screen and try again.");
      return [];
    }
    
    setIsLoading(true);
    setError('');
    setMatchesChecked(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/get_matches.php?session_id=${sessionId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
      }
      
      const data = await safelyParseJson(response);
      
      if (data.success) {
        let matchList = data.matches || [];
        
        // Process matches to ensure vote_average is properly formatted
        matchList = matchList.map(match => ({
          ...match,
          vote_average: match.vote_average !== null && match.vote_average !== undefined 
            ? parseFloat(match.vote_average) 
            : null
        }));
        
        setMatches(matchList);
        
        // Go to results screen if we have matches and one of these is true:
        // 1. forceResults flag is set (manual check button)
        // 2. waitingTimeElapsed >= 15 seconds (auto timeout)
        // 3. User 2 always goes to results after finishing swiping
        if ((matchList.length > 0 && (forceResults || waitingTimeElapsed >= 15)) || userNumber === 2) {
          setScreen('results');
        } else if (userNumber === 1 && screen === 'waiting') {
          // User 1 stays on waiting screen if no matches yet or not enough time has passed
          setWaitingTimeElapsed(prev => prev + 3); // Increment waiting time counter
        }
        
        return matchList;
      } else {
        setError(data.error || 'Failed to fetch matches');
        return [];
      }
    } catch (err) {
      console.error('Error fetching matches:', err);
      setError(`Network error: ${err.message}. Please try again.`);
      return [];
    } finally {
      setIsLoading(false);
    }
  };
  
  // Helper function to format movie rating
  const formatRating = (rating) => {
    if (rating === null || rating === undefined) return '??';
    // Ensure rating is a number
    const numRating = typeof rating === 'string' ? parseFloat(rating) : rating;
    // Check if it's a valid number
    return isNaN(numRating) ? '??' : numRating.toFixed(1);
  };
  
  // Save preference (like/dislike)
  const savePreference = async (movieId, liked) => {
    if (!sessionId || !movieId) {
      console.error("Missing session or movie ID when saving preference");
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/save_preference.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          movie_id: movieId,
          user_number: userNumber,
          liked: liked
        })
      });
      
      if (!response.ok) {
        console.error(`HTTP error when saving preference: ${response.status}`);
      }
    } catch (err) {
      console.error('Error saving preference:', err);
    }
  };
  
  // Handle swipe actions
  const handleLike = () => {
    if (!movies || movies.length === 0 || currentIndex >= movies.length) {
      console.error("Cannot like: no current movie");
      return;
    }
    
    const currentMovie = movies[currentIndex];
    savePreference(currentMovie.movie_id, true);
    nextMovie();
  };
  
  const handleDislike = () => {
    if (!movies || movies.length === 0 || currentIndex >= movies.length) {
      console.error("Cannot dislike: no current movie");
      return;
    }
    
    const currentMovie = movies[currentIndex];
    savePreference(currentMovie.movie_id, false);
    nextMovie();
  };
  
  const nextMovie = () => {
    setOffsetX(0);
    setIsDescriptionExpanded(false); // Reset description expanded state
    
    if (currentIndex < movies.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // End of deck
      if (userNumber === 1) {
        // User 1 is done - start waiting with timer
        setWaitingTimeElapsed(0); // Reset waiting timer
        setScreen('waiting');
      } else {
        // User 2 is done - check for matches
        fetchMatches();
      }
    }
  };
  
  // Copy session ID to clipboard
  const copySessionId = () => {
    if (!sessionId) {
      console.error("Cannot copy: session ID is empty");
      return;
    }
    
    navigator.clipboard.writeText(sessionId)
      .then(() => {
        setCopiedToClipboard(true);
        setTimeout(() => setCopiedToClipboard(false), 2000);
      })
      .catch(err => {
        console.error('Failed to copy session ID:', err);
      });
  };
  
  // SIMPLIFIED: Poll for matches every 3 seconds with auto-advancement after 15 seconds
  useEffect(() => {
    let intervalId;
    
    if (screen === 'waiting' && sessionId) {
      // Initial check for matches
      fetchMatches();
      
      intervalId = setInterval(() => {
        if (waitingTimeElapsed < 30) {  // Cap at 30 seconds max
          fetchMatches(); // This will update waitingTimeElapsed
        } else {
          // After 30 seconds, force move to results screen
          clearInterval(intervalId);
          setScreen('results');
        }
      }, 3000); // Poll every 3 seconds
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [screen, sessionId]);
  
  // Reset app state when returning to home screen
  useEffect(() => {
    if (screen === 'home') {
      setSessionId('');
      setUserNumber(1);
      setMovies([]);
      setCurrentIndex(0);
      setMatches([]);
      setError('');
      setSelectedCategory('popular');
      setDebugInfo(null);
      setWaitingTimeElapsed(0);
      setMatchesChecked(false);
      setIsDescriptionExpanded(false);
      setExpandedMovieId(null);
      
      // Clear any existing timers
      if (waitingTimerRef.current) {
        clearInterval(waitingTimerRef.current);
        waitingTimerRef.current = null;
      }
    }
  }, [screen]);
  
  // Helper function to show debug screen (functionality kept but button removed)
  const showDebug = () => {
    fetchMovies(sessionId, userNumber, true);
    setScreen('debug');
  };

  // Retry fetching movies if they fail to load
  const retryFetchMovies = () => {
    fetchMovies(sessionId, userNumber);
  };
  
  // Helper components
  const Button = ({ children, onClick, disabled, className, variant = "primary", size = "md", icon }) => {
    const baseClasses = "font-medium rounded-xl transition-all transform active:scale-95 flex items-center justify-center";
    
    // Size variants
    const sizeClasses = {
      sm: "px-3 py-2 text-sm",
      md: "px-6 py-3",
      lg: "px-8 py-4 text-lg"
    };
    
    // Button variants
    const variantClasses = {
      primary: "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg",
      secondary: "bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 shadow-sm hover:shadow",
      outline: "bg-transparent border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50",
      danger: "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white",
      success: "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white",
      ghost: "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
    };

    return (
      <button
        onClick={onClick}
        disabled={disabled || isLoading}
        className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className || ''}`}
      >
        {icon && <span className="mr-2">{icon}</span>}
        {isLoading && variant === "primary" && disabled ? 'Loading...' : children}
      </button>
    );
  };

  const Card = ({ children, className, hover = true }) => (
    <div className={`bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100 ${hover ? 'hover:shadow-xl transition-shadow duration-300' : ''} ${className || ''}`}>
      {children}
    </div>
  );

  const Loader = ({ size = "md" }) => {
    const sizeClasses = {
      sm: "h-4 w-4 border-2",
      md: "h-8 w-8 border-3",
      lg: "h-12 w-12 border-4"
    };
    
    return (
      <div className={`animate-spin rounded-full ${sizeClasses[size]} border-t-transparent border-purple-600`}></div>
    );
  };

  const ErrorMessage = ({ message }) => {
    if (!message) return null;
    return (
      <div className="w-full p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 animate-fadeIn">
        <p className="text-sm">{message}</p>
      </div>
    );
  };

  // Category icon mapping
  const categoryIcons = {
    popular: <Film className="w-12 h-12 mx-auto text-purple-500" />,
    top_rated: <Star className="w-12 h-12 mx-auto text-yellow-500" />,
    now_playing: <PlayCircle className="w-12 h-12 mx-auto text-green-500" />,
    upcoming: <Calendar className="w-12 h-12 mx-auto text-indigo-500" />,
    trending_day: <TrendingUp className="w-12 h-12 mx-auto text-red-500" />,
    trending_week: <TrendingUp className="w-12 h-12 mx-auto text-blue-500" />
  };

  const categoryNames = {
    popular: "Popular",
    top_rated: "Top Rated",
    now_playing: "Now Playing",
    upcoming: "Upcoming",
    trending_day: "Trending Today",
    trending_week: "Trending This Week"
  };
  
  // Render the Home Screen
  const renderHomeScreen = () => (
    <div className="flex flex-col items-center justify-center p-6 space-y-8 animate-fadeIn">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center mb-3">
          <div className="relative">
            <Film className="text-purple-600 h-12 w-12" />
            <div className="absolute -top-1 -right-1 p-1.5 bg-indigo-600 rounded-full">
              <Heart className="text-white h-4 w-4" fill="white" />
            </div>
          </div>
        </div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
          Movie Matcher
        </h1>
        <p className="text-gray-600 max-w-md mx-auto text-lg">
          Find movies you and your friend both want to watch! Swipe, match, and enjoy movie night together.
        </p>
      </div>
      
      <div className="w-full max-w-md">
        <Card className="p-8 space-y-6 shadow-xl" hover={false}>
          <Button 
            onClick={createSession}
            disabled={isLoading}
            icon={<Zap size={20} />}
            size="lg"
            className="w-full"
          >
            Create New Session
          </Button>
          
          <div className="flex items-center">
            <div className="flex-grow h-px bg-gray-200"></div>
            <span className="px-4 text-gray-500 font-medium">OR</span>
            <div className="flex-grow h-px bg-gray-200"></div>
          </div>
          
          <div className="space-y-4">
            <div className="w-full">
              <input
                ref={sessionInputRef}
                type="text"
                placeholder="Enter session code"
                className="w-full py-3 px-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all text-center text-lg font-medium placeholder:text-gray-400"
              />
            </div>
            <Button 
              onClick={joinSession}
              disabled={isLoading}
              variant="secondary"
              icon={<Users size={20} />}
              className="w-full"
            >
              Join Existing Session
            </Button>
          </div>
          
          <ErrorMessage message={error} />
        </Card>
        
        <div className="text-center text-gray-500 text-sm mt-6">
          <p>Created with ❤️ for movie lovers everywhere</p>
        </div>
      </div>
    </div>
  );
  
  // Render the Created Session Screen
  const renderCreatedSessionScreen = () => (
    <div className="flex flex-col items-center justify-center p-6 space-y-6 animate-fadeIn">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">Session Created!</h1>
        <div className="inline-flex items-center bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
          <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
          Ready to Connect
        </div>
      </div>
      
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="flex flex-col items-center space-y-4">
          <Gift className="text-purple-600 h-8 w-8 mb-2" />
          <p className="text-gray-700 font-medium">Share this code with your friend:</p>
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 py-4 px-8 rounded-xl text-3xl font-bold tracking-wider text-indigo-700 border-2 border-indigo-100 shadow-inner">
            {sessionId}
          </div>
          <button 
            onClick={copySessionId}
            className="flex items-center text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            <Copy size={16} className="mr-1" />
            {copiedToClipboard ? "Copied!" : "Copy to clipboard"}
          </button>
        </div>
        
        <div className="text-center space-y-4">
          <p className="text-gray-600">
            Once your friend joins, you'll both start swiping on movies to find a match.
          </p>
          <Button
            onClick={() => setScreen('category')}
            icon={<ArrowRight size={18} />}
          >
            Choose Movie Category
          </Button>
        </div>
      </Card>
    </div>
  );
  
  // Render the Category Selection Screen
  const renderCategoryScreen = () => (
    <div className="flex flex-col items-center justify-center p-6 space-y-6 animate-fadeIn">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">Select Movie Category</h1>
        <p className="text-gray-600">Choose which type of movies you want to swipe through</p>
      </div>
      
      <div className="w-full max-w-md">
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(categoryNames).map(([key, name]) => (
            <button 
              key={key}
              onClick={() => selectCategoryAndStart(key)}
              disabled={isLoading}
              className={`p-4 bg-white border rounded-xl hover:bg-gray-50 transition-all shadow-sm ${
                selectedCategory === key ? 'border-purple-500 border-2' : 'border-gray-200'
              }`}
            >
              {categoryIcons[key]}
              <span className="block text-center mt-3 font-medium">{name}</span>
            </button>
          ))}
        </div>
      </div>
      
      {isLoading && (
        <div className="mt-4 flex justify-center">
          <Loader />
        </div>
      )}
      
      <ErrorMessage message={error} />
    </div>
  );
  
  // Render the Swiping Screen
  const renderSwipingScreen = () => {
    if (isLoading || movies.length === 0 || currentIndex >= movies.length) {
      return (
        <div className="flex flex-col items-center justify-center p-6 h-full">
          <Card className="w-full max-w-md p-8 text-center space-y-6">
            <div className="flex justify-center">
              {isLoading ? <Loader /> : <Film size={48} className="text-gray-400" />}
            </div>
            <p className="text-xl font-medium text-gray-700">
              {isLoading ? "Loading movies..." : "No movies available"}
            </p>
            
            {!isLoading && (
              <Button 
                onClick={retryFetchMovies}
                icon={<RefreshCw size={16} />}
                variant="outline"
              >
                Retry
              </Button>
            )}
            
            <ErrorMessage message={error} />
          </Card>
        </div>
      );
    }
    
    const currentMovie = movies[currentIndex];
    
    // Calculate like/dislike indicators
    const likeOpacity = Math.min(1, Math.max(0, offsetX / 100));
    const dislikeOpacity = Math.min(1, Math.max(0, -offsetX / 100));
    
    return (
      <div className="flex flex-col items-center justify-center p-4 h-full animate-fadeIn">
        <div className="mb-6 w-full max-w-sm text-center space-y-1">
          <h2 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
            {userNumber === 1 ? 'Your Turn' : 'Your Friend\'s Turn'}
          </h2>
          <p className="text-gray-600">Swipe right to like, left to pass</p>
          <div className="text-sm text-gray-500 mt-1">
            Movie {currentIndex + 1} of {movies.length}
          </div>
          <div className="inline-flex items-center space-x-1 mt-1 bg-gradient-to-r from-purple-50 to-indigo-50 px-3 py-1 rounded-full text-xs text-indigo-700">
            {categoryIcons[selectedCategory] && React.cloneElement(categoryIcons[selectedCategory], { size: 14, className: 'mr-1' })}
            <span>{categoryNames[selectedCategory] || selectedCategory}</span>
          </div>
        </div>
        
        <div className="relative w-full max-w-sm mb-8">
          {/* Card container with perspective for 3D effect */}
          <div className="relative perspective-1000">
            {/* Like indicator */}
            <div className="absolute top-4 right-4 z-10 transform rotate-12" style={{ opacity: likeOpacity }}>
              <div className="bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-2 rounded-lg font-bold text-xl shadow-xl border-2 border-white">
                LIKE
              </div>
            </div>
            
            {/* Dislike indicator */}
            <div className="absolute top-4 left-4 z-10 transform -rotate-12" style={{ opacity: dislikeOpacity }}>
              <div className="bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-2 rounded-lg font-bold text-xl shadow-xl border-2 border-white">
                PASS
              </div>
            </div>
            
            <div 
              ref={cardRef}
              className="relative aspect-[2/3] rounded-2xl overflow-hidden will-change-transform"
              style={{ 
                transform: `translateX(${offsetX}px) rotate(${offsetX * 0.03}deg)`,
                transition: isDragging ? 'none' : 'all 300ms cubic-bezier(0.25, 1, 0.5, 1)',
                boxShadow: `0 ${10 + Math.abs(offsetX * 0.1)}px ${30 + Math.abs(offsetX * 0.2)}px rgba(0, 0, 0, ${0.2 + Math.abs(offsetX * 0.001)})`,
                borderWidth: swipeDirection ? '2px' : '0px',
                borderColor: swipeDirection === 'right' ? '#10b981' : swipeDirection === 'left' ? '#ef4444' : 'transparent'
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleMouseDown}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleMouseUp}
            >
              {/* Card image */}
              <img 
                src={currentMovie.poster_path ? `${TMDB_IMAGE_BASE}${currentMovie.poster_path}` : '/placeholder-movie.jpg'} 
                alt={currentMovie.title}
                className="w-full h-full object-cover"
              />
              
              {/* Card overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
              
              {/* Card content */}
              <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                <h3 className="text-2xl font-bold">{currentMovie.title}</h3>
                <div className="flex items-center mt-1 mb-2">
                  <span className="text-yellow-400 mr-1">★</span>
                  <span>{formatRating(currentMovie.vote_average)}</span>
                  <span className="mx-2">•</span>
                  <span>{currentMovie.release_year || 'Unknown'}</span>
                </div>
                
                {/* Description with hover effect */}
                <div 
                  className="relative"
                  onMouseEnter={() => setIsDescriptionExpanded(true)}
                  onMouseLeave={() => setIsDescriptionExpanded(false)}
                >
                  {/* Brief description (always shown) */}
                  <p className={`text-sm text-gray-300 ${isDescriptionExpanded ? '' : 'line-clamp-3'} cursor-pointer`}>
                    {currentMovie.overview || 'No description available.'}
                  </p>
                  
                  {/* Tooltip indicator when collapsed */}
                  {!isDescriptionExpanded && currentMovie.overview && currentMovie.overview.length > 150 && (
                    <div className="flex justify-center mt-1">
                      <div className="bg-white bg-opacity-20 text-white text-xs px-2 py-1 rounded-full">
                        Hover to read more
                      </div>
                    </div>
                  )}
                  
                  {/* Full description tooltip */}
                  {isDescriptionExpanded && currentMovie.overview && currentMovie.overview.length > 150 && (
                    <div className="absolute bottom-full left-0 right-0 mb-2 p-4 bg-black bg-opacity-90 rounded-lg shadow-lg z-20 animate-fadeIn border border-gray-700">
                      <p className="text-sm text-white">
                        {currentMovie.overview}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex justify-center items-center space-x-12">
          <button
            onClick={handleDislike}
            className="p-5 bg-white rounded-full hover:bg-red-50 shadow-lg transition-all transform hover:scale-110 active:scale-95 border border-gray-200"
          >
            <X size={32} className="text-red-500" />
          </button>
          <button
            onClick={handleLike}
            className="p-5 bg-white rounded-full hover:bg-green-50 shadow-lg transition-all transform hover:scale-110 active:scale-95 border border-gray-200"
          >
            <Heart size={32} className="text-green-500" />
          </button>
        </div>
        
        <ErrorMessage message={error} />
      </div>
    );
  };
  
  // Render the Waiting Screen - IMPROVED with more user-friendly status and control
  const renderWaitingScreen = () => (
    <div className="flex flex-col items-center justify-center p-6 space-y-8 animate-fadeIn">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">Waiting for your friend</h1>
        <div className="inline-flex items-center bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
          <div className="w-2 h-2 bg-yellow-500 rounded-full mr-2 animate-pulse"></div>
          {matchesChecked ? "Checking for matches..." : "Looking for your friend..."}
        </div>
      </div>
      
      <Card className="w-full max-w-md p-8 space-y-6 border-2 border-indigo-100">
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-24 h-24 border-4 border-indigo-200 border-dashed rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Film size={36} className="text-purple-600" />
            </div>
          </div>
        </div>
        
        <div className="text-center space-y-4">
          <p className="text-gray-700 text-lg">
            You've finished swiping! We're waiting for your friend to finish swiping or for matches to appear.
          </p>
          
          {waitingTimeElapsed >= 15 && (
            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
              <p className="text-indigo-700 mb-3">
                It's been a while and we're still waiting. You can:
              </p>
              <Button
                onClick={() => fetchMatches(true)}
                className="mb-2 w-full"
                icon={<Check size={18} />}
                variant="primary"
              >
                Check for Matches Now
              </Button>
            </div>
          )}
          
          <div className="border-t border-gray-200 pt-4 mt-4">
            <p className="text-sm text-gray-600 mb-3">Share this code with them if they haven't joined:</p>
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 py-3 px-6 rounded-xl text-xl font-bold tracking-wider text-indigo-700 inline-block shadow-inner border border-indigo-100">
              {sessionId}
            </div>
            <button 
              onClick={copySessionId}
              className="flex items-center text-indigo-600 hover:text-indigo-800 transition-colors mt-3 mx-auto"
            >
              <Copy size={14} className="mr-1" />
              {copiedToClipboard ? "Copied!" : "Copy to clipboard"}
            </button>
          </div>
          
          <div className="pt-4 mt-4">
            <Button
              onClick={() => createSession()}
              variant="outline"
              size="sm"
            >
              Start Over
            </Button>
          </div>
        </div>
      </Card>

      <div className="text-center space-y-2 mt-4">
        <p className="text-sm text-gray-500">
          {waitingTimeElapsed < 15 ? 
            "We're automatically checking for matches every few seconds" : 
            "You can view results at any time by clicking 'Check for Matches Now'"}
        </p>
        <p className="text-xs text-gray-400">
          {waitingTimeElapsed < 30 ? 
            "You'll be automatically taken to the results after 30 seconds" : 
            "Taking you to results screen shortly..."}
        </p>
      </div>

      <ErrorMessage message={error} />
    </div>
  );
  
  // Render the Results Screen
  const renderResultsScreen = () => {
    // Movie description modal component - separate from cards with improved z-index
    const MovieDescriptionModal = () => {
      if (!expandedMovieId) return null;
      
      const movie = matches.find(m => m.movie_id === expandedMovieId);
      if (!movie) return null;
      
      return (
        <>
          {/* Backdrop with very high z-index */}
          <div className="modal-backdrop" onClick={() => setExpandedMovieId(null)}></div>
          
          {/* Modal container with even higher z-index */}
          <div className="modal-container">
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-xl font-bold text-gray-800">{movie.title}</h3>
                <button 
                  onClick={() => setExpandedMovieId(null)}
                  className="p-1 text-gray-500 hover:bg-gray-100 rounded-full"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex items-center mb-3">
                <span className="text-yellow-500 mr-1">★</span>
                <span className="text-gray-700">{formatRating(movie.vote_average)}</span>
                <span className="mx-2">•</span>
                <span className="text-gray-700">{movie.release_year || 'Unknown'}</span>
              </div>
              
              <p className="text-gray-600">{movie.overview}</p>
            </div>
          </div>
        </>
      );
    };
    
    return (
      <div className="flex flex-col items-center justify-center p-6 animate-fadeIn">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">Your Movie Matches!</h1>
          <div className="inline-flex items-center bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
            {matches.length} {matches.length === 1 ? 'movie' : 'movies'} matched
          </div>
          {userNumber === 1 && (
            <div className="text-xs text-gray-500 mt-1">
              Checking for new matches every few seconds...
            </div>
          )}
        </div>
        
        {matches.length === 0 ? (
          <Card className="w-full max-w-md p-8 text-center space-y-6">
            <div className="flex justify-center">
              <div className="relative">
                <X size={48} className="text-gray-400" />
                <div className="absolute -bottom-2 -right-2 p-1 bg-gray-500 rounded-full">
                  <MessageCircle size={20} className="text-white" />
                </div>
              </div>
            </div>
            <h3 className="text-xl font-bold text-gray-700">No matches found</h3>
            <p className="text-gray-600">You two need to find some common ground in your movie tastes!</p>
            <div className="flex flex-col space-y-3">
              <Button
                onClick={() => setScreen('category')}
                variant="outline"
              >
                Try Different Category
              </Button>
              <Button
                onClick={() => setScreen('home')}
                variant="ghost"
                size="sm"
              >
                Return to Home
              </Button>
            </div>
          </Card>
        ) : (
          <div className="w-full max-w-3xl">
            {/* Render the description modal at the root level */}
            <MovieDescriptionModal />
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
              {matches.map(movie => (
                <Card key={movie.movie_id} className="overflow-hidden transform transition-all hover:scale-[1.02]">
                  <div className="relative aspect-[2/3]">
                    <img 
                      src={movie.poster_path ? `${TMDB_IMAGE_BASE}${movie.poster_path}` : '/placeholder-movie.jpg'} 
                      alt={movie.title} 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-0 right-0 bg-gradient-to-bl from-green-500 to-green-600 text-white p-1.5 m-2 rounded-full shadow-md">
                      <Heart size={16} fill="white" />
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-gray-800 line-clamp-1">{movie.title}</h3>
                    <div className="flex items-center mt-1">
                      <span className="text-yellow-500 mr-1">★</span>
                      <span className="text-gray-600 text-sm">{formatRating(movie.vote_average)}</span>
                      <span className="mx-1 text-gray-400">•</span>
                      <span className="text-gray-600 text-sm">{movie.release_year || 'Unknown'}</span>
                    </div>
                    
                    {/* Movie description section with info button */}
                    {movie.overview && (
                      <div className="mt-2">
                        {/* Fixed height container with ellipsis */}
                        <div className="h-10 overflow-hidden relative">
                          <p className="text-sm text-gray-600">
                            {movie.overview}
                          </p>
                          {/* Gradient fade for text cutoff */}
                          <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-white to-transparent"></div>
                        </div>
                        <button 
                          onClick={() => toggleMovieDescription(movie.movie_id)}
                          className="w-full mt-2 py-1 px-3 bg-indigo-100 text-indigo-600 hover:bg-indigo-200 rounded-lg flex-shrink-0 transition-colors text-sm flex items-center justify-center"
                          aria-label="View full description"
                        >
                          <MessageCircle size={14} className="mr-1" />
                          Read more
                        </button>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
            
            <div className="mt-8 text-center space-y-4">
              <p className="text-gray-700">
                Great! You've found some movies to watch together. Enjoy your movie night!
              </p>
              <Button
                onClick={() => setScreen('home')}
                size="lg"
              >
                Start New Session
              </Button>
            </div>
          </div>
        )}

        <ErrorMessage message={error} />
      </div>
    );
  };
  
  // Render the Debug Screen (functionality kept)
  const renderDebugScreen = () => (
    <div className="p-4 max-w-md mx-auto animate-fadeIn">
      <Card className="p-6 space-y-4">
        <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">Debug Information</h1>
        
        <div>
          <h2 className="font-bold text-gray-700">Session Info</h2>
          <div className="bg-gray-50 p-3 rounded-lg text-sm font-mono">
            <p>Session ID: {sessionId}</p>
            <p>User Number: {userNumber}</p>
            <p>Category: {selectedCategory}</p>
          </div>
        </div>
        
        <div>
          <h2 className="font-bold text-gray-700">Movie Count</h2>
          <div className="bg-gray-50 p-3 rounded-lg text-sm font-mono">
            <p>Movies available: {movies.length}</p>
            <p>Current index: {currentIndex}</p>
          </div>
        </div>
        
        {debugInfo && (
          <>
            <div>
              <h2 className="font-bold text-gray-700">API Response Data</h2>
              <div className="bg-gray-50 p-3 rounded-lg text-xs font-mono h-48 overflow-auto">
                <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
              </div>
            </div>
            
            {debugInfo.debug && (
              <div>
                <h2 className="font-bold text-gray-700">Server Debug Info</h2>
                <div className="bg-gray-50 p-3 rounded-lg text-xs font-mono h-48 overflow-auto">
                  <pre>{JSON.stringify(debugInfo.debug, null, 2)}</pre>
                </div>
              </div>
            )}
          </>
        )}
        
        <div className="flex justify-between pt-2">
          <Button
            onClick={() => {
              // Refresh debug info
              fetchMovies(sessionId, userNumber, true);
            }}
            variant="secondary"
            size="sm"
          >
            Refresh
          </Button>
          
          <Button
            onClick={() => setScreen('swiping')}
            size="sm"
          >
            Back to Swiping
          </Button>
        </div>
      </Card>
    </div>
  );

  // Additional CSS styles
  const additionalStyles = `
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fadeIn {
      animation: fadeIn 0.3s ease-out forwards;
    }
    .perspective-1000 {
      perspective: 1000px;
    }
    .transform {
      transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));
    }
    .-translate-y-1/2 {
      --tw-translate-y: -50%;
      transform: var(--tw-transform);
    }
    .translate-y-0 {
      --tw-translate-y: 0px;
      transform: var(--tw-transform);
    }
    .will-change-transform {
      will-change: transform;
    }
    
    /* Modal styles */
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(2px);
      z-index: 9999;
    }
    
    .modal-container {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      padding: 1rem;
    }
    
    .modal-content {
      background: white;
      width: 100%;
      max-width: 28rem;
      border-radius: 0.75rem;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      padding: 1.25rem;
      margin: 0 auto;
      max-height: 80vh;
      overflow-y: auto;
      animation: fadeIn 0.3s ease-out forwards;
      position: relative;
    }
  `;
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col">
      {/* Custom app-wide CSS */}
      <style jsx global>{`
        ${additionalStyles}
      `}</style>
      
      {/* App header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <Film className="text-purple-600 mr-2" size={24} />
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">Movie Matcher</h1>
          </div>
          
          {screen !== 'home' && (
            <div className="flex items-center space-x-2">
              {screen !== 'category' && screen !== 'home' && (
                <button
                  onClick={() => {
                    if (screen === 'swiping') {
                      setScreen('category');
                    } else if (screen === 'waiting' || screen === 'results') {
                      if (window.confirm('Are you sure you want to start over? Any unsaved progress will be lost.')) {
                        setScreen('home');
                      }
                    }
                  }}
                  className="flex items-center justify-center px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-medium"
                >
                  <ChevronLeft size={16} className="mr-1" />
                  {screen === 'swiping' ? 'Categories' : 'Back'}
                </button>
              )}
              <button 
                onClick={() => {
                  if (window.confirm('Are you sure you want to start over? Any unsaved progress will be lost.')) {
                    setScreen('home');
                  }
                }}
                className="text-indigo-600 hover:text-indigo-800 transition-colors text-sm font-medium"
              >
                Start Over
              </button>
            </div>
          )}
        </div>
      </header>
      
      {/* Main content */}
      <main className="flex-1 flex flex-col max-w-3xl mx-auto w-full py-6">
        {screen === 'home' && renderHomeScreen()}
        {screen === 'create' && renderCreatedSessionScreen()}
        {screen === 'category' && renderCategoryScreen()}
        {screen === 'swiping' && renderSwipingScreen()}
        {screen === 'waiting' && renderWaitingScreen()}
        {screen === 'results' && renderResultsScreen()}
        {screen === 'debug' && renderDebugScreen()}
      </main>
    </div>
  );
}