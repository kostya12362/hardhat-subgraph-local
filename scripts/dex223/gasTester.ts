// For local testing NODE should be running
// and executed script hardhat:deploy:dex223:local

import { ethers } from 'hardhat';
require('dotenv').config();
import {type AddressLike, BaseContract, type BigNumberish, Contract, Wallet} from "ethers";
import {
    Dex223Factory,
    DexaransNonfungiblePositionManager,
    ERC20Token,
    Dex223Pool, ERC223HybridToken,
    TokenStandardConverter,
    ERC223SwapRouter
} from "../../typechain-types";

import ERC20 from "../../artifacts/contracts/tokens/UsdCoin.sol/UsdCoin.json";
import ERC223 from "../../artifacts/contracts/tokens/ERC223Hybrid.sol/ERC223HybridToken.json";
import Dex223PoolArtifact from "../../artifacts/contracts/core/Dex223Pool.sol/Dex223Pool.json";

import fs from 'fs';
import path from 'path';
import JSBI from "jsbi";
import { encodePriceSqrt } from "./createPool";
import { getPoolData } from "./addLiquidity";
import { nearestUsableTick, Pool, Position } from "@uniswap/v3-sdk";
import {BigintIsh, Token} from "@uniswap/sdk-core";

const provider = ethers.provider;
const folderPath = path.join(__dirname, 'tokens_lists');
const privKey = process.env.PRIVATE_KEY || '';

interface JsonObject {
    [key: string]: any;
}

interface TokenObject {
    chainId: number,
    "decimals": number,
    "symbol": string,
    "name": string,
    "address": string,
    "address223": string
}

/**
 * Reads all JSON files from a specified folder and parses them into objects.
 * @param folderPath - The path to the folder containing JSON files.
 * @returns A promise that resolves to an array of parsed JSON objects.
 */
async function readAndParseJsonFiles(folderPath: string): Promise<JsonObject[]> {
    return new Promise((resolve, reject) => {
        fs.readdir(folderPath, (err, files) => {
            if (err) {
                return reject(`Unable to scan directory: ${err}`);
            }

            const jsonFiles = files.filter(file => path.extname(file).toLowerCase() === '.json');
            const parsedObjects: JsonObject[] = [];

            jsonFiles.forEach(file => {
                const filePath = path.join(folderPath, file);
                try {
                    const fileContents = fs.readFileSync(filePath, 'utf8');
                    const parsedObject: JsonObject = JSON.parse(fileContents);
                    parsedObjects.push(parsedObject);
                } catch (parseError) {
                    return reject(`Error parsing JSON file: ${filePath} - ${parseError}`);
                }
            });

            resolve(parsedObjects);
        });
    });
}

function flatternTokens(tokensLists: JsonObject[], chainId: bigint) {
    const tokens: TokenObject[] = [];
    const addresses: Set<string> = new Set();
    const numChainId = Number(chainId);

    for (let list of tokensLists) {
        for (let token of list.tokens) {
            if (token.chainId !== numChainId) continue;
            const address = token.address0.toLowerCase();

            if (!addresses.has(address)) {
                addresses.add(address);
                const tokenObject: TokenObject = {
                    chainId: token.chainId,
                    decimals: token.decimals ?? 18,
                    symbol: token.symbol || 'UNK',
                    name: token.name || 'Unknown',
                    address: token.address0,
                    address223: token.address1
                }
                tokens.push(tokenObject);
            }
        }
    }

    return tokens;
}

function getUniswapToken(tokenIn: TokenObject) {
    return new Token(
        tokenIn.chainId,
        tokenIn.address,
        tokenIn.decimals,
        tokenIn.symbol,
        tokenIn.name
    )
}

