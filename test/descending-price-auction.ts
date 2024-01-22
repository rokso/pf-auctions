import { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'
import { time } from '@nomicfoundation/hardhat-network-helpers'

import { BadERC20, BadReentrantERC20, DPAMock, OzERC20PresetMinterPauser } from '../typechain-types'
import { DPAConfigStruct } from '../typechain-types/contracts/DescendingPriceAuction'

describe('Descending Price Auction', function () {
  let dpa: DPAMock, testToken: OzERC20PresetMinterPauser
  let badTestToken: BadERC20, badReentrantTestToken: BadReentrantERC20
  let testAuction: DPAConfigStruct, badTestAuction: DPAConfigStruct, reallyBadTestAuction: DPAConfigStruct
  let alice: SignerWithAddress, owner: SignerWithAddress
  let dpaAddress: string

  before(async function () {
    // eslint-disable-next-line no-extra-semi
    ;[owner, alice] = await ethers.getSigners()
  })

  beforeEach(async function () {
    // Deploy Register
    const DPA = await ethers.getContractFactory('DPAMock', owner)

    const TestToken = await ethers.getContractFactory('OzERC20PresetMinterPauser', owner)

    // Standard ERC20 Token
    testToken = await TestToken.deploy('Test', 'TST')
    const testTokenAddress = await testToken.getAddress()
    await testToken.waitForDeployment()
    await testToken.mint(owner.address, ethers.parseEther('100'))
    await testToken.mint(alice.address, ethers.parseEther('100'))

    // ERC20 in which transferFrom will always send something even if amount exceeds approved amount
    const BadTestToken = await ethers.getContractFactory('BadERC20', owner)
    badTestToken = await BadTestToken.deploy('Bad', 'BAD')
    const BadReentrantTestToken = await ethers.getContractFactory('BadReentrantERC20', alice)
    badReentrantTestToken = await BadReentrantTestToken.deploy('Liar', 'LIAR')

    await badTestToken.waitForDeployment()

    await badTestToken.mint(owner.address, ethers.parseEther('100'))

    dpa = await DPA.deploy()
    await dpa.waitForDeployment()
    dpaAddress = await dpa.getAddress()

    testAuction = {
      ceiling: ethers.parseEther('20'),
      floor: ethers.parseEther('10'),
      collectionId: 0,
      paymentToken: testTokenAddress,
      payee: owner.address,
      endBlock: (await time.latestBlock()) + 20,
      tokens: [testTokenAddress],
      tokenAmounts: [ethers.parseEther('50')],
    }

    badTestAuction = {
      ceiling: ethers.parseEther('20'),
      floor: ethers.parseEther('10'),
      collectionId: 0,
      paymentToken: testTokenAddress,
      payee: owner.address,
      endBlock: (await time.latestBlock()) + 20,
      tokens: [await badTestToken.getAddress()],
      tokenAmounts: [ethers.parseEther('50')],
    }

    reallyBadTestAuction = {
      ceiling: ethers.parseEther('20'),
      floor: ethers.parseEther('10'),
      collectionId: 0,
      paymentToken: await badReentrantTestToken.getAddress(),
      payee: owner.address,
      endBlock: (await time.latestBlock()) + 20,
      tokens: [testTokenAddress],
      tokenAmounts: [ethers.parseEther('50')],
    }
  })

  describe('createAuction', function () {
    it('Should create an auction', async function () {
      await testToken.approve(dpaAddress, ethers.parseEther('50'))
      await expect(dpa.createAuction(testAuction)).to.emit(dpa, 'AuctionCreated')
      const ts = await dpa.totalAuctions()
      expect(ts).to.equal(1)
      const tstBal = await testToken.balanceOf(owner.address)
      expect(tstBal).to.equal(ethers.parseEther('50'))
    })

    it('Should fail create an auction when it receives the wrong amount of tokens', async function () {
      await badTestToken.approve(dpaAddress, ethers.parseEther('40'))
      await expect(dpa.createAuction(badTestAuction)).to.be.revertedWith('not-enough-transferred')
    })

    it('Should fail create an auction when tokens will not escrow', async function () {
      await expect(dpa.createAuction(testAuction)).to.be.revertedWith('ERC20: insufficient allowance')
    })
  })

  describe('stopAuction', function () {
    beforeEach(async function () {
      await testToken.approve(dpaAddress, ethers.parseEther('50'))
      await dpa.createAuction(testAuction)
    })

    it('Should stop an auction and return tokens', async function () {
      const id = 1
      await dpa.stopAuction(id)
      const auction = await dpa.getAuction(id)
      expect(auction.stopped).to.be.true
      let tstBal = await testToken.balanceOf(owner.address)
      expect(tstBal).to.equal(ethers.parseEther('100'))
      tstBal = await testToken.balanceOf(dpaAddress)
      expect(tstBal).to.equal(0)
    })
  })

  describe('collections', function () {
    beforeEach(async function () {
      await testToken.approve(dpaAddress, ethers.parseEther('100'))
      testAuction.tokenAmounts = [ethers.parseEther('10')]
    })

    it('Should create a collection', async function () {
      await expect(dpa.createCollection()).to.emit(dpa, 'CollectionCreated').withArgs(1, owner.address)
    })

    it('Should transfer a collection', async function () {
      await dpa.createCollection()
      const cId = 1
      await expect(dpa.transferCollection(alice.address, cId))
        .to.emit(dpa, 'CollectionTransfer')
        .withArgs(1, owner.address, alice.address)
    })

    it('Should create an auction within a collection', async function () {
      await dpa.createCollection()
      testAuction.collectionId = 1
      const ta = await dpa.totalAuctions()
      await dpa.createAuction(testAuction)
      const auction = await dpa.getAuction(ta + 1n)
      expect(auction.collectionId).to.equal(1)
    })

    it('Should fail to create an auction in an unowned collection', async function () {
      await dpa.createCollection()
      testAuction.collectionId = 1
      const dpaUserOne = dpa.connect(alice)
      await expect(dpaUserOne.createAuction(testAuction, { from: alice.address })).to.be.revertedWith(
        'caller-not-collection-owner',
      )
    })

    it('Should get all auctions within a collection', async function () {
      await dpa.createCollection()
      const cId = 1
      testAuction.collectionId = cId
      await dpa.createAuction(testAuction)
      await dpa.createAuction(testAuction)
      await dpa.createAuction(testAuction)
      await dpa.createAuction(testAuction)
      const collectionLength = await dpa.collectionLength(cId)
      expect(collectionLength).to.equal(4)
      for (let i = 0; i < collectionLength; i++) {
        const aId = await dpa.auctionOfCollByIndex(cId, i)
        const auction = await dpa.getAuction(aId)
        expect(auction.collectionId).to.equal(cId)
      }
    })
  })

  describe('auctioneers', function () {
    beforeEach(async function () {
      await testToken.approve(dpaAddress, ethers.parseEther('100'))
      testAuction.tokenAmounts = [ethers.parseEther('10')]
    })

    it('Should get all auctions by a single auctioneer', async function () {
      await dpa.createAuction(testAuction)
      await dpa.createAuction(testAuction)
      await dpa.createAuction(testAuction)
      await dpa.createAuction(testAuction)
      const neerGroupLength = await dpa.neerGroupLength(owner.address)
      expect(neerGroupLength).to.equal(4)
      for (let i = 0; i < neerGroupLength; i++) {
        const aId = await dpa.auctionOfNeerByIndex(owner.address, i)
        const auction = await dpa.getAuction(aId)
        expect(auction.collectionId).to.equal(0)
      }
    })
  })

  describe('bidding', function () {
    beforeEach(async function () {
      await testToken.approve(dpaAddress, ethers.parseEther('100'))
      const ttTwo = testToken.connect(alice)
      await ttTwo.approve(dpaAddress, ethers.parseEther('100'))
      testAuction.tokenAmounts = [ethers.parseEther('10')]
    })

    it('Should win an auction and all parties should get relevant proceeds', async function () {
      await dpa.createAuction(testAuction)
      const dpaUserOne = dpa.connect(alice)
      await dpaUserOne.bid(1)
      const auction = await dpa.getAuction(1)
      expect(auction.stopped).to.be.true
      expect(auction.winner).to.equal(alice.address)
      expect(auction.winningBlock).to.be.gt(0)
      expect(auction.winningPrice).to.be.gt(0)
      const ownerBalAfter = await testToken.balanceOf(owner.address)
      const bidderBalAfter = await testToken.balanceOf(alice.address)
      expect(ownerBalAfter + bidderBalAfter).to.equal(ethers.parseEther('200'))
    })
  })

  describe('getCurrentPrice', function () {
    it('Should fail to get the price if auctionId is invalid', async function () {
      await expect(dpa.getCurrentPrice(0)).to.be.revertedWith('no-such-auction-id')
    })

    it('Should get the price given an auctionId', async function () {
      await testToken.approve(dpaAddress, ethers.parseEther('100'))
      await dpa.createAuction(testAuction)
      // this is just to advance 1 block for the sake of the test
      await dpa.createAuction(testAuction)
      const price = await dpa.getCurrentPrice(1)
      expect(price).to.be.lt(ethers.parseEther('20'))
    })

    it('Should properly calculate the price given the ceiling, floor, and current time', async function () {
      const s = 0
      const e = 10
      const c = 20
      const f = 10
      const t = 5
      const absDecay = await dpa.calcAbsDecayTest(c, f, s, e)
      const p = await dpa.getCurrentPriceTest(absDecay, f, e, t)
      expect(p).to.equal('15')
    })

    it('Should properly calculate the price 1', async function () {
      const s = 100
      const e = 200
      const c = 40
      const f = 30
      let t = 125
      const absDecay = await dpa.calcAbsDecayTest(c, f, s, e)
      let p = await dpa.getCurrentPriceTest(absDecay, f, e, t)
      expect(p).to.equal('37')
      t = 150
      p = await dpa.getCurrentPriceTest(absDecay, f, e, t)
      expect(p).to.equal('35')
      t = 200
      p = await dpa.getCurrentPriceTest(absDecay, f, e, t)
      expect(p).to.equal(f)
    })

    it('Should properly calculate the price 2', async function () {
      const s = 100
      const e = 200
      const c = 800
      const f = 600
      let t = 125
      const absDecay = await dpa.calcAbsDecayTest(c, f, s, e)
      let p = await dpa.getCurrentPriceTest(absDecay, f, e, t)
      expect(p).to.equal('750')
      t = 150
      p = await dpa.getCurrentPriceTest(absDecay, f, e, t)
      expect(p).to.equal('700')
      t = 200
      p = await dpa.getCurrentPriceTest(absDecay, f, e, t)
      expect(p).to.equal(f)
    })

    it('Should properly calculate the price 3', async function () {
      const s = 100
      const e = 200
      const c = 1111111
      const f = 1
      let t = 125
      const absDecay = await dpa.calcAbsDecayTest(c, f, s, e)
      let p = await dpa.getCurrentPriceTest(absDecay, f, e, t)
      expect(p).to.equal('833333')
      t = 150
      p = await dpa.getCurrentPriceTest(absDecay, f, e, t)
      expect(p).to.equal('555556')
      t = 200
      p = await dpa.getCurrentPriceTest(absDecay, f, e, t)
      expect(p).to.equal(f)
    })

    it('Should properly calculate the price 4', async function () {
      const s = 100
      const e = 200
      const c = ethers.parseEther('600')
      const f = ethers.parseEther('400')
      let t = 125
      const absDecay = await dpa.calcAbsDecayTest(c, f, s, e)
      let p = await dpa.getCurrentPriceTest(absDecay, f, e, t)
      expect(p).to.equal('550000000000000000000')
      t = 150
      p = await dpa.getCurrentPriceTest(absDecay, f, e, t)
      expect(p).to.equal('500000000000000000000')
      t = 200
      p = await dpa.getCurrentPriceTest(absDecay, f, e, t)
      expect(p).to.equal(f)
    })

    it('Should return the floor if the time is past the end', async function () {
      const s = 0
      const e = 10
      const c = 20
      const f = 10
      const t = 15
      const absDecay = await dpa.calcAbsDecayTest(c, f, s, e)
      const p = await dpa.getCurrentPriceTest(absDecay, f, e, t)
      expect(p).to.equal(f)
    })

    it('Should return the ceiling if there is no ramp', async function () {
      const s = 0
      const e = 10
      const c = 20
      const f = 20
      const t = 300
      const absDecay = await dpa.calcAbsDecayTest(c, f, s, e)
      const p = await dpa.getCurrentPriceTest(absDecay, f, e, t)
      expect(p).to.equal(c)
    })
  })

  describe('Reentrancy', function () {
    it('Should not be reenterable', async function () {
      await testToken.approve(dpaAddress, ethers.parseEther('50'))
      await testToken.connect(alice).approve(dpaAddress, ethers.parseEther('50'))
      await dpa.createAuction(testAuction)
      await dpa.connect(alice).createAuction(reallyBadTestAuction)
      const aId = await dpa.totalAuctions()
      const tx = dpa.connect(alice).bid(aId)
      await expect(tx).to.be.revertedWith('ReentrancyGuard: reentrant call')
    })
  })
})
