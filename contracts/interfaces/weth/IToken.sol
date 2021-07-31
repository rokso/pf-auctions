// SPDX-License-Identifier: MIT

pragma solidity 0.8.3;

interface TokenLike {
    function approve(address, uint256) external returns (bool);

    function balanceOf(address) external view returns (uint256);

    function transfer(address, uint256) external returns (bool);

    function transferFrom(
        address,
        address,
        uint256
    ) external returns (bool);

    function deposit() external payable;

    function withdraw(uint256) external;
}
