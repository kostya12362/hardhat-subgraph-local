import { ContractTransactionResponse, Wallet} from 'ethers'
import { ethers } from 'hardhat'
import {
  Dex223Factory,
  IWETH9,
  MockTimeNonfungiblePositionManager,
  MockTimeSwapRouter,
  TestERC20,
  TokenStandardConverter
} from '../typechain-types/'
import { completeFixture } from './shared/completeFixture'
import { FeeAmount, TICK_SPACINGS } from './shared/constants'
import { encodePriceSqrt, expandTo18Decimals, getMaxTick, getMinTick } from './shared/utilities'
import { expect } from 'chai'
import { encodePath } from './shared/path'
import { computePoolAddress } from './shared/computePoolAddress'
import {
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe('SwapRouter', function () {
  this.timeout(40000)
  let wallet: Wallet
  let trader: Wallet

  async function swapRouterFixture(): Promise<{
    weth9: IWETH9
    factory: Dex223Factory
    router: MockTimeSwapRouter
    nft: MockTimeNonfungiblePositionManager
    tokens: TestERC20[],
    converter: TokenStandardConverter
  }> {
    const { weth9, factory, router, tokens,
      nft , converter} = await completeFixture()

    // approve & fund wallets
    for (let i = 0; i < 3; i++) {
      const token = tokens[i]
      await token.approve(router.target.toString(), ethers.MaxUint256)
      await token.approve(nft.target.toString(), ethers.MaxUint256)
      await token.connect(trader).approve(router.target.toString(), ethers.MaxUint256)
      await token.transfer(trader.address, expandTo18Decimals(1_000_000))
    }

    return {
      weth9,
      factory,
      router,
      tokens,
      nft,
      converter
    }
  }

  let factory: Dex223Factory
  let weth9: IWETH9
  let router: MockTimeSwapRouter
  let nft: MockTimeNonfungiblePositionManager
  let converter: TokenStandardConverter
  let tokens: TestERC20[]
  let getBalances: (
    who: string
  ) => Promise<{
    weth9: bigint
    token0: bigint
    token1: bigint
    token2: bigint
  }>
  //
  // let loadFixture: ReturnType<typeof waffle.createFixtureLoader>
  //
  before('create fixture loader', async () => {
    ;[wallet, trader] = await (ethers as any).getSigners()
  //   loadFixture = waffle.createFixtureLoader([wallet, trader])
  })

  // helper for getting weth and token balances
  beforeEach('load fixture', async () => {
    ;({ router, weth9, factory, tokens, nft, converter } = await loadFixture(swapRouterFixture))

    getBalances = async (who: string) => {
      const balances = await Promise.all([
        weth9.balanceOf(who),
        tokens[0].balanceOf(who),
        tokens[1].balanceOf(who),
        tokens[2].balanceOf(who),
      ])
      return {
        weth9: balances[0],
        token0: balances[1],
        token1: balances[2],
        token2: balances[3],
      }
    }
  })

  // ensure the swap router never ends up with a balance
  afterEach('load fixture', async () => {
    const balances = await getBalances(router.target.toString())
    expect(Object.values(balances).every((b) => b == 0n)).to.be.eq(true)
    const balance = await ethers.provider.getBalance(router.target.toString())
    expect(balance == 0n).to.be.eq(true)
  })

  it('bytecode size', async () => {
    expect(((await ethers.provider.getCode(router.target.toString())).length - 2) / 2).to.matchSnapshot()
  })

  describe('swaps', () => {
    const liquidity = 1000000
    async function createPool(tokenAddressA0: string, tokenAddressB0: string, tokenAddressA1: string, tokenAddressB1: string) {
      if (tokenAddressA0.toLowerCase() > tokenAddressB0.toLowerCase()) {
        [tokenAddressA0, tokenAddressB0, tokenAddressA1, tokenAddressB1] = [tokenAddressB0, tokenAddressA0, tokenAddressB1, tokenAddressA1]
      }

      await nft.createAndInitializePoolIfNecessary(
        tokenAddressA0,
        tokenAddressB0,
        tokenAddressA1,
        tokenAddressB1,
        FeeAmount.MEDIUM,
        encodePriceSqrt(1n, 1n)
      )

      const liquidityParams = {
        token0: tokenAddressA0,
        token1: tokenAddressB0,
        fee: FeeAmount.MEDIUM,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: wallet.address,
        amount0Desired: 1000000,
        amount1Desired: 1000000,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 1,
      }

      return nft.mint(liquidityParams)
    }

    async function createPoolWETH9(tokenAddress: string) {
      await weth9.deposit({ value: liquidity })
      await weth9.approve(nft.target.toString(), ethers.MaxUint256)
      // get addresses from converter
      let token3 = await converter.predictWrapperAddress(weth9.target.toString(), true);
      let token4 = await converter.predictWrapperAddress(tokenAddress, true);

      return createPool(weth9.target.toString(), tokenAddress, token3, token4)
    }

    beforeEach('create 0-1 and 1-2 pools', async () => {
      await createPool(tokens[0].target.toString(), tokens[1].target.toString(), tokens[3].target.toString(), tokens[4].target.toString())
      await createPool(tokens[1].target.toString(), tokens[2].target.toString(), tokens[4].target.toString(), tokens[5].target.toString())
    })

    describe('#exactInput', () => {
      async function exactInput(
        tokens: string[],
        amountIn: number = 3,
        amountOutMinimum: number = 1
      ): Promise<ContractTransactionResponse> {
        const inputIsWETH = weth9.target.toString() === tokens[0]
        const outputIsWETH9 = tokens[tokens.length - 1] === weth9.target.toString()

        const value = inputIsWETH ? amountIn : 0

        const params = {
          path: encodePath(tokens, new Array(tokens.length - 1).fill(FeeAmount.MEDIUM)),
          recipient: outputIsWETH9 ? ethers.ZeroAddress : trader.address,
          deadline: 1,
          amountIn,
          amountOutMinimum,
          prefer223Out: false
        }

        const data = [router.interface.encodeFunctionData('exactInput', [params])]
        if (outputIsWETH9)
          data.push(router.interface.encodeFunctionData('unwrapWETH9', [amountOutMinimum, trader.address]))

        // ensure that the swap fails if the limit is any tighter
        params.amountOutMinimum += 1
        await expect(router.connect(trader).exactInput(params, { value })).to.be.revertedWith('Too little received')
        params.amountOutMinimum -= 1

        // optimized for the gas test
        return data.length === 1
          ? router.connect(trader).exactInput(params, { value })
          : router.connect(trader).multicall(data, { value })
      }

      describe('single-pool', () => {
        it('0 -> 1', async () => {
          const pool = await factory.getPool(tokens[0].target.toString(), tokens[1].target.toString(), FeeAmount.MEDIUM)

          // get balances before
          const poolBefore = await getBalances(pool)
          const traderBefore = await getBalances(trader.address)

          await exactInput(tokens.slice(0, 2).map((token) => token.target.toString()))

          // get balances after
          const poolAfter = await getBalances(pool)
          const traderAfter = await getBalances(trader.address)

          expect(traderAfter.token0).to.be.eq(traderBefore.token0 - 3n)
          expect(traderAfter.token1).to.be.eq(traderBefore.token1 + 1n)
          expect(poolAfter.token0).to.be.eq(poolBefore.token0 + 3n)
          expect(poolAfter.token1).to.be.eq(poolBefore.token1 - 1n)
        })

        it('1 -> 0', async () => {
          const pool = await factory.getPool(tokens[1].target.toString(), tokens[0].target.toString(), FeeAmount.MEDIUM)

          // get balances before
          const poolBefore = await getBalances(pool)
          const traderBefore = await getBalances(trader.address)

          await exactInput(
            tokens
              .slice(0, 2)
              .reverse()
              .map((token) => token.target.toString())
          )

          // get balances after
          const poolAfter = await getBalances(pool)
          const traderAfter = await getBalances(trader.address)

          expect(traderAfter.token0).to.be.eq(traderBefore.token0 + 1n)
          expect(traderAfter.token1).to.be.eq(traderBefore.token1 - 3n)
          expect(poolAfter.token0).to.be.eq(poolBefore.token0 - 1n)
          expect(poolAfter.token1).to.be.eq(poolBefore.token1 + 3n)
        })
      })

      describe('multi-pool', () => {
        it('0 -> 1 -> 2', async () => {
          const traderBefore = await getBalances(trader.address)

          await exactInput(
            tokens.map((token) => token.target.toString()),
            5,
            1
          )

          const traderAfter = await getBalances(trader.address)

          expect(traderAfter.token0).to.be.eq(traderBefore.token0 - 5n)
          expect(traderAfter.token2).to.be.eq(traderBefore.token2 + 1n)
        })

        it('2 -> 1 -> 0', async () => {
          const traderBefore = await getBalances(trader.address)

          await exactInput(tokens.map((token) => token.target.toString()).reverse(), 5, 1)

          const traderAfter = await getBalances(trader.address)

          expect(traderAfter.token2).to.be.eq(traderBefore.token2 - 5n)
          expect(traderAfter.token0).to.be.eq(traderBefore.token0 - 1n)
        })

        it('events', async () => {
          await expect(
            exactInput(
              tokens.map((token) => token.target.toString()),
              5,
              1
            )
          )
            .to.emit(tokens[0], 'Transfer')
            .withArgs(
              trader.address,
              computePoolAddress(factory.target.toString(), [tokens[0].target.toString(), tokens[1].target.toString()], FeeAmount.MEDIUM),
              5
            )
            .to.emit(tokens[1], 'Transfer')
            .withArgs(
              computePoolAddress(factory.target.toString(), [tokens[0].target.toString(), tokens[1].target.toString()], FeeAmount.MEDIUM),
              router.target.toString(),
              3
            )
            .to.emit(tokens[1], 'Transfer')
            .withArgs(
              router.target.toString(),
              computePoolAddress(factory.target.toString(), [tokens[1].target.toString(), tokens[2].target.toString()], FeeAmount.MEDIUM),
              3
            )
            .to.emit(tokens[2], 'Transfer')
            .withArgs(
              computePoolAddress(factory.target.toString(), [tokens[1].target.toString(), tokens[2].target.toString()], FeeAmount.MEDIUM),
              trader.address,
              1
            )
        })
      })

      describe('ETH input', () => {
        describe('WETH9', () => {
          beforeEach(async () => {
            await createPoolWETH9(tokens[0].target.toString())
          })

          it('WETH9 -> 0', async () => {
            const pool = await factory.getPool(weth9.target.toString(), tokens[0].target.toString(), FeeAmount.MEDIUM)

            // get balances before
            const poolBefore = await getBalances(pool)
            const traderBefore = await getBalances(trader.address)

            await expect(exactInput([weth9.target.toString(), tokens[0].target.toString()]))
              .to.emit(weth9, 'Deposit')
              .withArgs(router.target.toString(), 3)

            // get balances after
            const poolAfter = await getBalances(pool)
            const traderAfter = await getBalances(trader.address)

            expect(traderAfter.token0).to.be.eq(traderBefore.token0 - 1n)
            expect(poolAfter.weth9).to.be.eq(poolBefore.weth9 + 3n)
            expect(poolAfter.token0).to.be.eq(poolBefore.token0 - 1n)
          })

          it('WETH9 -> 0 -> 1', async () => {
            const traderBefore = await getBalances(trader.address)

            await expect(exactInput([weth9.target.toString(), tokens[0].target.toString(), tokens[1].target.toString()], 5))
              .to.emit(weth9, 'Deposit')
              .withArgs(router.target.toString(), 5)

            const traderAfter = await getBalances(trader.address)

            expect(traderAfter.token1).to.be.eq(traderBefore.token1 - 1n)
          })
        })
      })

      describe('ETH output', () => {
        describe('WETH9', () => {
          beforeEach(async () => {
            await createPoolWETH9(tokens[0].target.toString())
            await createPoolWETH9(tokens[1].target.toString())
          })

          it('0 -> WETH9', async () => {
            const pool = await factory.getPool(tokens[0].target.toString(), weth9.target.toString(), FeeAmount.MEDIUM)

            // get balances before
            const poolBefore = await getBalances(pool)
            const traderBefore = await getBalances(trader.address)

            await expect(exactInput([tokens[0].target.toString(), weth9.target.toString()]))
              .to.emit(weth9, 'Withdrawal')
              .withArgs(router.target.toString(), 1)

            // get balances after
            const poolAfter = await getBalances(pool)
            const traderAfter = await getBalances(trader.address)

            expect(traderAfter.token0).to.be.eq(traderBefore.token0 - 3n)
            expect(poolAfter.weth9).to.be.eq(poolBefore.weth9 - 1n)
            expect(poolAfter.token0).to.be.eq(poolBefore.token0 + 3n)
          })

          it('0 -> 1 -> WETH9', async () => {
            // get balances before
            const traderBefore = await getBalances(trader.address)

            await expect(exactInput([tokens[0].target.toString(), tokens[1].target.toString(), weth9.target.toString()], 5))
              .to.emit(weth9, 'Withdrawal')
              .withArgs(router.target.toString(), 1)

            // get balances after
            const traderAfter = await getBalances(trader.address)

            expect(traderAfter.token0).to.be.eq(traderBefore.token0 - 5n)
          })
        })
      })
    })

    describe('#exactInputSingle', () => {
      async function exactInputSingle(
        tokenIn: string,
        tokenOut: string,
        amountIn: number = 3,
        amountOutMinimum: number = 1,
        sqrtPriceLimitX96?: bigint
      ): Promise<ContractTransactionResponse> {
        const inputIsWETH = weth9.target.toString() === tokenIn
        const outputIsWETH9 = tokenOut === weth9.target.toString()

        const value = inputIsWETH ? amountIn : 0

        const params = {
          tokenIn,
          tokenOut,
          fee: FeeAmount.MEDIUM,
          sqrtPriceLimitX96:
            sqrtPriceLimitX96 ?? tokenIn.toLowerCase() < tokenOut.toLowerCase()
              ? BigInt('4295128740')
              : BigInt('1461446703485210103287273052203988822378723970341'),
          recipient: outputIsWETH9 ? ethers.ZeroAddress : trader.address,
          deadline: 1,
          amountIn,
          amountOutMinimum,
          prefer223Out: false
        }

        const data = [router.interface.encodeFunctionData('exactInputSingle', [params])]
        if (outputIsWETH9)
          data.push(router.interface.encodeFunctionData('unwrapWETH9', [amountOutMinimum, trader.address]))

        // ensure that the swap fails if the limit is any tighter
        params.amountOutMinimum += 1
        await expect(router.connect(trader).exactInputSingle(params, { value })).to.be.revertedWith(
          'Too little received'
        )
        params.amountOutMinimum -= 1

        // optimized for the gas test
        return data.length === 1
          ? router.connect(trader).exactInputSingle(params, { value })
          : router.connect(trader).multicall(data, { value })
      }

      it('0 -> 1', async () => {
        const pool = await factory.getPool(tokens[0].target.toString(), tokens[1].target.toString(), FeeAmount.MEDIUM)

        // get balances before
        const poolBefore = await getBalances(pool)
        const traderBefore = await getBalances(trader.address)

        await exactInputSingle(tokens[0].target.toString(), tokens[1].target.toString())

        // get balances after
        const poolAfter = await getBalances(pool)
        const traderAfter = await getBalances(trader.address)

        expect(traderAfter.token0).to.be.eq(traderBefore.token0 - 3n)
        expect(traderAfter.token1).to.be.eq(traderBefore.token1 - 1n)
        expect(poolAfter.token0).to.be.eq(poolBefore.token0 + 3n)
        expect(poolAfter.token1).to.be.eq(poolBefore.token1 - 1n)
      })

      it('1 -> 0', async () => {
        const pool = await factory.getPool(tokens[1].target.toString(), tokens[0].target.toString(), FeeAmount.MEDIUM)

        // get balances before
        const poolBefore = await getBalances(pool)
        const traderBefore = await getBalances(trader.address)

        await exactInputSingle(tokens[1].target.toString(), tokens[0].target.toString())

        // get balances after
        const poolAfter = await getBalances(pool)
        const traderAfter = await getBalances(trader.address)

        expect(traderAfter.token0).to.be.eq(traderBefore.token0 - 1n)
        expect(traderAfter.token1).to.be.eq(traderBefore.token1 - 3n)
        expect(poolAfter.token0).to.be.eq(poolBefore.token0 - 1n)
        expect(poolAfter.token1).to.be.eq(poolBefore.token1 + 3n)
      })

      describe('ETH input', () => {
        describe('WETH9', () => {
          beforeEach(async () => {
            await createPoolWETH9(tokens[0].target.toString())
          })

          it('WETH9 -> 0', async () => {
            const pool = await factory.getPool(weth9.target.toString(), tokens[0].target.toString(), FeeAmount.MEDIUM)

            // get balances before
            const poolBefore = await getBalances(pool)
            const traderBefore = await getBalances(trader.address)

            await expect(exactInputSingle(weth9.target.toString(), tokens[0].target.toString()))
              .to.emit(weth9, 'Deposit')
              .withArgs(router.target.toString(), 3)

            // get balances after
            const poolAfter = await getBalances(pool)
            const traderAfter = await getBalances(trader.address)

            expect(traderAfter.token0).to.be.eq(traderBefore.token0 - 1n)
            expect(poolAfter.weth9).to.be.eq(poolBefore.weth9 + 3n)
            expect(poolAfter.token0).to.be.eq(poolBefore.token0 - 1n)
          })
        })
      })

      describe('ETH output', () => {
        describe('WETH9', () => {
          beforeEach(async () => {
            await createPoolWETH9(tokens[0].target.toString())
            await createPoolWETH9(tokens[1].target.toString())
          })

          it('0 -> WETH9', async () => {
            const pool = await factory.getPool(tokens[0].target.toString(), weth9.target.toString(), FeeAmount.MEDIUM)

            // get balances before
            const poolBefore = await getBalances(pool)
            const traderBefore = await getBalances(trader.address)

            await expect(exactInputSingle(tokens[0].target.toString(), weth9.target.toString()))
              .to.emit(weth9, 'Withdrawal')
              .withArgs(router.target.toString(), 1)

            // get balances after
            const poolAfter = await getBalances(pool)
            const traderAfter = await getBalances(trader.address)

            expect(traderAfter.token0).to.be.eq(traderBefore.token0 - 3n)
            expect(poolAfter.weth9).to.be.eq(poolBefore.weth9 - 1n)
            expect(poolAfter.token0).to.be.eq(poolBefore.token0 + 3n)
          })
        })
      })
    })

    describe('#exactOutput', () => {
      async function exactOutput(
        tokens: string[],
        amountOut: number = 1,
        amountInMaximum: number = 3
      ): Promise<ContractTransactionResponse> {
        const inputIsWETH9 = tokens[0] === weth9.target.toString()
        const outputIsWETH9 = tokens[tokens.length - 1] === weth9.target.toString()

        const value = inputIsWETH9 ? amountInMaximum : 0

        const params = {
          path: encodePath(tokens.slice().reverse(), new Array(tokens.length - 1).fill(FeeAmount.MEDIUM)),
          recipient: outputIsWETH9 ? ethers.ZeroAddress : trader.address,
          deadline: 1,
          amountOut,
          amountInMaximum,
        }

        const data = [router.interface.encodeFunctionData('exactOutput', [params])]
        if (inputIsWETH9) data.push(router.interface.encodeFunctionData('unwrapWETH9', [0, trader.address]))
        if (outputIsWETH9) data.push(router.interface.encodeFunctionData('unwrapWETH9', [amountOut, trader.address]))

        // ensure that the swap fails if the limit is any tighter
        params.amountInMaximum -= 1
        await expect(router.connect(trader).exactOutput(params, { value })).to.be.revertedWith('Too much requested')
        params.amountInMaximum += 1

        return router.connect(trader).multicall(data, { value })
      }

      describe('single-pool', () => {
        it('0 -> 1', async () => {
          const pool = await factory.getPool(tokens[0].target.toString(), tokens[1].target.toString(), FeeAmount.MEDIUM)

          // get balances before
          const poolBefore = await getBalances(pool)
          const traderBefore = await getBalances(trader.address)

          await exactOutput(tokens.slice(0, 2).map((token) => token.target.toString()))

          // get balances after
          const poolAfter = await getBalances(pool)
          const traderAfter = await getBalances(trader.address)

          expect(traderAfter.token0).to.be.eq(traderBefore.token0 - 3n)
          expect(traderAfter.token1).to.be.eq(traderBefore.token1 - 1n)
          expect(poolAfter.token0).to.be.eq(poolBefore.token0 + 3n)
          expect(poolAfter.token1).to.be.eq(poolBefore.token1 - 1n)
        })

        it('1 -> 0', async () => {
          const pool = await factory.getPool(tokens[1].target.toString(), tokens[0].target.toString(), FeeAmount.MEDIUM)

          // get balances before
          const poolBefore = await getBalances(pool)
          const traderBefore = await getBalances(trader.address)

          await exactOutput(
            tokens
              .slice(0, 2)
              .reverse()
              .map((token) => token.target.toString())
          )

          // get balances after
          const poolAfter = await getBalances(pool)
          const traderAfter = await getBalances(trader.address)

          expect(traderAfter.token0).to.be.eq(traderBefore.token0 - 1n)
          expect(traderAfter.token1).to.be.eq(traderBefore.token1 - 3n)
          expect(poolAfter.token0).to.be.eq(poolBefore.token0 - 1n)
          expect(poolAfter.token1).to.be.eq(poolBefore.token1 + 3n)
        })
      })

      describe('multi-pool', () => {
        it('0 -> 1 -> 2', async () => {
          const traderBefore = await getBalances(trader.address)

          await exactOutput(
            tokens.map((token) => token.target.toString()),
            1,
            5
          )

          const traderAfter = await getBalances(trader.address)

          expect(traderAfter.token0).to.be.eq(traderBefore.token0 - 5n)
          expect(traderAfter.token2).to.be.eq(traderBefore.token2 - 1n)
        })

        it('2 -> 1 -> 0', async () => {
          const traderBefore = await getBalances(trader.address)

          await exactOutput(tokens.map((token) => token.target.toString()).reverse(), 1, 5)

          const traderAfter = await getBalances(trader.address)

          expect(traderAfter.token2).to.be.eq(traderBefore.token2 - 5n)
          expect(traderAfter.token0).to.be.eq(traderBefore.token0 - 1n)
        })

        it('events', async () => {
          await expect(
            exactOutput(
              tokens.map((token) => token.target.toString()),
              1,
              5
            )
          )
            .to.emit(tokens[2], 'Transfer')
            .withArgs(
              computePoolAddress(factory.target.toString(), [tokens[2].target.toString(), tokens[1].target.toString()], FeeAmount.MEDIUM),
              trader.address,
              1
            )
            .to.emit(tokens[1], 'Transfer')
            .withArgs(
              computePoolAddress(factory.target.toString(), [tokens[1].target.toString(), tokens[0].target.toString()], FeeAmount.MEDIUM),
              computePoolAddress(factory.target.toString(), [tokens[2].target.toString(), tokens[1].target.toString()], FeeAmount.MEDIUM),
              3
            )
            .to.emit(tokens[0], 'Transfer')
            .withArgs(
              trader.address,
              computePoolAddress(factory.target.toString(), [tokens[1].target.toString(), tokens[0].target.toString()], FeeAmount.MEDIUM),
              5
            )
        })
      })

      describe('ETH input', () => {
        describe('WETH9', () => {
          beforeEach(async () => {
            await createPoolWETH9(tokens[0].target.toString())
          })

          it('WETH9 -> 0', async () => {
            const pool = await factory.getPool(weth9.target.toString(), tokens[0].target.toString(), FeeAmount.MEDIUM)

            // get balances before
            const poolBefore = await getBalances(pool)
            const traderBefore = await getBalances(trader.address)

            await expect(exactOutput([weth9.target.toString(), tokens[0].target.toString()]))
              .to.emit(weth9, 'Deposit')
              .withArgs(router.target.toString(), 3)

            // get balances after
            const poolAfter = await getBalances(pool)
            const traderAfter = await getBalances(trader.address)

            expect(traderAfter.token0).to.be.eq(traderBefore.token0 - 1n)
            expect(poolAfter.weth9).to.be.eq(poolBefore.weth9 + 3n)
            expect(poolAfter.token0).to.be.eq(poolBefore.token0 - 1n)
          })

          it('WETH9 -> 0 -> 1', async () => {
            const traderBefore = await getBalances(trader.address)

            await expect(exactOutput([weth9.target.toString(), tokens[0].target.toString(), tokens[1].target.toString()], 1, 5))
              .to.emit(weth9, 'Deposit')
              .withArgs(router.target.toString(), 5)

            const traderAfter = await getBalances(trader.address)

            expect(traderAfter.token1).to.be.eq(traderBefore.token1 - 1n)
          })
        })
      })

      describe('ETH output', () => {
        describe('WETH9', () => {
          beforeEach(async () => {
            await createPoolWETH9(tokens[0].target.toString())
            await createPoolWETH9(tokens[1].target.toString())
          })

          it('0 -> WETH9', async () => {
            const pool = await factory.getPool(tokens[0].target.toString(), weth9.target.toString(), FeeAmount.MEDIUM)

            // get balances before
            const poolBefore = await getBalances(pool)
            const traderBefore = await getBalances(trader.address)

            await expect(exactOutput([tokens[0].target.toString(), weth9.target.toString()]))
              .to.emit(weth9, 'Withdrawal')
              .withArgs(router.target.toString(), 1)

            // get balances after
            const poolAfter = await getBalances(pool)
            const traderAfter = await getBalances(trader.address)

            expect(traderAfter.token0).to.be.eq(traderBefore.token0 - 3n)
            expect(poolAfter.weth9).to.be.eq(poolBefore.weth9 - 1n)
            expect(poolAfter.token0).to.be.eq(poolBefore.token0 + 3n)
          })

          it('0 -> 1 -> WETH9', async () => {
            // get balances before
            const traderBefore = await getBalances(trader.address)

            await expect(exactOutput([tokens[0].target.toString(), tokens[1].target.toString(), weth9.target.toString()], 1, 5))
              .to.emit(weth9, 'Withdrawal')
              .withArgs(router.target.toString(), 1)

            // get balances after
            const traderAfter = await getBalances(trader.address)

            expect(traderAfter.token0).to.be.eq(traderBefore.token0 - 5n)
          })
        })
      })
    })

    describe('#exactOutputSingle', () => {
      async function exactOutputSingle(
        tokenIn: string,
        tokenOut: string,
        amountOut: number = 1,
        amountInMaximum: number = 3,
        sqrtPriceLimitX96?: bigint
      ): Promise<ContractTransactionResponse> {
        const inputIsWETH9 = tokenIn === weth9.target.toString()
        const outputIsWETH9 = tokenOut === weth9.target.toString()

        const value = inputIsWETH9 ? amountInMaximum : 0

        const params = {
          tokenIn,
          tokenOut,
          fee: FeeAmount.MEDIUM,
          recipient: outputIsWETH9 ? ethers.ZeroAddress : trader.address,
          deadline: 1,
          amountOut,
          amountInMaximum,
          sqrtPriceLimitX96:
            sqrtPriceLimitX96 ?? tokenIn.toLowerCase() < tokenOut.toLowerCase()
              ? BigInt('4295128740')
              : BigInt('1461446703485210103287273052203988822378723970341'),
        }

        const data = [router.interface.encodeFunctionData('exactOutputSingle', [params])]
        if (inputIsWETH9) data.push(router.interface.encodeFunctionData('refundETH'))
        if (outputIsWETH9) data.push(router.interface.encodeFunctionData('unwrapWETH9', [amountOut, trader.address]))

        // ensure that the swap fails if the limit is any tighter
        params.amountInMaximum -= 1
        await expect(router.connect(trader).exactOutputSingle(params, { value })).to.be.revertedWith(
          'Too much requested'
        )
        params.amountInMaximum += 1

        return router.connect(trader).multicall(data, { value })
      }

      it('0 -> 1', async () => {
        const pool = await factory.getPool(tokens[0].target.toString(), tokens[1].target.toString(), FeeAmount.MEDIUM)

        // get balances before
        const poolBefore = await getBalances(pool)
        const traderBefore = await getBalances(trader.address)

        await exactOutputSingle(tokens[0].target.toString(), tokens[1].target.toString())

        // get balances after
        const poolAfter = await getBalances(pool)
        const traderAfter = await getBalances(trader.address)

        expect(traderAfter.token0).to.be.eq(traderBefore.token0 - 3n)
        expect(traderAfter.token1).to.be.eq(traderBefore.token1 - 1n)
        expect(poolAfter.token0).to.be.eq(poolBefore.token0 + 3n)
        expect(poolAfter.token1).to.be.eq(poolBefore.token1 - 1n)
      })

      it('1 -> 0', async () => {
        const pool = await factory.getPool(tokens[1].target.toString(), tokens[0].target.toString(), FeeAmount.MEDIUM)

        // get balances before
        const poolBefore = await getBalances(pool)
        const traderBefore = await getBalances(trader.address)

        await exactOutputSingle(tokens[1].target.toString(), tokens[0].target.toString())

        // get balances after
        const poolAfter = await getBalances(pool)
        const traderAfter = await getBalances(trader.address)

        expect(traderAfter.token0).to.be.eq(traderBefore.token0 - 1n)
        expect(traderAfter.token1).to.be.eq(traderBefore.token1 - 3n)
        expect(poolAfter.token0).to.be.eq(poolBefore.token0 - 1n)
        expect(poolAfter.token1).to.be.eq(poolBefore.token1 + 3n)
      })

      describe('ETH input', () => {
        describe('WETH9', () => {
          beforeEach(async () => {
            await createPoolWETH9(tokens[0].target.toString())
          })

          it('WETH9 -> 0', async () => {
            const pool = await factory.getPool(weth9.target.toString(), tokens[0].target.toString(), FeeAmount.MEDIUM)

            // get balances before
            const poolBefore = await getBalances(pool)
            const traderBefore = await getBalances(trader.address)

            await expect(exactOutputSingle(weth9.target.toString(), tokens[0].target.toString()))
              .to.emit(weth9, 'Deposit')
              .withArgs(router.target.toString(), 3)

            // get balances after
            const poolAfter = await getBalances(pool)
            const traderAfter = await getBalances(trader.address)

            expect(traderAfter.token0).to.be.eq(traderBefore.token0 - 1n)
            expect(poolAfter.weth9).to.be.eq(poolBefore.weth9 + 3n)
            expect(poolAfter.token0).to.be.eq(poolBefore.token0 - 1n)
          })
        })
      })

      describe('ETH output', () => {
        describe('WETH9', () => {
          beforeEach(async () => {
            await createPoolWETH9(tokens[0].target.toString())
            await createPoolWETH9(tokens[1].target.toString())
          })

          it('0 -> WETH9', async () => {
            const pool = await factory.getPool(tokens[0].target.toString(), weth9.target.toString(), FeeAmount.MEDIUM)

            // get balances before
            const poolBefore = await getBalances(pool)
            const traderBefore = await getBalances(trader.address)

            await expect(exactOutputSingle(tokens[0].target.toString(), weth9.target.toString()))
              .to.emit(weth9, 'Withdrawal')
              .withArgs(router.target.toString(), 1)

            // get balances after
            const poolAfter = await getBalances(pool)
            const traderAfter = await getBalances(trader.address)

            expect(traderAfter.token0).to.be.eq(traderBefore.token0 - 3n)
            expect(poolAfter.weth9).to.be.eq(poolBefore.weth9 - 1n)
            expect(poolAfter.token0).to.be.eq(poolBefore.token0 + 3n)
          })
        })
      })
    })

    describe('*WithFee', () => {
      const feeRecipient = '0xfEE0000000000000000000000000000000000000'

      it('#sweepTokenWithFee', async () => {
        const amountOutMinimum = 100
        const params = {
          path: encodePath([tokens[0].target.toString(), tokens[1].target.toString()], [FeeAmount.MEDIUM]),
          recipient: router.target.toString(),
          deadline: 1,
          amountIn: 102,
          amountOutMinimum,
          prefer223Out: false
        }

        const data = [
          router.interface.encodeFunctionData('exactInput', [params]),
          router.interface.encodeFunctionData('sweepTokenWithFee', [
            tokens[1].target.toString(),
            amountOutMinimum,
            trader.address,
            100,
            feeRecipient,
          ]),
        ]

        await router.connect(trader).multicall(data)

        const balance = await tokens[1].balanceOf(feeRecipient)
        expect(balance == 1n).to.be.eq(true)
      })

      it('#unwrapWETH9WithFee', async () => {
        const startBalance = await ethers.provider.getBalance(feeRecipient)
        await createPoolWETH9(tokens[0].target.toString())

        const amountOutMinimum = 100
        const params = {
          path: encodePath([tokens[0].target.toString(), weth9.target.toString()], [FeeAmount.MEDIUM]),
          recipient: router.target.toString(),
          deadline: 1,
          amountIn: 102,
          amountOutMinimum,
          prefer223Out: false
        }

        const data = [
          router.interface.encodeFunctionData('exactInput', [params]),
          router.interface.encodeFunctionData('unwrapWETH9WithFee', [
            amountOutMinimum,
            trader.address,
            100,
            feeRecipient,
          ]),
        ]

        await router.connect(trader).multicall(data)
        const endBalance = await ethers.provider.getBalance(feeRecipient)
        expect((endBalance - startBalance) == 1n).to.be.eq(true)
      })
    })
  })
})
