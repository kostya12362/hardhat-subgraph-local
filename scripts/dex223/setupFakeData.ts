import { ethers } from "hardhat";
import { BaseContract, Contract } from "ethers";

import { deployPool, encodePriceSqrt, calculateSqrtPriceX96 } from "./createPool";
import { addLiquidity } from "./addLiquidity";
import { makeQuote } from "./makeQuote";
import { ERC20Token, IERC223 } from "../../typechain-types";

import USDT from "../../deployments/localhost/dex223/tokens/Tether/result.json";
import USDC from "../../deployments/localhost/dex223/tokens/USDC/result.json";
import TEST_HYBRID_ERC223_C from "../../deployments/localhost/dex223/tokens/testTestHybridC/result.json";
import TEST_HYBRID_ERC223_D from "../../deployments/localhost/dex223/tokens/testTestHybridD/result.json";
import WETH9 from "../../deployments/localhost/dex223/WETH9/result.json";
import CONVERTER from "../../deployments/localhost/dex223/TokenConvertor/result.json";

const provider = ethers.provider;

async function main() {
  const convertContract = new Contract(
      CONVERTER.contractAddress,
      CONVERTER.abi,
      provider) as BaseContract;

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

  /** weth-usdc pool 500 / 3000 */
  let wethPair1 = weth;
  let wethPair2 = usdc;
  let wethRatio = 3500;
  if (wethPair1.target > wethPair2.target) {
    console.log("Warning: Swapping weth and usdc");
    const temp = wethPair2;
    wethPair2 = wethPair1;
    wethPair1 = temp;
    wethRatio = 1/3500;
  }

  let dec1 = await wethPair1.decimals();
  let dec2 = await wethPair2.decimals();
  let sqrtPrice = calculateSqrtPriceX96(Number(dec1) ,Number(dec2), wethRatio);
  // console.log(`sqrtPrice: ${sqrtPrice}`);

  // TODO add ERC223 addresses
  const [_owner, signer2] = await ethers.getSigners();
  try {
    await convertContract.connect(signer2).createERC223Wrapper(wethPair1.target);
    await convertContract.connect(signer2).createERC223Wrapper(wethPair2.target);
  } catch (e) {
    //
  }
  const wethPair2ERC223 = await convertContract.predictWrapperAddress(wethPair2.target, true);
  const wethPair1ERC223 = await convertContract.predictWrapperAddress(wethPair1.target, true);
  console.log("wethPair1ERC223:", wethPair1ERC223);
  console.log("wethPair2ERC223:", wethPair2ERC223);

  const wethUsdc3000 = await deployPool(
      String(wethPair1.target),
      String(wethPair2.target),
      wethPair1ERC223,
      wethPair2ERC223,
      3000,
      sqrtPrice
  );

  // const wethUsdc3000 = await deployPool(
  //     String(wethPair1.target),
  //     String(wethPair2.target),
  //     3000,
  //     sqrtPrice
  // );

  // /** usdt-usdc pool 500 */
  // if (usdt.target > usdc.target) {
  //   console.log("Warning: Swapping usdc and usdt");
  //   const temp = usdc;
  //   usdc = usdt;
  //   usdt = temp;
  // }
  //
  // dec1 = await usdt.decimals();
  // dec2 = await usdc.decimals();
  // sqrtPrice = calculateSqrtPriceX96(Number(dec1) ,Number(dec2), 1);
  // // console.log(`sqrtPrice: ${sqrtPrice}`);
  //
  // const usdtUsdc500 = await deployPool(
  //     String(usdt.target),
  //     String(usdc.target),
  //     3000,
  //     sqrtPrice
  // );
  //
  // /** ERC223_C-ERC223_D pool */
  // if (testERC223_C.target > testERC223_D.target) {
  //   console.log("Warning: Swapping testERC223_C and testERC223_D");
  //   const temp = testERC223_D;
  //   testERC223_D = testERC223_C;
  //   testERC223_C = temp;
  // }
  //
  // dec1 = await testERC223_C.decimals();
  // dec2 = await testERC223_D.decimals();
  // sqrtPrice = calculateSqrtPriceX96(Number(dec1) ,Number(dec2), 10);
  // // console.log(`sqrtPrice: ${sqrtPrice}`);
  //
  // const erc223_c_erc20_d = await deployPool(
  //     String(testERC223_C.target),
  //     String(testERC223_D.target),
  //     3000,  // 500
  //     sqrtPrice
  // );
  // console.log(`Pool: ERC223_C and ERC223_D = ${erc223_c_erc20_d}`);
  // console.log(`Pool: USDT and USDC = ${usdtUsdc500}`);
  console.log(`Pool: WETH and USDC = ${wethUsdc3000}`);

  // await addLiquidity(wethUsdc500, wethPair1, wethPair2, "ERC20", 2);
  await addLiquidity(wethUsdc3000, wethPair1, wethPair2, "ERC20", 10);
  // await addLiquidity(usdtUsdc500, usdt, usdc, "ERC20",0.002);
  // await addLiquidity(erc223_c_erc20_d, testERC223_C, testERC223_D, "ERC223", 30000);
  await makeQuote(wethPair1, wethPair2, 3000, 10000000000);
  // await makeQuote({target: wethPair1ERC223} as IERC223, wethPair2, 3000, 10000000000);
  // await makeQuote({target: wethPair1ERC223} as IERC223, {target: wethPair2ERC223} as IERC223, 3000, 10000000000);
  // await makeQuote({target: wethPair2ERC223} as IERC223, wethPair1, 3000, 10);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
