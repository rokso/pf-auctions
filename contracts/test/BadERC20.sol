// SPDX-License-Identifier: MIT

pragma solidity 0.8.3;

import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";

/* solhint-disable no-empty-blocks */
contract BadERC20 is ERC20PresetMinterPauser {
    constructor(string memory _name, string memory _symbol)
        ERC20PresetMinterPauser(_name, _symbol)
    {}

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public virtual override returns (bool) {
        uint256 currentAllowance = allowance(sender, recipient);
        if (amount > currentAllowance) amount = currentAllowance;
        _transfer(sender, recipient, amount);

        _approve(sender, _msgSender(), currentAllowance - amount);

        return true;
    }
}
