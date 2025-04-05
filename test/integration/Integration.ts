import { expect } from 'chai'
import { ethers, network } from 'hardhat'

import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { deployPlatformFixture } from '../fixture'

import {
  anyUint,
  anyValue
} from '@nomicfoundation/hardhat-chai-matchers/withArgs'

import { Campaign, IERC20Metadata } from '../../typechain-types'

describe('Base Mainnet Integration Tests', function () {
  describe('Campaign Lifecycle', function () {
    const OP_DEPOSIT = 1
    const OP_CAMPAIGN_CREATED = 1
    const OP_CLAIM_FUNDS = 2
    const ERR_GOAL_REACHED = 6
    const ERR_FUNDS_CLAIMED = 8
    const ERR_ALREADY_REFUNDED = 11

    it('Deploy supporting contracts and set initial state correctly', async function () {
      const {
        deployer,
        platformTreasury,
        platformAdmin,
        tokenRegistry,
        feeManager,
        defiIntegrationManager,
        campaignContractFactory,
        AAVE_POOL_ADDRESS,
        campaignEventCollector
      } = await loadFixture(deployPlatformFixture)

      //PlatformAdmin
      expect(await platformAdmin.owner()).to.equal(deployer.address)

      //TokenRegistry
      expect(await tokenRegistry.owner()).to.equal(deployer.address)
      expect(await tokenRegistry.platformAdmin()).to.equal(
        await platformAdmin.getAddress()
      )

      //feeManager
      expect(await feeManager.owner()).to.equal(deployer.address)
      expect(await feeManager.platformTreasury()).to.equal(
        platformTreasury.address
      )
      expect(await feeManager.platformAdmin()).to.equal(
        await platformAdmin.getAddress()
      )

      //DefiIntegrationManager
      expect(await defiIntegrationManager.owner()).to.equal(deployer.address)
      expect(await defiIntegrationManager.aavePool()).to.equal(
        ethers.getAddress(AAVE_POOL_ADDRESS)
      )
      expect(await defiIntegrationManager.tokenRegistry()).to.equal(
        ethers.getAddress(await tokenRegistry.getAddress())
      )
      expect(await defiIntegrationManager.feeManager()).to.equal(
        ethers.getAddress(await feeManager.getAddress())
      )

      expect(await defiIntegrationManager.platformAdmin()).to.equal(
        await platformAdmin.getAddress()
      )

      //CampaignContractFactory
      expect(await campaignContractFactory.owner()).to.equal(deployer.address)
      expect(await campaignContractFactory.defiManager()).to.equal(
        await defiIntegrationManager.getAddress()
      )
      expect(await campaignContractFactory.platformAdmin()).to.equal(
        await platformAdmin.getAddress()
      )

      expect(await campaignContractFactory.campaignEventCollector()).to.equal(
        await campaignEventCollector.getAddress()
      )
    })

    it('Should allow creators to deploy a campaign(s)', async function () {
      const { usdc, campaignContractFactory, creator1 } = await loadFixture(
        deployPlatformFixture
      )

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

      expect(parsedEvent.args[0]).to.equal(OP_CAMPAIGN_CREATED)

      const campaignAddress = parsedEvent.args[1]

      expect(parsedEvent.args[2]).to.equal(creator1.address)

      const Campaign = await ethers.getContractFactory('Campaign')
      const campaign = Campaign.attach(campaignAddress) as unknown as Campaign

      expect(await campaign.owner()).to.equal(creator1.address)
      expect(await campaign.campaignToken()).to.equal(
        ethers.getAddress(await usdc.getAddress())
      )
      expect(await campaign.campaignGoalAmount()).to.equal(CAMPAIGN_GOAL)
      expect(await campaign.campaignDuration()).to.equal(CAMPAIGN_DURATION)
      expect(await campaign.isCampaignActive()).to.be.true
    })

    it('Should allow contributions in the campaign token', async function () {
      const {
        usdc,
        campaignContractFactory,
        creator1,
        contributor1,
        defiIntegrationManager,
        IERC20ABI,
        campaignEventCollector
      } = await loadFixture(deployPlatformFixture)

      // Setup campaign
      const usdcDecimals = await usdc.decimals()
      const CAMPAIGN_GOAL = ethers.parseUnits('500', usdcDecimals)
      const CAMPAIGN_DURATION = 60

      // Deploy campaign
      const tx = await campaignContractFactory
        .connect(creator1)
        .deploy(await usdc.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

      const receipt = await tx.wait()
      if (!receipt) throw new Error('Transaction failed')

      // Get campaign address from event
      const event = receipt.logs.find(log => {
        try {
          const parsed = campaignContractFactory.interface.parseLog(log)
          return parsed && parsed.name === 'FactoryOperation'
        } catch {
          return false
        }
      })
      if (!event) throw new Error('Event failed')

      const parsedEvent = campaignContractFactory.interface.parseLog(event)
      if (!parsedEvent) throw new Error('Event failed')

      const campaignAddress = parsedEvent.args[1]

      // Attach to the campaign contract
      const Campaign = await ethers.getContractFactory('Campaign')
      const campaign = Campaign.attach(campaignAddress) as unknown as Campaign

      // Make a contribution
      const contributionAmount = ethers.parseUnits('100', usdcDecimals)
      await usdc
        .connect(contributor1)
        .approve(campaignAddress, contributionAmount)

      const contributeTx1 = await campaign
        .connect(contributor1)
        .contribute(contributionAmount)

      await contributeTx1.wait()

      // Check Contribution event from event collector
      const contributionEvents = await campaignEventCollector.queryFilter(
        campaignEventCollector.filters.Contribution()
      )
      const contributionEvent =
        contributionEvents[contributionEvents.length - 1]

      expect(contributionEvent.args.contributor).to.equal(contributor1.address)
      expect(contributionEvent.args.amount).to.equal(contributionAmount)
      expect(contributionEvent.args.campaignId).to.equal(
        await campaign.campaignId()
      )
      expect(contributionEvent.args.campaignAddress).to.equal(campaignAddress)

      // Check FundsOperation event from event collector
      const fundsOperationEvents = await campaignEventCollector.queryFilter(
        campaignEventCollector.filters.FundsOperation()
      )
      const fundsOperationEvent =
        fundsOperationEvents[fundsOperationEvents.length - 1]

      expect(fundsOperationEvent.args.token).to.equal(
        ethers.getAddress(await usdc.getAddress())
      )
      expect(fundsOperationEvent.args.amount).to.equal(contributionAmount)
      expect(fundsOperationEvent.args.opType).to.equal(OP_DEPOSIT)
      expect(fundsOperationEvent.args.initiator).to.equal(contributor1.address)
      expect(fundsOperationEvent.args.campaignId).to.equal(
        await campaign.campaignId()
      )
      expect(fundsOperationEvent.args.campaignAddress).to.equal(campaignAddress)

      // Check campaign state changes
      expect(await campaign.isContributor(contributor1.address)).to.be.true
      expect(await campaign.contributorsCount()).to.equal(1)

      // Check Aave integration
      const aTokenAddress = await defiIntegrationManager.getATokenAddress(
        await usdc.getAddress()
      )

      let aToken = (await ethers.getContractAt(
        IERC20ABI,
        aTokenAddress
      )) as unknown as IERC20Metadata

      // Verify funds were properly deposited to Aave
      expect(await aToken.balanceOf(campaignAddress)).to.be.closeTo(
        contributionAmount,
        10
      )

      expect(
        await defiIntegrationManager.aaveBalances(
          await usdc.getAddress(),
          campaignAddress
        )
      ).to.equal(contributionAmount)
    })

    it('Should correctly handle multiple contributors to a campaign', async function () {
      const {
        usdc,
        campaignContractFactory,
        creator1,
        contributor1,
        contributor2,
        defiIntegrationManager,
        IERC20ABI
      } = await loadFixture(deployPlatformFixture)

      const usdcDecimals = await usdc.decimals()
      const CAMPAIGN_GOAL = ethers.parseUnits('500', usdcDecimals)
      const CAMPAIGN_DURATION = 60

      // Deploy campaign
      const tx = await campaignContractFactory
        .connect(creator1)
        .deploy(await usdc.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

      const receipt = await tx.wait()
      if (!receipt) throw new Error('Transaction failed')

      const event = receipt.logs.find(log => {
        try {
          const parsed = campaignContractFactory.interface.parseLog(log)
          return parsed && parsed.name === 'FactoryOperation'
        } catch {
          return false
        }
      })

      if (!event) throw new Error('Event failed')

      const parsedEvent = campaignContractFactory.interface.parseLog(event)
      if (!parsedEvent) throw new Error('Event failed')

      const campaignAddress = parsedEvent.args[1]

      const Campaign = await ethers.getContractFactory('Campaign')
      const campaign = Campaign.attach(campaignAddress) as unknown as Campaign

      // First contribution
      const contributionAmount1 = ethers.parseUnits('100', usdcDecimals)
      await usdc
        .connect(contributor1)
        .approve(campaignAddress, contributionAmount1)

      await campaign.connect(contributor1).contribute(contributionAmount1)

      // Second contribution (different contributor)
      const contributionAmount2 = ethers.parseUnits('150', usdcDecimals)
      await usdc
        .connect(contributor2)
        .approve(campaignAddress, contributionAmount2)

      await campaign.connect(contributor2).contribute(contributionAmount2)

      // Third contribution (first contributor again)
      const contributionAmount3 = ethers.parseUnits('75', usdcDecimals)
      await usdc
        .connect(contributor1)
        .approve(campaignAddress, contributionAmount3)

      await campaign.connect(contributor1).contribute(contributionAmount3)

      // Verify contributor state
      expect(await campaign.contributorsCount()).to.equal(2)
      expect(await campaign.isContributor(contributor1.address)).to.be.true
      expect(await campaign.isContributor(contributor2.address)).to.be.true

      // Verify individual contribution amounts
      expect(await campaign.contributions(contributor1.address)).to.equal(
        contributionAmount1 + contributionAmount3
      )
      expect(await campaign.contributions(contributor2.address)).to.equal(
        contributionAmount2
      )

      // Verify total amount raised
      const totalExpected =
        contributionAmount1 + contributionAmount2 + contributionAmount3
      expect(await campaign.totalAmountRaised()).to.equal(totalExpected)

      // Verify aToken balance in campaign
      const aTokenAddress = await defiIntegrationManager.getATokenAddress(
        await usdc.getAddress()
      )

      const aToken = (await ethers.getContractAt(
        IERC20ABI,
        aTokenAddress
      )) as unknown as IERC20Metadata

      expect(await aToken.balanceOf(campaignAddress)).to.be.closeTo(
        totalExpected,
        10 // Increased tolerance for multiple operations
      )

      // Verify DefiIntegrationManager tracking
      expect(
        await defiIntegrationManager.aaveBalances(
          await usdc.getAddress(),
          campaignAddress
        )
      ).to.equal(totalExpected)
    })

    it('Should allow campaign creator to claim funds after successful campaign', async function () {
      const {
        usdc,
        campaignContractFactory,
        creator1,
        contributor1,
        contributor2,
        defiIntegrationManager,
        IERC20ABI,
        feeManager,
        campaignEventCollector
      } = await loadFixture(deployPlatformFixture)

      const usdcDecimals = await usdc.decimals()
      const CAMPAIGN_GOAL = ethers.parseUnits('500', usdcDecimals)
      const CAMPAIGN_DURATION = 60

      // Deploy campaign
      const tx = await campaignContractFactory
        .connect(creator1)
        .deploy(await usdc.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

      const receipt = await tx.wait()
      if (!receipt) throw new Error('Transaction failed')

      const event = receipt.logs.find(log => {
        try {
          const parsed = campaignContractFactory.interface.parseLog(log)
          return parsed && parsed.name === 'FactoryOperation'
        } catch {
          return false
        }
      })

      if (!event) throw new Error('Event failed')

      const parsedEvent = campaignContractFactory.interface.parseLog(event)
      if (!parsedEvent) throw new Error('Event failed')

      const campaignAddress = parsedEvent.args[1]

      const Campaign = await ethers.getContractFactory('Campaign')
      const campaign = Campaign.attach(campaignAddress) as unknown as Campaign

      // First contribution
      const contributionAmount1 = ethers.parseUnits('150', usdcDecimals)
      await usdc
        .connect(contributor1)
        .approve(campaignAddress, contributionAmount1)

      await campaign.connect(contributor1).contribute(contributionAmount1)

      // Second contribution (different contributor)
      const contributionAmount2 = ethers.parseUnits('150', usdcDecimals)
      await usdc
        .connect(contributor2)
        .approve(campaignAddress, contributionAmount2)

      await campaign.connect(contributor2).contribute(contributionAmount2)

      // Third contribution (first contributor again)
      const contributionAmount3 = ethers.parseUnits('220', usdcDecimals)
      await usdc
        .connect(contributor1)
        .approve(campaignAddress, contributionAmount3)

      await campaign.connect(contributor1).contribute(contributionAmount3)

      expect(
        await defiIntegrationManager.aaveBalances(
          await usdc.getAddress(),
          campaignAddress
        )
      ).to.equal(
        contributionAmount1 + contributionAmount2 + contributionAmount3
      )

      expect(await campaign.isCampaignSuccessful()).to.be.true

      await network.provider.send('evm_increaseTime', [
        60 * 60 * 24 * (CAMPAIGN_DURATION + 1)
      ]) // Fast forward time

      await network.provider.send('evm_mine')

      expect(await campaign.isCampaignActive()).to.be.false

      const aTokenAddress = await defiIntegrationManager.getATokenAddress(
        await usdc.getAddress()
      )

      let aToken = (await ethers.getContractAt(
        IERC20ABI,
        aTokenAddress
      )) as unknown as IERC20Metadata

      const aTokenBalance = await aToken.balanceOf(campaignAddress)

      // Clear previous events to make testing easier
      await campaignEventCollector.queryFilter(
        campaignEventCollector.filters.FundsOperation()
      )

      // Claim funds
      await campaign.connect(creator1).claimFunds()

      // Check FundsOperation event from event collector
      const fundsOperationEvents = await campaignEventCollector.queryFilter(
        campaignEventCollector.filters.FundsOperation()
      )
      const fundsOperationEvent =
        fundsOperationEvents[fundsOperationEvents.length - 1]

      expect(fundsOperationEvent.args.token).to.equal(
        ethers.getAddress(await usdc.getAddress())
      )
      expect(fundsOperationEvent.args.amount).to.be.closeTo(aTokenBalance, 10)
      expect(fundsOperationEvent.args.opType).to.equal(OP_CLAIM_FUNDS)
      expect(fundsOperationEvent.args.initiator).to.equal(creator1.address)
      expect(fundsOperationEvent.args.campaignId).to.equal(
        await campaign.campaignId()
      )
      expect(fundsOperationEvent.args.campaignAddress).to.equal(campaignAddress)

      // Check FundsClaimed event
      const fundsClaimedEvents = await campaignEventCollector.queryFilter(
        campaignEventCollector.filters.FundsClaimed()
      )
      const fundsClaimedEvent =
        fundsClaimedEvents[fundsClaimedEvents.length - 1]

      expect(fundsClaimedEvent.args.initiator).to.equal(creator1.address)
      expect(fundsClaimedEvent.args.amount).to.be.closeTo(aTokenBalance, 10)
      expect(fundsClaimedEvent.args.campaignId).to.equal(
        await campaign.campaignId()
      )
      expect(fundsClaimedEvent.args.campaignAddress).to.equal(campaignAddress)

      // Verify balances
      expect(
        await defiIntegrationManager.aaveBalances(
          await usdc.getAddress(),
          campaignAddress
        )
      ).to.equal(0)

      const [creatorShare, platformShare] = await feeManager.calculateFeeShares(
        aTokenBalance
      )

      expect(await usdc.balanceOf(creator1.address)).to.be.closeTo(
        creatorShare,
        10
      )

      expect(
        await usdc.balanceOf(await feeManager.platformTreasury())
      ).to.be.closeTo(platformShare, 10)

      // Verify error cases
      await expect(campaign.connect(creator1).claimFunds())
        .to.be.revertedWithCustomError(campaign, 'CampaignError')
        .withArgs(
          ERR_FUNDS_CLAIMED,
          ethers.ZeroAddress,
          0,
          await campaign.campaignId()
        )

      await expect(campaign.connect(contributor1).requestRefund())
        .to.be.revertedWithCustomError(campaign, 'CampaignError')
        .withArgs(
          ERR_GOAL_REACHED,
          ethers.ZeroAddress,
          await campaign.totalAmountRaised(),
          await campaign.campaignId()
        )
    })

    it('Should allow campaign creator to claim funds for refunds after failed campaign', async function () {
      const {
        usdc,
        campaignContractFactory,
        creator1,
        contributor1,
        contributor2,
        defiIntegrationManager,
        IERC20ABI,
        feeManager,
        campaignEventCollector
      } = await loadFixture(deployPlatformFixture)

      const usdcDecimals = await usdc.decimals()
      const CAMPAIGN_GOAL = ethers.parseUnits('500', usdcDecimals)
      const CAMPAIGN_DURATION = 60

      // Deploy campaign
      const tx = await campaignContractFactory
        .connect(creator1)
        .deploy(await usdc.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

      const receipt = await tx.wait()
      if (!receipt) throw new Error('Transaction failed')

      const event = receipt.logs.find(log => {
        try {
          const parsed = campaignContractFactory.interface.parseLog(log)
          return parsed && parsed.name === 'FactoryOperation'
        } catch {
          return false
        }
      })

      if (!event) throw new Error('Event failed')

      const parsedEvent = campaignContractFactory.interface.parseLog(event)
      if (!parsedEvent) throw new Error('Event failed')

      const campaignAddress = parsedEvent.args[1]

      const Campaign = await ethers.getContractFactory('Campaign')
      const campaign = Campaign.attach(campaignAddress) as unknown as Campaign

      // First contribution
      const contributionAmount1 = ethers.parseUnits('150', usdcDecimals)
      await usdc
        .connect(contributor1)
        .approve(campaignAddress, contributionAmount1)

      await campaign.connect(contributor1).contribute(contributionAmount1)

      // Second contribution (different contributor)
      const contributionAmount2 = ethers.parseUnits('150', usdcDecimals)
      await usdc
        .connect(contributor2)
        .approve(campaignAddress, contributionAmount2)

      await campaign.connect(contributor2).contribute(contributionAmount2)

      // Third contribution (first contributor again)
      const contributionAmount3 = ethers.parseUnits('130', usdcDecimals)
      await usdc
        .connect(contributor1)
        .approve(campaignAddress, contributionAmount3)

      await campaign.connect(contributor1).contribute(contributionAmount3)

      expect(
        await defiIntegrationManager.aaveBalances(
          await usdc.getAddress(),
          campaignAddress
        )
      ).to.equal(
        contributionAmount1 + contributionAmount2 + contributionAmount3
      )

      expect(await campaign.isCampaignSuccessful()).to.be.false

      await network.provider.send('evm_increaseTime', [
        60 * 60 * 24 * (CAMPAIGN_DURATION + 1)
      ]) // Fast forward time

      await network.provider.send('evm_mine')

      expect(await campaign.isCampaignActive()).to.be.false

      const aTokenAddress = await defiIntegrationManager.getATokenAddress(
        await usdc.getAddress()
      )

      let aToken = (await ethers.getContractAt(
        IERC20ABI,
        aTokenAddress
      )) as unknown as IERC20Metadata

      const aTokenBalance = await aToken.balanceOf(campaignAddress)

      // Get event count before claim to identify new events
      const initialFundsOpEvents = await campaignEventCollector.queryFilter(
        campaignEventCollector.filters.FundsOperation()
      )
      const initialFundsClaimedEvents =
        await campaignEventCollector.queryFilter(
          campaignEventCollector.filters.FundsClaimed()
        )

      // Claim funds
      await campaign.connect(creator1).claimFunds()

      // Check FundsOperation event from event collector
      const fundsOperationEvents = await campaignEventCollector.queryFilter(
        campaignEventCollector.filters.FundsOperation()
      )
      const fundsOperationEvent =
        fundsOperationEvents[fundsOperationEvents.length - 1]

      expect(fundsOperationEvent.args.token).to.equal(
        ethers.getAddress(await usdc.getAddress())
      )
      expect(fundsOperationEvent.args.amount).to.be.closeTo(aTokenBalance, 10)
      expect(fundsOperationEvent.args.opType).to.equal(OP_CLAIM_FUNDS)
      expect(fundsOperationEvent.args.initiator).to.equal(creator1.address)
      expect(fundsOperationEvent.args.campaignId).to.equal(
        await campaign.campaignId()
      )
      expect(fundsOperationEvent.args.campaignAddress).to.equal(campaignAddress)

      // Check FundsClaimed event
      const fundsClaimedEvents = await campaignEventCollector.queryFilter(
        campaignEventCollector.filters.FundsClaimed()
      )
      const fundsClaimedEvent =
        fundsClaimedEvents[fundsClaimedEvents.length - 1]

      expect(fundsClaimedEvent.args.initiator).to.equal(creator1.address)
      expect(fundsClaimedEvent.args.amount).to.be.closeTo(aTokenBalance, 10)
      expect(fundsClaimedEvent.args.campaignId).to.equal(
        await campaign.campaignId()
      )
      expect(fundsClaimedEvent.args.campaignAddress).to.equal(campaignAddress)

      // Verify balances
      expect(
        await defiIntegrationManager.aaveBalances(
          await usdc.getAddress(),
          campaignAddress
        )
      ).to.equal(0)

      const forRefunds = await campaign.totalAmountRaised()

      expect(await usdc.balanceOf(creator1.address)).to.equal(0)
      expect(await usdc.balanceOf(campaignAddress)).to.equal(forRefunds)
      expect(
        await usdc.balanceOf(await feeManager.platformTreasury())
      ).to.be.closeTo(aTokenBalance - forRefunds, 10)

      // Verify error case
      await expect(campaign.connect(creator1).claimFunds())
        .to.be.revertedWithCustomError(campaign, 'CampaignError')
        .withArgs(
          ERR_FUNDS_CLAIMED,
          ethers.ZeroAddress,
          0,
          await campaign.campaignId()
        )
    })

    it('Should allow contributors to request refund after campaign fails', async function () {
      const {
        usdc,
        campaignContractFactory,
        creator1,
        contributor1,
        contributor2,
        defiIntegrationManager,
        IERC20ABI,
        feeManager,
        campaignEventCollector
      } = await loadFixture(deployPlatformFixture)

      const usdcDecimals = await usdc.decimals()
      const CAMPAIGN_GOAL = ethers.parseUnits('500', usdcDecimals)
      const CAMPAIGN_DURATION = 60

      // Deploy campaign
      const tx = await campaignContractFactory
        .connect(creator1)
        .deploy(await usdc.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

      const receipt = await tx.wait()
      if (!receipt) throw new Error('Transaction failed')

      const event = receipt.logs.find(log => {
        try {
          const parsed = campaignContractFactory.interface.parseLog(log)
          return parsed && parsed.name === 'FactoryOperation'
        } catch {
          return false
        }
      })

      if (!event) throw new Error('Event failed')

      const parsedEvent = campaignContractFactory.interface.parseLog(event)
      if (!parsedEvent) throw new Error('Event failed')

      const campaignAddress = parsedEvent.args[1]

      const Campaign = await ethers.getContractFactory('Campaign')
      const campaign = Campaign.attach(campaignAddress) as unknown as Campaign

      // First contribution
      const contributionAmount1 = ethers.parseUnits('150', usdcDecimals)
      await usdc
        .connect(contributor1)
        .approve(campaignAddress, contributionAmount1)

      await campaign.connect(contributor1).contribute(contributionAmount1)

      // Second contribution (different contributor)
      const contributionAmount2 = ethers.parseUnits('150', usdcDecimals)
      await usdc
        .connect(contributor2)
        .approve(campaignAddress, contributionAmount2)

      await campaign.connect(contributor2).contribute(contributionAmount2)

      // Third contribution (first contributor again)
      const contributionAmount3 = ethers.parseUnits('130', usdcDecimals)
      await usdc
        .connect(contributor1)
        .approve(campaignAddress, contributionAmount3)

      await campaign.connect(contributor1).contribute(contributionAmount3)

      await network.provider.send('evm_increaseTime', [
        60 * 60 * 24 * (CAMPAIGN_DURATION + 1)
      ]) // Fast forward time

      await network.provider.send('evm_mine')

      const aTokenAddress = await defiIntegrationManager.getATokenAddress(
        await usdc.getAddress()
      )

      let aToken = (await ethers.getContractAt(
        IERC20ABI,
        aTokenAddress
      )) as unknown as IERC20Metadata

      const aTokenBalance = await aToken.balanceOf(campaignAddress)

      await campaign.connect(creator1).claimFunds()

      const forRefunds = await campaign.totalAmountRaised()

      expect(await usdc.balanceOf(campaignAddress)).to.be.closeTo(forRefunds, 5)
      expect(
        await usdc.balanceOf(await feeManager.platformTreasury())
      ).to.be.closeTo(aTokenBalance - forRefunds, 5)

      const contributor1Contribution = await campaign.contributions(
        contributor1.address
      )
      const originalContributor1USDCBalance = await usdc.balanceOf(
        contributor1.address
      )

      const contributor2Contribution = await campaign.contributions(
        contributor2.address
      )
      const originalContributor2USDCBalance = await usdc.balanceOf(
        contributor2.address
      )

      // Clear previous events or get current count
      const initialRefundEvents = await campaignEventCollector.queryFilter(
        campaignEventCollector.filters.RefundIssued()
      )

      // Request first refund
      await campaign.connect(contributor1).requestRefund()

      // Check RefundIssued event from event collector
      const refundEvents1 = await campaignEventCollector.queryFilter(
        campaignEventCollector.filters.RefundIssued()
      )
      const refundEvent1 = refundEvents1[refundEvents1.length - 1]

      expect(refundEvent1.args.contributor).to.equal(contributor1.address)
      expect(refundEvent1.args.amount).to.equal(contributor1Contribution)
      expect(refundEvent1.args.campaignId).to.equal(await campaign.campaignId())
      expect(refundEvent1.args.campaignAddress).to.equal(campaignAddress)

      // Verify state changes
      expect(await campaign.hasBeenRefunded(contributor1.address)).to.be.true
      expect(await usdc.balanceOf(contributor1.address)).to.be.closeTo(
        contributor1Contribution + originalContributor1USDCBalance,
        5
      )
      expect(await usdc.balanceOf(campaignAddress)).to.be.closeTo(
        forRefunds - contributor1Contribution,
        5
      )

      // Request second refund
      await campaign.connect(contributor2).requestRefund()

      // Check RefundIssued event for second refund
      const refundEvents2 = await campaignEventCollector.queryFilter(
        campaignEventCollector.filters.RefundIssued()
      )
      const refundEvent2 = refundEvents2[refundEvents2.length - 1]

      expect(refundEvent2.args.contributor).to.equal(contributor2.address)
      expect(refundEvent2.args.amount).to.equal(contributor2Contribution)
      expect(refundEvent2.args.campaignId).to.equal(await campaign.campaignId())
      expect(refundEvent2.args.campaignAddress).to.equal(campaignAddress)

      // Verify second refund state changes
      expect(await campaign.hasBeenRefunded(contributor2.address)).to.be.true
      expect(await usdc.balanceOf(contributor2.address)).to.be.closeTo(
        contributor2Contribution + originalContributor2USDCBalance,
        5
      )
      expect(await usdc.balanceOf(campaignAddress)).to.equal(0)

      // Verify error cases
      await expect(campaign.connect(contributor1).requestRefund())
        .to.be.revertedWithCustomError(campaign, 'CampaignError')
        .withArgs(
          ERR_ALREADY_REFUNDED,
          contributor1.address,
          0,
          await campaign.campaignId()
        )

      await expect(campaign.connect(contributor2).requestRefund())
        .to.be.revertedWithCustomError(campaign, 'CampaignError')
        .withArgs(
          ERR_ALREADY_REFUNDED,
          contributor2.address,
          0,
          await campaign.campaignId()
        )
    })

    it('Should emit status change event when campaign becomes successful', async function () {
      const {
        usdc,
        campaignContractFactory,
        creator1,
        contributor1,
        campaignEventCollector
      } = await loadFixture(deployPlatformFixture)

      const usdcDecimals = await usdc.decimals()
      const CAMPAIGN_GOAL = ethers.parseUnits('500', usdcDecimals)
      const CAMPAIGN_DURATION = 60

      // Deploy campaign
      const tx = await campaignContractFactory
        .connect(creator1)
        .deploy(await usdc.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

      const receipt = await tx.wait()
      if (!receipt) throw new Error('Transaction failed')

      const event = receipt.logs.find(log => {
        try {
          const parsed = campaignContractFactory.interface.parseLog(log)
          return parsed && parsed.name === 'FactoryOperation'
        } catch {
          return false
        }
      })

      if (!event) throw new Error('Event failed')

      const parsedEvent = campaignContractFactory.interface.parseLog(event)
      if (!parsedEvent) throw new Error('Event failed')

      const campaignAddress = parsedEvent.args[1]

      const Campaign = await ethers.getContractFactory('Campaign')
      const campaign = Campaign.attach(campaignAddress) as unknown as Campaign

      // Get current event count to ensure we check only new events
      const initialStatusEvents = await campaignEventCollector.queryFilter(
        campaignEventCollector.filters.CampaignStatusChanged()
      )

      // Contribute enough to reach goal
      await usdc.connect(contributor1).approve(campaignAddress, CAMPAIGN_GOAL)

      // This contribution should trigger the status change event
      await campaign.connect(contributor1).contribute(CAMPAIGN_GOAL)

      // Check for the CampaignStatusChanged event in the event collector
      const statusEvents = await campaignEventCollector.queryFilter(
        campaignEventCollector.filters.CampaignStatusChanged()
      )

      // Should have one new event
      expect(statusEvents.length).to.be.greaterThan(initialStatusEvents.length)

      // Get the latest event
      const statusChangeEvent = statusEvents[statusEvents.length - 1]

      // Check event arguments
      expect(statusChangeEvent.args.oldStatus).to.equal(1) // STATUS_ACTIVE
      expect(statusChangeEvent.args.newStatus).to.equal(2) // STATUS_COMPLETE
      expect(statusChangeEvent.args.reason).to.equal(1) // REASON_GOAL_REACHED
      expect(statusChangeEvent.args.campaignId).to.equal(
        await campaign.campaignId()
      )
      expect(statusChangeEvent.args.campaignAddress).to.equal(campaignAddress)

      // Status should be updated in the campaign contract
      expect(await campaign.campaignStatus()).to.equal(2) // STATUS_COMPLETE
    })

    it('Should emit status change event when campaign ends without reaching goal', async function () {
      const {
        usdc,
        campaignContractFactory,
        creator1,
        contributor1,
        campaignEventCollector
      } = await loadFixture(deployPlatformFixture)

      const usdcDecimals = await usdc.decimals()
      const CAMPAIGN_GOAL = ethers.parseUnits('500', usdcDecimals)
      const CAMPAIGN_DURATION = 60

      // Deploy campaign
      const tx = await campaignContractFactory
        .connect(creator1)
        .deploy(await usdc.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

      const receipt = await tx.wait()
      if (!receipt) throw new Error('Transaction failed')

      const event = receipt.logs.find(log => {
        try {
          const parsed = campaignContractFactory.interface.parseLog(log)
          return parsed && parsed.name === 'FactoryOperation'
        } catch {
          return false
        }
      })

      if (!event) throw new Error('Event failed')

      const parsedEvent = campaignContractFactory.interface.parseLog(event)
      if (!parsedEvent) throw new Error('Event failed')

      const campaignAddress = parsedEvent.args[1]

      const Campaign = await ethers.getContractFactory('Campaign')
      const campaign = Campaign.attach(campaignAddress) as unknown as Campaign

      // Contribute less than the goal
      const partialAmount = CAMPAIGN_GOAL / 2n
      await usdc.connect(contributor1).approve(campaignAddress, partialAmount)
      await campaign.connect(contributor1).contribute(partialAmount)

      // Fast forward past the end date
      await network.provider.send('evm_increaseTime', [
        CAMPAIGN_DURATION * 24 * 60 * 60 + 1
      ])
      await network.provider.send('evm_mine')

      // Get current event count to ensure we check only new events
      const initialStatusEvents = await campaignEventCollector.queryFilter(
        campaignEventCollector.filters.CampaignStatusChanged()
      )

      // Call claimFunds which should trigger status check
      await campaign.connect(creator1).claimFunds()

      // Check for the CampaignStatusChanged event in the event collector
      const statusEvents = await campaignEventCollector.queryFilter(
        campaignEventCollector.filters.CampaignStatusChanged()
      )

      // Should have one new event
      expect(statusEvents.length).to.be.greaterThan(initialStatusEvents.length)

      // Get the most recent event
      const statusChangeEvent = statusEvents[statusEvents.length - 1]

      // Check event arguments
      expect(statusChangeEvent.args.oldStatus).to.equal(1) // STATUS_ACTIVE
      expect(statusChangeEvent.args.newStatus).to.equal(2) // STATUS_COMPLETE
      expect(statusChangeEvent.args.reason).to.equal(2) // REASON_DEADLINE_PASSED
      expect(statusChangeEvent.args.campaignId).to.equal(
        await campaign.campaignId()
      )
      expect(statusChangeEvent.args.campaignAddress).to.equal(campaignAddress)

      // Status should be updated
      expect(await campaign.campaignStatus()).to.equal(2) // STATUS_COMPLETE
    })

    it('Should not emit status change event when status is already complete', async function () {
      const { usdc, campaignContractFactory, creator1, contributor1 } =
        await loadFixture(deployPlatformFixture)

      const usdcDecimals = await usdc.decimals()
      const CAMPAIGN_GOAL = ethers.parseUnits('500', usdcDecimals)
      const CAMPAIGN_DURATION = 60

      // Deploy campaign
      const tx = await campaignContractFactory
        .connect(creator1)
        .deploy(await usdc.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

      const receipt = await tx.wait()

      if (!receipt) throw new Error('Transaction failed')
      const event = receipt.logs.find(log => {
        try {
          const parsed = campaignContractFactory.interface.parseLog(log)
          return parsed && parsed.name === 'FactoryOperation'
        } catch {
          return false
        }
      })

      if (!event) throw new Error('Event failed')

      const parsedEvent = campaignContractFactory.interface.parseLog(event)

      if (!parsedEvent) throw new Error('Event failed')
      const campaignAddress = parsedEvent.args[1]

      const Campaign = await ethers.getContractFactory('Campaign')
      const campaign = Campaign.attach(campaignAddress) as unknown as Campaign

      // Make campaign successful by contributing enough to reach goal
      await usdc.connect(contributor1).approve(campaignAddress, CAMPAIGN_GOAL)
      await campaign.connect(contributor1).contribute(CAMPAIGN_GOAL)

      // Check current status - should be complete after contribution
      expect(await campaign.campaignStatus()).to.equal(2) // STATUS_COMPLETE

      // Call checkAndUpdateStatus - should not emit an event
      const updateTx = await campaign.checkAndUpdateStatus()
      const updateReceipt = await updateTx.wait()

      if (!updateReceipt) throw new Error('Transaction failed')

      // Look for the CampaignStatusChanged event - should NOT find it
      const statusChangeEvent = updateReceipt.logs.find(log => {
        try {
          const parsed = campaign.interface.parseLog(log)
          return parsed && parsed.name === 'CampaignStatusChanged'
        } catch {
          return false
        }
      })

      expect(statusChangeEvent).to.be.undefined
    })
  })

  describe('Token Integration', function () {
    const ERR_NOT_TARGET_TOKEN = 13
    const ERR_INVALID_AMOUNT = 5
    const ERR_CAMPAIGN_CONSTRUCTOR_VALIDATION_FAILED = 1
    const OP_TOKEN_ADDED = 1
    const OP_TOKEN_REMOVED = 2
    const OP_TOKEN_SUPPORT_DISABLED = 3
    const OP_TOKEN_SUPPORT_ENABLED = 4
    const OP_CAMPAIGN_CREATED = 1
    it('Should revert for contributions in non-target token', async function () {
      const { usdc, campaignContractFactory, creator1, contributor1, wbtc } =
        await loadFixture(deployPlatformFixture)

      const wbtcDecimals = await wbtc.decimals()
      const CAMPAIGN_GOAL = ethers.parseUnits('500', wbtcDecimals)
      const CAMPAIGN_DURATION = 60

      const tx = await campaignContractFactory
        .connect(creator1)
        .deploy(await usdc.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

      const receipt = await tx.wait()
      if (!receipt) throw new Error('Transaction failed')

      const event = receipt.logs.find(log => {
        try {
          const parsed = campaignContractFactory.interface.parseLog(log)
          return parsed && parsed.name === 'FactoryOperation'
        } catch {
          return false
        }
      })

      if (!event) throw new Error('Event failed')

      const parsedEvent = campaignContractFactory.interface.parseLog(event)
      if (!parsedEvent) throw new Error('Event failed')

      const campaignAddress = parsedEvent.args[1]

      const Campaign = await ethers.getContractFactory('Campaign')
      const campaign = Campaign.attach(campaignAddress) as unknown as Campaign

      const contributionAmount = ethers.parseUnits('100', wbtcDecimals)

      await wbtc
        .connect(contributor1)
        .approve(campaignAddress, contributionAmount)

      await expect(
        campaign.connect(contributor1).contribute(contributionAmount)
      ).to.be.revertedWith('ERC20: transfer amount exceeds allowance')

      expect(await campaign.totalAmountRaised()).to.equal(0)
    })

    it('Should revert for contributions with insufficient allowance', async function () {
      const { usdc, campaignContractFactory, creator1, contributor1, wbtc } =
        await loadFixture(deployPlatformFixture)

      const usdcDecimals = await usdc.decimals()
      const CAMPAIGN_GOAL = ethers.parseUnits('500', usdcDecimals)
      const CAMPAIGN_DURATION = 60

      const tx = await campaignContractFactory
        .connect(creator1)
        .deploy(await usdc.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

      const receipt = await tx.wait()
      if (!receipt) throw new Error('Transaction failed')

      const event = receipt.logs.find(log => {
        try {
          const parsed = campaignContractFactory.interface.parseLog(log)
          return parsed && parsed.name === 'FactoryOperation'
        } catch {
          return false
        }
      })

      if (!event) throw new Error('Event failed')

      const parsedEvent = campaignContractFactory.interface.parseLog(event)
      if (!parsedEvent) throw new Error('Event failed')

      const campaignAddress = parsedEvent.args[1]

      const Campaign = await ethers.getContractFactory('Campaign')
      const campaign = Campaign.attach(campaignAddress) as unknown as Campaign

      const contributionAmount = ethers.parseUnits('100', usdcDecimals)

      await expect(
        campaign.connect(contributor1).contribute(contributionAmount)
      ).to.be.revertedWith('ERC20: transfer amount exceeds allowance')

      expect(await campaign.totalAmountRaised()).to.equal(0)
    })

    it('Should allow platform admin to add token to tokenRegistry', async function () {
      const {
        tokenRegistry,
        campaignContractFactory,
        creator1,
        deployer,
        wbtc
      } = await loadFixture(deployPlatformFixture)

      const wbtcDecimals = await wbtc.decimals()
      const wbtcMinimumContribution = ethers.parseUnits('1', wbtcDecimals)

      const CAMPAIGN_GOAL = ethers.parseUnits('500', wbtcDecimals)
      const CAMPAIGN_DURATION = 60

      await expect(
        campaignContractFactory
          .connect(creator1)
          .deploy(await wbtc.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)
      )
        .to.be.revertedWithCustomError(campaignContractFactory, 'FactoryError')
        .withArgs(
          ERR_CAMPAIGN_CONSTRUCTOR_VALIDATION_FAILED,
          ethers.ZeroAddress,
          0
        )

      await expect(
        tokenRegistry.connect(deployer).addToken(await wbtc.getAddress(), 1)
      )
        .to.emit(tokenRegistry, 'TokenRegistryOperation')
        .withArgs(
          OP_TOKEN_ADDED,
          ethers.getAddress(await wbtc.getAddress()),
          wbtcMinimumContribution,
          wbtcDecimals
        )

      expect(await tokenRegistry.isTokenSupported(await wbtc.getAddress())).to
        .be.true

      const tx = await campaignContractFactory
        .connect(creator1)
        .deploy(await wbtc.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

      const receipt = await tx.wait()
      if (!receipt) throw new Error('Transaction failed')

      const event = receipt.logs.find(log => {
        try {
          const parsed = campaignContractFactory.interface.parseLog(log)
          return parsed && parsed.name === 'FactoryOperation'
        } catch {
          return false
        }
      })

      if (!event) throw new Error('Event failed')

      const parsedEvent = campaignContractFactory.interface.parseLog(event)
      if (!parsedEvent) throw new Error('Event failed')

      const campaignAddress = parsedEvent.args[1]

      const Campaign = await ethers.getContractFactory('Campaign')
      const campaign = Campaign.attach(campaignAddress) as unknown as Campaign

      expect(await campaign.campaignToken()).to.equal(
        ethers.getAddress(await wbtc.getAddress())
      )
    })

    it('Should allow platform admin to remove token from tokenRegistry', async function () {
      const {
        tokenRegistry,
        campaignContractFactory,
        creator1,
        deployer,
        usdc
      } = await loadFixture(deployPlatformFixture)

      const usdcDecimals = await usdc.decimals()
      const usdcMinimumContribution = ethers.parseUnits('1', usdcDecimals)

      const CAMPAIGN_GOAL = ethers.parseUnits('500', usdcDecimals)
      const CAMPAIGN_DURATION = 60

      await expect(
        tokenRegistry.connect(deployer).removeToken(await usdc.getAddress())
      )
        .to.emit(tokenRegistry, 'TokenRegistryOperation')
        .withArgs(
          OP_TOKEN_REMOVED,
          ethers.getAddress(await usdc.getAddress()),
          0,
          0
        )

      await expect(
        campaignContractFactory
          .connect(creator1)
          .deploy(await usdc.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)
      )
        .to.be.revertedWithCustomError(campaignContractFactory, 'FactoryError')
        .withArgs(
          ERR_CAMPAIGN_CONSTRUCTOR_VALIDATION_FAILED,
          ethers.ZeroAddress,
          0
        )
    })

    it('Should allow platform admin to toggle token support', async function () {
      const {
        tokenRegistry,
        deployer,
        creator1,
        usdc,
        campaignContractFactory
      } = await loadFixture(deployPlatformFixture)

      const usdcDecimals = await usdc.decimals()

      const CAMPAIGN_GOAL = ethers.parseUnits('500', usdcDecimals)
      const CAMPAIGN_DURATION = 60

      await expect(
        tokenRegistry
          .connect(deployer)
          .disableTokenSupport(await usdc.getAddress())
      )
        .to.emit(tokenRegistry, 'TokenRegistryOperation')
        .withArgs(
          OP_TOKEN_SUPPORT_DISABLED,
          ethers.getAddress(await usdc.getAddress()),
          0,
          0
        )

      expect(await tokenRegistry.isTokenSupported(await usdc.getAddress())).to
        .be.false

      await expect(
        campaignContractFactory
          .connect(creator1)
          .deploy(await usdc.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)
      )
        .to.be.revertedWithCustomError(campaignContractFactory, 'FactoryError')
        .withArgs(
          ERR_CAMPAIGN_CONSTRUCTOR_VALIDATION_FAILED,
          ethers.ZeroAddress,
          0
        )

      await expect(
        tokenRegistry
          .connect(deployer)
          .enableTokenSupport(await usdc.getAddress())
      )
        .to.emit(tokenRegistry, 'TokenRegistryOperation')
        .withArgs(
          OP_TOKEN_SUPPORT_ENABLED,
          ethers.getAddress(await usdc.getAddress()),
          0,
          0
        )

      expect(await tokenRegistry.isTokenSupported(await usdc.getAddress())).to
        .be.true

      await expect(
        campaignContractFactory
          .connect(creator1)
          .deploy(await usdc.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)
      )
        .to.emit(campaignContractFactory, 'FactoryOperation')
        .withArgs(OP_CAMPAIGN_CREATED, anyValue, anyValue, anyValue)
    })
  })

  describe('Pause Functionality Tests', function () {
    // Define constants for error codes and operation types
    const OP_PAUSED = 1
    const OP_UNPAUSED = 2

    it('Should allow platform admin to pause and unpause the platform', async function () {
      const { platformAdmin, deployer, defiIntegrationManager } =
        await loadFixture(deployPlatformFixture)

      // Verify initial state is not paused
      expect(await defiIntegrationManager.paused()).to.be.false

      // Pause the platform and verify event emission
      await expect(defiIntegrationManager.connect(deployer).pause())
        .to.emit(defiIntegrationManager, 'PauseOperation')
        .withArgs(OP_PAUSED, deployer.address, anyValue)

      // Verify the platform is paused
      expect(await defiIntegrationManager.paused()).to.be.true

      // Unpause the platform and verify event emission
      await expect(defiIntegrationManager.connect(deployer).unpause())
        .to.emit(defiIntegrationManager, 'PauseOperation')
        .withArgs(OP_UNPAUSED, deployer.address, anyValue)

      // Verify the platform is not paused
      expect(await defiIntegrationManager.paused()).to.be.false
    })

    it('Should prevent non-admin from pausing the platform', async function () {
      const { creator1, defiIntegrationManager } = await loadFixture(
        deployPlatformFixture
      )

      // Attempt to pause as non-admin should fail
      await expect(defiIntegrationManager.connect(creator1).pause())
        .to.be.revertedWithCustomError(
          defiIntegrationManager,
          'NotAuthorizedAdmin'
        )
        .withArgs(creator1.address)
    })

    it('Should prevent deposits to yield protocol when platform is paused', async function () {
      const { campaign, usdc, deployer, defiIntegrationManager, contributor1 } =
        await loadFixture(deployPlatformFixture)

      // Pause the platform
      await defiIntegrationManager.connect(deployer).pause()

      const usdcDecimals = await usdc.decimals()
      const depositAmount = ethers.parseUnits('100', usdcDecimals)

      // Approve tokens for deposit
      await usdc
        .connect(contributor1)
        .approve(defiIntegrationManager.getAddress(), depositAmount)

      // Attempt to deposit while paused should fail

      await expect(
        defiIntegrationManager
          .connect(contributor1)
          .depositToYieldProtocol(
            await usdc.getAddress(),
            depositAmount,
            await campaign.campaignId()
          )
      ).to.be.revertedWithCustomError(defiIntegrationManager, 'EnforcedPause')

      // Unpause and try again - should succeed
      await defiIntegrationManager.connect(deployer).unpause()

      await expect(
        defiIntegrationManager
          .connect(contributor1)
          .depositToYieldProtocol(
            await usdc.getAddress(),
            depositAmount,
            await campaign.campaignId()
          )
      ).to.not.be.reverted
    })

    it('Should prevent withdrawals from yield protocol when platform is paused', async function () {
      const {
        usdc,
        deployer,
        defiIntegrationManager,
        contributor1,
        IERC20ABI,
        campaign
      } = await loadFixture(deployPlatformFixture)

      const usdcDecimals = await usdc.decimals()
      const depositAmount = ethers.parseUnits('100', usdcDecimals)

      // First deposit some tokens
      await usdc
        .connect(contributor1)
        .approve(defiIntegrationManager.getAddress(), depositAmount)
      await defiIntegrationManager
        .connect(contributor1)
        .depositToYieldProtocol(
          await usdc.getAddress(),
          depositAmount,
          await campaign.campaignId()
        )

      const aTokenAddress = await defiIntegrationManager.getATokenAddress(
        await usdc.getAddress()
      )

      const aToken = (await ethers.getContractAt(
        IERC20ABI,
        aTokenAddress
      )) as unknown as IERC20Metadata

      // Pause the platform
      await defiIntegrationManager.connect(deployer).pause()

      // Attempt to withdraw while paused should fail
      await expect(
        defiIntegrationManager
          .connect(contributor1)
          .withdrawFromYieldProtocol(
            await usdc.getAddress(),
            true,
            depositAmount,
            await campaign.campaignId()
          )
      ).to.be.revertedWithCustomError(defiIntegrationManager, 'EnforcedPause')

      // Unpause and try again - should succeed
      await defiIntegrationManager.connect(deployer).unpause()

      //Have to transfer atokens since this is not a platform workflow (never would call this function on it's own)
      await aToken
        .connect(contributor1)
        .transfer(
          await defiIntegrationManager.getAddress(),
          await aToken.balanceOf(contributor1.address)
        )

      await expect(
        defiIntegrationManager
          .connect(contributor1)
          .withdrawFromYieldProtocol(
            await usdc.getAddress(),
            true,
            depositAmount,
            await campaign.campaignId()
          )
      ).to.not.be.reverted
    })

    it('Should prevent campaign contributions when platform is paused', async function () {
      const {
        usdc,
        deployer,
        campaignContractFactory,
        creator1,
        contributor1,
        defiIntegrationManager
      } = await loadFixture(deployPlatformFixture)

      // Deploy a campaign
      const usdcDecimals = await usdc.decimals()
      const CAMPAIGN_GOAL = ethers.parseUnits('500', usdcDecimals)
      const CAMPAIGN_DURATION = 60

      const tx = await campaignContractFactory
        .connect(creator1)
        .deploy(await usdc.getAddress(), CAMPAIGN_GOAL, CAMPAIGN_DURATION)

      const receipt = await tx.wait()
      if (!receipt) throw new Error('Transaction failed')
      const event = receipt.logs.find(log => {
        try {
          const parsed = campaignContractFactory.interface.parseLog(log)
          return parsed && parsed.name === 'FactoryOperation'
        } catch {
          return false
        }
      })
      if (!event) throw new Error('Event failed')

      const parsedEvent = campaignContractFactory.interface.parseLog(event)
      if (!parsedEvent) throw new Error('Event failed')

      const campaignAddress = parsedEvent.args[1]

      const Campaign = await ethers.getContractFactory('Campaign')
      const campaign = Campaign.attach(campaignAddress) as unknown as Campaign

      // Pause the platform
      await defiIntegrationManager.connect(deployer).pause()

      // Try to contribute while platform is paused
      const contributionAmount = ethers.parseUnits('100', usdcDecimals)
      await usdc
        .connect(contributor1)
        .approve(campaignAddress, contributionAmount)

      // Since the Campaign contract doesn't have the pause directly,
      // the contribution will fail when it tries to call defiIntegrationManager
      await expect(
        campaign.connect(contributor1).contribute(contributionAmount)
      ).to.be.revertedWithCustomError(campaign, 'EnforcedPause')

      // Unpause and verify contributions work again
      await defiIntegrationManager.connect(deployer).unpause()

      await expect(
        campaign.connect(contributor1).contribute(contributionAmount)
      ).to.not.be.reverted
    })

    it('Should still allow admin functions while paused for emergency handling', async function () {
      const {
        deployer,
        defiIntegrationManager,
        tokenRegistry,
        usdc,
        feeManager
      } = await loadFixture(deployPlatformFixture)

      // Pause the platform
      await defiIntegrationManager.connect(deployer).pause()

      // Function that should still work - updating token registry
      await expect(
        defiIntegrationManager
          .connect(deployer)
          .setTokenRegistry(await tokenRegistry.getAddress())
      ).to.not.be.reverted

      // Function that should still work - updating fee manager
      await expect(
        defiIntegrationManager
          .connect(deployer)
          .setFeeManager(await feeManager.getAddress())
      ).to.not.be.reverted
    })

    it('Should allow view functions while platform is paused', async function () {
      const { deployer, defiIntegrationManager, usdc } = await loadFixture(
        deployPlatformFixture
      )

      // Pause the platform
      await defiIntegrationManager.connect(deployer).pause()

      const yieldRate = await defiIntegrationManager.getCurrentYieldRate(
        await usdc.getAddress()
      )
      expect(typeof yieldRate.toString()).to.equal('string')

      const aTokenAddress = await defiIntegrationManager.getATokenAddress(
        await usdc.getAddress()
      )
      expect(ethers.isAddress(aTokenAddress)).to.be.true

      const treasuryAddress = await defiIntegrationManager.getPlatformTreasury()
      expect(ethers.isAddress(treasuryAddress)).to.be.true
    })
  })
})
