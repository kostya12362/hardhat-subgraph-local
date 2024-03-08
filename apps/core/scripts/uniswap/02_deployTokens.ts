import fs from "fs";
import { promisify } from "util";
import { ethers } from "hardhat";

async function main() {
  const [owner, signer2] = await ethers.getSigners();

  const Tether = await ethers.getContractFactory("Tether", owner);
  const tether = await Tether.deploy();

  const Usdc = await ethers.getContractFactory("UsdCoin", owner);
  const usdc = await Usdc.deploy();

  const WrappedBitcoin = await ethers.getContractFactory(
    "WrappedBitcoin",
    owner
  );
  const wrappedBitcoin = await WrappedBitcoin.deploy();

  await tether
    .connect(owner)
    .mint(signer2.address, ethers.parseEther("100000"));
  await usdc.connect(owner).mint(signer2.address, ethers.parseEther("100000"));
  await wrappedBitcoin
    .connect(owner)
    .mint(signer2.address, ethers.parseEther("100000"));

  let addresses = [
    `USDC_ADDRESS=${usdc.target}`,
    `TETHER_ADDRESS=${tether.target}`,
    `WRAPPED_BITCOIN_ADDRESS=${wrappedBitcoin.ta}`,
  ];
  const data = "\n" + addresses.join("\n");

  const writeFile = promisify(fs.appendFile);
  const filePath = ".env.addresses";
  return writeFile(filePath, data)
    .then(() => {
      console.log("Addresses recorded.");
    })
    .catch((error) => {
      console.error("Error logging addresses:", error);
      throw error;
    });
}

/*
  npx hardhat run --network localhost scripts/02_deployTokens.js
*/

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
