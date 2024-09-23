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

    console.log("network.chainId:", network.chainId);
    // Ensure we're on Polygon mainnet
    if (network.chainId !== 137n) {
      throw new Error(`Not deploying to Polygon mainnet. Current network: ${network.name} (chainId: ${network.chainId})`);
    }

    // Get the deployer account
    const [deployer] = await ethers.getSigners();
    
    // Check initial balance
    const initialBalance = await ethers.provider.getBalance(deployer.address);
    console.log('Initial balance:', ethers.formatEther(initialBalance), 'MATIC');

    // Deploy contract using Hardhat
    console.log('Deploying contract...');
    const WebsiteContract = await ethers.getContractFactory("WebsiteContract");
    const contract = await WebsiteContract.deploy();
    await contract.waitForDeployment();

    const newContractAddress = await contract.getAddress();
    console.log('New contract address:', newContractAddress);

    if (!ethers.isAddress(newContractAddress)) {
      throw new Error(`Invalid contract address: ${newContractAddress}`);
    }

    // Update process.env with the new contract address
    // process.env.CONTRACT_ADDRESS = newContractAddress;

    // Run prebuild
    console.log('Running prebuild...');
    execSync(`node prebuild.js "${newContractAddress}"`, { stdio: 'inherit' });
    
    // Run build
    console.log('Building the project...');
    execSync('react-scripts build', { stdio: 'inherit' });
    
    // Run postbuild
    console.log('Running postbuild...');
    execSync(`node hostV3.js "${newContractAddress}"`, { stdio: 'inherit' });

    // Check final balance
    const finalBalance = await ethers.provider.getBalance(deployer.address);
    console.log('Final balance:', ethers.formatEther(finalBalance), 'MATIC');

    // Calculate total cost
    const totalCost = initialBalance - finalBalance;
    console.log('Total deployment cost:', ethers.formatEther(totalCost), 'MATIC');

    // Update deployment report
    deployReport.setDeploymentCost(ethers.formatEther(totalCost));
    deployReport.setContractAddress(newContractAddress);
    
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