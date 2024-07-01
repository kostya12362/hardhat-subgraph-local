import { ethers } from 'hardhat'
import { v3RouterFixture } from './externalFixtures'
import {
  IWETH9,
  MockTimeNonfungiblePositionManager,
  MockTimeSwapRouter,
  NonfungibleTokenPositionDescriptor,
  TestERC20,
  Dex223Factory,
} from '../../typechain-types/'

export async function  completeFixture():  Promise<{
  factory: Dex223Factory;
  router: MockTimeSwapRouter;
  nftDescriptor: NonfungibleTokenPositionDescriptor;
  tokens: TestERC20[];
  weth9: IWETH9;
  nft: MockTimeNonfungiblePositionManager
}> {
  const { weth9, factory, router , converter} = await v3RouterFixture()

  const tokenFactory = await ethers.getContractFactory('TestERC20')
  const tokens: TestERC20[] = [
    (await tokenFactory.deploy(ethers.MaxUint256 / 2n)) as TestERC20, // do not use maxu256 to avoid overflowing
    (await tokenFactory.deploy(ethers.MaxUint256 / 2n)) as TestERC20,
    (await tokenFactory.deploy(ethers.MaxUint256 / 2n)) as TestERC20,
  ]

  const nftDescriptorLibraryFactory = await ethers.getContractFactory('NFTDescriptor')
  const nftDescriptorLibrary = await nftDescriptorLibraryFactory.deploy()
  const positionDescriptorFactory = await ethers.getContractFactory('NonfungibleTokenPositionDescriptor', {
    libraries: {
      NFTDescriptor: nftDescriptorLibrary.target.toString(),
    },
  })
  const nftDescriptor = (await positionDescriptorFactory.deploy(
    tokens[0].target.toString(),
    // 'ETH' as a bytes32 string
    '0x4554480000000000000000000000000000000000000000000000000000000000'
  )) as NonfungibleTokenPositionDescriptor

  const positionManagerFactory = await ethers.getContractFactory('MockTimeNonfungiblePositionManager')
  const nft = (await positionManagerFactory.deploy(
    factory.target.toString(),
    weth9.target.toString(),
    // nftDescriptor.target
  )) as MockTimeNonfungiblePositionManager

  tokens.sort((a, b) => (a.target.toString().toLowerCase() < b.target.toString().toLowerCase() ? -1 : 1))

  let token3 = await converter.predictWrapperAddress(tokens[0].target, true);
  let token4 = await converter.predictWrapperAddress(tokens[1].target, false);

  tokens.push({target: token3} as TestERC20)
  tokens.push({target: token4} as TestERC20)

  return {
    weth9,
    factory,
    router,
    nft,
    nftDescriptor,
    tokens,
  }
}
