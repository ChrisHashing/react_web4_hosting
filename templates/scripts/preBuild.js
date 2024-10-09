require('dotenv').config();
const fs = require('fs');
const path = require('path');
const glob = require('glob');
const { uploadToPinata, addWebsiteInChunks, getContentType } = require('./uploadUtils');
const { checkAndCorrectOrder } = require('./codeFormatter');
const { ethers } = require("hardhat");

const pinataGateway = process.env.PINATA_GATEWAY;
const contractAddress = process.env.CONTRACT_ADDRESS;
const networkName = process.env.NETWORK_NAME;
const CHUNK_SIZE = 14576;

function getChainName(chainName) {
    switch (chainName.toLowerCase()) {
        case 'ethereum_mainnet':
            return 'eth';
        case 'polygon_mainnet':
            return 'poly';
        case 'arbitrum':
            return 'arb';
        case 'blast':
            return 'blast';
        case 'mantle':
            return 'mantle';
        case 'optimism':
            return 'optimism';
        case 'zksync':
            return 'zk';
        case 'base':
            return 'base';
        default:
            return 'unknown chain'; // Handle invalid inputs
    }
}

async function processMatch(variableName, importPath, filePath) {
    const WebsiteContract = await ethers.getContractFactory("BackpackNFT");
    const contract = await WebsiteContract.attach(contractAddress);

    // Ignore CSS and related files
    if (importPath.endsWith('.css') || importPath.endsWith('.scss') || importPath.endsWith('.sass')) {
        return null;
    }

    // Handle relative and absolute file paths
    if (!importPath.startsWith('http') && !importPath.startsWith('data:')) {
        let absolutePath = path.resolve(path.dirname(filePath), importPath);

        // Check if file exists, if not, try alternative directories
        if (!fs.existsSync(absolutePath)) {
            absolutePath = path.resolve('src', importPath);
        }

        const assetDirs = ['assets', 'images', 'media'];
        for (const dir of assetDirs) {
            if (!fs.existsSync(absolutePath)) {
                absolutePath = path.resolve('src', dir, importPath);
                if (fs.existsSync(absolutePath)) break;
            }
        }

        // If the file exists, upload to Pinata
        if (fs.existsSync(absolutePath)) {
            const ipfsHash = await uploadToPinata(absolutePath);
            const relativePath = path.relative(path.dirname(filePath), absolutePath);
            const ipfsUrl = `${pinataGateway}/ipfs/${ipfsHash}`;

            // Create data object with content type
            const ext = path.extname(relativePath).toLowerCase();
            const contentType = getContentType(ext);

            const data = {
                link: ipfsUrl,
                type: contentType
            };
            const finalData = JSON.stringify(data);

            console.log(relativePath, finalData);

            // Standardize relative paths for consistent format
            function standardizePath(relativePath) {
                let standardizedPath = relativePath.replace(/\\/g, '/');
                standardizedPath = standardizedPath.replace(/\.\.\//g, 'parent-dir/');
                return standardizedPath;
            }

            const standardizedRelativePath = standardizePath(relativePath);

            // Add the data in chunks to the contract
            await addWebsiteInChunks(contract, '/' + standardizedRelativePath, finalData, "ipfs");

            const chain = getChainName(networkName)

            return `const ${variableName} = "wttp://${contractAddress}/${standardizedRelativePath}/?chain=${chain}";`;
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

    // Process const variable assignments
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

    // If replacements were made, write the file back
    if (replacements.length > 0) {
        fs.writeFileSync(filePath, content);
        console.log(`Updated file: ${filePath}`);
        return true;
    }
    return false;
}

async function processDirectory(directory) {
    const files = glob.sync(`${directory}/**/*.{js,jsx,ts,tsx}`);
    for (const file of files) {
        const wasModified = await processFile(file);
        if (wasModified) {
            checkAndCorrectOrder(file);
        }
    }
}

async function main() {
    try {
        console.log("Starting prebuild process...");
        await processDirectory('./src');
        console.log('Prebuild process completed successfully.');
    } catch (error) {
        console.error('An error occurred during the prebuild process:', error);
        process.exit(1);
    }
}

main();
