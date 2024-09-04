import { ethers } from "hardhat";
import {BaseContract, Contract} from "ethers";
import {
    ERC20Token,
    IERC223,
    Quoter
} from "../../typechain-types";

import ERC223Quoter from "../../deployments/localhost/dex223/Quoter/result.json";

const provider = ethers.provider;

export async function makeQuote(
    _token0: IERC223 | ERC20Token,
    _token1: IERC223 | ERC20Token,
    _fee: number,
    _val: number
)
 {
     console.log("makeQuote: ", _token0.target, _token1.target, _fee, _val);

     const quoterContract = new Contract(
         ERC223Quoter.contractAddress,
         ERC223Quoter.abi,
         provider
     ) as BaseContract as Quoter;

     try {
         console.log('trying call...');
         //     address tokenIn,
         //     address tokenOut,
         //     uint24 fee,
         //     uint256 amountIn,
         //     uint160 sqrtPriceLimitX96
         const result = await quoterContract.quoteExactInputSingle.staticCall(_token0.target, _token1.target, _fee, _val, 0);
         // const result = await c.callStatic.quoteExactInputSingle(["0xb3746e05813d7dcbbB6DFb0437095e5f70Dbb393",
         // "0x98b925eCc32cE2B8b7458ff4bd489052E58e3Cd9", 10000, 3000,  0]);
         console.log('result:', result);
     } catch (e) {
         console.log(e)
     }
}