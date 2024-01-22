// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import {ERC20PresetMinterPauser} from "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";

/* solhint-disable no-empty-blocks */
contract OzERC20PresetMinterPauser is ERC20PresetMinterPauser {
    constructor(string memory _name, string memory _symbol) ERC20PresetMinterPauser(_name, _symbol) {}
}
