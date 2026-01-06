/**
 * Response Signer Service
 * Signs oracle responses using ECDSA
 */

const { ethers } = require('ethers');

class ResponseSigner {
    constructor(wallet) {
        this.wallet = wallet;
    }

    /**
     * Sign a response for submission to the contract
     * @param {BigInt|number} requestId - Request ID
     * @param {number} value - Meter reading value
     * @returns {Promise<string>} Signature
     */
    async signResponse(requestId, value) {
        // Create message hash matching the contract's expected format
        const messageHash = ethers.solidityPackedKeccak256(
            ['uint256', 'uint256'],
            [requestId, value]
        );

        // Sign the message (ethers will prefix with "\x19Ethereum Signed Message:\n32")
        const signature = await this.wallet.signMessage(ethers.getBytes(messageHash));

        return signature;
    }

    /**
     * Verify a signature locally (for testing)
     * @param {BigInt|number} requestId - Request ID
     * @param {number} value - Meter reading value
     * @param {string} signature - Signature to verify
     * @returns {string} Recovered address
     */
    verifySignature(requestId, value, signature) {
        const messageHash = ethers.solidityPackedKeccak256(
            ['uint256', 'uint256'],
            [requestId, value]
        );

        const ethSignedHash = ethers.hashMessage(ethers.getBytes(messageHash));
        const recoveredAddress = ethers.recoverAddress(ethSignedHash, signature);

        return recoveredAddress;
    }

    /**
     * Get the signer's address
     * @returns {string} Wallet address
     */
    getAddress() {
        return this.wallet.address;
    }
}

module.exports = ResponseSigner;


