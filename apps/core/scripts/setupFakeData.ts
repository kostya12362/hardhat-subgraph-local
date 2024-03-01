// import path from "path";
import { ethers } from "hardhat";
import fs from "fs/promises";
import path from "path";

// const subgrapDirPath = path.join(__dirname, "..", "__subgraph__");
const roootDir = path.join(__dirname, "..", "__results__");
// Асинхронная функция для извлечения данных из файлов results.json и ABI файлов
async function extractContractData(resultsPath = roootDir) {
  try {
    const contractsData = [];
    const contractDirs = await fs.readdir(resultsPath);

    for (const dir of contractDirs) {
      const contractPath = path.join(resultsPath, dir);
      const contractStats = await fs.stat(contractPath);

      if (contractStats.isDirectory()) {
        const resultsFilePath = path.join(contractPath, "result.json");
        const abiFilePath = path.join(contractPath, `${dir}.json`); // Предполагается, что имя ABI файла совпадает с именем папки

        // Проверяем, существуют ли файлы results.json и ABI
        try {
          const [resultsFileContent, abiFileContent] = await Promise.all([
            fs.readFile(resultsFilePath, "utf8"),
            fs.readFile(abiFilePath, "utf8"),
          ]);

          // Десериализуем содержимое файлов
          const resultsData = JSON.parse(resultsFileContent);
          const abiData = JSON.parse(abiFileContent);

          // Добавляем собранные данные в массив
          contractsData.push({
            contractName: dir,
            results: resultsData,
            abi: abiData,
          });
        } catch (err) {
          if (err instanceof Error) {
            console.error(
              `Error reading files for contract ${dir}: ${err.message}`
            );
          }
        }
      }
    }

    return contractsData;
  } catch (err) {
    if (err instanceof Error) {
      console.error(`Error extracting contract data: ${err.message}`);
      throw err;
    }
  }
}

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
  const contractsData = await extractContractData();
  for (let i in contractsData) {
    console.log(i);
  }
  // const MANAGER = {
  // for (const subgraphName of Object.keys(MANAGER)) {
  //   const configPath = path.join(subgrapDirPath, subgraphName, "config.json");
  //   const config: any = JSON.parse(fs.readFileSync(configPath, "utf8"));
  //   for (const detail of Object.values(config.contracts)) {
  //     if (detail.contractFile == "autoListing.sol") {
  //       console.log("Auto listing contract found");
  //       await autoListingAdd(detail);
  //     }
  //   }
  // }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
