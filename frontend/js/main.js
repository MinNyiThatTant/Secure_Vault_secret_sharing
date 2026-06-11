// Load user info
const user = JSON.parse(localStorage.getItem('user') || '{}');
if (user.username) {
    document.getElementById('username').textContent = user.username;
    localStorage.setItem('userId', user.id);
    localStorage.setItem('username', user.username);
}

function showSection(section) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById(`${section}-section`).classList.add('active');
    event.target.classList.add('active');
    
    if (section === 'my-shares') {
        loadMyShares();
    }
}

async function splitAndSaveSecret() {
    const secretText = document.getElementById('secret-input').value;
    const k = parseInt(document.getElementById('threshold').value);
    const n = parseInt(document.getElementById('total-shares').value);
    const holdersText = document.getElementById('holders').value;
    
    if (!secretText) {
        alert('Please enter a secret');
        return;
    }
    
    const holders = holdersText.split('\n').filter(h => h.trim());
    if (holders.length !== n) {
        alert(`Please enter exactly ${n} email addresses (one per line)`);
        return;
    }
    
    // Convert secret to bytes
    const encoder = new TextEncoder();
    const secretBytes = encoder.encode(secretText);
    
    // Split using Shamir's SSS
    const shares = ShamirSSS.split(secretBytes, k, n);
    
    // Generate unique vault ID
    const vaultId = crypto.randomUUID();
    
    // Prepare shares for storage (encrypt each share)
    const sharesToSave = shares.map((share, idx) => ({
        shareIndex: share.x,
        encryptedShareY: share.y, // encrypt with holder's public key
        iv: 'placeholder',
        authTag: 'placeholder',
        holderEmail: holders[idx]
    }));
    
    const result = await api.createVault(vaultId, sharesToSave);
    
    if (result.vaultId) {
        const resultDiv = document.getElementById('split-result');
        resultDiv.innerHTML = `
            <h3>Vault Created Successfully!</h3>
            <p><strong>Vault ID:</strong> ${vaultId}</p>
            <p><strong>Threshold:</strong> ${k} of ${n} shares needed</p>
            <p><strong>Shares distributed to:</strong></p>
            <ul>
                ${holders.map((h, i) => `<li>${h} (Share ${i+1})</li>`).join('')}
            </ul>
            <p style="color: #dc2626; margin-top: 10px;">
                Save this Vault ID! You'll need it to recover your secret.
            </p>
        `;
    } else {
        alert('Failed to save vault: ' + JSON.stringify(result));
    }
}

async function fetchVaultShares() {
    const vaultId = document.getElementById('vault-id').value;
    if (!vaultId) {
        alert('Enter Vault ID');
        return;
    }
    
    const result = await api.getVaultShares(vaultId);
    const resultDiv = document.getElementById('combine-result');
    
    if (result.shares && result.shares.length > 0) {
        resultDiv.innerHTML = `
            <h3>Shares for Vault: ${vaultId}</h3>
            <p>You have ${result.shares.length} shares in this vault.</p>
            <p>To recover the secret, you need to collect at least the threshold number of shares from the holders.</p>
            <button onclick="simulateCombine('${vaultId}')">Simulate Combine (Demo)</button>
            <div id="recovered-secret" style="margin-top:15px;"></div>
        `;
    } else {
        resultDiv.innerHTML = '<p>No shares found for this vault.</p>';
    }
}

function simulateCombine(vaultId) {
    // In a real implementation, you would:
    // 1. Collect shares from different holders
    // 2. Decrypt each share
    // 3. Combine using ShamirSSS.combine()
    
    alert(`In production, you would collect ${3} shares from different holders and combine them here.`);
}

async function loadMyShares() {
    const result = await api.getMyShares();
    const container = document.getElementById('my-shares-list');
    
    if (result.shares && result.shares.length > 0) {
        container.innerHTML = `
            <h3>Shares Assigned to You</h3>
            ${result.shares.map(share => `
                <div style="border:1px solid #ddd; padding:15px; margin-bottom:10px; border-radius:8px;">
                    <p><strong>Vault:</strong> ${share.vaultId}</p>
                    <p><strong>Owner:</strong> ${share.ownerId?.username || 'Unknown'}</p>
                    <p><strong>Share Index:</strong> ${share.shareIndex}</p>
                    <p><strong>Status:</strong> ${share.status}</p>
                    ${share.status === 'pending' ? `
                        <button onclick="api.updateShareStatus('${share._id}', 'accepted').then(()=>loadMyShares())">
                            Accept Share
                        </button>
                        <button onclick="api.updateShareStatus('${share._id}', 'rejected').then(()=>loadMyShares())">
                            Reject
                        </button>
                    ` : ''}
                </div>
            `).join('')}
        `;
    } else {
        container.innerHTML = '<p>No shares assigned to you yet.</p>';
    }
}