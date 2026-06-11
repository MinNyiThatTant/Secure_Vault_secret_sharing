const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));

// ============ MongoDB Models ============
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const ShareSchema = new mongoose.Schema({
  vaultId: { type: String, required: true, index: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  holderEmail: { type: String, required: true },
  shareIndex: { type: Number, required: true },
  encryptedShareY: { type: String, required: true },
  iv: { type: String, required: true },
  authTag: { type: String, required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Share = mongoose.model('Share', ShareSchema);

// ============ Helper Functions ============
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token provided' });
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) return res.status(401).json({ error: 'User not found' });
    
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ============ Auth Routes ============
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashedPassword });
    await user.save();
    
    const token = generateToken(user._id);
    res.status(201).json({
      token,
      user: { id: user._id, username: user.username, email: user.email }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = generateToken(user._id);
    res.json({
      token,
      user: { id: user._id, username: user.username, email: user.email }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  res.json({ user: req.user });
});

// ============ Share Routes ============
app.post('/api/shares/vault', authMiddleware, async (req, res) => {
  try {
    console.log('📦 Received create vault request');
    console.log('   User:', req.user?.email);
    console.log('   Body:', req.body);
    
    const { vaultId, shares: shareData } = req.body;
    
    if (!vaultId || !shareData || !shareData.length) {
      console.log('❌ Invalid request: missing vaultId or shares');
      return res.status(400).json({ error: 'Missing vaultId or shares' });
    }
    
    const savedShares = [];
    for (const share of shareData) {
      const newShare = new Share({
        vaultId,
        ownerId: req.user._id,
        holderEmail: share.holderEmail,
        shareIndex: share.shareIndex,
        encryptedShareY: share.encryptedShareY,
        iv: share.iv || 'placeholder',
        authTag: share.authTag || 'placeholder',
        status: 'pending'
      });
      await newShare.save();
      savedShares.push(newShare);
      console.log(`   ✅ Saved share for ${share.holderEmail}`);
    }
    
    console.log(`✅ Vault created with ${savedShares.length} shares`);
    res.status(201).json({ message: 'Vault created', vaultId, shareCount: savedShares.length });
  } catch (error) {
    console.error('❌ Error creating vault:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/shares/my-shares', authMiddleware, async (req, res) => {
  try {
    console.log('========== DEBUG ==========');
    console.log('User email from token:', req.user.email);
    
    // အကုန်ပြပါ - ဘယ် filter မှမပါဘူး
    const allShares = await Share.find({});
    console.log('All shares in DB:', allShares.map(s => ({ holderEmail: s.holderEmail, status: s.status })));
    
    // User အတွက် filter လုပ်ပါ
    const myShares = await Share.find({ 
      holderEmail: req.user.email 
    });
    
    console.log('My shares:', myShares.map(s => ({ holderEmail: s.holderEmail, status: s.status })));
    console.log('============================');
    
    res.json({ shares: myShares });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/shares/my-shares', authMiddleware, async (req, res) => {
  try {
    const shares = await Share.find({ 
      holderEmail: req.user.email, 
      status: 'accepted' 
    }).populate('ownerId', 'username email');
    res.json({ shares });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/shares/:shareId/status', authMiddleware, async (req, res) => {
  try {
    const { shareId } = req.params;
    const { status } = req.body;
    
    const share = await Share.findOne({ _id: shareId, holderEmail: req.user.email });
    if (!share) {
      return res.status(404).json({ error: 'Share not found' });
    }
    
    share.status = status;
    await share.save();
    res.json({ message: `Share ${status}`, share });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ WebSocket for Chat ============
io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);
  
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`📢 ${socket.id} joined room: ${roomId}`);
  });
  
  socket.on('send-message', (data) => {
    socket.to(data.roomId).emit('receive-message', {
      ...data,
      timestamp: Date.now()
    });
  });
  
  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

// ============ Database Connection & Server Start ============
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/zkvault';
const PORT = process.env.PORT || 5000;

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB Connected Successfully!');
    console.log(`📚 Database: ${MONGODB_URI}`);
    
    server.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🚀 ZK VAULT SERVER RUNNING                                 ║
║                                                              ║
║   📡 HTTP: http://localhost:${PORT}                           ║
║   🗄️  MongoDB: Connected                                     ║
║   🔐 JWT Auth: Enabled                                       ║
║   💬 WebSocket: Ready                                        ║
║                                                              ║
║   📝 Test Accounts:                                          ║
║      Register any email/password                            ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
      `);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message);
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                      ⚠️  TROUBLESHOOTING                      ║
║                                                              ║
║  Make sure MongoDB is running:                              ║
║                                                              ║
║  Terminal 1 (MongoDB):                                      ║
║  > "C:\\Program Files\\MongoDB\\Server\\6.0\\bin\\mongod.exe" --dbpath C:\\data\\db
║                                                              ║
║  Then restart this server.                                  ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
    `);
    process.exit(1);
  });