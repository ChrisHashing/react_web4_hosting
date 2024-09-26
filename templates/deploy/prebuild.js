require('dotenv').config();
const fs = require('fs');
const path = require('path');
const glob = require('glob');
const { uploadToPinata, addWebsiteInChunks, getContractInstance, getContentType } = require('./uploadUtils'); // Import the functions
const deployReport = require('./deployReport');
const { checkAndCorrectOrder } = require('./codeFormatter');
const { ethers } = require("hardhat");

const pinataGateway = process.env.PINATA_GATEWAY;
const contractAddress = process.argv[2] || process.env.CONTRACT_ADDRESS;
const CHUNK_SIZE = 14576; 

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
            const ipfsHash = await uploadToPinata(absolutePath); // Use the imported function
            const relativePath = path.relative(path.dirname(filePath), absolutePath);
            const ipfsUrl = `${pinataGateway}/ipfs/${ipfsHash}`;

            // Create the data object
            const data = {
                link: ipfsUrl,
                type: 'image/png' // Replace with the actual file type if needed
            };

            const ext = path.extname(relativePath).toLowerCase();
            const contentType = getContentType(ext); // Use the new function

            data.type = contentType;
            const finalData = JSON.stringify(data);

            console.log(relativePath, finalData);

            function standardizePath(relativePath) {
                // Replace backslashes with forward slashes
                let standardizedPath = relativePath.replace(/\\/g, '/');

                // Replace '..' with a custom notation, e.g., 'parent-dir'
                standardizedPath = standardizedPath.replace(/\.\.\//g, 'parent-dir/');

                return standardizedPath;
            }

            const standardizedRelativePath = standardizePath(relativePath);
            // Add to the contract using the imported function
            await addWebsiteInChunks(contract, '/' + standardizedRelativePath, finalData, "ipfs");

            return `const ${variableName} = "wttp://${contractAddress}/${standardizedRelativePath}";`;
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