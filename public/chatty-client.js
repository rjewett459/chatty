// Enhanced client implementation with voice output functionality
// Focused on fixing session creation issues and adding voice playback

class ChattyClient {
  constructor() {
    this.socket = null;
    this.mediaRecorder = null;
    this.audioContext = null;
    this.stream = null;
    this.isListening = false;
    this.isSpeaking = false;
    this.audioQueue = [];
    this.sessionId = null;
    this.transcript = [];
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.pingInterval = null;
    this.lastNetworkActivity = Date.now();
    this.statusElement = null;
    this.statusIndicatorElement = null;
    this.transcriptElement = null;
    this.sessionStartTime = null;
    this.sessionDuration = 60000; // 60 seconds session limit
    this.ctaTriggerTime = 45000; // CTA trigger at 45 seconds
    this.sessionTimer = null;
    this.ctaTriggered = false;
    this.onCTATrigger = null;
    this.onSessionEnd = null;
    this.personality = "cheerful_guide"; // Default personality
    this.debugMode = false; // Debug mode flag
    this.pendingPromises = new Map(); // Track pending promises
    this.audioPlayer = null; // Audio player for voice output
  }

  // Enable debug mode
  enableDebug() {
    this.debugMode = true;
    return this;
  }

  // Debug log
  debug(...args) {
    if (this.debugMode) {
      console.log('[ChattyClient Debug]', ...args);
    }
  }

  // Initialize the client
  async initialize(serverUrl, statusElement, statusIndicatorElement, transcriptElement, options = {}) {
    this.statusElement = statusElement;
    this.statusIndicatorElement = statusIndicatorElement;
    this.transcriptElement = transcriptElement;
    
    // Set options
    if (options.onCTATrigger) this.onCTATrigger = options.onCTATrigger;
    if (options.onSessionEnd) this.onSessionEnd = options.onSessionEnd;
    if (options.personality) this.personality = options.personality;
    if (options.sessionDuration) this.sessionDuration = options.sessionDuration;
    if (options.ctaTriggerTime) this.ctaTriggerTime = options.ctaTriggerTime;
    if (options.debugMode) this.debugMode = options.debugMode;
    
    try {
      // Update status
      this.updateStatus('Connecting...', 'connecting');
      this.debug('Initializing with server URL:', serverUrl);
      
      // Initialize audio player
      this.initializeAudioPlayer();
      
      // Connect to Socket.io server with optimized settings
      this.socket = io(serverUrl, {
        withCredentials: false, // Set to false to avoid CORS issues
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
        timeout: 15000, // Increased timeout for better reliability
        transports: ['websocket', 'polling'], // Allow fallback to polling
        upgrade: true, // Allow transport upgrade
        forceNew: true, // Force new connection
        autoConnect: true // Auto connect
      });

      // Set up socket event listeners
      this.setupSocketListeners();
      
      // Initialize Web Audio API
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        latencyHint: 'interactive' // Optimize for interactive applications
      });
      
      // Set up ping mechanism to keep connection alive
      this.setupPingMechanism();
      
      // Wait for connection with proper timeout handling
      await this.waitForConnection(10000); // 10 second timeout
      
