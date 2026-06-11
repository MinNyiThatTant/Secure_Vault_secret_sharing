const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));

// ============ In-Memory Database  ============
const users = [];
const shares = [];
const sessions = {};

// ============ Auth Routes ============
app.post('/api/auth/register', (req, res) => {
  const { username, email, password } = req.body;
  
  if (users.find(u => u.email === email)) {
    return res.status(400).json({ error: 'User already exists' });
  }
  
  const user = { 
    id: uuidv4(), 
    username, 
    email, 
    password: password 
  };
  users.push(user);
  
  res.json({ 
    token: `token_${user.id}`,
    user: { id: user.id, username, email }
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email && u.password === password);
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  res.json({ 
    token: `token_${user.id}`,
    user: { id: user.id, username: user.username, email }
  });
});

app.get('/api/auth/me', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  
  const userId = token.replace('token_', '');
  const user = users.find(u => u.id === userId);
  
  if (!user) return res.status(401).json({ error: 'User not found' });
  
  res.json({ user: { id: user.id, username: user.username, email: user.email } });
});

// ============ Share Routes ============
app.post('/api/shares/vault', (req, res) => {
  const { vaultId, shares: shareData } = req.body;
  const token = req.headers.authorization?.replace('Bearer ', '');
  const userId = token?.replace('token_', '');
  
  shareData.forEach((share, idx) => {
    shares.push({
      _id: uuidv4(),
      vaultId,
      ownerId: userId,
      holderEmail: share.holderEmail,
      shareIndex: share.shareIndex,
      encryptedShareY: share.encryptedShareY,
      iv: share.iv || 'placeholder',
      authTag: share.authTag || 'placeholder',
      status: 'pending',
      createdAt: new Date()
    });
  });
  
  res.json({ message: 'Vault created successfully', vaultId });
});

app.get('/api/shares/vault/:vaultId', (req, res) => {
  const { vaultId } = req.params;
  const token = req.headers.authorization?.replace('Bearer ', '');
  const userId = token?.replace('token_', '');
  
  const userShares = shares.filter(s => s.vaultId === vaultId && s.ownerId === userId);
  res.json({ vaultId, shares: userShares });
});

app.get('/api/shares/my-shares', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const userId = token?.replace('token_', '');
  const user = users.find(u => u.id === userId);
  
  if (!user) return res.json({ shares: [] });
  
  const myShares = shares.filter(s => s.holderEmail === user.email && s.status === 'accepted');
  res.json({ shares: myShares });
});

app.put('/api/shares/:shareId/status', (req, res) => {
  const { shareId } = req.params;
  const { status } = req.body;
  const token = req.headers.authorization?.replace('Bearer ', '');
  const userId = token?.replace('token_', '');
  const user = users.find(u => u.id === userId);
  
  const share = shares.find(s => s._id === shareId && s.holderEmail === user?.email);
  if (!share) {
    return res.status(404).json({ error: 'Share not found' });
  }
  
  share.status = status;
  res.json({ message: `Share ${status}`, share });
});

// ============ WebSocket for Chat ============
io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);
  
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room: ${roomId}`);
  });
  
  socket.on('send-message', (data) => {
    console.log(`Relay message in room: ${data.roomId}`);
    socket.to(data.roomId).emit('receive-message', {
      ...data,
      timestamp: Date.now()
    });
  });
  
  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

// ============ Start Server ============
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`
  Server is Running!                   
  http://localhost:${PORT}                         
  Running with IN-MEMORY storage               ║
  (No MongoDB required for testing)
  Test Accounts:
  Register any email/password 
  `);
});