async function mintApproveToken(tokenAddress: string, value: bigint, signer: Wallet, targetAddress: string) {
    const tokenContract = new Contract(
        tokenAddress,
        ERC20.abi,
        provider
    ) as BaseContract as ERC20Token;

    const connectedContract = tokenContract.connect(signer);

    let bal = 0n;
    try {
        bal = await tokenContract.balanceOf(signer);
        // console.log(`${tokenAddress} minted: ${bal}`);
    } catch (e) {
        console.log('Failed to get balance');
    }
    
    if (bal < value) {
        console.log(`Mint ${tokenAddress} : ${value}`);

        try {
            let tx = await connectedContract
                // .connect(signer)
                .mint(signer.address, value, {gasPrice: 5000000000n});
            // console.log('Waiting mint TX');
            await tx.wait(1);
        } catch (e) {
            console.log(e);
        }
    } else {
        console.log('Tokens already minted. Skipping...');
    }

    let appr = 0n;
    try {
        appr = await tokenContract.allowance(signer.address, targetAddress);
    } catch (e) {
        console.log('Failed to get approve');
    }
    if (appr < value) {
        console.log(`Approve ${tokenAddress} : ${value}`);
        try {
            let tx = await connectedContract
                // .connect(signer)
                .approve(
                    targetAddress,
                    value,
            {gasPrice: 5000000000n});   // NOTE for TBNB
            // console.log('Waiting approve TX');
            await tx.wait(1);
        } catch (e) {
            console.log(e);
        }
    } else {
        console.log('Tokens already Approved. Skipping...');
    }
}

async function calcLiquidity(
    poolAddress: string,
    token0: TokenObject,
    token1: TokenObject,
    val: number
) {
    const poolContract = new Contract(poolAddress, Dex223PoolArtifact.abi, provider);
    const poolData = await getPoolData(poolContract);

    const liquidityBigInt = JSBI.BigInt(ethers.parseEther(val.toString()).toString());

    if (token0.address.toLowerCase() > token1.address.toLowerCase()) {
        const temp = token0;
        token0 = token1;
        token1 = temp;
    }

    const pool = new Pool(
        getUniswapToken(token0),
        getUniswapToken(token1),
        poolData.fee,
        poolData.sqrtPriceX96.toString(),
        poolData.liquidity.toString(),
        poolData.tick
    );

    return  { poolData, position: new Position({
        pool,
        liquidity: liquidityBigInt,
        tickLower:
            nearestUsableTick(poolData.tick, Number(poolData.tickSpacing)) -
            Number(poolData.tickSpacing) * 2,
        tickUpper:
            nearestUsableTick(poolData.tick, Number(poolData.tickSpacing)) +
            Number(poolData.tickSpacing) * 2,
    })};
}

async function prepareAddLiquidity(
    poolAddress: string,
    token0: TokenObject,
    token1: TokenObject,
    val: number,
    nfpm: DexaransNonfungiblePositionManager,
    chainId: number = 31337  // default = localhost
) {
    let signer_wallet = await getSigner(chainId);
    if (!signer_wallet) return;

    const { poolData, position} = await calcLiquidity(poolAddress, token0, token1, val);
    
    const { amount0: amount0Desired, amount1: amount1Desired } =
        position.mintAmounts;

    let token0address = token0.address;
    let token1address = token1.address;

    // console.log(`Token ${token0.symbol} amount: ${amount0Desired.toString()}`);
    // console.log(`Token ${token1.symbol} amount: ${amount1Desired.toString()}`);

    try {
        await mintApproveToken(token0address, BigInt(amount0Desired.toString()), signer_wallet, nfpm.target.toString());
        await mintApproveToken(token1address, BigInt(amount1Desired.toString()), signer_wallet, nfpm.target.toString());
    } catch (e) {
        console.error('Could not mint approve token', e);
        return;
    }

    return  {
        token0: token0address,
        token1: token1address,
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
        recipient: signer_wallet.address,
        deadline: Math.floor(Date.now() / 1000) + 60 * 10,
    };
}

async function addLiquidity(
    poolAddress: string,
    token0: TokenObject,
    token1: TokenObject,
    val: number,
    nfpm: DexaransNonfungiblePositionManager,
    chainId: number = 31337  // default = localhost
) {
    let signer_wallet = await getSigner(chainId);
    if (!signer_wallet) return;
    
    const params = await prepareAddLiquidity( poolAddress, token0, token1, val, nfpm, chainId);
    console.log(params);
    
    if (params) {
        const tx = await nfpm
            .connect(signer_wallet)
            .mint(params, {gasLimit: 8_000_000});
        await tx.wait();
    }
}

