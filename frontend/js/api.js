const API_URL = 'http://localhost:5000/api';

const api = {
    async register(username, email, password) {
        try {
            const res = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });
            const data = await res.json();
            if (res.ok) return { success: true, ...data };
            return { success: false, error: data.error };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    
    async login(email, password) {
        try {
            const res = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (res.ok) return { success: true, token: data.token, user: data.user };
            return { success: false, error: data.error };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    
    async createVault(vaultId, shares) {
    const token = localStorage.getItem('token');
    
    console.log('Creating vault with:', { vaultId, shares }); // Debug
    
    try {
        const res = await fetch(`${API_URL}/shares/vault`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ vaultId, shares })
        });
        
        const data = await res.json();
        console.log('Create vault response:', res.status, data); // Debug
        
        if (!res.ok) {
            throw new Error(data.error || 'Failed to create vault');
        }
        
        return data;
    } catch (error) {
        console.error('Create vault error:', error);
        alert('Error creating vault: ' + error.message);
        return { error: error.message };
    }
},
    
    async getVaultShares(vaultId) {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/shares/vault/${vaultId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return await res.json();
    },
    
    async getMyShares() {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/shares/my-shares`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return await res.json();
    },
    
    async updateShareStatus(shareId, status) {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/shares/${shareId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status })
        });
        return await res.json();
    }
};

function logout() {
    localStorage.clear();
    window.location.href = '/';
}