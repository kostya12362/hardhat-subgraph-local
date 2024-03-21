import { ethers } from "hardhat";
import { BaseContract, Contract } from "ethers";

import { deployPool, encodePriceSqrt } from "./createPool";
import { addLiquidity } from "./addLiquidity";
import { ERC20Token, IERC223 } from "../../typechain-types";

import USDT from "../../deployments/localhost/dex223/tokens/Tether/result.json";
import USDC from "../../deployments/localhost/dex223/tokens/USDC/result.json";
import TEST_HYBRID_ERC223_C from "../../deployments/localhost/dex223/tokens/testTestHybridC/result.json";
import TEST_HYBRID_ERC223_D from "../../deployments/localhost/dex223/tokens/testTestHybridD/result.json";
import WETH9 from "../../deployments/localhost/dex223/WETH9/result.json";

const provider = ethers.provider;

async function main() {
  let usdt = new Contract(
    USDT.contractAddress,
    USDT.abi,
    provider
  ) as BaseContract as ERC20Token;
  let usdc = new Contract(
    USDC.contractAddress,
    USDC.abi,
    provider
  ) as BaseContract as ERC20Token;

  let testERC223_C = new Contract(
    TEST_HYBRID_ERC223_C.contractAddress,
    TEST_HYBRID_ERC223_C.abi,
    provider
  ) as BaseContract as IERC223;

  let testERC223_D = new Contract(
    TEST_HYBRID_ERC223_D.contractAddress,
    TEST_HYBRID_ERC223_D.abi,
    provider
  ) as BaseContract as IERC223;

  let weth = new Contract(
    WETH9.contractAddress,
    WETH9.abi,
    provider
  ) as BaseContract as ERC20Token;

  /** usdt-usdc pool */
  let wethPair1 = weth;
  let wethPair2 = usdc;
  let wethReserve1 = 1n;
  let wethReserve2 = 3500n;
  if (wethPair1.target > wethPair2.target) {
    console.log("Warning: Swapping weth and usdc");
    const temp = wethPair2;
    wethPair2 = wethPair1;
    wethPair1 = temp;
    wethReserve1 = 3500n;
    wethReserve2 = 1n;
  }

  const wethUsdc500 = await deployPool(
    String(wethPair1.target),
    String(wethPair2.target),
    500,
    encodePriceSqrt(wethReserve1, wethReserve2)
  );

  /** weth-usdc pool */
  if (usdt.target > usdc.target) {
    console.log("Warning: Swapping usdc and usdt");
    const temp = usdc;
    usdc = usdt;
    usdt = temp;
  }

  const usdtUsdc500 = await deployPool(
    String(usdt.target),
    String(usdc.target),
    500,
    encodePriceSqrt(1n, 1n)
  );

  /** ERC223_C-ERC223_D pool */
  if (testERC223_C.target > testERC223_D.target) {
    console.log("Warning: Swapping testERC223_C and testERC223_D");
    const temp = testERC223_D;
    testERC223_D = testERC223_C;
    testERC223_C = temp;
  }

  const erc223_c_erc20_d = await deployPool(
    String(testERC223_C.target),
    String(testERC223_D.target),
    500,
    encodePriceSqrt(1n, 1n)
  );
  console.log(`Pool: ERC223_C and ERC223_D = ${erc223_c_erc20_d}`);
  console.log(`Pool: USDT and USDC = ${usdtUsdc500}`);
  console.log(`Pool: WETH and USDC = ${wethUsdc500}`);

  await addLiquidity(wethUsdc500, wethPair1, wethPair2, "ERC20");
  await addLiquidity(usdtUsdc500, usdt, usdc, "ERC20");
  await addLiquidity(erc223_c_erc20_d, testERC223_C, testERC223_D, "ERC223");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
