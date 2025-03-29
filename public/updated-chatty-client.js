// Updated Chatty Client for Voice-First AI Portal
// Optimized for low latency with OpenAI's realtime API
// Fixed session creation issues

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
    
    try {
      // Update status
      this.updateStatus('Connecting...', 'connecting');
      
      // Connect to Socket.io server
      this.socket = io(serverUrl, {
        withCredentials: false, // Changed to false to avoid CORS issues
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
        timeout: 10000, // Increased timeout for better reliability
        transports: ['websocket', 'polling'], // Allow fallback to polling
        upgrade: true // Allow transport upgrade for better compatibility
      });

      // Set up socket event listeners
      this.setupSocketListeners();
      
      // Initialize Web Audio API
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        latencyHint: 'interactive' // Optimize for interactive applications
      });
      
      // Set up ping mechanism to keep connection alive
      this.setupPingMechanism();
      
      // Wait for connection
      await new Promise((resolve, reject) => {
        const connectionTimeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000); // Increased timeout
        
        this.socket.on('connect', () => {
          clearTimeout(connectionTimeout);
          this.reconnectAttempts = 0;
          this.lastNetworkActivity = Date.now();
          this.updateStatus('Connected', 'connected');
          resolve();
        });
        
        this.socket.on('connect_error', (error) => {
          clearTimeout(connectionTimeout);
          console.error('Connection error:', error);
          this.updateStatus('Connection error', 'error');
          this.handleReconnect();
          reject(error);
        });
      });
      
      return true;
    } catch (error) {
      console.error('Error initializing Chatty client:', error);
      this.updateStatus('Failed to connect', 'error');
      return false;
    }
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
        console.log('Connection may be stale, sending ping');
        this.socket.emit('ping');
      }
    }, 10000); // Check every 10 seconds
  }

  // Handle reconnection logic
  handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
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
      this.updateStatus('Connection failed', 'error');
    }
  }

  // Set up Socket.io event listeners
  setupSocketListeners() {
    this.socket.on('session_created', (data) => {
      this.lastNetworkActivity = Date.now();
      this.sessionId = data.sessionId;
      console.log('Session created:', this.sessionId);
      this.updateStatus('Session ready', 'ready');
    });
    
    this.socket.on('realtime_message', (data) => {
      this.lastNetworkActivity = Date.now();
      const message = data.data;
      
      if (message.type === 'transcript') {
        this.handleTranscript(message.data);
      } else if (message.type === 'audio') {
        this.handleAudio(message.data);
      }
    });
    
    this.socket.on('session_error', (data) => {
      console.error('Session error:', data);
      this.updateStatus('Session error', 'error');
    });
    
    this.socket.on('session_closed', (data) => {
      console.log('Session closed:', data);
      this.sessionId = null;
      this.updateStatus('Session ended', 'idle');
      this.clearSessionTimer();
    });
    
    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      this.updateStatus('Disconnected', 'error');
    });
    
    this.socket.on('pong', () => {
      this.lastNetworkActivity = Date.now();
      console.log('Received pong from server');
    });
    
    // Add error handler
    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
      this.updateStatus('Connection error', 'error');
    });
  }

  // Start a new session
  async startSession() {
    if (this.sessionId) {
      console.log('Session already active');
      return;
    }
    
    try {
      this.updateStatus('Creating session...', 'connecting');
      
      // Simplified session creation - don't send personality parameter
      // to avoid potential server-side issues
      this.socket.emit('create_session');
      
      // Wait for session creation
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Session creation timeout'));
        }, 15000); // Increased timeout
        
        const sessionCreatedHandler = (data) => {
          clearTimeout(timeout);
          this.sessionId = data.sessionId;
          this.socket.off('session_created', sessionCreatedHandler);
          resolve();
        };
        
        const errorHandler = (data) => {
          clearTimeout(timeout);
          this.socket.off('session_error', errorHandler);
          reject(new Error(data.error || 'Session creation failed'));
        };
        
        this.socket.on('session_created', sessionCreatedHandler);
        this.socket.on('session_error', errorHandler);
      });
      
      // Start with greeting
      await this.playGreeting();
      
      // Start listening
      await this.startListening();
      
      // Start session timer
      this.startSessionTimer();
      
      return true;
    } catch (error) {
      console.error('Error starting session:', error);
      this.updateStatus('Failed to start session', 'error');
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
    console.log('CTA triggered');
    
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

  // End the current session
  endSession() {
    if (!this.sessionId) {
      console.log('No active session');
      return;
    }
    
    this.stopListening();
    this.clearSessionTimer();
    
    this.socket.emit('end_session', {
      sessionId: this.sessionId
    });
    
    // Call session end callback if provided
    if (this.onSessionEnd) {
      this.onSessionEnd(this.transcript);
    }
    
    this.sessionId = null;
    this.updateStatus('Session ended', 'idle');
  }

  // Start listening for user voice input
  async startListening() {
    if (this.isListening) return;
    
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
      
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Create media recorder with optimized settings
      const options = {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 16000
      };
      
      this.mediaRecorder = new MediaRecorder(this.stream, options);
      
      // Set up data handling
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && this.sessionId) {
          // Send audio chunk to server
          this.socket.emit('send_audio', {
            sessionId: this.sessionId,
            audio: event.data
          });
          this.lastNetworkActivity = Date.now();
        }
      };
      
      // Set recording to 50ms chunks for more responsive real-time processing
      this.mediaRecorder.start(50);
      
      this.isListening = true;
    } catch (error) {
      console.error('Error accessing microphone:', error);
      this.updateStatus('Microphone access denied', 'error');
      throw error;
    }
  }

  // Stop listening
  stopListening() {
    if (!this.isListening) return;
    
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    this.isListening = false;
    this.updateStatus('Stopped listening', 'idle');
  }

  // Handle transcript from server
  handleTranscript(text) {
    if (!text) return;
    
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
    // Process audio data
    // This would typically involve playing the audio
    console.log('Received audio data');
  }

  // Play initial greeting
  async playGreeting() {
    const greeting = "Hey there! I'm Chatty – your personal AI guide. Want to see what ChatSites can do in under a minute?";
    
    // Add to transcript
    this.transcript.push({
      role: 'assistant',
      content: greeting
    });
    
    // Update UI
    this.addMessageToTranscript('assistant', greeting);
    
    // In a real implementation, this would send the greeting to be spoken
    // For now, we'll just simulate a delay
    this.updateStatus('Speaking...', 'speaking');
    await new Promise(resolve => setTimeout(resolve, 2000));
    this.updateStatus('Listening...', 'listening');
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
    
    this.socket.emit('send_transcript', {
      sessionId: this.sessionId,
      email: email,
      transcript: this.transcript
    });
    
    return true;
  }

  // Clean up resources
  dispose() {
    this.stopListening();
    this.clearSessionTimer();
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.sessionId = null;
    this.transcript = [];
  }
}

// Export for use in other modules
window.ChattyClient = ChattyClient;
