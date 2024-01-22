// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import {ERC20PresetMinterPauser, IERC20} from "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";
import {DescendingPriceAuction} from "../DescendingPriceAuction.sol";

// solhint-disable no-unused-vars
contract BadReentrantERC20 is ERC20PresetMinterPauser {
    bool private reEnterOnce = true;
    // solhint-disable-next-line immutable-vars-naming
    address private immutable thief;

    constructor(string memory _name, string memory _symbol) ERC20PresetMinterPauser(_name, _symbol) {
        thief = _msgSender();
    }

    function transferFrom(address, address recipient, uint256 amount) public virtual override returns (bool) {
        // sender doesnt even have to have tokens
        _mint(recipient, amount);
        // this can be done more than once...
        if (reEnterOnce) {
            reEnterOnce = false;
            DescendingPriceAuction auctionContract = DescendingPriceAuction(_msgSender());
            uint256 latestAuctionId = auctionContract.totalAuctions();
            auctionContract.bid(latestAuctionId);
            IERC20 tokenWeStole = IERC20(auctionContract.getAuction(latestAuctionId).tokens[0]);
            tokenWeStole.transfer(thief, tokenWeStole.balanceOf(address(this)));
            _burn(recipient, amount);
        }
        return true;
    }
}
