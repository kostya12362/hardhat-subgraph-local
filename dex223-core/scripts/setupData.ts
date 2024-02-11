import path from "path";
import { ethers } from "hardhat";
import { MANAGER } from "../helpers/utils";
import fs from "fs";

const subgrapDirPath = path.join(__dirname, "__subgraph__");

async function autoListingAdd(detail: any) {
  console.log(`Contract name: ${detail.contractName}`);
  const AutoListingFactory = await ethers.getContractFactory(
    detail.contractName
  );
  const autoListing = AutoListingFactory.attach(detail.address);
  let pairsToAdd = [];
  for (let i = 0; i < 5; i++) {
    // Генерация 5 адресов
    const wallet = ethers.Wallet.createRandom();
    const randomAddress = wallet.address;
    console.log(`Random address: ${randomAddress}`);
    pairsToAdd.push(randomAddress);
  }

  // Вызов функции контракта
  await autoListing.addPairs(pairsToAdd);
  console.log(`Pairs added: ${pairsToAdd}`);
}

async function main() {
  for (const subgraphName of Object.keys(MANAGER)) {
    const configPath = path.join(subgrapDirPath, subgraphName, "config.json");
    const config: any = JSON.parse(fs.readFileSync(configPath, "utf8"));
    for (const detail of Object.values(config.contracts)) {
      if (detail.contractFile == "autoListing.sol") {
        console.log("Auto listing contract found");
        await autoListingAdd(detail);
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
