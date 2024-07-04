// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;

import "./ERC20mod.sol";

contract BaseErc20 is ERC20 {
    constructor() ERC20('Base ERC20', 'BER', 18) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}