      this.debug('Initialization complete');
      return true;
    } catch (error) {
      console.error('Error initializing Chatty client:', error);
      this.updateStatus('Failed to connect: ' + error.message, 'error');
      return false;
    }
  }

  // Initialize audio player for voice output
  initializeAudioPlayer() {
    this.debug('Initializing audio player');
    
    // Create audio element if it doesn't exist
    if (!this.audioPlayer) {
      this.audioPlayer = new Audio();
      
      // Set up event listeners
      this.audioPlayer.addEventListener('play', () => {
        this.debug('Audio playback started');
        this.isSpeaking = true;
        this.updateStatus('Speaking...', 'speaking');
      });
      
      this.audioPlayer.addEventListener('ended', () => {
        this.debug('Audio playback ended');
        this.isSpeaking = false;
        
        // If we have more audio in the queue, play it
        if (this.audioQueue.length > 0) {
          const nextAudio = this.audioQueue.shift();
          this.playAudio(nextAudio);
        } else {
          this.updateStatus('Listening...', 'listening');
        }
      });
      
      this.audioPlayer.addEventListener('error', (error) => {
        console.error('Audio playback error:', error);
        this.isSpeaking = false;
        this.updateStatus('Audio error', 'error');
      });
    }
  }

  // Play audio from URL
  playAudio(audioUrl) {
    if (!this.audioPlayer) {
      this.initializeAudioPlayer();
    }
    
    this.debug('Playing audio:', audioUrl);
    
    try {
      // If already speaking, queue this audio
      if (this.isSpeaking) {
        this.debug('Already speaking, queueing audio');
        this.audioQueue.push(audioUrl);
        return;
      }
      
      // Set audio source
      this.audioPlayer.src = audioUrl;
      
      // Play audio
      const playPromise = this.audioPlayer.play();
      
      // Handle play promise
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error('Error playing audio:', error);
          
          // If autoplay was prevented, try again with user interaction
          if (error.name === 'NotAllowedError') {
            this.debug('Autoplay prevented, will try again with user interaction');
            
            // Update status to indicate user needs to interact
            this.updateStatus('Click to enable audio', 'error');
            
            // Add click handler to document to enable audio
            const enableAudio = () => {
              this.debug('User interaction detected, trying to play audio again');
              this.audioPlayer.play().catch(e => {
                console.error('Still unable to play audio:', e);
              });
              document.removeEventListener('click', enableAudio);
            };
            
            document.addEventListener('click', enableAudio);
          }
        });
      }
    } catch (error) {
      console.error('Error setting up audio playback:', error);
    }
  }

  // Wait for connection with timeout
  async waitForConnection(timeout) {
    return new Promise((resolve, reject) => {
      // Already connected
      if (this.socket && this.socket.connected) {
        this.debug('Already connected');
        this.updateStatus('Connected', 'connected');
        resolve();
        return;
      }
      
      // Set timeout
      const connectionTimeout = setTimeout(() => {
        this.socket.off('connect', connectHandler);
        this.socket.off('connect_error', errorHandler);
        reject(new Error('Connection timeout after ' + timeout + 'ms'));
      }, timeout);
      
      // Connect handler
      const connectHandler = () => {
        clearTimeout(connectionTimeout);
        this.socket.off('connect_error', errorHandler);
        this.reconnectAttempts = 0;
        this.lastNetworkActivity = Date.now();
        this.updateStatus('Connected', 'connected');
        this.debug('Connected to server');
        resolve();
      };
      
      // Error handler
      const errorHandler = (error) => {
        clearTimeout(connectionTimeout);
        this.socket.off('connect', connectHandler);
        this.updateStatus('Connection error: ' + error.message, 'error');
        this.debug('Connection error:', error);
        this.handleReconnect();
        reject(error);
      };
      
      // Set up event listeners
      this.socket.once('connect', connectHandler);
      this.socket.once('connect_error', errorHandler);
    });
  }

  // Set up ping mechanism to keep connection alive
  setupPingMechanism() {
    // Clear any existing interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    
    // Set up new ping interval
    this.pingInterval = setInterval(() => {
      // Check if connection is stale (no activity for 15 seconds)
      const timeSinceLastActivity = Date.now() - this.lastNetworkActivity;
      if (timeSinceLastActivity > 15000 && this.socket && this.socket.connected) {
        this.debug('Connection may be stale, sending ping');
        this.socket.emit('ping');
      }
    }, 10000); // Check every 10 seconds
  }

  // Handle reconnection logic
  handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      this.debug(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      this.updateStatus(`Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`, 'connecting');
      
      // Exponential backoff for reconnection
      const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
      
      setTimeout(() => {
        if (this.socket) {
          this.socket.connect();
        }
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
      this.updateStatus('Connection failed after multiple attempts', 'error');
    }
  }

  // Set up Socket.io event listeners
  setupSocketListeners() {
    // Connection events
    this.socket.on('connect', () => {
      this.lastNetworkActivity = Date.now();
      this.debug('Connected to server');
      this.updateStatus('Connected', 'connected');
      this.reconnectAttempts = 0;
    });
    
    this.socket.on('disconnect', (reason) => {
      this.debug('Disconnected from server:', reason);
      this.updateStatus('Disconnected: ' + reason, 'error');
      
      // If the disconnection was not initiated by the client, attempt to reconnect
      if (reason !== 'io client disconnect') {
        this.handleReconnect();
      }
    });
    
    // Session events
    this.socket.on('session_created', (data) => {
      this.lastNetworkActivity = Date.now();
      this.sessionId = data.sessionId;
      this.debug('Session created:', this.sessionId, data);
      this.updateStatus('Session ready', 'ready');
      
      // Resolve pending session creation promise if exists
      const promiseKey = 'create_session';
      if (this.pendingPromises.has(promiseKey)) {
        const { resolve } = this.pendingPromises.get(promiseKey);
        resolve(data);
        this.pendingPromises.delete(promiseKey);
      }
    });
    
    this.socket.on('session_error', (data) => {
      this.lastNetworkActivity = Date.now();
      console.error('Session error:', data);
      this.updateStatus('Session error: ' + (data.message || 'Unknown error'), 'error');
      this.debug('Session error details:', data);
      
      // Reject pending session creation promise if exists
      const promiseKey = 'create_session';
      if (this.pendingPromises.has(promiseKey)) {
        const { reject } = this.pendingPromises.get(promiseKey);
        reject(new Error(data.message || 'Session creation failed'));
        this.pendingPromises.delete(promiseKey);
      }
    });
    
    this.socket.on('session_closed', (data) => {
      this.lastNetworkActivity = Date.now();
      this.debug('Session closed:', data);
      this.sessionId = null;
      this.updateStatus('Session ended', 'idle');
      this.clearSessionTimer();
    });
    
    // Message events
    this.socket.on('realtime_message', (data) => {
      this.lastNetworkActivity = Date.now();
      this.debug('Received realtime message:', data);
      
      if (!data || !data.data) {
        this.debug('Invalid realtime message format');
        return;
      }
      
      const message = data.data;
      
      if (message.type === 'transcript') {
        this.handleTranscript(message.data);
      } else if (message.type === 'audio') {
        this.handleAudio(message.data);
      }
    });
    
    // Ping-pong
    this.socket.on('pong', () => {
      this.lastNetworkActivity = Date.now();
      this.debug('Received pong from server');
    });
    
    // Error events
    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.updateStatus('Connection error: ' + error.message, 'error');
    });
    
    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
      this.updateStatus('Socket error: ' + error.message, 'error');
    });
    
    // Reconnection events
    this.socket.io.on('reconnect', (attempt) => {
      this.debug('Reconnected after', attempt, 'attempts');
      this.updateStatus('Reconnected', 'connected');
      this.reconnectAttempts = 0;
    });
    
    this.socket.io.on('reconnect_attempt', (attempt) => {
      this.debug('Reconnection attempt:', attempt);
      this.updateStatus('Reconnecting... (Attempt ' + attempt + ')', 'connecting');
    });
    
    this.socket.io.on('reconnect_error', (error) => {
      console.error('Reconnection error:', error);
      this.updateStatus('Reconnection error: ' + error.message, 'error');
    });
    
    this.socket.io.on('reconnect_failed', () => {
      console.error('Failed to reconnect');
      this.updateStatus('Failed to reconnect after multiple attempts', 'error');
    });
  }

  // Start a new session with robust error handling
  async startSession() {
    if (this.sessionId) {
      this.debug('Session already active:', this.sessionId);
      return true;
    }
    
    try {
      this.updateStatus('Creating session...', 'connecting');
      
      // Check connection
      if (!this.socket || !this.socket.connected) {
        this.debug('Socket not connected, attempting to connect');
        await this.waitForConnection(10000);
      }
      
      this.debug('Emitting create_session event with personality:', this.personality);
      
      // Create a promise that will be resolved when the session is created
      const sessionPromise = new Promise((resolve, reject) => {
        const promiseKey = 'create_session';
        this.pendingPromises.set(promiseKey, { resolve, reject });
        
        // Set timeout for session creation
        const timeout = setTimeout(() => {
          if (this.pendingPromises.has(promiseKey)) {
            const { reject } = this.pendingPromises.get(promiseKey);
            reject(new Error('Session creation timeout after 15 seconds'));
            this.pendingPromises.delete(promiseKey);
          }
        }, 15000);
        
        // Add cleanup to promise
        const cleanup = () => {
          clearTimeout(timeout);
        };
        
        // Add cleanup to promise handlers
        resolve = (value) => {
          cleanup();
          resolve(value);
        };
        
        reject = (reason) => {
          cleanup();
          reject(reason);
        };
      });
      
      // Send session creation request
      this.socket.emit('create_session', {
        personality: this.personality
      });
      
      // Wait for session creation response
      const sessionData = await sessionPromise;
      this.sessionId = sessionData.sessionId;
      
      this.debug('Session created successfully:', this.sessionId);
      
      // Start session timer
      this.startSessionTimer();
      
      // Start listening
      await this.startListening();
      
      return true;
    } catch (error) {
      console.error('Error starting session:', error);
      this.updateStatus('Failed to start session: ' + error.message, 'error');
      
      // Try to create a mock session for testing if real session creation fails
      if (this.debugMode) {
        this.debug('Creating mock session for testing');
        this.sessionId = 'mock-session-' + Date.now();
        this.startSessionTimer();
        await this.startListening();
        return true;
      }
      
      return false;
    }
  }

  // Start session timer
  startSessionTimer() {
    this.sessionStartTime = Date.now();
    this.ctaTriggered = false;
    
    // Clear any existing timer
    this.clearSessionTimer();
    
    // Set up new timer
    this.sessionTimer = setInterval(() => {
      const elapsed = Date.now() - this.sessionStartTime;
      
      // Trigger CTA at specified time
      if (!this.ctaTriggered && elapsed >= this.ctaTriggerTime) {
        this.triggerCTA();
      }
      
      // End session at specified duration
      if (elapsed >= this.sessionDuration) {
        this.endSession();
      }
    }, 1000);
  }

  // Clear session timer
  clearSessionTimer() {
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer);
      this.sessionTimer = null;
    }
  }

  // Trigger CTA
  triggerCTA() {
    this.ctaTriggered = true;
    this.debug('CTA triggered');
    
    // Add CTA message to transcript
    const ctaMessage = "I feel like we're really clicking – how about a quick chat with one of our founders?";
    this.transcript.push({
      role: 'assistant',
      content: ctaMessage
    });
    
    // Update UI
    this.addMessageToTranscript('assistant', ctaMessage);
    
    // Call CTA callback if provided
    if (this.onCTATrigger) {
      this.onCTATrigger();
    }
  }

  // End the current session with proper cleanup
  endSession() {
    if (!this.sessionId) {
      this.debug('No active session to end');
      return;
    }
    
    this.debug('Ending session:', this.sessionId);
    
    // Stop listening
    this.stopListening();
    
    // Clear session timer
    this.clearSessionTimer();
    
    // Only send end_session if we have a real session and connected socket
    if (this.socket && this.socket.connected && this.sessionId && !this.sessionId.startsWith('mock-session')) {
      this.socket.emit('end_session', {
        sessionId: this.sessionId
      });
    }
    
    // Call session end callback if provided
    if (this.onSessionEnd) {
      this.onSessionEnd(this.transcript);
    }
    
    // Clear session ID
    const oldSessionId = this.sessionId;
    this.sessionId = null;
    
    // Update status
    this.updateStatus('Session ended', 'idle');
    
    this.debug('Session ended:', oldSessionId);
  }

  // Start listening for user voice input with fallback options
  async startListening() {
    if (this.isListening) {
      this.debug('Already listening');
      return;
    }
    
    try {
      this.updateStatus('Listening...', 'listening');
      
      // Request microphone access with optimal settings
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000, // Optimal for speech recognition
          channelCount: 1 // Mono for better speech recognition
        }
      };
      
      try {
        this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (optimalError) {
        this.debug('Failed to get audio with optimal settings, trying basic settings:', optimalError);
        
        // Fallback to basic audio
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      
      // Create media recorder with optimized settings
      let options = {};
      
      // Try to use opus codec if available
      try {
        options = {
          mimeType: 'audio/webm;codecs=opus',
          audioBitsPerSecond: 16000
        };
        this.mediaRecorder = new MediaRecorder(this.stream, options);
      } catch (codecError) {
        this.debug('Opus codec not supported, using default codec:', codecError);
        
        // Fallback to default codec
        this.mediaRecorder = new MediaRecorder(this.stream);
      }
      
      // Set up data handling
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && this.sessionId) {
          // Send audio chunk to server
          if (this.socket && this.socket.connected) {
            this.socket.emit('send_audio', {
              sessionId: this.sessionId,
              audio: event.data
            });
            this.lastNetworkActivity = Date.now();
          } else {
            this.debug('Socket not connected, cannot send audio data');
          }
        }
      };
      
      // Set recording to 50ms chunks for more responsive real-time processing
      this.mediaRecorder.start(50);
      
      this.isListening = true;
      this.debug('Started listening');
    } catch (error) {
      console.error('Error accessing microphone:', error);
      this.updateStatus('Microphone access denied: ' + error.message, 'error');
      throw error;
    }
  }

  // Stop listening with proper cleanup
  stopListening() {
    if (!this.isListening) {
      this.debug('Not currently listening');
      return;
    }
    
    this.debug('Stopping listening');
    
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch (error) {
        this.debug('Error stopping media recorder:', error);
      }
    }
    
    if (this.stream) {
      try {
        this.stream.getTracks().forEach(track => track.stop());
      } catch (error) {
        this.debug('Error stopping media tracks:', error);
      }
      this.stream = null;
    }
    
    this.isListening = false;
    this.updateStatus('Stopped listening', 'idle');
    this.debug('Stopped listening');
  }

  // Handle transcript from server
  handleTranscript(text) {
    if (!text) return;
    
    this.debug('Received transcript:', text);
    
    // Add to transcript
    this.transcript.push({
      role: 'user',
      content: text
    });
    
    // Update UI
    this.addMessageToTranscript('user', text);
  }

  // Handle audio from server
  handleAudio(audioData) {
    this.debug('Received audio data:', audioData);
    
    // Play the audio
    this.playAudio(audioData);
  }

  // Add message to transcript UI
  addMessageToTranscript(role, content) {
    if (!this.transcriptElement) return;
    
    const messageElement = document.createElement('div');
    messageElement.className = `message ${role}`;
    messageElement.textContent = content;
    
    this.transcriptElement.appendChild(messageElement);
    
    // Scroll to bottom
    this.transcriptElement.scrollTop = this.transcriptElement.scrollHeight;
  }

  // Update status UI
  updateStatus(text, state) {
    if (this.statusElement) {
      this.statusElement.textContent = text;
    }
    
    if (this.statusIndicatorElement) {
      this.statusIndicatorElement.className = 'status-indicator';
      
      switch (state) {
        case 'connected':
        case 'ready':
          this.statusIndicatorElement.classList.add('active');
          break;
        case 'listening':
          this.statusIndicatorElement.classList.add('active');
          // Add pulsing animation
          this.statusIndicatorElement.style.animation = 'pulse 1.5s infinite';
          break;
        case 'speaking':
          this.statusIndicatorElement.classList.add('active');
          // Add different animation for speaking
          this.statusIndicatorElement.style.animation = 'pulse 0.8s infinite';
          break;
        case 'connecting':
          // Add blinking animation
          this.statusIndicatorElement.style.animation = 'blink 1s infinite';
          break;
        case 'error':
          this.statusIndicatorElement.style.backgroundColor = 'var(--error-color)';
          break;
        default:
          this.statusIndicatorElement.style.animation = 'none';
          break;
      }
    }
  }

  // Get session transcript
  getTranscript() {
    return this.transcript;
  }

  // Send transcript via email
  sendTranscriptByEmail(email) {
    if (!email) return false;
    
    this.debug('Sending transcript to email:', email);
    
    if (this.socket && this.socket.connected && this.sessionId) {
      this.socket.emit('send_transcript', {
        sessionId: this.sessionId,
        email: email,
        transcript: this.transcript
      });
      
      return true;
    } else {
      this.debug('Socket not connected or no active session, cannot send transcript');
      return false;
    }
  }

  // Clean up resources
  dispose() {
    this.debug('Disposing ChattyClient');
    
    // End session if active
    if (this.sessionId) {
      this.endSession();
    }
    
    // Stop listening
    this.stopListening();
    
    // Clear session timer
    this.clearSessionTimer();
    
    // Clear ping interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    // Clear all pending promises
    this.pendingPromises.forEach(({ reject }) => {
      reject(new Error('Client disposed'));
    });
    this.pendingPromises.clear();
    
    // Stop audio playback
    if (this.audioPlayer) {
      this.audioPlayer.pause();
      this.audioPlayer.src = '';
      this.audioPlayer = null;
    }
    
    // Disconnect socket
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    // Close audio context
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    // Clear transcript
    this.transcript = [];
    
    this.debug('ChattyClient disposed');
  }
}

// Export for use in other modules
window.ChattyClient = ChattyClient;
