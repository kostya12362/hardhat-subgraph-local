import { ethers } from "hardhat";
import { Contract } from "ethers";
import { deployPool, encodePriceSqrt } from "./createPools";
import { addLiquidity } from "./addLiquidity";
import TETHER from "../../__results__/localhost/mock/Tether/result.json";
import TETHER_ABI from "../../__results__/localhost/mock/Tether/Tether.json";
import USDC from "../../__results__/localhost/mock/UsdCoin/result.json";
import USDC_ABI from "../../__results__/localhost/mock/UsdCoin/UsdCoin.json";
import WBTC from "../../__results__/localhost/mock/WrappedBitcoin/result.json";
import WBTC_ABI from "../../__results__/localhost/mock/WrappedBitcoin/WrappedBitcoin.json";
// import WETH9 from "../../__results__/localhost/uniswap/WETH9/result.json";
// import WETH9_ABI from "../../__results__/localhost/uniswap/WETH9/WETH9.json";
// import { ERC20 } from "../../typechain";

const provider = ethers.provider;

async function setupTokens() {
  const [owner, signer2] = await ethers.getSigners();
  const tether = new Contract(TETHER.contractAddress, TETHER_ABI, provider);
  const usdc = new Contract(USDC.contractAddress, USDC_ABI, provider);
  const wbtc = new Contract(WBTC.contractAddress, WBTC_ABI, provider);

  await tether
    .connect(owner)
    .mint(signer2.address, ethers.parseEther("100000"));
  await usdc.connect(owner).mint(signer2.address, ethers.parseEther("100000"));
  await wbtc.connect(owner).mint(signer2.address, ethers.parseEther("100000"));
  // await weth.connect(owner).mint(signer2.address, ethers.parseEther("100000"));
  console.log("Mint tokens ERC20 finished");
  return [tether, usdc, wbtc];
}

async function main() {
  await setupTokens();
  const usdtUsdc500 = await deployPool(
    TETHER.contractAddress,
    USDC.contractAddress,
    500,
    encodePriceSqrt(1n, 1n)
  );
  console.log(`USDT_USDC_500=${usdtUsdc500}`);
  await addLiquidity(usdtUsdc500);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
