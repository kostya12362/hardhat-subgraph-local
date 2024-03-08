// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

contract Autolisting {
    string public name = "DEX223 autolisting contract";

    event PairsAdded(address[] pairs);
    uint256 public numPairs;
    uint256 public lastUpdate = block.timestamp;
    mapping(uint256 => address) public pairs;

    /* onlyOwner */
    function addPairs(address[] memory _pairs) public {
        uint256 _position = numPairs;
        numPairs += _pairs.length;
        emit PairsAdded(_pairs);
        for (uint i = 0; i < _pairs.length; i++) {
            pairs[_position] = _pairs[i];
            _position++;
        }

        //pairs[num_pairs] = _pairs[0];
        lastUpdate = block.timestamp;
    }

    function getPairs(
        uint256 _start,
        uint256 _end
    ) public view returns (address[] memory) {
        address[] memory _pairs = new address[](_end - _start);
        uint256 _arrayIndex = 0;
        for (uint256 i = _start; i < _end; i++) {
            _pairs[_arrayIndex] = pairs[i];
            _arrayIndex++;
        }
        return _pairs;
    }
}
