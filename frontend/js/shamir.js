/**
 * Shamir's Secret Sharing (SSS) - Pure JavaScript Implementation
 * 
 * Why this algorithm?
 * - Information-theoretic security (perfect secrecy)
 * - Threshold property: Any k shares work, k-1 shares give ZERO info
 * - No single point of failure
 * - Mathematically proven (Lagrange interpolation)
 */

class ShamirSSS {
    // Prime number: 2^127 - 1 (Mersenne prime, safe for 128-bit security)
    static PRIME = BigInt('170141183460469231731687303715884105727');
    
    /**
     * Split a secret into n shares, requiring k shares to recover
     * @param {Uint8Array} secret - The secret bytes
     * @param {number} k - Threshold (minimum shares needed)
     * @param {number} n - Total number of shares to generate
     * @returns {Array} Array of {x, y} shares
     */
    static split(secret, k, n) {
        if (k > n) throw new Error('k cannot be greater than n');
        if (secret.length === 0) throw new Error('Secret cannot be empty');
        
        // Convert secret to BigInt
        let secretBigInt = 0n;
        for (let i = 0; i < secret.length; i++) {
            secretBigInt = (secretBigInt << 8n) | BigInt(secret[i]);
        }
        
        // Generate random coefficients for polynomial: f(x) = a0 + a1*x + a2*x^2 + ... + a_{k-1}*x^{k-1}
        // where a0 = secret
        const coeffs = [secretBigInt];
        for (let i = 1; i < k; i++) {
            // Random number between 1 and PRIME-1
            const randomBytes = crypto.getRandomValues(new Uint8Array(32));
            let randomBigInt = 0n;
            for (let j = 0; j < randomBytes.length; j++) {
                randomBigInt = (randomBigInt << 8n) | BigInt(randomBytes[j]);
            }
            coeffs.push((randomBigInt % (this.PRIME - 1n)) + 1n);
        }
        
        // Generate n shares (x = 1 to n)
        const shares = [];
        for (let x = 1; x <= n; x++) {
            const y = this._evaluatePolynomial(coeffs, BigInt(x));
            shares.push({
                x: x,
                y: y.toString(),
                // Store additional metadata for recovery
                k: k,
                n: n
            });
        }
        
        return shares;
    }
    
    /**
     * Evaluate polynomial at given x
     */
    static _evaluatePolynomial(coeffs, x) {
        let result = 0n;
        let xPower = 1n;
        
        for (let i = 0; i < coeffs.length; i++) {
            result = (result + (coeffs[i] * xPower)) % this.PRIME;
            xPower = (xPower * x) % this.PRIME;
        }
        return result;
    }
    
    /**
     * Combine shares to recover the original secret using Lagrange interpolation
     * @param {Array} shares - Array of {x, y} shares (at least k shares)
     * @param {number} k - Threshold
     * @returns {Uint8Array} Recovered secret
     */
    static combine(shares, k) {
        if (shares.length < k) {
            throw new Error(`Need at least ${k} shares, got ${shares.length}`);
        }
        
        // Take first k shares
        const selectedShares = shares.slice(0, k);
        
        // Lagrange interpolation to find f(0)
        let secret = 0n;
        
        for (let i = 0; i < k; i++) {
            const xi = BigInt(selectedShares[i].x);
            const yi = BigInt(selectedShares[i].y);
            
            let numerator = 1n;
            let denominator = 1n;
            
            for (let j = 0; j < k; j++) {
                if (i === j) continue;
                const xj = BigInt(selectedShares[j].x);
                numerator = (numerator * (0n - xj)) % this.PRIME;
                denominator = (denominator * (xi - xj)) % this.PRIME;
            }
            
            // Lagrange coefficient = numerator * inverse(denominator) mod PRIME
            const denominatorInv = this._modInverse(denominator, this.PRIME);
            const lagrangeCoeff = (numerator * denominatorInv) % this.PRIME;
            secret = (secret + (yi * lagrangeCoeff)) % this.PRIME;
        }
        
        // Convert BigInt back to bytes
        // Find the minimal byte length
        let temp = secret;
        let byteLength = 0;
        while (temp > 0n) {
            byteLength++;
            temp >>= 8n;
        }
        if (byteLength === 0) byteLength = 1;
        
        const result = new Uint8Array(byteLength);
        for (let i = byteLength - 1; i >= 0; i--) {
            result[i] = Number(secret & 0xFFn);
            secret >>= 8n;
        }
        
        return result;
    }
    
    /**
     * Modular inverse using Extended Euclidean Algorithm
     */
    static _modInverse(a, m) {
        let [old_r, r] = [a, m];
        let [old_s, s] = [1n, 0n];
        let [old_t, t] = [0n, 1n];
        
        while (r !== 0n) {
            const quotient = old_r / r;
            [old_r, r] = [r, old_r - quotient * r];
            [old_s, s] = [s, old_s - quotient * s];
            [old_t, t] = [t, old_t - quotient * t];
        }
        
        return (old_s % m + m) % m;
    }
    
    /**
     * Encrypt a share for storage (using simple XOR with derived key)
     * In production, use AES-GCM. This is simplified for demo.
     */
    static async encryptShare(share, password) {
        const encoder = new TextEncoder();
        const shareStr = JSON.stringify(share);
        const shareBytes = encoder.encode(shareStr);
        
        // Simple key derivation (in production use PBKDF2)
        const keyBytes = encoder.encode(password.padEnd(32, '0').slice(0, 32));
        
        // XOR encryption (for demo only - use AES in production)
        const encrypted = new Uint8Array(shareBytes.length);
        for (let i = 0; i < shareBytes.length; i++) {
            encrypted[i] = shareBytes[i] ^ keyBytes[i % keyBytes.length];
        }
        
        return btoa(String.fromCharCode(...encrypted));
    }
}

// Make available globally
window.ShamirSSS = ShamirSSS;