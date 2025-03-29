// Improved error handling for Chatty Voice-First AI Portal

// Client-side error handling improvements
function setupErrorHandling(socket, chattyClient) {
  // Add global error handler
  window.addEventListener('error', function(event) {
    console.error('Global error:', event.error);
    if (chattyClient) {
      chattyClient.updateStatus('An error occurred', 'error');
    }
  });

  // Add unhandled promise rejection handler
  window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    if (chattyClient) {
      chattyClient.updateStatus('An error occurred', 'error');
    }
  });

  // Add socket error handlers
  if (socket) {
    // Connection error handler
    socket.on('connect_error', function(error) {
      console.error('Socket connection error:', error);
      if (chattyClient) {
        chattyClient.updateStatus('Connection error: ' + error.message, 'error');
      }
    });

    // Socket error handler
    socket.on('error', function(error) {
      console.error('Socket error:', error);
      if (chattyClient) {
        chattyClient.updateStatus('Socket error: ' + error.message, 'error');
      }
    });

    // Reconnect attempt handler
    socket.io.on('reconnect_attempt', function(attempt) {
      console.log('Reconnection attempt:', attempt);
      if (chattyClient) {
        chattyClient.updateStatus('Reconnecting... (Attempt ' + attempt + ')', 'connecting');
      }
    });

    // Reconnect handler
    socket.io.on('reconnect', function(attempt) {
      console.log('Reconnected after', attempt, 'attempts');
      if (chattyClient) {
        chattyClient.updateStatus('Reconnected', 'connected');
      }
    });

    // Reconnect error handler
    socket.io.on('reconnect_error', function(error) {
      console.error('Reconnection error:', error);
      if (chattyClient) {
        chattyClient.updateStatus('Reconnection error', 'error');
      }
    });

    // Reconnect failed handler
    socket.io.on('reconnect_failed', function() {
      console.error('Failed to reconnect');
      if (chattyClient) {
        chattyClient.updateStatus('Failed to reconnect', 'error');
      }
    });
  }
}

// Server-side error handling improvements
function setupServerErrorHandling(app, io, httpServer) {
  // Express error handler
  app.use(function(err, req, res, next) {
    console.error('Express error:', err.stack);
    res.status(500).json({
      error: 'Server error',
      message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message
    });
  });

  // Socket.io error handler
  io.engine.on('connection_error', (err) => {
    console.error('Socket.io connection error:', err);
  });

  // Handle server errors
  httpServer.on('error', (err) => {
    console.error('HTTP server error:', err);
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    // Log error but don't exit in production
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    }
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled promise rejection:', reason);
  });
}

// Retry mechanism for API calls
class RetryHandler {
  constructor(maxRetries = 3, initialDelay = 1000) {
    this.maxRetries = maxRetries;
    this.initialDelay = initialDelay;
  }

  async retry(fn, ...args) {
    let lastError;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn(...args);
      } catch (error) {
        console.error(`Attempt ${attempt + 1}/${this.maxRetries + 1} failed:`, error);
        lastError = error;
        
        if (attempt < this.maxRetries) {
          const delay = this.initialDelay * Math.pow(2, attempt);
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }
}

// Fallback mechanisms
function setupFallbacks(chattyClient) {
  // Fallback for audio recording
  const startRecordingWithFallback = async () => {
    try {
      // Try with optimal settings first
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1
        }
      };
      
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      console.warn('Failed to get audio with optimal settings, trying basic settings:', error);
      
      try {
        // Fallback to basic audio
        return await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (fallbackError) {
        console.error('Failed to get audio with basic settings:', fallbackError);
        throw fallbackError;
      }
    }
  };
  
  // Fallback for WebSocket connection
  const connectWithFallback = (url, options) => {
    try {
      // Try WebSocket first
      const socket = io(url, {
        ...options,
        transports: ['websocket']
      });
      
      // If connection fails, fall back to polling
      socket.on('connect_error', () => {
        console.warn('WebSocket connection failed, falling back to polling');
        socket.io.opts.transports = ['polling', 'websocket'];
      });
      
      return socket;
    } catch (error) {
      console.error('Failed to create socket:', error);
      throw error;
    }
  };
  
  // Add fallbacks to chattyClient
  if (chattyClient) {
    chattyClient.startRecordingWithFallback = startRecordingWithFallback;
    chattyClient.connectWithFallback = connectWithFallback;
  }
  
  return {
    startRecordingWithFallback,
    connectWithFallback
  };
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    setupErrorHandling,
    setupServerErrorHandling,
    RetryHandler,
    setupFallbacks
  };
} else if (typeof window !== 'undefined') {
  window.ChattyErrorHandling = {
    setupErrorHandling,
    RetryHandler,
    setupFallbacks
  };
}
