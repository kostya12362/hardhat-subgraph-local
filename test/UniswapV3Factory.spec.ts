import { Wallet } from 'ethers'
import helpers from '@nomicfoundation/hardhat-network-helpers'
import { ethers } from 'hardhat'
import { Dex223Factory } from '../typechain-types'
import { expect } from 'chai'
import snapshotGasCost from './shared/snapshotGasCost'

import { FeeAmount, getCreate2Address, TICK_SPACINGS } from './shared/utilities'

const TEST_ADDRESSES: [string, string, string, string] = [
  '0x1000000000000000000000000000000000000000',
  '0x2000000000000000000000000000000000000000',
  '0x3000000000000000000000000000000000000000',
  '0x4000000000000000000000000000000000000000',
]

// const createFixtureLoader = waffle.createFixtureLoader

describe('Dex223Factory', () => {
  let wallet: Wallet, other: Wallet

  let factory: Dex223Factory
  let poolBytecode: string
  const fixture = async () => {
    const factoryFactory = await ethers.getContractFactory('Dex223Factory')
    return (await factoryFactory.deploy()) as Dex223Factory
  }

  // let loadFixture: ReturnType<typeof createFixtureLoader>
  before('create fixture loader', async () => {
    ;[wallet, other] = await (ethers as any).getSigners()
  //
  //   loadFixture = createFixtureLoader([wallet, other])
  })

  before('load pool bytecode', async () => {
    poolBytecode = (await ethers.getContractFactory('Dex223Pool')).bytecode
  })

  beforeEach('deploy factory', async () => {
    factory = await helpers.loadFixture(fixture);
    // factory = await loadFixture(fixture)
  })

  it('owner is deployer', async () => {
    expect(await factory.owner()).to.eq(wallet.address)
  })

  it('factory bytecode size', async () => {
    expect(((await ethers.provider.getCode(factory.target)).length - 2) / 2).to.matchSnapshot()
  })

  it('pool bytecode size', async () => {
    await factory.createPool(TEST_ADDRESSES[0], TEST_ADDRESSES[1], TEST_ADDRESSES[2], TEST_ADDRESSES[3], FeeAmount.MEDIUM)
    const poolAddress = getCreate2Address(String(factory.target), [TEST_ADDRESSES[0], TEST_ADDRESSES[1]],
        FeeAmount.MEDIUM, poolBytecode)
    expect(((await ethers.provider.getCode(poolAddress)).length - 2) / 2).to.matchSnapshot()
  })

  it('initial enabled fee amounts', async () => {
    expect(await factory.feeAmountTickSpacing(FeeAmount.LOW)).to.eq(TICK_SPACINGS[FeeAmount.LOW])
    expect(await factory.feeAmountTickSpacing(FeeAmount.MEDIUM)).to.eq(TICK_SPACINGS[FeeAmount.MEDIUM])
    expect(await factory.feeAmountTickSpacing(FeeAmount.HIGH)).to.eq(TICK_SPACINGS[FeeAmount.HIGH])
  })

  async function createAndCheckPool(
    tokens: [string, string, string, string],
    feeAmount: FeeAmount,
    tickSpacing: number = TICK_SPACINGS[feeAmount]
  ) {
    const create2Address = getCreate2Address(String(factory.target), [tokens[0], tokens[1]], feeAmount, poolBytecode)
    const create = factory.createPool(...tokens, feeAmount)

    await expect(create)
      .to.emit(factory, 'PoolCreated')
      .withArgs(...TEST_ADDRESSES, feeAmount, tickSpacing, create2Address)

    // TODO test other combinations
    await expect(factory.createPool(...tokens, feeAmount)).to.be.reverted
    await expect(factory.createPool(tokens[1], tokens[0], tokens[2], tokens[3], feeAmount)).to.be.reverted
    expect(await factory.getPool(tokens[0], tokens[1], feeAmount), 'getPool in order').to.eq(create2Address)
    expect(await factory.getPool(tokens[1], tokens[0], feeAmount), 'getPool in reverse').to.eq(create2Address)

    const poolContractFactory = await ethers.getContractFactory('UniswapV3Pool')
    const pool = poolContractFactory.attach(create2Address)
    expect(await pool.factory(), 'pool factory address').to.eq(String(factory.target))
    expect(await pool.token0()[0], 'pool token0').to.eq(TEST_ADDRESSES[0])
    expect(await pool.token1()[0], 'pool token1').to.eq(TEST_ADDRESSES[1])
    expect(await pool.fee(), 'pool fee').to.eq(feeAmount)
    expect(await pool.tickSpacing(), 'pool tick spacing').to.eq(tickSpacing)
  }

  describe('#createPool', () => {
    it('succeeds for low fee pool', async () => {
      await createAndCheckPool(TEST_ADDRESSES, FeeAmount.LOW)
    })

    it('succeeds for medium fee pool', async () => {
      await createAndCheckPool(TEST_ADDRESSES, FeeAmount.MEDIUM)
    })
    it('succeeds for high fee pool', async () => {
      await createAndCheckPool(TEST_ADDRESSES, FeeAmount.HIGH)
    })

    it('succeeds if tokens are passed in reverse', async () => {
      await createAndCheckPool([TEST_ADDRESSES[1], TEST_ADDRESSES[0], TEST_ADDRESSES[3], TEST_ADDRESSES[2]], FeeAmount.MEDIUM)
    })

    it('fails if token a == token b', async () => {
      await expect(factory.createPool(TEST_ADDRESSES[0], TEST_ADDRESSES[0], TEST_ADDRESSES[0], TEST_ADDRESSES[0], FeeAmount.LOW)).to.be.reverted
    })

    it('fails if token a is 0 or token b is 0', async () => {
      await expect(factory.createPool(TEST_ADDRESSES[0], ethers.ZeroAddress, TEST_ADDRESSES[3], TEST_ADDRESSES[2], FeeAmount.LOW)).to.be.reverted
      await expect(factory.createPool(ethers.ZeroAddress, TEST_ADDRESSES[0], TEST_ADDRESSES[3], TEST_ADDRESSES[2], FeeAmount.LOW)).to.be.reverted
      await expect(factory.createPool(ethers.ZeroAddress, ethers.ZeroAddress, TEST_ADDRESSES[3], TEST_ADDRESSES[2], FeeAmount.LOW)).to.be.revertedWith(
        ''
      )
    })
// import Decimal from 'decimal.js'
// import { BigNumber, BigNumberish, Wallet } from 'ethers'
// import { ethers, waffle } from 'hardhat'
// import { MockTimeUniswapV3Pool } from '../typechain/MockTimeUniswapV3Pool'
// import { TickMathTest } from '../typechain/TickMathTest'
// import { UniswapV3PoolSwapTest } from '../typechain/UniswapV3PoolSwapTest'
// import { expect } from './shared/expect'
//
// import { poolFixture } from './shared/fixtures'
// import { formatPrice, formatTokenAmount } from './shared/format'
//
// import {
//   createPoolFunctions,
//   encodePriceSqrt,
//   expandTo18Decimals,
//   FeeAmount,
//   getMaxLiquidityPerTick,
//   getMaxTick,
//   getMinTick,
//   MAX_SQRT_RATIO,
//   MaxUint128,
//   MIN_SQRT_RATIO,
//   MintFunction,
//   SwapFunction,
//   TICK_SPACINGS,
// } from './shared/utilities'
//
// const {
//   constants: { MaxUint256 },
// } = ethers
//
// const createFixtureLoader = waffle.createFixtureLoader
//
// Decimal.config({ toExpNeg: -500, toExpPos: 500 })
//
// function applySqrtRatioBipsHundredthsDelta(sqrtRatio: BigNumber, bipsHundredths: number): BigNumber {
//   return BigNumber.from(
//     new Decimal(
//       sqrtRatio
//         .mul(sqrtRatio)
//         .mul(1e6 + bipsHundredths)
//         .div(1e6)
//         .toString()
//     )
//       .sqrt()
//       .floor()
//       .toString()
//   )
// }
//
// describe('UniswapV3Pool arbitrage tests', () => {
//   let wallet: Wallet, arbitrageur: Wallet
//
//   let loadFixture: ReturnType<typeof createFixtureLoader>
//
//   before('create fixture loader', async () => {
//     ;[wallet, arbitrageur] = await (ethers as any).getSigners()
//     loadFixture = createFixtureLoader([wallet, arbitrageur])
//   })
//
//   for (const feeProtocol of [0, 6]) {
//     describe(`protocol fee = ${feeProtocol};`, () => {
//       const startingPrice = encodePriceSqrt(1, 1)
//       const startingTick = 0
//       const feeAmount = FeeAmount.MEDIUM
//       const tickSpacing = TICK_SPACINGS[feeAmount]
//       const minTick = getMinTick(tickSpacing)
//       const maxTick = getMaxTick(tickSpacing)
//
//       for (const passiveLiquidity of [
//         expandTo18Decimals(1).div(100),
//         expandTo18Decimals(1),
//         expandTo18Decimals(10),
//         expandTo18Decimals(100),
//       ]) {
//         describe(`passive liquidity of ${formatTokenAmount(passiveLiquidity)}`, () => {
//           const arbTestFixture = async ([wallet, arbitrageur]: Wallet[]) => {
//             const fix = await poolFixture([wallet], waffle.provider)
//
//             const pool = await fix.createPool(feeAmount, tickSpacing)
//
//             await fix.token0.transfer(arbitrageur.address, BigNumber.from(2).pow(254))
//             await fix.token1.transfer(arbitrageur.address, BigNumber.from(2).pow(254))
//
//             const {
//               swapExact0For1,
//               swapToHigherPrice,
//               swapToLowerPrice,
//               swapExact1For0,
//               mint,
//             } = await createPoolFunctions({
//               swapTarget: fix.swapTargetCallee,
//               token0: fix.token0,
//               token1: fix.token1,
//               pool,
//             })
//
//             const testerFactory = await ethers.getContractFactory('UniswapV3PoolSwapTest')
//             const tester = (await testerFactory.deploy()) as UniswapV3PoolSwapTest
//
//             const tickMathFactory = await ethers.getContractFactory('TickMathTest')
//             const tickMath = (await tickMathFactory.deploy()) as TickMathTest
//
//             await fix.token0.approve(tester.address, MaxUint256)
//             await fix.token1.approve(tester.address, MaxUint256)
//
//             await pool.initialize(startingPrice)
//             if (feeProtocol != 0) await pool.setFeeProtocol(feeProtocol, feeProtocol)
//             await mint(wallet.address, minTick, maxTick, passiveLiquidity)
//
//             expect((await pool.slot0()).tick).to.eq(startingTick)
//             expect((await pool.slot0()).sqrtPriceX96).to.eq(startingPrice)
//
//             return { pool, swapExact0For1, mint, swapToHigherPrice, swapToLowerPrice, swapExact1For0, tester, tickMath }
//           }
//
//           let swapExact0For1: SwapFunction
//           let swapToHigherPrice: SwapFunction
//           let swapToLowerPrice: SwapFunction
//           let swapExact1For0: SwapFunction
//           let pool: MockTimeUniswapV3Pool
//           let mint: MintFunction
//           let tester: UniswapV3PoolSwapTest
//           let tickMath: TickMathTest
//
//           beforeEach('load the fixture', async () => {
//             ;({
//               swapExact0For1,
//               pool,
//               mint,
//               swapToHigherPrice,
//               swapToLowerPrice,
//               swapExact1For0,
//               tester,
//               tickMath,
//             } = await loadFixture(arbTestFixture))
//           })
//
//           async function simulateSwap(
//             zeroForOne: boolean,
//             amountSpecified: BigNumberish,
//             sqrtPriceLimitX96?: BigNumber
//           ): Promise<{
//             executionPrice: BigNumber
//             nextSqrtRatio: BigNumber
//             amount0Delta: BigNumber
//             amount1Delta: BigNumber
//           }> {
//             const { amount0Delta, amount1Delta, nextSqrtRatio } = await tester.callStatic.getSwapResult(
//               pool.address,
//               zeroForOne,
//               amountSpecified,
//               sqrtPriceLimitX96 ?? (zeroForOne ? MIN_SQRT_RATIO.add(1) : MAX_SQRT_RATIO.sub(1))
//             )
//
//             const executionPrice = zeroForOne
//               ? encodePriceSqrt(amount1Delta, amount0Delta.mul(-1))
//               : encodePriceSqrt(amount1Delta.mul(-1), amount0Delta)
//
//             return { executionPrice, nextSqrtRatio, amount0Delta, amount1Delta }
//           }
//
//           for (const { zeroForOne, assumedTruePriceAfterSwap, inputAmount, description } of [
//             {
//               description: 'exact input of 10e18 token0 with starting price of 1.0 and true price of 0.98',
//               zeroForOne: true,
//               inputAmount: expandTo18Decimals(10),
//               assumedTruePriceAfterSwap: encodePriceSqrt(98, 100),
//             },
//             {
//               description: 'exact input of 10e18 token0 with starting price of 1.0 and true price of 1.01',
//               zeroForOne: true,
//               inputAmount: expandTo18Decimals(10),
//               assumedTruePriceAfterSwap: encodePriceSqrt(101, 100),
//             },
//           ]) {
//             describe(description, () => {
//               function valueToken1(arbBalance0: BigNumber, arbBalance1: BigNumber) {
//                 return assumedTruePriceAfterSwap
//                   .mul(assumedTruePriceAfterSwap)
//                   .mul(arbBalance0)
//                   .div(BigNumber.from(2).pow(192))
//                   .add(arbBalance1)
//               }
//
//               it('not sandwiched', async () => {
//                 const { executionPrice, amount1Delta, amount0Delta } = await simulateSwap(zeroForOne, inputAmount)
//                 zeroForOne
//                   ? await swapExact0For1(inputAmount, wallet.address)
//                   : await swapExact1For0(inputAmount, wallet.address)
//
//                 expect({
//                   executionPrice: formatPrice(executionPrice),
//                   amount0Delta: formatTokenAmount(amount0Delta),
//                   amount1Delta: formatTokenAmount(amount1Delta),
//                   priceAfter: formatPrice((await pool.slot0()).sqrtPriceX96),
//                 }).to.matchSnapshot()
//               })
//
//               it('sandwiched with swap to execution price then mint max liquidity/target/burn max liquidity', async () => {
//                 const { executionPrice } = await simulateSwap(zeroForOne, inputAmount)
//
//                 const firstTickAboveMarginalPrice = zeroForOne
//                   ? Math.ceil(
//                       (await tickMath.getTickAtSqrtRatio(
//                         applySqrtRatioBipsHundredthsDelta(executionPrice, feeAmount)
//                       )) / tickSpacing
//                     ) * tickSpacing
//                   : Math.floor(
//                       (await tickMath.getTickAtSqrtRatio(
//                         applySqrtRatioBipsHundredthsDelta(executionPrice, -feeAmount)
//                       )) / tickSpacing
//                     ) * tickSpacing
//                 const tickAfterFirstTickAboveMarginPrice = zeroForOne
//                   ? firstTickAboveMarginalPrice - tickSpacing
//                   : firstTickAboveMarginalPrice + tickSpacing
//
//                 const priceSwapStart = await tickMath.getSqrtRatioAtTick(firstTickAboveMarginalPrice)
//
//                 let arbBalance0 = BigNumber.from(0)
//                 let arbBalance1 = BigNumber.from(0)
//
//                 // first frontrun to the first tick before the execution price
//                 const {
//                   amount0Delta: frontrunDelta0,
//                   amount1Delta: frontrunDelta1,
//                   executionPrice: frontrunExecutionPrice,
//                 } = await simulateSwap(zeroForOne, MaxUint256.div(2), priceSwapStart)
//                 arbBalance0 = arbBalance0.sub(frontrunDelta0)
//                 arbBalance1 = arbBalance1.sub(frontrunDelta1)
//                 zeroForOne
//                   ? await swapToLowerPrice(priceSwapStart, arbitrageur.address)
//                   : await swapToHigherPrice(priceSwapStart, arbitrageur.address)
//
//                 const profitToken1AfterFrontRun = valueToken1(arbBalance0, arbBalance1)
//
//                 const tickLower = zeroForOne ? tickAfterFirstTickAboveMarginPrice : firstTickAboveMarginalPrice
//                 const tickUpper = zeroForOne ? firstTickAboveMarginalPrice : tickAfterFirstTickAboveMarginPrice
//
//                 // deposit max liquidity at the tick
//                 const mintReceipt = await (
//                   await mint(wallet.address, tickLower, tickUpper, getMaxLiquidityPerTick(tickSpacing))
//                 ).wait()
//                 // sub the mint costs
//                 const { amount0: amount0Mint, amount1: amount1Mint } = pool.interface.decodeEventLog(
//                   pool.interface.events['Mint(address,address,int24,int24,uint128,uint256,uint256)'],
//                   mintReceipt.events?.[2].data!
//                 )
//                 arbBalance0 = arbBalance0.sub(amount0Mint)
//                 arbBalance1 = arbBalance1.sub(amount1Mint)
//
//                 // execute the user's swap
//                 const { executionPrice: executionPriceAfterFrontrun } = await simulateSwap(zeroForOne, inputAmount)
//                 zeroForOne
//                   ? await swapExact0For1(inputAmount, wallet.address)
//                   : await swapExact1For0(inputAmount, wallet.address)
//
//                 // burn the arb's liquidity
//                 const { amount0: amount0Burn, amount1: amount1Burn } = await pool.callStatic.burn(
//                   tickLower,
//                   tickUpper,
//                   getMaxLiquidityPerTick(tickSpacing)
//                 )
//                 await pool.burn(tickLower, tickUpper, getMaxLiquidityPerTick(tickSpacing))
//                 arbBalance0 = arbBalance0.add(amount0Burn)
//                 arbBalance1 = arbBalance1.add(amount1Burn)
//
//                 // add the fees as well
//                 const {
//                   amount0: amount0CollectAndBurn,
//                   amount1: amount1CollectAndBurn,
//                 } = await pool.callStatic.collect(arbitrageur.address, tickLower, tickUpper, MaxUint128, MaxUint128)
//                 const [amount0Collect, amount1Collect] = [
//                   amount0CollectAndBurn.sub(amount0Burn),
//                   amount1CollectAndBurn.sub(amount1Burn),
//                 ]
//                 arbBalance0 = arbBalance0.add(amount0Collect)
//                 arbBalance1 = arbBalance1.add(amount1Collect)
//
//                 const profitToken1AfterSandwich = valueToken1(arbBalance0, arbBalance1)
//
//                 // backrun the swap to true price, i.e. swap to the marginal price = true price
//                 const priceToSwapTo = zeroForOne
//                   ? applySqrtRatioBipsHundredthsDelta(assumedTruePriceAfterSwap, -feeAmount)
//                   : applySqrtRatioBipsHundredthsDelta(assumedTruePriceAfterSwap, feeAmount)
//                 const {
//                   amount0Delta: backrunDelta0,
//                   amount1Delta: backrunDelta1,
//                   executionPrice: backrunExecutionPrice,
//                 } = await simulateSwap(!zeroForOne, MaxUint256.div(2), priceToSwapTo)
//                 await swapToHigherPrice(priceToSwapTo, wallet.address)
//                 arbBalance0 = arbBalance0.sub(backrunDelta0)
//                 arbBalance1 = arbBalance1.sub(backrunDelta1)
//
//                 expect({
//                   sandwichedPrice: formatPrice(executionPriceAfterFrontrun),
//                   arbBalanceDelta0: formatTokenAmount(arbBalance0),
//                   arbBalanceDelta1: formatTokenAmount(arbBalance1),
//                   profit: {
//                     final: formatTokenAmount(valueToken1(arbBalance0, arbBalance1)),
//                     afterFrontrun: formatTokenAmount(profitToken1AfterFrontRun),
//                     afterSandwich: formatTokenAmount(profitToken1AfterSandwich),
//                   },
//                   backrun: {
//                     executionPrice: formatPrice(backrunExecutionPrice),
//                     delta0: formatTokenAmount(backrunDelta0),
//                     delta1: formatTokenAmount(backrunDelta1),
//                   },
//                   frontrun: {
//                     executionPrice: formatPrice(frontrunExecutionPrice),
//                     delta0: formatTokenAmount(frontrunDelta0),
//                     delta1: formatTokenAmount(frontrunDelta1),
//                   },
//                   collect: {
//                     amount0: formatTokenAmount(amount0Collect),
//                     amount1: formatTokenAmount(amount1Collect),
//                   },
//                   burn: {
//                     amount0: formatTokenAmount(amount0Burn),
//                     amount1: formatTokenAmount(amount1Burn),
//                   },
//                   mint: {
//                     amount0: formatTokenAmount(amount0Mint),
//                     amount1: formatTokenAmount(amount1Mint),
//                   },
//                   finalPrice: formatPrice((await pool.slot0()).sqrtPriceX96),
//                 }).to.matchSnapshot()
//               })
//
//               it('backrun to true price after swap only', async () => {
//                 let arbBalance0 = BigNumber.from(0)
//                 let arbBalance1 = BigNumber.from(0)
//
//                 zeroForOne
//                   ? await swapExact0For1(inputAmount, wallet.address)
//                   : await swapExact1For0(inputAmount, wallet.address)
//
//                 // swap to the marginal price = true price
//                 const priceToSwapTo = zeroForOne
//                   ? applySqrtRatioBipsHundredthsDelta(assumedTruePriceAfterSwap, -feeAmount)
//                   : applySqrtRatioBipsHundredthsDelta(assumedTruePriceAfterSwap, feeAmount)
//                 const {
//                   amount0Delta: backrunDelta0,
//                   amount1Delta: backrunDelta1,
//                   executionPrice: backrunExecutionPrice,
//                 } = await simulateSwap(!zeroForOne, MaxUint256.div(2), priceToSwapTo)
//                 zeroForOne
//                   ? await swapToHigherPrice(priceToSwapTo, wallet.address)
//                   : await swapToLowerPrice(priceToSwapTo, wallet.address)
//                 arbBalance0 = arbBalance0.sub(backrunDelta0)
//                 arbBalance1 = arbBalance1.sub(backrunDelta1)
//
//                 expect({
//                   arbBalanceDelta0: formatTokenAmount(arbBalance0),
//                   arbBalanceDelta1: formatTokenAmount(arbBalance1),
//                   profit: {
//                     final: formatTokenAmount(valueToken1(arbBalance0, arbBalance1)),
//                   },
//                   backrun: {
//                     executionPrice: formatPrice(backrunExecutionPrice),
//                     delta0: formatTokenAmount(backrunDelta0),
//                     delta1: formatTokenAmount(backrunDelta1),
//                   },
//                   finalPrice: formatPrice((await pool.slot0()).sqrtPriceX96),
//                 }).to.matchSnapshot()
//               })
//             })
//           }
//         })
//       }
//     })
//   }
// })

    it('fails if fee amount is not enabled', async () => {
      await expect(factory.createPool(...TEST_ADDRESSES, 250)).to.be.reverted
    })

    it('gas', async () => {
      await snapshotGasCost(factory.createPool(...TEST_ADDRESSES, FeeAmount.MEDIUM))
    })
  })

  describe('#setOwner', () => {
    it('fails if caller is not owner', async () => {
      await expect(factory.connect(other).setOwner(wallet.address)).to.be.reverted
    })

    it('updates owner', async () => {
      await factory.setOwner(other.address)
      expect(await factory.owner()).to.eq(other.address)
    })

    it('emits event', async () => {
      await expect(factory.setOwner(other.address))
        .to.emit(factory, 'OwnerChanged')
        .withArgs(wallet.address, other.address)
    })

    it('cannot be called by original owner', async () => {
      await factory.setOwner(other.address)
      await expect(factory.setOwner(wallet.address)).to.be.reverted
    })
  })

  // NOTE enableFeeAmount disabled in Dex factory
  // describe('#enableFeeAmount', () => {
  //   it('fails if caller is not owner', async () => {
  //     await expect(factory.connect(other).enableFeeAmount(100, 2)).to.be.reverted
  //   })
  //   it('fails if fee is too great', async () => {
  //     await expect(factory.enableFeeAmount(1000000, 10)).to.be.reverted
  //   })
  //   it('fails if tick spacing is too small', async () => {
  //     await expect(factory.enableFeeAmount(500, 0)).to.be.reverted
  //   })
  //   it('fails if tick spacing is too large', async () => {
  //     await expect(factory.enableFeeAmount(500, 16834)).to.be.reverted
  //   })
  //   it('fails if already initialized', async () => {
  //     await factory.enableFeeAmount(100, 5)
  //     await expect(factory.enableFeeAmount(100, 10)).to.be.reverted
  //   })
  //   it('sets the fee amount in the mapping', async () => {
  //     await factory.enableFeeAmount(100, 5)
  //     expect(await factory.feeAmountTickSpacing(100)).to.eq(5)
  //   })
  //   it('emits an event', async () => {
  //     await expect(factory.enableFeeAmount(100, 5)).to.emit(factory, 'FeeAmountEnabled').withArgs(100, 5)
  //   })
  //   it('enables pool creation', async () => {
  //     await factory.enableFeeAmount(250, 15)
  //     await createAndCheckPool(TEST_ADDRESSES, 250, 15)
  //   })
  // })
})
