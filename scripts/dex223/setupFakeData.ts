import path from "path";

import { ethers } from "hardhat";
import { BaseContract, Contract, ContractFactory } from "ethers";

import { saveDeployResults } from "../helpers/utils";

import { deployPool, encodePriceSqrt } from "./createPool";
import { addLiquidity } from "./addLiquidity";
import { ERC20Token, IERC223 } from "../../typechain-types";

import USDT from "../../deployments/localhost/dex223/tokens/Tether/result.json";
import USDC from "../../deployments/localhost/dex223/tokens/USDC/result.json";
import TEST_HYBRID_ERC223_C from "../../deployments/localhost/dex223/tokens/testTestHybridC/result.json";
import TEST_HYBRID_ERC223_D from "../../deployments/localhost/dex223/tokens/testTestHybridD/result.json";

const provider = ethers.provider;

async function main() {
  const usdt = new Contract(
    USDT.contractAddress,
    USDT.abi,
    provider
  ) as BaseContract as ERC20Token;
  const usdc = new Contract(
    USDC.contractAddress,
    USDC.abi,
    provider
  ) as BaseContract as ERC20Token;

  const testERC223_A = new Contract(
    TEST_HYBRID_ERC223_C.contractAddress,
    TEST_HYBRID_ERC223_C.abi,
    provider
  ) as BaseContract as IERC223;
  const testERC223_B = new Contract(
    TEST_HYBRID_ERC223_D.contractAddress,
    TEST_HYBRID_ERC223_D.abi,
    provider
  ) as BaseContract as IERC223;

  // const usdtUsdc500 = await deployPool(
  //   String(usdt.target),
  //   String(usdc.target),
  //   500,
  //   encodePriceSqrt(1n, 1n)
  // );
  const erc223_a_erc20_b = await deployPool(
    String(testERC223_A.target),
    String(testERC223_B.target),
    500,
    encodePriceSqrt(1n, 1n)
  );
  console.log(`Pool: erc223_c_erc20_d = ${erc223_a_erc20_b}`);
  // console.log(`Pool: USDT_USDC_500=${usdtUsdc500}`);

  // await addLiquidity(usdtUsdc500, usdt, usdc);
  await addLiquidity(erc223_a_erc20_b, testERC223_A, testERC223_B);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
