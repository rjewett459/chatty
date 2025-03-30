const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');
const OpenAI = require('openai');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');

dotenv.config();

const app = express();
const httpServer = http.createServer(app);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

    sessions.set(sessionId, {
      id: sessionId,
      socketId: socket.id,
      personality,
      createdAt: Date.now(),
      lastActivity: Date.now(),
    });

    socket.emit('session_created', { sessionId, personality });

    setTimeout(() => {
      const greeting = "Hey there! I'm Chatty – your personal AI guide. Want to see what ChatSites can do in under a minute?";
      socket.emit('realtime_message', {
        sessionId,
        data: { type: 'transcript', data: greeting }
      });
    }, 1000);
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

    await processRealAudio(socket, sessionId, audio, session);
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

async function processRealAudio(socket, sessionId, audio, session) {
  const ws = new WebSocket('wss://api.openai.com/v1/realtime', {
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
  });

  ws.on('open', () => {
    ws.send(JSON.stringify({
      type: 'session.create',
      session: {
        model: 'gpt-4o',
        voice: 'nova',
      }
    }));

    ws.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_audio',
            audio: audio,
          },
        ]
      }
    }));

    ws.send(JSON.stringify({ type: 'response.create' }));
  });

  ws.on('message', (message) => {
    const data = JSON.parse(message);

    if (data.type === 'response.audio.delta') {
      socket.emit('realtime_message', {
        sessionId,
        data: {
          type: 'audio',
          data: `data:audio/mp3;base64,${data.delta}`
        }
      });
    }
    if (data.type === 'response.text.delta') {
      socket.emit('realtime_message', {
        sessionId,
        data: {
          type: 'transcript',
          data: data.delta
        }
      });
    }
  });
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
