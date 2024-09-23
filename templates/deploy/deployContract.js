const hre = require("hardhat");
const fs = require('fs');
require('dotenv').config();

async function deployContract() {
  try {
    console.log('Deploying contract...');

    // Get the ContractFactory and Signer
    const WebsiteContract = await hre.ethers.getContractFactory("WebsiteContract");
    const [deployer] = await hre.ethers.getSigners();

    // Deploy the contract
    const contract = await WebsiteContract.deploy();
    await contract.waitForDeployment();

    const deployedAddress = await contract.getAddress();
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