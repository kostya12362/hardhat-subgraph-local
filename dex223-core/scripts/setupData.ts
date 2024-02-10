import { ethers } from "hardhat";

async function main() {
  const deployedContractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3"; // Реальный адрес контракта

  const AutoListing = await ethers.getContractFactory("Autolisting");
  const autoListing = await AutoListing.attach(deployedContractAddress);

  // Генерация случайных адресов
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

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
