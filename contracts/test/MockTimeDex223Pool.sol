// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import '../core/Dex223Pool.sol';

// used for testing time dependent behavior
contract MockTimeDex223Pool is Dex223Pool {
    // Monday, October 5, 2020 9:00:00 AM GMT-05:00
    uint256 public time = 1601906400;

    // override set function limited to Factory
    function testset(
        address _t0erc223,
        address _t1erc223,
        address _library,
        address _converter
    ) external
    {
        pool_lib = _library;
        token0.erc223 = _t0erc223;
        token1.erc223 = _t1erc223;
        converter     = ITokenStandardConverter(_converter);
    }

    function setFeeGrowthGlobal0X128(uint256 _feeGrowthGlobal0X128) external {
        feeGrowthGlobal0X128 = _feeGrowthGlobal0X128;
    }

    function setFeeGrowthGlobal1X128(uint256 _feeGrowthGlobal1X128) external {
        feeGrowthGlobal1X128 = _feeGrowthGlobal1X128;
    }

    function advanceTime(uint256 by) external {
        time += by;
    }

    function _blockTimestamp() internal view returns (uint32) {
        return uint32(time);
    }
}
