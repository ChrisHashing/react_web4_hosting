const hre = require("hardhat");
const { ethers } = require("hardhat"); // Add this line
const { execSync } = require('child_process');
const deployReport = require('./deployReport');
require('dotenv').config();

async function runDeploy() {
  try {
    console.log('Cleaning Hardhat artifacts and cache...');
    execSync('npx hardhat clean', { stdio: 'inherit' });

    console.log('Compiling contracts...');
    execSync('npx hardhat compile', { stdio: 'inherit' });

    console.log('Starting deployment process...');
    
    // Get the network
    const network = await ethers.provider.getNetwork();
    console.log(`Deploying to network: ${network.name} (chainId: ${network.chainId})`);

    // Get the deployer account
    const [deployer] = await hre.ethers.getSigners();
    
    // Check initial balance
    const initialBalance = await ethers.provider.getBalance(deployer.address);
    console.log('Initial balance:', ethers.formatEther(initialBalance), 'MATIC');

    // Get the BackpackFactory contract instance
    const BackpackFactory = await hre.ethers.getContractAt("BackpackFactory", "0x02B2D7FFa3153226fD30043B244CdB4fF8B426A1");

    const tx = await BackpackFactory.deployWCT(); // Call the deployWCT function

    const receipt = await tx.wait(); // Wait for the transaction to be mined

    console.log("Transaction mined, looking for WCTDeployed event...", receipt.logs);

    // Loop through logs to find the WCTDeployed event
    let deployedAddress = '';
    for (const log of receipt.logs) {
      try {
        const parsedLog = BackpackFactory.interface.parseLog(log);
        
        // Check if the event is the WCTDeployed event
        if (parsedLog.name === 'WCTDeployed') {
          deployedAddress = parsedLog.args[0];  // Get the address from the event args
          console.log('Contract deployed at:', deployedAddress);
          break;  // Exit the loop once we find the event
        }
      } catch (error) {
        // Continue if the log can't be parsed
        continue;
      }
    }

    if (!deployedAddress) {
      console.error('No WCTDeployed event found in the logs.');
    }

    // Use the deployedAddress for further processing
    const contract = await hre.ethers.getContractAt("BackpackNFT", deployedAddress); // Ensure this matches the contract name

    // Run prebuild
    console.log('Running prebuild...');
    execSync(`node deploy/preBuild.js "${deployedAddress}"`, { stdio: 'inherit' });
    
    // Run build
    console.log('Building the project...');
    execSync('react-scripts build', { stdio: 'inherit' });
    
    // Run postbuild
    console.log('Running postbuild...');
    execSync(`node deploy/postBuild.js "${deployedAddress}"`, { stdio: 'inherit' });

    // Check final balance
    const finalBalance = await ethers.provider.getBalance(deployer.address);
    console.log('Final balance:', ethers.formatEther(finalBalance), 'MATIC');

    // Calculate total cost
    const totalCost = initialBalance.sub(finalBalance); // Use BigNumber subtraction
    console.log('Total deployment cost:', ethers.formatEther(totalCost), 'MATIC');

    // Update deployment report
    deployReport.setDeploymentCost(ethers.formatEther(totalCost));
    deployReport.setContractAddress(deployedAddress);
    
    // Generate and save the report
    await deployReport.generateReport();
    
    console.log('Deployment process completed successfully.');
  } catch (error) {
    console.error('An error occurred during the deployment process:', error);
    process.exit(1);
  }
}

// Run the deployment
runDeploy().catch((error) => {
  console.error(error);
  process.exit(1);
});