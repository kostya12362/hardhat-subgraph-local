import "@nomicfoundation/hardhat-toolbox";
import "@typechain/hardhat";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";

import { HardhatUserConfig, task } from "hardhat/config";

require("dotenv").config();

const DEFAULT_MNEMONIC =
  "test test test test test test test test test test test junk";
const MNEMONIC = process.env.MNEMONIC || DEFAULT_MNEMONIC;
const INFURA_API_KEY = process.env.INFURA_API_KEY || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY || "";

task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.7.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 100,
          },
        },
      },
    ],
  },

  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
    alwaysGenerateOverloads: false, // should overloads with full signatures like deposit(uint256) be generated always, even if there are no overloads?
    externalArtifacts: ["artifacts/*.json"], // optional array of glob patterns with external artifacts to process (for example external libs from node_modules)
  },
  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  gasReporter: {
    currency: "USD",
    coinmarketcap: COINMARKETCAP_API_KEY,
    token: "ETH",
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      blockGasLimit: 30000000,
      accounts: {
        mnemonic: DEFAULT_MNEMONIC,
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 20,
      },
      chainId: 31337,
    },
    localhost: {
      blockGasLimit: 30000000,
      allowUnlimitedContractSize: true,
      url: "http://0.0.0.0:8545/",
      chainId: 31337,
    },
    sepolia: {
      // url: `https://sepolia.infura.io/v3/${INFURA_API_KEY}`,
      url: "https://rpc2.sepolia.org",
      accounts: {
        mnemonic: MNEMONIC,
      },
    },
  },
};

export default config;
