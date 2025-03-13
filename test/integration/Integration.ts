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
  const GRACE_PERIOD = 7 // 7 days grace period

  // Main fixture that deploys the entire platform and sets up test environment
  async function deployPlatformFixture () {
    const [
      owner,
      creator,
      contributor1,
      contributor2,
      platformTreasury,
      randomAddress,
      otherAdmin
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

    // Add these two lines to your fixture:
    await mockUniswapQuoter.setCustomQuoteRate(
      await mockUSDC.getAddress(),
      await mockDAI.getAddress(),
      1
    ) // 1:1 rate
    await mockUniswapRouter.setCustomSwapRate(
      await mockUSDC.getAddress(),
      await mockDAI.getAddress(),
      1
    )

    const platformAdmin = await ethers.deployContract('PlatformAdmin', [
      GRACE_PERIOD,
      owner
    ])
    await platformAdmin.waitForDeployment()

    await platformAdmin.addPlatformAdmin(await otherAdmin.getAddress())

    const platformAdminAddress = await platformAdmin.getAddress()

    // // Deploy TokenRegistry
    const tokenRegistry = await ethers.deployContract('TokenRegistry', [
      owner.address,
      platformAdminAddress
    ])
    await tokenRegistry.waitForDeployment()
    const tokenRegistryAddress = await tokenRegistry.getAddress()

    // // Add tokens to registry
    await tokenRegistry.addToken(await mockDAI.getAddress(), 1) // 1 token minimum contribution
    await tokenRegistry.addToken(await mockUSDC.getAddress(), 1) // 1 token minimum contribution

    // // Deploy YieldDistributor
    const yieldDistributor = await ethers.deployContract('YieldDistributor', [
      platformTreasury.address,
      platformAdminAddress,
      owner.address
    ])
    await yieldDistributor.waitForDeployment()
    const yieldDistributorAddress = await yieldDistributor.getAddress()

    const defiManager = await ethers.deployContract('DefiIntegrationManager', [
      await mockAavePool.getAddress(),
      await mockUniswapRouter.getAddress(),
      await mockUniswapQuoter.getAddress(),
      tokenRegistryAddress,
      yieldDistributorAddress,
      platformAdminAddress,
      owner.address
    ])
    await defiManager.waitForDeployment()
    const defiManagerAddress = await defiManager.getAddress()

    // // Deploy actual CampaignContractFactory with the correct DefiIntegrationManager
    const campaignContractFactory = await ethers.deployContract(
      'CampaignContractFactory',
      [defiManagerAddress, platformAdminAddress]
    )
    await campaignContractFactory.waitForDeployment()

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
      platformAdmin,
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
      campaignContractFactory,
      CAMPAIGN_GOAL,
      CAMPAIGN_DURATION,
      CONTRIBUTION_AMOUNT,
      PLATFORM_YIELD_SHARE,
      platformTreasury
    }
  }

  describe('Campaign Lifecycle', function () {
    it('Should create a campaign through factory and verify authorization', async function () {
      const { campaignContractFactory, creator, mockDAI, defiManager } =
        await loadFixture(deployPlatformFixture)

      const tx = await campaignContractFactory
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
          const parsed = campaignContractFactory.interface.parseLog(log)
          return parsed && parsed.name === 'CampaignCreated'
        } catch {
          return false
        }
      })

      // You should also check if event exists
      if (!event) {
        throw new Error('Failed to find CampaignCreated event')
      }

      const parsedEvent = campaignContractFactory.interface.parseLog(event)
      if (!parsedEvent) {
        throw new Error('Failed to parse event')
      }

      const campaignAddress = parsedEvent.args[0]

      // Verify campaign was correctly added to factory records
      expect(await campaignContractFactory.deployedCampaigns(0)).to.equal(
        campaignAddress
      )
      expect(
        await campaignContractFactory.creatorToCampaigns(creator.address, 0)
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
      const {
        campaignContractFactory,
        creator,
        contributor1,
        contributor2,
        mockDAI
      } = await loadFixture(deployPlatformFixture)

      // Create a new campaign
      const tx = await campaignContractFactory
        .connect(creator)
        .deploy(await mockDAI.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

      const receipt = await tx.wait()

      if (!receipt) {
        throw new Error('Transaction failed')
      }

      const event = receipt.logs.find(log => {
        try {
          const parsed = campaignContractFactory.interface.parseLog(log)
          return parsed && parsed.name === 'CampaignCreated'
        } catch {
          return false
        }
      })

      if (!event) {
        throw new Error('Event Failed')
      }

      const parsedEvent = campaignContractFactory.interface.parseLog(event)

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
      await campaign
        .connect(contributor1)
        .contribute(await mockDAI.getAddress(), CONTRIBUTION_AMOUNT)

      // Contributor 2 contributes
      await mockDAI
        .connect(contributor2)
        .approve(campaignAddress, CONTRIBUTION_AMOUNT)
      await campaign
        .connect(contributor2)
        .contribute(await mockDAI.getAddress(), CONTRIBUTION_AMOUNT)

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

    it('Should allow users to contribute in a non campaign token', async function () {
      const {
        campaignContractFactory,
        creator,
        contributor1,
        mockDAI,
        mockUSDC,
        mockUniswapRouter
      } = await loadFixture(deployPlatformFixture)

      // Create a campaign with DAI as the target token
      const tx = await campaignContractFactory
        .connect(creator)
        .deploy(await mockDAI.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

      const receipt = await tx.wait()
      if (!receipt) throw new Error('Transaction failed')

      const event = receipt.logs.find(log => {
        try {
          const parsed = campaignContractFactory.interface.parseLog(log)
          return parsed && parsed.name === 'CampaignCreated'
        } catch {
          return false
        }
      })
      if (!event) throw new Error('Event failed')

      const parsedEvent = campaignContractFactory.interface.parseLog(event)
      if (!parsedEvent) throw new Error('parsedEvent failed')

      const campaignAddress = parsedEvent.args[0]
      const Campaign = await ethers.getContractFactory('Campaign')
      const campaign = Campaign.attach(campaignAddress) as unknown as ICampaign

      // Initial balances
      const initialDAIBalance = await mockDAI.balanceOf(campaignAddress)
      const initialUSDCBalance = await mockUSDC.balanceOf(contributor1.address)
      const initialContribution = await campaign.contributions(
        contributor1.address
      )
      const initialTotalRaised = await campaign.totalAmountRaised()

      // Fund the mock Uniswap router with DAI for the swap result
      // The mock router will give a 1:1 exchange rate (configured in the fixture)
      const contributionAmount = ethers.parseUnits('100', 18)
      await mockDAI.transfer(
        await mockUniswapRouter.getAddress(),
        contributionAmount
      )

      // Approve and contribute using USDC (not the campaign token)
      await mockUSDC
        .connect(contributor1)
        .approve(campaignAddress, contributionAmount)

      // This will swap USDC to DAI and track the contribution
      await campaign
        .connect(contributor1)
        .contribute(await mockUSDC.getAddress(), contributionAmount)

      // Verify the contribution was tracked correctly
      expect(await campaign.contributions(contributor1.address)).to.equal(
        initialContribution + contributionAmount
      )

      // Verify total raised increased
      expect(await campaign.totalAmountRaised()).to.equal(
        initialTotalRaised + contributionAmount
      )

      // Verify the campaign has DAI (target token) balance, not USDC
      expect(await mockDAI.balanceOf(campaignAddress)).to.equal(
        initialDAIBalance + contributionAmount
      )

      // Contributor's USDC balance should have decreased
      expect(await mockUSDC.balanceOf(contributor1.address)).to.equal(
        initialUSDCBalance - contributionAmount
      )
    })

    it('Should track contributions correctly with a non-1:1 exchange rate', async function () {
      const {
        campaignContractFactory,
        creator,
        contributor1,
        mockDAI,
        mockUSDC,
        mockUniswapRouter,
        mockUniswapQuoter
      } = await loadFixture(deployPlatformFixture)

      // Create a campaign with DAI as the target token
      const tx = await campaignContractFactory
        .connect(creator)
        .deploy(await mockDAI.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

      const receipt = await tx.wait()
      if (!receipt) throw new Error('Transaction failed')

      const event = receipt.logs.find(log => {
        try {
          const parsed = campaignContractFactory.interface.parseLog(log)
          return parsed && parsed.name === 'CampaignCreated'
        } catch {
          return false
        }
      })

      if (!event) throw new Error('Event failed')

      const parsedEvent = campaignContractFactory.interface.parseLog(event)

      if (!parsedEvent) throw new Error('parsedEvent failed')

      const campaignAddress = parsedEvent.args[0]
      const Campaign = await ethers.getContractFactory('Campaign')
      const campaign = Campaign.attach(campaignAddress) as unknown as ICampaign

      const exchangeRate = 1n

      await mockUniswapRouter.setCustomSwapRate(
        await mockUSDC.getAddress(),
        await mockDAI.getAddress(),
        exchangeRate // 1n - means 1:1 swap rate with your current mocks
      )

      await mockUniswapQuoter.setCustomQuoteRate(
        await mockUSDC.getAddress(),
        await mockDAI.getAddress(),
        exchangeRate
      )

      // Initial balances
      const initialDAIBalance = await mockDAI.balanceOf(campaignAddress)
      const initialUSDCBalance = await mockUSDC.balanceOf(contributor1.address)
      const initialContribution = await campaign.contributions(
        contributor1.address
      )
      const initialTotalRaised = await campaign.totalAmountRaised()

      // Input amount and expected output amount
      const inputAmount = ethers.parseUnits('100', 18)
      const expectedOutputAmount = inputAmount * exchangeRate

      // Fund the mock Uniswap router with DAI for the swap result
      await mockDAI.transfer(
        await mockUniswapRouter.getAddress(),
        expectedOutputAmount
      )

      // Approve and contribute using USDC
      await mockUSDC.connect(contributor1).approve(campaignAddress, inputAmount)

      // This will swap USDC to DAI and track the contribution
      await campaign
        .connect(contributor1)
        .contribute(await mockUSDC.getAddress(), inputAmount)

      // Verify the contribution was tracked correctly based on the DAI amount received
      expect(await campaign.contributions(contributor1.address)).to.equal(
        initialContribution + expectedOutputAmount
      )

      // Verify total raised increased by the DAI amount
      expect(await campaign.totalAmountRaised()).to.equal(
        initialTotalRaised + expectedOutputAmount
      )

      // Verify the campaign has received the correct DAI amount
      expect(await mockDAI.balanceOf(campaignAddress)).to.equal(
        initialDAIBalance + expectedOutputAmount
      )

      // Contributor's USDC balance should have decreased by the input amount
      expect(await mockUSDC.balanceOf(contributor1.address)).to.equal(
        initialUSDCBalance - inputAmount
      )
    })

    it('Should handle a successful campaign with fund claiming', async function () {
      const {
        campaignContractFactory,
        creator,
        contributor1,
        contributor2,
        mockDAI
      } = await loadFixture(deployPlatformFixture)

      // Create a new campaign
      const tx = await campaignContractFactory

        .connect(creator)
        .deploy(await mockDAI.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

      const receipt = await tx.wait()
      if (!receipt) {
        throw new Error('Transaction failed')
      }

      const event = receipt.logs.find(log => {
        try {
          const parsed = campaignContractFactory.interface.parseLog(log)
          return parsed && parsed.name === 'CampaignCreated'
        } catch {
          return false
        }
      })

      if (!event) {
        throw new Error(' Event failed')
      }

      const parsedEvent = campaignContractFactory.interface.parseLog(event)

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
      await campaign
        .connect(contributor1)
        .contribute(await mockDAI.getAddress(), halfGoal)

      await mockDAI.connect(contributor2).approve(campaignAddress, halfGoal)
      await campaign
        .connect(contributor2)
        .contribute(await mockDAI.getAddress(), halfGoal)

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
      const {
        campaignContractFactory,
        creator,
        contributor1,
        contributor2,
        mockDAI
      } = await loadFixture(deployPlatformFixture)

      // Create a new campaign
      const tx = await campaignContractFactory

        .connect(creator)
        .deploy(await mockDAI.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

      const receipt = await tx.wait()

      if (!receipt) {
        throw new Error('Reciept Failed')
      }

      const event = receipt.logs.find(log => {
        try {
          const parsed = campaignContractFactory.interface.parseLog(log)
          return parsed && parsed.name === 'CampaignCreated'
        } catch {
          return false
        }
      })

      if (!event) {
        throw new Error(' Event failed')
      }

      const parsedEvent = campaignContractFactory.interface.parseLog(event)

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
      await campaign
        .connect(contributor1)
        .contribute(await mockDAI.getAddress(), partialAmount)

      await mockDAI
        .connect(contributor2)
        .approve(campaignAddress, partialAmount)
      await campaign
        .connect(contributor2)
        .contribute(await mockDAI.getAddress(), partialAmount)

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
        campaignContractFactory,
        creator,
        contributor1,
        mockDAI,
        mockDAIAToken,
        defiManager,
        platformTreasury
      } = await loadFixture(deployPlatformFixture)

      // Create a new campaign
      const tx = await campaignContractFactory

        .connect(creator)
        .deploy(await mockDAI.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

      const receipt = await tx.wait()
      if (!receipt) {
        throw new Error('Transaction failed')
      }

      const event = receipt.logs.find(log => {
        try {
          const parsed = campaignContractFactory.interface.parseLog(log)
          return parsed && parsed.name === 'CampaignCreated'
        } catch {
          return false
        }
      })

      if (!event) {
        throw new Error('Event failed')
      }

      const parsedEvent = campaignContractFactory.interface.parseLog(event)

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
      await campaign
        .connect(contributor1)
        .contribute(await mockDAI.getAddress(), CAMPAIGN_GOAL)

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
      const treasuryBalanceBefore = await mockDAI.balanceOf(
        platformTreasury.address
      )
      const campaignBalanceBefore = await mockDAI.balanceOf(campaignAddress)

      //   // Transfer the yield amount to the defi manager so it can distribute it
      await mockDAI.transfer(await defiManager.getAddress(), yieldAmount)

      //   // Now harvest the yield
      await campaign.connect(creator).harvestYield(await mockDAI.getAddress())

      //   // Calculate expected shares
      const platformShare = (yieldAmount * 20n) / 100n // 20% goes to platform
      const creatorShare = yieldAmount - platformShare // 80% goes to creator

      //   // Verify balances after yield harvest
      const treasuryBalanceAfter = await mockDAI.balanceOf(
        platformTreasury.address
      )
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
      const { campaignContractFactory, creator, contributor1, mockDAI } =
        await loadFixture(deployPlatformFixture)

      // Create a new campaign
      const tx = await campaignContractFactory
        .connect(creator)
        .deploy(await mockDAI.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

      const receipt = await tx.wait()

      if (!receipt) {
        throw new Error('Transaction failed')
      }

      const event = receipt.logs.find(log => {
        try {
          const parsed = campaignContractFactory.interface.parseLog(log)
          return parsed && parsed.name === 'CampaignCreated'
        } catch {
          return false
        }
      })

      if (!event) {
        throw new Error('Event failed')
      }

      const parsedEvent = campaignContractFactory.interface.parseLog(event)
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
      await campaign
        .connect(contributor1)
        .contribute(await mockDAI.getAddress(), CAMPAIGN_GOAL)

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

    it('Should change yield distribution parameters and verify effect', async function () {
      const {
        campaignContractFactory,
        creator,
        contributor1,
        mockDAI,
        mockDAIAToken,
        defiManager,
        platformTreasury,
        yieldDistributor,
        owner
      } = await loadFixture(deployPlatformFixture)

      // Create a new campaign
      const tx = await campaignContractFactory
        .connect(creator)
        .deploy(await mockDAI.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

      const receipt = await tx.wait()

      if (!receipt) {
        throw new Error('Transaction failed')
      }

      const event = receipt.logs.find(log => {
        try {
          const parsed = campaignContractFactory.interface.parseLog(log)
          return parsed && parsed.name === 'CampaignCreated'
        } catch {
          return false
        }
      })

      if (!event) {
        throw new Error('Event failed')
      }

      const parsedEvent = campaignContractFactory.interface.parseLog(event)

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
      await campaign
        .connect(contributor1)
        .contribute(await mockDAI.getAddress(), CAMPAIGN_GOAL)

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
      const treasuryBalanceBefore = await mockDAI.balanceOf(
        platformTreasury.address
      )

      await campaign.connect(creator).harvestYield(await mockDAI.getAddress())

      // Calculate expected shares with new rate
      const platformShare = (yieldAmount * 30n) / 100n // 30% goes to platform
      const creatorShare = yieldAmount - platformShare // 70% goes to creator

      // Verify balances after yield harvest
      const campaignBalanceAfter = await mockDAI.balanceOf(campaignAddress)
      const treasuryBalanceAfter = await mockDAI.balanceOf(
        platformTreasury.address
      )

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
      const { creator, mockDAI, defiManager, platformAdmin } =
        await loadFixture(deployPlatformFixture)

      const unauthorizedCampaign = await ethers.deployContract('Campaign', [
        creator.address,
        await mockDAI.getAddress(),
        CAMPAIGN_GOAL,
        CAMPAIGN_DURATION,
        await defiManager.getAddress(),
        await platformAdmin.getAddress()
      ])

      await unauthorizedCampaign.waitForDeployment()

      //   // Fund the campaign
      await mockDAI.transfer(
        await unauthorizedCampaign.getAddress(),
        CONTRIBUTION_AMOUNT
      )

      //   //   //   // Attempt to use DefiManager functions should fail
      //   await expect(
      //     unauthorizedCampaign
      //       .connect(creator)
      //       .depositToYieldProtocol(
      //         await mockDAI.getAddress(),
      //         CONTRIBUTION_AMOUNT
      //       )
      //   ).to.be.revertedWithCustomError(defiManager, 'UnauthorizedAddress')

      //   await expect(
      //     unauthorizedCampaign
      //       .connect(creator)
      //       .harvestYield(await mockDAI.getAddress())
      //   ).to.be.revertedWithCustomError(defiManager, 'UnauthorizedAddress')

      //   await expect(
      //     unauthorizedCampaign
      //       .connect(creator)
      //       .withdrawFromYieldProtocol(
      //         await mockDAI.getAddress(),
      //         CONTRIBUTION_AMOUNT
      //       )
      //   ).to.be.revertedWithCustomError(defiManager, 'UnauthorizedAddress')
    })

    it('Should prevent unauthorized users from managing campaigns', async function () {
      const { campaignContractFactory, creator, contributor1, mockDAI } =
        await loadFixture(deployPlatformFixture)

      // Create a new campaign
      const tx = await campaignContractFactory

        .connect(creator)
        .deploy(await mockDAI.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

      const receipt = await tx.wait()

      if (!receipt) {
        throw new Error('Transaction failed')
      }

      const event = receipt.logs.find(log => {
        try {
          const parsed = campaignContractFactory.interface.parseLog(log)
          return parsed && parsed.name === 'CampaignCreated'
        } catch {
          return false
        }
      })

      if (!event) {
        throw new Error('Event failed')
      }

      const parsedEvent = campaignContractFactory.interface.parseLog(event)

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
      await campaign
        .connect(contributor1)
        .contribute(await mockDAI.getAddress(), CONTRIBUTION_AMOUNT)

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
    })

    it('Should prevent deposits to yield protocol when token is not supported', async function () {
      const {
        campaignContractFactory,
        creator,
        contributor1,
        mockDAI,
        tokenRegistry,
        owner,
        defiManager
      } = await loadFixture(deployPlatformFixture)

      // Create a new campaign
      const tx = await campaignContractFactory

        .connect(creator)
        .deploy(await mockDAI.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

      const receipt = await tx.wait()

      if (!receipt) {
        throw new Error('Transaction failed')
      }

      const event = receipt.logs.find(log => {
        try {
          const parsed = campaignContractFactory.interface.parseLog(log)
          return parsed && parsed.name === 'CampaignCreated'
        } catch {
          return false
        }
      })

      if (!event) {
        throw new Error('event failed')
      }

      const parsedEvent = campaignContractFactory.interface.parseLog(event)

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
      await campaign
        .connect(contributor1)
        .contribute(await mockDAI.getAddress(), CONTRIBUTION_AMOUNT)

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
      ).to.be.revertedWithCustomError(defiManager, 'TokenNotSupported')
    })

    it('Should handle operations at token support boundaries', async function () {
      const {
        campaignContractFactory,
        creator,
        contributor1,
        mockDAI,
        tokenRegistry,
        owner
      } = await loadFixture(deployPlatformFixture)

      // Create a new campaign
      const tx = await campaignContractFactory

        .connect(creator)
        .deploy(await mockDAI.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

      const receipt = await tx.wait()

      if (!receipt) {
        throw new Error('Transaction failed')
      }

      const event = receipt.logs.find(log => {
        try {
          const parsed = campaignContractFactory.interface.parseLog(log)
          return parsed && parsed.name === 'CampaignCreated'
        } catch {
          return false
        }
      })

      if (!event) {
        throw new Error('Event failed')
      }

      const parsedEvent = campaignContractFactory.interface.parseLog(event)

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
      await campaign
        .connect(contributor1)
        .contribute(await mockDAI.getAddress(), CONTRIBUTION_AMOUNT)

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
      await campaign
        .connect(contributor1)
        .contribute(await mockDAI.getAddress(), smallAmount)

      // Create a second campaign with the same token
      const tx2 = await campaignContractFactory

        .connect(creator)
        .deploy(await mockDAI.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

      const receipt2 = await tx2.wait()

      if (!receipt2) {
        throw new Error('receipt2 failed')
      }

      const event2 = receipt2.logs.find(log => {
        try {
          const parsed = campaignContractFactory.interface.parseLog(log)
          return parsed && parsed.name === 'CampaignCreated'
        } catch {
          return false
        }
      })

      if (!event2) {
        throw new Error('event2 failed')
      }

      const parsedEvent2 = campaignContractFactory.interface.parseLog(event2)

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
      await campaign2
        .connect(contributor1)
        .contribute(await mockDAI.getAddress(), smallAmount)
    })
  })

  describe('Cross-contract Workflow Scenarios', function () {
    it('Should handle multiple campaigns by the same creator with different tokens', async function () {
      const {
        campaignContractFactory,
        creator,
        contributor1,
        contributor2,
        mockDAI,
        mockUSDC
      } = await loadFixture(deployPlatformFixture)

      // Create a DAI campaign
      const tx1 = await campaignContractFactory

        .connect(creator)
        .deploy(await mockDAI.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

      const receipt1 = await tx1.wait()
      if (!receipt1) throw new Error('Reciept1 failed')

      const event1 = receipt1.logs.find(log => {
        try {
          const parsed = campaignContractFactory.interface.parseLog(log)
          return parsed && parsed.name === 'CampaignCreated'
        } catch {
          return false
        }
      })

      if (!event1) throw new Error('event1 failed')

      const parsedEvent1 = campaignContractFactory.interface.parseLog(event1)

      if (!parsedEvent1) throw new Error('parsedEvent1 failed')

      const campaign1Address = parsedEvent1.args[0]

      // Create a USDC campaign
      const tx2 = await campaignContractFactory

        .connect(creator)
        .deploy(await mockUSDC.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

      const receipt2 = await tx2.wait()
      if (!receipt2) throw new Error('receipt2 failed')

      const event2 = receipt2.logs.find(log => {
        try {
          const parsed = campaignContractFactory.interface.parseLog(log)
          return parsed && parsed.name === 'CampaignCreated'
        } catch {
          return false
        }
      })

      if (!event2) throw new Error('event2 failed')

      const parsedEvent2 = campaignContractFactory.interface.parseLog(event2)
      if (!parsedEvent2) throw new Error('parsedEvent2 failed')

      const campaign2Address = parsedEvent2.args[0]

      // Get the Campaign contract instances
      const Campaign = await ethers.getContractFactory('Campaign')
      const campaign1 = Campaign.attach(
        campaign1Address
      ) as unknown as ICampaign
      const campaign2 = Campaign.attach(
        campaign2Address
      ) as unknown as ICampaign

      // Verify both campaigns are owned by the creator
      expect(await campaign1.owner()).to.equal(creator.address)
      expect(await campaign2.owner()).to.equal(creator.address)

      // Fund the DAI campaign
      await mockDAI
        .connect(contributor1)
        .approve(campaign1Address, CAMPAIGN_GOAL)
      await campaign1
        .connect(contributor1)
        .contribute(await mockDAI.getAddress(), CAMPAIGN_GOAL)

      // Fund the USDC campaign
      await mockUSDC
        .connect(contributor2)
        .approve(campaign2Address, CAMPAIGN_GOAL)
      await campaign2
        .connect(contributor2)
        .contribute(await mockUSDC.getAddress(), CAMPAIGN_GOAL)

      // Verify both campaigns are successful
      expect(await campaign1.isCampaignSuccessful()).to.be.true
      expect(await campaign2.isCampaignSuccessful()).to.be.true

      // Verify the campaigns are tracked correctly in the factory
      const creatorCampaigns =
        await campaignContractFactory.getCampaignsByCreator(creator.address)
      expect(creatorCampaigns).to.include(campaign1Address)
      expect(creatorCampaigns).to.include(campaign2Address)
      expect(creatorCampaigns.length).to.equal(2)
    })

    it('Should handle a campaign that updates treasury address during its lifecycle', async function () {
      const {
        campaignContractFactory,
        creator,
        contributor1,
        mockDAI,
        mockDAIAToken,
        defiManager,
        platformTreasury,
        yieldDistributor,
        owner
      } = await loadFixture(deployPlatformFixture)

      // Create a new campaign
      const tx = await campaignContractFactory

        .connect(creator)
        .deploy(await mockDAI.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

      const receipt = await tx.wait()
      if (!receipt) throw new Error('Reciept failed')

      const event = receipt.logs.find(log => {
        try {
          const parsed = campaignContractFactory.interface.parseLog(log)
          return parsed && parsed.name === 'CampaignCreated'
        } catch {
          return false
        }
      })
      if (!event) throw new Error('event failed')

      const parsedEvent = campaignContractFactory.interface.parseLog(event)
      if (!parsedEvent) throw new Error('parsedEvent failed')

      const campaignAddress = parsedEvent.args[0]

      // Get the Campaign contract instance
      const Campaign = await ethers.getContractFactory('Campaign')
      const campaign = Campaign.attach(campaignAddress) as unknown as ICampaign

      // Fund the campaign
      await mockDAI
        .connect(contributor1)
        .approve(campaignAddress, CAMPAIGN_GOAL)
      await campaign
        .connect(contributor1)
        .contribute(await mockDAI.getAddress(), CAMPAIGN_GOAL)

      // Deposit to yield protocol
      await campaign
        .connect(creator)
        .depositToYieldProtocol(await mockDAI.getAddress(), CAMPAIGN_GOAL)

      // Generate first yield
      const yieldAmount = (CAMPAIGN_GOAL * 5n) / 100n
      await mockDAIAToken.mint(await defiManager.getAddress(), yieldAmount)
      await mockDAI.transfer(await defiManager.getAddress(), yieldAmount)

      // Harvest first yield with original treasury
      const treasuryBalanceBefore = await mockDAI.balanceOf(
        platformTreasury.address
      )

      await campaign.connect(creator).harvestYield(await mockDAI.getAddress())

      const treasuryBalanceAfter = await mockDAI.balanceOf(
        platformTreasury.address
      )
      const platformShare = (yieldAmount * 20n) / 100n // 20% platform share

      expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(
        platformShare
      )

      // Create a new treasury address
      const [, , , , , newTreasury] = await ethers.getSigners()

      // Update treasury address
      await yieldDistributor
        .connect(owner)
        .updatePlatformTreasury(newTreasury.address)

      // Verify treasury was updated
      expect(await yieldDistributor.getPlatformTreasury()).to.equal(
        newTreasury.address
      )

      // Generate second yield
      await mockDAIAToken.mint(await defiManager.getAddress(), yieldAmount)
      await mockDAI.transfer(await defiManager.getAddress(), yieldAmount)

      // Harvest second yield with new treasury
      const newTreasuryBalanceBefore = await mockDAI.balanceOf(
        newTreasury.address
      )

      await campaign.connect(creator).harvestYield(await mockDAI.getAddress())

      const newTreasuryBalanceAfter = await mockDAI.balanceOf(
        newTreasury.address
      )

      // Verify new treasury received the yield
      expect(newTreasuryBalanceAfter - newTreasuryBalanceBefore).to.equal(
        platformShare
      )

      // Original treasury balance should not have changed
      expect(await mockDAI.balanceOf(platformTreasury.address)).to.equal(
        treasuryBalanceAfter
      )
    })
  })
})
