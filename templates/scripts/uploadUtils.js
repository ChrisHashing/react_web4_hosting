const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const { ethers } = require("hardhat"); // Import ethers if needed
const deployReport = require('../deploy/deployReport'); // Import deployReport if needed

const pinataApiKey = process.env.PINATA_API_KEY;
const pinataSecretApiKey = process.env.PINATA_SECRET_API_KEY;
const CHUNK_SIZE = 14576; // Define the chunk size

async function getContractInstance(contractAddress) {
    const WebsiteContract = await ethers.getContractFactory("BackpackNFT");
    const contract = await WebsiteContract.attach(contractAddress);
    return contract;
}

/**
 * Get the content type based on the file extension.
 * @param {string} ext - The file extension.
 * @returns {string} - The corresponding content type.
 */
function getContentType(ext) {
    switch (ext) {
        case '.png':
            return 'image/png';
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.gif':
            return 'image/gif';
        case '.svg':
            return 'image/svg+xml';
        case '.pdf':
            return 'application/pdf';
        case '.txt':
            return 'text/plain';
        case '.html':
            return 'text/html';
        case '.css':
            return 'text/css';
        case '.js':
            return 'application/javascript';
        case '.woff':
        case '.woff2':
            return 'font/woff';
        case '.ttf':
            return 'font/ttf';
        case '.otf':
            return 'font/otf';
        case '.json':
            return 'application/json';
        case '.xml':
            return 'application/xml';
        default:
            return 'application/octet-stream'; // Fallback for unknown types
    }
}

// Function to upload a file to Pinata
async function uploadToPinata(filePath) {
    const url = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
    const data = new FormData();
    data.append('file', fs.createReadStream(filePath));

    try {
        const response = await axios.post(url, data, {
            maxBodyLength: 'Infinity',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${data._boundary}`,
                'pinata_api_key': pinataApiKey,
                'pinata_secret_api_key': pinataSecretApiKey
            }
        });
        console.log(`File ${filePath} uploaded to Pinata. IPFS hash: ${response.data.IpfsHash}`);
        const fileSize = fs.statSync(filePath).size;
        deployReport.addPinataFileSize(fileSize); // Ensure deployReport is defined
        return response.data.IpfsHash;
    } catch (error) {
        console.error(`Error uploading ${filePath} to Pinata:`, error);
        throw error;
    }
}

// Function to add website content in chunks
async function addWebsiteInChunks(contract, path, content, contentType) {
    try {
        console.log("Content.length", content.length);
        console.log("content", content);
        const totalChunks = Math.ceil(content.length / CHUNK_SIZE);
        console.log(`Total chunks to upload for ${contentType}: ${totalChunks}`);

        for (let i = 0; i < totalChunks; i++) {
            const chunk = content.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);

            function stringToHex(str) {
                return '0x' + Array.from(str)
                  .map(c => c.charCodeAt(0).toString(16).padStart(2, '0'))
                  .join('');
              }
        
              const hexString = stringToHex(chunk);

            console.log(path);
            console.log(contentType);
            console.log(i);

            const chunkIndex = i; // Use i directly for existing chunks
            console.log(`Uploading chunk ${i + 1}/${totalChunks} with index ${chunkIndex}`);

            const tx = await contract.setResourceChunk(path, hexString, contentType, chunkIndex, 0);
            const receipt = await tx.wait();

            console.log(`Chunk ${i + 1}/${totalChunks} of ${contentType} uploaded successfully. Transaction hash: ${receipt.transactionHash}`);
        }

        console.log(`${contentType} added successfully in chunks`);
    } catch (error) {
        console.error(`Error adding ${contentType}:`, error);
    }
}

// Export the functions
module.exports = {
    uploadToPinata,
    addWebsiteInChunks,
    getContractInstance,
    getContentType // Export the new function
};