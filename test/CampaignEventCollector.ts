import { ethers } from 'hardhat'
import { expect } from 'chai'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { deployPlatformFixture } from './fixture'

describe('CampaignEventCollector', function () {
  // Constants for operation types
  const OP_FACTORY_AUTHORIZED = 1
  const OP_FACTORY_DEAUTHORIZED = 2
  const OP_CAMPAIGN_AUTHORIZED = 3
  const OP_CAMPAIGN_DEAUTHORIZED = 4

  // Constants for error codes
  const ERR_ZERO_ADDRESS = 1
  const ERR_FACTORY_NOT_AUTHORIZED = 2
  const ERR_FACTORY_DOES_NOT_EXIST = 3
  const ERR_CAMPAIGN_NOT_AUTHORIZED = 4
  const ERR_CAMPAIGN_DOES_NOT_EXIST = 5

  // Mock campaign event parameters
  const CAMPAIGN_ID = ethers.keccak256(ethers.toUtf8Bytes('CAMPAIGN_1'))
  const CONTRIBUTION_AMOUNT = ethers.parseEther('1.0')
  const OP_DEPOSIT = 1
  const STATUS_ACTIVE = 1
  const STATUS_COMPLETE = 2
  const REASON_GOAL_REACHED = 1

  describe('Deployment', function () {
    it('Should set the correct owner', async function () {
      const { campaignEventCollector, deployer } = await loadFixture(
        deployPlatformFixture
      )
      expect(await campaignEventCollector.owner()).to.equal(deployer.address)
    })

    it('Should correctly reference the platform admin contract', async function () {
      const { campaignEventCollector, platformAdmin } = await loadFixture(
        deployPlatformFixture
      )
      expect(await campaignEventCollector.platformAdmin()).to.equal(
        await platformAdmin.getAddress()
      )
    })
  })

  describe('Factory Authorization', function () {
    it('Should allow platform admins to authorize factories', async function () {
      const { campaignEventCollector, deployer, creator1 } = await loadFixture(
        deployPlatformFixture
      )

      // Use creator1 as a mock factory for testing
      await expect(
        campaignEventCollector
          .connect(deployer)
          .authorizeFactory(creator1.address)
      )
        .to.emit(campaignEventCollector, 'CampaignEventCollectorOperation')
        .withArgs(OP_FACTORY_AUTHORIZED, deployer.address, creator1.address)

      expect(await campaignEventCollector.authorizedFactories(creator1.address))
        .to.be.true
    })

    it('Should revert when trying to authorize a zero address factory', async function () {
      const { campaignEventCollector, creator1 } = await loadFixture(
        deployPlatformFixture
      )

      await expect(
        campaignEventCollector
          .connect(creator1)
          .authorizeFactory(ethers.ZeroAddress)
      )
        .to.be.revertedWithCustomError(
          campaignEventCollector,
          'NotAuthorizedAdmin'
        )
        .withArgs(creator1.address)
    })

    it('Should revert when a non-admin tries to authorize a factory', async function () {
      const { campaignEventCollector, creator1, contributor1 } =
        await loadFixture(deployPlatformFixture)

      await expect(
        campaignEventCollector
          .connect(contributor1)
          .authorizeFactory(creator1.address)
      )
        .to.be.revertedWithCustomError(
          campaignEventCollector,
          'NotAuthorizedAdmin'
        )
        .withArgs(contributor1.address)
    })

    it('Should allow platform admins to deauthorize factories', async function () {
      const { campaignEventCollector, deployer, creator1 } = await loadFixture(
        deployPlatformFixture
      )

      // First authorize
      await campaignEventCollector
        .connect(deployer)
        .authorizeFactory(creator1.address)

      // Then deauthorize
      await expect(
        campaignEventCollector
          .connect(deployer)
          .deauthorizeFactory(creator1.address)
      )
        .to.emit(campaignEventCollector, 'CampaignEventCollectorOperation')
        .withArgs(OP_FACTORY_DEAUTHORIZED, deployer.address, creator1.address)

      expect(await campaignEventCollector.authorizedFactories(creator1.address))
        .to.be.false
    })

    it('Should revert when trying to deauthorize a non-existent factory', async function () {
      const { campaignEventCollector, deployer, creator1 } = await loadFixture(
        deployPlatformFixture
      )

      await expect(
        campaignEventCollector
          .connect(deployer)
          .deauthorizeFactory(creator1.address)
      )
        .to.be.revertedWithCustomError(
          campaignEventCollector,
          'CampaignEventCollectorError'
        )
        .withArgs(ERR_FACTORY_DOES_NOT_EXIST, creator1.address)
    })
  })

  describe('Campaign Authorization', function () {
    it('Should allow authorized factories to authorize campaigns', async function () {
      const { campaignEventCollector, deployer, creator1, creator2 } =
        await loadFixture(deployPlatformFixture)

      // Authorize factory (creator1)
      await campaignEventCollector
        .connect(deployer)
        .authorizeFactory(creator1.address)

      // Factory authorizes campaign (creator2 address as mock campaign)
      await expect(
        campaignEventCollector
          .connect(creator1)
          .authorizeCampaignFromFactory(creator2.address)
      )
        .to.emit(campaignEventCollector, 'CampaignEventCollectorOperation')
        .withArgs(OP_CAMPAIGN_AUTHORIZED, creator2.address, creator1.address)

      expect(await campaignEventCollector.authorizedCampaigns(creator2.address))
        .to.be.true
    })

    it('Should revert when an unauthorized factory tries to authorize a campaign', async function () {
      const { campaignEventCollector, creator1, creator2 } = await loadFixture(
        deployPlatformFixture
      )

      await expect(
        campaignEventCollector
          .connect(creator1)
          .authorizeCampaignFromFactory(creator2.address)
      )
        .to.be.revertedWithCustomError(
          campaignEventCollector,
          'CampaignEventCollectorError'
        )
        .withArgs(ERR_FACTORY_NOT_AUTHORIZED, creator1.address)
    })

    it('Should revert when trying to authorize a zero address campaign', async function () {
      const { campaignEventCollector, deployer, creator1 } = await loadFixture(
        deployPlatformFixture
      )

      // Authorize factory
      await campaignEventCollector
        .connect(deployer)
        .authorizeFactory(creator1.address)

      await expect(
        campaignEventCollector
          .connect(creator1)
          .authorizeCampaignFromFactory(ethers.ZeroAddress)
      )
        .to.be.revertedWithCustomError(
          campaignEventCollector,
          'CampaignEventCollectorError'
        )
        .withArgs(ERR_ZERO_ADDRESS, ethers.ZeroAddress)
    })

    it('Should allow platform admins to deauthorize campaigns', async function () {
      const { campaignEventCollector, deployer, creator1, creator2 } =
        await loadFixture(deployPlatformFixture)

      // Authorize factory and campaign
      await campaignEventCollector
        .connect(deployer)
        .authorizeFactory(creator1.address)
      await campaignEventCollector
        .connect(creator1)
        .authorizeCampaignFromFactory(creator2.address)

      // Deauthorize campaign
      await expect(
        campaignEventCollector
          .connect(deployer)
          .deauthorizeCampaign(creator2.address)
      )
        .to.emit(campaignEventCollector, 'CampaignEventCollectorOperation')
        .withArgs(OP_CAMPAIGN_DEAUTHORIZED, creator2.address, deployer.address)

      expect(await campaignEventCollector.authorizedCampaigns(creator2.address))
        .to.be.false
    })

    it('Should revert when trying to deauthorize a non-existent campaign', async function () {
      const { campaignEventCollector, deployer, creator2 } = await loadFixture(
        deployPlatformFixture
      )

      await expect(
        campaignEventCollector
          .connect(deployer)
          .deauthorizeCampaign(creator2.address)
      )
        .to.be.revertedWithCustomError(
          campaignEventCollector,
          'CampaignEventCollectorError'
        )
        .withArgs(ERR_CAMPAIGN_DOES_NOT_EXIST, creator2.address)
    })
  })

  describe('Event Emission', function () {
    it('Should allow authorized campaigns to emit events', async function () {
      const {
        campaignEventCollector,
        deployer,
        creator1,
        creator2,
        contributor1
      } = await loadFixture(deployPlatformFixture)

      // Authorize factory and campaign
      await campaignEventCollector
        .connect(deployer)
        .authorizeFactory(creator1.address)
      await campaignEventCollector
        .connect(creator1)
        .authorizeCampaignFromFactory(creator2.address)

      // Test Contribution event
      await expect(
        campaignEventCollector
          .connect(creator2)
          .emitContribution(
            contributor1.address,
            CONTRIBUTION_AMOUNT,
            CAMPAIGN_ID
          )
      )
        .to.emit(campaignEventCollector, 'Contribution')
        .withArgs(
          contributor1.address,
          CONTRIBUTION_AMOUNT,
          CAMPAIGN_ID,
          creator2.address
        )

      // Test FundsOperation event
      const tokenAddress = ethers.Wallet.createRandom().address
      await expect(
        campaignEventCollector
          .connect(creator2)
          .emitFundsOperation(
            tokenAddress,
            CONTRIBUTION_AMOUNT,
            OP_DEPOSIT,
            contributor1.address,
            CAMPAIGN_ID
          )
      )
        .to.emit(campaignEventCollector, 'FundsOperation')
        .withArgs(
          tokenAddress,
          CONTRIBUTION_AMOUNT,
          OP_DEPOSIT,
          contributor1.address,
          CAMPAIGN_ID,
          creator2.address
        )

      // Test CampaignStatusChanged event
      await expect(
        campaignEventCollector
          .connect(creator2)
          .emitCampaignStatusChanged(
            STATUS_ACTIVE,
            STATUS_COMPLETE,
            REASON_GOAL_REACHED,
            CAMPAIGN_ID
          )
      )
        .to.emit(campaignEventCollector, 'CampaignStatusChanged')
        .withArgs(
          STATUS_ACTIVE,
          STATUS_COMPLETE,
          REASON_GOAL_REACHED,
          CAMPAIGN_ID,
          creator2.address
        )

      // Test AdminOverrideSet event
      await expect(
        campaignEventCollector
          .connect(creator2)
          .emitAdminOverrideSet(true, deployer.address, CAMPAIGN_ID)
      )
        .to.emit(campaignEventCollector, 'AdminOverrideSet')
        .withArgs(true, deployer.address, CAMPAIGN_ID, creator2.address)

      // Test FundsClaimed event
      await expect(
        campaignEventCollector
          .connect(creator2)
          .emitFundsClaimed(
            contributor1.address,
            CONTRIBUTION_AMOUNT,
            CAMPAIGN_ID
          )
      )
        .to.emit(campaignEventCollector, 'FundsClaimed')
        .withArgs(
          contributor1.address,
          CONTRIBUTION_AMOUNT,
          CAMPAIGN_ID,
          creator2.address
        )

      // Test RefundIssued event
      await expect(
        campaignEventCollector
          .connect(creator2)
          .emitRefundIssued(
            contributor1.address,
            CONTRIBUTION_AMOUNT,
            CAMPAIGN_ID
          )
      )
        .to.emit(campaignEventCollector, 'RefundIssued')
        .withArgs(
          contributor1.address,
          CONTRIBUTION_AMOUNT,
          CAMPAIGN_ID,
          creator2.address
        )
    })

    it('Should revert when unauthorized campaigns try to emit events', async function () {
      const { campaignEventCollector, creator2, contributor1 } =
        await loadFixture(deployPlatformFixture)

      await expect(
        campaignEventCollector
          .connect(creator2)
          .emitContribution(
            contributor1.address,
            CONTRIBUTION_AMOUNT,
            CAMPAIGN_ID
          )
      )
        .to.be.revertedWithCustomError(
          campaignEventCollector,
          'CampaignEventCollectorError'
        )
        .withArgs(ERR_CAMPAIGN_NOT_AUTHORIZED, creator2.address)
    })
  })
})
