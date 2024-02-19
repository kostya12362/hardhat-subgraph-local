import { newMockEvent } from "matchstick-as"
import { ethereum, BigInt, Address } from "@graphprotocol/graph-ts"
import {
  DepositETH,
  SetBalance,
  TransferETH,
  TransferToken
} from "../generated/Test/Test"

export function createDepositETHEvent(value: BigInt): DepositETH {
  let depositEthEvent = changetype<DepositETH>(newMockEvent())

  depositEthEvent.parameters = []

  depositEthEvent.parameters.push(
    new ethereum.EventParam("value", ethereum.Value.fromUnsignedBigInt(value))
  )

  return depositEthEvent
}

export function createSetBalanceEvent(
  user: Address,
  value: BigInt
): SetBalance {
  let setBalanceEvent = changetype<SetBalance>(newMockEvent())

  setBalanceEvent.parameters = []

  setBalanceEvent.parameters.push(
    new ethereum.EventParam("user", ethereum.Value.fromAddress(user))
  )
  setBalanceEvent.parameters.push(
    new ethereum.EventParam("value", ethereum.Value.fromUnsignedBigInt(value))
  )

  return setBalanceEvent
}

export function createTransferETHEvent(
  to: Address,
  value: BigInt
): TransferETH {
  let transferEthEvent = changetype<TransferETH>(newMockEvent())

  transferEthEvent.parameters = []

  transferEthEvent.parameters.push(
    new ethereum.EventParam("to", ethereum.Value.fromAddress(to))
  )
  transferEthEvent.parameters.push(
    new ethereum.EventParam("value", ethereum.Value.fromUnsignedBigInt(value))
  )

  return transferEthEvent
}

export function createTransferTokenEvent(
  token: Address,
  to: Address,
  value: BigInt
): TransferToken {
  let transferTokenEvent = changetype<TransferToken>(newMockEvent())

  transferTokenEvent.parameters = []

  transferTokenEvent.parameters.push(
    new ethereum.EventParam("token", ethereum.Value.fromAddress(token))
  )
  transferTokenEvent.parameters.push(
    new ethereum.EventParam("to", ethereum.Value.fromAddress(to))
  )
  transferTokenEvent.parameters.push(
    new ethereum.EventParam("value", ethereum.Value.fromUnsignedBigInt(value))
  )

  return transferTokenEvent
}
