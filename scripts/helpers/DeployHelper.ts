import { ethers, network } from "hardhat";
import { DeployObject, ContractResult } from "./Types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { chainIdDefaultIdTypeMap } from "./ChainIdDefTypeMap";
import { saveDeployResults } from "./utils";
/**
 * Helper class for deploying contracts.
 */
export class DeployHelper {
  cacheContract: ContractResult[];
  /**
   * Creates an instance of DeployHelper.
   * @param signers The signers to use for deployment.
   * @param enableLogging Whether to enable logging.
   *
   */
  constructor(
    private signers: SignerWithAddress[],
    private readonly enableLogging: boolean = false
  ) {
    this.log("======== State: deploy started ========");
    this.cacheContract = [];
  }

  /**
   * Initializes the DeployHelper instance.
   * @param signers The signers to use for deployment. If null, it uses the default signers.
   * @param enableLogging Whether to enable logging.
   * @returns A Promise that resolves to a DeployHelper instance.
   */
  static async initialize(
    signers: SignerWithAddress[] | null = null,
    enableLogging = false
  ): Promise<DeployHelper> {
    let sgrs;
    if (signers === null) {
      sgrs = await ethers.getSigners();
    } else {
      sgrs = signers;
    }
    return new DeployHelper(sgrs, enableLogging);
  }

  /**
   * Gets the default ID type for the current chain.
   * @returns A Promise that resolves to an object containing the defaultIdType and chainId.
   * @throws Error if the defaultIdType is not found for the chainId.
   */
  async getDefaultIdType(): Promise<{
    defaultIdType: number;
    chainId: number;
  }> {
    const chainId = parseInt(await network.provider.send("eth_chainId"), 16);
    const defaultIdType = chainIdDefaultIdTypeMap.get(chainId);
    if (!defaultIdType) {
      throw new Error(
        `Failed to find defaultIdType in Map for chainId ${chainId}`
      );
    }
    return { defaultIdType, chainId };
  }

  async deployState(obj: DeployObject): Promise<any> {
    const { defaultIdType, chainId } = await this.getDefaultIdType();
    this.log(`found defaultIdType ${defaultIdType} for chainId ${chainId}`);
    const owner = this.signers[0];
    console.log("owner", ...(obj.contractArgs || []));
    const contract = await obj.contractFactory.deploy(
      ...(obj.contractArgs || [])
    );
    const tx = contract.deploymentTransaction();
    this.log(
      `===== ${obj.contractName} =====`,
      `- Contract deployed to address ${contract.target} from ${owner.address}`,
      `- Tranaction = ${tx?.hash || "N/A"}`,
      `- Block deploy (startBlock) = ${tx?.blockNumber || "N/A"}`
    );
    const result: ContractResult = Object.assign(contract, {
      startBlock: tx?.blockNumber || 0,
      abi: JSON.parse(obj.contractFactory.interface.formatJson()),
      contractName: obj.contractName,
    });
    this.cacheContract.push(result);
    return result;
  }

  async deploysSave(rootPath: string, contractPath: string): Promise<void> {
    for (const i in this.cacheContract) {
      const contract = this.cacheContract[i];
      const contractDetail = {
        contractFile: `${rootPath}/${contract.contractName.replace(" ", "")}`,
        contractName: contract.contractName,
        contractAddress: contract.target,
        abi: contract.abi,
        startBlock: contract.startBlock,
      };
      saveDeployResults(contractDetail, contractPath);
    }
  }
  /**
   * Logs the provided arguments if logging is enabled.
   * @param args The arguments to log.
   */
  private log(...args: string[]): void {
    this.enableLogging && console.log(args);
  }
}
