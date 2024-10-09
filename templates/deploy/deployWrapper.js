const hre = require("hardhat");
const { ethers } = require("hardhat");
const { execSync } = require('child_process');
const deployReport = require('./deployReport');
const inquirer = require('inquirer');
const fs = require('fs');
const dotenv = require('dotenv');

// Function to update the .env file
function updateEnvFile(contractAddress, network) {
  const envFilePath = './.env'; // Path to your .env file
  dotenv.config({ path: envFilePath }); // Load existing env variables

  // Read current .env content
  let envVars = fs.readFileSync(envFilePath, 'utf8');

  // Set or update CONTRACT_ADDRESS and NETWORK_NAME variables
  envVars = envVars.replace(/CONTRACT_ADDRESS=.*/, `CONTRACT_ADDRESS=${contractAddress}`);
  envVars = envVars.replace(/NETWORK_NAME=.*/, `NETWORK_NAME=${network}`);

  // If they don't exist, append them
  if (!/CONTRACT_ADDRESS=/.test(envVars)) {
    envVars += `\nCONTRACT_ADDRESS=${contractAddress}`;
  }
  if (!/NETWORK_NAME=/.test(envVars)) {
    envVars += `\nNETWORK_NAME=${network}`;
  }

  // Write updated env variables back to .env file
  fs.writeFileSync(envFilePath, envVars);

   // Reload the environment variables from .env file
   dotenv.config({ path: envFilePath });
}

async function promptUserForNetwork() {
  const networkChoices = Object.keys(hre.config.networks); // Get available networks from hardhat.config
  const questions = [
    {
      type: 'list',
      name: 'selectedNetwork',
      message: 'Please select a network to deploy to:',
      choices: networkChoices,
    },
  ];

  const answers = await inquirer.prompt(questions);
  return answers.selectedNetwork; // Return the selected network
}

async function runDeploy() {
  try {
    console.log('Cleaning Hardhat artifacts and cache...');
    execSync('npx hardhat clean', { stdio: 'inherit' });

    console.log('Compiling contracts...');
    execSync('npx hardhat compile', { stdio: 'inherit' });

    // Prompt user to select a network
    const selectedNetwork = await promptUserForNetwork(); // Get user-selected network
    console.log(`Selected network: ${selectedNetwork}`);

    // Deploy the contract using the contractDeployer script
    console.log('Deploying contract...');
    const deployCommand = `npx hardhat run ./scripts/deploy.js --network ${selectedNetwork}`;
    const output = execSync(deployCommand, { stdio: 'pipe' }).toString();
    console.log(output); // Output the full log from the deploy script for debugging purposes

    // Extract the deployed contract address from output
    const deployedAddressMatch = output.match(/Contract deployed at address: (0x[a-fA-F0-9]{40})/);
    if (!deployedAddressMatch || deployedAddressMatch.length < 2) {
      throw new Error('Failed to extract deployed contract address from deployContract output.');
    }
    const deployedAddress = deployedAddressMatch[1]; // Extract the deployed address
    console.log(`Contract deployed at: ${deployedAddress}`);

    // Update the .env file with contract address and network
    console.log('Updating .env file...');
    updateEnvFile(deployedAddress, selectedNetwork);

    // Run prebuild with Hardhat
    console.log('Running prebuild script via Hardhat...');
    execSync(`cross-env CONTRACT_ADDRESS=${deployedAddress} npx hardhat run ./scripts/preBuild.js --network ${selectedNetwork}`, { stdio: 'inherit' });

    // Run build
    console.log('Building the project...');
    execSync('react-scripts build', { stdio: 'inherit' });

    // Run postbuild with Hardhat
    console.log('Running postbuild script via Hardhat...');
    execSync(`cross-env CONTRACT_ADDRESS=${deployedAddress} npx hardhat run ./scripts/postBuild.js --network ${selectedNetwork}`, { stdio: 'inherit' });

    
    // Update deployment report
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
