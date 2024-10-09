require('dotenv').config();
const { ethers } = require("hardhat");
const deployReport = require('../deploy/deployReport');

async function main() {
    // Get the network configuration
    const networkConfig = hre.network.config;
    console.log(`Selected Network: ${hre.network.name}`);
    console.log(`Network URL: ${networkConfig.url}`);

    // Address of the deployed BackpackFactory contract
    const factoryAddress = "0x02B2D7FFa3153226fD30043B244CdB4fF8B426A1"; // Replace with the actual deployed address
    console.log(`Using BackpackFactory at address: ${factoryAddress}`);

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
            console.log(`Log parsed: ${JSON.stringify(parsedLog)}`);
            if (parsedLog.name === 'WCTDeployed') {
                deployedAddress = parsedLog.args[0];  // Get the address from the event args
                console.log('Contract deployed at:', deployedAddress);
                break;  // Exit the loop once we find the event
            }
        } catch (error) {
            console.error('Error parsing log:', error);
            continue; // Continue if the log can't be parsed
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
