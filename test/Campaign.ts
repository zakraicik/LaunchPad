import { token } from '../typechain-types/@openzeppelin/contracts'
import { Campaign } from '../typechain-types/contracts/Campaign'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { deployPlatformFixture } from './fixture'

import {
  anyUint,
  anyValue
} from '@nomicfoundation/hardhat-chai-matchers/withArgs'

describe('Campaign', function () {
  // Operation types for FundsOperation event
  const OP_DEPOSIT = 1
  const OP_CLAIM_FUNDS = 2

  // Error codes - more specific but still compact
  const ERR_INVALID_ADDRESS = 1
  const ERR_TOKEN_NOT_SUPPORTED = 2
  const ERR_INVALID_GOAL = 3
  const ERR_INVALID_DURATION = 4
  const ERR_INVALID_AMOUNT = 5
  const ERR_CAMPAIGN_NOT_ACTIVE = 6
  const ERR_CAMPAIGN_STILL_ACTIVE = 7
  const ERR_GOAL_REACHED = 8
  const ERR_ETH_NOT_ACCEPTED = 9
  const ERR_ALREADY_REFUNDED = 10
  const ERR_NOTHING_TO_REFUND = 11
  const ERR_FUNDS_CLAIMED = 12
  const ERR_NOT_TARGET_TOKEN = 13
  const ERR_NOTHING_TO_WITHDRAW = 14
  const ERR_FUNDS_NOT_CLAIMED = 15
  const ERR_ADMIN_OVERRIDE_ACTIVE = 16

  const CAMPAIGN_GOAL_AMOUNT = ethers.parseUnits('1000', 6) //Hardcoded USDC decimals
  const CAMPAIGN_DURATION = 30

  describe('Deployment', function () {
    it('should deploy all contracts successfully', async function () {
      const { campaign } = await loadFixture(deployPlatformFixture)

      expect(await campaign.getAddress()).to.be.properAddress
    })

    it('Should correctly set the initial state', async function () {
      const {
        campaign,
        creator1, //Owner of campaign deployed in fixture
        usdc
      } = await loadFixture(deployPlatformFixture)

      const usdcAddress = await usdc.getAddress()
      const usdcDecimals = await usdc.decimals()

      const startTime = await campaign.campaignStartTime()
      const endTime = await campaign.campaignEndTime()

      const latestBlock = await ethers.provider.getBlock('latest')

      if (!latestBlock) {
        throw new Error('Latest block does not exist')
      }
      const currentTimestamp = latestBlock.timestamp

      expect(startTime).to.be.closeTo(currentTimestamp, 10)

      const expectedEndTime =
        startTime + BigInt(CAMPAIGN_DURATION * 24 * 60 * 60)

      expect(endTime).to.equal(expectedEndTime)

      expect(await campaign.owner()).to.equal(creator1.address)
      expect(await campaign.campaignToken()).to.equal(
        ethers.getAddress(usdcAddress)
      )
      expect(await campaign.campaignGoalAmount()).to.equal(CAMPAIGN_GOAL_AMOUNT)
      expect(await campaign.campaignDuration()).to.equal(CAMPAIGN_DURATION)

      const campaignId = await campaign.campaignId()

      expect(campaignId).to.not.equal(ethers.ZeroHash)

      const secondCheck = await campaign.campaignId()
      expect(campaignId).to.equal(secondCheck)
    })

    it('Should revert if invalid inputs are passed to constructor', async function () {
      const { creator1, platformAdmin, usdc, wbtc, defiIntegrationManager } =
        await loadFixture(deployPlatformFixture)

      const usdcAddress = await usdc.getAddress()
      const usdcDecimals = await usdc.decimals()
      const wbtcAddress = await wbtc.getAddress()
      const defiManagerAddress = await defiIntegrationManager.getAddress()
      const platformAdminAddress = await platformAdmin.getAddress()

      const CampaignContractFactory = await ethers.getContractFactory(
        'Campaign'
      )

      await expect(
        CampaignContractFactory.deploy(
          creator1.address,
          ethers.ZeroAddress,
          CAMPAIGN_GOAL_AMOUNT,
          CAMPAIGN_DURATION,
          defiManagerAddress,
          platformAdminAddress
        )
      )
        .to.be.revertedWithCustomError(CampaignContractFactory, 'CampaignError')
        .withArgs(ERR_INVALID_ADDRESS, ethers.ZeroAddress, 0)

      await expect(
        CampaignContractFactory.deploy(
          creator1.address,
          usdcAddress,
          CAMPAIGN_GOAL_AMOUNT,
          CAMPAIGN_DURATION,
          ethers.ZeroAddress,
          platformAdminAddress
        )
      )
        .to.be.revertedWithCustomError(CampaignContractFactory, 'CampaignError')
        .withArgs(ERR_INVALID_ADDRESS, ethers.ZeroAddress, 0)

      await expect(
        CampaignContractFactory.deploy(
          creator1.address,
          wbtcAddress,
          CAMPAIGN_GOAL_AMOUNT,
          CAMPAIGN_DURATION,
          defiManagerAddress,
          platformAdminAddress
        )
      )
        .to.be.revertedWithCustomError(CampaignContractFactory, 'CampaignError')
        .withArgs(ERR_TOKEN_NOT_SUPPORTED, ethers.getAddress(wbtcAddress), 0)

      await expect(
        CampaignContractFactory.deploy(
          creator1.address,
          usdcAddress,
          ethers.parseUnits('0', usdcDecimals),
          CAMPAIGN_DURATION,
          defiManagerAddress,
          platformAdminAddress
        )
      )
        .to.be.revertedWithCustomError(CampaignContractFactory, 'CampaignError')
        .withArgs(ERR_INVALID_GOAL, ethers.ZeroAddress, 0)

      await expect(
        CampaignContractFactory.deploy(
          creator1.address,
          usdcAddress,
          CAMPAIGN_GOAL_AMOUNT,
          0,
          defiManagerAddress,
          platformAdminAddress
        )
      )
        .to.be.revertedWithCustomError(CampaignContractFactory, 'CampaignError')
        .withArgs(ERR_INVALID_DURATION, ethers.ZeroAddress, 0)

      await expect(
        CampaignContractFactory.deploy(
          creator1.address,
          usdcAddress,
          CAMPAIGN_GOAL_AMOUNT,
          366,
          defiManagerAddress,
          platformAdminAddress
        )
      )
        .to.be.revertedWithCustomError(CampaignContractFactory, 'CampaignError')
        .withArgs(ERR_INVALID_DURATION, ethers.ZeroAddress, 366)

      await expect(
        CampaignContractFactory.deploy(
          creator1.address,
          usdcAddress,
          CAMPAIGN_GOAL_AMOUNT,
          CAMPAIGN_DURATION,
          defiManagerAddress,
          ethers.ZeroAddress
        )
      )
        .to.be.revertedWithCustomError(CampaignContractFactory, 'CampaignError')
        .withArgs(ERR_INVALID_ADDRESS, ethers.ZeroAddress, 0)
    })
  })

  describe('Contributions', function () {
    it('Should allow user to contribute campaign token to an active campaign', async function () {
      const {
        campaign,
        usdc,
        contributor1,
        defiIntegrationManager,
        IERC20ABI
      } = await loadFixture(deployPlatformFixture)

      const usdcDecimals = await usdc.decimals()

      const contributionAmount = ethers.parseUnits('100', usdcDecimals)

      const aTokenAddress = await defiIntegrationManager.getATokenAddress(
        await usdc.getAddress()
      )

      const aToken = await ethers.getContractAt(IERC20ABI, aTokenAddress)

      const initialATokenBalance = await aToken.balanceOf(
        await campaign.getAddress()
      )

      await usdc
        .connect(contributor1)
        .approve(await campaign.getAddress(), contributionAmount)

      const initialContribution = await campaign.contributions(
        contributor1.address
      )
      const initialTotalRaised = await campaign.totalAmountRaised()
      const initialUSDCBalance = await usdc.balanceOf(
        await contributor1.address
      )
      expect(await campaign.isContributor(contributor1.address)).to.equal(false)
      expect(await campaign.contributorsCount()).to.equal(0)

      await expect(
        campaign
          .connect(contributor1)
          .contribute(await usdc.getAddress(), contributionAmount)
      )
        .to.emit(campaign, 'Contribution')
        .withArgs(contributor1.address, contributionAmount)

      const aTokenBalanceAfter = await aToken.balanceOf(
        await campaign.getAddress()
      )

      const USDCBalanceAfter = await usdc.balanceOf(await contributor1.address)

      expect(USDCBalanceAfter).to.equal(
        initialUSDCBalance - BigInt(contributionAmount)
      )

      expect(aTokenBalanceAfter).to.closeTo(
        initialATokenBalance + BigInt(contributionAmount),
        5
      )

      expect(await campaign.contributions(contributor1.address)).to.equal(
        initialContribution + BigInt(contributionAmount)
      )
      expect(await campaign.totalAmountRaised()).to.equal(
        initialTotalRaised + BigInt(contributionAmount)
      )

      expect(
        await defiIntegrationManager.aaveBalances(
          await usdc.getAddress(),
          await campaign.getAddress()
        )
      ).to.equal(initialATokenBalance + BigInt(contributionAmount))

      expect(await campaign.isContributor(contributor1.address)).to.equal(true)
      expect(await campaign.contributorsCount()).to.equal(1)
    })

    it('Should allow user to contribute non-whole numbers of campaign token to an active campaign', async function () {
      const {
        campaign,
        usdc,
        contributor1,
        defiIntegrationManager,
        IERC20ABI
      } = await loadFixture(deployPlatformFixture)

      const usdcDecimals = await usdc.decimals()

      const contributionAmount = ethers.parseUnits('103.123', usdcDecimals)

      const aTokenAddress = await defiIntegrationManager.getATokenAddress(
        await usdc.getAddress()
      )

      const aToken = await ethers.getContractAt(IERC20ABI, aTokenAddress)

      const initialATokenBalance = await aToken.balanceOf(
        await campaign.getAddress()
      )

      await usdc
        .connect(contributor1)
        .approve(await campaign.getAddress(), contributionAmount)

      const initialContribution = await campaign.contributions(
        contributor1.address
      )
      const initialTotalRaised = await campaign.totalAmountRaised()
      const initialUSDCBalance = await usdc.balanceOf(
        await contributor1.address
      )
      expect(await campaign.isContributor(contributor1.address)).to.equal(false)
      expect(await campaign.contributorsCount()).to.equal(0)

      await expect(
        campaign
          .connect(contributor1)
          .contribute(await usdc.getAddress(), contributionAmount)
      )
        .to.emit(campaign, 'Contribution')
        .withArgs(contributor1.address, contributionAmount)

      const aTokenBalanceAfter = await aToken.balanceOf(
        await campaign.getAddress()
      )

      const USDCBalanceAfter = await usdc.balanceOf(await contributor1.address)

      expect(USDCBalanceAfter).to.equal(
        initialUSDCBalance - BigInt(contributionAmount)
      )

      expect(aTokenBalanceAfter).to.closeTo(
        initialATokenBalance + BigInt(contributionAmount),
        5
      )

      expect(await campaign.contributions(contributor1.address)).to.equal(
        initialContribution + BigInt(contributionAmount)
      )
      expect(await campaign.totalAmountRaised()).to.equal(
        initialTotalRaised + BigInt(contributionAmount)
      )

      expect(
        await defiIntegrationManager.aaveBalances(
          await usdc.getAddress(),
          await campaign.getAddress()
        )
      ).to.equal(initialATokenBalance + BigInt(contributionAmount))

      expect(await campaign.isContributor(contributor1.address)).to.equal(true)
      expect(await campaign.contributorsCount()).to.equal(1)
    })

    it('Should correctly track contributions from multiple users', async function () {
      const {
        campaign,
        usdc,
        contributor1,
        contributor2,
        defiIntegrationManager,
        IERC20ABI
      } = await loadFixture(deployPlatformFixture)

      const usdcDecimals = await usdc.decimals()

      const contribution1Amount = ethers.parseUnits('100', usdcDecimals)
      const contribution2Amount = ethers.parseUnits('150', usdcDecimals)

      const usdcAddress = await usdc.getAddress()
      const aTokenAddress = await defiIntegrationManager.getATokenAddress(
        usdcAddress
      )
      const aToken = await ethers.getContractAt(IERC20ABI, aTokenAddress)

      // Initial state checks
      const initialATokenBalance = await aToken.balanceOf(
        await campaign.getAddress()
      )
      const initialTotalRaised = await campaign.totalAmountRaised()
      const initialContributorsCount = await campaign.contributorsCount()

      // Verify initial contributor status
      expect(await campaign.isContributor(contributor1.address)).to.be.false
      expect(await campaign.isContributor(contributor2.address)).to.be.false
      expect(await campaign.contributions(contributor1.address)).to.equal(0)
      expect(await campaign.contributions(contributor2.address)).to.equal(0)

      // First user contributes
      await usdc
        .connect(contributor1)
        .approve(await campaign.getAddress(), contribution1Amount)
      await campaign
        .connect(contributor1)
        .contribute(usdcAddress, contribution1Amount)

      // Check state after first contribution
      expect(await campaign.isContributor(contributor1.address)).to.be.true
      expect(await campaign.isContributor(contributor2.address)).to.be.false
      expect(await campaign.contributorsCount()).to.equal(
        initialContributorsCount + 1n
      )
      expect(await campaign.contributions(contributor1.address)).to.equal(
        contribution1Amount
      )
      expect(await campaign.totalAmountRaised()).to.equal(
        initialTotalRaised + contribution1Amount
      )

      // Second user contributes
      await usdc
        .connect(contributor2)
        .approve(await campaign.getAddress(), contribution2Amount)
      await campaign
        .connect(contributor2)
        .contribute(usdcAddress, contribution2Amount)

      // Check state after second contribution
      expect(await campaign.isContributor(contributor1.address)).to.be.true
      expect(await campaign.isContributor(contributor2.address)).to.be.true
      expect(await campaign.contributorsCount()).to.equal(
        initialContributorsCount + 2n
      )
      expect(await campaign.contributions(contributor1.address)).to.equal(
        contribution1Amount
      )
      expect(await campaign.contributions(contributor2.address)).to.equal(
        contribution2Amount
      )
      expect(await campaign.totalAmountRaised()).to.equal(
        initialTotalRaised + contribution1Amount + contribution2Amount
      )

      // First user contributes again
      const additionalContribution = ethers.parseUnits('50', usdcDecimals)
      await usdc
        .connect(contributor1)
        .approve(await campaign.getAddress(), additionalContribution)
      await campaign
        .connect(contributor1)
        .contribute(usdcAddress, additionalContribution)

      // Check state after additional contribution
      expect(await campaign.isContributor(contributor1.address)).to.be.true
      expect(await campaign.isContributor(contributor2.address)).to.be.true
      expect(await campaign.contributorsCount()).to.equal(
        initialContributorsCount + 2n
      ) // Still only 2 contributors
      expect(await campaign.contributions(contributor1.address)).to.equal(
        contribution1Amount + additionalContribution
      )
      expect(await campaign.contributions(contributor2.address)).to.equal(
        contribution2Amount
      )
      expect(await campaign.totalAmountRaised()).to.equal(
        initialTotalRaised +
          contribution1Amount +
          contribution2Amount +
          additionalContribution
      )

      // Check aToken balance reflects all contributions
      const expectedTotalContributed =
        contribution1Amount + contribution2Amount + additionalContribution
      const aTokenBalanceAfter = await aToken.balanceOf(
        await campaign.getAddress()
      )
      expect(aTokenBalanceAfter).to.be.closeTo(
        initialATokenBalance + expectedTotalContributed,
        10 // Allow for a small tolerance
      )

      // Check aave balances
      expect(
        await defiIntegrationManager.aaveBalances(
          usdcAddress,
          await campaign.getAddress()
        )
      ).to.be.closeTo(initialATokenBalance + expectedTotalContributed, 10)
    })

    it('Should revert when contribution amount is 0', async function () {
      const { campaign, usdc, contributor1 } = await loadFixture(
        deployPlatformFixture
      )

      const usdcAddress = await usdc.getAddress()
      const usdcDecimals = await usdc.decimals()

      await usdc
        .connect(contributor1)
        .approve(
          await campaign.getAddress(),
          ethers.parseUnits('100', usdcDecimals)
        )

      await expect(campaign.connect(contributor1).contribute(usdcAddress, 0))
        .to.be.revertedWithCustomError(campaign, 'CampaignError')
        .withArgs(ERR_INVALID_AMOUNT, ethers.getAddress(usdcAddress), 0)
    })

    it('Should revert when contributing with non-campaign token', async function () {
      const { campaign, wbtc, contributor1, tokenRegistry } = await loadFixture(
        deployPlatformFixture
      )

      const wbtcAddress = await wbtc.getAddress()
      const wbtcDecimals = await wbtc.decimals()

      await wbtc
        .connect(contributor1)
        .approve(
          await campaign.getAddress(),
          ethers.parseUnits('100', wbtcDecimals)
        )

      await expect(campaign.connect(contributor1).contribute(wbtcAddress, 10))
        .to.be.revertedWithCustomError(campaign, 'CampaignError')
        .withArgs(ERR_NOT_TARGET_TOKEN, ethers.getAddress(wbtcAddress), 0)
    })

    it('Should revert when campaignGoalAmount is reached', async function () {
      const { campaign, usdc, contributor1 } = await loadFixture(
        deployPlatformFixture
      )

      const usdcDecimals = await usdc.decimals()

      const contributionAmount = CAMPAIGN_GOAL_AMOUNT * 2n //goal amount already in smallest units

      await usdc
        .connect(contributor1)
        .approve(await campaign.getAddress(), contributionAmount)

      await campaign
        .connect(contributor1)
        .contribute(await usdc.getAddress(), contributionAmount)

      expect(await campaign.isCampaignActive()).to.be.true //Even though the end date hasn't passed, the campaign has already hit goal
      expect(await campaign.isCampaignSuccessful()).to.be.true

      await usdc
        .connect(contributor1)
        .approve(await campaign.getAddress(), contributionAmount)

      await expect(
        campaign
          .connect(contributor1)
          .contribute(await usdc.getAddress(), contributionAmount)
      )
        .to.be.revertedWithCustomError(campaign, 'CampaignError')
        .withArgs(
          ERR_GOAL_REACHED,
          ethers.ZeroAddress,
          await campaign.totalAmountRaised()
        )
    })

    it('Should revert when campaign is not active', async function () {
      const { campaign, usdc, contributor1 } = await loadFixture(
        deployPlatformFixture
      )

      const usdcDecimals = await usdc.decimals()

      await ethers.provider.send('evm_increaseTime', [
        CAMPAIGN_DURATION * 24 * 60 * 60
      ])
      await ethers.provider.send('evm_mine')

      await usdc
        .connect(contributor1)
        .approve(
          await campaign.getAddress(),
          ethers.parseUnits('1000', usdcDecimals)
        )

      await expect(
        campaign
          .connect(contributor1)
          .contribute(
            await usdc.getAddress(),
            ethers.parseUnits('1000', usdcDecimals)
          )
      )
        .to.be.revertedWithCustomError(campaign, 'CampaignError')
        .withArgs(
          ERR_CAMPAIGN_NOT_ACTIVE,
          ethers.getAddress(await usdc.getAddress()),
          0
        )
    })

    it('Should reject ETH sent directly to the contract', async function () {
      const { campaign, contributor1 } = await loadFixture(
        deployPlatformFixture
      )

      await expect(
        contributor1.sendTransaction({
          to: await campaign.getAddress(),
          value: ethers.parseEther('1')
        })
      )
        .to.be.revertedWithCustomError(campaign, 'CampaignError')
        .withArgs(ERR_ETH_NOT_ACCEPTED, ethers.ZeroAddress, 0)
    })

    it('Should revert for contriutions below the minimum contribution amount', async function () {
      const { campaign, contributor1, tokenRegistry, usdc } = await loadFixture(
        deployPlatformFixture
      )

      const { minimumAmount, decimals } =
        await tokenRegistry.getMinContributionAmount(await usdc.getAddress())

      const contributionAmount = minimumAmount - 1n

      await expect(
        campaign
          .connect(contributor1)
          .contribute(await usdc.getAddress(), contributionAmount)
      )
        .to.be.revertedWithCustomError(campaign, 'CampaignError')
        .withArgs(
          ERR_INVALID_AMOUNT,
          ethers.getAddress(await usdc.getAddress()),
          contributionAmount
        )
    })

    it('Should allow  contriutions at the minimum contribution amount', async function () {
      const { campaign, contributor1, tokenRegistry, usdc } = await loadFixture(
        deployPlatformFixture
      )

      const { minimumAmount, decimals } =
        await tokenRegistry.getMinContributionAmount(await usdc.getAddress())

      const contributionAmount = minimumAmount

      await usdc
        .connect(contributor1)
        .approve(await campaign.getAddress(), contributionAmount)

      await expect(
        campaign
          .connect(contributor1)
          .contribute(await usdc.getAddress(), contributionAmount)
      )
        .to.emit(campaign, 'Contribution')
        .withArgs(contributor1.address, contributionAmount)

      expect(await campaign.contributions(contributor1.address)).to.equal(
        contributionAmount
      )
      expect(await campaign.totalAmountRaised()).to.equal(contributionAmount)
    })

    it('Should not allow contributions when admin override is in place', async function () {
      const { campaign, contributor1, usdc, deployer } = await loadFixture(
        deployPlatformFixture
      )

      const usdcDecimals = await usdc.decimals()

      await campaign.connect(deployer).setAdminOverride(true)

      expect(await campaign.isAdminOverrideActive()).to.be.true

      await usdc
        .connect(contributor1)
        .approve(
          await campaign.getAddress(),
          ethers.parseUnits('100', usdcDecimals)
        )

      await expect(
        campaign
          .connect(contributor1)
          .contribute(
            await usdc.getAddress(),
            ethers.parseUnits('100', usdcDecimals)
          )
      )
        .to.be.revertedWithCustomError(campaign, 'CampaignError')
        .withArgs(
          ERR_ADMIN_OVERRIDE_ACTIVE,
          ethers.getAddress(await usdc.getAddress()),
          0
        )
    })
  })

  describe('Fund Management', function () {
    describe('Claiming Funds', function () {
      it.only('Should allow owner to claim funds when campaign is successful before campaign end date', async function () {
        const {
          defiIntegrationManager,
          campaign,
          contributor1,
          contributor2,
          usdc,
          creator1,
          IERC20ABI,
          yieldDistributor,
          platformTreasury
        } = await loadFixture(deployPlatformFixture)

        const usdcAddress = await usdc.getAddress()
        const usdcDecimals = await usdc.decimals()

        const aTokenAddress = await defiIntegrationManager.getATokenAddress(
          usdcAddress
        )

        const aToken = await ethers.getContractAt(IERC20ABI, aTokenAddress)

        const contributionAmount1 = ethers.parseUnits('400', usdcDecimals)
        const contributionAmount2 = ethers.parseUnits('650', usdcDecimals)

        await usdc
          .connect(contributor1)
          .approve(await campaign.getAddress(), contributionAmount1)

        await campaign
          .connect(contributor1)
          .contribute(await usdc.getAddress(), contributionAmount1)

        await ethers.provider.send('evm_increaseTime', [
          (CAMPAIGN_DURATION - 5) * 24 * 60 * 60
        ])

        await ethers.provider.send('evm_mine')

        await usdc
          .connect(contributor2)
          .approve(await campaign.getAddress(), contributionAmount2)

        await campaign
          .connect(contributor2)
          .contribute(await usdc.getAddress(), contributionAmount2)

        expect(await campaign.isCampaignActive()).to.be.true //Not past campaign end date
        expect(await campaign.isCampaignSuccessful()).to.be.true

        const aTokenBalanceBeforeClaim = await aToken.balanceOf(
          await campaign.getAddress()
        )

        const platformTreasuryBalanceBeforeClaim = await usdc.balanceOf(
          platformTreasury.address
        )

        const creatorBalanceBeforeClaim = await usdc.balanceOf(
          await campaign.owner()
        )

        expect(aTokenBalanceBeforeClaim).to.be.greaterThan(0)

        expect(await campaign.hasClaimedFunds()).to.be.false

        await expect(campaign.connect(creator1).claimFunds())
          .to.emit(campaign, 'FundsClaimed')
          .withArgs(await campaign.getAddress(), anyUint)

        expect(await campaign.hasClaimedFunds()).to.be.true

        const { creatorShare, platformShare } =
          await yieldDistributor.calculateYieldShares(aTokenBalanceBeforeClaim)

        const aTokenBalanceAftereClaim = await aToken.balanceOf(
          await campaign.getAddress()
        )

        expect(aTokenBalanceAftereClaim).to.be.closeTo(0, 1)

        const platformTreasuryBalanceAfterClaim = await usdc.balanceOf(
          await platformTreasury.address
        )

        const creatorBalanceAfterClaim = await usdc.balanceOf(
          await campaign.owner()
        )

        expect(platformTreasuryBalanceAfterClaim).to.be.closeTo(
          platformTreasuryBalanceBeforeClaim + platformShare,
          1
        )

        expect(creatorBalanceAfterClaim).to.be.closeTo(
          creatorBalanceBeforeClaim + creatorShare,
          1
        )

        await expect(campaign.connect(creator1).claimFunds())
          .to.be.revertedWithCustomError(campaign, 'CampaignError')
          .withArgs(ERR_FUNDS_CLAIMED, ethers.ZeroAddress, 0)
      })

      it('Should allow owner to claim funds when campaign is unsuccessful and distribute funds correctly', async function () {})
    })

    // describe('Refunds', function () {
    //   it('Should allow successful refund when campaign is over and goal not reached', async function () {
    //     const {
    //       campaign,
    //       mockToken1,
    //       user1,
    //       CAMPAIGN_GOAL_AMOUNT,
    //       CAMPAIGN_DURATION
    //     } = await loadFixture(deployPlatformFixture)

    //     const contributionAmount = CAMPAIGN_GOAL_AMOUNT - 1

    //     await mockToken1
    //       .connect(user1)
    //       .approve(await campaign.getAddress(), contributionAmount)

    //     await campaign
    //       .connect(user1)
    //       .contribute(await mockToken1.getAddress(), contributionAmount)

    //     const userBalanceAfterContribution = await mockToken1.balanceOf(
    //       user1.address
    //     )

    //     await ethers.provider.send('evm_increaseTime', [
    //       (CAMPAIGN_DURATION + 1) * 24 * 60 * 60
    //     ])
    //     await ethers.provider.send('evm_mine')

    //     await expect(campaign.connect(user1).requestRefund())
    //       .to.emit(campaign, 'RefundIssued')
    //       .withArgs(user1.address, contributionAmount)

    //     expect(
    //       await mockToken1.balanceOf(await campaign.getAddress())
    //     ).to.equal(0)

    //     expect(await mockToken1.balanceOf(user1.address)).to.equal(
    //       userBalanceAfterContribution + BigInt(contributionAmount)
    //     )

    //     expect(await campaign.contributions(user1.address)).to.equal(0)

    //     await expect(campaign.connect(user1).requestRefund())
    //       .to.be.revertedWithCustomError(campaign, 'CampaignError')
    //       .withArgs(ERR_ALREADY_REFUNDED, user1.address, 0)
    //   })

    //   it('Should revert when trying to request refund before campaign ends', async function () {
    //     const {
    //       campaign,
    //       mockToken1,
    //       user1,
    //       CAMPAIGN_GOAL_AMOUNT,
    //       CAMPAIGN_DURATION
    //     } = await loadFixture(deployPlatformFixture)

    //     const contributionAmount = CAMPAIGN_GOAL_AMOUNT - 1

    //     await mockToken1
    //       .connect(user1)
    //       .approve(await campaign.getAddress(), contributionAmount)

    //     await campaign
    //       .connect(user1)
    //       .contribute(await mockToken1.getAddress(), contributionAmount)

    //     const userBalanceAfterContribution = await mockToken1.balanceOf(
    //       user1.address
    //     )

    //     const campaignBalanceAfterContribution = await mockToken1.balanceOf(
    //       campaign.getAddress()
    //     )

    //     await ethers.provider.send('evm_increaseTime', [
    //       (CAMPAIGN_DURATION - 1) * 24 * 60 * 60
    //     ])
    //     await ethers.provider.send('evm_mine')

    //     await expect(campaign.connect(user1).requestRefund())
    //       .to.be.revertedWithCustomError(campaign, 'CampaignError')
    //       .withArgs(ERR_CAMPAIGN_STILL_ACTIVE, ethers.ZeroAddress, 0)

    //     const userBalanceAfterFailedRefund = await mockToken1.balanceOf(
    //       user1.address
    //     )

    //     const campaignBalanceAfterFailedRefund = await mockToken1.balanceOf(
    //       campaign.getAddress()
    //     )

    //     expect(userBalanceAfterContribution).to.equal(
    //       userBalanceAfterFailedRefund
    //     )
    //     expect(campaignBalanceAfterContribution).to.equal(
    //       campaignBalanceAfterFailedRefund
    //     )
    //   })

    //   it('Should revert when trying to request refund if goal is reached', async function () {
    //     const {
    //       campaign,
    //       mockToken1,
    //       user1,
    //       CAMPAIGN_GOAL_AMOUNT,
    //       CAMPAIGN_DURATION
    //     } = await loadFixture(deployPlatformFixture)

    //     const contributionAmount = CAMPAIGN_GOAL_AMOUNT + 1

    //     await mockToken1
    //       .connect(user1)
    //       .approve(await campaign.getAddress(), contributionAmount)

    //     await campaign
    //       .connect(user1)
    //       .contribute(await mockToken1.getAddress(), contributionAmount)

    //     const userBalanceAfterContribution = await mockToken1.balanceOf(
    //       user1.address
    //     )

    //     const campaignBalanceAfterContribution = await mockToken1.balanceOf(
    //       campaign.getAddress()
    //     )

    //     await ethers.provider.send('evm_increaseTime', [
    //       (CAMPAIGN_DURATION + 1) * 24 * 60 * 60
    //     ])
    //     await ethers.provider.send('evm_mine')

    //     await expect(campaign.connect(user1).requestRefund())
    //       .to.be.revertedWithCustomError(campaign, 'CampaignError')
    //       .withArgs(
    //         ERR_GOAL_REACHED,
    //         ethers.ZeroAddress,
    //         campaignBalanceAfterContribution
    //       )

    //     const userBalanceAfterFailedRefund = await mockToken1.balanceOf(
    //       user1.address
    //     )

    //     const campaignBalanceAfterFailedRefund = await mockToken1.balanceOf(
    //       campaign.getAddress()
    //     )

    //     expect(userBalanceAfterContribution).to.equal(
    //       userBalanceAfterFailedRefund
    //     )
    //     expect(campaignBalanceAfterContribution).to.equal(
    //       campaignBalanceAfterFailedRefund
    //     )
    //   })

    //   it('Should revert when trying to request refund with zero contribution', async function () {
    //     const {
    //       campaign,
    //       mockToken1,
    //       user1,
    //       user2,
    //       CAMPAIGN_GOAL_AMOUNT,
    //       CAMPAIGN_DURATION
    //     } = await loadFixture(deployPlatformFixture)

    //     const contributionAmount = CAMPAIGN_GOAL_AMOUNT - 1

    //     await mockToken1
    //       .connect(user1)
    //       .approve(await campaign.getAddress(), contributionAmount)

    //     await campaign
    //       .connect(user1)
    //       .contribute(await mockToken1.getAddress(), contributionAmount)

    //     const userBalanceAfterContribution = await mockToken1.balanceOf(
    //       user1.address
    //     )

    //     const user2BalanceAfterContribution = await mockToken1.balanceOf(
    //       user2.address
    //     )

    //     const campaignBalanceAfterContribution = await mockToken1.balanceOf(
    //       campaign.getAddress()
    //     )

    //     await ethers.provider.send('evm_increaseTime', [
    //       (CAMPAIGN_DURATION + 1) * 24 * 60 * 60
    //     ])
    //     await ethers.provider.send('evm_mine')

    //     await expect(campaign.connect(user2).requestRefund())
    //       .to.be.revertedWithCustomError(campaign, 'CampaignError')
    //       .withArgs(ERR_NOTHING_TO_REFUND, user2.address, 0)

    //     const userBalanceAfterFailedRefund = await mockToken1.balanceOf(
    //       user1.address
    //     )

    //     const user2BalanceAfterFailedRefund = await mockToken1.balanceOf(
    //       user2.address
    //     )

    //     const campaignBalanceAfterFailedRefund = await mockToken1.balanceOf(
    //       campaign.getAddress()
    //     )

    //     expect(userBalanceAfterContribution).to.equal(
    //       userBalanceAfterFailedRefund
    //     )

    //     expect(user2BalanceAfterContribution).to.equal(
    //       user2BalanceAfterFailedRefund
    //     )

    //     expect(campaignBalanceAfterContribution).to.equal(
    //       campaignBalanceAfterFailedRefund
    //     )
    //   })

    //   it('Should revert when token transfer fails during refund', async function () {
    //     const {
    //       owner,
    //       user1,
    //       platformAdmin,
    //       tokenRegistry,
    //       mockDefiManager,
    //       CAMPAIGN_DURATION
    //     } = await loadFixture(deployPlatformFixture)

    //     // Deploy a special failing token for this test
    //     const mockFailingToken = await ethers.deployContract(
    //       'MockFailingERC20',
    //       ['Failing Token', 'FAIL', ethers.parseUnits('100')]
    //     )
    //     await mockFailingToken.waitForDeployment()
    //     const mockFailingTokenAddress = await mockFailingToken.getAddress()

    //     // Add the failing token to the registry
    //     await tokenRegistry.addToken(mockFailingTokenAddress, 1)

    //     // Create a campaign that uses the failing token
    //     const CAMPAIGN_GOAL_AMOUNT = 5
    //     const campaign = await ethers.deployContract('Campaign', [
    //       owner.address,
    //       mockFailingTokenAddress,
    //       CAMPAIGN_GOAL_AMOUNT,
    //       CAMPAIGN_DURATION,
    //       await mockDefiManager.getAddress(),
    //       await platformAdmin.getAddress()
    //     ])
    //     await campaign.waitForDeployment()

    //     // Set up contribution that's below the goal
    //     const contributionAmount = CAMPAIGN_GOAL_AMOUNT - 1
    //     await mockFailingToken.transfer(user1.address, contributionAmount)

    //     // User approves and contributes to the campaign
    //     await mockFailingToken
    //       .connect(user1)
    //       .approve(await campaign.getAddress(), contributionAmount)

    //     await campaign
    //       .connect(user1)
    //       .contribute(mockFailingTokenAddress, contributionAmount)

    //     // Move time past campaign end date
    //     await ethers.provider.send('evm_increaseTime', [
    //       (CAMPAIGN_DURATION + 1) * 24 * 60 * 60
    //     ])
    //     await ethers.provider.send('evm_mine')

    //     // Configure the token to fail on transfers
    //     await mockFailingToken.setTransferShouldFail(true)

    //     // The refund call should fail with SafeERC20 error
    //     await expect(
    //       campaign.connect(user1).requestRefund()
    //     ).to.be.revertedWithCustomError(campaign, 'SafeERC20FailedOperation')

    //     // Contribution record should still be intact
    //     expect(await campaign.contributions(user1.address)).to.equal(
    //       contributionAmount
    //     )
    //   })
    // })
    // })

    // describe('Admin Functions', function () {
    //   describe('withdrawAllFromYieldProtocolAdmin()', function () {
    //     it('Should allow admin to withdraw all yield after grace period has passed', async function () {
    //       const {
    //         campaign,
    //         mockDefiManager,
    //         mockToken1,
    //         user1,
    //         otherAdmin,
    //         GRACE_PERIOD
    //       } = await loadFixture(deployPlatformFixture)

    //       const depositAmount = 100
    //       await mockToken1
    //         .connect(user1)
    //         .approve(await campaign.getAddress(), depositAmount)
    //       await campaign
    //         .connect(user1)
    //         .contribute(await mockToken1.getAddress(), depositAmount)

    //       await campaign.depositToYieldProtocol(
    //         await mockToken1.getAddress(),
    //         depositAmount
    //       )

    //       const depositedAmount = await mockDefiManager.getDepositedAmount(
    //         await campaign.getAddress(),
    //         await mockToken1.getAddress()
    //       )
    //       expect(depositedAmount).to.equal(BigInt(depositAmount))

    //       const campaignEndTime = await campaign.campaignEndTime()

    //       const latestBlock = await ethers.provider.getBlock('latest')

    //       if (!latestBlock) {
    //         throw new Error('Latest block does not exist')
    //       }

    //       const currentTimestamp = latestBlock.timestamp

    //       // Convert campaignEndTime to a number before subtraction
    //       const timeToAdvance =
    //         Number(campaignEndTime) -
    //         currentTimestamp +
    //         (GRACE_PERIOD + 1) * 24 * 60 * 60

    //       await ethers.provider.send('evm_increaseTime', [timeToAdvance])
    //       await ethers.provider.send('evm_mine')

    //       expect(await campaign.isCampaignActive()).to.be.false

    //       const campaignBalanceBefore = await mockToken1.balanceOf(
    //         await campaign.getAddress()
    //       )

    //       await expect(
    //         campaign
    //           .connect(otherAdmin)
    //           .withdrawAllFromYieldProtocolAdmin(await mockToken1.getAddress())
    //       )
    //         .to.emit(campaign, 'FundsOperation')
    //         .withArgs(
    //           await mockToken1,
    //           depositedAmount,
    //           OP_WITHDRAW_ALL,
    //           0,
    //           otherAdmin.address
    //         )

    //       const campaignBalanceAfter = await mockToken1.balanceOf(
    //         await campaign.getAddress()
    //       )
    //       expect(campaignBalanceAfter - campaignBalanceBefore).to.equal(
    //         BigInt(depositAmount)
    //       )

    //       const remainingDepositedAmount =
    //         await mockDefiManager.getDepositedAmount(
    //           await campaign.getAddress(),
    //           await mockToken1.getAddress()
    //         )
    //       expect(remainingDepositedAmount).to.equal(0)
    //     })

    //     it('Should should revert if admin tries to harvest yield before grace period', async function () {
    //       const {
    //         campaign,
    //         mockDefiManager,
    //         mockToken1,
    //         yieldDistributor,
    //         user1,
    //         platformTreasury,
    //         otherAdmin
    //       } = await loadFixture(deployPlatformFixture)

    //       const depositAmount = 100
    //       await mockToken1
    //         .connect(user1)
    //         .approve(await campaign.getAddress(), depositAmount)
    //       await campaign
    //         .connect(user1)
    //         .contribute(await mockToken1.getAddress(), depositAmount)

    //       await campaign.depositToYieldProtocol(
    //         await mockToken1.getAddress(),
    //         depositAmount
    //       )

    //       const yieldRate = await mockDefiManager.yieldRate()

    //       const totalYield =
    //         (BigInt(depositAmount) * BigInt(yieldRate)) / BigInt(10000)

    //       const [expectedCreatorYield, expectedPlatformYield] =
    //         await yieldDistributor.calculateYieldShares(totalYield)

    //       await mockToken1.mint(await mockDefiManager.getAddress(), totalYield)

    //       const campaignAddress = campaign.getAddress()
    //       const platformTreasuryAddress = platformTreasury.address

    //       const campaignBalanceBefore = await mockToken1.balanceOf(
    //         campaignAddress
    //       )

    //       const platformTreasuryBalanceBefore = await mockToken1.balanceOf(
    //         platformTreasuryAddress
    //       )

    //       await expect(
    //         campaign
    //           .connect(otherAdmin)
    //           .withdrawAllFromYieldProtocolAdmin(await mockToken1.getAddress())
    //       ).to.be.revertedWithCustomError(campaign, 'GracePeriodNotOver')

    //       const campaignBalanceAfter = await mockToken1.balanceOf(campaignAddress)
    //       const platformTreasuryBalanceAfter = await mockToken1.balanceOf(
    //         platformTreasuryAddress
    //       )

    //       expect(campaignBalanceAfter).to.equal(campaignBalanceBefore)

    //       expect(platformTreasuryBalanceAfter).to.equal(
    //         platformTreasuryBalanceBefore
    //       )
    //     })
    //     it('Should revert if non-admin tries to harvest yield using admin function', async function () {
    //       const {
    //         campaign,
    //         mockDefiManager,
    //         mockToken1,
    //         yieldDistributor,
    //         user1,
    //         platformTreasury,
    //         GRACE_PERIOD,
    //         otherAdmin
    //       } = await loadFixture(deployPlatformFixture)

    //       const depositAmount = 100
    //       await mockToken1
    //         .connect(user1)
    //         .approve(await campaign.getAddress(), depositAmount)
    //       await campaign
    //         .connect(user1)
    //         .contribute(await mockToken1.getAddress(), depositAmount)

    //       await campaign.depositToYieldProtocol(
    //         await mockToken1.getAddress(),
    //         depositAmount
    //       )

    //       const yieldRate = await mockDefiManager.yieldRate()

    //       const totalYield =
    //         (BigInt(depositAmount) * BigInt(yieldRate)) / BigInt(10000)

    //       const [expectedCreatorYield, expectedPlatformYield] =
    //         await yieldDistributor.calculateYieldShares(totalYield)

    //       await mockToken1.mint(await mockDefiManager.getAddress(), totalYield)

    //       const campaignAddress = campaign.getAddress()
    //       const platformTreasuryAddress = platformTreasury.address

    //       const campaignBalanceBefore = await mockToken1.balanceOf(
    //         campaignAddress
    //       )

    //       const platformTreasuryBalanceBefore = await mockToken1.balanceOf(
    //         platformTreasuryAddress
    //       )

    //       const campaignEndTime = await campaign.campaignEndTime()

    //       const latestBlock = await ethers.provider.getBlock('latest')

    //       if (!latestBlock) {
    //         throw new Error('Latest block does not exist')
    //       }

    //       const currentTimestamp = latestBlock.timestamp

    //       const timeToAdvance =
    //         Number(campaignEndTime) -
    //         currentTimestamp +
    //         (GRACE_PERIOD + 1) * 24 * 60 * 60

    //       await ethers.provider.send('evm_increaseTime', [timeToAdvance])
    //       await ethers.provider.send('evm_mine')

    //       await expect(
    //         campaign
    //           .connect(user1)
    //           .withdrawAllFromYieldProtocolAdmin(await mockToken1.getAddress())
    //       ).to.be.revertedWithCustomError(campaign, 'NotAuthorizedAdmin')

    //       const campaignBalanceAfter = await mockToken1.balanceOf(campaignAddress)
    //       const platformTreasuryBalanceAfter = await mockToken1.balanceOf(
    //         platformTreasuryAddress
    //       )

    //       expect(campaignBalanceAfter).to.equal(campaignBalanceBefore)

    //       expect(platformTreasuryBalanceAfter).to.equal(
    //         platformTreasuryBalanceBefore
    //       )
    //     })
    //   })

    //   describe('withdrawFromYieldProtocolAdmin()', function () {
    //     it('Should allow admin to withdraw a specific amount of yield after grace period', async function () {
    //       const {
    //         campaign,
    //         mockDefiManager,
    //         mockToken1,
    //         user1,
    //         otherAdmin,
    //         GRACE_PERIOD
    //       } = await loadFixture(deployPlatformFixture)

    //       const depositAmount = 100
    //       await mockToken1
    //         .connect(user1)
    //         .approve(await campaign.getAddress(), depositAmount)
    //       await campaign
    //         .connect(user1)
    //         .contribute(await mockToken1.getAddress(), depositAmount)

    //       await campaign.depositToYieldProtocol(
    //         await mockToken1.getAddress(),
    //         depositAmount
    //       )

    //       const depositedAmount = await mockDefiManager.getDepositedAmount(
    //         await campaign.getAddress(),
    //         await mockToken1.getAddress()
    //       )
    //       expect(depositedAmount).to.equal(BigInt(depositAmount))

    //       const withdrawAmount = depositAmount / 2
    //       const campaignBalanceBefore = await mockToken1.balanceOf(
    //         await campaign.getAddress()
    //       )

    //       const campaignEndTime = await campaign.campaignEndTime()

    //       const latestBlock = await ethers.provider.getBlock('latest')

    //       if (!latestBlock) {
    //         throw new Error('Latest block does not exist')
    //       }

    //       const currentTimestamp = latestBlock.timestamp

    //       // Convert campaignEndTime to a number before subtraction
    //       const timeToAdvance =
    //         Number(campaignEndTime) -
    //         currentTimestamp +
    //         (GRACE_PERIOD + 1) * 24 * 60 * 60

    //       await ethers.provider.send('evm_increaseTime', [timeToAdvance])
    //       await ethers.provider.send('evm_mine')

    //       expect(await campaign.isCampaignActive()).to.be.false

    //       await expect(
    //         campaign
    //           .connect(otherAdmin)
    //           .withdrawFromYieldProtocolAdmin(
    //             await mockToken1.getAddress(),
    //             withdrawAmount
    //           )
    //       )
    //         .to.emit(campaign, 'FundsOperation')
    //         .withArgs(
    //           await mockToken1.getAddress(),
    //           withdrawAmount,
    //           OP_WITHDRAW,
    //           0,
    //           otherAdmin.address
    //         )

    //       const campaignBalanceAfter = await mockToken1.balanceOf(
    //         await campaign.getAddress()
    //       )
    //       expect(campaignBalanceAfter - campaignBalanceBefore).to.equal(
    //         BigInt(withdrawAmount)
    //       )

    //       const remainingDepositedAmount =
    //         await mockDefiManager.getDepositedAmount(
    //           await campaign.getAddress(),
    //           await mockToken1.getAddress()
    //         )
    //       expect(remainingDepositedAmount).to.equal(
    //         BigInt(depositAmount - withdrawAmount)
    //       )
    //     })

    //     it('Should should revert if admin tries to harvest yield before grace period', async function () {
    //       const {
    //         campaign,
    //         mockDefiManager,
    //         mockToken1,
    //         yieldDistributor,
    //         user1,
    //         platformTreasury,
    //         otherAdmin
    //       } = await loadFixture(deployPlatformFixture)

    //       const depositAmount = 100
    //       await mockToken1
    //         .connect(user1)
    //         .approve(await campaign.getAddress(), depositAmount)
    //       await campaign
    //         .connect(user1)
    //         .contribute(await mockToken1.getAddress(), depositAmount)

    //       await campaign.depositToYieldProtocol(
    //         await mockToken1.getAddress(),
    //         depositAmount
    //       )

    //       const yieldRate = await mockDefiManager.yieldRate()

    //       const totalYield =
    //         (BigInt(depositAmount) * BigInt(yieldRate)) / BigInt(10000)

    //       const [expectedCreatorYield, expectedPlatformYield] =
    //         await yieldDistributor.calculateYieldShares(totalYield)

    //       await mockToken1.mint(await mockDefiManager.getAddress(), totalYield)

    //       const campaignAddress = campaign.getAddress()
    //       const platformTreasuryAddress = platformTreasury.address

    //       const withdrawAmount = depositAmount / 2

    //       const campaignBalanceBefore = await mockToken1.balanceOf(
    //         campaignAddress
    //       )

    //       const platformTreasuryBalanceBefore = await mockToken1.balanceOf(
    //         platformTreasuryAddress
    //       )

    //       await expect(
    //         campaign
    //           .connect(otherAdmin)
    //           .withdrawFromYieldProtocolAdmin(
    //             await mockToken1.getAddress(),
    //             withdrawAmount
    //           )
    //       ).to.be.revertedWithCustomError(campaign, 'GracePeriodNotOver')

    //       const campaignBalanceAfter = await mockToken1.balanceOf(campaignAddress)
    //       const platformTreasuryBalanceAfter = await mockToken1.balanceOf(
    //         platformTreasuryAddress
    //       )

    //       expect(campaignBalanceAfter).to.equal(campaignBalanceBefore)

    //       expect(platformTreasuryBalanceAfter).to.equal(
    //         platformTreasuryBalanceBefore
    //       )
    //     })
    //     it('Should revert if non-admin tries to harvest yield using admin function', async function () {
    //       const {
    //         campaign,
    //         mockDefiManager,
    //         mockToken1,
    //         yieldDistributor,
    //         user1,
    //         platformTreasury,
    //         GRACE_PERIOD,
    //         otherAdmin
    //       } = await loadFixture(deployPlatformFixture)

    //       const depositAmount = 100
    //       await mockToken1
    //         .connect(user1)
    //         .approve(await campaign.getAddress(), depositAmount)
    //       await campaign
    //         .connect(user1)
    //         .contribute(await mockToken1.getAddress(), depositAmount)

    //       await campaign.depositToYieldProtocol(
    //         await mockToken1.getAddress(),
    //         depositAmount
    //       )

    //       const yieldRate = await mockDefiManager.yieldRate()

    //       const totalYield =
    //         (BigInt(depositAmount) * BigInt(yieldRate)) / BigInt(10000)

    //       const [expectedCreatorYield, expectedPlatformYield] =
    //         await yieldDistributor.calculateYieldShares(totalYield)

    //       await mockToken1.mint(await mockDefiManager.getAddress(), totalYield)

    //       const campaignAddress = campaign.getAddress()
    //       const platformTreasuryAddress = platformTreasury.address
    //       const withdrawAmount = depositAmount / 2

    //       const campaignBalanceBefore = await mockToken1.balanceOf(
    //         campaignAddress
    //       )

    //       const platformTreasuryBalanceBefore = await mockToken1.balanceOf(
    //         platformTreasuryAddress
    //       )

    //       const campaignEndTime = await campaign.campaignEndTime()

    //       const latestBlock = await ethers.provider.getBlock('latest')

    //       if (!latestBlock) {
    //         throw new Error('Latest block does not exist')
    //       }

    //       const currentTimestamp = latestBlock.timestamp

    //       const timeToAdvance =
    //         Number(campaignEndTime) -
    //         currentTimestamp +
    //         (GRACE_PERIOD + 1) * 24 * 60 * 60

    //       await ethers.provider.send('evm_increaseTime', [timeToAdvance])
    //       await ethers.provider.send('evm_mine')

    //       await expect(
    //         campaign
    //           .connect(user1)
    //           .withdrawFromYieldProtocolAdmin(
    //             await mockToken1.getAddress(),
    //             withdrawAmount
    //           )
    //       ).to.be.revertedWithCustomError(campaign, 'NotAuthorizedAdmin')

    //       const campaignBalanceAfter = await mockToken1.balanceOf(campaignAddress)
    //       const platformTreasuryBalanceAfter = await mockToken1.balanceOf(
    //         platformTreasuryAddress
    //       )

    //       expect(campaignBalanceAfter).to.equal(campaignBalanceBefore)

    //       expect(platformTreasuryBalanceAfter).to.equal(
    //         platformTreasuryBalanceBefore
    //       )
    //     })
    //   })

    //   describe('harvestYieldAdmin()', function () {
    //     it('Should allow admin to harvest yield after grace period', async function () {
    //       const {
    //         campaign,
    //         mockDefiManager,
    //         mockToken1,
    //         yieldDistributor,
    //         user1,
    //         platformTreasury,
    //         GRACE_PERIOD,
    //         otherAdmin
    //       } = await loadFixture(deployPlatformFixture)

    //       const depositAmount = 100
    //       await mockToken1
    //         .connect(user1)
    //         .approve(await campaign.getAddress(), depositAmount)
    //       await campaign
    //         .connect(user1)
    //         .contribute(await mockToken1.getAddress(), depositAmount)

    //       await campaign.depositToYieldProtocol(
    //         await mockToken1.getAddress(),
    //         depositAmount
    //       )

    //       const yieldRate = await mockDefiManager.yieldRate()

    //       const totalYield =
    //         (BigInt(depositAmount) * BigInt(yieldRate)) / BigInt(10000)

    //       const [expectedCreatorYield, expectedPlatformYield] =
    //         await yieldDistributor.calculateYieldShares(totalYield)

    //       await mockToken1.mint(await mockDefiManager.getAddress(), totalYield)

    //       const campaignAddress = campaign.getAddress()
    //       const platformTreasuryAddress = platformTreasury.address

    //       const campaignBalanceBefore = await mockToken1.balanceOf(
    //         campaignAddress
    //       )

    //       const platformTreasuryBalanceBefore = await mockToken1.balanceOf(
    //         platformTreasuryAddress
    //       )

    //       const campaignEndTime = await campaign.campaignEndTime()

    //       const latestBlock = await ethers.provider.getBlock('latest')

    //       if (!latestBlock) {
    //         throw new Error('Latest block does not exist')
    //       }

    //       const currentTimestamp = latestBlock.timestamp

    //       const timeToAdvance =
    //         Number(campaignEndTime) -
    //         currentTimestamp +
    //         (GRACE_PERIOD + 1) * 24 * 60 * 60

    //       await ethers.provider.send('evm_increaseTime', [timeToAdvance])
    //       await ethers.provider.send('evm_mine')

    //       await expect(
    //         campaign
    //           .connect(otherAdmin)
    //           .harvestYieldAdmin(await mockToken1.getAddress())
    //       )
    //         .to.emit(campaign, 'FundsOperation')
    //         .withArgs(
    //           await mockToken1.getAddress(),
    //           0,
    //           OP_HARVEST,
    //           expectedCreatorYield,
    //           otherAdmin.address
    //         )

    //       const campaignBalanceAfter = await mockToken1.balanceOf(campaignAddress)
    //       const platformTreasuryBalanceAfter = await mockToken1.balanceOf(
    //         platformTreasuryAddress
    //       )

    //       expect(campaignBalanceAfter - campaignBalanceBefore).to.equal(
    //         expectedCreatorYield
    //       )

    //       expect(
    //         platformTreasuryBalanceAfter - platformTreasuryBalanceBefore
    //       ).to.equal(expectedPlatformYield)

    //       const depositedAmount = await mockDefiManager.getDepositedAmount(
    //         await campaign.getAddress(),
    //         await mockToken1.getAddress()
    //       )
    //       expect(depositedAmount).to.equal(BigInt(depositAmount))
    //     })
    //     it('Should should revert if admin tries to harvest yield before grace period', async function () {
    //       const {
    //         campaign,
    //         mockDefiManager,
    //         mockToken1,
    //         yieldDistributor,
    //         user1,
    //         platformTreasury,
    //         otherAdmin
    //       } = await loadFixture(deployPlatformFixture)

    //       const depositAmount = 100
    //       await mockToken1
    //         .connect(user1)
    //         .approve(await campaign.getAddress(), depositAmount)
    //       await campaign
    //         .connect(user1)
    //         .contribute(await mockToken1.getAddress(), depositAmount)

    //       await campaign.depositToYieldProtocol(
    //         await mockToken1.getAddress(),
    //         depositAmount
    //       )

    //       const yieldRate = await mockDefiManager.yieldRate()

    //       const totalYield =
    //         (BigInt(depositAmount) * BigInt(yieldRate)) / BigInt(10000)

    //       const [expectedCreatorYield, expectedPlatformYield] =
    //         await yieldDistributor.calculateYieldShares(totalYield)

    //       await mockToken1.mint(await mockDefiManager.getAddress(), totalYield)

    //       const campaignAddress = campaign.getAddress()
    //       const platformTreasuryAddress = platformTreasury.address

    //       const campaignBalanceBefore = await mockToken1.balanceOf(
    //         campaignAddress
    //       )

    //       const platformTreasuryBalanceBefore = await mockToken1.balanceOf(
    //         platformTreasuryAddress
    //       )

    //       await expect(
    //         campaign
    //           .connect(otherAdmin)
    //           .harvestYieldAdmin(await mockToken1.getAddress())
    //       ).to.be.revertedWithCustomError(campaign, 'GracePeriodNotOver')

    //       const campaignBalanceAfter = await mockToken1.balanceOf(campaignAddress)
    //       const platformTreasuryBalanceAfter = await mockToken1.balanceOf(
    //         platformTreasuryAddress
    //       )

    //       expect(campaignBalanceAfter).to.equal(campaignBalanceBefore)

    //       expect(platformTreasuryBalanceAfter).to.equal(
    //         platformTreasuryBalanceBefore
    //       )
    //     })
    //     it('Should revert if non-admin tries to harvest yield using admin function', async function () {
    //       const {
    //         campaign,
    //         mockDefiManager,
    //         mockToken1,
    //         yieldDistributor,
    //         user1,
    //         platformTreasury,
    //         GRACE_PERIOD,
    //         otherAdmin
    //       } = await loadFixture(deployPlatformFixture)

    //       const depositAmount = 100
    //       await mockToken1
    //         .connect(user1)
    //         .approve(await campaign.getAddress(), depositAmount)
    //       await campaign
    //         .connect(user1)
    //         .contribute(await mockToken1.getAddress(), depositAmount)

    //       await campaign.depositToYieldProtocol(
    //         await mockToken1.getAddress(),
    //         depositAmount
    //       )

    //       const yieldRate = await mockDefiManager.yieldRate()

    //       const totalYield =
    //         (BigInt(depositAmount) * BigInt(yieldRate)) / BigInt(10000)

    //       const [expectedCreatorYield, expectedPlatformYield] =
    //         await yieldDistributor.calculateYieldShares(totalYield)

    //       await mockToken1.mint(await mockDefiManager.getAddress(), totalYield)

    //       const campaignAddress = campaign.getAddress()
    //       const platformTreasuryAddress = platformTreasury.address

    //       const campaignBalanceBefore = await mockToken1.balanceOf(
    //         campaignAddress
    //       )

    //       const platformTreasuryBalanceBefore = await mockToken1.balanceOf(
    //         platformTreasuryAddress
    //       )

    //       const campaignEndTime = await campaign.campaignEndTime()

    //       const latestBlock = await ethers.provider.getBlock('latest')

    //       if (!latestBlock) {
    //         throw new Error('Latest block does not exist')
    //       }

    //       const currentTimestamp = latestBlock.timestamp

    //       const timeToAdvance =
    //         Number(campaignEndTime) -
    //         currentTimestamp +
    //         (GRACE_PERIOD + 1) * 24 * 60 * 60

    //       await ethers.provider.send('evm_increaseTime', [timeToAdvance])
    //       await ethers.provider.send('evm_mine')

    //       await expect(
    //         campaign
    //           .connect(user1)
    //           .harvestYieldAdmin(await mockToken1.getAddress())
    //       ).to.be.revertedWithCustomError(campaign, 'NotAuthorizedAdmin')

    //       const campaignBalanceAfter = await mockToken1.balanceOf(campaignAddress)
    //       const platformTreasuryBalanceAfter = await mockToken1.balanceOf(
    //         platformTreasuryAddress
    //       )

    //       expect(campaignBalanceAfter).to.equal(campaignBalanceBefore)

    //       expect(platformTreasuryBalanceAfter).to.equal(
    //         platformTreasuryBalanceBefore
    //       )
    //     })
    //   })

    //   describe('Admin Override Functions', function () {
    //     it('Should allow other platform admin to set admin override', async function () {
    //       const { campaign, platformAdmin, otherAdmin } = await loadFixture(
    //         deployPlatformFixture
    //       )

    //       // Initially campaign should be active
    //       expect(await campaign.isCampaignActive()).to.be.true
    //       expect(await campaign.adminOverride()).to.be.false

    //       // Set admin override to true

    //       await expect(campaign.connect(otherAdmin).setAdminOverride(true))
    //         .to.emit(campaign, 'AdminOverrideSet')
    //         .withArgs(true, otherAdmin.address)

    //       // Campaign should now be inactive due to override
    //       expect(await campaign.isCampaignActive()).to.be.false
    //       expect(await campaign.adminOverride()).to.be.true
    //     })

    //     it('Should revert when non-admin tries to set admin override', async function () {
    //       const { campaign, user1 } = await loadFixture(deployPlatformFixture)

    //       await expect(
    //         campaign.connect(user1).setAdminOverride(true)
    //       ).to.be.revertedWithCustomError(campaign, 'NotAuthorizedAdmin')
    //     })

    //     it('Should prevent contributions when admin override is active', async function () {
    //       const { campaign, mockToken1, user1, platformAdmin, otherAdmin } =
    //         await loadFixture(deployPlatformFixture)

    //       await campaign.connect(otherAdmin).setAdminOverride(true)

    //       // Try to contribute
    //       await mockToken1
    //         .connect(user1)
    //         .approve(await campaign.getAddress(), 100)
    //       await expect(
    //         campaign.connect(user1).contribute(await mockToken1.getAddress(), 100)
    //       )
    //         .to.be.revertedWithCustomError(campaign, 'CampaignError')
    //         .withArgs(ERR_CAMPAIGN_NOT_ACTIVE, ethers.ZeroAddress, 0)
    //     })

    //     it('Should allow admin to reactivate campaign by removing override', async function () {
    //       const { campaign, mockToken1, user1, platformAdmin, otherAdmin } =
    //         await loadFixture(deployPlatformFixture)

    //       // Set admin override to true

    //       await campaign.connect(otherAdmin).setAdminOverride(true)
    //       expect(await campaign.isCampaignActive()).to.be.false

    //       // Remove override
    //       await expect(campaign.connect(otherAdmin).setAdminOverride(false))
    //         .to.emit(campaign, 'AdminOverrideSet')
    //         .withArgs(false, otherAdmin.address)

    //       // Campaign should be active again
    //       expect(await campaign.isCampaignActive()).to.be.true

    //       // Should allow contributions
    //       await mockToken1
    //         .connect(user1)
    //         .approve(await campaign.getAddress(), 100)
    //       await expect(
    //         campaign.connect(user1).contribute(await mockToken1.getAddress(), 100)
    //       )
    //         .to.emit(campaign, 'Contribution')
    //         .withArgs(user1.address, 100)
    //     })
    //   })
    // })

    // describe('Getter Functions', function () {
    //   describe('isCampaignActive', function () {
    //     it('Should return true when campaign is within its timeframe', async function () {
    //       const { campaign } = await loadFixture(deployPlatformFixture)

    //       // Campaign should be active by default right after deployment
    //       expect(await campaign.isCampaignActive()).to.be.true
    //     })

    //     it('Should return false when campaign timeframe has passed', async function () {
    //       const { campaign, CAMPAIGN_DURATION } = await loadFixture(
    //         deployPlatformFixture
    //       )

    //       // Increase time to after campaign end
    //       await ethers.provider.send('evm_increaseTime', [
    //         (CAMPAIGN_DURATION + 1) * 24 * 60 * 60
    //       ])
    //       await ethers.provider.send('evm_mine')

    //       // Campaign should now be inactive
    //       expect(await campaign.isCampaignActive()).to.be.false
    //     })
    //   })

    //   describe('isCampaignSuccessful', function () {
    //     it('Should return true when goal is reached', async function () {
    //       const { campaign, mockToken1, user1, CAMPAIGN_GOAL_AMOUNT } =
    //         await loadFixture(deployPlatformFixture)

    //       // Campaign should not be successful initially
    //       expect(await campaign.isCampaignSuccessful()).to.be.false

    //       // Contribute enough to reach the goal
    //       await mockToken1
    //         .connect(user1)
    //         .approve(await campaign.getAddress(), CAMPAIGN_GOAL_AMOUNT)
    //       await campaign
    //         .connect(user1)
    //         .contribute(await mockToken1.getAddress(), CAMPAIGN_GOAL_AMOUNT)

    //       // Campaign should now be successful
    //       expect(await campaign.isCampaignSuccessful()).to.be.true
    //     })

    //     it('Should return false when goal is not reached', async function () {
    //       const { campaign, mockToken1, user1, CAMPAIGN_GOAL_AMOUNT } =
    //         await loadFixture(deployPlatformFixture)

    //       // Contribute less than the goal
    //       const partialAmount = CAMPAIGN_GOAL_AMOUNT - 1
    //       await mockToken1
    //         .connect(user1)
    //         .approve(await campaign.getAddress(), partialAmount)
    //       await campaign
    //         .connect(user1)
    //         .contribute(await mockToken1.getAddress(), partialAmount)

    //       // Campaign should not be successful
    //       expect(await campaign.isCampaignSuccessful()).to.be.false
    //     })
    //   })

    //   describe('getDepositedAmount', function () {
    //     it('Should return correct deposited amount after deposits and withdrawals', async function () {
    //       const { campaign, mockDefiManager, mockToken1, user1 } =
    //         await loadFixture(deployPlatformFixture)

    //       // Initially no deposits
    //       expect(
    //         await campaign.getDepositedAmount(await mockToken1.getAddress())
    //       ).to.equal(0)

    //       // Contribute and deposit to yield protocol
    //       const depositAmount = 100
    //       await mockToken1
    //         .connect(user1)
    //         .approve(await campaign.getAddress(), depositAmount)
    //       await campaign
    //         .connect(user1)
    //         .contribute(await mockToken1.getAddress(), depositAmount)

    //       await campaign.depositToYieldProtocol(
    //         await mockToken1.getAddress(),
    //         depositAmount
    //       )

    //       // Check deposited amount
    //       expect(
    //         await campaign.getDepositedAmount(await mockToken1.getAddress())
    //       ).to.equal(BigInt(depositAmount))

    //       // Withdraw half the amount
    //       const withdrawAmount = depositAmount / 2
    //       await campaign.withdrawFromYieldProtocol(
    //         await mockToken1.getAddress(),
    //         withdrawAmount
    //       )

    //       // Check updated deposited amount
    //       expect(
    //         await campaign.getDepositedAmount(await mockToken1.getAddress())
    //       ).to.equal(BigInt(depositAmount - withdrawAmount))

    //       await campaign.withdrawFromYieldProtocol(
    //         await mockToken1.getAddress(),
    //         withdrawAmount
    //       )

    //       expect(
    //         await campaign.getDepositedAmount(await mockToken1.getAddress())
    //       ).to.equal(0)
    //     })

    //     it('Should return zero for any address with no deposits', async function () {
    //       const { campaign, mockToken1 } = await loadFixture(
    //         deployPlatformFixture
    //       )
    //       const initialDeposit = await campaign.getDepositedAmount(
    //         await mockToken1.getAddress()
    //       )
    //       expect(initialDeposit).to.equal(0)

    //       const randomAddress = await campaign.getAddress()
    //       const randomDeposit = await campaign.getDepositedAmount(randomAddress)
    //       expect(randomDeposit).to.equal(0)
    //     })
    //   })

    //   describe('getCurrentYieldRate', function () {
    //     it('Should return the yield rate from DefiManager', async function () {
    //       const { campaign, mockDefiManager, mockToken1 } = await loadFixture(
    //         deployPlatformFixture
    //       )

    //       // Get the yield rate directly from mockDefiManager for comparison
    //       const expectedRate = await mockDefiManager.getCurrentYieldRate(
    //         await mockToken1.getAddress()
    //       )

    //       // Get the yield rate through the campaign contract
    //       const actualRate = await campaign.getCurrentYieldRate(
    //         await mockToken1.getAddress()
    //       )

    //       // Verify the rates match
    //       expect(actualRate).to.equal(expectedRate)
    //     })
    //   })
  })
})
