// Add collaboration features to Chatty Voice-First AI Portal
// This file adds real-time collaboration capabilities

// User management for collaboration
class CollaborationManager {
  constructor() {
    this.activeUsers = new Map();
    this.rooms = new Map();
    this.transcriptHistory = new Map();
  }
  
  // Register a new user
  registerUser(userId, userName, socketId) {
    this.activeUsers.set(userId, {
      id: userId,
      name: userName,
      socketId: socketId,
      activeRoom: null,
      lastActivity: Date.now()
    });
    
    return this.activeUsers.get(userId);
  }
  
  // Create a new collaboration room
  createRoom(roomId, ownerId, roomName) {
    if (this.rooms.has(roomId)) {
      return this.rooms.get(roomId);
    }
    
    this.rooms.set(roomId, {
      id: roomId,
      name: roomName || `Room ${roomId}`,
      owner: ownerId,
      participants: new Set([ownerId]),
      createdAt: Date.now(),
      lastActivity: Date.now()
    });
    
    // Initialize transcript history for this room
    this.transcriptHistory.set(roomId, []);
    
    return this.rooms.get(roomId);
  }
  
  // Join a user to a room
  joinRoom(userId, roomId) {
    if (!this.activeUsers.has(userId)) {
      throw new Error('User not registered');
    }
    
    if (!this.rooms.has(roomId)) {
      throw new Error('Room does not exist');
    }
    
    const user = this.activeUsers.get(userId);
    const room = this.rooms.get(roomId);
    
    // Update user's active room
    user.activeRoom = roomId;
    
    // Add user to room participants
    room.participants.add(userId);
    room.lastActivity = Date.now();
    
    return room;
  }
  
  // Leave a room
  leaveRoom(userId, roomId) {
    if (!this.activeUsers.has(userId) || !this.rooms.has(roomId)) {
      return;
    }
    
    const user = this.activeUsers.get(userId);
    const room = this.rooms.get(roomId);
    
    // Remove user from room
    if (user.activeRoom === roomId) {
      user.activeRoom = null;
    }
    
    room.participants.delete(userId);
    
    // If room is empty and not owned by anyone, delete it
    if (room.participants.size === 0 && room.owner !== userId) {
      this.rooms.delete(roomId);
      this.transcriptHistory.delete(roomId);
    }
  }
  
  // Add message to transcript history
  addToTranscript(roomId, message) {
    if (!this.transcriptHistory.has(roomId)) {
      this.transcriptHistory.set(roomId, []);
    }
    
    const transcript = this.transcriptHistory.get(roomId);
    transcript.push({
      ...message,
      timestamp: Date.now()
    });
    
    // Limit transcript history size
    if (transcript.length > 100) {
      transcript.shift();
    }
    
    return transcript;
  }
  
  // Get transcript history for a room
  getTranscript(roomId) {
    return this.transcriptHistory.get(roomId) || [];
  }
  
  // Get active users in a room
  getUsersInRoom(roomId) {
    if (!this.rooms.has(roomId)) {
      return [];
    }
    
    const room = this.rooms.get(roomId);
    return Array.from(room.participants)
      .map(userId => this.activeUsers.get(userId))
      .filter(user => user !== undefined);
  }
  
  // Get all rooms
  getAllRooms() {
    return Array.from(this.rooms.values());
  }
  
  // Get rooms for a user
  getUserRooms(userId) {
    return this.getAllRooms().filter(room => 
      room.participants.has(userId) || room.owner === userId
    );
  }
  
  // Clean up inactive users and rooms
  cleanup(userTimeout = 3600000, roomTimeout = 86400000) {
    const now = Date.now();
    
    // Clean up inactive users
    for (const [userId, user] of this.activeUsers.entries()) {
      if (now - user.lastActivity > userTimeout) {
        // Leave all rooms
        if (user.activeRoom) {
          this.leaveRoom(userId, user.activeRoom);
        }
        
        this.activeUsers.delete(userId);
      }
    }
    
    // Clean up inactive rooms
    for (const [roomId, room] of this.rooms.entries()) {
      if (now - room.lastActivity > roomTimeout) {
        this.rooms.delete(roomId);
        this.transcriptHistory.delete(roomId);
      }
    }
  }
}

module.exports = CollaborationManager;
