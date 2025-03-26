import { token } from '../typechain-types/@openzeppelin/contracts'

const { expect } = require('chai')
const { ethers } = require('hardhat')
import { Log } from 'ethers'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { deployPlatformFixture } from './fixture'

import { Campaign } from '../typechain-types'

describe('CampaignContractFactory', function () {
  const OP_CAMPAIGN_CREATED = 1
  const ERR_INVALID_ADDRESS = 1
  const ERR_TOKEN_NOT_SUPPORTED = 2
  const ERR_INVALID_GOAL = 3
  const ERR_INVALID_DURATION = 4
  const ERR_VALIDATION_FAILED = 5

  describe('Deployment', function () {
    it('Should correctly deploy campaignContractFactory', async function () {
      const { campaignContractFactory } = await loadFixture(
        deployPlatformFixture
      )

      expect(await campaignContractFactory.getAddress()).to.be.properAddress
    })

    it('Should correctly set the initial state', async function () {
      const { campaignContractFactory, defiIntegrationManager, platformAdmin } =
        await loadFixture(deployPlatformFixture)

      const defiManagerAddress = await defiIntegrationManager.getAddress()
      const platformAdminAddress = await platformAdmin.getAddress()

      expect(await campaignContractFactory.defiManager()).to.equal(
        defiManagerAddress
      )
      expect(await campaignContractFactory.platformAdmin()).to.equal(
        platformAdminAddress
      )
    })

    it('Should revert if an invalid defiManager address is passed to the constructor', async function () {
      const { platformAdmin, deployer } = await loadFixture(
        deployPlatformFixture
      )

      await expect(
        ethers.deployContract('CampaignContractFactory', [
          ethers.ZeroAddress,
          await platformAdmin.getAddress(),
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
      const { defiIntegrationManager, deployer } = await loadFixture(
        deployPlatformFixture
      )

      await expect(
        ethers.deployContract('CampaignContractFactory', [
          await defiIntegrationManager.getAddress(),
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
      const { campaignContractFactory, creator1, usdc, tokenRegistry } =
        await loadFixture(deployPlatformFixture)

      const usdcAddress = await usdc.getAddress()
      const campaignGoalAmount = ethers.parseUnits('500', await usdc.decimals()) // Use proper units
      const campaignDuration = 30

      const initialCampaignsCount =
        await campaignContractFactory.getCampaignsCount()

      expect(initialCampaignsCount).to.equal(1)

      const initialCreatorCampaignsCount =
        await campaignContractFactory.getCreatorCampaignsCount(creator1.address)

      expect(initialCreatorCampaignsCount).to.equal(1)

      const initialCampaigns = await campaignContractFactory.getAllCampaigns()

      expect(initialCampaigns).to.have.lengthOf(1)

      const initialCreatorCampaigns =
        await campaignContractFactory.getCampaignsByCreator(creator1.address)

      expect(initialCreatorCampaigns).to.have.lengthOf(1)

      expect(await tokenRegistry.isTokenSupported(usdcAddress)).to.be.true

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

      expect(parsedEvent.args[2]).to.equal(creator1.address)
      expect(await campaignContractFactory.deployedCampaigns(1)).to.equal(
        ethers.getAddress(campaignAddress)
      )
      expect(
        await campaignContractFactory.creatorToCampaigns(creator1.address, 1)
      ).to.equal(ethers.getAddress(campaignAddress))

      const Campaign = await ethers.getContractFactory('Campaign')
      const campaign = Campaign.attach(campaignAddress) as unknown as Campaign

      const newCampaignsCount =
        await campaignContractFactory.getCampaignsCount()
      const newCreatorCampaignsCount =
        await campaignContractFactory.getCreatorCampaignsCount(creator1.address)

      expect(newCampaignsCount).to.equal(initialCampaignsCount + 1n)
      expect(newCreatorCampaignsCount).to.equal(
        initialCreatorCampaignsCount + 1n
      )

      const lastDeployedCampaign =
        await campaignContractFactory.deployedCampaigns(1)
      expect(lastDeployedCampaign).to.equal(ethers.getAddress(campaignAddress))

      const creatorCampaign = await campaignContractFactory.creatorToCampaigns(
        creator1.address,
        1
      )
      expect(creatorCampaign).to.equal(ethers.getAddress(campaignAddress))

      // Check campaign properties
      expect(await campaign.owner()).to.equal(creator1.address) // Check creator is owner
      expect(await campaign.campaignToken()).to.equal(
        ethers.getAddress(usdcAddress)
      )
      expect(await campaign.campaignGoalAmount()).to.equal(campaignGoalAmount)
      expect(await campaign.campaignDuration()).to.equal(campaignDuration)
      expect(await campaign.isCampaignActive()).to.be.true
    })

    it('Should correctly manage multiple campaigns from the same creator', async function () {
      const { campaignContractFactory, deployer, creator1, usdc, campaign } =
        await loadFixture(deployPlatformFixture)

      const usdcAddress = await usdc.getAddress()

      // Initial state check - one campaign already exists for creator1
      expect(await campaignContractFactory.getCampaignsCount()).to.equal(1n)
      expect(
        await campaignContractFactory.getCreatorCampaignsCount(deployer.address)
      ).to.equal(0n)
      expect(
        await campaignContractFactory.getCreatorCampaignsCount(creator1.address)
      ).to.equal(1n)

      // First campaign by deployer
      const campaignGoal1 = ethers.parseUnits('5', await usdc.decimals())
      const campaignDuration1 = 10
      const tx1 = await campaignContractFactory.deploy(
        usdcAddress,
        campaignGoal1,
        campaignDuration1
      )
      const receipt1 = await tx1.wait()
      if (!receipt1) {
        throw new Error('Transaction failed to return a receipt')
      }

      // Second campaign by deployer
      const campaignGoal2 = ethers.parseUnits('10', await usdc.decimals())
      const tx2 = await campaignContractFactory.deploy(
        usdcAddress,
        campaignGoal2,
        15
      )
      const receipt2 = await tx2.wait()
      if (!receipt2) {
        throw new Error('Transaction failed to return a receipt')
      }

      // Check campaign counts - should now be 3 total (1 from fixture + 2 new ones)
      expect(await campaignContractFactory.getCampaignsCount()).to.equal(3n)
      expect(
        await campaignContractFactory.getCreatorCampaignsCount(deployer.address)
      ).to.equal(2n)
      expect(
        await campaignContractFactory.getCreatorCampaignsCount(creator1.address)
      ).to.equal(1n)

      const allCampaigns = await campaignContractFactory.getAllCampaigns()
      const deployerCampaigns =
        await campaignContractFactory.getCampaignsByCreator(deployer.address)

      expect(allCampaigns).to.have.lengthOf(3) // 3 total campaigns
      expect(deployerCampaigns).to.have.lengthOf(2) // 2 campaigns for deployer

      // The original campaign from the fixture should be at index 0
      expect(await campaignContractFactory.deployedCampaigns(0)).to.equal(
        await campaign.getAddress()
      )

      // Check the deployedCampaigns mapping for the two new campaigns
      // They should be at indices 1 and 2 (since the fixture campaign is at index 0)
      expect(await campaignContractFactory.deployedCampaigns(1)).to.equal(
        allCampaigns[1]
      )
      expect(await campaignContractFactory.deployedCampaigns(2)).to.equal(
        allCampaigns[2]
      )

      // Check creatorToCampaigns mapping for deployer
      expect(
        await campaignContractFactory.creatorToCampaigns(deployer.address, 0)
      ).to.equal(deployerCampaigns[0])
      expect(
        await campaignContractFactory.creatorToCampaigns(deployer.address, 1)
      ).to.equal(deployerCampaigns[1])

      // Make sure the original fixture campaign is still mapped correctly
      expect(
        await campaignContractFactory.creatorToCampaigns(creator1.address, 0)
      ).to.equal(await campaign.getAddress())
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
        .withArgs(ERR_TOKEN_NOT_SUPPORTED, ethers.getAddress(usdcAddress), 0)
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
        .withArgs(ERR_INVALID_ADDRESS, ethers.ZeroAddress, 0)
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
        .withArgs(ERR_INVALID_GOAL, ethers.ZeroAddress, campaignGoalAmount)
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
        .withArgs(ERR_INVALID_DURATION, ethers.ZeroAddress, campaignDuration)
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
        .withArgs(ERR_INVALID_DURATION, ethers.ZeroAddress, campaignDuration)
    })

    it('Should correctly manage campaigns from different creators', async function () {
      const { campaignContractFactory, deployer, creator1, usdc, campaign } =
        await loadFixture(deployPlatformFixture)

      const usdcAddress = await usdc.getAddress()

      // Initial state check - creator1 should have one campaign already from the fixture
      expect(await campaignContractFactory.getCampaignsCount()).to.equal(1n)
      expect(
        await campaignContractFactory.getCreatorCampaignsCount(deployer.address)
      ).to.equal(0n)
      expect(
        await campaignContractFactory.getCreatorCampaignsCount(creator1.address)
      ).to.equal(1n)

      // Deploy a campaign as the deployer
      const tx1 = await campaignContractFactory.deploy(
        usdcAddress,
        ethers.parseUnits('5', await usdc.decimals()),
        10
      )
      const receipt1 = await tx1.wait()

      // Deploy a second campaign as creator1
      const tx2 = await campaignContractFactory
        .connect(creator1)
        .deploy(usdcAddress, ethers.parseUnits('5', await usdc.decimals()), 15)
      const receipt2 = await tx2.wait()

      // Now there should be a total of 3 campaigns
      expect(await campaignContractFactory.getCampaignsCount()).to.equal(3n)

      // Deployer should have 1 campaign
      expect(
        await campaignContractFactory.getCreatorCampaignsCount(deployer.address)
      ).to.equal(1n)

      // Creator1 should now have 2 campaigns
      expect(
        await campaignContractFactory.getCreatorCampaignsCount(creator1.address)
      ).to.equal(2n)

      const ownerCampaigns =
        await campaignContractFactory.getCampaignsByCreator(deployer.address)
      const creator1Campaigns =
        await campaignContractFactory.getCampaignsByCreator(creator1.address)

      // Check campaign counts
      expect(ownerCampaigns).to.have.lengthOf(1)
      expect(creator1Campaigns).to.have.lengthOf(2)

      // Verify the campaigns have the correct owners
      const Campaign = await ethers.getContractFactory('Campaign')
      const ownerCampaign = Campaign.attach(
        ownerCampaigns[0]
      ) as unknown as Campaign

      // For creator1, we need to check both campaigns
      // The original campaign from the fixture
      expect(await campaign.owner()).to.equal(creator1.address)

      const campaignAddress = await campaign.getAddress()

      // Then use it in the find function
      const creator1SecondCampaign = Campaign.attach(
        creator1Campaigns.find(addr => addr !== campaignAddress)
      ) as unknown as Campaign

      expect(await ownerCampaign.owner()).to.equal(deployer.address)
      expect(await creator1SecondCampaign.owner()).to.equal(creator1.address)
    })
  })

  describe('Getter functions', function () {
    it('Should return correct values from getAllCampaigns', async function () {
      const { campaignContractFactory, usdc, campaign } = await loadFixture(
        deployPlatformFixture
      )

      const usdcAddress = await usdc.getAddress()

      // Check that there's already one campaign from the fixture
      const initialCampaigns = await campaignContractFactory.getAllCampaigns()
      expect(initialCampaigns).to.have.lengthOf(1)
      expect(initialCampaigns[0]).to.equal(await campaign.getAddress())

      // Deploy another campaign
      const tx = await campaignContractFactory.deploy(
        usdcAddress,
        ethers.parseUnits('5', await usdc.decimals()),
        10
      )
      const receipt = await tx.wait()
      if (!receipt) {
        throw new Error('Transaction failed to return a receipt')
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
      const newCampaignAddress = parsedEvent.args[1]

      // Now there should be two campaigns
      const campaigns = await campaignContractFactory.getAllCampaigns()
      expect(campaigns).to.have.lengthOf(2)
      expect(campaigns).to.include(await campaign.getAddress()) // Original campaign from fixture
      expect(campaigns).to.include(newCampaignAddress) // New campaign just deployed
    })

    it('Should return correct values from getCampaignsByCreator', async function () {
      const { campaignContractFactory, deployer, creator1, usdc, campaign } =
        await loadFixture(deployPlatformFixture)

      const usdcAddress = await usdc.getAddress()

      // Initial check - creator1 should already have one campaign
      const initialCreator1Campaigns =
        await campaignContractFactory.getCampaignsByCreator(creator1.address)
      expect(initialCreator1Campaigns).to.have.lengthOf(1)
      expect(initialCreator1Campaigns[0]).to.equal(await campaign.getAddress())

      // Deployer should have no campaigns yet
      expect(
        await campaignContractFactory.getCampaignsByCreator(deployer.address)
      ).to.be.an('array').that.is.empty

      // Deploy a campaign as the deployer
      const tx1 = await campaignContractFactory.deploy(
        usdcAddress,
        ethers.parseUnits('5', await usdc.decimals()),
        10
      )
      const receipt1 = await tx1.wait()

      if (!receipt1) {
        throw new Error('Transaction failed to return a receipt')
      }
      const event1 = receipt1.logs.find(log => {
        try {
          const parsed = campaignContractFactory.interface.parseLog(log)
          return parsed && parsed.name === 'FactoryOperation'
        } catch {
          return false
        }
      })
      if (!event1) {
        throw new Error('Event failed')
      }
      const parsedEvent1 = campaignContractFactory.interface.parseLog(event1)
      if (!parsedEvent1) {
        throw new Error('Event failed')
      }
      const ownerCampaignAddress = parsedEvent1.args[1]

      // Deploy a second campaign as creator1
      const tx2 = await campaignContractFactory
        .connect(creator1)
        .deploy(usdcAddress, ethers.parseUnits('5', await usdc.decimals()), 15)
      const receipt2 = await tx2.wait()
      if (!receipt2) {
        throw new Error('Transaction failed to return a receipt')
      }
      const event2 = receipt2.logs.find(log => {
        try {
          const parsed = campaignContractFactory.interface.parseLog(log)
          return parsed && parsed.name === 'FactoryOperation'
        } catch {
          return false
        }
      })
      if (!event2) {
        throw new Error('Event failed')
      }
      const parsedEvent2 = campaignContractFactory.interface.parseLog(event2)
      if (!parsedEvent2) {
        throw new Error('Event failed')
      }
      const user1SecondCampaignAddress = parsedEvent2.args[1]

      // Check deployer's campaigns
      const ownerCampaigns =
        await campaignContractFactory.getCampaignsByCreator(deployer.address)
      expect(ownerCampaigns).to.have.lengthOf(1)
      expect(ownerCampaigns[0]).to.equal(ownerCampaignAddress)

      // Check creator1's campaigns - should now have two
      const user1Campaigns =
        await campaignContractFactory.getCampaignsByCreator(creator1.address)
      expect(user1Campaigns).to.have.lengthOf(2)
      expect(user1Campaigns).to.include(await campaign.getAddress()) // Original campaign
      expect(user1Campaigns).to.include(user1SecondCampaignAddress) // Second campaign

      // Check random address still has no campaigns
      const randomAddress = ethers.Wallet.createRandom().address
      const randomCampaigns =
        await campaignContractFactory.getCampaignsByCreator(randomAddress)
      expect(randomCampaigns).to.be.an('array').that.is.empty
    })

    it('Should return correct values from getCampaignsCount', async function () {
      const { campaignContractFactory, usdc } = await loadFixture(
        deployPlatformFixture
      )

      const usdcAddress = await usdc.getAddress()

      expect(await campaignContractFactory.getCampaignsCount()).to.equal(1)

      await campaignContractFactory.deploy(
        usdcAddress,
        ethers.parseUnits('5', await usdc.decimals()),
        10
      )
      expect(await campaignContractFactory.getCampaignsCount()).to.equal(2)

      await campaignContractFactory.deploy(
        usdcAddress,
        ethers.parseUnits('5', await usdc.decimals()),
        15
      )
      expect(await campaignContractFactory.getCampaignsCount()).to.equal(3)
    })

    it('Should return correct values from getCreatorCampaignsCount', async function () {
      const { campaignContractFactory, deployer, creator1, usdc } =
        await loadFixture(deployPlatformFixture)

      const usdcAddress = await usdc.getAddress()

      expect(
        await campaignContractFactory.getCreatorCampaignsCount(deployer.address)
      ).to.equal(0)
      expect(
        await campaignContractFactory.getCreatorCampaignsCount(creator1.address)
      ).to.equal(1)

      await campaignContractFactory.deploy(
        usdcAddress,
        ethers.parseUnits('5', await usdc.decimals()),
        10
      )
      expect(
        await campaignContractFactory.getCreatorCampaignsCount(deployer.address)
      ).to.equal(1)
      expect(
        await campaignContractFactory.getCreatorCampaignsCount(creator1.address)
      ).to.equal(1)

      await campaignContractFactory
        .connect(creator1)
        .deploy(usdcAddress, ethers.parseUnits('5', await usdc.decimals()), 15)
      expect(
        await campaignContractFactory.getCreatorCampaignsCount(deployer.address)
      ).to.equal(1)
      expect(
        await campaignContractFactory.getCreatorCampaignsCount(creator1.address)
      ).to.equal(2)

      await campaignContractFactory.deploy(
        usdcAddress,
        ethers.parseUnits('5', await usdc.decimals()),
        20
      )
      expect(
        await campaignContractFactory.getCreatorCampaignsCount(deployer.address)
      ).to.equal(2)
      expect(
        await campaignContractFactory.getCreatorCampaignsCount(creator1.address)
      ).to.equal(2)

      const randomAddress = ethers.Wallet.createRandom().address
      expect(
        await campaignContractFactory.getCreatorCampaignsCount(randomAddress)
      ).to.equal(0)
    })
  })
})
