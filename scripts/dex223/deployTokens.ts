import path from "path";

import { ethers } from "hardhat";
import { ContractFactory } from "ethers";

import { ERC20Token, ERC223Token, IERC223 } from "../../typechain-types";
import { DeployHelper } from "../helpers/DeployHelper";

const contractPath = path.join(__dirname, "../dex223/artifacts");

const artifacts = {
  tether: require("../../artifacts/contracts/TestTokens/Tether.sol/Tether.json"),
  usdc: require("../../artifacts/contracts/TestTokens/Usdcoin.sol/UsdCoin.json"),
  wbtc: require("../../artifacts/contracts/TestTokens/WrappedBitcoin.sol/WrappedBitcoin.json"),
  // testTokenERC20: require("../../artifacts/contracts/TestTokens/TestERC20.sol/ERC20Token.json"),
  // testTokenERC223A: require("../../artifacts/contracts/TestTokens/TestERC223A.sol/ERC223Token.json"),
  // testTokenERC223B: require("../../artifacts/contracts/TestTokens/TestERC223B.sol/ERC223Token.json"),
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
  // await deployHelper.deployState({
  //   contractName: "Test Token ERC20",
  //   contractFactory: new ContractFactory(
  //     artifacts.testTokenERC20.abi,
  //     artifacts.testTokenERC20.bytecode,
  //     owner
  //   ),
  // });

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
  deployHelper.deploysSave("dex223/tokens", contractPath);
}
