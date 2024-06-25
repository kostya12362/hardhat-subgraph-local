import { ethers } from 'hardhat'
import { MockTimeDex223Pool } from '../../typechain-types/'
import { TestERC20 } from '../../typechain-types/'
import { Dex223Factory } from '../../typechain-types/'
import { TestUniswapV3Callee } from '../../typechain-types/'
import { TestUniswapV3Router } from '../../typechain-types/'
import { MockTimeUniswapV3PoolDeployer } from '../../typechain-types/'

interface FactoryFixture {
  factory: Dex223Factory
}

async function factoryFixture(): Promise<FactoryFixture> {
  const factoryFactory = await ethers.getContractFactory('Dex223Factory')
  const factory = (await factoryFactory.deploy()) as Dex223Factory
  return { factory }
}

interface TokensFixture {
  token0: TestERC20
  token1: TestERC20
  token2: TestERC20
}

async function tokensFixture(): Promise<TokensFixture> {
  const tokenFactory = await ethers.getContractFactory('TestERC20')
  const tokenA = (await tokenFactory.deploy(2n ** 255n)) as TestERC20
  const tokenB = (await tokenFactory.deploy(2n ** 255n)) as TestERC20
  const tokenC = (await tokenFactory.deploy(2n ** 255n)) as TestERC20

  const [token0, token1, token2] = [tokenA, tokenB, tokenC].sort((tokenA, tokenB) =>
    tokenA.target.toString().toLowerCase() < tokenB.target.toString().toLowerCase() ? -1 : 1
  )

  return { token0, token1, token2 }
}

type TokensAndFactoryFixture = FactoryFixture & TokensFixture

interface PoolFixture extends TokensAndFactoryFixture {
  swapTargetCallee: TestUniswapV3Callee
  swapTargetRouter: TestUniswapV3Router
  createPool(
    fee: number,
    tickSpacing: number,
    firstToken?: TestERC20,
    secondToken?: TestERC20
  ): Promise<MockTimeDex223Pool>
}

// Monday, October 5, 2020 9:00:00 AM GMT-05:00
export const TEST_POOL_START_TIME = 1601906400n

export const poolFixture  = async function (): Promise<PoolFixture> {
  const { factory } = await factoryFixture()
  const { token0, token1, token2 } = await tokensFixture()

  const MockTimeUniswapV3PoolDeployerFactory = await ethers.getContractFactory('MockTimeUniswapV3PoolDeployer')
  const MockTimeUniswapV3PoolFactory = await ethers.getContractFactory('MockTimeDex223Pool')

  const calleeContractFactory = await ethers.getContractFactory('TestUniswapV3Callee')
  const routerContractFactory = await ethers.getContractFactory('TestUniswapV3Router')

  const swapTargetCallee = (await calleeContractFactory.deploy()) as TestUniswapV3Callee
  const swapTargetRouter = (await routerContractFactory.deploy()) as TestUniswapV3Router

  return {
    token0,
    token1,
    token2,
    factory,
    swapTargetCallee,
    swapTargetRouter,
    createPool: async (fee, tickSpacing, firstToken = token0, secondToken = token1) => {
      const mockTimePoolDeployer = (await MockTimeUniswapV3PoolDeployerFactory.deploy()) as MockTimeUniswapV3PoolDeployer
      const tx = await mockTimePoolDeployer.deploy(
        factory.target.toString(),
        firstToken.target.toString(),
        secondToken.target.toString(),
        fee,
        tickSpacing
      )

      const receipt = await tx.wait()
      const poolAddress = receipt?.events?.[0].args?.pool as string
      return MockTimeUniswapV3PoolFactory.attach(poolAddress) as MockTimeDex223Pool
    },
  }
}
