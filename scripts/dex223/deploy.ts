import path from "path";
import fs from "fs";

import { ContractFactory, Contract } from "ethers";

import { ethers, run } from "hardhat";
import { DeployHelper } from "../helpers/DeployHelper";
import { setupTokens } from "./deployTokens";
import WETH9 from "./WETH9.json";

const contractPath = path.join(__dirname, "../dex223/artifacts");

const artifacts = {
  // Factory: require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json"),
  Factory: require("../../artifacts/contracts/core/Dex223Factory.sol/UniswapV3Factory.json"),
  PoolAddressHelper: require("../../artifacts/contracts/core/Dex223Factory.sol/PoolAddressHelper.json"),
  PoolAddress: require("../../artifacts/contracts/periphery/libraries/PoolAddress.sol/PoolAddress.json"),
  SwapRouter: require("../../artifacts/contracts/periphery/SwapRouter.sol/SwapRouter.json"),
  NFTDescriptor: require("../../artifacts/contracts/periphery/libraries/NFTDescriptor.sol/NFTDescriptor.json"),
  NonfungibleTokenPositionDescriptor: require("../../artifacts/contracts/periphery/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json"),
  WETH9,
  Convertor: require("../../artifacts/contracts/TokenStandardConverter/TokenConverter.sol/TokenStandardConverter.json"),
};

async function getPoolHashCode(signer: any, contract: Contract ) {
  const code = await contract
      .connect(signer)
      .getPoolCreationCode();

  return contract
      .connect(signer)
      .hashPoolCode(code);
}

function replaceLineInFile(filename: string, line: string, position: number) {
  const fileText = fs.readFileSync(filename, { encoding: 'utf8', flag: 'r' });
  const array = fileText.split('\n');
  array[position] = line;
  const out = array.join('\n');
  fs.writeFileSync(filename, out);
}

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

  const addressHelper = await deployHelper.deployState({
    contractName: "AddressHelper",
    contractFactory: new ContractFactory(
      artifacts.PoolAddressHelper.abi,
      artifacts.PoolAddressHelper.bytecode,
      owner
    ),
  });

  // get pool hash from contract
  const poolHash = await getPoolHashCode(owner, addressHelper);
  console.log(`PoolHash: ${poolHash}`);

  // edit pool hash in PoolAddress.sol
  const fileName = path.join(__dirname, "../../contracts/periphery/libraries/PoolAddress.sol");
  const line = `    bytes32 internal constant POOL_INIT_CODE_HASH = ${poolHash};`;
  replaceLineInFile(fileName, line, 5);

  // NOTE recompile Edited SOL file
  await run("compile");

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
              start: 1640,
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

  /** NonfungiblePositionManager */
  const DexaransNonfungiblePositionManager = require("../../artifacts/contracts/periphery/NonfungiblePositionManager.sol/DexaransNonfungiblePositionManager.json");
  await deployHelper.deployState({
    contractName: "DexaransNonfungiblePositionManager",
    contractFactory: new ContractFactory(
      DexaransNonfungiblePositionManager.abi,
      DexaransNonfungiblePositionManager.bytecode,
      owner
    ),
    contractArgs: [factory.target, weth.target],
  });

  /** Token Convertor */
  await deployHelper.deployState({
    contractName: "TokenConvertor",
    contractFactory: new ContractFactory(
      artifacts.Convertor.abi,
        artifacts.Convertor.bytecode,
      owner
    ),
  });

  const network = await ethers.provider.getNetwork();
  await deployHelper.deploysSave("dex223", contractPath);
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
