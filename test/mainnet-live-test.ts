import { expect } from 'chai'
import { ethers, network } from 'hardhat'
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'
import { time, setBalance } from '@nomicfoundation/hardhat-network-helpers'
import { DPAMock, FlashBidder, IDescendingPriceAuction, IERC20, IVesperPool, TokenLike } from '../typechain-types'

const MAINNET_DPA = '0xeDceB6D349dEcb675BD4dDC90b5A05e3f813B56D'
const VSP = '0x1b40183efb4dd766f11bda7a7c3ad8982e998421'
const VSP_HOLDER = '0xD02d6eC21851092A9cca8a8eb388fdF66bA96F9B'
const VUSDC_HOLDER = '0xA67EC8737021A7e91e883A3277384E6018BB5776'
const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
const VUSDC = '0x0C49066C0808Ee8c673553B7cbd99BCC9ABf113d'

const startFork = async (): Promise<void> => {
  const blockNumber = process.env.BLOCK_NUMBER ? process.env.BLOCK_NUMBER : undefined
  await network.provider.request({
    method: 'hardhat_reset',
    params: [
      {
        forking: {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          blockNumber,
          jsonRpcUrl: process.env.NODE_URL,
        },
      },
    ],
  })
}

const stopFork = async (): Promise<void> => {
  await network.provider.request({
    method: 'hardhat_reset',
    params: [],
  })
}

// eslint-disable-next-line mocha/no-skipped-tests
describe.skip('Descending Price Auction Deployment Test', function () {
  let dpa: DPAMock, vsp: IERC20, vusdc: IVesperPool, testAuction: IDescendingPriceAuction.DPAConfigStruct
  let weth: TokenLike, flash: FlashBidder
  let alice: SignerWithAddress, bob: SignerWithAddress
  let dpaAddress: string

  before(async function () {
    startFork()
    // eslint-disable-next-line no-extra-semi
    ;[alice, bob] = await ethers.getSigners()
  })

  after(async function () {
    stopFork()
  })

  beforeEach(async function () {
    // Deploy Register
    dpa = await ethers.getContractAt('DPAMock', MAINNET_DPA)
    dpaAddress = await dpa.getAddress()
    vsp = await ethers.getContractAt('IERC20', VSP)
    vusdc = await ethers.getContractAt('IVesperPool', VUSDC)
    weth = await ethers.getContractAt('TokenLike', WETH)

    weth.deposit({ value: ethers.parseEther('10.0') })

    // Get some VSP
    await setBalance(VSP_HOLDER, ethers.parseEther('1'))
    const vspSigner = await ethers.getImpersonatedSigner(VSP_HOLDER)
    await vsp.connect(vspSigner).transfer(bob, ethers.parseEther('1000.0')) // Send 1000 VSP to buyer acct

    // Get some vUSDC
    await setBalance(VUSDC_HOLDER, ethers.parseEther('1'))
    const vusdcSigner = await ethers.getImpersonatedSigner(VUSDC_HOLDER)
    await vusdc.connect(vusdcSigner).transfer(alice, ethers.parseEther('5000.0')) // Send 5000 VUSDC to seller acct

    const FLASH = await ethers.getContractFactory('FlashBidder', alice)
    flash = await FLASH.deploy(MAINNET_DPA)

    testAuction = {
      ceiling: ethers.parseEther('1000.0'),
      floor: ethers.parseEther('10.0'),
      collectionId: 0,
      paymentToken: VSP,
      payee: alice,
      endBlock: (await time.latestBlock()) + 200,
      tokens: [VUSDC],
      tokenAmounts: [ethers.parseEther('5000.0')],
    }
  })

  describe('createAuction', function () {
    it('Should create an auction for VUSDC payable in VSP', async function () {
      await vusdc.approve(dpaAddress, ethers.parseEther('5000.0'))
      await vsp.connect(bob).approve(dpaAddress, ethers.parseEther('1000.0'))
      await dpa.createAuction(testAuction)
      const auctionId = await dpa.totalAuctions()
      let vusdcBalance = await vusdc.balanceOf(alice)
      expect(vusdcBalance).to.equal('0')
      await dpa.connect(bob).bid(auctionId)
      vusdcBalance = await vusdc.balanceOf(bob.address)
      expect(vusdcBalance).to.equal('5000000000000000000000')
    })

    it('Should create an auction for WETH payable in VSP', async function () {
      const flashAddress = await flash.getAddress()
      let wethBalance = await weth.balanceOf(flashAddress)
      expect(wethBalance).to.equal('0')

      testAuction.tokens = [WETH]
      testAuction.tokenAmounts = [ethers.parseEther('10.0')]
      await weth.approve(dpaAddress, ethers.parseEther('10.0'))
      await dpa.createAuction(testAuction)
      const auctionId = await dpa.totalAuctions()
      await flash.bid(auctionId)

      wethBalance = await weth.balanceOf(flashAddress)
      expect(wethBalance).to.be.gt('0')
    })
  })
})
