/**
 * OTR (Off-the-Record) Chat Implementation
 * 
 * Why ECDH + AES-GCM?
 * - ECDH: Perfect Forward Secrecy (each session uses new keys)
 * - AES-GCM: Authenticated encryption (can't tamper without detection)
 * - Hardware accelerated on modern CPUs
 */

class OTRSession {
    constructor() {
        this.privateKey = null;
        this.publicKey = null;
        this.sharedSecret = null;
        this.peerPublicKey = null;
        this.roomId = null;
        this.socket = null;
        this.isReady = false;
    }
    
    async init(roomId, socket) {
        this.roomId = roomId;
        this.socket = socket;
        
        // Generate ephemeral key pair for this session
        await this.generateKeyPair();
        
        // Join the room
        socket.emit('join-room', roomId);
        
        // Broadcast my public key
        const publicKeyJwk = await crypto.subtle.exportKey('jwk', this.publicKey);
        socket.emit('send-message', {
            roomId: roomId,
            type: 'key-exchange',
            publicKey: publicKeyJwk,
            from: localStorage.getItem('userId') || 'anonymous'
        });
        
        // Listen for key exchange
        socket.on('receive-message', async (data) => {
            if (data.type === 'key-exchange' && !this.peerPublicKey) {
                await this.receivePeerKey(data.publicKey);
            } else if (data.type === 'message' && this.sharedSecret) {
                this.displayMessage(data);
            }
        });
        
        return true;
    }
    
    async generateKeyPair() {
        const keyPair = await crypto.subtle.generateKey(
            {
                name: "ECDH",
                namedCurve: "P-256"
            },
            true,
            ["deriveKey", "deriveBits"]
        );
        this.privateKey = keyPair.privateKey;
        this.publicKey = keyPair.publicKey;
    }
    
    async receivePeerKey(publicKeyJwk) {
        this.peerPublicKey = await crypto.subtle.importKey(
            'jwk',
            publicKeyJwk,
            { name: "ECDH", namedCurve: "P-256" },
            false,
            []
        );
        
        await this.deriveSharedSecret();
        this.isReady = true;
        console.log('🔐 Secure channel established');
    }
    
    async deriveSharedSecret() {
        this.sharedSecret = await crypto.subtle.deriveKey(
            {
                name: "ECDH",
                public: this.peerPublicKey
            },
            this.privateKey,
            {
                name: "AES-GCM",
                length: 256
            },
            false,
            ["encrypt", "decrypt"]
        );
    }
    
    async encryptMessage(message) {
        if (!this.sharedSecret) {
            throw new Error('No shared secret established');
        }
        
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encodedMessage = new TextEncoder().encode(message);
        
        const encrypted = await crypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv: iv,
                tagLength: 128
            },
            this.sharedSecret,
            encodedMessage
        );
        
        return {
            ciphertext: Array.from(new Uint8Array(encrypted)),
            iv: Array.from(iv)
        };
    }
    
    async decryptMessage(encryptedData, iv) {
        if (!this.sharedSecret) {
            throw new Error('No shared secret established');
        }
        
        const decrypted = await crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: new Uint8Array(iv),
                tagLength: 128
            },
            this.sharedSecret,
            new Uint8Array(encryptedData)
        );
        
        return new TextDecoder().decode(decrypted);
    }
    
    async sendMessage(message) {
        if (!this.isReady) {
            alert('Waiting for peer to join...');
            return;
        }
        
        const { ciphertext, iv } = await this.encryptMessage(message);
        
        this.socket.emit('send-message', {
            roomId: this.roomId,
            type: 'message',
            encryptedMessage: ciphertext,
            iv: iv,
            from: localStorage.getItem('username') || 'me'
        });
        
        this.displayMessage({
            encryptedMessage: ciphertext,
            iv: iv,
            from: 'me',
            type: 'message'
        }, true);
    }
    
    displayMessage(data, isSent = false) {
        const chatDiv = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${isSent ? 'sent' : 'received'}`;
        
        if (isSent) {
            messageDiv.textContent = `You: [Encrypted message sent]`;
        } else if (data.type === 'key-exchange') {
            messageDiv.textContent = `🔐 Peer joined! Secure channel established.`;
        } else {
            messageDiv.textContent = `Peer: [Encrypted message]`;
        }
        
        chatDiv.appendChild(messageDiv);
        chatDiv.scrollTop = chatDiv.scrollHeight;
    }
}

let otrSession = null;

function initChat() {
    const roomId = document.getElementById('room-id').value;
    if (!roomId) {
        alert('Please enter a room ID');
        return;
    }
    
    const socket = io('http://localhost:5000');
    otrSession = new OTRSession();
    otrSession.init(roomId, socket);
    
    document.getElementById('chat-container').style.display = 'block';
    document.getElementById('room-id').disabled = true;
}

async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value;
    if (!message || !otrSession) return;
    
    await otrSession.sendMessage(message);
    input.value = '';
}