require('dotenv').config();
const fs = require('fs'); 
const path = require('path'); 
const { uploadToPinata, addWebsiteInChunks , getContractInstance } = require('./uploadUtils'); // Import the functions
const deployReport = require('../deploy/deployReport');


const pinataGateway = process.env.PINATA_GATEWAY;
const contractAddress = process.env.CONTRACT_ADDRESS;
const networkName = process.env.NETWORK_NAME;

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

async function uploadWebsite() {
    console.log(contractAddress);
    
    // Get the contract instance using the wrapper function
    const contract = await getContractInstance(contractAddress);

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

    const chain = getChainName(networkName)

    // Replace the script tag (now accounting for defer attribute)
    indexContent = replaceTag(
        indexContent,
        /<script\s+defer="defer"\s+src="\/static\/js\/[^"]+"><\/script>/,
        `<script defer="defer" src="wttp://${contractAddress}/script.js/?chain=${chain}"></script>`
    );

    // Replace the CSS link
    indexContent = replaceTag(
        indexContent,
        /<link\s+href="\/static\/css\/[^"]+"[^>]*>/,
        `<link href="wttp://${contractAddress}/styles.css/?chain=${chain}" rel="stylesheet">`
    );

    // Write the modified HTML back to the file
    fs.writeFileSync(indexPath, indexContent);

    let cssIpfsUrl = {};
    let jsIpfsUrl = {};

    if (cssFileName) {
        try {
            const cssFilePath = path.join('build', 'static', 'css', cssFileName);
            console.log(`CSS file found: ${cssFileName}`);
            const ipfsHash = await uploadToPinata(cssFilePath); // Use the imported function
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
            const jsFilePath = path.join('build', 'static', 'js', jsFileName);
            console.log(`JS file found: ${jsFileName}`);
            const ipfsHash = await uploadToPinata(jsFilePath); // Use the imported function
            jsIpfsUrl.link = `${pinataGateway}/ipfs/${ipfsHash}`;
            jsIpfsUrl.type = "application/javascript";
        } catch (error) {
            console.warn(`Error reading JS file: ${error.message}`);
        }
    } else {
        console.warn('No JS file found in index.html');
    }

    // Upload the files
    await addWebsiteInChunks(contract, "/", indexContent, "text/html");
    
    if (cssIpfsUrl.link) {
        const data = JSON.stringify(cssIpfsUrl);
        await addWebsiteInChunks(contract, "/styles.css", data, "ipfs");
    }

    if (jsIpfsUrl.link) {
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