import { token } from '../typechain-types/@openzeppelin/contracts'

const { expect } = require('chai')
const { ethers } = require('hardhat')
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers')

import { deployPlatformFixture } from './fixture'

describe('YieldDistributor', function () {
  const OP_TREASURY_UPDATED = 1
  const OP_SHARE_UPDATED = 2

  // Error codes
  const ERR_INVALID_ADDRESS = 1
  const ERR_INVALID_SHARE = 2
  const ERR_SHARE_EXCEEDS_MAXIMUM = 3
  const ERR_OVERFLOW = 4

  describe('Deployment', function () {
    it('Should deploy all contracts successfully.', async function () {
      const { yieldDistributor } = await loadFixture(deployPlatformFixture)

      expect(await yieldDistributor.getAddress()).to.be.properAddress
    })

    it('Should correctly set the initial state', async function () {
      const { yieldDistributor, deployer, platformTreasury } =
        await loadFixture(deployPlatformFixture)

      expect(await yieldDistributor.owner()).to.equal(deployer.address)
      expect(await yieldDistributor.platformTreasury()).to.equal(
        platformTreasury.address
      )
    })

    it('Should revert if zero address platform treasury passed to constructor', async function () {
      const { deployer, platformAdmin } = await loadFixture(
        deployPlatformFixture
      )

      const YieldDistributorFactory = await ethers.getContractFactory(
        'YieldDistributor'
      )

      const platformAdminAddress = await platformAdmin.getAddress()

      await expect(
        YieldDistributorFactory.deploy(
          ethers.ZeroAddress,
          platformAdminAddress,
          deployer.address
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
      const { yieldDistributor, platformTreasury, platformTreasury2 } =
        await loadFixture(deployPlatformFixture)

      expect(await yieldDistributor.platformTreasury()).to.equal(
        platformTreasury.address
      )

      await expect(yieldDistributor.updatePlatformTreasury(platformTreasury2))
        .to.emit(yieldDistributor, 'YieldDistributorOperation')
        .withArgs(
          OP_TREASURY_UPDATED,
          platformTreasury.address,
          platformTreasury2.address,
          0,
          0
        )

      expect(await yieldDistributor.platformTreasury()).to.equal(
        platformTreasury2.address
      )
    })

    it('Should revert if non-owner attempts to update the platform treasury', async function () {
      const {
        yieldDistributor,
        creator1,
        platformTreasury,
        platformTreasury2
      } = await loadFixture(deployPlatformFixture)

      expect(await yieldDistributor.platformTreasury()).to.equal(
        platformTreasury.address
      )

      yieldDistributor
        .connect(creator1)
        .updatePlatformTreasury(platformTreasury2.address)

      await expect(
        yieldDistributor
          .connect(creator1)
          .updatePlatformTreasury(platformTreasury2.address)
      )
        .to.be.revertedWithCustomError(yieldDistributor, 'NotAuthorizedAdmin')
        .withArgs(creator1.address)

      expect(await yieldDistributor.platformTreasury()).to.equal(
        platformTreasury.address
      )
    })

    it('Should revert if zero address is pass to updatePlatformTreasury()', async function () {
      const { yieldDistributor, platformTreasury } = await loadFixture(
        deployPlatformFixture
      )
      expect(await yieldDistributor.platformTreasury()).to.equal(
        platformTreasury.address
      )

      await expect(yieldDistributor.updatePlatformTreasury(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(
          yieldDistributor,
          'YieldDistributorError'
        )
        .withArgs(ERR_INVALID_ADDRESS, ethers.ZeroAddress, 0)

      expect(await yieldDistributor.platformTreasury()).to.equal(
        platformTreasury.address
      )
    })

    it('Should allow other admins to updatePlatformTreasury()', async function () {
      const {
        yieldDistributor,
        platformTreasury,
        platformTreasury2,
        otherAdmin,
        platformAdmin
      } = await loadFixture(deployPlatformFixture)

      expect(await yieldDistributor.platformTreasury()).to.equal(
        platformTreasury.address
      )

      await platformAdmin.addPlatformAdmin(otherAdmin.address)

      await expect(
        yieldDistributor
          .connect(otherAdmin)
          .updatePlatformTreasury(platformTreasury2.address)
      )
        .to.emit(yieldDistributor, 'YieldDistributorOperation')
        .withArgs(
          OP_TREASURY_UPDATED,
          platformTreasury.address,
          platformTreasury2.address,
          0,
          0
        )

      expect(await yieldDistributor.platformTreasury()).to.equal(
        platformTreasury2.address
      )
    })
  })

  describe('Updating platform yield share', function () {
    it('Should allow owner to update platform yield share', async function () {
      const { yieldDistributor } = await loadFixture(deployPlatformFixture)

      const currentYieldShare = await yieldDistributor.platformYieldShare()
      const newYieldShare = 200

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
      const { yieldDistributor } = await loadFixture(deployPlatformFixture)

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

    it('Should revert if new yield share is too large to fit in uint16', async function () {
      const { yieldDistributor } = await loadFixture(deployPlatformFixture)

      const currentYieldShare = await yieldDistributor.platformYieldShare()

      // Value larger than uint16 max (65535)
      const tooLargeYieldShare = 70000

      await expect(
        yieldDistributor.updatePlatformYieldShare(tooLargeYieldShare)
      )
        .to.be.revertedWithCustomError(
          yieldDistributor,
          'YieldDistributorError'
        )
        .withArgs(ERR_INVALID_SHARE, ethers.ZeroAddress, tooLargeYieldShare)

      // Verify state hasn't changed
      expect(await yieldDistributor.platformYieldShare()).to.equal(
        currentYieldShare
      )
    })

    it('Should revert when non-owner tries to update platform yield share', async function () {
      const { yieldDistributor, creator1 } = await loadFixture(
        deployPlatformFixture
      )

      const currentYieldShare = await yieldDistributor.platformYieldShare()
      const newYieldShare = 175

      await expect(
        yieldDistributor
          .connect(creator1)
          .updatePlatformYieldShare(newYieldShare)
      )
        .to.be.revertedWithCustomError(yieldDistributor, 'NotAuthorizedAdmin')
        .withArgs(creator1.address)

      expect(await yieldDistributor.platformYieldShare()).to.equal(
        currentYieldShare
      )
    })

    it('Should allow setting platform yield share to 0', async function () {
      const { yieldDistributor } = await loadFixture(deployPlatformFixture)

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

      const totalYield = ethers.parseUnits('100', 6)
      const [creatorShare, platformShare] =
        await yieldDistributor.calculateYieldShares(totalYield)

      expect(platformShare).to.equal(0)
      expect(creatorShare).to.equal(totalYield)
    })

    it('Should allow setting platform yield share to maximum value', async function () {
      const { yieldDistributor } = await loadFixture(deployPlatformFixture)

      const currentYieldShare = await yieldDistributor.platformYieldShare()
      const maxYieldShare = 200

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

      const totalYield = ethers.parseUnits('500', 6)
      const expectedPlatformShare =
        (BigInt(totalYield) * BigInt(maxYieldShare)) / BigInt(10000)
      const expectedCreatorShare = totalYield - expectedPlatformShare

      const [creatorShare, platformShare] =
        await yieldDistributor.calculateYieldShares(totalYield)

      expect(platformShare).to.equal(expectedPlatformShare)
      expect(creatorShare).to.equal(expectedCreatorShare)
    })

    it('Should allow other admins to update platform yield share', async function () {
      const { yieldDistributor, otherAdmin, platformAdmin } = await loadFixture(
        deployPlatformFixture
      )

      const currentYieldShare = await yieldDistributor.platformYieldShare()
      const newYieldShare = 20

      await platformAdmin.addPlatformAdmin(otherAdmin.address)

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
      const { yieldDistributor } = await loadFixture(deployPlatformFixture)

      const platformYieldShare = await yieldDistributor.platformYieldShare()

      const totalYield = ethers.parseUnits('500', 6)
      const expectedPlatformShare =
        (BigInt(totalYield) * BigInt(platformYieldShare)) / BigInt(10000)
      const expectedCreatorShare = totalYield - expectedPlatformShare

      expect(
        await yieldDistributor.calculateYieldShares(totalYield)
      ).to.deep.equal([expectedCreatorShare, expectedPlatformShare])
    })

    it('Should calculate correct yield share after updating yield share', async function () {
      const { yieldDistributor } = await loadFixture(deployPlatformFixture)

      const totalYield = ethers.parseUnits('500', 6)

      const newYieldShare = 200

      await yieldDistributor.updatePlatformYieldShare(newYieldShare)

      expect(await yieldDistributor.platformYieldShare()).to.equal(
        newYieldShare
      )

      const expectedPlatformShare =
        (BigInt(totalYield) * BigInt(newYieldShare)) / BigInt(10000)
      const expectedCreatorShare = totalYield - expectedPlatformShare

      expect(
        await yieldDistributor.calculateYieldShares(totalYield)
      ).to.deep.equal([expectedCreatorShare, expectedPlatformShare])
    })

    it('Should calculate correct yield share with 0 yield', async function () {
      const { yieldDistributor } = await loadFixture(deployPlatformFixture)

      const totalYield = ethers.parseUnits('0', 6)

      expect(
        await yieldDistributor.calculateYieldShares(totalYield)
      ).to.deep.equal([0, 0])
    })

    it('Should calculate correct yield share with extremely large but realistic values', async function () {
      const { yieldDistributor } = await loadFixture(deployPlatformFixture)

      const platformYieldShare = await yieldDistributor.platformYieldShare()

      const totalYield = ethers.parseUnits('1000000000', 6) // 1 billion USDC

      const expectedPlatformShare =
        (totalYield * BigInt(platformYieldShare)) / 10000n
      const expectedCreatorShare = totalYield - expectedPlatformShare

      const [creatorShare, platformShare] =
        await yieldDistributor.calculateYieldShares(totalYield)

      expect(platformShare).to.equal(expectedPlatformShare)
      expect(creatorShare).to.equal(expectedCreatorShare)

      expect(creatorShare + platformShare).to.equal(totalYield)
    })

    it('Should handle rounding correctly during yield share calculation', async function () {
      const { yieldDistributor } = await loadFixture(deployPlatformFixture)

      await yieldDistributor.updatePlatformYieldShare(333)

      const totalYield = ethers.parseUnits('10', 6) //USDC decimals

      const expectedPlatformShare = ethers.parseUnits('0.333', 6)
      const expectedCreatorShare = totalYield - expectedPlatformShare

      const [creatorShare, platformShare] =
        await yieldDistributor.calculateYieldShares(totalYield)

      expect(platformShare).to.equal(expectedPlatformShare)
      expect(creatorShare).to.equal(expectedCreatorShare)
      expect(Number(creatorShare) + Number(platformShare)).to.equal(totalYield)
    })

    it('Should revert on arithmetic overflow', async function () {
      const { yieldDistributor } = await loadFixture(deployPlatformFixture)

      const platformYieldShare = await yieldDistributor.platformYieldShare()

      const maxUint256 = 2n ** 256n - 1n

      await expect(yieldDistributor.calculateYieldShares(maxUint256))
        .to.be.revertedWithCustomError(
          yieldDistributor,
          'YieldDistributorError'
        )
        .withArgs(4, ethers.ZeroAddress, maxUint256)

      const overflowTrigger =
        ethers.MaxUint256 / BigInt(platformYieldShare) + 1n

      await expect(yieldDistributor.calculateYieldShares(overflowTrigger))
        .to.be.revertedWithCustomError(
          yieldDistributor,
          'YieldDistributorError'
        )
        .withArgs(ERR_OVERFLOW, ethers.ZeroAddress, overflowTrigger)
    })

    it('Should calculate correct yield share with 0% platform share', async function () {
      const { yieldDistributor } = await loadFixture(deployPlatformFixture)

      await yieldDistributor.updatePlatformYieldShare(0)
      expect(await yieldDistributor.platformYieldShare()).to.equal(0)

      const totalYield = ethers.parseUnits('100', 6)
      const [creatorShare, platformShare] =
        await yieldDistributor.calculateYieldShares(totalYield)

      const expectedPlatformShare = 0
      const expectedCreatorShare = totalYield

      expect(platformShare).to.equal(expectedPlatformShare)
      expect(creatorShare).to.equal(expectedCreatorShare)
      expect(creatorShare + platformShare).to.equal(totalYield)
    })

    it('Should calculate correct yield share with maximum platform share (5%)', async function () {
      const { yieldDistributor } = await loadFixture(deployPlatformFixture)

      const maxShare = 500 // 500 basis points = 5%
      await yieldDistributor.updatePlatformYieldShare(maxShare)
      expect(await yieldDistributor.platformYieldShare()).to.equal(maxShare)

      const testAmounts = [
        ethers.parseUnits('10', 6),
        ethers.parseUnits('100', 6),
        ethers.parseUnits('99', 6),
        ethers.parseUnits('1', 6)
      ]

      for (const amount of testAmounts) {
        const [creatorShare, platformShare] =
          await yieldDistributor.calculateYieldShares(amount)

        const expectedPlatformShare = (amount * BigInt(maxShare)) / 10000n
        const expectedCreatorShare = amount - expectedPlatformShare

        expect(platformShare).to.equal(expectedPlatformShare)
        expect(creatorShare).to.equal(expectedCreatorShare)

        expect(creatorShare + platformShare).to.equal(amount)
      }
    })
  })

  describe('Getter functions', function () {
    it('Should correctly return platform treasury address', async function () {
      const { yieldDistributor, platformTreasury } = await loadFixture(
        deployPlatformFixture
      )

      expect(await yieldDistributor.platformTreasury()).to.equal(
        platformTreasury.address
      )
    })

    it('Should correctly return updated platform treasury address', async function () {
      const { yieldDistributor, platformTreasury, platformTreasury2 } =
        await loadFixture(deployPlatformFixture)

      await yieldDistributor.updatePlatformTreasury(platformTreasury2.address)

      expect(await yieldDistributor.platformTreasury()).to.equal(
        platformTreasury2.address
      )
    })

    it('Should correctly return platform default yield share', async function () {
      const { yieldDistributor } = await loadFixture(deployPlatformFixture)

      expect(await yieldDistributor.platformYieldShare()).to.equal(100)
    })

    it('Should correctly return updated platform yield share', async function () {
      const { yieldDistributor } = await loadFixture(deployPlatformFixture)

      const newShare = 200
      await yieldDistributor.updatePlatformYieldShare(newShare)

      expect(await yieldDistributor.platformYieldShare()).to.equal(newShare)

      await yieldDistributor.updatePlatformYieldShare(0)
      expect(await yieldDistributor.platformYieldShare()).to.equal(0)

      await yieldDistributor.updatePlatformYieldShare(500)
      expect(await yieldDistributor.platformYieldShare()).to.equal(500)
    })
  })
})
