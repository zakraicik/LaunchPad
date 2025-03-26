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
    const OP_CAMPAIGN_CREATED = 1
    const OP_DEPOSIT = 1
    const OP_CLAIM_FUNDS = 2
    const ERR_FUNDS_CLAIMED = 12
    const ERR_ALREADY_REFUNDED = 10
    const ERR_GOAL_REACHED = 8
    const OP_SHARE_UPDATED = 2

    it('Deploy supporting contracts and set initial state correctly', async function () {
      const {
        deployer,
        platformTreasury,
        platformAdmin,
        tokenRegistry,
        yieldDistributor,
        defiIntegrationManager,
        campaignContractFactory,
        AAVE_POOL_ADDRESS,
        GRACE_PERIOD
      } = await loadFixture(deployPlatformFixture)

      //PlatformAdmin
      expect(await platformAdmin.owner()).to.equal(deployer.address)
      expect(await platformAdmin.gracePeriod()).to.equal(GRACE_PERIOD)

      //TokenRegistry
      expect(await tokenRegistry.owner()).to.equal(deployer.address)
      expect(await tokenRegistry.platformAdmin()).to.equal(
        await platformAdmin.getAddress()
      )

      //YieldDistributor
      expect(await yieldDistributor.owner()).to.equal(deployer.address)
      expect(await yieldDistributor.platformTreasury()).to.equal(
        platformTreasury.address
      )
      expect(await yieldDistributor.platformAdmin()).to.equal(
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
      expect(await defiIntegrationManager.yieldDistributor()).to.equal(
        ethers.getAddress(await yieldDistributor.getAddress())
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
      expect(await campaignContractFactory.deployedCampaigns(1)).to.equal(
        campaignAddress
      )
      expect(
        await campaignContractFactory.creatorToCampaigns(creator1.address, 1)
      ).to.equal(campaignAddress)

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
        IERC20ABI
      } = await loadFixture(deployPlatformFixture)

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

      await usdc
        .connect(contributor1)
        .approve(campaignAddress, contributionAmount)

      const contributeTx1 = await campaign
        .connect(contributor1)
        .contribute(await usdc.getAddress(), contributionAmount)

      if (!contributeTx1) throw new Error('Transaction failed')

      const contributeReceipt1 = await contributeTx1.wait()
      if (!contributeReceipt1) throw new Error('Transaction failed')

      const contributionEvent = contributeReceipt1.logs.find(log => {
        try {
          const parsed = campaign.interface.parseLog(log)
          return parsed && parsed.name === 'Contribution'
        } catch {
          return false
        }
      })

      if (!contributionEvent) throw new Error('Event failed')

      const parsedContributionEvent =
        campaign.interface.parseLog(contributionEvent)
      if (!parsedContributionEvent) throw new Error('Event failed')

      expect(parsedContributionEvent.args.contributor).to.equal(
        contributor1.address
      )
      expect(parsedContributionEvent.args.amount).to.equal(contributionAmount)

      expect(await campaign.isContributor(contributor1.address)).to.be.true
      expect(await campaign.contributorsCount()).to.equal(1)

      const aaveDepositEvent = contributeReceipt1.logs.find(log => {
        try {
          const parsed = campaign.interface.parseLog(log)
          return parsed && parsed.name === 'FundsOperation'
        } catch {
          return false
        }
      })

      if (!aaveDepositEvent) throw new Error('Event failed')

      const parsedAaveDepositEvent =
        campaign.interface.parseLog(aaveDepositEvent)
      if (!parsedAaveDepositEvent) throw new Error('Event failed')

      expect(parsedAaveDepositEvent.args[0]).to.equal(
        ethers.getAddress(await usdc.getAddress())
      )
      expect(parsedAaveDepositEvent.args[1]).to.equal(contributionAmount)
      expect(parsedAaveDepositEvent.args[2]).to.equal(OP_DEPOSIT)
      expect(parsedAaveDepositEvent.args[3]).to.equal(contributor1.address)

      const aTokenAddress = await defiIntegrationManager.getATokenAddress(
        await usdc.getAddress()
      )

      let aToken: IERC20Metadata

      aToken = (await ethers.getContractAt(
        IERC20ABI,
        aTokenAddress
      )) as unknown as IERC20Metadata

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

      await campaign
        .connect(contributor1)
        .contribute(await usdc.getAddress(), contributionAmount1)

      // Second contribution (different contributor)
      const contributionAmount2 = ethers.parseUnits('150', usdcDecimals)
      await usdc
        .connect(contributor2)
        .approve(campaignAddress, contributionAmount2)

      await campaign
        .connect(contributor2)
        .contribute(await usdc.getAddress(), contributionAmount2)

      // Third contribution (first contributor again)
      const contributionAmount3 = ethers.parseUnits('75', usdcDecimals)
      await usdc
        .connect(contributor1)
        .approve(campaignAddress, contributionAmount3)

      await campaign
        .connect(contributor1)
        .contribute(await usdc.getAddress(), contributionAmount3)

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
        yieldDistributor
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

      await campaign
        .connect(contributor1)
        .contribute(await usdc.getAddress(), contributionAmount1)

      // Second contribution (different contributor)
      const contributionAmount2 = ethers.parseUnits('150', usdcDecimals)
      await usdc
        .connect(contributor2)
        .approve(campaignAddress, contributionAmount2)

      await campaign
        .connect(contributor2)
        .contribute(await usdc.getAddress(), contributionAmount2)

      // Third contribution (first contributor again)
      const contributionAmount3 = ethers.parseUnits('220', usdcDecimals)
      await usdc
        .connect(contributor1)
        .approve(campaignAddress, contributionAmount3)

      await campaign
        .connect(contributor1)
        .contribute(await usdc.getAddress(), contributionAmount3)

      expect(await campaign.isCampaignSuccessful()).to.be.true

      await network.provider.send('evm_increaseTime', [
        60 * 60 * 24 * (CAMPAIGN_DURATION + 1)
      ]) // 30 days

      await network.provider.send('evm_mine')

      expect(await campaign.isCampaignActive()).to.be.false

      const aTokenAddress = await defiIntegrationManager.getATokenAddress(
        await usdc.getAddress()
      )

      let aToken: IERC20Metadata

      aToken = (await ethers.getContractAt(
        IERC20ABI,
        aTokenAddress
      )) as unknown as IERC20Metadata

      const aTokenBalance = await aToken.balanceOf(campaignAddress)

      const claimFundsTx = await campaign.connect(creator1).claimFunds()
      const claimFundsReceipt = await claimFundsTx.wait()
      if (!claimFundsReceipt) throw new Error('Transaction failed')

      const claimFundsEvent = claimFundsReceipt.logs.find(log => {
        try {
          const parsed = campaign.interface.parseLog(log)
          return parsed && parsed.name === 'FundsOperation'
        } catch {
          return false
        }
      })

      if (!claimFundsEvent) throw new Error('Event failed')

      const parsedClaimFundsEvent = campaign.interface.parseLog(claimFundsEvent)
      if (!parsedClaimFundsEvent) throw new Error('Event failed')

      expect(parsedClaimFundsEvent.args[0]).to.equal(
        ethers.getAddress(await usdc.getAddress())
      )
      expect(parsedClaimFundsEvent.args[1]).to.be.closeTo(aTokenBalance, 10)
      expect(parsedClaimFundsEvent.args[2]).to.equal(OP_CLAIM_FUNDS)
      expect(parsedClaimFundsEvent.args[3]).to.equal(creator1.address)

      const [creatorShare, platformShare] =
        await yieldDistributor.calculateYieldShares(aTokenBalance)

      expect(await usdc.balanceOf(creator1.address)).to.be.closeTo(
        creatorShare,
        10
      )

      expect(
        await usdc.balanceOf(await yieldDistributor.platformTreasury())
      ).to.be.closeTo(platformShare, 10)

      await expect(campaign.connect(creator1).claimFunds())
        .to.be.revertedWithCustomError(campaign, 'CampaignError')
        .withArgs(ERR_FUNDS_CLAIMED, ethers.ZeroAddress, 0)

      await expect(campaign.connect(contributor1).requestRefund())
        .to.be.revertedWithCustomError(campaign, 'CampaignError')
        .withArgs(
          ERR_GOAL_REACHED,
          ethers.ZeroAddress,
          await campaign.totalAmountRaised()
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
        yieldDistributor
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

      await campaign
        .connect(contributor1)
        .contribute(await usdc.getAddress(), contributionAmount1)

      // Second contribution (different contributor)
      const contributionAmount2 = ethers.parseUnits('150', usdcDecimals)
      await usdc
        .connect(contributor2)
        .approve(campaignAddress, contributionAmount2)

      await campaign
        .connect(contributor2)
        .contribute(await usdc.getAddress(), contributionAmount2)

      // Third contribution (first contributor again)
      const contributionAmount3 = ethers.parseUnits('130', usdcDecimals)
      await usdc
        .connect(contributor1)
        .approve(campaignAddress, contributionAmount3)

      await campaign
        .connect(contributor1)
        .contribute(await usdc.getAddress(), contributionAmount3)

      expect(await campaign.isCampaignSuccessful()).to.be.false

      await network.provider.send('evm_increaseTime', [
        60 * 60 * 24 * (CAMPAIGN_DURATION + 1)
      ]) // 30 days

      await network.provider.send('evm_mine')

      expect(await campaign.isCampaignActive()).to.be.false

      const aTokenAddress = await defiIntegrationManager.getATokenAddress(
        await usdc.getAddress()
      )

      let aToken: IERC20Metadata

      aToken = (await ethers.getContractAt(
        IERC20ABI,
        aTokenAddress
      )) as unknown as IERC20Metadata

      const aTokenBalance = await aToken.balanceOf(campaignAddress)

      const claimFundsTx = await campaign.connect(creator1).claimFunds()
      const claimFundsReceipt = await claimFundsTx.wait()
      if (!claimFundsReceipt) throw new Error('Transaction failed')

      const claimFundsEvent = claimFundsReceipt.logs.find(log => {
        try {
          const parsed = campaign.interface.parseLog(log)
          return parsed && parsed.name === 'FundsOperation'
        } catch {
          return false
        }
      })

      if (!claimFundsEvent) throw new Error('Event failed')

      const parsedClaimFundsEvent = campaign.interface.parseLog(claimFundsEvent)
      if (!parsedClaimFundsEvent) throw new Error('Event failed')

      expect(parsedClaimFundsEvent.args[0]).to.equal(
        ethers.getAddress(await usdc.getAddress())
      )
      expect(parsedClaimFundsEvent.args[1]).to.be.closeTo(aTokenBalance, 10)
      expect(parsedClaimFundsEvent.args[2]).to.equal(OP_CLAIM_FUNDS)
      expect(parsedClaimFundsEvent.args[3]).to.equal(creator1.address)

      const forRefunds = await campaign.totalAmountRaised()

      expect(await usdc.balanceOf(creator1.address)).to.equal(0)

      expect(await usdc.balanceOf(campaignAddress)).to.equal(forRefunds)

      expect(
        await usdc.balanceOf(await yieldDistributor.platformTreasury())
      ).to.be.closeTo(aTokenBalance - forRefunds, 10)

      await expect(campaign.connect(creator1).claimFunds())
        .to.be.revertedWithCustomError(campaign, 'CampaignError')
        .withArgs(ERR_FUNDS_CLAIMED, ethers.ZeroAddress, 0)
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
        yieldDistributor
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

      await campaign
        .connect(contributor1)
        .contribute(await usdc.getAddress(), contributionAmount1)

      // Second contribution (different contributor)
      const contributionAmount2 = ethers.parseUnits('150', usdcDecimals)
      await usdc
        .connect(contributor2)
        .approve(campaignAddress, contributionAmount2)

      await campaign
        .connect(contributor2)
        .contribute(await usdc.getAddress(), contributionAmount2)

      // Third contribution (first contributor again)
      const contributionAmount3 = ethers.parseUnits('130', usdcDecimals)
      await usdc
        .connect(contributor1)
        .approve(campaignAddress, contributionAmount3)

      await campaign
        .connect(contributor1)
        .contribute(await usdc.getAddress(), contributionAmount3)

      await network.provider.send('evm_increaseTime', [
        60 * 60 * 24 * (CAMPAIGN_DURATION + 1)
      ]) // 30 days

      await network.provider.send('evm_mine')

      const aTokenAddress = await defiIntegrationManager.getATokenAddress(
        await usdc.getAddress()
      )

      let aToken: IERC20Metadata

      aToken = (await ethers.getContractAt(
        IERC20ABI,
        aTokenAddress
      )) as unknown as IERC20Metadata

      const aTokenBalance = await aToken.balanceOf(campaignAddress)

      await campaign.connect(creator1).claimFunds()

      const forRefunds = await campaign.totalAmountRaised()

      expect(await usdc.balanceOf(campaignAddress)).to.be.closeTo(forRefunds, 5)
      expect(
        await usdc.balanceOf(await yieldDistributor.platformTreasury())
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

      const refund1Tx = await campaign.connect(contributor1).requestRefund()
      const refund1Receipt = await refund1Tx.wait()
      if (!refund1Receipt) throw new Error('Transaction failed')

      const refundEvent1 = refund1Receipt.logs.find(log => {
        try {
          const parsed = campaign.interface.parseLog(log)
          return parsed && parsed.name === 'RefundIssued'
        } catch {
          return false
        }
      })

      if (!refundEvent1) throw new Error('RefundIssued event not found')

      const parsedRefundEvent1 = campaign.interface.parseLog(refundEvent1)
      if (!parsedRefundEvent1) throw new Error('RefundIssued event failed')

      expect(parsedRefundEvent1.args[0]).to.equal(contributor1.address)
      expect(parsedRefundEvent1.args[1]).to.equal(contributor1Contribution)

      expect(await campaign.hasBeenRefunded(contributor1.address)).to.be.true
      expect(await usdc.balanceOf(contributor1.address)).to.be.closeTo(
        contributor1Contribution + originalContributor1USDCBalance,
        5
      )

      expect(await usdc.balanceOf(campaignAddress)).to.be.closeTo(
        forRefunds - contributor1Contribution,
        5
      )

      const refund2Tx = await campaign.connect(contributor2).requestRefund()
      const refund2Receipt = await refund2Tx.wait()
      if (!refund2Receipt) throw new Error('Transaction failed')

      const refundEvent2 = refund2Receipt.logs.find(log => {
        try {
          const parsed = campaign.interface.parseLog(log)
          return parsed && parsed.name === 'RefundIssued'
        } catch {
          return false
        }
      })

      if (!refundEvent2) throw new Error('RefundIssued event not found')

      const parsedRefundEvent2 = campaign.interface.parseLog(refundEvent2)
      if (!parsedRefundEvent2) throw new Error('RefundIssued event failed')

      expect(parsedRefundEvent2.args[0]).to.equal(contributor2.address)
      expect(parsedRefundEvent2.args[1]).to.equal(contributor2Contribution)

      expect(await campaign.hasBeenRefunded(contributor1.address)).to.be.true
      expect(await usdc.balanceOf(contributor2.address)).to.be.closeTo(
        contributor2Contribution + originalContributor2USDCBalance,
        5
      )

      expect(await usdc.balanceOf(campaignAddress)).to.equal(0)

      await expect(campaign.connect(contributor1).requestRefund())
        .to.be.revertedWithCustomError(campaign, 'CampaignError')
        .withArgs(ERR_ALREADY_REFUNDED, contributor1.address, 0)

      await expect(campaign.connect(contributor2).requestRefund())
        .to.be.revertedWithCustomError(campaign, 'CampaignError')
        .withArgs(ERR_ALREADY_REFUNDED, contributor2.address, 0)
    })

    it('Should allow platform admin to claim funds after grace period', async function () {
      const {
        usdc,
        campaignContractFactory,
        creator1,
        contributor1,
        contributor2,
        defiIntegrationManager,
        IERC20ABI,
        deployer,
        yieldDistributor,
        GRACE_PERIOD
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

      await campaign
        .connect(contributor1)
        .contribute(await usdc.getAddress(), contributionAmount1)

      // Second contribution (different contributor)
      const contributionAmount2 = ethers.parseUnits('150', usdcDecimals)
      await usdc
        .connect(contributor2)
        .approve(campaignAddress, contributionAmount2)

      await campaign
        .connect(contributor2)
        .contribute(await usdc.getAddress(), contributionAmount2)

      // Third contribution (first contributor again)
      const contributionAmount3 = ethers.parseUnits('130', usdcDecimals)
      await usdc
        .connect(contributor1)
        .approve(campaignAddress, contributionAmount3)

      await campaign
        .connect(contributor1)
        .contribute(await usdc.getAddress(), contributionAmount3)

      expect(await campaign.isCampaignSuccessful()).to.be.false

      await network.provider.send('evm_increaseTime', [
        60 * 60 * 24 * (CAMPAIGN_DURATION + GRACE_PERIOD + 1)
      ])

      await network.provider.send('evm_mine')

      expect(await campaign.isCampaignActive()).to.be.false

      const aTokenAddress = await defiIntegrationManager.getATokenAddress(
        await usdc.getAddress()
      )

      let aToken: IERC20Metadata

      aToken = (await ethers.getContractAt(
        IERC20ABI,
        aTokenAddress
      )) as unknown as IERC20Metadata

      const aTokenBalance = await aToken.balanceOf(campaignAddress)

      const claimFundsTx = await campaign.connect(deployer).claimFundsAdmin()
      const claimFundsReceipt = await claimFundsTx.wait()
      if (!claimFundsReceipt) throw new Error('Transaction failed')

      const claimFundsEvent = claimFundsReceipt.logs.find(log => {
        try {
          const parsed = campaign.interface.parseLog(log)
          return parsed && parsed.name === 'FundsOperation'
        } catch {
          return false
        }
      })

      if (!claimFundsEvent) throw new Error('Event failed')

      const parsedClaimFundsEvent = campaign.interface.parseLog(claimFundsEvent)
      if (!parsedClaimFundsEvent) throw new Error('Event failed')

      expect(parsedClaimFundsEvent.args[0]).to.equal(
        ethers.getAddress(await usdc.getAddress())
      )
      expect(parsedClaimFundsEvent.args[1]).to.be.closeTo(aTokenBalance, 10)
      expect(parsedClaimFundsEvent.args[2]).to.equal(OP_CLAIM_FUNDS)
      expect(parsedClaimFundsEvent.args[3]).to.equal(deployer.address)

      const forRefunds = await campaign.totalAmountRaised()

      expect(await usdc.balanceOf(creator1.address)).to.equal(0)

      expect(await usdc.balanceOf(campaignAddress)).to.equal(forRefunds)

      expect(
        await usdc.balanceOf(await yieldDistributor.platformTreasury())
      ).to.be.closeTo(aTokenBalance - forRefunds, 10)

      await expect(campaign.connect(deployer).claimFundsAdmin())
        .to.be.revertedWithCustomError(campaign, 'CampaignError')
        .withArgs(ERR_FUNDS_CLAIMED, ethers.ZeroAddress, 0)
    })

    it('Should prevent platform admin to claim funds before grace period is over (non emergency)', async function () {
      const {
        usdc,
        campaignContractFactory,
        creator1,
        contributor1,
        contributor2,
        defiIntegrationManager,
        IERC20ABI,
        deployer,
        yieldDistributor,
        GRACE_PERIOD
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

      await campaign
        .connect(contributor1)
        .contribute(await usdc.getAddress(), contributionAmount1)

      // Second contribution (different contributor)
      const contributionAmount2 = ethers.parseUnits('150', usdcDecimals)
      await usdc
        .connect(contributor2)
        .approve(campaignAddress, contributionAmount2)

      await campaign
        .connect(contributor2)
        .contribute(await usdc.getAddress(), contributionAmount2)

      // Third contribution (first contributor again)
      const contributionAmount3 = ethers.parseUnits('130', usdcDecimals)
      await usdc
        .connect(contributor1)
        .approve(campaignAddress, contributionAmount3)

      await campaign
        .connect(contributor1)
        .contribute(await usdc.getAddress(), contributionAmount3)

      expect(await campaign.isCampaignSuccessful()).to.be.false

      await network.provider.send('evm_increaseTime', [
        60 * 60 * 24 * CAMPAIGN_DURATION
      ])

      await network.provider.send('evm_mine')

      // Using ethers provider directly
      const currentBlock = await ethers.provider.getBlock('latest')
      if (!currentBlock) throw new Error('Current block not found')
      const currentTimestamp = currentBlock.timestamp

      const campaignEndTime = await campaign.campaignEndTime()
      const gracePeriodEnd =
        Number(campaignEndTime) + Number(GRACE_PERIOD * 24 * 60 * 60)

      const timeRemainingUntilGracePeriodEnds =
        gracePeriodEnd - currentTimestamp

      expect(await campaign.isCampaignActive()).to.be.false

      const aTokenAddress = await defiIntegrationManager.getATokenAddress(
        await usdc.getAddress()
      )

      let aToken: IERC20Metadata

      aToken = (await ethers.getContractAt(
        IERC20ABI,
        aTokenAddress
      )) as unknown as IERC20Metadata

      const aTokenBalance = await aToken.balanceOf(campaignAddress)

      //Fails with grace period
      await expect(campaign.connect(deployer).claimFundsAdmin())
        .to.be.revertedWithCustomError(campaign, 'GracePeriodNotOver')
        .withArgs(anyUint)

      const aTokenBalanceAfterFailedClaim = await aToken.balanceOf(
        campaignAddress
      )

      expect(aTokenBalanceAfterFailedClaim).to.be.closeTo(aTokenBalance, 5)

      //Admin can override; this particular campaign is unsuccesful
      await expect(campaign.connect(deployer).setAdminOverride(true))
        .to.emit(campaign, 'AdminOverrideSet')
        .withArgs(true, deployer.address)

      const forRefunds = await campaign.totalAmountRaised()

      await expect(campaign.connect(deployer).claimFundsAdmin())
        .to.emit(campaign, 'FundsOperation')
        .withArgs(
          ethers.getAddress(await usdc.getAddress()),
          anyUint,
          OP_CLAIM_FUNDS,
          deployer.address
        )

      expect(await usdc.balanceOf(creator1.address)).to.equal(0)

      expect(await usdc.balanceOf(campaignAddress)).to.equal(forRefunds)

      expect(
        await usdc.balanceOf(await yieldDistributor.platformTreasury())
      ).to.be.closeTo(aTokenBalanceAfterFailedClaim - forRefunds, 5)
    })
  })

  describe('Token Integration', function () {
    const ERR_NOT_TARGET_TOKEN = 13
    const ERR_INVALID_AMOUNT = 5
    const ERR_TOKEN_NOT_SUPPORTED = 2
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
        campaign
          .connect(contributor1)
          .contribute(await wbtc.getAddress(), contributionAmount)
      )
        .to.be.revertedWithCustomError(campaign, 'CampaignError')
        .withArgs(
          ERR_NOT_TARGET_TOKEN,
          ethers.getAddress(await wbtc.getAddress()),
          0
        )

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
        campaign
          .connect(contributor1)
          .contribute(await usdc.getAddress(), contributionAmount)
      ).to.be.revertedWith('ERC20: transfer amount exceeds allowance')

      expect(await campaign.totalAmountRaised()).to.equal(0)
    })

    it('Should revert for contribution with zero amount', async function () {
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

      const contributionAmount = ethers.parseUnits('0', usdcDecimals)

      await wbtc
        .connect(contributor1)
        .approve(campaignAddress, contributionAmount)

      await expect(
        campaign
          .connect(contributor1)
          .contribute(await usdc.getAddress(), contributionAmount)
      )
        .to.be.revertedWithCustomError(campaign, 'CampaignError')
        .withArgs(
          ERR_INVALID_AMOUNT,
          ethers.getAddress(await usdc.getAddress()),
          0
        )

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
          ERR_TOKEN_NOT_SUPPORTED,
          ethers.getAddress(await wbtc.getAddress()),
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
          ERR_TOKEN_NOT_SUPPORTED,
          ethers.getAddress(await usdc.getAddress()),
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
          ERR_TOKEN_NOT_SUPPORTED,
          ethers.getAddress(await usdc.getAddress()),
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
})