async function getSigner(chainId: number = 31337) {
    let signer_wallet
    if (chainId !== 31337) {
        if (!privKey) {
            console.error('Please set signer PRIVATE KEY in PRIVATE_KEY environment');
            return;
        }
        signer_wallet = new Wallet(privKey, ethers.provider);
    } else {
        [signer_wallet] = await ethers.getSigners();
    }
    return signer_wallet as Wallet;
}

function preparePoolDeploy(
    token0: TokenObject,
    token1: TokenObject,
    fee: number
) {
    // prepare price calc
    let val2 = 1n;
    let val1 = 1n;
    let dec1 = token0.decimals;
    let dec2 = token1.decimals;
    let decDelta = BigInt(Math.abs(dec1 - dec2));
    if (dec1 > dec2) {
        val1 = 10n ** decDelta;
    } else {
        val2 = 10n ** decDelta;
    }

    // swap addresses
    if (token0.address.toLowerCase() > token1.address.toLowerCase()) {
        const temp = token0;
        token0 = token1;
        token1 = temp;
        const valt = val2;
        val2 = val1;
        val1 = valt;
    }
    let price = encodePriceSqrt(val2, val1);

    // console.dir(token0);
    // console.dir(token1);
    // console.log(price);

    return { t1: token0.address, t2: token1.address, t3: token0.address223, t4: token1.address223, fee, price };
}

async function deployPool(
    token0: TokenObject,
    token1: TokenObject,
    fee: number,
    nfpm: DexaransNonfungiblePositionManager,
    chainId: number = 31337  // default = localhost
) {
    console.log(`Deploy pool: ${token0.address} | ${token1.address} | ${token0.address223} | ${token1.address223}`);

    let signer_wallet = await getSigner(chainId);

    const pp = preparePoolDeploy(token0, token1, fee);

    const tx = await nfpm
        .connect(signer_wallet)
        .createAndInitializePoolIfNecessary(pp.t1, pp.t2, pp.t3, pp.t4, pp.fee, pp.price,
            { gasLimit: 8_000_000 });
    await tx.wait();
}

async function addPoolAndMint(
    token0: TokenObject,
    token1: TokenObject,
    fee: number,
    factoryContract: Dex223Factory,
    nfpm: DexaransNonfungiblePositionManager,
    chainId: number = 31337  // default = localhost
) {
    await deployPool(token0, token1, fee, nfpm, chainId);
    const address = await factoryContract.getPool(token0.address, token1.address, fee);
    await addLiquidity(address, token0, token1, 10, nfpm, chainId);
    return address;
}

