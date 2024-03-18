import { ethers } from "hardhat";
import { Contract } from "ethers";
import { Token } from "@uniswap/sdk-core";
import { FeeAmount, Pool, Position, nearestUsableTick } from "@uniswap/v3-sdk";
import JSBI from "jsbi";
import { ERC20Token, ERC223Token } from "../../typechain-types";
import { ContractResult } from "../helpers/Types";

// import TETHER from "../../deployments/localhost/dex223/Tether/result.json";
import UniswapV3Pool from "@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json";
import NONFUNGIBLE_POSITION_MANAGER from "../../deployments/localhost/dex223/DexaransNonfungiblePositionManager/result.json";
import { IERC223 } from "../../typechain-types/contracts/Dex223-dev/TestTokens/TestHybrid.sol";

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
  token0: IERC223 | ERC20Token,
  token1: IERC223 | ERC20Token
) {
  const [_owner, signer2] = await ethers.getSigners();
  const _token0 = token0 as IERC223 | ERC20Token;
  const _token1 = token1 as IERC223 | ERC20Token;
  const nonfungiblePositionManager = new Contract(
    NONFUNGIBLE_POSITION_MANAGER.contractAddress,
    NONFUNGIBLE_POSITION_MANAGER.abi,
    provider
  );
  const poolContract = new Contract(poolAddress, UniswapV3Pool.abi, provider);
  const poolData = await getPoolData(poolContract);
  const t0 = await getToken(_token0);
  const t1 = await getToken(_token1);

  const liquidityBigInt = JSBI.BigInt(ethers.parseEther("0.01").toString());

  // if ("approve" in token0) {
  console.log(_token0, _token1);
  // if (_token0?.transfer) {
  console.log("transfer", _token0.target);

  await _token0
    .connect(signer2)
    .transfer(
      NONFUNGIBLE_POSITION_MANAGER.contractAddress,
      ethers.parseEther("1000")
    );
  // } else {
  // console.log("approve", _token0.target);
  // await _token0
  //   .connect(signer2)
  //   .approve(
  //     NONFUNGIBLE_POSITION_MANAGER.contractAddress,
  //     ethers.parseEther("1000")
  //   );
  // }

  // if (_token1 instanceof IERC223) {
  console.log("transfer", _token1.target);
  await _token1
    .connect(signer2)
    .transfer(
      NONFUNGIBLE_POSITION_MANAGER.contractAddress,
      ethers.parseEther("1000")
    );
  // } else {
  // console.log("approve", _token1.target);
  // await _token1
  //   .connect(signer2)
  //   .approve(
  //     NONFUNGIBLE_POSITION_MANAGER.contractAddress,
  //     ethers.parseEther("1000")
  //   );
  // }
  console.log(t0, t1);
  // Проверяем наличие метода `approve` у объекта `token1` и вызываем его, если он доступен
  // if ("approve" in token1) {
  // console.log(token1.target);
  // let x = await _token0
  //   .connect(signer2)
  //   .transfer(
  //     NONFUNGIBLE_POSITION_MANAGER.contractAddress,
  //     ethers.parseEther("1000")
  //   );
  // }
  // await x.wait();
  // console.log("approve", x.hash);
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

  const params = {
    token0: token0.target,
    token1: token1.target,
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
    .mint(params, { gasLimit: 10_000_000 });
  await tx.wait();
  console.log(await getPoolData(poolContract));
}
