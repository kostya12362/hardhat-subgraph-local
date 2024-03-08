import path from "path";

import { ContractFactory } from "ethers";
import { ethers } from "hardhat";

import { DeployHelper } from "../../helpers/DeployHelper";
import { saveDeployResults } from "../../helpers/utils";

import WETH9 from "./WETH9.json";

const contractPath = path.join(__dirname, "../uniswap/v3-core/artifacts");

const artifacts = {
  UniswapV3Factory: require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json"),
  SwapRouter: require("@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json"),
  NFTDescriptor: require("@uniswap/v3-periphery/artifacts/contracts/libraries/NFTDescriptor.sol/NFTDescriptor.json"),
  NonfungibleTokenPositionDescriptor: require("@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json"),
  NonfungiblePositionManager: require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json"),
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
  const weth = await deployHelper.deployState(
    new ContractFactory(artifacts.WETH9.abi, artifacts.WETH9.bytecode, owner),
    "WETH9"
  );

  const factory = await deployHelper.deployState(
    new ContractFactory(
      artifacts.UniswapV3Factory.abi,
      artifacts.UniswapV3Factory.bytecode,
      owner
    ),
    "Factory"
  );
  await deployHelper.deployState(
    new ContractFactory(
      artifacts.SwapRouter.abi,
      artifacts.SwapRouter.bytecode,
      owner
    ),
    "swapRouter",
    factory.target,
    weth.target
  );
  const nftDescriptor = await deployHelper.deployState(
    new ContractFactory(
      artifacts.NFTDescriptor.abi,
      artifacts.NFTDescriptor.bytecode,
      owner
    ),
    "NFTDescriptor"
  );

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

  const nonfungibleTokenPositionDescriptor = await deployHelper.deployState(
    new ContractFactory(
      artifacts.NonfungibleTokenPositionDescriptor.abi,
      linkedBytecode,
      owner
    ),
    "NonfungibleTokenPositio",
    weth.target,
    ethers.encodeBytes32String("WETH")
  );
  await deployHelper.deployState(
    new ContractFactory(
      artifacts.NonfungiblePositionManager.abi,
      artifacts.NonfungiblePositionManager.bytecode,
      owner
    ),
    "NonfungiblePositionManager",
    factory.target,
    weth.target,
    nonfungibleTokenPositionDescriptor.target
  );
  for (const i in deployHelper.cacheContract) {
    const contract = deployHelper.cacheContract[i];
    const contractDetail = {
      contractFile: `uniswap/${contract.contractName}`,
      contractName: contract.contractName,
      contractAddress: contract.target,
      abi: contract.abi,
      startBlock: contract.startBlock,
    };
    await saveDeployResults(contractDetail, contractPath);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