async function main() {
    const network = await ethers.provider.getNetwork();
    const chainId = network.chainId;

    let netName;
    switch (Number(chainId)) {
        case 11155111: netName = 'sepolia'; break;
        case 97: netName = 'tbnb'; break;
        case 15557: netName = 'eostest'; break;
        default: netName = 'localhost';
    }
    
    // console.dir(tokens);
    const fee = 3000;

    console.log(`Testing transactions gas for ChainId: ${chainId}`);

    const FACTORY = require(`../../deployments/${netName}/dex223/Factory/result.json`);
    const NFPM = require(`../../deployments/${netName}/dex223/DexaransNonfungiblePositionManager/result.json`);
    const ROUTER = require(`../../deployments/${netName}/dex223/SwapRouter/result.json`);
    const CONV = require(`../../deployments/${netName}/dex223/TokenConvertor/result.json`);
    const WETH9 = require(`../../deployments/${netName}/dex223/WETH9/result.json`);
    const wethAddress = WETH9.contractAddress.toLowerCase();

    const factoryContract = new Contract(
        FACTORY.contractAddress,
        FACTORY.abi,
        provider
    ) as BaseContract as Dex223Factory;

    const nfpmContract = new Contract(
        NFPM.contractAddress,
        NFPM.abi,
        provider
    ) as BaseContract as DexaransNonfungiblePositionManager;
    
    const routerContract = new Contract(
        ROUTER.contractAddress,
        ROUTER.abi,
        provider
    ) as BaseContract as ERC223SwapRouter;
    
    const convertContract = new Contract(
        CONV.contractAddress,
        CONV.abi,
        provider
    ) as BaseContract as TokenStandardConverter;


    let tokens: TokenObject[] = [];
    if (netName === 'localhost') {
        const USDC = require(`../../deployments/localhost/dex223/tokens/USDC/result.json`);
        const usdc223 = await convertContract.predictWrapperAddress(USDC.contractAddress, true);
        const DAI = require(`../../deployments/localhost/dex223/tokens/DAI/result.json`);
        const dai223 = await convertContract.predictWrapperAddress(DAI.contractAddress, true);
      
        let obj: TokenObject = {
            chainId: Number(chainId),
            decimals: 6,
            symbol: 'USDC',
            name: 'UsdCoin',
            address: USDC.contractAddress,
            address223: usdc223
        };
        tokens.push(obj);
        
        obj = {
            chainId: Number(chainId),
            decimals: 6,
            symbol: 'DAI',
            name: 'DaiCoin',
            address: DAI.contractAddress,
            address223: dai223
        };
        tokens.push(obj);
    } else {
        const tokensLists = await readAndParseJsonFiles(path.join(folderPath, netName));
        tokens = flatternTokens(tokensLists, chainId);
    }
    
    // console.dir(tokens);
    
    
    let i = 0;
    let tokenA = tokens[i];
    let found = false;
    while (!found) {
        if ([wethAddress, '0xec5aa08386f4b20de1adf9cdf225b71a133ffaba', // '0x8f5ea3d9b780da2d0ab6517ac4f6e697a948794f',
            '0xd0c00cc7ec5c78557beaf61a3dd15bda1b8c7325', '0xe39c469bea1d805e02a31e9d8d2d78a379f2a099',
            '0x304dc7bf30692081b0ab96497f8914362316580e']
            .includes(tokenA.address.toLowerCase())) {
            i++;
            tokenA = tokens[i];
        } else {
            found = true;
        }
    }
    i++;                 
    
    let tokenB = tokens[i];
    found = false;
    while (!found) {
        if ([wethAddress, '0xec5aa08386f4b20de1adf9cdf225b71a133ffaba', '0x8f5ea3d9b780da2d0ab6517ac4f6e697a948794f',
            '0xd0c00cc7ec5c78557beaf61a3dd15bda1b8c7325', '0xe39c469bea1d805e02a31e9d8d2d78a379f2a099',
            '0xc676e76573267cc2e053be8637ba71d6ba321195', '0x51a3f4b5ffa9125da78b55ed201efd92401604fa',
            '0x98b925ecc32ce2b8b7458ff4bd489052e58e3cd9', '0x0684f8a7cc01ad4a253df7d55340688f8173d520',
            '0x304dc7bf30692081b0ab96497f8914362316580e', '0x094616f0bdfb0b526bd735bf66eca0ad254ca81f']
            .includes(tokenB.address.toLowerCase())) {
            i++;
            tokenB = tokens[i];
        } else {
            found = true;
        }
    }

    let signer_wallet = await getSigner(Number(chainId));
    if (!signer_wallet) return;
    
    // const a = await  poolContract.token0();
    // console.dir(a);
    // const b = await  poolContract.token1();
    // console.dir(b);
    // const c = await poolContract.converter();
    // console.log(c);
    
    if (tokenA.address.toLowerCase() > tokenB.address223.toLowerCase()) {
        const tes = tokenA;
        tokenA = tokenB;
        tokenB = tes;
    }

    let tokenB_223address = await convertContract.predictWrapperAddress(tokenB.address, true);
    const token223Contract = new Contract(
        tokenB_223address,
        ERC223.abi,
        provider
    ) as BaseContract as ERC223HybridToken;

    console.log(`TokenA: ${tokenA.name} | ${tokenA.address}`);
    console.log(`TokenB: ${tokenB.name} | ${tokenB.address}`);
    console.log(`TokenB (223): ${tokenB_223address}`);

    let pool: string;
    if (netName === 'localhost') {
        // on localhost need to deploy test pool and mint some liquidity
        const address = await factoryContract.getPool(tokenA.address, tokenB.address, fee);
        if (address === ethers.ZeroAddress) {
            // pool = await addPoolAndMint(tokenA, tokenB, fee, factoryContract, nfpmContract, Number(chainId));
            await deployPool(tokenA, tokenB, fee, nfpmContract, Number(chainId));
            pool = await factoryContract.getPool(tokenA.address, tokenB.address, fee);
            console.log(`Created pool: ${pool}`);
        } else {
            pool = address;
            console.log(`Pool exists: ${pool}`);
        }
        await addLiquidity(pool, tokenA, tokenB, 10, nfpmContract, Number(chainId));
    } else {
        // assume that pool already has liquidity
        pool = await factoryContract.getPool(tokenA.address, tokenB.address, fee);
    }

    const poolContract = new Contract(
        pool,
        Dex223PoolArtifact.abi,
        provider
    ) as BaseContract as Dex223Pool;

    // - pool create
    {
        console.log('\n-- 1. pool create GAS calc:')
        const pp = preparePoolDeploy(tokenA, tokenB, 500);

        try {
            const tx = await nfpmContract
                .connect(signer_wallet)
                .createAndInitializePoolIfNecessary.estimateGas(pp.t1, pp.t2, pp.t3, pp.t4, pp.fee, pp.price,
                    {gasLimit: 8_000_000});
            console.log(`gas usage: ${tx}`);
        } catch (e) {
            console.error('-- pool create GAS calc FAIL');
        }
    }

    console.log(`\n-- Preparing data for tests --`);
    
    // mint and approve minimum required  tokens for tests
    // maybe use fromAmount0 or fromAmount1 to get position
    const { poolData, position} = await calcLiquidity(pool, tokenA, tokenB, 1);
    
    // console.dir(position);
    // const { amount0: amount00Desired, amount1: amount10Desired } = position.mintAmounts;
    // console.log(amount00Desired.toString(), amount10Desired.toString());

    const minPosition = Position.fromAmount0({
            pool: position.pool, 
            tickLower: position.tickLower, 
            tickUpper: position.tickUpper,
            amount0: 10, 
            useFullPrecision: false});

    // console.dir(minPosition);
    
    const { amount0: amount0Desired, amount1: amount1Desired } = minPosition.mintAmounts;
    // console.log(amount0Desired.toString(), amount1Desired.toString());

    let amount0int = BigInt(amount0Desired.toString());
    let amount1int = BigInt(amount1Desired.toString());
    if (amount0int === 0n) amount0int = 2n;
    if (amount1int === 0n) amount1int = 2n;
    
    console.log(`Token 0 amount: ${amount0int}`);
    console.log(`Token 1 amount: ${amount1int}`);
    
    let token0address = tokenA.address.toLowerCase();
    let token1address = tokenB.address.toLowerCase();

    try {
        await mintApproveToken(token0address, amount0int + 1n, signer_wallet, nfpmContract.target.toString());
        await mintApproveToken(token1address, amount1int + 1n, signer_wallet, nfpmContract.target.toString());
        await mintApproveToken(token0address, amount0int + 1n, signer_wallet, routerContract.target.toString());
        await mintApproveToken(token1address, amount1int + 1n, signer_wallet, routerContract.target.toString());

        let bal = 0n;
        try {
            bal = await token223Contract.balanceOf(signer_wallet.address);
        } catch (e) {}
        if (bal < amount1int + 1n) {
            await mintApproveToken(token1address, amount1int + 1n, signer_wallet, convertContract.target.toString());
            await convertContract.connect(signer_wallet).convertERC20(token1address, amount1int + 1n);
        }
    } catch (e) {
        console.error('Could not mint approve token', e);
        return;
    }

    // - mint position
    {
        console.log('\n-- 2. mint position GAS calc:')

        try {
            const params = {
                token0: token0address,
                token1: token1address,
                fee: poolData.fee,
                tickLower:
                    nearestUsableTick(poolData.tick, Number(poolData.tickSpacing)) -
                    Number(poolData.tickSpacing) * 2,
                tickUpper:
                    nearestUsableTick(poolData.tick, Number(poolData.tickSpacing)) +
                    Number(poolData.tickSpacing) * 2,
                amount0Desired: amount0int, //.toString(),
                amount1Desired: amount1int, //.toString(),
                amount0Min: 0,
                amount1Min: 0,
                recipient: signer_wallet.address,
                deadline: Math.floor(Date.now() / 1000) + 60 * 10,
            };
            
            if (params) {
                const tx = await nfpmContract
                    .connect(signer_wallet)
                    .mint.estimateGas(params, {gasLimit: 8_000_000});
                console.log(`gas usage: ${tx}`);
            } else {
                console.log(`gas usage: undefined`);
            }
        } catch (e) {
            console.error('-- mint position GAS calc FAIL');
        }
    }
    
    // Find tokenID
    const numPositions = await nfpmContract.balanceOf(signer_wallet.address);
    
    const calls = [];
    for (let i = 0; i < numPositions; i++) {
        calls.push(
            nfpmContract.tokenOfOwnerByIndex(signer_wallet.address, i)
        );
    }
    const positionIds = await Promise.all(calls);
    
    // console.log(`Positions: ${positionIds.length}`);
    // console.log(`Positions: ${positionIds}`);
    
    let tokenId: bigint = 0n;
    for (let id of positionIds) {
        const p = await nfpmContract.positions(id);
        // console.dir(p);
        if (p.token0.toLowerCase() === token0address || p.token1.toLowerCase() === token0address) {
            if (p.token0.toLowerCase() === token1address || p.token1.toLowerCase() === token1address) {
                tokenId = id;
                console.log(`\nFound tokenId: ${id}`);
                // console.dir(p);
                break;
            }
        }
    }
    
    // process.exit(0);

    // - increaseLiquidity ERC20
    {
        console.log('\n-- 3. increaseLiquidity ERC20 GAS calc:')

        try {
            if (tokenId) {

                const ilParams = {
                    tokenId,
                    amount0Desired: amount0int.toString(),
                    amount1Desired: amount1int.toString(),
                    amount0Min: 0,
                    amount1Min: 0,
                    deadline: Math.floor(Date.now() / 1000) + 60 * 10,
                };

                const tx = await nfpmContract
                    .connect(signer_wallet)
                    .increaseLiquidity.estimateGas(ilParams, {gasLimit: 8_000_000});
                console.log(`gas usage: ${tx}`);
            } else {
                console.log(`Skipped - not found TokenID`);
            }
        } catch (e) {
            console.error('-- increaseLiquidity ERC20 GAS calc FAIL');
            console.error(e);
        }
    }
    
    // - increaseLiquidity ERC223
    {
        console.log('\n-- 4. increaseLiquidity ERC20-ERC223 GAS calc:')

        try {
            if (tokenId) {
                
                const callValues =
                    [tokenId, amount0int.toString(), amount1int.toString(), 0, 0, Math.floor(Date.now() / 1000) + 60 * 10];

                // @ts-ignore
                const data = nfpmContract.interface.encodeFunctionData('increaseLiquidity', [callValues]);
                const bytes = ethers.getBytes(data);
                const tx = await token223Contract.connect(signer_wallet)
                    ['transfer(address,uint256,bytes)'].estimateGas(nfpmContract.target, amount1int, bytes, {gasLimit: 8_000_000});

                // const tx = await nfpmContract
                //     .connect(signer_wallet)
                //     .increaseLiquidity.estimateGas(ilParams, {gasLimit: 8_000_000});
                console.log(`gas usage: ${tx}`);
            } else {
                console.log(`Skipped - not found TokenID`);
            }
        } catch (e) {
            console.error('-- increaseLiquidity ERC20-ERC223 GAS calc FAIL');
            console.error(e);
        }
    }
    
    // - decrease liquidity
    {
        console.log('\n-- 5. decreaseLiquidity ERC20 GAS calc:')

        try {
            if (tokenId) {
                const ilParams = {
                    tokenId,
                    liquidity: minPosition.liquidity.toString(),
                    amount0Min: 0, //amount0int,
                    amount1Min: 0, //amount1int,
                    deadline: Math.floor(Date.now() / 1000) + 60 * 10
                }

                const tx = await nfpmContract
                    .connect(signer_wallet)
                    .decreaseLiquidity.estimateGas(ilParams, {gasLimit: 8_000_000});
                console.log(`gas usage: ${tx}`);
            } else {
                console.log(`Skipped - not found TokenID`);
            }
        } catch (e) {
            console.error('-- decreaseLiquidity ERC20 GAS calc FAIL');
            console.error(e);
        }
    }
    
    // - collect
    {
        console.log('\n-- 6. collect ERC20 GAS calc:')

        try {
            // maybe first burn some liquidity
            // get collectable values

            if (tokenId) {
                const ilParams = {
                    pool,
                    tokenId,
                    recipient: signer_wallet.address,
                    amount0Max: 1,
                    amount1Max: 1,
                    tokensOutCode: 0
                }

                const tx = await nfpmContract
                    .connect(signer_wallet)
                    .collect.estimateGas(ilParams, {gasLimit: 8_000_000});
                console.log(`gas usage: ${tx}`);
            }   else {
                console.log(`Skipped - not found TokenID`);
            }
        } catch (e) {
            console.error('-- collect ERC20 GAS calc FAIL');
        }
    }

    {
        console.log('\n-- 7. collect ERC223 GAS calc:')

        try {
            // maybe first burn some liquidity
            // get collectable values

            if (tokenId) {
                const ilParams = {
                    pool,
                    tokenId,
                    recipient: signer_wallet.address,
                    amount0Max: 1,
                    amount1Max: 1,
                    tokensOutCode: 2
                }

                const tx = await nfpmContract
                    .connect(signer_wallet)
                    .collect.estimateGas(ilParams, {gasLimit: 8_000_000});
                console.log(`gas usage: ${tx}`);
            }   else {
                console.log(`Skipped - not found TokenID`);
            }
        } catch (e) {
            console.error('-- collect ERC223 GAS calc FAIL');
        }
    }
    
    // - router swap (20-20)
    {
        console.log('\n-- 8. router swap 20-20 GAS calc:')

        try {
            const ilParams = {
                tokenIn: tokenA.address,
                tokenOut: tokenB.address,
                fee: 3000,
                recipient: signer_wallet.address,
                deadline: Math.floor(Date.now() / 1000) + 60 * 10,
                amountIn: amount0int,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0,
                prefer223Out: false
            }

            const tx = await routerContract
                .connect(signer_wallet)
                .exactInputSingle.estimateGas(ilParams, {gasLimit: 8_000_000});
            console.log(`gas usage: ${tx}`);
        } catch (e) {
            console.error('-- router swap 20-20 GAS calc FAIL');
            console.error(e);
        }
    }
    
    // - router swap (20-223) + convert
    {
        console.log('\n-- 9. router swap 20-223 + convert GAS calc:')

        try {
            const ilParams = {
                tokenIn: tokenA.address,
                tokenOut: tokenB.address,
                fee: 3000,
                recipient: signer_wallet.address,
                deadline: Math.floor(Date.now() / 1000) + 60 * 10,
                amountIn: 1n, // amount0int,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0,
                prefer223Out: true
            }

            const tx = await routerContract
                .connect(signer_wallet)
                .exactInputSingle.estimateGas(ilParams, {gasLimit: 8_000_000});
            console.log(`gas usage: ${tx}`);
        } catch (e) {
            console.error('-- router swap 20-223 GAS calc FAIL');
            console.error(e);
        }
    }
    
    // - router swap (20-223) + convert + deploy
    {
        console.log('\n-- 10. router swap 20-223 + convert + deploy GAS calc:')

        try {
            const ilParams = {
                tokenIn: tokenB.address,
                tokenOut: tokenA.address,
                fee: 3000,
                recipient: signer_wallet.address,
                deadline: Math.floor(Date.now() / 1000) + 60 * 10,
                amountIn: 1n, //amount0int,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0,
                prefer223Out: true
            }

            const tx = await routerContract
                .connect(signer_wallet)
                .exactInputSingle.estimateGas(ilParams, {gasLimit: 8_000_000});
            console.log(`gas usage: ${tx}`);
        } catch (e) {
            console.error('-- router swap 20-223 GAS calc FAIL');
            console.error(e);
        }
    }
    
    // - router swap (223-20)
    {
        console.log('\n-- 11. router swap 223-20 GAS calc:')

        try {
            const callValues =
                [tokenB.address, tokenA.address, 3000, signer_wallet.address, Math.floor(Date.now() / 1000) + 60 * 10,
                    2n/*amount1int*/, 0n, 0n, false];

            // @ts-ignore
            const data = routerContract.interface.encodeFunctionData('exactInputSingle', [callValues]);
            const bytes = ethers.getBytes(data)
            const tx = await token223Contract.connect(signer_wallet)
                ['transfer(address,uint256,bytes)'].estimateGas(routerContract.target, 2n/*amount1int*/, bytes, {gasLimit: 8_000_000});
            console.log(`gas usage: ${tx}`);
        } catch (e) {
            console.error('-- router swap 223-20 GAS calc FAIL');
            console.error(e);
        }
    }
    
    // - router swap (223-223) - if both tokens has 223 version ?
    {
        console.log('\n-- 12. router swap 223-223 + convert + deploy GAS calc:')

        try {
            const callValues =
                [tokenB.address, tokenA.address, 3000, signer_wallet.address, Math.floor(Date.now() / 1000) + 60 * 10,
                    2n/*amount1int*/, 0n, 0n, true];

            // @ts-ignore
            const data = routerContract.interface.encodeFunctionData('exactInputSingle', [callValues]);
            const bytes = ethers.getBytes(data)
            const tx = await token223Contract.connect(signer_wallet)
                ['transfer(address,uint256,bytes)'].estimateGas(routerContract.target, 2n/*amount1int*/, bytes, {gasLimit: 8_000_000});
            console.log(`gas usage: ${tx}`);
        } catch (e) {
            console.error('-- router swap 223-223 GAS calc FAIL');
            console.error(e);
        }
    }
    
    // - direct pool swap
    {
        console.log('\n-- 13. direct pool swap 223-20 GAS calc:')

        try {
            const encoded  = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address'],
                [signer_wallet.address]
            );
            
            const callValues =
                [signer_wallet.address, false, amount1int, 0n, 1461446703485210103287273052203988822378723970342n - 1n, 
                    false, encoded, Math.floor(Date.now() / 1000) + 60 * 10];

            // @ts-ignore
            const data = poolContract.interface.encodeFunctionData('swapExactInput', callValues);
            const bytes = ethers.getBytes(data)
            const tx = await token223Contract.connect(signer_wallet)
                // ['transfer(address,uint256,bytes)'](poolContract.target, amount1int, bytes, {gasLimit: 8_000_000});
                ['transfer(address,uint256,bytes)'].estimateGas(poolContract.target, amount1int, bytes, {gasLimit: 8_000_000});
            console.log(`gas usage: ${tx}`);
        } catch (e) {
            console.error('-- direct pool swap 223-20 GAS calc FAIL');
            console.error(e);
        }
    }
    
    // - direct pool swap + convert + deploy
    {
        console.log('\n-- 14. direct pool swap 223-223  + convert + deploy GAS calc:')

        try {
            const encoded  = ethers.AbiCoder.defaultAbiCoder().encode(
                ['address'],
                [signer_wallet.address]
            );
            
            const callValues =
                [signer_wallet.address, false, amount1int, 0n, 1461446703485210103287273052203988822378723970342n - 1n, 
                    true, encoded, Math.floor(Date.now() / 1000) + 60 * 10];

            // @ts-ignore
            const data = poolContract.interface.encodeFunctionData('swapExactInput', callValues);
            const bytes = ethers.getBytes(data)
            const tx = await token223Contract.connect(signer_wallet)
                // ['transfer(address,uint256,bytes)'](poolContract.target, amount1int, bytes, {gasLimit: 8_000_000});
                ['transfer(address,uint256,bytes)'].estimateGas(poolContract.target, amount1int, bytes, {gasLimit: 8_000_000});
            console.log(`gas usage: ${tx}`);
        } catch (e) {
            console.error('-- direct pool swap 223-223 GAS calc FAIL');
            console.error(e);
        }
    }
    
    process.exit(0);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });