import fs from "fs";
import path from "path";
import { DeployHelper } from "../helpers/DeployHelper";

const pathOutputJson = path.join(__dirname, "./testnet.json");
const contractPath = path.join(__dirname, "../artifacts/contracts");
const contractFiles = fs.readdirSync(contractPath);
const contractNamesBeta = contractFiles.map((file) =>
  path.basename(file, ".json")
);

console.log(`Доступные контракты: ${contractNamesBeta}`);
// contractNames.forEach((contract) => {
//   console.log(`Доступные контракты: ${contract}`);
// });

const contractNames = ["Autolisting"];

async function main() {
  const deployHelper = await DeployHelper.initialize(null, true);
  for (const index in contractNames) {
    const contractName = contractNames[index];
    const { contract } = await deployHelper.deployState(contractName);
    console.log(`Deployed ${contractName} to: ${contract.address}`);
    const outputJson = {
      contractAddress: contract.target,
      startBlock: contract.startBlock,
      network: process.env.HARDHAT_NETWORK,
    };
    if (process.env.HARDHAT_NETWORK === "localhost") {
      fs.writeFileSync(pathOutputJson, JSON.stringify(outputJson, null, 1));
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
