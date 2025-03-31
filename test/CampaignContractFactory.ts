import { token } from '../typechain-types/@openzeppelin/contracts'

const { expect } = require('chai')
const { ethers } = require('hardhat')
import { Log } from 'ethers'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { deployPlatformFixture } from './fixture'

import { Campaign } from '../typechain-types'

describe('CampaignContractFactory', function () {
  const OP_CAMPAIGN_CREATED = 1
  const ERR_CAMPAIGN_CONSTRUCTOR_VALIDATION_FAILED = 1
  const ERR_INVALID_ADDRESS = 2
  const STATUS_CREATED = 0
  const STATUS_ACTIVE = 1
  const REASON_CAMPAIGN_CREATED = 0

  describe('Deployment', function () {
    it('Should correctly deploy campaignContractFactory', async function () {
      const { campaignContractFactory } = await loadFixture(
        deployPlatformFixture
      )

      expect(await campaignContractFactory.getAddress()).to.be.properAddress
    })

    it('Should correctly set the initial state', async function () {
      const {
        campaignContractFactory,
        defiIntegrationManager,
        platformAdmin,
        campaignEventCollector
      } = await loadFixture(deployPlatformFixture)

      const defiManagerAddress = await defiIntegrationManager.getAddress()
      const platformAdminAddress = await platformAdmin.getAddress()
      const campaignEventCollectorAddress =
        await campaignEventCollector.getAddress()

      expect(await campaignContractFactory.defiManager()).to.equal(
        defiManagerAddress
      )
      expect(await campaignContractFactory.platformAdmin()).to.equal(
        platformAdminAddress
      )

      expect(await campaignContractFactory.campaignEventCollector()).to.equal(
        campaignEventCollectorAddress
      )
    })

    it('Should revert if an invalid defiManager address is passed to the constructor', async function () {
      const { platformAdmin, deployer, campaignEventCollector } =
        await loadFixture(deployPlatformFixture)

      await expect(
        ethers.deployContract('CampaignContractFactory', [
          ethers.ZeroAddress,
          await platformAdmin.getAddress(),
          await campaignEventCollector.getAddress(),
          deployer.address
        ])
      )
        .to.be.revertedWithCustomError(
          await ethers.getContractFactory('CampaignContractFactory'),
          'FactoryError'
        )
        .withArgs(ERR_INVALID_ADDRESS, ethers.ZeroAddress, 0)
    })

    it('Should revert if an invalid platformAdmin address is passed to the constructor', async function () {
      const { defiIntegrationManager, deployer, campaignEventCollector } =
        await loadFixture(deployPlatformFixture)

      await expect(
        ethers.deployContract('CampaignContractFactory', [
          await defiIntegrationManager.getAddress(),
          ethers.ZeroAddress,
          await campaignEventCollector.getAddress(),
          deployer.address
        ])
      )
        .to.be.revertedWithCustomError(
          await ethers.getContractFactory('CampaignContractFactory'),
          'FactoryError'
        )
        .withArgs(ERR_INVALID_ADDRESS, ethers.ZeroAddress, 0)
    })
    it('Should revert if an invalid eventCollector address is passed to the constructor', async function () {
      const { defiIntegrationManager, deployer, platformAdmin } =
        await loadFixture(deployPlatformFixture)

      await expect(
        ethers.deployContract('CampaignContractFactory', [
          await defiIntegrationManager.getAddress(),
          await platformAdmin.getAddress(),
          ethers.ZeroAddress,
          deployer.address
        ])
      )
        .to.be.revertedWithCustomError(
          await ethers.getContractFactory('CampaignContractFactory'),
          'FactoryError'
        )
        .withArgs(ERR_INVALID_ADDRESS, ethers.ZeroAddress, 0)
    })
  })

  describe('Deploying new campaigns', function () {
    it('Should allow new campaigns to be deployed with ERC20 token', async function () {
      const {
        campaignContractFactory,
        creator1,
        usdc,
        tokenRegistry,
        campaignEventCollector,
        deployer
      } = await loadFixture(deployPlatformFixture)

      const usdcAddress = await usdc.getAddress()
      const campaignGoalAmount = ethers.parseUnits('500', await usdc.decimals()) // Use proper units
      const campaignDuration = 30

      expect(await tokenRegistry.isTokenSupported(usdcAddress)).to.be.true

      // Setup event monitoring for CampaignStatusChanged
      const statusChangedFilter =
        campaignEventCollector.filters.CampaignStatusChanged()

      const tx = await campaignContractFactory
        .connect(creator1)
        .deploy(usdcAddress, campaignGoalAmount, campaignDuration)

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

      expect(parsedEvent.args[0]).to.equal(OP_CAMPAIGN_CREATED)

      const campaignAddress = parsedEvent.args[1]
      const campaignId = parsedEvent.args[3]

      // Check for CampaignStatusChanged event
      const statusChangedEvents = await campaignEventCollector.queryFilter(
        statusChangedFilter,
        receipt.blockNumber,
        receipt.blockNumber
      )

      const campaignStatusEvent = statusChangedEvents.find(
        event => event.args[3] === campaignId
      )

      expect(campaignStatusEvent).to.not.be.undefined
      expect(campaignStatusEvent.args[0]).to.equal(STATUS_CREATED) // oldStatus
      expect(campaignStatusEvent.args[1]).to.equal(STATUS_ACTIVE) // newStatus
      expect(campaignStatusEvent.args[2]).to.equal(REASON_CAMPAIGN_CREATED) // reason
      expect(campaignStatusEvent.args[4]).to.equal(campaignAddress) // campaignAddress

      const Campaign = await ethers.getContractFactory('Campaign')
      const campaign = Campaign.attach(campaignAddress) as unknown as Campaign

      // Check campaign properties
      expect(await campaign.owner()).to.equal(creator1.address) // Check creator is owner
      expect(await campaign.campaignToken()).to.equal(
        ethers.getAddress(usdcAddress)
      )
      expect(await campaign.campaignGoalAmount()).to.equal(campaignGoalAmount)
      expect(await campaign.campaignDuration()).to.equal(campaignDuration)
      expect(await campaign.isCampaignActive()).to.be.true
      expect(await campaign.campaignStatus()).to.equal(STATUS_ACTIVE)
    })

    it('Should revert on unsupported campaign token', async function () {
      const { campaignContractFactory, usdc, tokenRegistry } =
        await loadFixture(deployPlatformFixture)

      const usdcAddress = await usdc.getAddress()
      const usdcDecimals = await usdc.decimals()

      await tokenRegistry.disableTokenSupport(usdcAddress)
      const campaignGoalAmount = ethers.parseUnits('5', usdcDecimals)
      const campaignDuration = 10

      await expect(
        campaignContractFactory.deploy(
          usdcAddress,
          campaignGoalAmount,
          campaignDuration
        )
      )
        .to.be.revertedWithCustomError(campaignContractFactory, 'FactoryError')
        .withArgs(
          ERR_CAMPAIGN_CONSTRUCTOR_VALIDATION_FAILED,
          ethers.ZeroAddress,
          0
        )
    })

    it('Should revert when using zero address for token', async function () {
      const { campaignContractFactory } = await loadFixture(
        deployPlatformFixture
      )

      const campaignGoalAmount = ethers.parseUnits('5', 6)
      const campaignDuration = 10

      await expect(
        campaignContractFactory.deploy(
          ethers.ZeroAddress,
          campaignGoalAmount,
          campaignDuration
        )
      )
        .to.be.revertedWithCustomError(campaignContractFactory, 'FactoryError')
        .withArgs(
          ERR_CAMPAIGN_CONSTRUCTOR_VALIDATION_FAILED,
          ethers.ZeroAddress,
          0
        )
    })

    it('Should revert on campaignGoalAmount <= 0', async function () {
      const { campaignContractFactory, usdc } = await loadFixture(
        deployPlatformFixture
      )

      const usdcAddress = await usdc.getAddress()
      const campaignGoalAmount = ethers.parseUnits('0', await usdc.decimals())
      const campaignDuration = 10

      await expect(
        campaignContractFactory.deploy(
          usdcAddress,
          campaignGoalAmount,
          campaignDuration
        )
      )
        .to.be.revertedWithCustomError(campaignContractFactory, 'FactoryError')
        .withArgs(
          ERR_CAMPAIGN_CONSTRUCTOR_VALIDATION_FAILED,
          ethers.ZeroAddress,
          campaignGoalAmount
        )
    })

    it('Should revert on campaignDuration <= 0', async function () {
      const { campaignContractFactory, usdc } = await loadFixture(
        deployPlatformFixture
      )

      const usdcAddress = await usdc.getAddress()

      const campaignGoalAmount = ethers.parseUnits('10', await usdc.decimals())
      const campaignDuration = 0

      await expect(
        campaignContractFactory.deploy(
          usdcAddress,
          campaignGoalAmount,
          campaignDuration
        )
      )
        .to.be.revertedWithCustomError(campaignContractFactory, 'FactoryError')
        .withArgs(
          ERR_CAMPAIGN_CONSTRUCTOR_VALIDATION_FAILED,
          ethers.ZeroAddress,
          campaignDuration
        )
    })

    it('Should allow deploying a campaign with the maximum allowed duration (365 days)', async function () {
      const { campaignContractFactory, usdc } = await loadFixture(
        deployPlatformFixture
      )

      const usdcAddress = await usdc.getAddress()
      const campaignGoalAmount = ethers.parseUnits('10', await usdc.decimals())
      const campaignDuration = 365 // Maximum allowed duration

      // Deploy the campaign with max duration
      const tx = await campaignContractFactory.deploy(
        usdcAddress,
        campaignGoalAmount,
        campaignDuration
      )
      const receipt = await tx.wait()

      if (!receipt) {
        throw new Error('Transaction failed to return a receipt')
      }

      // Find the event
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

      // Get the campaign address
      const campaignAddress = parsedEvent.args[1]

      // Verify campaign was created
      const Campaign = await ethers.getContractFactory('Campaign')
      const campaign = Campaign.attach(campaignAddress) as unknown as Campaign

      // Check that the duration was correctly set
      expect(await campaign.campaignDuration()).to.equal(campaignDuration)
    })

    it('Should revert when deploying a campaign with duration > 365 days', async function () {
      const { campaignContractFactory, usdc } = await loadFixture(
        deployPlatformFixture
      )

      const usdcAddress = await usdc.getAddress()
      const campaignGoalAmount = ethers.parseUnits('10', await usdc.decimals())
      const campaignDuration = 366 // One day over maximum

      await expect(
        campaignContractFactory.deploy(
          usdcAddress,
          campaignGoalAmount,
          campaignDuration
        )
      )
        .to.be.revertedWithCustomError(campaignContractFactory, 'FactoryError')
        .withArgs(
          ERR_CAMPAIGN_CONSTRUCTOR_VALIDATION_FAILED,
          ethers.ZeroAddress,
          0
        )
    })

    it('Should maintain consistent gas costs regardless of number of campaigns deployed', async function () {
      const { campaignContractFactory, creator1, usdc } = await loadFixture(
        deployPlatformFixture
      )

      const usdcAddress = await usdc.getAddress()
      const campaignGoalAmount = ethers.parseUnits('500', await usdc.decimals())
      const campaignDuration = 30

      // Deploy first campaign and measure gas
      const tx1 = await campaignContractFactory
        .connect(creator1)
        .deploy(usdcAddress, campaignGoalAmount, campaignDuration)

      const receipt1 = await tx1.wait()
      const gasUsed1 = receipt1?.gasUsed || 0n

      // Deploy multiple campaigns to simulate a growing platform
      for (let i = 0; i < 10; i++) {
        await campaignContractFactory
          .connect(creator1)
          .deploy(usdcAddress, campaignGoalAmount, campaignDuration)
      }

      // After multiple deployments, deploy one more and measure gas
      const tx2 = await campaignContractFactory
        .connect(creator1)
        .deploy(usdcAddress, campaignGoalAmount, campaignDuration)

      const receipt2 = await tx2.wait()
      const gasUsed2 = receipt2?.gasUsed || 0n

      // The gas cost should be very similar (allow for small variations)
      // This verifies that our optimized structure doesn't have increasing costs
      expect(gasUsed2).to.be.closeTo(
        gasUsed1,
        (gasUsed1 * 2n) / 100n // Allow 2% variation
      )
    })

    it('Should authorize new campaign in the EventCollector when deployed', async function () {
      const {
        campaignContractFactory,
        creator1,
        usdc,
        campaignEventCollector
      } = await loadFixture(deployPlatformFixture)

      const usdcAddress = await usdc.getAddress()
      const campaignGoalAmount = ethers.parseUnits('500', await usdc.decimals())
      const campaignDuration = 30

      // Deploy a new campaign
      const tx = await campaignContractFactory
        .connect(creator1)
        .deploy(usdcAddress, campaignGoalAmount, campaignDuration)

      const receipt = await tx.wait()

      // Extract the campaign address from the event
      const event = receipt.logs.find(log => {
        try {
          const parsed = campaignContractFactory.interface.parseLog(log)
          return parsed && parsed.name === 'FactoryOperation'
        } catch {
          return false
        }
      })

      const parsedEvent = campaignContractFactory.interface.parseLog(event)
      const campaignAddress = parsedEvent.args[1]

      // Verify the campaign is authorized in the EventCollector
      expect(await campaignEventCollector.authorizedCampaigns(campaignAddress))
        .to.be.true
    })
  })
})
