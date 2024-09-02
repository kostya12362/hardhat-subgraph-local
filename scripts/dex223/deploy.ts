import path from "path";
import fs from "fs";

import {ContractFactory, Contract, BaseContract} from "ethers";

import { ethers, run } from "hardhat";
import { DeployHelper } from "../helpers/DeployHelper";
import { setupTokens } from "./deployTokens";
import WETH9 from "./WETH9.json";
// import ERC223Quoter from "../../deployments/localhost/dex223/Quoter/result.json";

const contractPath = path.join(__dirname, "../dex223/artifacts");

const artifacts = {
  // Factory: require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json"),
  PoolLibrary: require("../../artifacts/contracts/core/Dex223PoolLib.sol/Dex223PoolLib.json"),
  Factory: require("../../artifacts/contracts/core/Dex223Factory.sol/Dex223Factory.json"),
  PoolAddressHelper: require("../../artifacts/contracts/core/Dex223Factory.sol/PoolAddressHelper.json"),
  PoolAddress: require("../../artifacts/contracts/periphery/base/PoolAddress.sol/PoolAddress.json"),
  SwapRouter: require("../../artifacts/contracts/periphery/SwapRouter.sol/ERC223SwapRouter.json"),
  TestPoolCallee: require("../../artifacts/contracts/test/TestUniswapV3Callee.sol/TestUniswapV3Callee.json"),
  Quoter: require("../../artifacts/contracts/periphery/lens/Quoter223.sol/ERC223Quoter.json"),
  AutoListRegistry: require("../../artifacts/contracts/core/Autolisting.sol/AutoListingsRegistry.json"),
  AutoListFree: require("../../artifacts/contracts/core/AutolistingFree.sol/Dex223AutoListing.json"),
  AutoListPaid: require("../../artifacts/contracts/core/AutolistingPaying.sol/Dex223AutoListing.json"),
  NFTDescriptor: require("../../artifacts/contracts/periphery/base/NFTDescriptor.sol/NFTDescriptor.json"),
  NonfungibleTokenPositionDescriptor: require("../../artifacts/contracts/periphery/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json"),
  WETH9,
  Convertor: require("../../artifacts/contracts/TokenStandardConverter/TokenConverter.sol/TokenStandardConverter.json"),
};

const provider = ethers.provider;

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
  const [owner, signer] = await ethers.getSigners();
  const deployHelper = await DeployHelper.initialize(null, true);

  let weth;
  try {
    const WETH9 = require( "../../deployments/localhost/dex223/WETH9/result.json");
    const provider = ethers.provider;
    console.log('Getting deployed WETH');
    weth = new Contract(
        WETH9.contractAddress,
        WETH9.abi,
        provider
    );
  } catch (e) {
    console.log('Deploying new WETH');
    weth = await deployHelper.deployState({
      contractName: "WETH9",
      contractFactory: new ContractFactory(
          artifacts.WETH9.abi,
          artifacts.WETH9.bytecode,
          owner
      ),
    });
  }

  let factory: any;
  try {
    const ah = require("../../deployments/localhost/dex223/AddressHelper/result.json");
    const fact = require("../../deployments/localhost/dex223/Factory/result.json");
    factory = new Contract(
        fact.contractAddress,
        fact.abi,
        provider
    ) as BaseContract
    // console.dir (factory);
  } catch (e) {
    const poolLibrary = await deployHelper.deployState({
      contractName: "PoolLibrary",
      contractFactory: new ContractFactory(
          artifacts.PoolLibrary.abi,
          artifacts.PoolLibrary.bytecode,
          owner
      ),
    });

    /** Token Convertor */
    const converter = await deployHelper.deployState({
      contractName: "TokenConvertor",
      contractFactory: new ContractFactory(
          artifacts.Convertor.abi,
          artifacts.Convertor.bytecode,
          owner
      ),
    });

    factory = await deployHelper.deployState({
      contractName: "Factory",
      contractFactory: new ContractFactory(
          artifacts.Factory.abi,
          artifacts.Factory.bytecode,
          owner
      )
    });

    await factory.connect(owner).set(poolLibrary.target, converter.target);

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
    const fileName = path.join(__dirname, "../../contracts/periphery/base/PoolAddress.sol");
    const line = `    bytes32 internal constant POOL_INIT_CODE_HASH = ${poolHash};`;
    replaceLineInFile(fileName, line, 5);

    // NOTE recompile Edited SOL file
    await run("compile");
  }

  await deployHelper.deployState({
    contractName: "SwapRouter",
    contractFactory: new ContractFactory(
      artifacts.SwapRouter.abi,
      artifacts.SwapRouter.bytecode,
      owner
    ),
    contractArgs: [factory.target, weth.target],
  });

  await deployHelper.deployState({
    contractName: "TestPoolCallee",
    contractFactory: new ContractFactory(
      artifacts.TestPoolCallee.abi,
      artifacts.TestPoolCallee.bytecode,
      owner
    ),
    // contractArgs: [factory.target, weth.target],
  });

  await deployHelper.deployState({
    contractName: "Quoter",
    contractFactory: new ContractFactory(
      artifacts.Quoter.abi,
      artifacts.Quoter.bytecode,
      owner
    ),
    contractArgs: [factory.target, weth.target],
  });

  const alRegistry = await deployHelper.deployState({
    contractName: "AutoListRegistry",
    contractFactory: new ContractFactory(
      artifacts.AutoListRegistry.abi,
      artifacts.AutoListRegistry.bytecode,
      owner
    )
  });

  await deployHelper.deployState({
    contractName: "AutoListFree",
    contractFactory: new ContractFactory(
        // artifacts.AutoListFree.abi,
        // artifacts.AutoListFree.bytecode,
        artifacts.AutoListPaid.abi,
        artifacts.AutoListPaid.bytecode,
        owner
    ),
    contractArgs: [factory.target, alRegistry.target, 'AL free', 'no URL'],
  });
  
  await deployHelper.deployState({
    contractName: "AutoListPaid",
    contractFactory: new ContractFactory(
        artifacts.AutoListPaid.abi,
        artifacts.AutoListPaid.bytecode,
        owner
    ),
    contractArgs: [factory.target, alRegistry.target, 'AL paid', 'no URL'],
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
              start: 1794,
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
