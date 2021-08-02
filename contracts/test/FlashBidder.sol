// SPDX-License-Identifier: MIT

pragma solidity 0.8.3;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IDescendingPriceAuction.sol";
import "../interfaces/uniswap/IUniswapV2Pair.sol";
import "../interfaces/uniswap/IUniswapV2Router01.sol";
import "hardhat/console.sol";

contract FlashBidder {
    address internal constant FACTORY =
        0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f;
    address internal constant ROUTER =
        0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;
    address internal constant VSP = 0x1b40183EFB4Dd766f11bDa7A7c3AD8982e998421;
    address internal constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address internal constant VSPWETH =
        0x6D7B6DaD6abeD1DFA5eBa37a6667bA9DCFD49077;
    IDescendingPriceAuction internal immutable auctionHouse;
    uint256 public tempAuctionId;

    constructor(address _dpa) {
        auctionHouse = IDescendingPriceAuction(_dpa);
        IERC20(VSP).approve(_dpa, type(uint256).max);
    }

    // solhint-disable no-empty-blocks
    receive() external payable {}

    function bid(uint256 auctionId) external {
        tempAuctionId = auctionId;
        uint256 amtNeeded = auctionHouse.getCurrentPrice(auctionId);
        IUniswapV2Pair(VSPWETH).swap(
            amtNeeded,
            0,
            address(this),
            "This is a flash swap"
        );
    }

    /* solhint-disable */
    function uniswapV2Call(
        address sender,
        uint256 amount0,
        uint256 amount1,
        bytes calldata data
    ) external {
        require(sender == VSPWETH, "incorrect-sender");
        address[] memory path = new address[](2);
        path[0] = WETH;
        path[1] = VSP;
        console.log("Borrowed VSP: %s", amount0);
        console.log("Bidding on Auction...");
        auctionHouse.bid(tempAuctionId);
        uint256 amountReceived = IERC20(WETH).balanceOf(address(this));
        console.log("Received %s WETH from auction", amountReceived);
        uint256 amountRequired =
            IUniswapV2Router01(ROUTER).getAmountsIn(amount0, path)[0];
        console.log("Swapping %s WETH back to VSP to payback", amountRequired);
        assert(amountReceived > amountRequired); // fail if we didn't get enough tokens back to repay our flash loan
        assert(IERC20(WETH).transfer(msg.sender, amountRequired)); // return tokens to V2 pair
    }
}
