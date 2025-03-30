const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');
const OpenAI = require('openai');
const path = require('path');
const fs = require('fs');

dotenv.config();

// ✅ Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const app = express();
const httpServer = http.createServer(app);


app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false
  },
  pingTimeout: 30000,
  pingInterval: 10000,
  transports: ['websocket', 'polling'],
  upgrade: true,
  maxHttpBufferSize: 1e6,
  perMessageDeflate: true
});

let openai;
try {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
  openai = new OpenAI({ apiKey });
  console.log('OpenAI client initialized');
} catch (error) {
  console.error('Error initializing OpenAI:', error);
}

const sessions = new Map();
const SESSION_CLEANUP_INTERVAL = 5 * 60 * 1000;
const SESSION_TIMEOUT = 10 * 60 * 1000;

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Chatty Voice-First AI Portal API is running' });
});

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('ping', () => {
    console.log('Ping received from client:', socket.id);
    socket.emit('pong');
  });

  socket.on('create_session', async (data = {}) => {
    console.log('Session creation requested:', socket.id, 'with data:', data);
    const sessionId = uuidv4();
    const personality = data.personality || 'cheerful_guide';

    try {
      const realtimeSession = await createOpenAIRealtimeSession(personality);
      sessions.set(sessionId, {
        id: sessionId,
        socketId: socket.id,
        personality,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        openaiSession: realtimeSession
      });

      socket.emit('session_created', { sessionId, personality });

      setTimeout(() => {
        const greeting = "Hey there! I'm Chatty – your personal AI guide. Want to see what ChatSites can do in under a minute?";
        generateAndSendAudio(socket, sessionId, greeting);
        socket.emit('realtime_message', {
          sessionId,
          data: { type: 'transcript', data: greeting }
        });
      }, 1000);
    } catch (error) {
      console.error('OpenAI session error:', error);
      console.error('Creating mock session instead...');

      const mockSessionId = 'mock-session-' + Date.now();
      sessions.set(sessionId, {
        id: sessionId,
        socketId: socket.id,
        personality,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        isMockSession: true,
        mockSessionId
      });

      socket.emit('session_created', { sessionId, personality, isMockSession: true });

      setTimeout(() => {
        const greeting = "Hey there! I'm Chatty – your personal AI guide. Want to see what ChatSites can do in under a minute?";
        generateAndSendAudio(socket, sessionId, greeting);
        socket.emit('realtime_message', {
          sessionId,
          data: { type: 'transcript', data: greeting }
        });
      }, 1000);
    }
  });

  socket.on('send_audio', async (data) => {
    const { sessionId, audio } = data;
    if (!sessionId || !sessions.has(sessionId)) {
      return socket.emit('session_error', {
        error: 'invalid_session',
        message: 'Invalid or expired session'
      });
    }

    const session = sessions.get(sessionId);
    session.lastActivity = Date.now();

    if (session.isMockSession) {
      processMockAudio(socket, sessionId);
    } else {
      await processRealAudio(socket, sessionId, audio, session);
    }
  });

  socket.on('end_session', (data) => {
    const { sessionId } = data;
    if (!sessionId || !sessions.has(sessionId)) {
      return socket.emit('session_error', {
        error: 'invalid_session',
        message: 'Invalid or expired session'
      });
    }

    sessions.delete(sessionId);
    socket.emit('session_closed', { sessionId });
  });

  socket.on('send_transcript', (data) => {
    const { sessionId, email, transcript } = data;
    if (!sessionId || !sessions.has(sessionId) || !email) {
      return socket.emit('session_error', {
        error: 'invalid_request',
        message: 'Missing session ID or email'
      });
    }

    console.log(`Sending transcript to ${email} (mock)`);
    socket.emit('transcript_sent', { sessionId, email });
  });

  socket.on('disconnect', () => {
    for (const [sessionId, session] of sessions.entries()) {
      if (session.socketId === socket.id) {
        sessions.delete(sessionId);
      }
    }
    console.log('Client disconnected:', socket.id);
  });
});

async function createOpenAIRealtimeSession(personality) {
  await new Promise(resolve => setTimeout(resolve, 500));
  return {
    id: 'mock-openai-session-' + uuidv4(),
    personality,
    createdAt: Date.now()
  };
}

function processMockAudio(socket, sessionId) {
  const responses = [
    "I understand what you're saying. Tell me more about that.",
    "That's interesting! How can I help you with that?",
    "I see. What specific information are you looking for?",
    "Thanks for sharing. Is there anything else you'd like to know?",
    "Got it. Let me think about how I can best assist you with that."
  ];
  const response = responses[Math.floor(Math.random() * responses.length)];

  setTimeout(() => {
    generateAndSendAudio(socket, sessionId, response);
    socket.emit('realtime_message', {
      sessionId,
      data: { type: 'transcript', data: response }
    });
  }, 1000);
}

async function processRealAudio(socket, sessionId, audio, session) {
  processMockAudio(socket, sessionId); // Placeholder for now
}

function generateAndSendAudio(socket, sessionId, text) {
  try {
    const filePath = path.join(__dirname, 'public', 'sample.mp3');
    const audioBuffer = fs.readFileSync(filePath);
    const base64Audio = audioBuffer.toString('base64');
    const audioUrl = `data:audio/mp3;base64,${base64Audio}`;

    socket.emit('realtime_message', {
      sessionId,
      data: {
        type: 'audio',
        data: audioUrl
      }
    });

    console.log(`Audio sent for session ${sessionId}`);
  } catch (err) {
    console.error('Error generating audio:', err);
  }
}

function cleanupSessions() {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.lastActivity > SESSION_TIMEOUT) {
      sessions.delete(sessionId);
    }
  }
}

setInterval(cleanupSessions, SESSION_CLEANUP_INTERVAL);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
