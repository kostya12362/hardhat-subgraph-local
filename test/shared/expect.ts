import { expect, use } from 'chai'
import {  waffle } from 'hardhat'
const solidity = waffle.solidity
import { jestSnapshotPlugin } from 'mocha-chai-jest-snapshot'

use(solidity)
use(jestSnapshotPlugin())

export { expect }
