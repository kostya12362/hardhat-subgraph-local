import path from "path";

import { ContractFactory } from "ethers";
import { ethers } from "hardhat";

import { DeployHelper } from "../helpers/DeployHelper";
import { saveDeployResults } from "../helpers/utils";
import { setupTokens } from "./deployTokens";
import WETH9 from "./WETH9.json";

const contractPath = path.join(__dirname, "../dex223/artifacts");

const artifacts = {
  Factory: require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json"),
  // Factory: require("../../artifacts/contracts/core/Dex223Factory.sol/UniswapV3Factory.json"),
  SwapRouter: require("@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json"),
  NFTDescriptor: require("@uniswap/v3-periphery/artifacts/contracts/libraries/NFTDescriptor.sol/NFTDescriptor.json"),
  NonfungibleTokenPositionDescriptor: require("@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json"),
  DexaransNonfungiblePositionManager: require("../../artifacts/contracts/NonfungiblePositionManager.sol/DexaransNonfungiblePositionManager.json"),
  WETH9,
};

const linkLibraries = (
  {
    bytecode,
    linkReferences,
  }: {
    bytecode: any;
    linkReferences: {
      [fileName: string]: {
        [contractName: string]: Array<{ start: number; length: number }>;
      };
    };
  },
  libraries: { [libraryName: string]: string }
): string => {
  Object.keys(linkReferences).forEach((fileName) => {
    Object.keys(linkReferences[fileName]).forEach((contractName) => {
      if (!libraries.hasOwnProperty(contractName)) {
        throw new Error(`Missing link library name ${contractName}`);
      }
      const address = ethers
        .getAddress(libraries[contractName])
        .toLowerCase()
        .slice(2);
      linkReferences[fileName][contractName].forEach(({ start, length }) => {
        const start2 = 2 + start * 2;
        const length2 = length * 2;
        bytecode = bytecode
          .slice(0, start2)
          .concat(address)
          .concat(bytecode.slice(start2 + length2, bytecode.length));
      });
    });
  });
  return bytecode;
};

async function main() {
  const [owner] = await ethers.getSigners();
  const deployHelper = await DeployHelper.initialize(null, true);
  const weth = await deployHelper.deployState({
    contractName: "WETH9",
    contractFactory: new ContractFactory(
      artifacts.WETH9.abi,
      artifacts.WETH9.bytecode,
      owner
    ),
  });

  const factory = await deployHelper.deployState({
    contractName: "Factory",
    contractFactory: new ContractFactory(
      artifacts.Factory.abi,
      artifacts.Factory.bytecode,
      owner
    ),
  });
  await deployHelper.deployState({
    contractName: "SwapRouter",
    contractFactory: new ContractFactory(
      artifacts.SwapRouter.abi,
      artifacts.SwapRouter.bytecode,
      owner
    ),
    contractArgs: [factory.target, weth.target],
  });

  const nftDescriptor = await deployHelper.deployState({
    contractName: "NFTDescriptor",
    contractFactory: new ContractFactory(
      artifacts.NFTDescriptor.abi,
      artifacts.NFTDescriptor.bytecode,
      owner
    ),
  });

  const linkedBytecode = linkLibraries(
    {
      bytecode: artifacts.NonfungibleTokenPositionDescriptor.bytecode,
      linkReferences: {
        "NFTDescriptor.sol": {
          NFTDescriptor: [
            {
              length: 20,
              start: 1681,
            },
          ],
        },
      },
    },
    {
      NFTDescriptor: String(nftDescriptor.target),
    }
  );
  await deployHelper.deployState({
    contractName: "NonfungibleTokenPositionDescriptor",
    contractFactory: new ContractFactory(
      artifacts.NonfungibleTokenPositionDescriptor.abi,
      linkedBytecode,
      owner
    ),
    contractArgs: [weth.target, ethers.encodeBytes32String("WETH")],
  });
  await deployHelper.deployState({
    contractName: "DexaransNonfungiblePositionManager",
    contractFactory: new ContractFactory(
      artifacts.DexaransNonfungiblePositionManager.abi,
      artifacts.DexaransNonfungiblePositionManager.bytecode,
      owner
    ),
    contractArgs: [factory.target, weth.target],
  });
  const network = await ethers.provider.getNetwork();
  deployHelper.deploysSave("dex223", contractPath);
  if (network.name == "localhost") {
    console.log(`Start setup tokens network = ${network.name} `);
    await setupTokens();
  }
  console.log("Deploy finished");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
