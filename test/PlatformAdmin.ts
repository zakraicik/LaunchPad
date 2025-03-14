import { token } from '../typechain-types/@openzeppelin/contracts'

import { expect } from 'chai'
import { ethers } from 'hardhat'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'

describe('PlatformAdmin', function () {
  const OP_ADMIN_ADDED = 1
  const OP_ADMIN_REMOVED = 2
  const OP_GRACE_PERIOD_UPDATED = 3

  // Error codes for consolidated errors
  const ERR_NOT_AUTHORIZED = 1
  const ERR_INVALID_ADDRESS = 2
  const ERR_INVALID_GRACE_PERIOD = 3
  const ERR_ADMIN_NOT_EXISTS = 4
  const ERR_ADMIN_ALREADY_EXISTS = 5
  const ERR_CANT_REMOVE_OWNER = 6

  async function deployPlatformAdmin () {
    const CAMPAIGN_GOAL_AMOUNT = 5
    const CAMPAIGN_DURATION = 30

    const GRACE_PERIOD = 7

    const [owner, otherAdmin, user1, user2, mockToken, defiManager] =
      await ethers.getSigners()

    // Deploy a mock campaign for testing grace period
    const mockCampaign = await ethers.deployContract('MockCampaign', [
      owner.address,
      mockToken, //don't need real mock token for this
      CAMPAIGN_GOAL_AMOUNT,
      CAMPAIGN_DURATION,
      defiManager //don't need real defi manager for this
    ])
    await mockCampaign.waitForDeployment()

    // Deploy PlatformAdmin contract
    const platformAdmin = await ethers.deployContract('PlatformAdmin', [
      GRACE_PERIOD,
      owner.address
    ])
    await platformAdmin.waitForDeployment()

    return {
      platformAdmin,
      mockCampaign,
      owner,
      otherAdmin,
      user1,
      user2,
      GRACE_PERIOD
    }
  }

  describe('Deployment', function () {
    it('Should deploy successfully', async function () {
      const { platformAdmin } = await loadFixture(deployPlatformAdmin)
      expect(await platformAdmin.getAddress()).to.be.properAddress
    })

    it('Should set the correct initial grace period', async function () {
      const { platformAdmin, GRACE_PERIOD } = await loadFixture(
        deployPlatformAdmin
      )
      expect(await platformAdmin.gracePeriod()).to.equal(GRACE_PERIOD)
    })

    it('Should set owner as platform admin', async function () {
      const { platformAdmin, owner } = await loadFixture(deployPlatformAdmin)
      expect(await platformAdmin.owner()).to.equal(owner.address)
      expect(await platformAdmin.platformAdmins(owner.address)).to.be.true
    })

    it('Should revert if grace period is zero', async function () {
      const [owner] = await ethers.getSigners()
      const PlatformAdminFactory = await ethers.getContractFactory(
        'PlatformAdmin'
      )

      await expect(PlatformAdminFactory.deploy(0, owner.address))
        .to.be.revertedWithCustomError(
          PlatformAdminFactory,
          'PlatformAdminError'
        )
        .withArgs(ERR_INVALID_GRACE_PERIOD, ethers.ZeroAddress, 0)
    })
  })

  describe('Admin Management', function () {
    it('Should allow adding a new platform admin', async function () {
      const { platformAdmin, owner, otherAdmin } = await loadFixture(
        deployPlatformAdmin
      )

      expect(await platformAdmin.platformAdmins(otherAdmin.address)).to.be.false

      await expect(platformAdmin.addPlatformAdmin(otherAdmin.address))
        .to.emit(platformAdmin, 'PlatformAdminOperation')
        .withArgs(OP_ADMIN_ADDED, otherAdmin.address, 0, 0)

      expect(await platformAdmin.platformAdmins(otherAdmin.address)).to.be.true
    })

    it('Should revert when adding an admin that already exists', async function () {
      const { platformAdmin, owner } = await loadFixture(deployPlatformAdmin)

      await expect(platformAdmin.addPlatformAdmin(owner.address))
        .to.be.revertedWithCustomError(platformAdmin, 'PlatformAdminError')
        .withArgs(ERR_ADMIN_ALREADY_EXISTS, owner.address, 0)
    })

    it('Should revert when adding zero address as admin', async function () {
      const { platformAdmin, owner } = await loadFixture(deployPlatformAdmin)

      await expect(platformAdmin.addPlatformAdmin(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(platformAdmin, 'PlatformAdminError')
        .withArgs(ERR_INVALID_ADDRESS, ethers.ZeroAddress, 0)
    })

    it('Should allow an admin to add another admin', async function () {
      const { platformAdmin, owner, otherAdmin, user1 } = await loadFixture(
        deployPlatformAdmin
      )

      // First, owner adds otherAdmin
      await platformAdmin.addPlatformAdmin(otherAdmin.address)

      // Then otherAdmin adds user1
      await expect(
        platformAdmin.connect(otherAdmin).addPlatformAdmin(user1.address)
      )
        .to.emit(platformAdmin, 'PlatformAdminOperation')
        .withArgs(OP_ADMIN_ADDED, user1.address, 0, 0)

      expect(await platformAdmin.platformAdmins(user1.address)).to.be.true
    })

    it('Should revert when non-admin tries to add an admin', async function () {
      const { platformAdmin, user1, user2 } = await loadFixture(
        deployPlatformAdmin
      )

      await expect(platformAdmin.connect(user1).addPlatformAdmin(user2.address))
        .to.be.revertedWithCustomError(platformAdmin, 'PlatformAdminError')
        .withArgs(ERR_NOT_AUTHORIZED, user1.address, 0)
    })

    it('Should allow removing an admin', async function () {
      const { platformAdmin, owner, otherAdmin } = await loadFixture(
        deployPlatformAdmin
      )

      // First, add an admin
      await platformAdmin.addPlatformAdmin(otherAdmin.address)
      expect(await platformAdmin.platformAdmins(otherAdmin.address)).to.be.true

      // Then remove the admin
      await expect(platformAdmin.removePlatformAdmin(otherAdmin.address))
        .to.emit(platformAdmin, 'PlatformAdminOperation')
        .withArgs(OP_ADMIN_REMOVED, otherAdmin.address, 0, 0)

      expect(await platformAdmin.platformAdmins(otherAdmin.address)).to.be.false
    })

    it('Should revert when removing an admin that does not exist', async function () {
      const { platformAdmin, user1 } = await loadFixture(deployPlatformAdmin)

      await expect(platformAdmin.removePlatformAdmin(user1.address))
        .to.be.revertedWithCustomError(platformAdmin, 'PlatformAdminError')
        .withArgs(ERR_ADMIN_NOT_EXISTS, user1.address, 0)
    })

    it('Should revert when non-admin tries to remove an admin', async function () {
      const { platformAdmin, owner, user1 } = await loadFixture(
        deployPlatformAdmin
      )

      await expect(
        platformAdmin.connect(user1).removePlatformAdmin(owner.address)
      )
        .to.be.revertedWithCustomError(platformAdmin, 'PlatformAdminError')
        .withArgs(ERR_NOT_AUTHORIZED, user1.address, 0)
    })

    it('Should revert when trying to remove the owner', async function () {
      const { platformAdmin, owner, otherAdmin } = await loadFixture(
        deployPlatformAdmin
      )

      // Add otherAdmin first
      await platformAdmin.addPlatformAdmin(otherAdmin.address)

      // Try to remove the owner
      await expect(
        platformAdmin.connect(otherAdmin).removePlatformAdmin(owner.address)
      )
        .to.be.revertedWithCustomError(platformAdmin, 'PlatformAdminError')
        .withArgs(ERR_CANT_REMOVE_OWNER, owner.address, 0)
    })

    it('Should allow an admin to remove another admin', async function () {
      const { platformAdmin, owner, otherAdmin, user1 } = await loadFixture(
        deployPlatformAdmin
      )

      // Add both admins
      await platformAdmin.addPlatformAdmin(otherAdmin.address)
      await platformAdmin.addPlatformAdmin(user1.address)

      // otherAdmin removes user1
      await expect(
        platformAdmin.connect(otherAdmin).removePlatformAdmin(user1.address)
      )
        .to.emit(platformAdmin, 'PlatformAdminOperation')
        .withArgs(OP_ADMIN_REMOVED, user1.address, 0, 0)

      expect(await platformAdmin.platformAdmins(user1.address)).to.be.false
    })
  })

  describe('Grace Period Management', function () {
    it('Should allow owner to update grace period', async function () {
      const { platformAdmin, GRACE_PERIOD, owner } = await loadFixture(
        deployPlatformAdmin
      )

      const newGracePeriod = 14

      await expect(platformAdmin.updateGracePeriod(newGracePeriod))
        .to.emit(platformAdmin, 'PlatformAdminOperation')
        .withArgs(
          OP_GRACE_PERIOD_UPDATED,
          ethers.ZeroAddress,
          GRACE_PERIOD,
          newGracePeriod
        )

      expect(await platformAdmin.gracePeriod()).to.equal(newGracePeriod)
    })

    it('Should revert when setting grace period to zero', async function () {
      const { platformAdmin } = await loadFixture(deployPlatformAdmin)

      await expect(platformAdmin.updateGracePeriod(0))
        .to.be.revertedWithCustomError(platformAdmin, 'PlatformAdminError')
        .withArgs(ERR_INVALID_GRACE_PERIOD, ethers.ZeroAddress, 0)
    })

    it('Should revert when non-owner tries to update grace period', async function () {
      const { platformAdmin, otherAdmin } = await loadFixture(
        deployPlatformAdmin
      )

      // Add otherAdmin first
      await platformAdmin.addPlatformAdmin(otherAdmin.address)

      // Try to update grace period as otherAdmin
      await expect(platformAdmin.connect(otherAdmin).updateGracePeriod(14))
        .to.be.revertedWithCustomError(
          platformAdmin,
          'OwnableUnauthorizedAccount'
        )
        .withArgs(otherAdmin.address)
    })
  })

  describe('Grace Period Checking', function () {
    it('Should correctly report when a campaign is active', async function () {
      const { platformAdmin, mockCampaign, GRACE_PERIOD } = await loadFixture(
        deployPlatformAdmin
      )

      // Mock campaign responses
      await mockCampaign.setCampaignActive(true)

      // Set campaign end time to 5 days from now
      const currentTime = Math.floor(Date.now() / 1000)
      const campaignEndTime = currentTime + 5 * 24 * 60 * 60
      await mockCampaign.setCampaignEndTime(campaignEndTime)

      const [isOver, timeRemaining] = await platformAdmin.isGracePeriodOver(
        await mockCampaign.getAddress()
      )

      // Campaign is active, so grace period should not be over
      expect(isOver).to.be.false

      // Time remaining should be approximately 5 days campaign + 7 days grace period
      const expectedTimeRemaining = (5 + GRACE_PERIOD) * 24 * 60 * 60
      // Allow for a small deviation due to block timestamp variations
      expect(timeRemaining).to.be.closeTo(
        BigInt(expectedTimeRemaining),
        BigInt(60)
      )
    })

    it('Should correctly report when a campaign is inactive but grace period is not over', async function () {
      const { platformAdmin, mockCampaign } = await loadFixture(
        deployPlatformAdmin
      )

      // Mock campaign responses
      await mockCampaign.setCampaignActive(false)

      // Set campaign end time to 3 days ago
      const currentTime = Math.floor(Date.now() / 1000)
      const campaignEndTime = currentTime - 3 * 24 * 60 * 60
      await mockCampaign.setCampaignEndTime(campaignEndTime)

      const [isOver, timeRemaining] = await platformAdmin.isGracePeriodOver(
        await mockCampaign.getAddress()
      )

      // Campaign is inactive, but only 3 days passed (out of 7 days grace period)
      expect(isOver).to.be.false

      // Time remaining should be approximately 4 days (7 - 3)
      const expectedTimeRemaining = 4 * 24 * 60 * 60
      // Allow for a small deviation due to block timestamp variations
      expect(timeRemaining).to.be.closeTo(
        BigInt(expectedTimeRemaining),
        BigInt(60)
      )
    })

    it('Should correctly report when grace period is over', async function () {
      const { platformAdmin, mockCampaign, GRACE_PERIOD } = await loadFixture(
        deployPlatformAdmin
      )

      // Mock campaign responses
      await mockCampaign.setCampaignActive(false)

      // Set campaign end time to 10 days ago (more than grace period)
      const currentTime = Math.floor(Date.now() / 1000)
      const campaignEndTime = currentTime - 10 * 24 * 60 * 60
      await mockCampaign.setCampaignEndTime(campaignEndTime)

      const [isOver, timeRemaining] = await platformAdmin.isGracePeriodOver(
        await mockCampaign.getAddress()
      )

      // Grace period should be over
      expect(isOver).to.be.true
      expect(timeRemaining).to.equal(0)
    })
  })
})
