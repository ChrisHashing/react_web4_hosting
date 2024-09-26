require('dotenv').config();
const hre = require("hardhat");
const { ethers } = require("hardhat");
const fs = require('fs'); 
const path = require('path'); 
const axios = require('axios'); 
const FormData = require('form-data');
const deployReport = require('./deployReport');
const contractAddress = process.argv[2] || process.env.CONTRACT_ADDRESS;
const CHUNK_SIZE = 14576; 
const pinataApiKey = process.env.PINATA_API_KEY;
const pinataSecretApiKey = process.env.PINATA_SECRET_API_KEY;
const pinataGateway = process.env.PINATA_GATEWAY;

async function addWebsiteInChunks(contract, path, content, contentType) {
    try {
        console.log(content.length);
        console.log(content);
        const totalChunks = Math.ceil(content.length / CHUNK_SIZE);
        console.log(`Total chunks to upload for ${contentType}: ${totalChunks}`);

        // Get the total chunks already uploaded to compare
        // const existingTotalChunks = await contract.getTotalChunks(path);
        // console.log(existingTotalChunks + "existingTotalChunks");

        for (let i = 0; i < totalChunks; i++) {
            const chunk = content.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);

            // Check if chunk already exists before uploading
            // if (i < existingTotalChunks) {
            //     const [existingChunk, existingContentType] = await contract.getResourceChunk(path, i);
            //     if (existingChunk === chunk && existingContentType === contentType) {
            //         console.log(`Chunk ${i + 1}/${totalChunks} is identical, skipping upload.`);
            //         continue; // Skip if the chunk is already the same
            //     }
            // }

            // console.log(path, chunk, contentType,i);

            function stringToHex(str) {
                return '0x' + Array.from(str)
                  .map(c => c.charCodeAt(0).toString(16).padStart(2, '0'))
                  .join('');
            }
        
            const hexString = stringToHex(chunk);
            console.log(hexString);


            // If chunk is new or modified, upload it
            const tx = await contract.setResourceChunk(path, hexString, contentType,i,0);
            const receipt = await tx.wait();

            // Log progress after each chunk is sent
            console.log(`Chunk ${i + 1}/${totalChunks} of ${contentType} uploaded successfully. Transaction hash: ${receipt.transactionHash}`);
        }

        console.log(`${contentType} added successfully in chunks`);
    } catch (error) {
        console.error(`Error adding ${contentType}:`, error);
    }
}




async function uploadToPinata(filePath) {
    console.log(filePath);
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
    deployReport.addPinataFileSize(fileSize);
    return response.data.IpfsHash;
  } catch (error) {
    console.error(`Error uploading ${filePath} to Pinata:`, error);
    throw error;
  }
}


async function uploadWebsite() {
    console.log(contractAddress);
    
    // Get the contract instance
    const WebsiteContract = await ethers.getContractFactory("BackpackNFT");
    const contract = await WebsiteContract.attach(contractAddress);

    // Read the index.html file
    const indexPath = path.join('build', 'index.html');
    let indexContent = fs.readFileSync(indexPath, 'utf8');

    // Find the CSS and JS file names before replacement
    const cssMatch = indexContent.match(/href="\/static\/css\/([^"]+)"/);
    const jsMatch = indexContent.match(/src="\/static\/js\/([^"]+)"/);

    let cssFileName = cssMatch ? cssMatch[1] : null;
    let jsFileName = jsMatch ? jsMatch[1] : null;

    // Function to replace a specific tag
    function replaceTag(content, regex, replacement) {
        const match = content.match(regex);
        if (match) {
            return content.replace(match[0], replacement);
        }
        return content;
    }

    // Replace the script tag (now accounting for defer attribute)
    indexContent = replaceTag(
        indexContent,
        /<script\s+defer="defer"\s+src="\/static\/js\/[^"]+"><\/script>/,
        `<script defer="defer" src="wttp://${contractAddress}/script.js"></script>`
    );

    // Replace the CSS link
    indexContent = replaceTag(
        indexContent,
        /<link\s+href="\/static\/css\/[^"]+"[^>]*>/,
        `<link href="wttp://${contractAddress}/styles.css" rel="stylesheet">`
    );

    // Write the modified HTML back to the file
    fs.writeFileSync(indexPath, indexContent);

    // Read the content of the files
    const htmlContent = indexContent;
    let cssContent = '';
    let jsContent = '';

    let cssIpfsUrl = {};
    let jsIpfsUrl = {};

    if (cssFileName) {
        try {
            cssContent = fs.readFileSync(path.join('build', 'static', 'css', cssFileName), 'utf8');
            const cssFilePath = path.join('build', 'static', 'css', cssFileName);
            console.log(`CSS file found: ${cssFileName}`);
            const ipfsHash = await uploadToPinata(cssFilePath);
            cssIpfsUrl.link = `${pinataGateway}/ipfs/${ipfsHash}`;
            cssIpfsUrl.type = "text/css";
        } catch (error) {
            console.warn(`Error reading CSS file: ${error.message}`);
        }
    } else {
        console.warn('No CSS file found in index.html');
    }

    if (jsFileName) {
        try {
            jsContent = fs.readFileSync(path.join('build', 'static', 'js', jsFileName), 'utf8');
            const jsFilePath = path.join('build', 'static', 'js', jsFileName);
            console.log(`JS file found: ${jsFileName}`);
            const ipfsHash = await uploadToPinata(jsFilePath);
            jsIpfsUrl.link = `${pinataGateway}/ipfs/${ipfsHash}`;
            jsIpfsUrl.type = "application/javascript";
        } catch (error) {
            console.warn(`Error reading JS file: ${error.message}`);
        }
    } else {
        console.warn('No JS file found in index.html');
    }

    // Upload the files
    await addWebsiteInChunks(contract, "/", htmlContent, "text/html");
    
 
    if (cssIpfsUrl) {
        const data = JSON.stringify(cssIpfsUrl);
        await addWebsiteInChunks(contract, "/styles.css", data, "ipfs");
    }

    if (jsIpfsUrl) {
        const data = JSON.stringify(jsIpfsUrl);
        await addWebsiteInChunks(contract, "/script.js", data, "ipfs");
    }
}

uploadWebsite().then(() => {
  console.log('Website uploaded successfully.');
  process.exit(0);
}).catch((error) => {
  console.error('An error occurred during website upload:', error);
  process.exit(1);
});