import { ethers } from "hardhat";
import { BaseContract, Contract } from "ethers";

import FACTORY from "../../deployments/localhost/dex223/Factory/result.json";
import POSITION_MANAGER from "../../deployments/localhost/dex223/DexaransNonfungiblePositionManager/result.json";

import {
  UniswapV3Factory,
  DexaransNonfungiblePositionManager,
} from "../../typechain-types";

const provider = ethers.provider;

export function encodePriceSqrt(reserve1: bigint, reserve0: bigint): bigint {
  const ratio = Number(reserve1) / Number(reserve0);
  const twoPow48 = 2n ** 48n;
  const sqrtRatio = Math.sqrt(ratio);
  return  BigInt(Math.floor(sqrtRatio * Number(twoPow48))) * twoPow48;
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
  POSITION_MANAGER.abi,
  provider
) as BaseContract as DexaransNonfungiblePositionManager;

const factory = new Contract(
  FACTORY.contractAddress,
  FACTORY.abi,
  provider
) as BaseContract as UniswapV3Factory;

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
      gasLimit: 8_000_000,
    });
  await tx.wait();
  const poolAddress = await factory.connect(owner).getPool(token0, token1, fee);
  return poolAddress;
}
