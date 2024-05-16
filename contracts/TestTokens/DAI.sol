// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;

import "./ERC20mod.sol";

contract Dai is ERC20 {
    constructor() ERC20('DAI', 'DAI', 6) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}