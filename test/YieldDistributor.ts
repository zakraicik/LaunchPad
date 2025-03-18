import { token } from '../typechain-types/@openzeppelin/contracts'

const { expect } = require('chai')
const { ethers } = require('hardhat')
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers')

describe('YieldDistributor', function () {
  const OP_TREASURY_UPDATED = 1
  const OP_SHARE_UPDATED = 2

  const ERR_INVALID_ADDRESS = 1
  const ERR_INVALID_SHARE = 2
  const ERR_SHARE_EXCEEDS_MAXIMUM = 3
  const ERR_OVERFLOW = 4

  async function deployYieldDistributorFixture () {
    const [owner, user1, user2, otherAdmin] = await ethers.getSigners()
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

    const GRACE_PERIOD = 7 // 7 days
    const platformAdmin = await ethers.deployContract('PlatformAdmin', [
      GRACE_PERIOD,
      owner
    ])
    await platformAdmin.waitForDeployment()

    await platformAdmin.addPlatformAdmin(await otherAdmin.getAddress())

    const platformAdminAddress = await platformAdmin.getAddress()

    const yieldDistributor = await ethers.deployContract('YieldDistributor', [
      randomWallet.address,
      platformAdminAddress,
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
      randomWallet2,
      platformAdmin,
      otherAdmin
    }
  }

  describe('Deployment', function () {
    it('Should deploy all contracts successfully.', async function () {
      const { yieldDistributor } = await loadFixture(
        deployYieldDistributorFixture
      )

      expect(await yieldDistributor.getAddress()).to.be.properAddress
    })

    it('Should correctly set the initial state', async function () {
      const { yieldDistributor, owner, randomWallet } = await loadFixture(
        deployYieldDistributorFixture
      )

      expect(await yieldDistributor.owner()).to.equal(owner.address)
      expect(await yieldDistributor.platformTreasury()).to.equal(
        randomWallet.address
      )
    })

    it('Should revert if zero address platform treasury passed to constructor', async function () {
      const { owner, platformAdmin } = await loadFixture(
        deployYieldDistributorFixture
      )

      const YieldDistributorFactory = await ethers.getContractFactory(
        'YieldDistributor'
      )

      const platformAdminAddress = await platformAdmin.getAddress()

      await expect(
        YieldDistributorFactory.deploy(
          ethers.ZeroAddress,
          platformAdminAddress,
          owner.address
        )
      )
        .to.be.revertedWithCustomError(
          YieldDistributorFactory,
          'YieldDistributorError'
        )
        .withArgs(ERR_INVALID_ADDRESS, ethers.ZeroAddress, 0)
    })
  })

  describe('Updating platform treasury', function () {
    it('Should allow owner to update the platform treasury', async function () {
      const { yieldDistributor, randomWallet, randomWallet2 } =
        await loadFixture(deployYieldDistributorFixture)

      expect(await yieldDistributor.platformTreasury()).to.equal(
        randomWallet.address
      )

      await expect(yieldDistributor.updatePlatformTreasury(randomWallet2))
        .to.emit(yieldDistributor, 'YieldDistributorOperation')
        .withArgs(
          OP_TREASURY_UPDATED,
          randomWallet.address,
          randomWallet2.address,
          0,
          0
        )

      expect(await yieldDistributor.platformTreasury()).to.equal(
        randomWallet2.address
      )
    })

    it('Should revert if non-owner attempts to update the platform treasury', async function () {
      const { yieldDistributor, user1, randomWallet, randomWallet2 } =
        await loadFixture(deployYieldDistributorFixture)

      expect(await yieldDistributor.platformTreasury()).to.equal(
        randomWallet.address
      )

      yieldDistributor
        .connect(user1)
        .updatePlatformTreasury(randomWallet2.address)

      await expect(
        yieldDistributor
          .connect(user1)
          .updatePlatformTreasury(randomWallet2.address)
      )
        .to.be.revertedWithCustomError(yieldDistributor, 'NotAuthorizedAdmin')
        .withArgs(user1.address)

      expect(await yieldDistributor.platformTreasury()).to.equal(
        randomWallet.address
      )
    })

    it('Should revert if zero address is pass to updatePlatformTreasury()', async function () {
      const { yieldDistributor, randomWallet } = await loadFixture(
        deployYieldDistributorFixture
      )
      expect(await yieldDistributor.platformTreasury()).to.equal(
        randomWallet.address
      )

      await expect(yieldDistributor.updatePlatformTreasury(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(
          yieldDistributor,
          'YieldDistributorError'
        )
        .withArgs(ERR_INVALID_ADDRESS, ethers.ZeroAddress, 0)

      expect(await yieldDistributor.platformTreasury()).to.equal(
        randomWallet.address
      )
    })

    it('Should allow other admins to updatePlatformTreasury()', async function () {
      const { yieldDistributor, randomWallet, randomWallet2, otherAdmin } =
        await loadFixture(deployYieldDistributorFixture)

      expect(await yieldDistributor.platformTreasury()).to.equal(
        randomWallet.address
      )

      await expect(
        yieldDistributor
          .connect(otherAdmin)
          .updatePlatformTreasury(randomWallet2.address)
      )
        .to.emit(yieldDistributor, 'YieldDistributorOperation')
        .withArgs(
          OP_TREASURY_UPDATED,
          randomWallet.address,
          randomWallet2.address,
          0,
          0
        )

      expect(await yieldDistributor.platformTreasury()).to.equal(
        randomWallet2.address
      )
    })
  })

  describe('Updating platform yield share', function () {
    it('Should allow owner to update platform yield share', async function () {
      const { yieldDistributor } = await loadFixture(
        deployYieldDistributorFixture
      )

      const currentYieldShare = await yieldDistributor.platformYieldShare()
      const newYieldShare = 3000

      await expect(yieldDistributor.updatePlatformYieldShare(newYieldShare))
        .to.emit(yieldDistributor, 'YieldDistributorOperation')
        .withArgs(
          OP_SHARE_UPDATED,
          ethers.ZeroAddress,
          ethers.ZeroAddress,
          currentYieldShare,
          newYieldShare
        )

      expect(await yieldDistributor.platformYieldShare()).to.equal(
        newYieldShare
      )
    })

    it('Should revert if new yield share is greater than the maximum', async function () {
      const { yieldDistributor } = await loadFixture(
        deployYieldDistributorFixture
      )

      const currentYieldShare = await yieldDistributor.platformYieldShare()
      const newYieldShare = 7000

      await expect(yieldDistributor.updatePlatformYieldShare(newYieldShare))
        .to.be.revertedWithCustomError(
          yieldDistributor,
          'YieldDistributorError'
        )
        .withArgs(ERR_SHARE_EXCEEDS_MAXIMUM, ethers.ZeroAddress, newYieldShare)

      expect(await yieldDistributor.platformYieldShare()).to.equal(
        currentYieldShare
      )
    })

    it('Should revert when non-owner tries to update platform yield share', async function () {
      const { yieldDistributor, user1 } = await loadFixture(
        deployYieldDistributorFixture
      )

      const currentYieldShare = await yieldDistributor.platformYieldShare()
      const newYieldShare = 3000

      await expect(
        yieldDistributor.connect(user1).updatePlatformYieldShare(newYieldShare)
      )
        .to.be.revertedWithCustomError(yieldDistributor, 'NotAuthorizedAdmin')
        .withArgs(user1.address)

      expect(await yieldDistributor.platformYieldShare()).to.equal(
        currentYieldShare
      )
    })

    it('Should allow setting platform yield share to 0', async function () {
      const { yieldDistributor } = await loadFixture(
        deployYieldDistributorFixture
      )

      const currentYieldShare = await yieldDistributor.platformYieldShare()
      const newYieldShare = 0

      await expect(yieldDistributor.updatePlatformYieldShare(newYieldShare))
        .to.emit(yieldDistributor, 'YieldDistributorOperation')
        .withArgs(
          OP_SHARE_UPDATED,
          ethers.ZeroAddress,
          ethers.ZeroAddress,
          currentYieldShare,
          newYieldShare
        )

      expect(await yieldDistributor.platformYieldShare()).to.equal(
        newYieldShare
      )

      const totalYield = 100
      const [creatorShare, platformShare] =
        await yieldDistributor.calculateYieldShares(totalYield)

      expect(platformShare).to.equal(0)
      expect(creatorShare).to.equal(totalYield)
    })

    it('Should allow setting platform yield share to maximum value (5000)', async function () {
      const { yieldDistributor } = await loadFixture(
        deployYieldDistributorFixture
      )

      const currentYieldShare = await yieldDistributor.platformYieldShare()
      const maxYieldShare = 5000 // 50%

      await expect(yieldDistributor.updatePlatformYieldShare(maxYieldShare))
        .to.emit(yieldDistributor, 'YieldDistributorOperation')
        .withArgs(
          OP_SHARE_UPDATED,
          ethers.ZeroAddress,
          ethers.ZeroAddress,
          currentYieldShare,
          maxYieldShare
        )

      expect(await yieldDistributor.platformYieldShare()).to.equal(
        maxYieldShare
      )

      const totalYield = 100
      const [creatorShare, platformShare] =
        await yieldDistributor.calculateYieldShares(totalYield)

      expect(platformShare).to.equal(50)
      expect(creatorShare).to.equal(50)
    })

    it('Should allow other admins to update platform yield share', async function () {
      const { yieldDistributor, otherAdmin } = await loadFixture(
        deployYieldDistributorFixture
      )

      const currentYieldShare = await yieldDistributor.platformYieldShare()
      const newYieldShare = 3000

      await expect(
        yieldDistributor
          .connect(otherAdmin)
          .updatePlatformYieldShare(newYieldShare)
      )
        .to.emit(yieldDistributor, 'YieldDistributorOperation')
        .withArgs(
          OP_SHARE_UPDATED,
          ethers.ZeroAddress,
          ethers.ZeroAddress,
          currentYieldShare,
          newYieldShare
        )

      expect(await yieldDistributor.platformYieldShare()).to.equal(
        newYieldShare
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

      expect(await yieldDistributor.platformYieldShare()).to.equal(
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

      await expect(yieldDistributor.calculateYieldShares(maxUint256))
        .to.be.revertedWithCustomError(
          yieldDistributor,
          'YieldDistributorError'
        )
        .withArgs(4, ethers.ZeroAddress, maxUint256)

      const overflowTrigger = maxUint256 / 2000n + 1n

      await expect(yieldDistributor.calculateYieldShares(overflowTrigger))
        .to.be.revertedWithCustomError(
          yieldDistributor,
          'YieldDistributorError'
        )
        .withArgs(ERR_OVERFLOW, ethers.ZeroAddress, overflowTrigger)
    })

    it('Should calculate correct yield share with 0% platform share', async function () {
      const { yieldDistributor } = await loadFixture(
        deployYieldDistributorFixture
      )

      await yieldDistributor.updatePlatformYieldShare(0)
      expect(await yieldDistributor.platformYieldShare()).to.equal(0)

      const totalYield = 100
      const [creatorShare, platformShare] =
        await yieldDistributor.calculateYieldShares(totalYield)

      expect(platformShare).to.equal(0)
      expect(creatorShare).to.equal(100)
      expect(creatorShare + platformShare).to.equal(totalYield)
    })

    it('Should calculate correct yield share with maximum platform share (50%)', async function () {
      const { yieldDistributor } = await loadFixture(
        deployYieldDistributorFixture
      )

      const maxShare = 5000
      await yieldDistributor.updatePlatformYieldShare(maxShare)
      expect(await yieldDistributor.platformYieldShare()).to.equal(maxShare)

      const testAmounts = [10, 100, 99, 1]

      for (const amount of testAmounts) {
        const [creatorShare, platformShare] =
          await yieldDistributor.calculateYieldShares(amount)

        const expectedPlatformShare = Math.floor((amount * 5000) / 10000)
        const expectedCreatorShare = amount - expectedPlatformShare

        expect(platformShare).to.equal(expectedPlatformShare)
        expect(creatorShare).to.equal(expectedCreatorShare)
        expect(Number(creatorShare) + Number(platformShare)).to.equal(amount)
      }

      const [creatorShare100, platformShare100] =
        await yieldDistributor.calculateYieldShares(100)

      expect(platformShare100).to.equal(50)
      expect(creatorShare100).to.equal(50)
    })
  })

  describe('Getter functions', function () {
    it('Should correctly return platform treasury address', async function () {
      const { yieldDistributor, randomWallet } = await loadFixture(
        deployYieldDistributorFixture
      )

      expect(await yieldDistributor.platformTreasury()).to.equal(
        randomWallet.address
      )
    })

    it('Should correctly return updated platform treasury address', async function () {
      const { yieldDistributor, randomWallet, randomWallet2 } =
        await loadFixture(deployYieldDistributorFixture)

      await yieldDistributor.updatePlatformTreasury(randomWallet2.address)

      expect(await yieldDistributor.platformTreasury()).to.equal(
        randomWallet2.address
      )
    })

    it('Should correctly return platform yield share', async function () {
      const { yieldDistributor } = await loadFixture(
        deployYieldDistributorFixture
      )

      expect(await yieldDistributor.platformYieldShare()).to.equal(2000)
    })

    it('Should correctly return updated platform yield share', async function () {
      const { yieldDistributor } = await loadFixture(
        deployYieldDistributorFixture
      )

      const newShare = 3000
      await yieldDistributor.updatePlatformYieldShare(newShare)

      expect(await yieldDistributor.platformYieldShare()).to.equal(newShare)

      await yieldDistributor.updatePlatformYieldShare(0)
      expect(await yieldDistributor.platformYieldShare()).to.equal(0)

      await yieldDistributor.updatePlatformYieldShare(5000)
      expect(await yieldDistributor.platformYieldShare()).to.equal(5000)
    })

    it('Should maintain consistency between direct variable access and getter functions', async function () {
      const { yieldDistributor, randomWallet2 } = await loadFixture(
        deployYieldDistributorFixture
      )

      await yieldDistributor.updatePlatformTreasury(randomWallet2.address)
      await yieldDistributor.updatePlatformYieldShare(1500)

      const directTreasury = await yieldDistributor.platformTreasury()
      const getTreasury = await yieldDistributor.platformTreasury()
      expect(directTreasury).to.equal(getTreasury)

      const directShare = await yieldDistributor.platformYieldShare()
      const getShare = await yieldDistributor.platformYieldShare()
      expect(directShare).to.equal(getShare)
    })
  })
})
