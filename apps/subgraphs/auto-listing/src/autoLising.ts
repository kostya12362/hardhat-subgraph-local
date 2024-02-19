import { PairsAdded } from "../generated/AutoListing/autoListing";
import { Pair, Metadata } from "../generated/schema";
import { BigInt } from "@graphprotocol/graph-ts";

export function handlePairsAdded(event: PairsAdded): void {
  let pairs = event.params.pairs;
  let timestamp = event.block.timestamp;
  let metadata = Metadata.load("meta");

  if (metadata == null) {
    metadata = new Metadata("meta");
    metadata.numPairs = BigInt.fromI32(0);
    metadata.lastUpdate = timestamp;
  }
  metadata.numPairs = metadata.numPairs.plus(BigInt.fromI32(pairs.length));
  metadata.lastUpdate = timestamp;
  metadata.save();
  for (let i = 0; i < pairs.length; i++) {
    let pair = new Pair(pairs[i].toHex());
    pair.address = pairs[i].toHex();
    pair.timestamp = timestamp;
    pair.blockNumber = event.block.number;
    pair.save();
  }
}
