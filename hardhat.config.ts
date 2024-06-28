import "@nomicfoundation/hardhat-toolbox";
// import "@typechain/hardhat";
// import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
// import "@nomicfoundation/hardhat-toolbox";

import { HardhatUserConfig, task } from "hardhat/config";
import fs from "fs";
import path from "path";

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

async function makeDirIfNotExists(directory: any) {
  await new Promise<void>((resolve) => {
    fs.access(directory, function(err) {
      if (err && err.code === 'ENOENT') {
        fs.mkdirSync(directory, {recursive: true});
      }
      resolve();
    });
  })
}

task("solidity-json", "Extract Standard Solidity Input JSON", async (taskArgs, hre) => {
  console.log("solidity-json task");
  const pathA = await hre.artifacts.getArtifactPaths();
  console.log(pathA);
  const names = await hre.artifacts.getAllFullyQualifiedNames();
  console.dir(names);
  const baseDir = "./artifacts/solidity-json";

  const handled: any[] = [];

  for (const name of names) {

    const [fileName] = name.split(':');

    // skip, if non-local file
    if (!fs.existsSync(path.join("./", fileName))) {
      continue;
    }

    // only one output per file
    if (handled.find(x => x === fileName)) {
      continue;
    }
    handled.push(fileName);

    const buildInfo = await hre.artifacts.getBuildInfo(name);
    const artifactStdJson = JSON.stringify(buildInfo?.input,null, 4);

    const fullFileName = path.join(baseDir, fileName + ".json");
    const directoryName = path.dirname(fullFileName);

    console.log("> Extracting standard Solidity Input JSON for", fileName);

    await makeDirIfNotExists(directoryName);
    fs.writeFileSync(fullFileName, artifactStdJson);
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
            runs: 2000,
          },
        },
      },
    ],
    overrides: {
      "contracts/ico/ico.sol": {
        version: "0.8.19",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          }
        }
      },
      "contracts/TokenStandardConverter/TokenConverter.sol": {
        version: "0.8.19",
        settings: {
          optimizer: {
            enabled: true,
            runs: 2000,
          }
        }
      },
      "contracts/periphery/NonfungiblePositionManager.sol": {
        version: "0.7.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 5000,
          }
        }
      },
      "contracts/periphery/SwapRouter.sol": {
        version: "0.7.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 5000,
          }
        }
      },
      "contracts/TokenStandardConverter/ERC165.sol": {
        version: "0.8.19",
        settings: {
          optimizer: {
            enabled: true,
            runs: 2000,
          }
        }
      },
      "contracts/TokenStandardConverter/Address.sol": {
        version: "0.8.19",
        settings: {
          optimizer: {
            enabled: true,
            runs: 2000,
          }
        }
      },
      "contracts/TokenStandardConverter/IERC165.sol": {
        version: "0.8.19",
        settings: {
          optimizer: {
            enabled: true,
            runs: 2000,
          }
        }
      },
      "contracts/TokenStandardConverter/IERC223.sol": {
        version: "0.8.19",
        settings: {
          optimizer: {
            enabled: true,
            runs: 2000,
          }
        }
      },
      "contracts/TokenStandardConverter/IERC223Recipient.sol": {
        version: "0.8.19",
        settings: {
          optimizer: {
            enabled: true,
            runs: 2000,
          }
        }
      }
    }
  },

  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",

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
