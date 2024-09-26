const hre = require("hardhat");
const fs = require('fs');
require('dotenv').config();

async function deployContract() {
  try {
    console.log('Deploying contract...');

    // Get the BackpackFactory contract instance
    const BackpackFactory = await hre.ethers.getContractAt("BackpackFactory", "0xf4B146FbA71F41E0592668ffbF264F1D186b2Ca8");
    const [deployer] = await hre.ethers.getSigners();



    // Deploy a new contract using the deployWCT function
    const tx = await BackpackFactory.deployWCT(); // Call the deployWCT function
    const receipt = await tx.wait(); // Wait for the transaction to be mined

  

    // Get the address of the newly deployed contract
    const deployedAddress = receipt.events[0].args[0]; // Adjust based on the event emitted by deployWCT
    console.log('Contract deployed at:', deployedAddress);

    // Update .env file with the new contract address
    const envContent = fs.readFileSync('.env', 'utf8');
    const updatedEnvContent = envContent.replace(
      /CONTRACT_ADDRESS=.*/,
      `CONTRACT_ADDRESS="${deployedAddress}"`
    );
    fs.writeFileSync('.env', updatedEnvContent);

    console.log('Updated .env file with new contract address');

    // Output only the new contract address as the last line
    console.log(deployedAddress);
    return deployedAddress;
  } catch (error) {
    console.error('Error deploying contract:', error);
    process.exit(1);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
deployContract()
  .then((address) => {
    console.log(address); // Ensure the address is the last thing printed
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });