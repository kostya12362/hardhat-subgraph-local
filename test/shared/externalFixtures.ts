import { ethers } from 'hardhat'
import {
  Dex223Factory,
  IWETH9,
  MockTimeSwapRouter, TokenStandardConverter
} from '../../typechain-types/'
import { factoryFixture } from './fixtures'

interface WethFixture {
  weth9: IWETH9
}

interface RouterFixture {
  weth9: IWETH9
  factory: Dex223Factory
  router: MockTimeSwapRouter,
  converter: TokenStandardConverter
}

async function wethFixture(): Promise<WethFixture> {
  const wethFactory = await ethers.getContractFactory('WETH9')
  const weth9 = (await wethFactory.deploy()) as IWETH9

  return { weth9 }
}

export async function v3RouterFixture(): Promise<RouterFixture> {
  const { weth9 } = await wethFixture()
  const { factory, converter} = await factoryFixture()

  const routerFactory = await ethers.getContractFactory('MockTimeSwapRouter')
  const router = (await routerFactory.deploy(
      factory.target.toString(),
      weth9.target.toString()
  )) as MockTimeSwapRouter

  return { factory, weth9, router , converter }
}
