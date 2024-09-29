require('dotenv').config();
require("@nomicfoundation/hardhat-ethers");

console.log("POLYGON_RPC_URL:", process.env.POLYGON_RPC_URL);

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.20", // Ensure this matches your contract's Solidity version
  networks: {
    ethereum_mainnet: {
      url: process.env.ETHEREUM_RPC_URL || "",
      accounts: [process.env.PRIVATE_KEY || ""]
    },
    polygon_mainnet: {
      url: process.env.POLYGON_RPC_URL || "",
      accounts: [process.env.PRIVATE_KEY || ""]
    },
    arbitrum: {
      url: process.env.ARBITRUM_RPC_URL || "",
      accounts: [process.env.PRIVATE_KEY || ""]
    },
    blast: {
      url: process.env.BLAST_RPC_URL || "",
      accounts: [process.env.PRIVATE_KEY || ""]
    },
    mantle: {
      url: process.env.MANTLE_RPC_URL || "",
      accounts: [process.env.PRIVATE_KEY || ""]
    },
    optimism: {
      url: process.env.OPTIMISM_RPC_URL || "",
      accounts: [process.env.PRIVATE_KEY || ""]
    },
    zkSync: {
      url: process.env.ZKSYNC_RPC_URL || "",
      accounts: [process.env.PRIVATE_KEY || ""]
    },
    base: {
      url: process.env.BASE_RPC_URL || "",
      accounts: [process.env.PRIVATE_KEY || ""]
    }
  },
  defaultNetwork: "polygon_mainnet" // Set to the network you prefer as default
};
