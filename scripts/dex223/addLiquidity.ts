import { ethers } from "hardhat";
import { BaseContract, Contract } from "ethers";
import { Token } from "@uniswap/sdk-core";
import { Pool, Position, nearestUsableTick } from "@uniswap/v3-sdk";
import JSBI from "jsbi";
import {
  ERC20Token,
  IERC223,
  DexaransNonfungiblePositionManager,
} from "../../typechain-types";

import UniswapV3Pool from "../../artifacts/contracts/core/Dex223Pool.sol/Dex223Pool.json";
import NONFUNGIBLE_POSITION_MANAGER from "../../deployments/localhost/dex223/DexaransNonfungiblePositionManager/result.json";

const provider = ethers.provider;

async function getPoolData(poolContract: Contract) {
  const [tickSpacing, fee, liquidity, slot0] = await Promise.all([
    poolContract.tickSpacing(),
    poolContract.fee(),
    poolContract.liquidity(),
    poolContract.slot0(),
  ]);

  return {
    tickSpacing: tickSpacing,
    fee: Number(fee),
    liquidity: liquidity,
    sqrtPriceX96: slot0[0],
    tick: Number(slot0[1]),
  };
}

async function getToken(token: ERC20Token | IERC223): Promise<Token> {
  const chaindId: number = Number((await provider.getNetwork()).chainId);
  const [symbol, name, decimals] = await Promise.all([
    token.symbol(),
    token.name(),
    token.decimals(),
  ]);
  return new Token(
    chaindId,
    String(token.target),
    Number(decimals),
    symbol,
    name
  );
}

export async function addLiquidity(
  poolAddress: string,
  _token0: IERC223 | ERC20Token,
  _token1: IERC223 | ERC20Token,
  _type: "ERC20" | "ERC223",
  _val: number
) {
  const [_owner, signer2] = await ethers.getSigners();
  // const _token0 = token0 as IERC223 | ERC20Token;
  // const _token1 = token1 as IERC223 | ERC20Token;
  const nonfungiblePositionManager = new Contract(
    NONFUNGIBLE_POSITION_MANAGER.contractAddress,
    NONFUNGIBLE_POSITION_MANAGER.abi,
    provider
  ) as BaseContract as DexaransNonfungiblePositionManager;
  const poolContract = new Contract(poolAddress, UniswapV3Pool.abi, provider);
  const poolData = await getPoolData(poolContract);

  const t0 = await getToken(_token0);
  const t1 = await getToken(_token1);

  console.log(t0.symbol);
  console.log(t1.symbol);

  const liquidityBigInt = JSBI.BigInt(ethers.parseEther(_val.toString()).toString());

  const pool = new Pool(
      t0,
      t1,
      poolData.fee,
      poolData.sqrtPriceX96.toString(),
      poolData.liquidity.toString(),
      poolData.tick
  );
  const position = new Position({
    pool,
    liquidity: liquidityBigInt,
    tickLower:
        nearestUsableTick(poolData.tick, Number(poolData.tickSpacing)) -
        Number(poolData.tickSpacing) * 2,
    tickUpper:
        nearestUsableTick(poolData.tick, Number(poolData.tickSpacing)) +
        Number(poolData.tickSpacing) * 2,
  });
  const { amount0: amount0Desired, amount1: amount1Desired } =
      position.mintAmounts;

  if (_type === "ERC223") {
    await _token0
      .connect(signer2)
      .transfer(
        NONFUNGIBLE_POSITION_MANAGER.contractAddress,
          amount0Desired.toString()
      );
    await _token1
      .connect(signer2)
      .transfer(
        NONFUNGIBLE_POSITION_MANAGER.contractAddress,
          amount1Desired.toString()
      );
  } else {
    await _token0
      .connect(signer2)
      .approve(
        NONFUNGIBLE_POSITION_MANAGER.contractAddress,
          amount0Desired.toString()
      );
    await _token1
      .connect(signer2)
      .approve(
        NONFUNGIBLE_POSITION_MANAGER.contractAddress,
          amount1Desired.toString()
      );
  }

  console.log(await _token1.connect(signer2).balanceOf(signer2.address));


  const params = {
    token0: _token0.target,
    token1: _token1.target,
    fee: poolData.fee,
    tickLower:
      nearestUsableTick(poolData.tick, Number(poolData.tickSpacing)) -
      Number(poolData.tickSpacing) * 2,
    tickUpper:
      nearestUsableTick(poolData.tick, Number(poolData.tickSpacing)) +
      Number(poolData.tickSpacing) * 2,
    amount0Desired: amount0Desired.toString(),
    amount1Desired: amount1Desired.toString(),
    amount0Min: 0,
    amount1Min: 0,
    recipient: signer2.address,
    deadline: Math.floor(Date.now() / 1000) + 60 * 10,
  };
  console.log(params);

  const tx = await nonfungiblePositionManager
    .connect(signer2)
    .mint(params, { gasLimit: 8_000_000 });
  await tx.wait();
  console.log(await getPoolData(poolContract));
}
