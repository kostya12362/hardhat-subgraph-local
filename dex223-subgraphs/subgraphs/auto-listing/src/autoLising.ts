import { PairsAdded } from "../generated/AutoListing/autoListing";
import { Pair } from "../generated/schema";

export function handlePairsAdded(event: PairsAdded): void {
  let pairs = event.params.pairs;
  let timestamp = event.block.timestamp;

  for (let i = 0; i < pairs.length; i++) {
    let pair = new Pair(pairs[i].toHex());
    pair.address = pairs[i].toHex();
    pair.timestamp = timestamp;
    pair.save();
  }
}
