import { token } from '../typechain-types/@openzeppelin/contracts'

const { expect } = require('chai')
const { ethers } = require('hardhat')
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers')

describe('YieldDistributor', function () {
  async function deployYieldDistributorFixture () {
    const [owner, user1, user2] = await ethers.getSigners()
    const randomWallet = ethers.Wallet.createRandom()
    const randomWallet2 = ethers.Wallet.createRandom()

    const mockToken1 = await ethers.deployContract('MockERC20', [
      'Mock Token 1',
      'MT1',
      ethers.parseUnits('100')
    ])

    const mockToken2 = await ethers.deployContract('MockERC20', [
      'Mock Token 1',
      'MT1',
      ethers.parseUnits('100')
    ])

    const yieldDistributor = await ethers.deployContract('YieldDistributor', [
      randomWallet.address,
      owner.address
    ])

    await mockToken1.waitForDeployment()
    await mockToken2.waitForDeployment()

    await yieldDistributor.waitForDeployment()

    return {
      yieldDistributor,
      mockToken1,
      mockToken2,
      owner,
      user1,
      user2,
      randomWallet,
      randomWallet2
    }
  }

  describe('Deployment', function () {
    it('Should deploy all contracts successfully.', async function () {
      const { yieldDistributor, mockToken1, mockToken2 } = await loadFixture(
        deployYieldDistributorFixture
      )

      expect(await yieldDistributor.getAddress()).to.be.properAddress
      expect(await mockToken1.getAddress()).to.be.properAddress
      expect(await mockToken2.getAddress()).to.be.properAddress
    })

    it('Should correctly set the initial state.', async function () {
      const { yieldDistributor, owner, randomWallet } = await loadFixture(
        deployYieldDistributorFixture
      )

      expect(await yieldDistributor.owner()).to.equal(owner.address)
      expect(await yieldDistributor.getPlatformTreasury()).to.equal(
        randomWallet.address
      )
    })

    it('Should revert if zero address platform treasury passed to constructor', async function () {
      const [owner] = await ethers.getSigners()

      const YieldDistributorFactory = await ethers.getContractFactory(
        'YieldDistributor'
      )

      await expect(
        YieldDistributorFactory.deploy(ethers.ZeroAddress, owner.address)
      ).to.be.revertedWithCustomError(YieldDistributorFactory, 'InvalidAddress')
    })
  })

  describe('Updating platform treasury', function () {
    it('Should allow owner to update the platform treasury', async function () {
      const { yieldDistributor, randomWallet, randomWallet2 } =
        await loadFixture(deployYieldDistributorFixture)

      expect(await yieldDistributor.getPlatformTreasury()).to.equal(
        randomWallet.address
      )

      await expect(yieldDistributor.updatePlatformTreasury(randomWallet2))
        .to.emit(yieldDistributor, 'PlatformTreasuryUpdated')
        .withArgs(randomWallet.address, randomWallet2.address)

      expect(await yieldDistributor.getPlatformTreasury()).to.equal(
        randomWallet2.address
      )
    })

    it('Should revert if non-owner attempts to update the platform treasury', async function () {
      const { yieldDistributor, user1, randomWallet, randomWallet2 } =
        await loadFixture(deployYieldDistributorFixture)

      expect(await yieldDistributor.getPlatformTreasury()).to.equal(
        randomWallet.address
      )

      await expect(
        yieldDistributor
          .connect(user1)
          .updatePlatformTreasury(randomWallet2.address)
      )
        .to.be.revertedWithCustomError(
          yieldDistributor,
          'OwnableUnauthorizedAccount'
        )
        .withArgs(user1.address)

      expect(await yieldDistributor.getPlatformTreasury()).to.equal(
        randomWallet.address
      )
    })

    it('Should revert if zero address is pass to updatePlatformTreasury()', async function () {
      const { yieldDistributor, randomWallet } = await loadFixture(
        deployYieldDistributorFixture
      )
      expect(await yieldDistributor.getPlatformTreasury()).to.equal(
        randomWallet.address
      )

      await expect(
        yieldDistributor.updatePlatformTreasury(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(yieldDistributor, 'InvalidAddress')

      expect(await yieldDistributor.getPlatformTreasury()).to.equal(
        randomWallet.address
      )
    })
  })

  describe('Updating platform yield share', function () {
    it('Should allow owner to update platform yield share', async function () {
      const { yieldDistributor } = await loadFixture(
        deployYieldDistributorFixture
      )

      const currentYieldShare = await yieldDistributor.getPlatformYieldShare()
      const newYieldShare = 3000

      await expect(yieldDistributor.updatePlatformYieldShare(newYieldShare))
        .to.emit(yieldDistributor, 'PlatformYieldShareUpdated')
        .withArgs(currentYieldShare, newYieldShare)

      expect(await yieldDistributor.getPlatformYieldShare()).to.equal(
        newYieldShare
      )
    })

    it('Should revert if new yield share is greater than the maximum', async function () {
      const { yieldDistributor } = await loadFixture(
        deployYieldDistributorFixture
      )

      const currentYieldShare = await yieldDistributor.getPlatformYieldShare()
      const newYieldShare = 7000

      await expect(yieldDistributor.updatePlatformYieldShare(newYieldShare))
        .to.be.revertedWithCustomError(yieldDistributor, 'ShareExceedsMaximum')
        .withArgs(newYieldShare)

      expect(await yieldDistributor.getPlatformYieldShare()).to.equal(
        currentYieldShare
      )
    })

    it('Should revert when non-owner tries to update platform yield share', async function () {
      const { yieldDistributor, user1 } = await loadFixture(
        deployYieldDistributorFixture
      )

      const currentYieldShare = await yieldDistributor.getPlatformYieldShare()
      const newYieldShare = 3000

      await expect(
        yieldDistributor.connect(user1).updatePlatformYieldShare(newYieldShare)
      )
        .to.be.revertedWithCustomError(
          yieldDistributor,
          'OwnableUnauthorizedAccount'
        )
        .withArgs(user1.address)

      expect(await yieldDistributor.getPlatformYieldShare()).to.equal(
        currentYieldShare
      )
    })
  })

  describe('Calculating yield share', function () {
    it('Should calculate correct yield share with default value', async function () {
      const { yieldDistributor } = await loadFixture(
        deployYieldDistributorFixture
      )

      const totalYield = 5

      expect(
        await yieldDistributor.calculateYieldShares(totalYield)
      ).to.deep.equal([4, 1])
    })

    it('Should calculate correct yield share after updating yield share', async function () {
      const { yieldDistributor } = await loadFixture(
        deployYieldDistributorFixture
      )

      const totalYield = 5

      const newYieldShare = 4000

      await yieldDistributor.updatePlatformYieldShare(newYieldShare)

      expect(await yieldDistributor.getPlatformYieldShare()).to.equal(
        newYieldShare
      )

      expect(
        await yieldDistributor.calculateYieldShares(totalYield)
      ).to.deep.equal([3, 2])
    })

    it('Should calculate correct yield share with 0 yield', async function () {
      const { yieldDistributor } = await loadFixture(
        deployYieldDistributorFixture
      )

      const totalYield = 0

      expect(
        await yieldDistributor.calculateYieldShares(totalYield)
      ).to.deep.equal([0, 0])
    })

    it('Should calculate correct yield share with extremely large values', async function () {
      const { yieldDistributor } = await loadFixture(
        deployYieldDistributorFixture
      )

      const totalYield = 10n ** 60n

      const expectedPlatformShare = (totalYield * 2000n) / 10000n
      const expectedCreatorShare = totalYield - expectedPlatformShare

      const [creatorShare, platformShare] =
        await yieldDistributor.calculateYieldShares(totalYield)

      expect(platformShare).to.equal(expectedPlatformShare)
      expect(creatorShare).to.equal(expectedCreatorShare)
      expect(
        await yieldDistributor.calculateYieldShares(totalYield)
      ).to.deep.equal([expectedCreatorShare, expectedPlatformShare])

      expect(creatorShare + platformShare).to.equal(totalYield)
    })

    it('Should handle rounding correctly during yield share calculation', async function () {
      const { yieldDistributor } = await loadFixture(
        deployYieldDistributorFixture
      )

      await yieldDistributor.updatePlatformYieldShare(3333)

      const totalYield = 10

      const expectedPlatformShare = 3
      const expectedCreatorShare = 7

      const [creatorShare, platformShare] =
        await yieldDistributor.calculateYieldShares(totalYield)

      expect(platformShare).to.equal(expectedPlatformShare)
      expect(creatorShare).to.equal(expectedCreatorShare)
      expect(Number(creatorShare) + Number(platformShare)).to.equal(totalYield)

      const primeTotalYield = 23

      const [primeCreatorShare, primePlatformShare] =
        await yieldDistributor.calculateYieldShares(primeTotalYield)

      expect(primePlatformShare).to.equal(7)
      expect(primeCreatorShare).to.equal(16)
      expect(Number(primeCreatorShare) + Number(primePlatformShare)).to.equal(
        primeTotalYield
      )
    })

    it('Should revert on arithmetic overflow', async function () {
      const { yieldDistributor } = await loadFixture(
        deployYieldDistributorFixture
      )

      const maxUint256 = 2n ** 256n - 1n

      await expect(
        yieldDistributor.calculateYieldShares(maxUint256)
      ).to.be.revertedWithCustomError(yieldDistributor, 'Overflow')

      const overflowTrigger = maxUint256 / 2000n + 1n

      await expect(
        yieldDistributor.calculateYieldShares(overflowTrigger)
      ).to.be.revertedWithCustomError(yieldDistributor, 'Overflow')
    })
  })

  describe('Yield splits preview', function () {
    it('Should calculate correct yield share with default value', async function () {
      const { yieldDistributor } = await loadFixture(
        deployYieldDistributorFixture
      )

      const totalYield = 5

      const [creatorShare, platformShare] =
        await yieldDistributor.calculateYieldShares(totalYield)
      const yieldSplitResult = await yieldDistributor.getYieldSplitPreview(
        totalYield
      )

      expect(creatorShare).to.equal(4)
      expect(platformShare).to.equal(1)

      expect(yieldSplitResult).to.deep.equal([creatorShare, platformShare])
    })

    it('Should calculate correct yield share after updating yield share', async function () {
      const { yieldDistributor } = await loadFixture(
        deployYieldDistributorFixture
      )

      const totalYield = 5

      const newYieldShare = 4000

      await yieldDistributor.updatePlatformYieldShare(newYieldShare)

      expect(await yieldDistributor.getPlatformYieldShare()).to.equal(
        newYieldShare
      )

      const [creatorShare, platformShare] =
        await yieldDistributor.calculateYieldShares(totalYield)
      const yieldSplitResult = await yieldDistributor.getYieldSplitPreview(
        totalYield
      )

      expect(creatorShare).to.equal(3)
      expect(platformShare).to.equal(2)

      expect(yieldSplitResult).to.deep.equal([creatorShare, platformShare])
    })

    it('Should calculate correct yield share with 0 yield', async function () {
      const { yieldDistributor } = await loadFixture(
        deployYieldDistributorFixture
      )

      const totalYield = 0

      const [creatorShare, platformShare] =
        await yieldDistributor.calculateYieldShares(totalYield)
      const yieldSplitResult = await yieldDistributor.getYieldSplitPreview(
        totalYield
      )

      expect(creatorShare).to.equal(0)
      expect(platformShare).to.equal(0)

      expect(yieldSplitResult).to.deep.equal([creatorShare, platformShare])
    })

    it('Should calculate correct yield share with extremely large values', async function () {
      const { yieldDistributor } = await loadFixture(
        deployYieldDistributorFixture
      )

      const totalYield = 10n ** 60n

      const expectedPlatformShare = (totalYield * 2000n) / 10000n
      const expectedCreatorShare = totalYield - expectedPlatformShare

      const [creatorShare, platformShare] =
        await yieldDistributor.calculateYieldShares(totalYield)

      const yieldSplitResult = await yieldDistributor.getYieldSplitPreview(
        totalYield
      )

      expect(platformShare).to.equal(expectedPlatformShare)
      expect(creatorShare).to.equal(expectedCreatorShare)
      expect(
        await yieldDistributor.calculateYieldShares(totalYield)
      ).to.deep.equal([expectedCreatorShare, expectedPlatformShare])

      expect(creatorShare + platformShare).to.equal(totalYield)
      expect(yieldSplitResult).to.deep.equal([creatorShare, platformShare])
    })

    it('Should handle rounding correctly during yield share calculation', async function () {
      const { yieldDistributor } = await loadFixture(
        deployYieldDistributorFixture
      )

      // Set an odd platform share percentage that will cause division rounding
      await yieldDistributor.updatePlatformYieldShare(3333)

      // Test with a value that won't divide evenly
      const totalYield = 10

      const [creatorShare, platformShare] =
        await yieldDistributor.calculateYieldShares(totalYield)

      expect(platformShare).to.equal(3)
      expect(creatorShare).to.equal(7)

      const yieldSplitResult = await yieldDistributor.getYieldSplitPreview(
        totalYield
      )
      expect(yieldSplitResult).to.deep.equal([creatorShare, platformShare])

      expect(Number(creatorShare) + Number(platformShare)).to.equal(totalYield)

      const primeTotalYield = 23

      const [primeCreatorShare, primePlatformShare] =
        await yieldDistributor.calculateYieldShares(primeTotalYield)
      const primeSplitResult = await yieldDistributor.getYieldSplitPreview(
        primeTotalYield
      )

      expect(primePlatformShare).to.equal(7)
      expect(primeCreatorShare).to.equal(16)
      expect(primeSplitResult).to.deep.equal([
        primeCreatorShare,
        primePlatformShare
      ])
      expect(Number(primeCreatorShare) + Number(primePlatformShare)).to.equal(
        primeTotalYield
      )
    })

    it('Should revert on arithmetic overflow', async function () {
      const { yieldDistributor } = await loadFixture(
        deployYieldDistributorFixture
      )

      const maxUint256 = 2n ** 256n - 1n

      const overflowTrigger = maxUint256 / 2000n + 1n

      await expect(yieldDistributor.calculateYieldShares(overflowTrigger)).to.be
        .reverted

      await expect(yieldDistributor.getYieldSplitPreview(overflowTrigger)).to.be
        .reverted

      const boundaryValue = maxUint256 / 2000n

      await yieldDistributor.calculateYieldShares(boundaryValue)
      await yieldDistributor.getYieldSplitPreview(boundaryValue)
    })
  })
})
