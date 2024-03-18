import fs from "fs";
import path from "path";
import { ethers } from "hardhat";

import { DeployHelper } from "../helpers/DeployHelper";
import { getSolFolders, saveDeployResults } from "../helpers/utils";

const contractPath = path.join(__dirname, "../artifacts/contracts");
const contractFiles = getSolFolders(contractPath);

async function main() {
  const deployHelper = await DeployHelper.initialize(null, true);
  for (const index in contractFiles) {
    console.log("Deploying contract: ", contractFiles[index]);
    if ("Autolisting".includes(contractFiles[index])) {
      console.log("Skipping Autolisting");
      continue;
    }
    const artifact = contractFiles[index].split("/").slice(-2);
    const contractName = artifact[1].replace(".json", "");
    const contract = await deployHelper.deployState(
      await ethers.getContractFactory(contractName),
      contractName
    );
    const contractDetail = {
      path: contractFiles[index],
      contractFile: artifact[1],
      contractName: contractName,
      abi: contract.abi,
      contractAddress: contract.target,
      startBlock: contract.startBlock,
    };
    saveDeployResults(contractDetail, contractPath);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
