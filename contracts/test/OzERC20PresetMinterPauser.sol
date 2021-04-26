// SPDX-License-Identifier: MIT

pragma solidity 0.7.3;

import "@openzeppelin/contracts/presets/ERC20PresetMinterPauser.sol";

/* solhint-disable no-empty-blocks */
contract OzERC20PresetMinterPauser is ERC20PresetMinterPauser {
    constructor(string memory _name, string memory _symbol)
        ERC20PresetMinterPauser(_name, _symbol)
    {}
}
