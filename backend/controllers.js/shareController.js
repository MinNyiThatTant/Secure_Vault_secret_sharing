const Share = require('../models/Share');
const { v4: uuidv4 } = require('uuid');

// Create a new vault and split secret into shares
// Note: Actual splitting happens in browser. This just stores encrypted shares.
exports.createVault = async (req, res) => {
  try {
    const { vaultId, shares, metadata } = req.body;
    // shares should be an array of { shareIndex, encryptedShareY, iv, authTag, holderEmail }
    
    const savedShares = [];
    for (const share of shares) {
      const newShare = new Share({
        vaultId,
        ownerId: req.user._id,
        holderEmail: share.holderEmail,
        shareIndex: share.shareIndex,
        encryptedShareY: share.encryptedShareY,
        iv: share.iv,
        authTag: share.authTag,
        status: 'pending'
      });
      await newShare.save();
      savedShares.push(newShare);
    }
    
    res.status(201).json({ 
      message: 'Vault created successfully',
      vaultId,
      shares: savedShares.map(s => ({ id: s._id, holderEmail: s.holderEmail, shareIndex: s.shareIndex }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all shares for a specific vault (for the owner)
exports.getVaultShares = async (req, res) => {
  try {
    const { vaultId } = req.params;
    const shares = await Share.find({ 
      vaultId, 
      ownerId: req.user._id 
    }).select('-__v');
    
    res.json({ vaultId, shares });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get shares assigned to the current user (as holder)
exports.getMyShares = async (req, res) => {
  try {
    const shares = await Share.find({ 
      holderEmail: req.user.email,
      status: 'accepted'
    }).populate('ownerId', 'username email');
    
    res.json({ shares });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Accept or reject a share request
exports.updateShareStatus = async (req, res) => {
  try {
    const { shareId } = req.params;
    const { status } = req.body; // 'accepted' or 'rejected'
    
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
};