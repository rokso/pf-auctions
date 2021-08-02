'use strict'

const { expect } = require('chai')
const hre = require('hardhat')
const ethers = hre.ethers
const provider = hre.waffle.provider

const MAINNET_DPA = '0xeDceB6D349dEcb675BD4dDC90b5A05e3f813B56D'
const VSP = '0x1b40183efb4dd766f11bda7a7c3ad8982e998421'
const VSP_HOLDER = '0xb92792552e590339A7DbF1E0D6114fbc7395c86b'
const VUSDC_HOLDER = '0x40b1242f23755ee9a14185b465a2db6b4573c7f5'
const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
const VUSDC = '0x0C49066C0808Ee8c673553B7cbd99BCC9ABf113d'

describe('Descending Price Auction Deployment Test', function () {
  let signers, dpa, vsp, vusdc, testAuction, vspSigner, vusdcSigner, weth, flash

  beforeEach(async function () {
    // Accounts
    signers = await ethers.getSigners()
    // Deploy Register
    dpa = await ethers.getContractAt('DPAMock', MAINNET_DPA)
    vsp = await ethers.getContractAt('IERC20', VSP)
    vusdc = await ethers.getContractAt('IVesperPool', VUSDC)
    weth = await ethers.getContractAt('TokenLike', WETH)

    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [VSP_HOLDER]
    })
    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [VUSDC_HOLDER]
    })
    vspSigner = await ethers.provider.getSigner(VSP_HOLDER)
    vusdcSigner = await ethers.provider.getSigner(VUSDC_HOLDER)
    await signers[2].sendTransaction({
      to: VSP_HOLDER,
      value: ethers.utils.parseEther('1.0')
    })
    await signers[2].sendTransaction({
      to: VUSDC_HOLDER,
      value: ethers.utils.parseEther('1.0')
    })

    weth.deposit({ value: ethers.utils.parseEther('10.0') })

    await vsp
      .connect(vspSigner)
      .transfer(signers[1].address, ethers.utils.parseEther('1000.0')) // Send 1000 VSP to buyer acct
    await vusdc
      .connect(vusdcSigner)
      .transfer(signers[0].address, ethers.utils.parseEther('5000.0')) // Send 10000 VUSDC to seller acct

    const FLASH = await ethers.getContractFactory('FlashBidder', signers[0])
    flash = await FLASH.deploy(MAINNET_DPA)

    testAuction = {
      ceiling: ethers.utils.parseEther('1000.0'),
      floor: ethers.utils.parseEther('10.0'),
      collectionId: 0,
      paymentToken: VSP,
      payee: signers[0].address,
      endBlock: (await provider.getBlockNumber()) + 200,
      tokens: [VUSDC],
      tokenAmounts: [ethers.utils.parseEther('5000.0')]
    }
  })

  describe('createAuction', function () {
    it('Should create an auction for VUSDC payable in VSP', async function () {
      await vusdc.approve(dpa.address, ethers.utils.parseEther('5000.0'))
      await vsp
        .connect(signers[1])
        .approve(dpa.address, ethers.utils.parseEther('1000.0'))
      await dpa.createAuction(testAuction)
      const auctionId = dpa.totalAuctions()
      let vusdcBalance = await vusdc.balanceOf(signers[0].address)
      expect(vusdcBalance).to.equal('0')
      await dpa.connect(signers[1]).bid(auctionId)
      vusdcBalance = await vusdc.balanceOf(signers[1].address)
      expect(vusdcBalance).to.equal('5000000000000000000000')
    })

    it('Should create an auction for WETH payable in VSP', async function () {
      let wethBalance = await weth.balanceOf(flash.address)
      expect(wethBalance).to.equal('0')

      testAuction.tokens = [WETH]
      testAuction.tokenAmounts = [ethers.utils.parseEther('10.0')]
      await weth.approve(dpa.address, ethers.utils.parseEther('10.0'))
      await dpa.createAuction(testAuction)
      const auctionId = dpa.totalAuctions()
      await flash.bid(auctionId)

      wethBalance = await weth.balanceOf(flash.address)
      expect(wethBalance).to.be.gt('0')
    })
  })
})
