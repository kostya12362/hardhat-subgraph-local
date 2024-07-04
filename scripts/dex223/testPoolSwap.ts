import { ethers } from "hardhat";
import { BaseContract, Contract } from "ethers";

import { encodePriceSqrt, expandTo18Decimals } from "./createPool";
import { makeSwap, testMintToken, testDeployPool, testAddLiquidity, getMinTick, getMaxTick } from "./makeSwap";
import { ERC20Token, TokenStandardConverter } from "../../typechain-types";

import USDT from "../../deployments/localhost/dex223/tokens/Tether/result.json";
import USDC from "../../deployments/localhost/dex223/tokens/USDC/result.json";
import BERC201 from "../../deployments/localhost/dex223/tokens/BER1/result.json";
import BERC202 from "../../deployments/localhost/dex223/tokens/BER2/result.json";
import WETH9 from "../../deployments/localhost/dex223/WETH9/result.json";
import CONVERTER from "../../deployments/localhost/dex223/TokenConvertor/result.json";
import {MAX_SQRT_RATIO} from "../../test/shared/utilities";

const provider = ethers.provider;

async function main() {
    const convertContract = new Contract(
        CONVERTER.contractAddress,
        CONVERTER.abi,
        provider) as BaseContract as TokenStandardConverter;

    let usdt = new Contract(
        BERC201.contractAddress,
        BERC201.abi,
        provider
    ) as BaseContract as ERC20Token;

    let usdc = new Contract(
        BERC202.contractAddress,
        BERC202.abi,
        provider
    ) as BaseContract as ERC20Token;

    // let weth = new Contract(
    //     WETH9.contractAddress,
    //     WETH9.abi,
    //     provider
    // ) as BaseContract as ERC20Token;

    /** usdc-usdt pool 3000 */
    let wethPair1 = usdt;
    let wethPair2 = usdc;
    // let wethRatio = 2n ** 127n;
    if (wethPair1.target > wethPair2.target) {
        console.log("Warning: Swapping weth and usdc");
        const temp = wethPair2;
        wethPair2 = wethPair1;
        wethPair1 = temp;
        // wethRatio = 1/3500;
    }

    // let dec1 = await wethPair1.decimals();
    // let dec2 = await wethPair2.decimals();
    let sqrtPrice = encodePriceSqrt(2n ** 127n , 1n);
    console.log(`sqrtPrice: ${sqrtPrice}`);
    let liquidity = expandTo18Decimals(2);

    const wethPair2ERC223 = await convertContract.predictWrapperAddress(wethPair2.target, true);
    const wethPair1ERC223 = await convertContract.predictWrapperAddress(wethPair1.target, true);
    console.log("wethPair1ERC223:", wethPair1ERC223);
    console.log("wethPair2ERC223:", wethPair2ERC223);

    // const wethUsdc3000 = await deployPool(
    //     String(wethPair1.target),
    //     String(wethPair2.target),
    //     wethPair1ERC223,
    //     wethPair2ERC223,
    //     3000,
    //     sqrtPrice
    // );

    const tickSpacing = 60;

    const wethUsdc3000 = await testDeployPool(
        String(wethPair1.target),
        String(wethPair2.target),
        wethPair1ERC223,
        wethPair2ERC223,
        3000n,
        BigInt(tickSpacing),
        sqrtPrice
    );

    console.log(`Pool: USDC and USDT = ${wethUsdc3000}`);

    await testMintToken(wethPair1);
    await testMintToken(wethPair2);

    const tickLower = getMinTick(tickSpacing);
    const tickUpper = getMaxTick(tickSpacing);

    await testAddLiquidity(wethUsdc3000, wethPair1, wethPair2, tickLower, tickUpper, liquidity);

    const sqrPrice = MAX_SQRT_RATIO - (1n);

    await makeSwap(wethUsdc3000, wethPair1, sqrPrice);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
