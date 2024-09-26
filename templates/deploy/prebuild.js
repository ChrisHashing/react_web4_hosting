require('dotenv').config();
const fs = require('fs');
const path = require('path');
const glob = require('glob');
const axios = require('axios');
const FormData = require('form-data');
const deployReport = require('./deployReport');
const { checkAndCorrectOrder } = require('./codeFormatter');
const { ethers } = require("hardhat");

const pinataApiKey = process.env.PINATA_API_KEY;
const pinataSecretApiKey = process.env.PINATA_SECRET_API_KEY;
const pinataGateway = process.env.PINATA_GATEWAY;
// const pinataGateway = process.env.PINATA_GATEWAY;
// const contractAddress = process.argv[2] || process.env.CONTRACT_ADDRESS;
const contractAddress = process.argv[2] || process.env.CONTRACT_ADDRESS;
const CHUNK_SIZE = 14576; 


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
    deployReport.addPinataFileSize(fileSize);
    return response.data.IpfsHash;
  } catch (error) {
    console.error(`Error uploading ${filePath} to Pinata:`, error);
    throw error;
  }
}

async function addWebsiteInChunks(contract, path, content, contentType) {



  try {
    console.log("Content.length", content.length);
    console.log("content",content);
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

      function stringToHex(str) {
        return '0x' + Array.from(str)
          .map(c => c.charCodeAt(0).toString(16).padStart(2, '0'))
          .join('');
    }

    const hexString = stringToHex(chunk);
    console.log(hexString);
    

      console.log(path);
      console.log(contentType);
      console.log(i);

      const chunkIndex = i; // Use i directly for existing chunks
      console.log(`Uploading chunk ${i + 1}/${totalChunks} with index ${chunkIndex}`);

      // If this is the first chunk, it should be added at index 0
      const tx = await contract.setResourceChunk(path, hexString, contentType, chunkIndex, 0);
      const receipt = await tx.wait();

      // Log progress after each chunk is sent
      console.log(`Chunk ${i + 1}/${totalChunks} of ${contentType} uploaded successfully. Transaction hash: ${receipt.transactionHash}`);
    }

    console.log(`${contentType} added successfully in chunks`);
  } catch (error) {
    console.error(`Error adding ${contentType}:`, error);
  }
}

async function processMatch(variableName, importPath, filePath) {

  const WebsiteContract = await ethers.getContractFactory("BackpackNFT");
  const contract = await WebsiteContract.attach(contractAddress);

  // Ignore CSS files
  if (importPath.endsWith('.css') || importPath.endsWith('.scss') || importPath.endsWith('.sass')) {
    return null;
  }

  if (!importPath.startsWith('http') && !importPath.startsWith('data:')) {
    let absolutePath = path.resolve(path.dirname(filePath), importPath);

    // Check if the file exists, if not, try prepending 'src/'
    if (!fs.existsSync(absolutePath)) {
      absolutePath = path.resolve('src', importPath);
    }

    // Check common asset directories
    const assetDirs = ['assets', 'images', 'media'];
    for (const dir of assetDirs) {
      if (!fs.existsSync(absolutePath)) {
        absolutePath = path.resolve('src', dir, importPath);
        if (fs.existsSync(absolutePath)) break;
      }
    }

    if (fs.existsSync(absolutePath)) {
      const ipfsHash = await uploadToPinata(absolutePath);
      const relativePath = path.relative(path.dirname(filePath), absolutePath);
      const ipfsUrl = `${pinataGateway}/ipfs/${ipfsHash}`;


      // Create the data object
      const data = {
        link: ipfsUrl,
        type: 'image/png' // Replace with the actual file type if needed
      };
      

   
  
      const ext = path.extname(relativePath).toLowerCase();

      let contentType;

      switch (ext) {
        case '.png':
            contentType = 'image/png';
            break;
        case '.jpg':
        case '.jpeg':
            contentType = 'image/jpeg';
            break;
        case '.gif':
            contentType = 'image/gif';
            break;
        case '.svg':
            contentType = 'image/svg+xml';
            break;
        case '.pdf':
            contentType = 'application/pdf';
            break;
        case '.txt':
          contentType = 'text/plain';
        // Add more cases as needed for other file types
        default:
            contentType = 'text/plain'; // Fallback for unknown types
    }

    data.type= contentType;
    const finalData = JSON.stringify(data);

    console.log(relativePath, finalData);
      // Add to the contract
      await addWebsiteInChunks(contract,'/' + relativePath, finalData, "ipfs");

      return `const ${variableName} = "wttp://${contractAddress}/${relativePath}";`;
    }
  }
  return null;
}

async function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const importRegex = /import\s+(\w+)\s+from\s+['"](.+)['"];?/g;
  const constRegex = /const\s+(\w+)\s*=\s*(['"])(.+)\2;?/g;

  let match;
  const replacements = [];

  // Process import statements
  while ((match = importRegex.exec(content)) !== null) {
    const [fullMatch, variableName, importPath] = match;
    const newStatement = await processMatch(variableName, importPath, filePath);
    if (newStatement) {
      replacements.push([fullMatch, newStatement]);
    }
  }

  // Process const assignments
  while ((match = constRegex.exec(content)) !== null) {
    const [fullMatch, variableName, _, constPath] = match;
    const newStatement = await processMatch(variableName, constPath, filePath);
    if (newStatement) {
      replacements.push([fullMatch, newStatement]);
    }
  }

  // Apply replacements
  for (const [oldValue, newValue] of replacements.reverse()) {
    content = content.replace(oldValue, newValue);
  }

  if (replacements.length > 0) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated file: ${filePath}`);
    return true; // Indicate that the file was modified
  }
  return false; // Indicate that the file was not modified
}

async function processDirectory(directory) {
  const files = glob.sync(`${directory}/**/*.{js,jsx,ts,tsx}`);
  for (const file of files) {
    const wasModified = await processFile(file);
    if (wasModified) {
      // Only run the code formatter if the file was modified
      checkAndCorrectOrder(file);
    }
  }
}

async function main() {
  try {
    console.log("Starting prebuild process..."); // A
    await processDirectory('./src');
    console.log('Prebuild process completed successfully.');
  } catch (error) {
    console.error('An error occurred during the prebuild process:', error);
    process.exit(1);
  }
}

main();