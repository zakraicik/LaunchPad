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
  const ERR_INVALID_AMOUNT = 2
  const ERR_INVALID_GOAL = 3
  const ERR_INVALID_DURATION = 4
  const ERR_ETH_NOT_ACCEPTED = 5
  const ERR_TOKEN_NOT_SUPPORTED = 6
  const ERR_NOT_TARGET_TOKEN = 7
  const ERR_CAMPAIGN_STILL_ACTIVE = 8
  const ERR_CAMPAIGN_PAST_END_DATE = 9
  const ERR_GOAL_REACHED = 10
  const ERR_ADMIN_OVERRIDE_ACTIVE = 11
  const ERR_FUNDS_CLAIMED = 12
  const ERR_FUNDS_NOT_CLAIMED = 13
  const ERR_NOTHING_TO_WITHDRAW = 14
  const ERR_ALREADY_REFUNDED = 15
  const ERR_NOTHING_TO_REFUND = 16

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
        campaign.connect(contributor1).contribute(contributionAmount)
      )
        .to.emit(campaign, 'Contribution')
        .withArgs(contributor1.address, contributionAmount)
        .and.to.emit(campaign, 'FundsOperation')
        .withArgs(
          ethers.getAddress(await usdc.getAddress()), // token
          contributionAmount, // amount
          OP_DEPOSIT, // opType
          contributor1.address // initiator
        )

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
        campaign.connect(contributor1).contribute(contributionAmount)
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
      await campaign.connect(contributor1).contribute(contribution1Amount)

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
      await campaign.connect(contributor2).contribute(contribution2Amount)

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
      await campaign.connect(contributor1).contribute(additionalContribution)

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

      await expect(campaign.connect(contributor1).contribute(0))
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

      await expect(
        campaign
          .connect(contributor1)
          .contribute(ethers.parseUnits('10', wbtcDecimals))
      ).to.be.revertedWith('ERC20: transfer amount exceeds allowance')
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

      await campaign.connect(contributor1).contribute(contributionAmount)

      expect(await campaign.isCampaignActive()).to.be.true //Even though the end date hasn't passed, the campaign has already hit goal
      expect(await campaign.isCampaignSuccessful()).to.be.true

      await usdc
        .connect(contributor1)
        .approve(await campaign.getAddress(), contributionAmount)

      await expect(
        campaign.connect(contributor1).contribute(contributionAmount)
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
          .contribute(ethers.parseUnits('1000', usdcDecimals))
      )
        .to.be.revertedWithCustomError(campaign, 'CampaignError')
        .withArgs(
          ERR_CAMPAIGN_PAST_END_DATE,
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
        campaign.connect(contributor1).contribute(contributionAmount)
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
        campaign.connect(contributor1).contribute(contributionAmount)
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
          .contribute(ethers.parseUnits('100', usdcDecimals))
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
      it('Should allow owner to claim funds when campaign is successful before campaign end date', async function () {
        const {
          defiIntegrationManager,
          campaign,
          contributor1,
          contributor2,
          usdc,
          creator1,
          IERC20ABI,
          feeManager,
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

        await campaign.connect(contributor1).contribute(contributionAmount1)

        await ethers.provider.send('evm_increaseTime', [
          (CAMPAIGN_DURATION - 5) * 24 * 60 * 60
        ])

        await ethers.provider.send('evm_mine')

        await usdc
          .connect(contributor2)
          .approve(await campaign.getAddress(), contributionAmount2)

        await campaign.connect(contributor2).contribute(contributionAmount2)

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
          .and.to.emit(campaign, 'FundsOperation')
          .withArgs(
            ethers.getAddress(await usdc.getAddress()), // token
            anyUint, // amount
            OP_CLAIM_FUNDS, // opType
            creator1.address // initiator
          )

        expect(await campaign.hasClaimedFunds()).to.be.true

        const { creatorShare, platformShare } =
          await feeManager.calculateFeeShares(aTokenBalanceBeforeClaim)

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

      it('Should allow owner to claim funds when campaign is unsuccessful and distribute funds correctly', async function () {
        const {
          defiIntegrationManager,
          campaign,
          contributor1,
          contributor2,
          usdc,
          creator1,
          IERC20ABI,
          platformTreasury
        } = await loadFixture(deployPlatformFixture)

        const usdcAddress = await usdc.getAddress()
        const usdcDecimals = await usdc.decimals()

        const aTokenAddress = await defiIntegrationManager.getATokenAddress(
          usdcAddress
        )

        const aToken = await ethers.getContractAt(IERC20ABI, aTokenAddress)

        const contributionAmount1 = ethers.parseUnits('400', usdcDecimals)
        const contributionAmount2 = ethers.parseUnits('400', usdcDecimals)

        await usdc
          .connect(contributor1)
          .approve(await campaign.getAddress(), contributionAmount1)

        await campaign.connect(contributor1).contribute(contributionAmount1)

        await usdc
          .connect(contributor2)
          .approve(await campaign.getAddress(), contributionAmount2)

        await campaign.connect(contributor2).contribute(contributionAmount2)

        await ethers.provider.send('evm_increaseTime', [
          CAMPAIGN_DURATION * 24 * 60 * 60
        ])

        await ethers.provider.send('evm_mine')

        expect(await campaign.isCampaignActive()).to.be.false //Not past campaign end date
        expect(await campaign.isCampaignSuccessful()).to.be.false

        const aTokenBalanceBeforeClaim = await aToken.balanceOf(
          await campaign.getAddress()
        )

        const platformTreasuryBalanceBeforeClaim = await usdc.balanceOf(
          platformTreasury.address
        )

        const campaignBalanceBeforeClaim = await usdc.balanceOf(
          await campaign.getAddress()
        )

        const ownerBalanceBeforeClaim = await usdc.balanceOf(
          await campaign.owner()
        )

        expect(aTokenBalanceBeforeClaim).to.be.greaterThan(0)

        expect(await campaign.hasClaimedFunds()).to.be.false

        await expect(campaign.connect(creator1).claimFunds())
          .to.emit(campaign, 'FundsClaimed')
          .withArgs(await campaign.getAddress(), anyUint)

        expect(await campaign.hasClaimedFunds()).to.be.true

        const coverRefunds = await campaign.totalAmountRaised()
        const platformShare = aTokenBalanceBeforeClaim - coverRefunds

        const aTokenBalanceAftereClaim = await aToken.balanceOf(
          await campaign.getAddress()
        )

        expect(aTokenBalanceAftereClaim).to.be.closeTo(0, 1)

        const platformTreasuryBalanceAfterClaim = await usdc.balanceOf(
          await platformTreasury.address
        )

        const campaignBalanceAfterClaim = await usdc.balanceOf(
          await campaign.getAddress()
        )

        const ownerBalanceAfterClaim = await usdc.balanceOf(
          await campaign.owner()
        )

        expect(platformTreasuryBalanceAfterClaim).to.be.closeTo(
          platformTreasuryBalanceBeforeClaim + platformShare,
          1
        )

        expect(campaignBalanceAfterClaim).to.be.closeTo(
          campaignBalanceBeforeClaim + coverRefunds,
          1
        )

        expect(ownerBalanceAfterClaim).to.be.equal(ownerBalanceBeforeClaim)

        await expect(campaign.connect(creator1).claimFunds())
          .to.be.revertedWithCustomError(campaign, 'CampaignError')
          .withArgs(ERR_FUNDS_CLAIMED, ethers.ZeroAddress, 0)
      })

      it('Should allow platformAdmin to claim funds after grace period when campaign is successful before campaign end date', async function () {
        const {
          defiIntegrationManager,
          campaign,
          contributor1,
          contributor2,
          usdc,
          IERC20ABI,
          feeManager,
          platformTreasury,
          deployer
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

        await campaign.connect(contributor1).contribute(contributionAmount1)

        await ethers.provider.send('evm_increaseTime', [
          (CAMPAIGN_DURATION - 5) * 24 * 60 * 60
        ])

        await ethers.provider.send('evm_mine')

        await usdc
          .connect(contributor2)
          .approve(await campaign.getAddress(), contributionAmount2)

        await campaign.connect(contributor2).contribute(contributionAmount2)

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

        await expect(campaign.connect(deployer).claimFundsAdmin())
          .to.emit(campaign, 'FundsClaimed')
          .withArgs(await campaign.getAddress(), anyUint)

        expect(await campaign.hasClaimedFunds()).to.be.true

        const { creatorShare, platformShare } =
          await feeManager.calculateFeeShares(aTokenBalanceBeforeClaim)

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

        await expect(campaign.connect(deployer).claimFundsAdmin())
          .to.be.revertedWithCustomError(campaign, 'CampaignError')
          .withArgs(ERR_FUNDS_CLAIMED, ethers.ZeroAddress, 0)
      })

      it('Should allow platformAdmin to claim funds when campaign is unsuccessful and distribute funds correctly', async function () {
        const {
          defiIntegrationManager,
          campaign,
          contributor1,
          contributor2,
          usdc,
          IERC20ABI,
          platformTreasury,
          deployer //admin
        } = await loadFixture(deployPlatformFixture)

        const usdcAddress = await usdc.getAddress()
        const usdcDecimals = await usdc.decimals()

        const aTokenAddress = await defiIntegrationManager.getATokenAddress(
          usdcAddress
        )

        const aToken = await ethers.getContractAt(IERC20ABI, aTokenAddress)

        const contributionAmount1 = ethers.parseUnits('400', usdcDecimals)
        const contributionAmount2 = ethers.parseUnits('400', usdcDecimals)

        await usdc
          .connect(contributor1)
          .approve(await campaign.getAddress(), contributionAmount1)

        await campaign.connect(contributor1).contribute(contributionAmount1)

        await usdc
          .connect(contributor2)
          .approve(await campaign.getAddress(), contributionAmount2)

        await campaign.connect(contributor2).contribute(contributionAmount2)

        await ethers.provider.send('evm_increaseTime', [
          CAMPAIGN_DURATION * 24 * 60 * 60
        ])

        await ethers.provider.send('evm_mine')

        expect(await campaign.isCampaignActive()).to.be.false //Not past campaign end date
        expect(await campaign.isCampaignSuccessful()).to.be.false

        const aTokenBalanceBeforeClaim = await aToken.balanceOf(
          await campaign.getAddress()
        )

        const platformTreasuryBalanceBeforeClaim = await usdc.balanceOf(
          platformTreasury.address
        )

        const campaignBalanceBeforeClaim = await usdc.balanceOf(
          await campaign.getAddress()
        )

        const ownerBalanceBeforeClaim = await usdc.balanceOf(
          await campaign.owner()
        )

        expect(aTokenBalanceBeforeClaim).to.be.greaterThan(0)

        expect(await campaign.hasClaimedFunds()).to.be.false

        await expect(campaign.connect(deployer).claimFundsAdmin())
          .to.emit(campaign, 'FundsClaimed')
          .withArgs(await campaign.getAddress(), anyUint)

        expect(await campaign.hasClaimedFunds()).to.be.true

        const coverRefunds = await campaign.totalAmountRaised()
        const platformShare = aTokenBalanceBeforeClaim - coverRefunds

        const aTokenBalanceAftereClaim = await aToken.balanceOf(
          await campaign.getAddress()
        )

        expect(aTokenBalanceAftereClaim).to.be.closeTo(0, 1)

        const platformTreasuryBalanceAfterClaim = await usdc.balanceOf(
          await platformTreasury.address
        )

        const campaignBalanceAfterClaim = await usdc.balanceOf(
          await campaign.getAddress()
        )

        const ownerBalanceAfterClaim = await usdc.balanceOf(
          await campaign.owner()
        )

        expect(platformTreasuryBalanceAfterClaim).to.be.closeTo(
          platformTreasuryBalanceBeforeClaim + platformShare,
          1
        )

        expect(campaignBalanceAfterClaim).to.be.closeTo(
          campaignBalanceBeforeClaim + coverRefunds,
          1
        )

        expect(ownerBalanceAfterClaim).to.be.equal(ownerBalanceBeforeClaim)

        await expect(campaign.connect(deployer).claimFundsAdmin())
          .to.be.revertedWithCustomError(campaign, 'CampaignError')
          .withArgs(ERR_FUNDS_CLAIMED, ethers.ZeroAddress, 0)
      })

      it('Should allow platformAdmin to claim funds when admin override is active', async function () {
        const {
          defiIntegrationManager,
          campaign,
          contributor1,
          contributor2,
          usdc,
          IERC20ABI,
          platformTreasury,
          deployer //admin
        } = await loadFixture(deployPlatformFixture)

        const usdcAddress = await usdc.getAddress()
        const usdcDecimals = await usdc.decimals()

        const aTokenAddress = await defiIntegrationManager.getATokenAddress(
          usdcAddress
        )

        const aToken = await ethers.getContractAt(IERC20ABI, aTokenAddress)

        const contributionAmount1 = ethers.parseUnits('400', usdcDecimals)
        const contributionAmount2 = ethers.parseUnits('400', usdcDecimals)

        await usdc
          .connect(contributor1)
          .approve(await campaign.getAddress(), contributionAmount1)

        await campaign.connect(contributor1).contribute(contributionAmount1)

        await usdc
          .connect(contributor2)
          .approve(await campaign.getAddress(), contributionAmount2)

        await campaign.connect(contributor2).contribute(contributionAmount2)

        await ethers.provider.send('evm_mine')

        expect(await campaign.isCampaignActive()).to.be.true //Not past campaign end date
        expect(await campaign.isCampaignSuccessful()).to.be.false

        const aTokenBalanceBeforeClaim = await aToken.balanceOf(
          await campaign.getAddress()
        )

        const platformTreasuryBalanceBeforeClaim = await usdc.balanceOf(
          platformTreasury.address
        )

        const campaignBalanceBeforeClaim = await usdc.balanceOf(
          await campaign.getAddress()
        )

        const ownerBalanceBeforeClaim = await usdc.balanceOf(
          await campaign.owner()
        )

        expect(aTokenBalanceBeforeClaim).to.be.greaterThan(0)

        expect(await campaign.hasClaimedFunds()).to.be.false

        await campaign.connect(deployer).setAdminOverride(true)

        await expect(campaign.connect(deployer).claimFundsAdmin())
          .to.emit(campaign, 'FundsClaimed')
          .withArgs(await campaign.getAddress(), anyUint)

        expect(await campaign.hasClaimedFunds()).to.be.true

        const coverRefunds = await campaign.totalAmountRaised()
        const platformShare = aTokenBalanceBeforeClaim - coverRefunds

        const aTokenBalanceAftereClaim = await aToken.balanceOf(
          await campaign.getAddress()
        )

        expect(aTokenBalanceAftereClaim).to.be.closeTo(0, 5)

        const platformTreasuryBalanceAfterClaim = await usdc.balanceOf(
          await platformTreasury.address
        )

        const campaignBalanceAfterClaim = await usdc.balanceOf(
          await campaign.getAddress()
        )

        const ownerBalanceAfterClaim = await usdc.balanceOf(
          await campaign.owner()
        )

        expect(platformTreasuryBalanceAfterClaim).to.be.closeTo(
          platformTreasuryBalanceBeforeClaim + platformShare,
          5
        )

        expect(campaignBalanceAfterClaim).to.be.closeTo(
          campaignBalanceBeforeClaim + coverRefunds,
          5
        )

        expect(ownerBalanceAfterClaim).to.be.equal(ownerBalanceBeforeClaim)

        await expect(campaign.connect(deployer).claimFundsAdmin())
          .to.be.revertedWithCustomError(campaign, 'CampaignError')
          .withArgs(ERR_FUNDS_CLAIMED, ethers.ZeroAddress, 0)
      })

      it('Should prevent creator from claiming funds when admin override is active', async function () {
        const {
          defiIntegrationManager,
          campaign,
          contributor1,
          contributor2,
          usdc,
          creator1,
          deployer
        } = await loadFixture(deployPlatformFixture)

        const usdcAddress = await usdc.getAddress()
        const usdcDecimals = await usdc.decimals()

        const aTokenAddress = await defiIntegrationManager.getATokenAddress(
          usdcAddress
        )

        const contributionAmount1 = ethers.parseUnits('400', usdcDecimals)
        const contributionAmount2 = ethers.parseUnits('650', usdcDecimals)

        await usdc
          .connect(contributor1)
          .approve(await campaign.getAddress(), contributionAmount1)

        await campaign.connect(contributor1).contribute(contributionAmount1)

        await ethers.provider.send('evm_increaseTime', [
          (CAMPAIGN_DURATION - 5) * 24 * 60 * 60
        ])

        await ethers.provider.send('evm_mine')

        await usdc
          .connect(contributor2)
          .approve(await campaign.getAddress(), contributionAmount2)

        await campaign.connect(contributor2).contribute(contributionAmount2)

        await campaign.connect(deployer).setAdminOverride(true)

        expect(await campaign.isCampaignActive()).to.be.false //Override sets this to false
        expect(await campaign.isCampaignSuccessful()).to.be.true

        expect(await campaign.hasClaimedFunds()).to.be.false

        await expect(campaign.connect(creator1).claimFunds())
          .to.be.revertedWithCustomError(campaign, 'CampaignError')
          .withArgs(ERR_ADMIN_OVERRIDE_ACTIVE, ethers.ZeroAddress, 0)

        expect(await campaign.hasClaimedFunds()).to.be.false
      })

      it('Should prevent owner from claiming funds when if campaign is still active but has not reached goal', async function () {
        const {
          defiIntegrationManager,
          campaign,
          contributor1,
          contributor2,
          usdc,
          creator1,
          IERC20ABI,
          feeManager,
          platformTreasury
        } = await loadFixture(deployPlatformFixture)

        const usdcAddress = await usdc.getAddress()
        const usdcDecimals = await usdc.decimals()

        const aTokenAddress = await defiIntegrationManager.getATokenAddress(
          usdcAddress
        )

        const aToken = await ethers.getContractAt(IERC20ABI, aTokenAddress)

        const contributionAmount1 = ethers.parseUnits('400', usdcDecimals)
        const contributionAmount2 = ethers.parseUnits('450', usdcDecimals)

        await usdc
          .connect(contributor1)
          .approve(await campaign.getAddress(), contributionAmount1)

        await campaign.connect(contributor1).contribute(contributionAmount1)

        await ethers.provider.send('evm_increaseTime', [
          (CAMPAIGN_DURATION - 5) * 24 * 60 * 60
        ])

        await ethers.provider.send('evm_mine')

        await usdc
          .connect(contributor2)
          .approve(await campaign.getAddress(), contributionAmount2)

        await campaign.connect(contributor2).contribute(contributionAmount2)

        expect(await campaign.isCampaignActive()).to.be.true //Not past campaign end date
        expect(await campaign.isCampaignSuccessful()).to.be.false

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
          .to.be.revertedWithCustomError(campaign, 'CampaignError')
          .withArgs(ERR_CAMPAIGN_STILL_ACTIVE, ethers.ZeroAddress, 0)

        expect(await campaign.hasClaimedFunds()).to.be.false

        const aTokenBalanceAftereClaim = await aToken.balanceOf(
          await campaign.getAddress()
        )

        expect(aTokenBalanceAftereClaim).to.be.closeTo(
          aTokenBalanceBeforeClaim,
          10
        )

        const platformTreasuryBalanceAfterClaim = await usdc.balanceOf(
          await platformTreasury.address
        )

        const creatorBalanceAfterClaim = await usdc.balanceOf(
          await campaign.owner()
        )

        expect(platformTreasuryBalanceAfterClaim).to.equal(
          platformTreasuryBalanceBeforeClaim
        )

        expect(creatorBalanceAfterClaim).to.equal(creatorBalanceBeforeClaim)
      })

      it('Should allow owner to claim funds when campaign is successful before campaign end date', async function () {
        const {
          defiIntegrationManager,
          campaign,
          contributor1,
          contributor2,
          usdc,
          creator1,
          IERC20ABI,
          feeManager,
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

        await campaign.connect(contributor1).contribute(contributionAmount1)

        await ethers.provider.send('evm_increaseTime', [
          (CAMPAIGN_DURATION - 5) * 24 * 60 * 60
        ])

        await ethers.provider.send('evm_mine')

        await usdc
          .connect(contributor2)
          .approve(await campaign.getAddress(), contributionAmount2)

        await campaign.connect(contributor2).contribute(contributionAmount2)

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
          await feeManager.calculateFeeShares(aTokenBalanceBeforeClaim)

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

      it('Should allow owner to claim funds when campaign is unsuccessful and distribute funds correctly', async function () {
        const {
          defiIntegrationManager,
          campaign,
          contributor1,
          contributor2,
          usdc,
          creator1,
          IERC20ABI,
          platformTreasury
        } = await loadFixture(deployPlatformFixture)

        const usdcAddress = await usdc.getAddress()
        const usdcDecimals = await usdc.decimals()

        const aTokenAddress = await defiIntegrationManager.getATokenAddress(
          usdcAddress
        )

        const aToken = await ethers.getContractAt(IERC20ABI, aTokenAddress)

        const contributionAmount1 = ethers.parseUnits('400', usdcDecimals)
        const contributionAmount2 = ethers.parseUnits('400', usdcDecimals)

        await usdc
          .connect(contributor1)
          .approve(await campaign.getAddress(), contributionAmount1)

        await campaign.connect(contributor1).contribute(contributionAmount1)

        await usdc
          .connect(contributor2)
          .approve(await campaign.getAddress(), contributionAmount2)

        await campaign.connect(contributor2).contribute(contributionAmount2)

        await ethers.provider.send('evm_increaseTime', [
          CAMPAIGN_DURATION * 24 * 60 * 60
        ])

        await ethers.provider.send('evm_mine')

        expect(await campaign.isCampaignActive()).to.be.false //Not past campaign end date
        expect(await campaign.isCampaignSuccessful()).to.be.false

        const aTokenBalanceBeforeClaim = await aToken.balanceOf(
          await campaign.getAddress()
        )

        const platformTreasuryBalanceBeforeClaim = await usdc.balanceOf(
          platformTreasury.address
        )

        const campaignBalanceBeforeClaim = await usdc.balanceOf(
          await campaign.getAddress()
        )

        const ownerBalanceBeforeClaim = await usdc.balanceOf(
          await campaign.owner()
        )

        expect(aTokenBalanceBeforeClaim).to.be.greaterThan(0)

        expect(await campaign.hasClaimedFunds()).to.be.false

        await expect(campaign.connect(creator1).claimFunds())
          .to.emit(campaign, 'FundsClaimed')
          .withArgs(await campaign.getAddress(), anyUint)

        expect(await campaign.hasClaimedFunds()).to.be.true

        const coverRefunds = await campaign.totalAmountRaised()
        const platformShare = aTokenBalanceBeforeClaim - coverRefunds

        const aTokenBalanceAftereClaim = await aToken.balanceOf(
          await campaign.getAddress()
        )

        expect(aTokenBalanceAftereClaim).to.be.closeTo(0, 1)

        const platformTreasuryBalanceAfterClaim = await usdc.balanceOf(
          await platformTreasury.address
        )

        const campaignBalanceAfterClaim = await usdc.balanceOf(
          await campaign.getAddress()
        )

        const ownerBalanceAfterClaim = await usdc.balanceOf(
          await campaign.owner()
        )

        expect(platformTreasuryBalanceAfterClaim).to.be.closeTo(
          platformTreasuryBalanceBeforeClaim + platformShare,
          1
        )

        expect(campaignBalanceAfterClaim).to.be.closeTo(
          campaignBalanceBeforeClaim + coverRefunds,
          1
        )

        expect(ownerBalanceAfterClaim).to.be.equal(ownerBalanceBeforeClaim)

        await expect(campaign.connect(creator1).claimFunds())
          .to.be.revertedWithCustomError(campaign, 'CampaignError')
          .withArgs(ERR_FUNDS_CLAIMED, ethers.ZeroAddress, 0)
      })

      it('Should allow platformAdmin to claim funds after grace period when campaign is successful before campaign end date', async function () {
        const {
          defiIntegrationManager,
          campaign,
          contributor1,
          contributor2,
          usdc,
          IERC20ABI,
          feeManager,
          platformTreasury,
          deployer
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

        await campaign.connect(contributor1).contribute(contributionAmount1)

        await ethers.provider.send('evm_increaseTime', [
          (CAMPAIGN_DURATION - 5) * 24 * 60 * 60
        ])

        await ethers.provider.send('evm_mine')

        await usdc
          .connect(contributor2)
          .approve(await campaign.getAddress(), contributionAmount2)

        await campaign.connect(contributor2).contribute(contributionAmount2)

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

        await expect(campaign.connect(deployer).claimFundsAdmin())
          .to.emit(campaign, 'FundsClaimed')
          .withArgs(await campaign.getAddress(), anyUint)

        expect(await campaign.hasClaimedFunds()).to.be.true

        const { creatorShare, platformShare } =
          await feeManager.calculateFeeShares(aTokenBalanceBeforeClaim)

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

        await expect(campaign.connect(deployer).claimFundsAdmin())
          .to.be.revertedWithCustomError(campaign, 'CampaignError')
          .withArgs(ERR_FUNDS_CLAIMED, ethers.ZeroAddress, 0)
      })

      it('Should allow platformAdmin to claim funds when campaign is unsuccessful and distribute funds correctly', async function () {
        const {
          defiIntegrationManager,
          campaign,
          contributor1,
          contributor2,
          usdc,
          IERC20ABI,
          platformTreasury,
          deployer //admin
        } = await loadFixture(deployPlatformFixture)

        const usdcAddress = await usdc.getAddress()
        const usdcDecimals = await usdc.decimals()

        const aTokenAddress = await defiIntegrationManager.getATokenAddress(
          usdcAddress
        )

        const aToken = await ethers.getContractAt(IERC20ABI, aTokenAddress)

        const contributionAmount1 = ethers.parseUnits('400', usdcDecimals)
        const contributionAmount2 = ethers.parseUnits('400', usdcDecimals)

        await usdc
          .connect(contributor1)
          .approve(await campaign.getAddress(), contributionAmount1)

        await campaign.connect(contributor1).contribute(contributionAmount1)

        await usdc
          .connect(contributor2)
          .approve(await campaign.getAddress(), contributionAmount2)

        await campaign.connect(contributor2).contribute(contributionAmount2)

        await ethers.provider.send('evm_increaseTime', [
          CAMPAIGN_DURATION * 24 * 60 * 60
        ])

        await ethers.provider.send('evm_mine')

        expect(await campaign.isCampaignActive()).to.be.false //Not past campaign end date
        expect(await campaign.isCampaignSuccessful()).to.be.false

        const aTokenBalanceBeforeClaim = await aToken.balanceOf(
          await campaign.getAddress()
        )

        const platformTreasuryBalanceBeforeClaim = await usdc.balanceOf(
          platformTreasury.address
        )

        const campaignBalanceBeforeClaim = await usdc.balanceOf(
          await campaign.getAddress()
        )

        const ownerBalanceBeforeClaim = await usdc.balanceOf(
          await campaign.owner()
        )

        expect(aTokenBalanceBeforeClaim).to.be.greaterThan(0)

        expect(await campaign.hasClaimedFunds()).to.be.false

        await expect(campaign.connect(deployer).claimFundsAdmin())
          .to.emit(campaign, 'FundsClaimed')
          .withArgs(await campaign.getAddress(), anyUint)

        expect(await campaign.hasClaimedFunds()).to.be.true

        const coverRefunds = await campaign.totalAmountRaised()
        const platformShare = aTokenBalanceBeforeClaim - coverRefunds

        const aTokenBalanceAftereClaim = await aToken.balanceOf(
          await campaign.getAddress()
        )

        expect(aTokenBalanceAftereClaim).to.be.closeTo(0, 1)

        const platformTreasuryBalanceAfterClaim = await usdc.balanceOf(
          await platformTreasury.address
        )

        const campaignBalanceAfterClaim = await usdc.balanceOf(
          await campaign.getAddress()
        )

        const ownerBalanceAfterClaim = await usdc.balanceOf(
          await campaign.owner()
        )

        expect(platformTreasuryBalanceAfterClaim).to.be.closeTo(
          platformTreasuryBalanceBeforeClaim + platformShare,
          1
        )

        expect(campaignBalanceAfterClaim).to.be.closeTo(
          campaignBalanceBeforeClaim + coverRefunds,
          1
        )

        expect(ownerBalanceAfterClaim).to.be.equal(ownerBalanceBeforeClaim)

        await expect(campaign.connect(deployer).claimFundsAdmin())
          .to.be.revertedWithCustomError(campaign, 'CampaignError')
          .withArgs(ERR_FUNDS_CLAIMED, ethers.ZeroAddress, 0)
      })

      it('Should allow platformAdmin to claim funds when admin override is active', async function () {
        const {
          defiIntegrationManager,
          campaign,
          contributor1,
          contributor2,
          usdc,
          IERC20ABI,
          platformTreasury,
          deployer //admin
        } = await loadFixture(deployPlatformFixture)

        const usdcAddress = await usdc.getAddress()
        const usdcDecimals = await usdc.decimals()

        const aTokenAddress = await defiIntegrationManager.getATokenAddress(
          usdcAddress
        )

        const aToken = await ethers.getContractAt(IERC20ABI, aTokenAddress)

        const contributionAmount1 = ethers.parseUnits('400', usdcDecimals)
        const contributionAmount2 = ethers.parseUnits('400', usdcDecimals)

        await usdc
          .connect(contributor1)
          .approve(await campaign.getAddress(), contributionAmount1)

        await campaign.connect(contributor1).contribute(contributionAmount1)

        await usdc
          .connect(contributor2)
          .approve(await campaign.getAddress(), contributionAmount2)

        await campaign.connect(contributor2).contribute(contributionAmount2)

        await ethers.provider.send('evm_mine')

        expect(await campaign.isCampaignActive()).to.be.true //Not past campaign end date
        expect(await campaign.isCampaignSuccessful()).to.be.false

        const aTokenBalanceBeforeClaim = await aToken.balanceOf(
          await campaign.getAddress()
        )

        const platformTreasuryBalanceBeforeClaim = await usdc.balanceOf(
          platformTreasury.address
        )

        const campaignBalanceBeforeClaim = await usdc.balanceOf(
          await campaign.getAddress()
        )

        const ownerBalanceBeforeClaim = await usdc.balanceOf(
          await campaign.owner()
        )

        expect(aTokenBalanceBeforeClaim).to.be.greaterThan(0)

        expect(await campaign.hasClaimedFunds()).to.be.false

        await campaign.connect(deployer).setAdminOverride(true)

        await expect(campaign.connect(deployer).claimFundsAdmin())
          .to.emit(campaign, 'FundsClaimed')
          .withArgs(await campaign.getAddress(), anyUint)

        expect(await campaign.hasClaimedFunds()).to.be.true

        const coverRefunds = await campaign.totalAmountRaised()
        const platformShare = aTokenBalanceBeforeClaim - coverRefunds

        const aTokenBalanceAftereClaim = await aToken.balanceOf(
          await campaign.getAddress()
        )

        expect(aTokenBalanceAftereClaim).to.be.closeTo(0, 5)

        const platformTreasuryBalanceAfterClaim = await usdc.balanceOf(
          await platformTreasury.address
        )

        const campaignBalanceAfterClaim = await usdc.balanceOf(
          await campaign.getAddress()
        )

        const ownerBalanceAfterClaim = await usdc.balanceOf(
          await campaign.owner()
        )

        expect(platformTreasuryBalanceAfterClaim).to.be.closeTo(
          platformTreasuryBalanceBeforeClaim + platformShare,
          5
        )

        expect(campaignBalanceAfterClaim).to.be.closeTo(
          campaignBalanceBeforeClaim + coverRefunds,
          5
        )

        expect(ownerBalanceAfterClaim).to.be.equal(ownerBalanceBeforeClaim)

        await expect(campaign.connect(deployer).claimFundsAdmin())
          .to.be.revertedWithCustomError(campaign, 'CampaignError')
          .withArgs(ERR_FUNDS_CLAIMED, ethers.ZeroAddress, 0)
      })

      it('Should prevent creator from claiming funds when admin override is active', async function () {
        const {
          defiIntegrationManager,
          campaign,
          contributor1,
          contributor2,
          usdc,
          creator1,
          deployer
        } = await loadFixture(deployPlatformFixture)

        const usdcAddress = await usdc.getAddress()
        const usdcDecimals = await usdc.decimals()

        const aTokenAddress = await defiIntegrationManager.getATokenAddress(
          usdcAddress
        )

        const contributionAmount1 = ethers.parseUnits('400', usdcDecimals)
        const contributionAmount2 = ethers.parseUnits('650', usdcDecimals)

        await usdc
          .connect(contributor1)
          .approve(await campaign.getAddress(), contributionAmount1)

        await campaign.connect(contributor1).contribute(contributionAmount1)

        await ethers.provider.send('evm_increaseTime', [
          (CAMPAIGN_DURATION - 5) * 24 * 60 * 60
        ])

        await ethers.provider.send('evm_mine')

        await usdc
          .connect(contributor2)
          .approve(await campaign.getAddress(), contributionAmount2)

        await campaign.connect(contributor2).contribute(contributionAmount2)

        await campaign.connect(deployer).setAdminOverride(true)

        expect(await campaign.isCampaignActive()).to.be.false //Override sets this to false
        expect(await campaign.isCampaignSuccessful()).to.be.true

        expect(await campaign.hasClaimedFunds()).to.be.false

        await expect(campaign.connect(creator1).claimFunds())
          .to.be.revertedWithCustomError(campaign, 'CampaignError')
          .withArgs(ERR_ADMIN_OVERRIDE_ACTIVE, ethers.ZeroAddress, 0)

        expect(await campaign.hasClaimedFunds()).to.be.false
      })

      it('Should revert if a random user tries to claim funds', async function () {
        const {
          defiIntegrationManager,
          campaign,
          contributor1,
          contributor2,
          usdc,
          creator1,
          deployer,
          creator2
        } = await loadFixture(deployPlatformFixture)

        const usdcAddress = await usdc.getAddress()
        const usdcDecimals = await usdc.decimals()

        const aTokenAddress = await defiIntegrationManager.getATokenAddress(
          usdcAddress
        )

        const contributionAmount1 = ethers.parseUnits('400', usdcDecimals)
        const contributionAmount2 = ethers.parseUnits('650', usdcDecimals)

        await usdc
          .connect(contributor1)
          .approve(await campaign.getAddress(), contributionAmount1)

        await campaign.connect(contributor1).contribute(contributionAmount1)

        await ethers.provider.send('evm_increaseTime', [
          (CAMPAIGN_DURATION - 5) * 24 * 60 * 60
        ])

        await ethers.provider.send('evm_mine')

        await usdc
          .connect(contributor2)
          .approve(await campaign.getAddress(), contributionAmount2)

        await campaign.connect(contributor2).contribute(contributionAmount2)

        expect(await campaign.isCampaignActive()).to.be.true //Override sets this to false
        expect(await campaign.isCampaignSuccessful()).to.be.true

        expect(await campaign.hasClaimedFunds()).to.be.false

        await expect(campaign.connect(creator2).claimFunds())
          .to.be.revertedWithCustomError(campaign, 'OwnableUnauthorizedAccount')
          .withArgs(creator2.address)

        expect(await campaign.hasClaimedFunds()).to.be.false

        await expect(campaign.connect(creator2).claimFunds())
          .to.be.revertedWithCustomError(campaign, 'OwnableUnauthorizedAccount')
          .withArgs(creator2.address)

        await campaign.connect(deployer).setAdminOverride(true)

        await expect(campaign.connect(creator2).claimFunds())
          .to.be.revertedWithCustomError(campaign, 'OwnableUnauthorizedAccount')
          .withArgs(creator2.address)

        expect(await campaign.hasClaimedFunds()).to.be.false

        await expect(campaign.connect(creator2).claimFunds())
          .to.be.revertedWithCustomError(campaign, 'OwnableUnauthorizedAccount')
          .withArgs(creator2.address)
      })
    })

    describe('Refunds', function () {
      it('Should allow successful refund when campaign is over and goal not reached', async function () {
        const { campaign, contributor1, contributor2, usdc, creator1 } =
          await loadFixture(deployPlatformFixture)

        const usdcAddress = await usdc.getAddress()
        const usdcDecimals = await usdc.decimals()

        const contributionAmount1 = ethers.parseUnits('400', usdcDecimals)
        const contributionAmount2 = ethers.parseUnits('400', usdcDecimals)

        await usdc
          .connect(contributor1)
          .approve(await campaign.getAddress(), contributionAmount1)

        await campaign.connect(contributor1).contribute(contributionAmount1)

        await usdc
          .connect(contributor2)
          .approve(await campaign.getAddress(), contributionAmount2)

        await campaign.connect(contributor2).contribute(contributionAmount2)

        await ethers.provider.send('evm_increaseTime', [
          CAMPAIGN_DURATION * 24 * 60 * 60
        ])

        await ethers.provider.send('evm_mine')

        expect(await campaign.isCampaignActive()).to.be.false
        expect(await campaign.isCampaignSuccessful()).to.be.false

        const campaignBalanceBeforeClaim = await usdc.balanceOf(
          await campaign.getAddress()
        )

        await campaign.connect(creator1).claimFunds()

        const totalAmountRaised = await campaign.totalAmountRaised()

        expect(await usdc.balanceOf(await campaign.getAddress())).to.equal(
          totalAmountRaised
        )

        const campaignBalanceAfterClaim = await usdc.balanceOf(
          await campaign.getAddress()
        )

        expect(campaignBalanceAfterClaim).to.equal(
          campaignBalanceBeforeClaim + totalAmountRaised
        )

        const contributor1BalanceBeforeRefund = await usdc.balanceOf(
          contributor1.address
        )

        await expect(campaign.connect(contributor1).requestRefund())
          .to.emit(campaign, 'RefundIssued')
          .withArgs(contributor1.address, contributionAmount1)

        expect(await campaign.hasBeenRefunded(contributor1.address)).to.be.true
        expect(await campaign.contributions(contributor1.address)).to.equal(0)

        const contributor1BalanceAfterRefund = await usdc.balanceOf(
          contributor1.address
        )

        expect(contributor1BalanceAfterRefund).to.equal(
          contributor1BalanceBeforeRefund + contributionAmount1
        )

        const campaignBalanceAfterRefund1 = await usdc.balanceOf(
          await campaign.getAddress()
        )

        expect(campaignBalanceAfterRefund1).to.equal(
          campaignBalanceAfterClaim - contributionAmount1
        )

        const contributor2BalanceBeforeRefund = await usdc.balanceOf(
          contributor2.address
        )

        await expect(campaign.connect(contributor2).requestRefund())
          .to.emit(campaign, 'RefundIssued')
          .withArgs(contributor2.address, contributionAmount2)

        expect(await campaign.hasBeenRefunded(contributor2.address)).to.be.true
        expect(await campaign.contributions(contributor2.address)).to.equal(0)

        const contributor2BalanceAfterRefund = await usdc.balanceOf(
          contributor2.address
        )

        expect(contributor2BalanceAfterRefund).to.equal(
          contributor2BalanceBeforeRefund + contributionAmount2
        )

        const campaignBalanceAfterRefund2 = await usdc.balanceOf(
          await campaign.getAddress()
        )

        expect(campaignBalanceAfterRefund2).to.equal(
          campaignBalanceAfterClaim - contributionAmount1 - contributionAmount2
        )

        await expect(campaign.connect(contributor1).requestRefund())
          .to.be.revertedWithCustomError(campaign, 'CampaignError')
          .withArgs(ERR_ALREADY_REFUNDED, contributor1.address, 0)

        await expect(campaign.connect(contributor2).requestRefund())
          .to.be.revertedWithCustomError(campaign, 'CampaignError')
          .withArgs(ERR_ALREADY_REFUNDED, contributor2.address, 0)
      })

      it('Should revert when trying to request refund before funds have been claimed', async function () {
        const { campaign, contributor1, contributor2, usdc } =
          await loadFixture(deployPlatformFixture)

        const usdcAddress = await usdc.getAddress()
        const usdcDecimals = await usdc.decimals()

        const contributionAmount1 = ethers.parseUnits('400', usdcDecimals)
        const contributionAmount2 = ethers.parseUnits('400', usdcDecimals)

        await usdc
          .connect(contributor1)
          .approve(await campaign.getAddress(), contributionAmount1)

        await campaign.connect(contributor1).contribute(contributionAmount1)

        await usdc
          .connect(contributor2)
          .approve(await campaign.getAddress(), contributionAmount2)

        await campaign.connect(contributor2).contribute(contributionAmount2)

        await ethers.provider.send('evm_increaseTime', [
          CAMPAIGN_DURATION * 24 * 60 * 60
        ])

        await ethers.provider.send('evm_mine')

        expect(await campaign.isCampaignActive()).to.be.false
        expect(await campaign.isCampaignSuccessful()).to.be.false

        await expect(campaign.connect(contributor1).requestRefund())
          .to.be.revertedWithCustomError(campaign, 'CampaignError')
          .withArgs(ERR_FUNDS_NOT_CLAIMED, ethers.ZeroAddress, 0)

        expect(await campaign.hasBeenRefunded(contributor1.address)).to.be.false
        expect(await campaign.contributions(contributor1.address)).to.equal(
          contributionAmount1
        )

        await expect(campaign.connect(contributor2).requestRefund())
          .to.be.revertedWithCustomError(campaign, 'CampaignError')
          .withArgs(ERR_FUNDS_NOT_CLAIMED, ethers.ZeroAddress, 0)

        expect(await campaign.hasBeenRefunded(contributor2.address)).to.be.false
        expect(await campaign.contributions(contributor2.address)).to.equal(
          contributionAmount2
        )
      })

      it('Should revert if contributor has made no contributions', async function () {
        const { campaign, contributor1, contributor2, usdc, creator1 } =
          await loadFixture(deployPlatformFixture)

        const usdcAddress = await usdc.getAddress()
        const usdcDecimals = await usdc.decimals()

        const contributionAmount1 = ethers.parseUnits('400', usdcDecimals)
        const contributionAmount2 = ethers.parseUnits('400', usdcDecimals)

        await usdc
          .connect(contributor1)
          .approve(await campaign.getAddress(), contributionAmount1)

        await campaign.connect(contributor1).contribute(contributionAmount1)

        await ethers.provider.send('evm_increaseTime', [
          CAMPAIGN_DURATION * 24 * 60 * 60
        ])

        await ethers.provider.send('evm_mine')

        expect(await campaign.isCampaignActive()).to.be.false
        expect(await campaign.isCampaignSuccessful()).to.be.false

        const campaignBalanceBeforeClaim = await usdc.balanceOf(
          await campaign.getAddress()
        )

        await campaign.connect(creator1).claimFunds()

        const totalAmountRaised = await campaign.totalAmountRaised()

        expect(await usdc.balanceOf(await campaign.getAddress())).to.equal(
          totalAmountRaised
        )

        const campaignBalanceAfterClaim = await usdc.balanceOf(
          await campaign.getAddress()
        )

        expect(campaignBalanceAfterClaim).to.equal(
          campaignBalanceBeforeClaim + totalAmountRaised
        )

        const contributor1BalanceBeforeRefund = await usdc.balanceOf(
          contributor1.address
        )

        await expect(campaign.connect(contributor1).requestRefund())
          .to.emit(campaign, 'RefundIssued')
          .withArgs(contributor1.address, contributionAmount1)

        expect(await campaign.hasBeenRefunded(contributor1.address)).to.be.true
        expect(await campaign.contributions(contributor1.address)).to.equal(0)

        const contributor1BalanceAfterRefund = await usdc.balanceOf(
          contributor1.address
        )

        expect(contributor1BalanceAfterRefund).to.equal(
          contributor1BalanceBeforeRefund + contributionAmount1
        )

        const campaignBalanceAfterRefund1 = await usdc.balanceOf(
          await campaign.getAddress()
        )

        expect(campaignBalanceAfterRefund1).to.equal(
          campaignBalanceAfterClaim - contributionAmount1
        )

        const contributor2BalanceBeforeRefund = await usdc.balanceOf(
          contributor2.address
        )

        await expect(campaign.connect(contributor2).requestRefund())
          .to.be.revertedWithCustomError(campaign, 'CampaignError')
          .withArgs(ERR_NOTHING_TO_REFUND, contributor2.address, 0)

        expect(await campaign.hasBeenRefunded(contributor2.address)).to.be.false
        expect(await campaign.contributions(contributor2.address)).to.equal(0)

        const contributor2BalanceAfterRefund = await usdc.balanceOf(
          contributor2.address
        )

        expect(contributor2BalanceAfterRefund).to.equal(
          contributor2BalanceBeforeRefund
        )

        const campaignBalanceAfterRefund2 = await usdc.balanceOf(
          await campaign.getAddress()
        )

        expect(campaignBalanceAfterRefund2).to.equal(
          campaignBalanceAfterClaim - contributionAmount1
        )
      })

      it('Should revert if goal was exceeded ', async function () {
        const { campaign, contributor1, contributor2, usdc, creator1 } =
          await loadFixture(deployPlatformFixture)

        const usdcAddress = await usdc.getAddress()
        const usdcDecimals = await usdc.decimals()

        const contributionAmount1 = ethers.parseUnits('1001', usdcDecimals)

        await usdc
          .connect(contributor1)
          .approve(await campaign.getAddress(), contributionAmount1)

        await campaign.connect(contributor1).contribute(contributionAmount1)

        await ethers.provider.send('evm_increaseTime', [
          (CAMPAIGN_DURATION - 5) * 24 * 60 * 60
        ])

        await ethers.provider.send('evm_mine')

        expect(await campaign.isCampaignActive()).to.be.true
        expect(await campaign.isCampaignSuccessful()).to.be.true

        await campaign.connect(creator1).claimFunds()

        const totalAmountRaised = await campaign.totalAmountRaised()

        const contributor1BalanceBeforeRefund = await usdc.balanceOf(
          contributor1.address
        )

        await expect(campaign.connect(contributor1).requestRefund())
          .to.be.revertedWithCustomError(campaign, 'CampaignError')
          .withArgs(ERR_GOAL_REACHED, ethers.ZeroAddress, totalAmountRaised)

        expect(await campaign.hasBeenRefunded(contributor1.address)).to.be.false
        expect(await campaign.contributions(contributor1.address)).to.equal(
          contributionAmount1
        )

        const contributor1BalanceAfterRefund = await usdc.balanceOf(
          contributor1.address
        )

        expect(contributor1BalanceAfterRefund).to.equal(
          contributor1BalanceBeforeRefund
        )
      })

      it('Should revert campaign is still active but goal has not been reached', async function () {
        const { campaign, contributor1, contributor2, usdc, creator1 } =
          await loadFixture(deployPlatformFixture)

        const usdcAddress = await usdc.getAddress()
        const usdcDecimals = await usdc.decimals()

        const contributionAmount1 = ethers.parseUnits('500', usdcDecimals)

        await usdc
          .connect(contributor1)
          .approve(await campaign.getAddress(), contributionAmount1)

        await campaign.connect(contributor1).contribute(contributionAmount1)

        await ethers.provider.send('evm_increaseTime', [
          (CAMPAIGN_DURATION - 5) * 24 * 60 * 60
        ])

        await ethers.provider.send('evm_mine')

        expect(await campaign.isCampaignActive()).to.be.true
        expect(await campaign.isCampaignSuccessful()).to.be.false

        const contributor1BalanceBeforeRefund = await usdc.balanceOf(
          contributor1.address
        )

        await expect(campaign.connect(contributor1).requestRefund())
          .to.be.revertedWithCustomError(campaign, 'CampaignError')
          .withArgs(ERR_CAMPAIGN_STILL_ACTIVE, ethers.ZeroAddress, 0)

        expect(await campaign.hasBeenRefunded(contributor1.address)).to.be.false
        expect(await campaign.contributions(contributor1.address)).to.equal(
          contributionAmount1
        )

        const contributor1BalanceAfterRefund = await usdc.balanceOf(
          contributor1.address
        )

        expect(contributor1BalanceAfterRefund).to.equal(
          contributor1BalanceBeforeRefund
        )
      })
    })
  })

  describe('Admin Functions', function () {
    it('Should allow other platform admin to set admin override', async function () {
      const { campaign, platformAdmin, deployer, otherAdmin } =
        await loadFixture(deployPlatformFixture)

      // Initially campaign should be active
      expect(await campaign.isCampaignActive()).to.be.true
      expect(await campaign.adminOverride()).to.be.false

      // Set admin override to true

      await expect(campaign.connect(deployer).setAdminOverride(true))
        .to.emit(campaign, 'AdminOverrideSet')
        .withArgs(true, deployer.address)

      // Campaign should now be inactive due to override
      expect(await campaign.isCampaignActive()).to.be.false
      expect(await campaign.adminOverride()).to.be.true

      await expect(campaign.connect(deployer).setAdminOverride(false))
        .to.emit(campaign, 'AdminOverrideSet')
        .withArgs(false, deployer.address)

      expect(await campaign.isCampaignActive()).to.be.true
      expect(await campaign.adminOverride()).to.be.false

      await platformAdmin.connect(deployer).addPlatformAdmin(otherAdmin.address)

      expect(await platformAdmin.isPlatformAdmin(otherAdmin.address)).to.be.true

      await expect(campaign.connect(otherAdmin).setAdminOverride(true))
        .to.emit(campaign, 'AdminOverrideSet')
        .withArgs(true, otherAdmin.address)

      expect(await campaign.isCampaignActive()).to.be.false
      expect(await campaign.adminOverride()).to.be.true
    })

    it('Should revert when non-admin tries to set admin override', async function () {
      const { campaign, creator1 } = await loadFixture(deployPlatformFixture)

      await expect(
        campaign.connect(creator1).setAdminOverride(true)
      ).to.be.revertedWithCustomError(campaign, 'NotAuthorizedAdmin')
    })

    it('Should allow admin to reactivate campaign by removing override', async function () {
      const { campaign, platformAdmin, deployer, contributor1, usdc } =
        await loadFixture(deployPlatformFixture)

      const usdcDecimals = await usdc.decimals()

      // Initially campaign should be active
      expect(await campaign.isCampaignActive()).to.be.true
      expect(await campaign.adminOverride()).to.be.false

      // Set admin override to true

      await campaign.connect(deployer).setAdminOverride(true)

      // Campaign should now be inactive due to override
      expect(await campaign.isCampaignActive()).to.be.false
      expect(await campaign.adminOverride()).to.be.true

      const contributionAmount1 = ethers.parseUnits('400', usdcDecimals)

      await usdc
        .connect(contributor1)
        .approve(await campaign.getAddress(), contributionAmount1)

      await expect(
        campaign.connect(contributor1).contribute(contributionAmount1)
      )
        .to.be.revertedWithCustomError(campaign, 'CampaignError')
        .withArgs(
          ERR_ADMIN_OVERRIDE_ACTIVE,
          ethers.getAddress(await usdc.getAddress()),
          0
        )

      await campaign.connect(deployer).setAdminOverride(false)

      await expect(
        campaign.connect(contributor1).contribute(contributionAmount1)
      )
        .to.emit(campaign, 'Contribution')
        .withArgs(contributor1.address, contributionAmount1)
    })
  })

  describe('Getter Functions', function () {
    it('Should correctly report campaign active status', async function () {
      const { campaign, deployer } = await loadFixture(deployPlatformFixture)

      // Campaign should be active at the start
      expect(await campaign.isCampaignActive()).to.be.true

      // Fast forward to near end but still active
      await ethers.provider.send('evm_increaseTime', [
        (CAMPAIGN_DURATION - 1) * 24 * 60 * 60
      ])
      await ethers.provider.send('evm_mine')
      expect(await campaign.isCampaignActive()).to.be.true

      // Fast forward past end date
      await ethers.provider.send('evm_increaseTime', [2 * 24 * 60 * 60]) // 2 more days
      await ethers.provider.send('evm_mine')
      expect(await campaign.isCampaignActive()).to.be.false
    })

    it('Should report campaign as inactive when admin override is active', async function () {
      const { campaign, deployer } = await loadFixture(deployPlatformFixture)

      // Initially active
      expect(await campaign.isCampaignActive()).to.be.true

      // Set admin override
      await campaign.connect(deployer).setAdminOverride(true)

      // Should now be inactive due to admin override
      expect(await campaign.isCampaignActive()).to.be.false
    })

    it('Should correctly report campaign success status', async function () {
      const { campaign, usdc, contributor1, contributor2 } = await loadFixture(
        deployPlatformFixture
      )

      const usdcDecimals = await usdc.decimals()

      // Initially not successful
      expect(await campaign.isCampaignSuccessful()).to.be.false

      // Contribute half of goal
      const halfGoalAmount = (await campaign.campaignGoalAmount()) / 2n
      await usdc
        .connect(contributor1)
        .approve(await campaign.getAddress(), halfGoalAmount)
      await campaign.connect(contributor1).contribute(halfGoalAmount)

      // Still not successful
      expect(await campaign.isCampaignSuccessful()).to.be.false

      // Contribute remaining amount to reach goal
      const remainingAmount =
        (await campaign.campaignGoalAmount()) - halfGoalAmount
      await usdc
        .connect(contributor2)
        .approve(await campaign.getAddress(), remainingAmount)
      await campaign.connect(contributor2).contribute(remainingAmount)

      // Now should be successful
      expect(await campaign.isCampaignSuccessful()).to.be.true
    })

    it('Should correctly report admin override status', async function () {
      const { campaign, deployer } = await loadFixture(deployPlatformFixture)

      // Initially false
      expect(await campaign.isAdminOverrideActive()).to.be.false

      // Set to true
      await campaign.connect(deployer).setAdminOverride(true)
      expect(await campaign.isAdminOverrideActive()).to.be.true

      // Set back to false
      await campaign.connect(deployer).setAdminOverride(false)
      expect(await campaign.isAdminOverrideActive()).to.be.false
    })

    it('Should correctly report campaign token balance', async function () {
      const { campaign, usdc, contributor1, creator1 } = await loadFixture(
        deployPlatformFixture
      )

      const usdcDecimals = await usdc.decimals()
      const contributionAmount = ethers.parseUnits('100', usdcDecimals)

      // Initial balance should be 0
      expect(await campaign.getCampaignTokenBalance()).to.equal(0)

      // Make campaign successful and claim funds
      const goalAmount = await campaign.campaignGoalAmount()
      await usdc
        .connect(contributor1)
        .approve(await campaign.getAddress(), goalAmount)
      await campaign.connect(contributor1).contribute(goalAmount)

      // Fast forward to end
      await ethers.provider.send('evm_increaseTime', [
        CAMPAIGN_DURATION * 24 * 60 * 60
      ])
      await ethers.provider.send('evm_mine')

      // Claim funds - this should transfer tokens to the campaign contract
      await campaign.connect(creator1).claimFunds()

      // If campaign is successful, funds get transferred to owner so balance should be near 0
      const finalBalance = await campaign.getCampaignTokenBalance()
      expect(finalBalance).to.be.closeTo(0n, 5n)

      // For unsuccessful campaign we could test differently, but that would require a different fixture setup
    })
  })
})
