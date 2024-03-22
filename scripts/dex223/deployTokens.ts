import path from "path";

import { ethers } from "hardhat";
import {BaseContract, Contract, ContractFactory} from "ethers";

import { DeployHelper } from "../helpers/DeployHelper";
import USDT from "../../deployments/localhost/dex223/tokens/Tether/result.json";
import {ERC20Token} from "../../typechain-types";

const contractPath = path.join(__dirname, "../dex223/artifacts");

const artifacts = {
  tether: require("../../artifacts/contracts/TestTokens/Tether.sol/Tether.json"),
  usdc: require("../../artifacts/contracts/TestTokens/Usdcoin.sol/UsdCoin.json"),
  wbtc: require("../../artifacts/contracts/TestTokens/WrappedBitcoin.sol/WrappedBitcoin.json"),
  TestHybridC: require("../../artifacts/contracts/TestTokens/TestHybridC.sol/ERC223Token.json"),
  TestHybridD: require("../../artifacts/contracts/TestTokens/TestHybridD.sol/ERC223Token.json"),
};

export async function setupTokens() {
  const deployHelper = await DeployHelper.initialize(null, true);
  const [owner, signer2] = await ethers.getSigners();

  await deployHelper.deployState({
    contractName: "Tether",
    contractFactory: new ContractFactory(
      artifacts.tether.abi,
      artifacts.tether.bytecode,
      owner
    ),
  });

  await deployHelper.deployState({
    contractName: "USDC",
    contractFactory: new ContractFactory(
      artifacts.usdc.abi,
      artifacts.usdc.bytecode,
      owner
    ),
  });

  await deployHelper.deployState({
    contractName: "testTestHybridC",
    contractFactory: new ContractFactory(
      artifacts.TestHybridC.abi,
      artifacts.TestHybridC.bytecode,
      owner
    ),
  });

  await deployHelper.deployState({
    contractName: "testTestHybridD",
    contractFactory: new ContractFactory(
      artifacts.TestHybridD.abi,
      artifacts.TestHybridD.bytecode,
      owner
    ),
  });

  for (const i in deployHelper.cacheContract) {
    const contract = deployHelper.cacheContract[i];
    await contract
      .connect(owner)
      .mint(signer2.address, ethers.parseEther("100000"));
  }

  const WETH9 = require( "../../deployments/localhost/dex223/WETH9/result.json");

  const provider = ethers.provider;
  let weth = new Contract(
      WETH9.contractAddress,
      WETH9.abi,
      provider
  );

  const balance = await weth.connect(signer2).balanceOf(signer2.address);
  if (!balance) {
    await weth.connect(signer2).deposit({value: ethers.parseEther("3000")});
  } else {
    console.log(`Already have ${balance} WETH`);
  }

  await deployHelper.deploysSave("dex223/tokens", contractPath);
}
