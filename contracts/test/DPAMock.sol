// SPDX-License-Identifier: MIT

pragma solidity 0.7.3;
pragma experimental ABIEncoderV2;

import "../DescendingPriceAuction.sol";

contract DPAMock is DescendingPriceAuction {
    function getCurrentPriceTest(
        uint256 c,
        uint256 f,
        uint256 s,
        uint256 e,
        uint256 t
    ) external pure returns (uint256 p) {
        return _getCurrentPrice(c, f, s, e, t);
    }
}
