import { TransactionReceipt, TransactionResponse } from '@ethersproject/abstract-provider'
import { expect } from 'chai'
import { Contract, ContractTransaction } from 'ethers'

export default async function snapshotGasCost(
  x:
    | TransactionResponse
    | Promise<TransactionResponse>
    | ContractTransaction
    | Promise<ContractTransaction>
    | TransactionReceipt
    | Promise<BigInt>
    | BigInt
    | Contract
    | Promise<Contract>
): Promise<void> {
  const resolved = await x
  if ('deployTransaction' in resolved) {
    const receipt = await resolved.deployTransaction.wait()
    expect(receipt.gasUsed.toNumber()).toMatchSnapshot()
  } else if ('wait' in resolved) {
    const waited = await resolved.wait()
    expect(waited.gasUsed.toNumber()).toMatchSnapshot()
  }
  // else if (BigInt..isBigNumber(resolved)) {
  //   expect(resolved.toNumber()).toMatchSnapshot()
  // }
}
