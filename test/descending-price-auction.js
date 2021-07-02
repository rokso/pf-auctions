'use strict'

const { expect } = require('chai')
const { ethers, waffle } = require('hardhat')
const provider = waffle.provider

describe('Descending Price Auction', function () {
  let signers,
    dpa,
    testToken,
    testAuction,
    badTestToken,
    badTestAuction,
    reallyBadTestAuction,
    badReentrantTestToken

  beforeEach(async function () {
    // Accounts
    signers = await ethers.getSigners()
    // Deploy Register
    const DPA = await ethers.getContractFactory('DPAMock', signers[0])

    const TestToken = await ethers.getContractFactory(
      'OzERC20PresetMinterPauser',
      signers[0]
    )

    // Standard ERC20 Token
    testToken = await TestToken.deploy('Test', 'TST')
    await testToken.deployed()
    await testToken.mint(
      signers[0].address,
      ethers.BigNumber.from('100000000000000000000')
    )
    await testToken.mint(
      signers[1].address,
      ethers.BigNumber.from('100000000000000000000')
    )

    // ERC20 in which transferfrom will always send something even if amount exceeds approved amount
    const BadTestToken = await ethers.getContractFactory('BadERC20', signers[0])
    badTestToken = await BadTestToken.deploy('Bad', 'BAD')
    const BadReentrantTestToken = await ethers.getContractFactory(
      'BadReentrantERC20',
      signers[1]
    )
    badReentrantTestToken = await BadReentrantTestToken.deploy('Liar', 'LIAR')

    await badTestToken.deployed()

    await badTestToken.mint(
      signers[0].address,
      ethers.BigNumber.from('100000000000000000000')
    )

    dpa = await DPA.deploy()
    await dpa.deployed()

    testAuction = {
      ceiling: ethers.BigNumber.from('20000000000000000000'),
      floor: ethers.BigNumber.from('10000000000000000000'),
      collectionId: 0,
      paymentToken: testToken.address,
      payee: signers[0].address,
      endBlock: (await provider.getBlockNumber()) + 20,
      tokens: [testToken.address],
      tokenAmounts: [ethers.BigNumber.from('50000000000000000000')]
    }

    badTestAuction = {
      ceiling: ethers.BigNumber.from('20000000000000000000'),
      floor: ethers.BigNumber.from('10000000000000000000'),
      collectionId: 0,
      paymentToken: testToken.address,
      payee: signers[0].address,
      endBlock: (await provider.getBlockNumber()) + 20,
      tokens: [badTestToken.address],
      tokenAmounts: [ethers.BigNumber.from('50000000000000000000')]
    }

    reallyBadTestAuction = {
      ceiling: ethers.BigNumber.from('20000000000000000000'),
      floor: ethers.BigNumber.from('10000000000000000000'),
      collectionId: 0,
      paymentToken: badReentrantTestToken.address,
      payee: signers[0].address,
      endBlock: (await provider.getBlockNumber()) + 20,
      tokens: [testToken.address],
      tokenAmounts: [ethers.BigNumber.from('50000000000000000000')]
    }
  })

  describe('createAuction', function () {
    it('Should create an auction', async function () {
      await testToken.approve(
        dpa.address,
        ethers.BigNumber.from('50000000000000000000')
      )
      await expect(dpa.createAuction(testAuction)).to.emit(
        dpa,
        'AuctionCreated'
      )
      const ts = await dpa.totalAuctions()
      expect(ts).to.equal(1)
      const tstBal = await testToken.balanceOf(signers[0].address)
      expect(tstBal).to.equal(ethers.BigNumber.from('50000000000000000000'))
    })

    it('Should fail create an auction when it receives the wrong amount of tokens', async function () {
      await badTestToken.approve(
        dpa.address,
        ethers.BigNumber.from('40000000000000000000')
      )
      await expect(dpa.createAuction(badTestAuction)).to.be.revertedWith(
        'not-enough-transferred'
      )
    })

    it('Should fail create an auction when tokens will not escrow', async function () {
      await expect(dpa.createAuction(testAuction)).to.be.revertedWith(
        'ERC20: transfer amount exceeds allowance'
      )
    })
  })

  describe('stopAuction', function () {
    beforeEach(async function () {
      await testToken.approve(
        dpa.address,
        ethers.BigNumber.from('50000000000000000000')
      )
      await dpa.createAuction(testAuction)
    })

    it('Should stop an auction and return tokens', async function () {
      const id = 1
      await dpa.stopAuction(id)
      const auction = await dpa.getAuction(id)
      expect(auction.stopped).to.be.true
      let tstBal = await testToken.balanceOf(signers[0].address)
      expect(tstBal).to.equal(ethers.BigNumber.from('100000000000000000000'))
      tstBal = await testToken.balanceOf(dpa.address)
      expect(tstBal).to.equal(0)
    })
  })

  describe('collections', function () {
    beforeEach(async function () {
      await testToken.approve(
        dpa.address,
        ethers.BigNumber.from('100000000000000000000')
      )
      testAuction.tokenAmounts = [ethers.BigNumber.from('10000000000000000000')]
    })

    it('Should create a collection', async function () {
      await expect(dpa.createCollection())
        .to.emit(dpa, 'CollectionCreated')
        .withArgs(1, signers[0].address)
    })

    it('Should transfer a collection', async function () {
      await dpa.createCollection()
      const cId = 1
      await expect(dpa.transferCollection(signers[1].address, cId))
        .to.emit(dpa, 'CollectionTransfer')
        .withArgs(1, signers[0].address, signers[1].address)
    })

    it('Should create an auction within a collection', async function () {
      await dpa.createCollection()
      testAuction.collectionId = 1
      const ta = await dpa.totalAuctions()
      await dpa.createAuction(testAuction)
      const auction = await dpa.getAuction(ta.add(1))
      expect(auction.collectionId).to.equal(1)
    })

    it('Should fail to create an auction in an unowned collection', async function () {
      await dpa.createCollection()
      testAuction.collectionId = 1
      const dpaUserOne = dpa.connect(signers[1])
      await expect(
        dpaUserOne.createAuction(testAuction, { from: signers[1].address })
      ).to.be.revertedWith('caller-not-collection-owner')
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
      await testToken.approve(
        dpa.address,
        ethers.BigNumber.from('100000000000000000000')
      )
      testAuction.tokenAmounts = [ethers.BigNumber.from('10000000000000000000')]
    })

    it('Should get all auctions by a single auctioneer', async function () {
      await dpa.createAuction(testAuction)
      await dpa.createAuction(testAuction)
      await dpa.createAuction(testAuction)
      await dpa.createAuction(testAuction)
      const neerGroupLength = await dpa.neerGroupLength(signers[0].address)
      expect(neerGroupLength).to.equal(4)
      for (let i = 0; i < neerGroupLength; i++) {
        const aId = await dpa.auctionOfNeerByIndex(signers[0].address, i)
        const auction = await dpa.getAuction(aId)
        expect(auction.collectionId).to.equal(0)
      }
    })
  })

  describe('bidding', function () {
    beforeEach(async function () {
      await testToken.approve(
        dpa.address,
        ethers.BigNumber.from('100000000000000000000')
      )
      const ttTwo = testToken.connect(signers[1])
      await ttTwo.approve(
        dpa.address,
        ethers.BigNumber.from('100000000000000000000')
      )
      testAuction.tokenAmounts = [ethers.BigNumber.from('10000000000000000000')]
    })

    it('Should win an auction and all parties should get relevant proceeds', async function () {
      await dpa.createAuction(testAuction)
      const dpaUserOne = dpa.connect(signers[1])
      await dpaUserOne.bid(1)
      const auction = await dpa.getAuction(1)
      expect(auction.stopped).to.be.true
      expect(auction.winner).to.equal(signers[1].address)
      expect(auction.winningBlock).to.be.gt(0)
      expect(auction.winningPrice).to.be.gt(0)
      const ownerBalAfter = await testToken.balanceOf(signers[0].address)
      const bidderBalAfter = await testToken.balanceOf(signers[1].address)
      expect(ownerBalAfter.add(bidderBalAfter)).to.equal(
        ethers.BigNumber.from('200000000000000000000')
      )
    })
  })

  describe('getCurrentPrice', function () {
    it('Should fail to get the price if auctionId is invalid', async function () {
      await expect(dpa.getCurrentPrice(0)).to.be.revertedWith(
        'no-such-auction-id'
      )
    })

    it('Should get the price given an auctionId', async function () {
      await testToken.approve(
        dpa.address,
        ethers.BigNumber.from('100000000000000000000')
      )
      await dpa.createAuction(testAuction)
      // this is just to advance 1 block for the sake of the test
      await dpa.createAuction(testAuction)
      const price = await dpa.getCurrentPrice(1)
      expect(price).to.be.lt(ethers.BigNumber.from('20000000000000000000'))
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
      const c = ethers.BigNumber.from('600000000000000000000')
      const f = ethers.BigNumber.from('400000000000000000000')
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
      await testToken.approve(
        dpa.address,
        ethers.BigNumber.from('50000000000000000000')
      )
      await testToken
        .connect(signers[1])
        .approve(dpa.address, ethers.BigNumber.from('50000000000000000000'))
      await dpa.createAuction(testAuction)
      await dpa.connect(signers[1]).createAuction(reallyBadTestAuction)
      const aId = await dpa.totalAuctions()
      const tx = dpa.connect(signers[1]).bid(aId)
      await expect(tx).to.be.revertedWith('ReentrancyGuard: reentrant call')
    })
  })
})
