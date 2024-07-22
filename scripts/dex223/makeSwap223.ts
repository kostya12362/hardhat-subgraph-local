import { ethers } from "hardhat";
import { BaseContract, Contract } from "ethers";
import {
    ERC20Token,
    IERC223,
    ERC223SwapRouter,
    ERC223HybridToken, TokenStandardConverter
} from "../../typechain-types";

import SwapRouter from "../../deployments/localhost/dex223/SwapRouter/result.json";
import TokenConvertor from "../../deployments/localhost/dex223/TokenConvertor/result.json";
import TEST_HYBRID_ERC223_C from "../../deployments/localhost/dex223/tokens/testTestHybridC/result.json";
import { encodePath } from "../../test/shared/path";

const provider = ethers.provider;

export async function makeRouteSwap223(
    _token0: ERC20Token,
    _token1: ERC20Token,
    _fee: number,
    _val: number,
    _prefer223Out: boolean
)
{
    console.log("makeRouterSwap223: ", _token0.target, _token1.target, _fee, _val);

    const converter = new Contract(
        TokenConvertor.contractAddress,
        TokenConvertor.abi,
        provider
    ) as BaseContract as TokenStandardConverter;

    const _token0_223 = await converter.predictWrapperAddress(_token0.target, true);
    const _token1_223 = await converter.predictWrapperAddress(_token1.target, true);

    const tokenContract0 = new Contract(
        _token0_223,
        TEST_HYBRID_ERC223_C.abi,
        provider
    ) as BaseContract as ERC223HybridToken;

    const tokenContract1 = new Contract(
        _token1_223,
        TEST_HYBRID_ERC223_C.abi,
        provider
    ) as BaseContract as ERC223HybridToken;

    const routerContract = new Contract(
        SwapRouter.contractAddress,
        SwapRouter.abi,
        provider
    ) as BaseContract as ERC223SwapRouter;

    const [_owner, signer2] = await ethers.getSigners();

    try {
        console.log('trying route swap...');
        // encode path - not used in single swap
        // const encoded  = ethers.AbiCoder.defaultAbiCoder().encode(
        //     ['address'],
        //     [signer2.address]
        // )

        console.log('-- Balances before:');
        let bal0_233 = await tokenContract0.balanceOf(signer2.address);
        let bal0 = await _token0.balanceOf(signer2.address);
        let bal1 = await _token1.balanceOf(signer2.address);
        let bal1_223 = 0n;
        try {
            bal1_223 = await tokenContract1.balanceOf(signer2.address);
        } catch (e) {
            //
        }

        console.log(`TokenIn (ERC223): ${bal0_233}\nTokenIn (ERC20): ${bal0}\nTokenOut (ERC223): ${bal1_223}\nTokenOut (ERC20): ${bal1}`);

        const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
        const swapValues = {
            tokenIn: _token0.target,
            tokenOut: _token1.target,
            fee: _fee,
            recipient: signer2.address,
            deadline,
            amountIn: _val,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0,
            prefer223Out: _prefer223Out
        };

        // @ts-ignore
        const data = routerContract.interface.encodeFunctionData('exactInputSingle', [swapValues]);
        const bytes = ethers.getBytes(data);
        // const result =
            await (tokenContract0 as ERC223HybridToken).connect(signer2)['transfer(address,uint256,bytes)'](routerContract.target, _val, bytes);
        // console.log('result:', result);

        console.log('-- Balances after:');
        bal0_233 = await tokenContract0.balanceOf(signer2.address);
        bal0 = await _token0.balanceOf(signer2.address);
        bal1 = await _token1.balanceOf(signer2.address);
        try {
            bal1_223 = await tokenContract1.balanceOf(signer2.address);
        } catch (e) {
            //
        }

        console.log(`TokenIn (ERC223): ${bal0_233}\nTokenIn (ERC20): ${bal0}\nTokenOut (ERC223): ${bal1_223}\nTokenOut (ERC20): ${bal1}`);
    } catch (e) {
        console.log(e)
    }
}

export async function makeRouteMultiSwap223(
    _token0: IERC223 | ERC20Token,
    _token1: IERC223 | ERC20Token,
    _token2: IERC223 | ERC20Token,
    _fee1: number,
    _fee2: number,
    _val: number,
    _prefer223Out: boolean
)
{
    console.log("makeRouterMultiSwap223: ", _token0.target, _token1.target, _token2.target, _fee1, _fee2, _val);

    const converter = new Contract(
        TokenConvertor.contractAddress,
        TokenConvertor.abi,
        provider
    ) as BaseContract as TokenStandardConverter;

    const _token0_223 = await converter.predictWrapperAddress(_token0.target, true);
    const _token2_223 = await converter.predictWrapperAddress(_token2.target, true);

    const tokenContract0 = new Contract(
        _token0_223,
        TEST_HYBRID_ERC223_C.abi,
        provider
    ) as BaseContract as ERC223HybridToken;

    const tokenContract2 = new Contract(
        _token2_223,
        TEST_HYBRID_ERC223_C.abi,
        provider
    ) as BaseContract as ERC223HybridToken;

    const routerContract = new Contract(
        SwapRouter.contractAddress,
        SwapRouter.abi,
        provider
    ) as BaseContract as ERC223SwapRouter;

    const [_owner, signer2] = await ethers.getSigners();

    try {
        console.log('trying route MULTI swap...');
        // encode path - not used in single swap
        const path = encodePath([_token0.target.toString(), _token1.target.toString(), _token2.target.toString()],
            [_fee1, _fee2]);
        // const encoded  = ethers.AbiCoder.defaultAbiCoder().encode(
        //     ['address', 'address', 'uint24'],
        //     [token0, token1, fee]
        // )

        console.log('-- Balances before swap:');
        let bal0_233 = await tokenContract0.balanceOf(signer2.address);
        let bal0 = await _token0.balanceOf(signer2.address);
        let bal2 = await _token2.balanceOf(signer2.address);
        let bal2_223 = 0n;
        try {
            bal2_223 = await tokenContract2.balanceOf(signer2.address);
        } catch (e) {
            //
        }

        console.log(`TokenIn (ERC223): ${bal0_233}\nTokenIn (ERC20): ${bal0}\nTokenOut (ERC223): ${bal2_223}\nTokenOut (ERC20): ${bal2}`);

        const deadline = Math.floor(Date.now() / 1000) + 60 * 10;

        const swapValues = {
            path,
            recipient: signer2.address,
            deadline,
            amountIn: _val,
            amountOutMinimum: 0,
            prefer223Out: _prefer223Out
        };

        // @ts-ignore
        const data = routerContract.interface.encodeFunctionData('exactInput', [swapValues]);
        const bytes = ethers.getBytes(data)
        // const result =
            await (tokenContract0 as ERC223HybridToken).connect(signer2)['transfer(address,uint256,bytes)'](routerContract.target, _val, bytes);
        // console.log('result:', result);

        console.log('-- Balances after:');
        bal0_233 = await tokenContract0.balanceOf(signer2.address);
        bal0 = await _token0.balanceOf(signer2.address);
        bal2 = await _token2.balanceOf(signer2.address);
        try {
            bal2_223 = await tokenContract2.balanceOf(signer2.address);
        } catch (e) {
            //
        }

        console.log(`TokenIn (ERC223): ${bal0_233}\nTokenIn (ERC20): ${bal0}\nTokenOut (ERC223): ${bal2_223}\nTokenOut (ERC20): ${bal2}`);
    } catch (e) {
        console.log(e)
    }
}