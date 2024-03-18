import { ethers } from "hardhat";
import { Contract } from "ethers";

import FACTORY from "../../__results__/localhost/uniswap/Factory/result.json";
import POSITION_MANAGER from "../../__results__/localhost/uniswap/NonfungiblePositionManager/result.json";

import FACTORY_ABI from "../../__results__/localhost/uniswap/Factory/Factory.json";
import POSITION_MANAGER_ABI from "../../__results__/localhost/uniswap/NonfungiblePositionManager/NonfungiblePositionManager.json";

const provider = ethers.provider;

export function encodePriceSqrt(reserve1: bigint, reserve0: bigint): bigint {
  console.log(reserve1, reserve0);
  const ratio = reserve1 / reserve0;
  const twoPow96 = BigInt(2) ** BigInt(96);
  const sqrtRatio = sqrt(ratio);
  const priceSqrt = sqrtRatio * twoPow96;
  return priceSqrt;
}

function sqrt(value: bigint): bigint {
  if (value < 0n) {
    throw new Error("Square root of negative numbers is not supported.");
  }
  if (value < 2n) {
    return value;
  }

  let x0 = value;
  let x1 = value / 2n + 1n; // Инициализируем x1 половиной value, чтобы начать алгоритм

  while (x1 < x0) {
    x0 = x1;
    x1 = (value / x1 + x1) / 2n;
  }

  return x0;
}

const nonfungiblePositionManager = new Contract(
  POSITION_MANAGER.contractAddress,
  POSITION_MANAGER_ABI,
  provider
);

const factory = new Contract(FACTORY.contractAddress, FACTORY_ABI, provider);

export async function deployPool(
  token0: string,
  token1: string,
  fee: number,
  price: bigint
): Promise<string> {
  const [owner] = await ethers.getSigners();

  const tx = await nonfungiblePositionManager
    .connect(owner)
    .createAndInitializePoolIfNecessary(token0, token1, fee, price, {
      gasLimit: 5000000,
    });
  await tx.wait();
  const poolAddress = await factory.connect(owner).getPool(token0, token1, fee);
  const envets = await factory.queryFilter(
    "PoolCreated",
    POSITION_MANAGER.startBlock,
    await provider.getBlockNumber()
  );
  console.log(envets);
  return poolAddress;
}
