const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { createVault, getVaultShares, getMyShares, updateShareStatus } = require('../controllers/shareController');

router.post('/vault', auth, createVault);
router.get('/vault/:vaultId', auth, getVaultShares);
router.get('/my-shares', auth, getMyShares);
router.put('/:shareId/status', auth, updateShareStatus);

module.exports = router;