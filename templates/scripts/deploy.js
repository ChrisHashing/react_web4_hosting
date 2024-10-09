require('dotenv').config();
const { ethers } = require("hardhat");
const deployReport = require('../deploy/deployReport');

// Helper function to handle BigInt serialization
function bigintReplacer(key, value) {
    return typeof value === 'bigint' ? value.toString() : value;
}

async function main() {

    const factoryAddresses = {
        ethereum_mainnet: "0xMAINNET_FACTORY_ADDRESS", // Replace with actual Mainnet address
        arbitrum: "0x2638E725Ce330A70880446CE5FE2E6C6173BCe9B", // Replace with actual Rinkeby address
        ropsten: "0xROPSTEN_FACTORY_ADDRESS", // Replace with actual Ropsten address
        polygon_mainnet: "0x02B2D7FFa3153226fD30043B244CdB4fF8B426A1", // Replace with actual Polygon address
        localhost: "0xLOCALHOST_FACTORY_ADDRESS", // Replace with actual local test network address
        hardhat: "0xHARDHAT_FACTORY_ADDRESS", // For local hardhat network
    };

    // Get the current network from Hardhat Runtime Environment (hre)
    const networkConfig = hre.network.config;
    const networkName = hre.network.name;
    console.log(`Selected Network: ${networkName}`);
    console.log(`Network URL: ${networkConfig.url}`);

    const factoryAddress = factoryAddresses[networkName];

    if (!factoryAddress) {
      console.error(`Error: No factory address found for network ${networkName}. Exiting...`);
      process.exit(1); // Exit with error code 1
    }

    // Get the contract instance for BackpackFactory
    console.log("Getting contract instance for BackpackFactory...");
    const BackpackFactory = await ethers.getContractAt("BackpackFactory", factoryAddress);
    console.log("Contract instance obtained successfully.");

    // Call the deployWCT function on the factory contract
    console.log("Calling deployWCT function on BackpackFactory...");
    const tx = await BackpackFactory.deployWCT(); // Call the deployWCT function
    console.log(`Transaction sent: ${tx.hash}`);

    // Wait for the transaction to be mined
    console.log("Waiting for transaction to be mined...");
    const receipt = await tx.wait();
    console.log(`Transaction mined in block: ${receipt.blockNumber}`);

    let deployedAddress = '';
    console.log("Parsing logs for WCTDeployed event...");

    for (const log of receipt.logs) {
        try {
            const parsedLog = BackpackFactory.interface.parseLog(log);
            console.log(`Log parsed: ${JSON.stringify(parsedLog, bigintReplacer)}`);

            if (parsedLog.name === 'WCTDeployed') {
                deployedAddress = parsedLog.args[0];  // Get the address from the event args
                console.log('Contract deployed at:', deployedAddress);
                break;  // Exit the loop once we find the event
            }
        } catch (error) {
            // Continue without crashing if the log can't be parsed
            console.error('Error parsing log:', error);
        }
    }

    if (!deployedAddress) {
        throw new Error('No WCTDeployed event found in the logs.');
    }

    console.log('Deployment successful. Deployed contract address:', deployedAddress);

    // **This log is crucial for deployWrapper.js to capture the address**
    console.log(`Contract deployed at address: ${deployedAddress}`);

    // Update deployment report
    deployReport.setContractAddress(deployedAddress);
    await deployReport.generateReport();
}

// Execute the main function
main()
    .catch((error) => {
        console.error('An error occurred during the deployment process:', error);
        process.exit(1);
    });
