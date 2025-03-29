# Chatty Voice-First AI Portal

A voice-first AI portal optimized for low latency using OpenAI's realtime API.

## Features

- **Voice-First Interaction**: Natural conversation with AI using voice input and output
- **Low Latency**: Optimized for real-time interactions with 50ms audio chunks
- **Time-Limited Sessions**: 60-second conversations with CTA trigger at 45 seconds
- **Cheerful Guide Personality**: Warm, friendly tone with natural conversational flow
- **Dark Mode UI**: Modern interface with visual feedback during interactions
- **Lead Generation**: Built-in CTA and email capture for business leads
- **Transcript Delivery**: Send conversation transcripts via email

## Project Structure

```
chatty-project/
├── public/                  # Frontend assets and client-side code
│   ├── index.html           # Main application page with inline ChattyClient
│   ├── styles.css           # Main stylesheet
│   ├── dark-mode.css        # Dark mode specific styles
│   ├── chatty-embed.js      # Embeddable script for third-party websites
│   ├── collaboration.html   # Collaboration interface for multiple users
│   └── simplified.html      # Simplified interface focused on voice interaction
├── server.js                # Main server implementation with realtime API integration
├── error-logger.js          # Enhanced error logging module
├── package.json             # Project dependencies and scripts
├── .env.example             # Example environment variables configuration
└── README.md                # Project documentation
```

## Technical Implementation

### Client-Side

The client-side implementation includes:

1. **ChattyClient Class**: Handles all voice interaction, session management, and audio processing
2. **Audio Processing**: Converts base64 audio data to playable formats with multiple fallbacks
3. **WebSocket Communication**: Real-time communication with the server using Socket.io
4. **Error Handling**: Comprehensive error detection and recovery mechanisms
5. **UI Components**: Dark mode interface with visual feedback during interactions

### Server-Side

The server-side implementation includes:

1. **OpenAI Realtime API Integration**: Connects to OpenAI's realtime API for voice processing
2. **Session Management**: Creates and manages user sessions with proper cleanup
3. **Error Logging**: Enhanced error tracking and reporting
4. **WebSocket Server**: Socket.io server for real-time communication
5. **Security**: Proper API key management and CORS configuration

## Setup Instructions

1. Clone the repository
2. Create a `.env` file based on `.env.example` and add your OpenAI API key
3. Install dependencies: `npm install`
4. Start the server: `npm start`
5. Open `http://localhost:3000` in your browser

## Embedding on Other Websites

Add this single line of code to any webpage:

```html
<script src="https://your-server-url/chatty-embed.js"></script>
```

For customization, add options:

```html
<script>
window.chattyOptions = {
  buttonText: "Ask Chatty",
  position: "bottom-right",
  theme: "dark",
  primaryColor: "#4f46e5"
};
</script>
<script src="https://your-server-url/chatty-embed.js"></script>
```

## Optimizations for Low Latency

1. **50ms Audio Chunks**: Smaller audio chunks for more responsive interactions
2. **WebSocket Reconnection**: Automatic reconnection with exponential backoff
3. **Connection Pooling**: Session reuse to reduce initialization overhead
4. **Audio Format Handling**: Efficient audio processing with format conversion
5. **Error Recovery**: Robust error handling with fallback mechanisms

## License

MIT
