import { expect } from 'chai'
import { ethers } from 'hardhat'

import { time } from '@nomicfoundation/hardhat-network-helpers'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'

import { ICampaign } from '../interfaces/ICampaign'

describe('Integration', function () {
  // Constants for testing
  const TOKEN_AMOUNT = ethers.parseUnits('1000', 18)
  const CAMPAIGN_GOAL = ethers.parseUnits('500', 18)
  const CAMPAIGN_DURATION = 30
  const CONTRIBUTION_AMOUNT = ethers.parseUnits('100', 18)
  const PLATFORM_YIELD_SHARE = 2000

  // Main fixture that deploys the entire platform and sets up test environment
  async function deployPlatformFixture () {
    const [
      owner,
      creator,
      contributor1,
      contributor2,
      treasury,
      randomAddress
    ] = await ethers.getSigners()

    // Deploy mock tokens
    const mockDAI = await ethers.deployContract('MockERC20', [
      'Mock DAI',
      'mDAI',
      ethers.parseUnits('1000000', 18)
    ])
    const mockUSDC = await ethers.deployContract('MockERC20', [
      'Mock USDC',
      'mUSDC',
      ethers.parseUnits('1000000', 18)
    ])
    await mockDAI.waitForDeployment()
    await mockUSDC.waitForDeployment()

    // Deploy mock AToken
    const mockDAIAToken = await ethers.deployContract('MockAToken', [
      'Aave DAI',
      'aDAI',
      await mockDAI.getAddress()
    ])
    const mockUSDCAToken = await ethers.deployContract('MockAToken', [
      'Aave USDC',
      'aUSDC',
      await mockUSDC.getAddress()
    ])
    await mockDAIAToken.waitForDeployment()
    await mockUSDCAToken.waitForDeployment()

    // // Deploy mock Aave Pool
    const mockAavePool = await ethers.deployContract('MockAavePool', [
      await mockDAIAToken.getAddress()
    ])
    await mockAavePool.waitForDeployment()

    // // Set ATokens in the mock pool
    await mockAavePool.setAToken(
      await mockDAI.getAddress(),
      await mockDAIAToken.getAddress()
    )
    await mockAavePool.setAToken(
      await mockUSDC.getAddress(),
      await mockUSDCAToken.getAddress()
    )

    // // Set liquidity rates (yield rates)
    await mockAavePool.setLiquidityRate(
      await mockDAI.getAddress(),
      ethers.parseUnits('0.05', 27)
    ) // 5% APY
    await mockAavePool.setLiquidityRate(
      await mockUSDC.getAddress(),
      ethers.parseUnits('0.04', 27)
    ) // 4% APY

    // // Deploy mock Uniswap contracts
    const mockUniswapQuoter = await ethers.deployContract('MockUniswapQuoter')
    await mockUniswapQuoter.waitForDeployment()

    const mockUniswapRouter = await ethers.deployContract('MockUniswapRouter')
    await mockUniswapRouter.waitForDeployment()

    // // Set custom swap rates
    await mockUniswapQuoter.setCustomQuoteRate(
      await mockDAI.getAddress(),
      await mockUSDC.getAddress(),
      1
    ) // 1:1 rate
    await mockUniswapRouter.setCustomSwapRate(
      await mockDAI.getAddress(),
      await mockUSDC.getAddress(),
      1
    )

    // // Deploy TokenRegistry
    const tokenRegistry = await ethers.deployContract('TokenRegistry', [
      owner.address
    ])
    await tokenRegistry.waitForDeployment()

    // // Add tokens to registry
    await tokenRegistry.addToken(await mockDAI.getAddress(), 1) // 1 token minimum contribution
    await tokenRegistry.addToken(await mockUSDC.getAddress(), 1) // 1 token minimum contribution

    // // Deploy YieldDistributor
    const yieldDistributor = await ethers.deployContract('YieldDistributor', [
      treasury.address,
      owner.address
    ])
    await yieldDistributor.waitForDeployment()

    // // Deploy a temporary CampaignFactory for DefiIntegrationManager construction
    const tempFactory = await ethers.deployContract('CampaignFactory', [
      randomAddress.address
    ])
    await tempFactory.waitForDeployment()

    // // Deploy DefiIntegrationManager
    const defiManager = await ethers.deployContract('DefiIntegrationManager', [
      await mockAavePool.getAddress(),
      await mockUniswapRouter.getAddress(),
      await mockUniswapQuoter.getAddress(),
      await tokenRegistry.getAddress(),
      await tempFactory.getAddress(), // Temporary factory
      await yieldDistributor.getAddress(),
      owner.address
    ])
    await defiManager.waitForDeployment()

    // // Deploy actual CampaignFactory with the correct DefiIntegrationManager
    const campaignFactory = await ethers.deployContract('CampaignFactory', [
      await defiManager.getAddress()
    ])
    await campaignFactory.waitForDeployment()

    // // Update factory address in DefiIntegrationManager
    await defiManager.setCampaignFactory(await campaignFactory.getAddress())

    // // Distribute tokens to test accounts
    await mockDAI.transfer(creator.address, TOKEN_AMOUNT * 10n)
    await mockDAI.transfer(contributor1.address, TOKEN_AMOUNT * 10n)
    await mockDAI.transfer(contributor2.address, TOKEN_AMOUNT * 10n)
    await mockUSDC.transfer(creator.address, TOKEN_AMOUNT * 10n)
    await mockUSDC.transfer(contributor1.address, TOKEN_AMOUNT * 10n)
    await mockUSDC.transfer(contributor2.address, TOKEN_AMOUNT * 10n)

    return {
      owner,
      creator,
      contributor1,
      contributor2,
      treasury,
      mockDAI,
      mockUSDC,
      mockDAIAToken,
      mockUSDCAToken,
      mockAavePool,
      mockUniswapRouter,
      mockUniswapQuoter,
      tokenRegistry,
      yieldDistributor,
      defiManager,
      campaignFactory
    }
  }

  describe('Campaign Lifecycle', function () {
    it('Should create a campaign through factory and verify authorization', async function () {
      const { campaignFactory, creator, mockDAI, defiManager } =
        await loadFixture(deployPlatformFixture)

      const tx = await campaignFactory
        .connect(creator)
        .deploy(await mockDAI.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

      // Add proper null checking
      const receipt = await tx.wait()
      if (!receipt) {
        throw new Error('Transaction failed')
      }

      // Now TypeScript knows receipt is not null
      const event = receipt.logs.find(log => {
        try {
          const parsed = campaignFactory.interface.parseLog(log)
          return parsed && parsed.name === 'CampaignCreated'
        } catch {
          return false
        }
      })

      // You should also check if event exists
      if (!event) {
        throw new Error('Failed to find CampaignCreated event')
      }

      const parsedEvent = campaignFactory.interface.parseLog(event)
      if (!parsedEvent) {
        throw new Error('Failed to parse event')
      }

      const campaignAddress = parsedEvent.args[0]

      // Check if the campaign is authorized in the DefiIntegrationManager
      expect(await defiManager.isCampaignAuthorized(campaignAddress)).to.be.true

      // Verify campaign was correctly added to factory records
      expect(await campaignFactory.deployedCampaigns(0)).to.equal(
        campaignAddress
      )
      expect(
        await campaignFactory.creatorToCampaigns(creator.address, 0)
      ).to.equal(campaignAddress)

      // Get the Campaign contract instance
      const Campaign = await ethers.getContractFactory('Campaign')
      const campaign = Campaign.attach(campaignAddress) as unknown as ICampaign

      // Verify campaign parameters
      expect(await campaign.owner()).to.equal(creator.address)
      expect(await campaign.campaignToken()).to.equal(
        await mockDAI.getAddress()
      )
      expect(await campaign.campaignGoalAmount()).to.equal(CAMPAIGN_GOAL)
      expect(await campaign.campaignDuration()).to.equal(CAMPAIGN_DURATION)
      expect(await campaign.isCampaignActive()).to.be.true
    })

    it('Should allow multiple contributors to fund a campaign', async function () {
      const { campaignFactory, creator, contributor1, contributor2, mockDAI } =
        await loadFixture(deployPlatformFixture)

      // Create a new campaign
      const tx = await campaignFactory
        .connect(creator)
        .deploy(await mockDAI.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

      const receipt = await tx.wait()

      if (!receipt) {
        throw new Error('Transaction failed')
      }

      const event = receipt.logs.find(log => {
        try {
          const parsed = campaignFactory.interface.parseLog(log)
          return parsed && parsed.name === 'CampaignCreated'
        } catch {
          return false
        }
      })

      if (!event) {
        throw new Error('Event Failed')
      }

      const parsedEvent = campaignFactory.interface.parseLog(event)

      if (!parsedEvent) {
        throw new Error('Event Failed')
      }

      const campaignAddress = parsedEvent.args[0]

      // Get the Campaign contract instance
      const Campaign = await ethers.getContractFactory('Campaign')
      const campaign = Campaign.attach(campaignAddress) as unknown as ICampaign

      // Contributor 1 contributes
      await mockDAI
        .connect(contributor1)
        .approve(campaignAddress, CONTRIBUTION_AMOUNT)
      await campaign.connect(contributor1).contribute(CONTRIBUTION_AMOUNT)

      // Contributor 2 contributes
      await mockDAI
        .connect(contributor2)
        .approve(campaignAddress, CONTRIBUTION_AMOUNT)
      await campaign.connect(contributor2).contribute(CONTRIBUTION_AMOUNT)

      // Verify contributions
      expect(await campaign.contributions(contributor1.address)).to.equal(
        CONTRIBUTION_AMOUNT
      )
      expect(await campaign.contributions(contributor2.address)).to.equal(
        CONTRIBUTION_AMOUNT
      )
      expect(await campaign.totalAmountRaised()).to.equal(
        CONTRIBUTION_AMOUNT * 2n
      )
      expect(await mockDAI.balanceOf(campaignAddress)).to.equal(
        CONTRIBUTION_AMOUNT * 2n
      )
    })

    it('Should handle a successful campaign with fund claiming', async function () {
      const { campaignFactory, creator, contributor1, contributor2, mockDAI } =
        await loadFixture(deployPlatformFixture)

      // Create a new campaign
      const tx = await campaignFactory
        .connect(creator)
        .deploy(await mockDAI.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

      const receipt = await tx.wait()
      if (!receipt) {
        throw new Error('Transaction failed')
      }

      const event = receipt.logs.find(log => {
        try {
          const parsed = campaignFactory.interface.parseLog(log)
          return parsed && parsed.name === 'CampaignCreated'
        } catch {
          return false
        }
      })

      if (!event) {
        throw new Error(' Event failed')
      }

      const parsedEvent = campaignFactory.interface.parseLog(event)

      if (!parsedEvent) {
        throw new Error(' parsedEvent failed')
      }

      const campaignAddress = parsedEvent.args[0]

      // Get the Campaign contract instance
      const Campaign = await ethers.getContractFactory('Campaign')
      const campaign = Campaign.attach(campaignAddress) as unknown as ICampaign

      // Contributors fund the campaign to reach goal
      const halfGoal = CAMPAIGN_GOAL / 2n

      await mockDAI.connect(contributor1).approve(campaignAddress, halfGoal)
      await campaign.connect(contributor1).contribute(halfGoal)

      await mockDAI.connect(contributor2).approve(campaignAddress, halfGoal)
      await campaign.connect(contributor2).contribute(halfGoal)

      // Verify campaign is successful
      expect(await campaign.isCampaignSuccessful()).to.be.true
      expect(await campaign.totalAmountRaised()).to.equal(CAMPAIGN_GOAL)

      // Fast forward time to after campaign end
      const campaignEndTime = await campaign.campaignEndTime()
      await time.increaseTo(campaignEndTime + 1n)

      // Verify campaign is no longer active
      expect(await campaign.isCampaignActive()).to.be.false

      // Creator claims funds
      const creatorBalanceBefore = await mockDAI.balanceOf(creator.address)
      await campaign.connect(creator).claimFunds()
      const creatorBalanceAfter = await mockDAI.balanceOf(creator.address)

      // Verify funds were claimed
      expect(await campaign.isClaimed()).to.be.true
      expect(creatorBalanceAfter - creatorBalanceBefore).to.equal(CAMPAIGN_GOAL)
      expect(await mockDAI.balanceOf(campaignAddress)).to.equal(0)
    })

    it('Should handle a failed campaign with refunds', async function () {
      const { campaignFactory, creator, contributor1, contributor2, mockDAI } =
        await loadFixture(deployPlatformFixture)

      // Create a new campaign
      const tx = await campaignFactory
        .connect(creator)
        .deploy(await mockDAI.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

      const receipt = await tx.wait()

      if (!receipt) {
        throw new Error('Reciept Failed')
      }

      const event = receipt.logs.find(log => {
        try {
          const parsed = campaignFactory.interface.parseLog(log)
          return parsed && parsed.name === 'CampaignCreated'
        } catch {
          return false
        }
      })

      if (!event) {
        throw new Error(' Event failed')
      }

      const parsedEvent = campaignFactory.interface.parseLog(event)

      if (!parsedEvent) {
        throw new Error(' parsedEvent failed')
      }

      const campaignAddress = parsedEvent.args[0]

      // Get the Campaign contract instance
      const Campaign = await ethers.getContractFactory('Campaign')
      const campaign = Campaign.attach(campaignAddress) as unknown as ICampaign

      // Contributors fund the campaign partially (not reaching goal)
      const partialAmount = CAMPAIGN_GOAL / 4n

      await mockDAI
        .connect(contributor1)
        .approve(campaignAddress, partialAmount)
      await campaign.connect(contributor1).contribute(partialAmount)

      await mockDAI
        .connect(contributor2)
        .approve(campaignAddress, partialAmount)
      await campaign.connect(contributor2).contribute(partialAmount)

      // Verify campaign is not successful
      expect(await campaign.isCampaignSuccessful()).to.be.false
      expect(await campaign.totalAmountRaised()).to.equal(partialAmount * 2n)

      // Fast forward time to after campaign end
      const campaignEndTime = await campaign.campaignEndTime()
      await time.increaseTo(campaignEndTime + 1n)

      // Verify campaign is no longer active
      expect(await campaign.isCampaignActive()).to.be.false

      // Creator should not be able to claim funds
      await expect(
        campaign.connect(creator).claimFunds()
      ).to.be.revertedWithCustomError(campaign, 'CampaignGoalNotReached')

      // Contributors request refunds
      const contributor1BalanceBefore = await mockDAI.balanceOf(
        contributor1.address
      )
      await campaign.connect(contributor1).requestRefund()
      const contributor1BalanceAfter = await mockDAI.balanceOf(
        contributor1.address
      )

      const contributor2BalanceBefore = await mockDAI.balanceOf(
        contributor2.address
      )
      await campaign.connect(contributor2).requestRefund()
      const contributor2BalanceAfter = await mockDAI.balanceOf(
        contributor2.address
      )

      // Verify refunds were issued
      expect(contributor1BalanceAfter - contributor1BalanceBefore).to.equal(
        partialAmount
      )
      expect(contributor2BalanceAfter - contributor2BalanceBefore).to.equal(
        partialAmount
      )
      expect(await mockDAI.balanceOf(campaignAddress)).to.equal(0)
      expect(await campaign.contributions(contributor1.address)).to.equal(0)
      expect(await campaign.contributions(contributor2.address)).to.equal(0)
    })
  })

  describe('Defi Integration', function () {})
})
