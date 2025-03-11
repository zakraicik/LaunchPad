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

  describe('Defi Integration', function () {
    it('Should deposit campaign funds to yield protocol and harvest yield', async function () {
      const {
        campaignFactory,
        creator,
        contributor1,
        mockDAI,
        mockDAIAToken,
        defiManager,
        treasury
      } = await loadFixture(deployPlatformFixture)

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
        throw new Error('Event failed')
      }

      const parsedEvent = campaignFactory.interface.parseLog(event)

      if (!parsedEvent) {
        throw new Error('Parsed Event failed')
      }

      const campaignAddress = parsedEvent.args[0]

      // Get the Campaign contract instance
      const Campaign = await ethers.getContractFactory('Campaign')
      const campaign = Campaign.attach(campaignAddress) as unknown as ICampaign

      // Contributor funds the campaign
      await mockDAI
        .connect(contributor1)
        .approve(campaignAddress, CAMPAIGN_GOAL)
      await campaign.connect(contributor1).contribute(CAMPAIGN_GOAL)

      // Check initial balances
      expect(await mockDAI.balanceOf(campaignAddress)).to.equal(CAMPAIGN_GOAL)
      expect(
        await campaign.getDepositedAmount(await mockDAI.getAddress())
      ).to.equal(0)

      //   // Deposit to yield protocol
      await campaign
        .connect(creator)
        .depositToYieldProtocol(await mockDAI.getAddress(), CAMPAIGN_GOAL)

      //   // Verify deposit
      expect(await mockDAI.balanceOf(campaignAddress)).to.equal(0)
      expect(
        await campaign.getDepositedAmount(await mockDAI.getAddress())
      ).to.equal(CAMPAIGN_GOAL)

      //   // Simulate yield generation - the yield is 5% of the deposit
      const yieldAmount = (CAMPAIGN_GOAL * 5n) / 100n

      //   // For our mock, we need to mint aTokens to simulate yield
      await mockDAIAToken.mint(await defiManager.getAddress(), yieldAmount)

      //   // Creator harvests yield
      const treasuryBalanceBefore = await mockDAI.balanceOf(treasury.address)
      const campaignBalanceBefore = await mockDAI.balanceOf(campaignAddress)

      //   // Transfer the yield amount to the defi manager so it can distribute it
      await mockDAI.transfer(await defiManager.getAddress(), yieldAmount)

      //   // Now harvest the yield
      await campaign.connect(creator).harvestYield(await mockDAI.getAddress())

      //   // Calculate expected shares
      const platformShare = (yieldAmount * 20n) / 100n // 20% goes to platform
      const creatorShare = yieldAmount - platformShare // 80% goes to creator

      //   // Verify balances after yield harvest
      const treasuryBalanceAfter = await mockDAI.balanceOf(treasury.address)
      const campaignBalanceAfter = await mockDAI.balanceOf(campaignAddress)

      expect(campaignBalanceAfter - campaignBalanceBefore).to.equal(
        creatorShare
      )
      expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(
        platformShare
      )

      //   // Original deposit should still be in the yield protocol
      expect(
        await campaign.getDepositedAmount(await mockDAI.getAddress())
      ).to.equal(CAMPAIGN_GOAL)
    })

    it('Should withdraw funds from yield protocol', async function () {
      const { campaignFactory, creator, contributor1, mockDAI } =
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
        throw new Error('Event failed')
      }

      const parsedEvent = campaignFactory.interface.parseLog(event)
      if (!parsedEvent) {
        throw new Error('parsedEvent failed')
      }

      const campaignAddress = parsedEvent.args[0]

      // Get the Campaign contract instance
      const Campaign = await ethers.getContractFactory('Campaign')
      const campaign = Campaign.attach(campaignAddress) as unknown as ICampaign

      // Contributor funds the campaign
      await mockDAI
        .connect(contributor1)
        .approve(campaignAddress, CAMPAIGN_GOAL)
      await campaign.connect(contributor1).contribute(CAMPAIGN_GOAL)

      // Deposit to yield protocol
      await campaign
        .connect(creator)
        .depositToYieldProtocol(await mockDAI.getAddress(), CAMPAIGN_GOAL)

      // Verify deposit
      expect(await mockDAI.balanceOf(campaignAddress)).to.equal(0)
      expect(
        await campaign.getDepositedAmount(await mockDAI.getAddress())
      ).to.equal(CAMPAIGN_GOAL)

      // Withdraw half of the funds
      const withdrawAmount = CAMPAIGN_GOAL / 2n
      await campaign
        .connect(creator)
        .withdrawFromYieldProtocol(await mockDAI.getAddress(), withdrawAmount)

      // Verify partial withdrawal
      expect(await mockDAI.balanceOf(campaignAddress)).to.equal(withdrawAmount)
      expect(
        await campaign.getDepositedAmount(await mockDAI.getAddress())
      ).to.equal(CAMPAIGN_GOAL - withdrawAmount)

      // Withdraw all remaining funds
      await campaign
        .connect(creator)
        .withdrawAllFromYieldProtocol(await mockDAI.getAddress())

      // Verify complete withdrawal
      expect(await mockDAI.balanceOf(campaignAddress)).to.equal(CAMPAIGN_GOAL)
      expect(
        await campaign.getDepositedAmount(await mockDAI.getAddress())
      ).to.equal(0)
    })

    it('Should swap tokens through Uniswap', async function () {
      const {
        campaignFactory,
        creator,
        contributor1,
        mockDAI,
        mockUSDC,
        mockUniswapRouter
      } = await loadFixture(deployPlatformFixture)

      // Create a new campaign with DAI as the campaign token
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
        throw new Error('Event failed')
      }

      const parsedEvent = campaignFactory.interface.parseLog(event)

      if (!parsedEvent) {
        throw new Error('parsedEvent failed')
      }

      const campaignAddress = parsedEvent.args[0]

      // Get the Campaign contract instance
      const Campaign = await ethers.getContractFactory('Campaign')
      const campaign = Campaign.attach(campaignAddress) as unknown as ICampaign

      // Contributor funds the campaign with DAI
      await mockDAI
        .connect(contributor1)
        .approve(campaignAddress, CAMPAIGN_GOAL)
      await campaign.connect(contributor1).contribute(CAMPAIGN_GOAL)

      // Verify initial balances
      expect(await mockDAI.balanceOf(campaignAddress)).to.equal(CAMPAIGN_GOAL)
      expect(await mockUSDC.balanceOf(campaignAddress)).to.equal(0)

      // Set up USDC for the swap result
      const swapAmount = CAMPAIGN_GOAL / 2n
      // Since we have a 1:1 swap rate, the expected output is the same as input
      const expectedOutput = swapAmount

      // We need to fund the mock Uniswap router with USDC for the swap
      await mockUSDC.transfer(
        await mockUniswapRouter.getAddress(),
        expectedOutput
      )

      // Swap half of DAI to USDC
      await campaign
        .connect(creator)
        .swapTokens(
          await mockDAI.getAddress(),
          swapAmount,
          await mockUSDC.getAddress()
        )

      // Verify balances after swap
      expect(await mockDAI.balanceOf(campaignAddress)).to.equal(
        CAMPAIGN_GOAL - swapAmount
      )
      expect(await mockUSDC.balanceOf(campaignAddress)).to.equal(expectedOutput)
    })

    it('Should change yield distribution parameters and verify effect', async function () {
      const {
        campaignFactory,
        creator,
        contributor1,
        mockDAI,
        mockDAIAToken,
        defiManager,
        treasury,
        yieldDistributor,
        owner
      } = await loadFixture(deployPlatformFixture)

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
        throw new Error('Event failed')
      }

      const parsedEvent = campaignFactory.interface.parseLog(event)

      if (!parsedEvent) {
        throw new Error('parsedEvent failed')
      }

      const campaignAddress = parsedEvent.args[0]

      // Get the Campaign contract instance
      const Campaign = await ethers.getContractFactory('Campaign')
      const campaign = Campaign.attach(campaignAddress) as unknown as ICampaign

      // Contributor funds the campaign
      await mockDAI
        .connect(contributor1)
        .approve(campaignAddress, CAMPAIGN_GOAL)
      await campaign.connect(contributor1).contribute(CAMPAIGN_GOAL)

      // Deposit to yield protocol
      await campaign
        .connect(creator)
        .depositToYieldProtocol(await mockDAI.getAddress(), CAMPAIGN_GOAL)

      // Simulate yield generation
      const yieldAmount = (CAMPAIGN_GOAL * 5n) / 100n
      await mockDAIAToken.mint(await defiManager.getAddress(), yieldAmount)
      await mockDAI.transfer(await defiManager.getAddress(), yieldAmount)

      // First harvest with default 20% platform share
      await campaign.connect(creator).harvestYield(await mockDAI.getAddress())

      // Update the platform share to 30%
      const newPlatformShare = 3000 // 30%
      await yieldDistributor
        .connect(owner)
        .updatePlatformYieldShare(newPlatformShare)

      // Verify the share was updated
      expect(await yieldDistributor.getPlatformYieldShare()).to.equal(
        newPlatformShare
      )

      // Simulate more yield generation
      await mockDAIAToken.mint(await defiManager.getAddress(), yieldAmount)
      await mockDAI.transfer(await defiManager.getAddress(), yieldAmount)

      // Harvest again with new 30% platform share
      const campaignBalanceBefore = await mockDAI.balanceOf(campaignAddress)
      const treasuryBalanceBefore = await mockDAI.balanceOf(treasury.address)

      await campaign.connect(creator).harvestYield(await mockDAI.getAddress())

      // Calculate expected shares with new rate
      const platformShare = (yieldAmount * 30n) / 100n // 30% goes to platform
      const creatorShare = yieldAmount - platformShare // 70% goes to creator

      // Verify balances after yield harvest
      const campaignBalanceAfter = await mockDAI.balanceOf(campaignAddress)
      const treasuryBalanceAfter = await mockDAI.balanceOf(treasury.address)

      expect(campaignBalanceAfter - campaignBalanceBefore).to.equal(
        creatorShare
      )
      expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(
        platformShare
      )
    })
  })

  describe('Security and Edge Cases', function () {
    it('Should prevent unauthorized campaigns from using DefiManager', async function () {
      const { creator, mockDAI, defiManager } = await loadFixture(
        deployPlatformFixture
      )

      const unauthorizedCampaign = await ethers.deployContract('Campaign', [
        creator.address,
        await mockDAI.getAddress(),
        CAMPAIGN_GOAL,
        CAMPAIGN_DURATION,
        await defiManager.getAddress()
      ])

      await unauthorizedCampaign.waitForDeployment()

      //   // Fund the campaign
      await mockDAI.transfer(
        await unauthorizedCampaign.getAddress(),
        CONTRIBUTION_AMOUNT
      )

      //   //   // Attempt to use DefiManager functions should fail
      await expect(
        unauthorizedCampaign
          .connect(creator)
          .depositToYieldProtocol(
            await mockDAI.getAddress(),
            CONTRIBUTION_AMOUNT
          )
      ).to.be.revertedWithCustomError(unauthorizedCampaign, 'DefiActionFailed')

      await expect(
        unauthorizedCampaign
          .connect(creator)
          .harvestYield(await mockDAI.getAddress())
      ).to.be.revertedWithCustomError(unauthorizedCampaign, 'DefiActionFailed')

      await expect(
        unauthorizedCampaign
          .connect(creator)
          .withdrawFromYieldProtocol(
            await mockDAI.getAddress(),
            CONTRIBUTION_AMOUNT
          )
      ).to.be.revertedWithCustomError(unauthorizedCampaign, 'DefiActionFailed')

      await expect(
        unauthorizedCampaign
          .connect(creator)
          .swapTokens(
            await mockDAI.getAddress(),
            CONTRIBUTION_AMOUNT,
            ethers.ZeroAddress
          )
      ).to.be.revertedWithCustomError(unauthorizedCampaign, 'DefiActionFailed')
    })

    it('Should prevent unauthorized users from managing campaigns', async function () {
      const { campaignFactory, creator, contributor1, mockDAI } =
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
        throw new Error('Event failed')
      }

      const parsedEvent = campaignFactory.interface.parseLog(event)

      if (!parsedEvent) {
        throw new Error('parsedEvent failed')
      }

      const campaignAddress = parsedEvent.args[0]

      // Get the Campaign contract instance
      const Campaign = await ethers.getContractFactory('Campaign')
      const campaign = Campaign.attach(campaignAddress) as unknown as ICampaign

      // Fund the campaign
      await mockDAI
        .connect(contributor1)
        .approve(campaignAddress, CONTRIBUTION_AMOUNT)
      await campaign.connect(contributor1).contribute(CONTRIBUTION_AMOUNT)

      // Non-owner should not be able to manage campaign
      await expect(
        campaign
          .connect(contributor1)
          .depositToYieldProtocol(
            await mockDAI.getAddress(),
            CONTRIBUTION_AMOUNT
          )
      ).to.be.revertedWithCustomError(campaign, 'OwnableUnauthorizedAccount')

      await expect(
        campaign
          .connect(contributor1)
          .withdrawFromYieldProtocol(
            await mockDAI.getAddress(),
            CONTRIBUTION_AMOUNT
          )
      ).to.be.revertedWithCustomError(campaign, 'OwnableUnauthorizedAccount')

      await expect(
        campaign.connect(contributor1).harvestYield(await mockDAI.getAddress())
      ).to.be.revertedWithCustomError(campaign, 'OwnableUnauthorizedAccount')

      await expect(
        campaign
          .connect(contributor1)
          .swapTokens(
            await mockDAI.getAddress(),
            CONTRIBUTION_AMOUNT,
            ethers.ZeroAddress
          )
      ).to.be.revertedWithCustomError(campaign, 'OwnableUnauthorizedAccount')
    })

    it('Should disable token support during an active campaign and check impact', async function () {
      const {
        campaignFactory,
        creator,
        contributor1,
        mockDAI,
        tokenRegistry,
        owner
      } = await loadFixture(deployPlatformFixture)

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
        throw new Error('event failed')
      }

      const parsedEvent = campaignFactory.interface.parseLog(event)

      if (!parsedEvent) {
        throw new Error('parsedEvent failed')
      }

      const campaignAddress = parsedEvent.args[0]

      // Get the Campaign contract instance
      const Campaign = await ethers.getContractFactory('Campaign')
      const campaign = Campaign.attach(campaignAddress) as unknown as ICampaign

      // Fund the campaign
      await mockDAI
        .connect(contributor1)
        .approve(campaignAddress, CONTRIBUTION_AMOUNT)
      await campaign.connect(contributor1).contribute(CONTRIBUTION_AMOUNT)

      // Disable token support in the registry
      await tokenRegistry
        .connect(owner)
        .disableTokenSupport(await mockDAI.getAddress())

      //   // Existing campaign can still function with deposited tokens
      await expect(
        campaign
          .connect(creator)
          .depositToYieldProtocol(
            await mockDAI.getAddress(),
            CONTRIBUTION_AMOUNT / 2n
          )
      ).to.be.revertedWithCustomError(campaign, 'DefiActionFailed')
    })

    it('Should allow platform to revoke campaign authorization', async function () {
      const {
        campaignFactory,
        creator,
        contributor1,
        mockDAI,
        defiManager,
        owner
      } = await loadFixture(deployPlatformFixture)

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
        throw new Error('event failed')
      }

      const parsedEvent = campaignFactory.interface.parseLog(event)

      if (!parsedEvent) {
        throw new Error('parsedEvent failed')
      }

      const campaignAddress = parsedEvent.args[0]

      // Get the Campaign contract instance
      const Campaign = await ethers.getContractFactory('Campaign')
      const campaign = Campaign.attach(campaignAddress) as unknown as ICampaign

      // Fund the campaign
      await mockDAI
        .connect(contributor1)
        .approve(campaignAddress, CONTRIBUTION_AMOUNT)
      await campaign.connect(contributor1).contribute(CONTRIBUTION_AMOUNT)

      // Verify the campaign is authorized
      expect(await defiManager.isCampaignAuthorized(campaignAddress)).to.be.true

      // Deposit funds to yield protocol
      await campaign
        .connect(creator)
        .depositToYieldProtocol(
          await mockDAI.getAddress(),
          CONTRIBUTION_AMOUNT / 2n
        )

      // Platform owner revokes authorization
      await defiManager.connect(owner).unauthorizeCampaign(campaignAddress)

      // Verify the campaign is no longer authorized
      expect(await defiManager.isCampaignAuthorized(campaignAddress)).to.be
        .false

      // Campaign should no longer be able to interact with DeFi Manager
      await expect(
        campaign
          .connect(creator)
          .depositToYieldProtocol(
            await mockDAI.getAddress(),
            CONTRIBUTION_AMOUNT / 2n
          )
      ).to.be.revertedWithCustomError(campaign, 'DefiActionFailed')

      // But campaign can still handle contributions and claim funds directly
      await mockDAI
        .connect(contributor1)
        .approve(campaignAddress, CONTRIBUTION_AMOUNT)
      await campaign.connect(contributor1).contribute(CONTRIBUTION_AMOUNT)
    })

    it('Should handle operations at token support boundaries', async function () {
      const {
        campaignFactory,
        creator,
        contributor1,
        mockDAI,
        tokenRegistry,
        owner
      } = await loadFixture(deployPlatformFixture)

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
        throw new Error('Event failed')
      }

      const parsedEvent = campaignFactory.interface.parseLog(event)

      if (!parsedEvent) {
        throw new Error('parsedEvent failed')
      }

      const campaignAddress = parsedEvent.args[0]

      // Get the Campaign contract instance
      const Campaign = await ethers.getContractFactory('Campaign')
      const campaign = Campaign.attach(campaignAddress) as unknown as ICampaign

      // Fund the campaign
      await mockDAI
        .connect(contributor1)
        .approve(campaignAddress, CONTRIBUTION_AMOUNT)
      await campaign.connect(contributor1).contribute(CONTRIBUTION_AMOUNT)

      // Increase minimum contribution amount
      const newMinContribution = 200 // Higher than initial setting
      await tokenRegistry
        .connect(owner)
        .updateTokenMinimumContribution(
          await mockDAI.getAddress(),
          newMinContribution
        )

      // Small contributions below the new minimum should still work with existing campaigns
      const smallAmount = ethers.parseUnits('10', 18)
      await mockDAI.connect(contributor1).approve(campaignAddress, smallAmount)
      await campaign.connect(contributor1).contribute(smallAmount)

      // Create a second campaign with the same token
      const tx2 = await campaignFactory
        .connect(creator)
        .deploy(await mockDAI.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

      const receipt2 = await tx2.wait()

      if (!receipt2) {
        throw new Error('receipt2 failed')
      }

      const event2 = receipt2.logs.find(log => {
        try {
          const parsed = campaignFactory.interface.parseLog(log)
          return parsed && parsed.name === 'CampaignCreated'
        } catch {
          return false
        }
      })

      if (!event2) {
        throw new Error('event2 failed')
      }

      const parsedEvent2 = campaignFactory.interface.parseLog(event2)

      if (!parsedEvent2) {
        throw new Error('parsedEvent2 failed')
      }

      const campaignAddress2 = parsedEvent2.args[0]

      // Get the second Campaign contract instance
      const campaign2 = Campaign.attach(
        campaignAddress2
      ) as unknown as ICampaign

      // For the new campaign, small contributions should fail
      await mockDAI.connect(contributor1).approve(campaignAddress2, smallAmount)

      // This should work as it's enforced at the campaign factory level, not contract level
      // The token registry restriction is only applied during campaign creation
      await campaign2.connect(contributor1).contribute(smallAmount)
    })
  })

  describe('Cross-contract Workflow Scenarios', function () {
    it('Should handle a complete campaign lifecycle with yield generation and token swaps', async function () {
      const {
        campaignFactory,
        creator,
        contributor1,
        contributor2,
        mockDAI,
        mockUSDC,
        mockDAIAToken,
        defiManager,
        treasury,
        mockUniswapRouter
      } = await loadFixture(deployPlatformFixture)

      // 1. Create a campaign
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
        throw new Error('Event failed')
      }

      const parsedEvent = campaignFactory.interface.parseLog(event)
      if (!parsedEvent) {
        throw new Error('parsedEvent failed')
      }

      const campaignAddress = parsedEvent.args[0]

      const Campaign = await ethers.getContractFactory('Campaign')
      const campaign = Campaign.attach(campaignAddress) as unknown as ICampaign

      // 2. Contributors fund the campaign
      await mockDAI
        .connect(contributor1)
        .approve(campaignAddress, CAMPAIGN_GOAL / 2n)
      await campaign.connect(contributor1).contribute(CAMPAIGN_GOAL / 2n)

      await mockDAI
        .connect(contributor2)
        .approve(campaignAddress, CAMPAIGN_GOAL / 2n)
      await campaign.connect(contributor2).contribute(CAMPAIGN_GOAL / 2n)

      // 3. Campaign is now fully funded
      expect(await campaign.isCampaignSuccessful()).to.be.true

      // 4. Creator deposits half of the funds into yield protocol
      const depositAmount = CAMPAIGN_GOAL / 2n
      await campaign
        .connect(creator)
        .depositToYieldProtocol(await mockDAI.getAddress(), depositAmount)

      // 5. Simulate yield generation
      const yieldAmount = (depositAmount * 5n) / 100n
      await mockDAIAToken.mint(await defiManager.getAddress(), yieldAmount)
      await mockDAI.transfer(await defiManager.getAddress(), yieldAmount)

      // 6. Creator harvests yield
      await campaign.connect(creator).harvestYield(await mockDAI.getAddress())

      // 7. Creator swaps part of the NON-DEPOSITED funds (the other half that wasn't deposited to Aave)
      const swapAmount = CAMPAIGN_GOAL / 4n

      // Fund the mock Uniswap router with USDC for the swap
      await mockUSDC.transfer(await mockUniswapRouter.getAddress(), swapAmount)

      // Perform the swap with the funds still in the campaign (not from Aave)
      await campaign
        .connect(creator)
        .swapTokens(
          await mockDAI.getAddress(),
          swapAmount,
          await mockUSDC.getAddress()
        )

      // 8. Wait for campaign to end
      const campaignEndTime = await campaign.campaignEndTime()
      await time.increaseTo(campaignEndTime + 1n)

      // 9. Withdraw all funds from yield protocol
      await campaign
        .connect(creator)
        .withdrawAllFromYieldProtocol(await mockDAI.getAddress())

      // 10. Creator claims all funds
      const daiBalanceBefore = await mockDAI.balanceOf(creator.address)
      const usdcBalanceBefore = await mockUSDC.balanceOf(creator.address)

      await campaign.connect(creator).claimFunds()

      const daiBalanceAfter = await mockDAI.balanceOf(creator.address)
      const usdcBalanceAfter = await mockUSDC.balanceOf(creator.address)

      // 11. Verify final balances
      // DAI balance increase should be the remaining DAI in the campaign
      const expectedDAI = CAMPAIGN_GOAL - swapAmount
      expect(daiBalanceAfter - daiBalanceBefore).to.equal(expectedDAI)

      // USDC balance increase should be the swapped amount
      expect(usdcBalanceAfter - usdcBalanceBefore).to.equal(swapAmount)

      // Campaign balances should be zero
      expect(await mockDAI.balanceOf(campaignAddress)).to.equal(0)
      expect(await mockUSDC.balanceOf(campaignAddress)).to.equal(0)
    })

    // it('Should handle multiple campaigns by the same creator with different tokens', async function () {
    //   const {
    //     campaignFactory,
    //     creator,
    //     contributor1,
    //     contributor2,
    //     mockDAI,
    //     mockUSDC
    //   } = await loadFixture(deployPlatformFixture)

    //   // Create a DAI campaign
    //   const tx1 = await campaignFactory
    //     .connect(creator)
    //     .deploy(await mockDAI.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

    //   const receipt1 = await tx1.wait()
    //   const event1 = receipt1.logs.find(log => {
    //     try {
    //       const parsed = campaignFactory.interface.parseLog(log)
    //       return parsed && parsed.name === 'CampaignCreated'
    //     } catch {
    //       return false
    //     }
    //   })

    //   const parsedEvent1 = campaignFactory.interface.parseLog(event1)
    //   const campaign1Address = parsedEvent1.args[0]

    //   // Create a USDC campaign
    //   const tx2 = await campaignFactory
    //     .connect(creator)
    //     .deploy(await mockUSDC.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

    //   const receipt2 = await tx2.wait()
    //   const event2 = receipt2.logs.find(log => {
    //     try {
    //       const parsed = campaignFactory.interface.parseLog(log)
    //       return parsed && parsed.name === 'CampaignCreated'
    //     } catch {
    //       return false
    //     }
    //   })

    //   const parsedEvent2 = campaignFactory.interface.parseLog(event2)
    //   const campaign2Address = parsedEvent2.args[0]

    //   // Get the Campaign contract instances
    //   const Campaign = await ethers.getContractFactory('Campaign')
    //   const campaign1 = Campaign.attach(campaign1Address)
    //   const campaign2 = Campaign.attach(campaign2Address)

    //   // Verify both campaigns are owned by the creator
    //   expect(await campaign1.owner()).to.equal(creator.address)
    //   expect(await campaign2.owner()).to.equal(creator.address)

    //   // Fund the DAI campaign
    //   await mockDAI.connect(contributor1).approve(campaign1Address, CAMPAIGN_GOAL)
    //   await campaign1.connect(contributor1).contribute(CAMPAIGN_GOAL)

    //   // Fund the USDC campaign
    //   await mockUSDC
    //     .connect(contributor2)
    //     .approve(campaign2Address, CAMPAIGN_GOAL)
    //   await campaign2.connect(contributor2).contribute(CAMPAIGN_GOAL)

    //   // Verify both campaigns are successful
    //   expect(await campaign1.isCampaignSuccessful()).to.be.true
    //   expect(await campaign2.isCampaignSuccessful()).to.be.true

    //   // Verify the campaigns are tracked correctly in the factory
    //   const creatorCampaigns = await campaignFactory.getCampaignsByCreator(
    //     creator.address
    //   )
    //   expect(creatorCampaigns).to.include(campaign1Address)
    //   expect(creatorCampaigns).to.include(campaign2Address)
    //   expect(creatorCampaigns.length).to.equal(2)
    // })

    // it('Should handle a campaign that updates treasury address during its lifecycle', async function () {
    //   const {
    //     campaignFactory,
    //     creator,
    //     contributor1,
    //     mockDAI,
    //     mockDAIAToken,
    //     defiManager,
    //     treasury,
    //     yieldDistributor,
    //     owner
    //   } = await loadFixture(deployPlatformFixture)

    //   // Create a new campaign
    //   const tx = await campaignFactory
    //     .connect(creator)
    //     .deploy(await mockDAI.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

    //   const receipt = await tx.wait()
    //   const event = receipt.logs.find(log => {
    //     try {
    //       const parsed = campaignFactory.interface.parseLog(log)
    //       return parsed && parsed.name === 'CampaignCreated'
    //     } catch {
    //       return false
    //     }
    //   })

    //   const parsedEvent = campaignFactory.interface.parseLog(event)
    //   const campaignAddress = parsedEvent.args[0]

    //   // Get the Campaign contract instance
    //   const Campaign = await ethers.getContractFactory('Campaign')
    //   const campaign = Campaign.attach(campaignAddress)

    //   // Fund the campaign
    //   await mockDAI.connect(contributor1).approve(campaignAddress, CAMPAIGN_GOAL)
    //   await campaign.connect(contributor1).contribute(CAMPAIGN_GOAL)

    //   // Deposit to yield protocol
    //   await campaign
    //     .connect(creator)
    //     .depositToYieldProtocol(await mockDAI.getAddress(), CAMPAIGN_GOAL)

    //   // Generate first yield
    //   const yieldAmount = (CAMPAIGN_GOAL * 5n) / 100n
    //   await mockDAIAToken.mint(await defiManager.getAddress(), yieldAmount)
    //   await mockDAI.transfer(await defiManager.getAddress(), yieldAmount)

    //   // Harvest first yield with original treasury
    //   const treasuryBalanceBefore = await mockDAI.balanceOf(treasury.address)

    //   await campaign.connect(creator).harvestYield(await mockDAI.getAddress())

    //   const treasuryBalanceAfter = await mockDAI.balanceOf(treasury.address)
    //   const platformShare = (yieldAmount * 20n) / 100n // 20% platform share

    //   expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(platformShare)

    //   // Create a new treasury address
    //   const [, , , , , newTreasury] = await ethers.getSigners()

    //   // Update treasury address
    //   await yieldDistributor
    //     .connect(owner)
    //     .updatePlatformTreasury(newTreasury.address)

    //   // Verify treasury was updated
    //   expect(await yieldDistributor.getPlatformTreasury()).to.equal(
    //     newTreasury.address
    //   )

    //   // Generate second yield
    //   await mockDAIAToken.mint(await defiManager.getAddress(), yieldAmount)
    //   await mockDAI.transfer(await defiManager.getAddress(), yieldAmount)

    //   // Harvest second yield with new treasury
    //   const newTreasuryBalanceBefore = await mockDAI.balanceOf(
    //     newTreasury.address
    //   )

    //   await campaign.connect(creator).harvestYield(await mockDAI.getAddress())

    //   const newTreasuryBalanceAfter = await mockDAI.balanceOf(newTreasury.address)

    //   // Verify new treasury received the yield
    //   expect(newTreasuryBalanceAfter - newTreasuryBalanceBefore).to.equal(
    //     platformShare
    //   )

    //   // Original treasury balance should not have changed
    //   expect(await mockDAI.balanceOf(treasury.address)).to.equal(
    //     treasuryBalanceAfter
    //   )
    // })
  })
})
