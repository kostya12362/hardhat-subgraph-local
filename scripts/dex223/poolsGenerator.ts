import { ethers } from 'hardhat';
require('dotenv').config();
import { BaseContract, Contract, Wallet } from "ethers";
import {
    Dex223Factory,
    DexaransNonfungiblePositionManager,
    ERC20Token,
} from "../../typechain-types";

import ERC20 from "../../artifacts/contracts/tokens/UsdCoin.sol/UsdCoin.json";
import Dex223Pool from "../../artifacts/contracts/core/Dex223Pool.sol/Dex223Pool.json";

import fs from 'fs';
import path from 'path';
import JSBI from "jsbi";
import { encodePriceSqrt } from "./createPool";
import { getPoolData } from "./addLiquidity";
import { nearestUsableTick, Pool, Position } from "@uniswap/v3-sdk";
import { Token } from "@uniswap/sdk-core";

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

    const bal = await tokenContract.balanceOf(signer);
    if (bal < value) {

        console.log(`Mint ${tokenAddress} : ${value}`);

        try {
            let tx = await connectedContract
                // .connect(signer)
                .mint(signer.address, value);
            console.log('Waiting mint TX');
            await tx.wait(1);
        } catch (e) {
            console.log(e);
        }
    } else {
        console.log('Tokens already minted. Skipping...');
    }

    const appr = await tokenContract.allowance(signer.address, targetAddress);
    if (appr < value) {
        console.log(`Approve ${tokenAddress} : ${value}`);
        try {
            let tx = await connectedContract
                // .connect(signer)
                .approve(
                    targetAddress,
                    value
                );
            console.log('Waiting approve TX');
            await tx.wait(1);
        } catch (e) {
            console.log(e);
        }
    } else {
        console.log('Tokens already Approved. Skipping...');
    }
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

    const poolContract = new Contract(poolAddress, Dex223Pool.abi, provider);
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

    const position = new Position({
        pool,
        liquidity: liquidityBigInt,
        tickLower:
            nearestUsableTick(poolData.tick, Number(poolData.tickSpacing)) -
            Number(poolData.tickSpacing) * 2,
        tickUpper:
            nearestUsableTick(poolData.tick, Number(poolData.tickSpacing)) +
            Number(poolData.tickSpacing) * 2,
    });
    const { amount0: amount0Desired, amount1: amount1Desired } =
        position.mintAmounts;

    let token0address = token0.address;
    let token1address = token1.address;

    console.log(`Token ${token0.symbol} amount: ${amount0Desired.toString()}`);
    console.log(`Token ${token1.symbol} amount: ${amount1Desired.toString()}`);

    try {
        await mintApproveToken(token0address, BigInt(amount0Desired.toString()), signer_wallet, nfpm.target.toString());
        await mintApproveToken(token1address, BigInt(amount1Desired.toString()), signer_wallet, nfpm.target.toString());
    } catch (e) {
        console.error('Could not mint approve token', e);
        return;
    }

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
        amount0Desired: amount0Desired.toString(),
        amount1Desired: amount1Desired.toString(),
        amount0Min: 0,
        amount1Min: 0,
        recipient: signer_wallet.address,
        deadline: Math.floor(Date.now() / 1000) + 60 * 10,
    };
    console.log(params);

    const tx = await nfpm
        .connect(signer_wallet)
        .mint(params); //, { gasLimit: 8_000_000 });
    await tx.wait();
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

async function deployPool(
    token0: TokenObject,
    token1: TokenObject,
    fee: number,
    nfpm: DexaransNonfungiblePositionManager,
    chainId: number = 31337  // default = localhost
) {
    console.log(`Deploy pool: ${token0.address} | ${token1.address} | ${token0.address223} | ${token1.address223}`);

    let signer_wallet = await getSigner(chainId);

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

    console.dir(token0);
    console.dir(token1);
    console.log(price);


    const tx = await nfpm
        .connect(signer_wallet)
        .createAndInitializePoolIfNecessary(token0.address, token1.address, token0.address223, token1.address223, fee, price);
    await tx.wait();
}

async function main() {
    const network = await ethers.provider.getNetwork();
    const chainId = network.chainId;
    let netName; // = 'localhost';
    switch (Number(chainId)) {
        case 11155111: netName = 'sepolia'; break;
        case 97: netName = 'tbnb'; break;
        case 15557: netName = 'eostest'; break;
        default: netName = 'localhost';
    }

    const tokensLists = await readAndParseJsonFiles(path.join(folderPath, netName));
    const tokens = flatternTokens(tokensLists, chainId);
    // console.dir(tokens);
    const fee = Number(process.env.POOL_FEE || '3000');

    console.log(`Generating pools for ChainId: ${chainId} with fee = ${fee}`);

    // NOTE swap sepolia | localhost based on call settings

    // const netName = (Number(chainId) === 31337) ? 'localhost' : 'sepolia';
    const FACTORY = require(`../../deployments/${netName}/dex223/Factory/result.json`);
    const NFPM = require(`../../deployments/${netName}/dex223/DexaransNonfungiblePositionManager/result.json`);

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

    for (let token0 of tokens) {
        for (let token1 of tokens) {
            if (token0.address === token1.address) continue;
            // NOTE skip WBNB
            if ([token0.address.toLowerCase(), token1.address.toLowerCase()].includes('0x094616f0bdfb0b526bd735bf66eca0ad254ca81f') ) continue;
            console.log('-< -- >-');

            const pool = await factoryContract.getPool(token0.address, token1.address, fee);
            if (pool !== ethers.ZeroAddress) { //} && pool !== '0xD48e5DA8E3687c02dd6E6D593Cc8Aa283180B233') {
                console.log(`Exists Pool: ${token0.symbol} | ${token1.symbol}: ${pool}`);
                continue;
            }


            if (pool === ethers.ZeroAddress) {
                await deployPool(token0, token1, fee, nfpmContract, Number(chainId));
            }
            const address = await factoryContract.getPool(token0.address, token1.address, fee);
            console.log(`Pool deployed: ${token0.symbol} | ${token1.symbol}: ${address}`);

            if (address !== ethers.ZeroAddress) {
                await addLiquidity(address, token0, token1, 1, nfpmContract, Number(chainId));
                console.log(`Liquidity added: ${token0.symbol} | ${token1.symbol}: ${address}`);
            }

            process.exit(0);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });