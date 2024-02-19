import fs from "fs";
import path from "path";

import { DeployHelper } from "../helpers/DeployHelper";
import { getContractName, readJsonFile } from "../helpers/utils";

const contractPath = path.join(__dirname, "../artifacts/contracts");
const contractFiles = fs.readdirSync(contractPath);
const subgrapDirPath = path.join(__dirname, "..", "__subgraph__");

const MANAGER = {
  "auto-listing": {
    network: process.env.HARDHAT_NETWORK,
    contracts: {
      autoListing: {
        abi: "autoListing.json",
      },
    },
  },
};

function managerSubgraph(contractsDetailArray: any[]) {
  for (const [subgraphName, subgraphDetails] of Object.entries(MANAGER)) {
    const abisDirPath = path.join(subgrapDirPath, subgraphName, "abis");
    const configFilePath = path.join(
      subgrapDirPath,
      subgraphName,
      "config.json"
    );

    for (const [contract, value] of Object.entries(subgraphDetails.contracts)) {
      for (const detail of contractsDetailArray) {
        if (path.basename(detail.contractFile, ".sol") == contract) {
          fs.mkdirSync(abisDirPath, {
            recursive: true,
          });
          const outputJson = readJsonFile(
            path.join(
              contractPath,
              detail.contractFile,
              `${detail.contractName}.json`
            )
          );
          fs.writeFileSync(
            path.join(abisDirPath, value.abi),
            JSON.stringify(outputJson.abi, null, 1)
          );
          subgraphDetails.contracts[contract] = {
            ...subgraphDetails.contracts[contract],
            ...{
              address: detail.contractAddress,
              startBlock: detail.startBlock,
              contractName: detail.contractName,
              contractFile: detail.contractFile,
            },
          };
        }
      }
    }
    fs.writeFileSync(configFilePath, JSON.stringify(subgraphDetails, null, 1));
  }
}

async function main() {
  const deployHelper = await DeployHelper.initialize(null, true);
  let reuslt: Object[] = [];
  for (const index in contractFiles) {
    const contractName = getContractName(contractFiles[index]);
    const { contract } = await deployHelper.deployState(contractName);
    const contractDetail = {
      contractFile: contractFiles[index],
      contractName: contractName,
      contractAddress: contract.target,
      startBlock: contract.startBlock,
    };
    reuslt.push(contractDetail);
    managerSubgraph(reuslt);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
