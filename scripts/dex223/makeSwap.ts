import { ethers } from "hardhat";
import {BaseContract, Contract, ContractFactory} from "ethers";
import {
    ERC20Token,
    IERC223, MockTestDex223Pool, MockTestDex223PoolDeployer,
    TestUniswapV3Callee,
    // MockTestDex223Pool
} from "../../typechain-types";

import TestPoolCallee from "../../deployments/localhost/dex223/TestPoolCallee/result.json";
import PoolFactory from "../../deployments/localhost/dex223/Factory/result.json";
// import WETH9 from "../../deployments/localhost/dex223/WETH9/result.json";
import PoolLib from "../../deployments/localhost/dex223/PoolLibrary/result.json";
import Converter from "../../deployments/localhost/dex223/TokenConvertor/result.json";
import Dex223Pool from "../../artifacts/contracts/test/MockTestDex223Pool.sol/MockTestDex223Pool.json";

const provider = ethers.provider;

const maxMint = 2n ** 255n;

export const getMinTick = (tickSpacing: number) => BigInt(Math.ceil(-887272 / tickSpacing) * tickSpacing)
export const getMaxTick = (tickSpacing: number) => BigInt(Math.floor(887272 / tickSpacing) * tickSpacing)

export async function testMintToken(token: ERC20Token) {
    const [owner] = await ethers.getSigners();
    const balance = await token.balanceOf(owner.address);

    if (balance < maxMint) {
        await token
            .connect(owner)
            .mint(owner.address, maxMint - balance);
    }
}

export async function testDeployPool(
    token0: string,
    token1: string,
    token0_223: string,
    token1_223: string,
    fee: bigint,
    tickSpacing: bigint,
    sqrtPrice: bigint) {
    // const [owner] = await ethers.getSigners();

    const MockTestUniswapV3PoolDeployerFactory = await ethers.getContractFactory('MockTestDex223PoolDeployer');
    const MockTestUniswapV3PoolFactory = await ethers.getContractFactory('MockTestDex223Pool');

    const mockTestPoolDeployer = (await MockTestUniswapV3PoolDeployerFactory.deploy()) as MockTestDex223PoolDeployer;
    const tx = await mockTestPoolDeployer.deploy(
        PoolFactory.contractAddress,
        token0,
        token1,
        fee,
        tickSpacing
    )

    const receipt = await tx.wait()

    // @ts-ignore
    const poolAddress = receipt?.logs?.[0].args?.[0] as string
    const pool = MockTestUniswapV3PoolFactory.attach(poolAddress) as MockTestDex223Pool

    await pool.testset(token0_223, token1_223, PoolLib.contractAddress,  Converter.contractAddress);

    await pool.initialize(sqrtPrice);

    return pool.target.toString();
}

export async function testAddLiquidity(poolAddress: string, _token0: ERC20Token, _token1: ERC20Token, tickLower: bigint, tickUpper: bigint, amount: bigint) {
    const [owner] = await ethers.getSigners();

    await _token0.connect(owner).approve(TestPoolCallee.contractAddress, maxMint);
    await _token1.connect(owner).approve(TestPoolCallee.contractAddress, maxMint);

    const calleeContract = new Contract(
        TestPoolCallee.contractAddress,
        TestPoolCallee.abi,
        provider
    ) as BaseContract as TestUniswapV3Callee;

    await calleeContract.connect(owner).mint(
        poolAddress,
        '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        tickLower,
        tickUpper,
        amount);
}

export async function makeSwap(
    poolAddress: string,
    _token0: IERC223 | ERC20Token,
    sqrtPriceLimitX96: bigint,
)
{
    const [owner] = await ethers.getSigners();
    console.log("makeSwap: ", _token0.target, sqrtPriceLimitX96);

    const calleeContract = new Contract(
        TestPoolCallee.contractAddress,
        TestPoolCallee.abi,
        provider
    ) as BaseContract as TestUniswapV3Callee;


    try {
        console.log('trying swap...');
        const result = await calleeContract.connect(owner).swapExact1For0(
            poolAddress, 1, '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', sqrtPriceLimitX96);
        console.log('result:', result);
    } catch (e) {
        console.log(e)
    }
}