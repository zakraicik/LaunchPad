import { token } from '../typechain-types/@openzeppelin/contracts'

import { expect } from 'chai'
import { ethers, network } from 'hardhat'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { deployPlatformFixture } from './fixture'

import { Campaign } from '../typechain-types'

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

  describe('Deployment', function () {
    it('Should deploy successfully', async function () {
      const { platformAdmin } = await loadFixture(deployPlatformFixture)
      expect(await platformAdmin.getAddress()).to.be.properAddress
    })

    it('Should set the correct initial grace period', async function () {
      const { platformAdmin, GRACE_PERIOD } = await loadFixture(
        deployPlatformFixture
      )
      expect(await platformAdmin.gracePeriod()).to.equal(GRACE_PERIOD)
    })

    it('Should set owner as platform admin', async function () {
      const { platformAdmin, deployer } = await loadFixture(
        deployPlatformFixture
      )
      expect(await platformAdmin.owner()).to.equal(deployer.address)
      expect(await platformAdmin.platformAdmins(deployer.address)).to.be.true
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
      const { platformAdmin, otherAdmin } = await loadFixture(
        deployPlatformFixture
      )

      expect(await platformAdmin.platformAdmins(otherAdmin.address)).to.be.false

      await expect(platformAdmin.addPlatformAdmin(otherAdmin.address))
        .to.emit(platformAdmin, 'PlatformAdminOperation')
        .withArgs(OP_ADMIN_ADDED, otherAdmin.address, 0, 0)

      expect(await platformAdmin.platformAdmins(otherAdmin.address)).to.be.true
    })

    it('Should revert when adding an admin that already exists', async function () {
      const { platformAdmin, deployer } = await loadFixture(
        deployPlatformFixture
      )

      await expect(platformAdmin.addPlatformAdmin(deployer.address))
        .to.be.revertedWithCustomError(platformAdmin, 'PlatformAdminError')
        .withArgs(ERR_ADMIN_ALREADY_EXISTS, deployer.address, 0)
    })

    it('Should revert when adding zero address as admin', async function () {
      const { platformAdmin, deployer } = await loadFixture(
        deployPlatformFixture
      )

      await expect(platformAdmin.addPlatformAdmin(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(platformAdmin, 'PlatformAdminError')
        .withArgs(ERR_INVALID_ADDRESS, ethers.ZeroAddress, 0)
    })

    it('Should allow an admin to add another admin', async function () {
      const { platformAdmin, deployer, otherAdmin, contributor1 } =
        await loadFixture(deployPlatformFixture)

      // First, owner adds otherAdmin
      await platformAdmin.addPlatformAdmin(otherAdmin.address)

      // Then otherAdmin adds contributor1
      await expect(
        platformAdmin.connect(otherAdmin).addPlatformAdmin(contributor1.address)
      )
        .to.emit(platformAdmin, 'PlatformAdminOperation')
        .withArgs(OP_ADMIN_ADDED, contributor1.address, 0, 0)

      expect(await platformAdmin.platformAdmins(contributor1.address)).to.be
        .true
    })

    it('Should revert when non-admin tries to add an admin', async function () {
      const { platformAdmin, contributor1, creator2 } = await loadFixture(
        deployPlatformFixture
      )

      await expect(
        platformAdmin.connect(contributor1).addPlatformAdmin(creator2.address)
      )
        .to.be.revertedWithCustomError(platformAdmin, 'PlatformAdminError')
        .withArgs(ERR_NOT_AUTHORIZED, contributor1.address, 0)
    })

    it('Should allow removing an admin', async function () {
      const { platformAdmin, deployer, otherAdmin } = await loadFixture(
        deployPlatformFixture
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
      const { platformAdmin, contributor1 } = await loadFixture(
        deployPlatformFixture
      )

      await expect(platformAdmin.removePlatformAdmin(contributor1.address))
        .to.be.revertedWithCustomError(platformAdmin, 'PlatformAdminError')
        .withArgs(ERR_ADMIN_NOT_EXISTS, contributor1.address, 0)
    })

    it('Should revert when non-admin tries to remove an admin', async function () {
      const { platformAdmin, deployer, contributor1 } = await loadFixture(
        deployPlatformFixture
      )

      await expect(
        platformAdmin
          .connect(contributor1)
          .removePlatformAdmin(deployer.address)
      )
        .to.be.revertedWithCustomError(platformAdmin, 'PlatformAdminError')
        .withArgs(ERR_NOT_AUTHORIZED, contributor1.address, 0)
    })

    it('Should revert when trying to remove the owner', async function () {
      const { platformAdmin, deployer, otherAdmin } = await loadFixture(
        deployPlatformFixture
      )

      // Add otherAdmin first
      await platformAdmin.addPlatformAdmin(otherAdmin.address)

      // Try to remove the owner
      await expect(
        platformAdmin.connect(otherAdmin).removePlatformAdmin(deployer.address)
      )
        .to.be.revertedWithCustomError(platformAdmin, 'PlatformAdminError')
        .withArgs(ERR_CANT_REMOVE_OWNER, deployer.address, 0)
    })

    it('Should allow an admin to remove another admin', async function () {
      const { platformAdmin, deployer, otherAdmin, contributor1 } =
        await loadFixture(deployPlatformFixture)

      // Add both admins
      await platformAdmin.addPlatformAdmin(otherAdmin.address)
      await platformAdmin.addPlatformAdmin(contributor1.address)

      // otherAdmin removes contributor1
      await expect(
        platformAdmin
          .connect(otherAdmin)
          .removePlatformAdmin(contributor1.address)
      )
        .to.emit(platformAdmin, 'PlatformAdminOperation')
        .withArgs(OP_ADMIN_REMOVED, contributor1.address, 0, 0)

      expect(await platformAdmin.platformAdmins(contributor1.address)).to.be
        .false
    })
  })

  describe('Grace Period Management', function () {
    it('Should allow owner to update grace period', async function () {
      const { platformAdmin, GRACE_PERIOD } = await loadFixture(
        deployPlatformFixture
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
      const { platformAdmin } = await loadFixture(deployPlatformFixture)

      await expect(platformAdmin.updateGracePeriod(0))
        .to.be.revertedWithCustomError(platformAdmin, 'PlatformAdminError')
        .withArgs(ERR_INVALID_GRACE_PERIOD, ethers.ZeroAddress, 0)
    })

    it('Should revert when non-owner tries to update grace period', async function () {
      const { platformAdmin, otherAdmin } = await loadFixture(
        deployPlatformFixture
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
      const {
        platformAdmin,
        GRACE_PERIOD,
        campaignContractFactory,
        creator1,
        usdc
      } = await loadFixture(deployPlatformFixture)

      const usdcDecimals = await usdc.decimals()

      const CAMPAIGN_GOAL = ethers.parseUnits('500', usdcDecimals)
      const CAMPAIGN_DURATION = 60

      const tx = await campaignContractFactory
        .connect(creator1)
        .deploy(await usdc.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

      const receipt = await tx.wait()

      if (!receipt) {
        throw new Error('Transaction failed')
      }

      const event = receipt.logs.find(log => {
        try {
          const parsed = campaignContractFactory.interface.parseLog(log)
          return parsed && parsed.name === 'FactoryOperation'
        } catch {
          return false
        }
      })

      if (!event) {
        throw new Error('Event failed')
      }

      const parsedEvent = campaignContractFactory.interface.parseLog(event)
      if (!parsedEvent) {
        throw new Error('Event failed')
      }

      const campaignAddress = parsedEvent.args[1]

      const Campaign = await ethers.getContractFactory('Campaign')
      const campaign = Campaign.attach(campaignAddress) as unknown as Campaign

      const [isOver, timeRemaining] = await platformAdmin.isGracePeriodOver(
        campaignAddress
      )

      expect(isOver).to.be.false

      const expectedTimeRemaining =
        (CAMPAIGN_DURATION + GRACE_PERIOD) * 24 * 60 * 60
      // Allow for a small deviation
      expect(timeRemaining).to.be.closeTo(
        BigInt(expectedTimeRemaining),
        BigInt(60)
      )
    })

    it('Should correctly report when a campaign is inactive but grace period is not over', async function () {
      const {
        platformAdmin,
        GRACE_PERIOD,
        campaignContractFactory,
        creator1,
        usdc
      } = await loadFixture(deployPlatformFixture)

      const usdcDecimals = await usdc.decimals()

      const CAMPAIGN_GOAL = ethers.parseUnits('500', usdcDecimals)
      const CAMPAIGN_DURATION = 60

      const tx = await campaignContractFactory
        .connect(creator1)
        .deploy(await usdc.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

      const receipt = await tx.wait()

      if (!receipt) {
        throw new Error('Transaction failed')
      }

      const event = receipt.logs.find(log => {
        try {
          const parsed = campaignContractFactory.interface.parseLog(log)
          return parsed && parsed.name === 'FactoryOperation'
        } catch {
          return false
        }
      })

      if (!event) {
        throw new Error('Event failed')
      }

      const parsedEvent = campaignContractFactory.interface.parseLog(event)
      if (!parsedEvent) {
        throw new Error('Event failed')
      }

      const campaignAddress = parsedEvent.args[1]

      const Campaign = await ethers.getContractFactory('Campaign')
      const campaign = Campaign.attach(campaignAddress) as unknown as Campaign

      await network.provider.send('evm_increaseTime', [
        60 * 60 * 24 * (CAMPAIGN_DURATION + 1)
      ]) // 30 days

      await network.provider.send('evm_mine')

      const [isOver, timeRemaining] = await platformAdmin.isGracePeriodOver(
        campaignAddress
      )

      expect(await campaign.isCampaignActive()).to.be.false
      expect(isOver).to.be.false

      // Time remaining should be approximately (GRACE_PERIOD - 3) days
      const expectedTimeRemaining = (GRACE_PERIOD - 1) * 24 * 60 * 60
      // Allow for a small deviation
      expect(timeRemaining).to.be.closeTo(
        BigInt(expectedTimeRemaining),
        BigInt(60)
      )
    })

    it('Should correctly report when grace period is over', async function () {
      const {
        platformAdmin,
        GRACE_PERIOD,
        campaignContractFactory,
        creator1,
        usdc
      } = await loadFixture(deployPlatformFixture)

      const usdcDecimals = await usdc.decimals()

      const CAMPAIGN_GOAL = ethers.parseUnits('500', usdcDecimals)
      const CAMPAIGN_DURATION = 60

      const tx = await campaignContractFactory
        .connect(creator1)
        .deploy(await usdc.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

      const receipt = await tx.wait()

      if (!receipt) {
        throw new Error('Transaction failed')
      }

      const event = receipt.logs.find(log => {
        try {
          const parsed = campaignContractFactory.interface.parseLog(log)
          return parsed && parsed.name === 'FactoryOperation'
        } catch {
          return false
        }
      })

      if (!event) {
        throw new Error('Event failed')
      }

      const parsedEvent = campaignContractFactory.interface.parseLog(event)
      if (!parsedEvent) {
        throw new Error('Event failed')
      }

      const campaignAddress = parsedEvent.args[1]

      const Campaign = await ethers.getContractFactory('Campaign')
      const campaign = Campaign.attach(campaignAddress) as unknown as Campaign

      await network.provider.send('evm_increaseTime', [
        60 * 60 * 24 * (CAMPAIGN_DURATION + GRACE_PERIOD + 1)
      ]) // 30 days

      await network.provider.send('evm_mine')

      const [isOver, timeRemaining] = await platformAdmin.isGracePeriodOver(
        campaignAddress
      )

      expect(isOver).to.be.true
      expect(timeRemaining).to.equal(0)
    })
  })
})
