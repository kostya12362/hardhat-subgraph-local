import { ContractFactory, BaseContract, ContractMethodArgs } from "ethers";

export interface DeployObject {
  contractName: string;
  contractFactory: ContractFactory;
  contractArgs?: ContractMethodArgs<any>; // Specify the type argument for ContractMethodArgs
}

export interface ContractResult extends BaseContract {
  startBlock: number;
  abi: any[];
  contractName: string;
}
