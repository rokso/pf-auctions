// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import {DescendingPriceAuction} from "../DescendingPriceAuction.sol";

contract DPAMock is DescendingPriceAuction {
    function getCurrentPriceTest(uint256 m, uint256 f, uint256 e, uint256 t) external pure returns (uint256 p) {
        return _getCurrentPrice(m, f, e, t);
    }

    function calcAbsDecayTest(uint256 c, uint256 f, uint256 s, uint256 e) external pure returns (uint256) {
        return _calulateAbsoluteDecay(c, f, s, e);
    }
}
