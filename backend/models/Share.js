const mongoose = require('mongoose');

// Server has NO decryption keys. Even if database leaked, data is safe.
const ShareSchema = new mongoose.Schema({
  vaultId: {
    type: String,
    required: true,
    index: true
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  holderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  holderEmail: {
    type: String,
    default: null
  },
  shareIndex: {
    type: Number,  // x value (1 to n)
    required: true
  },
  // Encrypted share value (AES-256-GCM encrypted)
  encryptedShareY: {
    type: String,
    required: true
  },
  iv: {
    type: String,  // Initialization vector for AES
    required: true
  },
  authTag: {
    type: String,  // GCM authentication tag
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Share', ShareSchema);