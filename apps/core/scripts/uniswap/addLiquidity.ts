import { ethers } from "hardhat";
import TETHER from "../../__results__/localhost/mock/Tether/result.json";
import USDC from "../../__results__/localhost/mock/UsdCoin/result.json";
import ERC20_ABI from "../../__results__/localhost/mock/UsdCoin/UsdCoin.json";
import NonfungiblePositionManager from "../../__results__/localhost/uniswap/NonfungiblePositionManager/result.json";
import NonfungiblePositionManagerABI from "../../__results__/localhost/uniswap/NonfungiblePositionManager/NonfungiblePositionManager.json";
import UniswapV3Pool from "@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json";
import { Contract } from "ethers";
import { Token } from "@uniswap/sdk-core";
import { FeeAmount, Pool, Position, nearestUsableTick } from "@uniswap/v3-sdk";
import JSBI from "jsbi";

async function getPoolData(poolContract: Contract) {
  const [tickSpacing, fee, liquidity, slot0] = await Promise.all([
    poolContract.tickSpacing(),
    poolContract.fee(),
    poolContract.liquidity(),
    poolContract.slot0(),
  ]);

  return {
    tickSpacing: tickSpacing,
    fee: fee,
    liquidity: liquidity,
    sqrtPriceX96: slot0[0],
    tick: Number(slot0[1]),
  };
}

export async function addLiquidity(poolAddress: string) {
  const [_owner, signer2] = await ethers.getSigners();
  const provider = ethers.provider;

  const usdtContract = new Contract(
    TETHER.contractAddress,
    ERC20_ABI,
    provider
  );
  const usdcContract = new Contract(USDC.contractAddress, ERC20_ABI, provider);

  await usdtContract
    .connect(signer2)
    .approve(
      NonfungiblePositionManager.contractAddress,
      ethers.parseEther("1000")
    );
  await usdcContract
    .connect(signer2)
    .approve(
      NonfungiblePositionManager.contractAddress,
      ethers.parseEther("1000")
    );

  const poolContract = new Contract(poolAddress, UniswapV3Pool.abi, provider);
  const poolData = await getPoolData(poolContract);
  console.log(poolData);
  // console.log(poolData, poolContract.target);
  // let fee = Number(BigInt(poolData.fee).toString());  // if (tick < -887272 || tick > 887272) {
  //   throw new Error(`Tick value ${tick} is out of bounds.`);
  // }
  const UsdtToken = new Token(
    31337,
    TETHER.contractAddress,
    18,
    "USDT",
    "Tether"
  );
  const UsdcToken = new Token(
    31337,
    USDC.contractAddress,
    18,
    "USDC",
    "UsdCoin"
  );

  const liquidity = ethers.parseEther("1").toString();
  const liquidityBigInt = JSBI.BigInt(liquidity); // Преобразование в JSBI BigInt
  const pool = new Pool(
    UsdtToken,
    UsdcToken,
    Number(poolData.fee),
    poolData.sqrtPriceX96.toString(),
    poolData.liquidity.toString(),
    Number(poolData.tick) // tick - указываем актуальный для вашего пула
  );
  // console.log(position);

  const position = new Position({
    pool,
    liquidity: liquidityBigInt,
    tickLower: 0, // Пример значения, задайте свои
    tickUpper: 60, // Пример значения, задайте свои
  });

  const params = {
    token0: TETHER.contractAddress,
    token1: USDC.contractAddress,
    fee: poolData.fee,
    tickLower: 0,
    tickUpper: 60,
    amount0Desired: BigInt(10),
    amount1Desired: BigInt(10),
    amount0Min: 0,
    amount1Min: 0,
    recipient: signer2.address,
    deadline: Math.floor(Date.now() / 1000) + 60 * 10,
  };

  const nonfungiblePositionManager = new Contract(
    NonfungiblePositionManager.contractAddress,
    NonfungiblePositionManagerABI,
    provider
  );
  const tx = await nonfungiblePositionManager
    .connect(signer2)
    .mint(params, { gasLimit: 2_000_000 });
  await tx.wait();
}
