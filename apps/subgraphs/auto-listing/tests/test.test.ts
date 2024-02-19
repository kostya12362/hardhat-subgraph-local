import { assert, describe, test, clearStore, beforeAll, afterAll } from "matchstick-as";
import { BigInt } from "@graphprotocol/graph-ts";
import { createDepositETHEvent } from "./test-utils";

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/developer/matchstick/#tests-structure-0-5-0

describe("Describe entity assertions", () => {
  beforeAll(() => {
    let value = BigInt.fromI32(234);
    createDepositETHEvent(value);
  });

  afterAll(() => {
    clearStore();
  });

  // For more test scenarios, see:
  // https://thegraph.com/docs/en/developer/matchstick/#write-a-unit-test

  test("DepositETH created and stored", () => {
    assert.entityCount("DepositETH", 1);

    // 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default address used in newMockEvent() function
    assert.fieldEquals("DepositETH", "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1", "value", "234");

    // More assert options:
    // https://thegraph.com/docs/en/developer/matchstick/#asserts
  });
});
