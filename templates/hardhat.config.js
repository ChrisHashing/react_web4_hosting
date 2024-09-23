require('dotenv').config();
require("@nomicfoundation/hardhat-ethers");


console.log("POLYGON_RPC_URL:", process.env.POLYGON_RPC_URL);

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.27", // Update this to match your contract's Solidity version
  networks: {
    ethereum_mainnet: {
      url: process.env.ETHEREUM_RPC_URL || "",
      accounts: [process.env.PRIVATE_KEY || ""]
    },
    polygon_mainnet: {
      url: process.env.POLYGON_RPC_URL || "",
      accounts: [process.env.PRIVATE_KEY || ""]
    }
  },
  defaultNetwork: "polygon_mainnet"  // or "polygon_mainnet" if that's your intention
};
