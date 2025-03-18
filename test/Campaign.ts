import { token } from '../typechain-types/@openzeppelin/contracts'
import { Campaign } from '../typechain-types/contracts/Campaign'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'

describe('Campaign', function () {
  const OP_DEPOSIT = 1
  const OP_HARVEST = 2
  const OP_WITHDRAW = 3
  const OP_WITHDRAW_ALL = 4

  // Error codes - more specific but still compact
  const ERR_INVALID_ADDRESS = 1
  const ERR_TOKEN_NOT_SUPPORTED = 2
  const ERR_INVALID_GOAL = 3
  const ERR_INVALID_DURATION = 4
  const ERR_INVALID_AMOUNT = 5
  const ERR_CAMPAIGN_NOT_ACTIVE = 6
  const ERR_CAMPAIGN_STILL_ACTIVE = 7
  const ERR_GOAL_REACHED = 8
  const ERR_GOAL_NOT_REACHED = 9
  const ERR_ETH_NOT_ACCEPTED = 10
  const ERR_ALREADY_REFUNDED = 11
  const ERR_NOTHING_TO_REFUND = 12
  const ERR_FUNDS_CLAIMED = 13
  const ERR_NO_YIELD = 14
  const ERR_YIELD_CLAIMED = 15
  const ERR_CALCULATION_COMPLETE = 16
  const ERR_WEIGHTED_NOT_CALCULATED = 18

  async function deployCampaignFixture () {
    const CAMPAIGN_GOAL_AMOUNT = 5
    const CAMPAIGN_DURATION = 30
    const GRACE_PERIOD = 7 // 7 days grace period

    const [owner, user1, user2, user3, user4, platformTreasury, otherAdmin] =
      await ethers.getSigners()

    // Deploy mock token
    const mockToken1 = await ethers.deployContract('MockERC20', [
      'Mock Token 1',
      'MT1',
      ethers.parseUnits('100')
    ])
    await mockToken1.waitForDeployment()
    const mockToken1Address = await mockToken1.getAddress()

    const mockToken2 = await ethers.deployContract('MockERC20', [
      'Mock Token 2',
      'MT2',
      ethers.parseUnits('100000')
    ])
    await mockToken2.waitForDeployment()
    const mockToken2Address = await mockToken2.getAddress()

    // Deploy PlatformAdmin contract
    const platformAdmin = await ethers.deployContract('PlatformAdmin', [
      GRACE_PERIOD,
      owner
    ])
    await platformAdmin.waitForDeployment()

    await platformAdmin.addPlatformAdmin(await otherAdmin.getAddress())

    const platformAdminAddress = await platformAdmin.getAddress()

    // Deploy token registry with platform admin
    const tokenRegistry = await ethers.deployContract('TokenRegistry', [
      owner.address,
      platformAdminAddress
    ])
    await tokenRegistry.waitForDeployment()
    const tokenRegistryAddress = await tokenRegistry.getAddress()

    await tokenRegistry.addToken(mockToken1Address, 1)
    await tokenRegistry.addToken(mockToken2Address, 1)

    // Deploy yield distributor with platform admin
    const yieldDistributor = await ethers.deployContract('YieldDistributor', [
      platformTreasury.address,
      platformAdminAddress,
      owner.address
    ])
    await yieldDistributor.waitForDeployment()
    const yieldDistributorAddress = await yieldDistributor.getAddress()

    // REPLACE: Deploy MockDefiManager instead of the real DefiIntegrationManager
    const mockDefiManager = await ethers.deployContract('MockDefiManager', [
      tokenRegistryAddress,
      yieldDistributorAddress,
      platformAdminAddress,
      owner.address
    ])
    await mockDefiManager.waitForDeployment()
    const mockDefiManagerAddress = await mockDefiManager.getAddress()

    // Deploy campaign with platform admin
    const campaign = await ethers.deployContract('Campaign', [
      owner.address,
      mockToken1Address,
      CAMPAIGN_GOAL_AMOUNT,
      CAMPAIGN_DURATION,
      mockDefiManagerAddress,
      platformAdminAddress
    ])
    await campaign.waitForDeployment()

    // Fund the MockDefiManager with the campaign token for swaps
    await mockToken1.transfer(mockDefiManagerAddress, ethers.parseUnits('50'))
    await mockToken2.transfer(mockDefiManagerAddress, ethers.parseUnits('50'))

    // Transfer tokens to users
    await mockToken1.transfer(user1.address, ethers.parseUnits('10'))
    await mockToken1.transfer(user2.address, ethers.parseUnits('10'))
    await mockToken1.transfer(user3.address, ethers.parseUnits('10'))
    await mockToken1.transfer(user4.address, ethers.parseUnits('10'))

    await mockToken2.transfer(user1.address, ethers.parseUnits('10'))
    await mockToken2.transfer(user2.address, ethers.parseUnits('10'))
    await mockToken2.transfer(user3.address, ethers.parseUnits('10'))
    await mockToken2.transfer(user4.address, ethers.parseUnits('10'))

    return {
      owner,
      user1,
      user2,
      user3,
      user4,
      platformTreasury,
      platformAdmin,
      mockToken1,
      mockToken2,
      campaign,
      tokenRegistry,
      mockDefiManager,
      yieldDistributor,
      CAMPAIGN_GOAL_AMOUNT,
      CAMPAIGN_DURATION,
      GRACE_PERIOD,
      otherAdmin
    }
  }

  describe('Deployment', function () {
    it('should deploy all contracts successfully', async function () {
      const { campaign } = await loadFixture(deployCampaignFixture)

      expect(await campaign.getAddress()).to.be.properAddress
    })

    it('Should correctly set the initial state', async function () {
      const {
        campaign,
        owner,
        mockToken1,
        CAMPAIGN_GOAL_AMOUNT,
        CAMPAIGN_DURATION
      } = await loadFixture(deployCampaignFixture)

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

      const mockToken1Address = await mockToken1.getAddress()

      expect(await campaign.owner()).to.equal(owner.address)
      expect(await campaign.campaignToken()).to.equal(mockToken1Address)
      expect(await campaign.campaignGoalAmount()).to.equal(CAMPAIGN_GOAL_AMOUNT)
      expect(await campaign.campaignDuration()).to.equal(CAMPAIGN_DURATION)

      const campaignId = await campaign.campaignId()

      expect(campaignId).to.not.equal(ethers.ZeroHash)

      const secondCheck = await campaign.campaignId()
      expect(campaignId).to.equal(secondCheck)
    })

    it('Should revert if invalid defiManager address is passed to campaign constructor', async function () {
      // Load the fixture to get common components
      const {
        owner,
        platformAdmin,
        mockToken1,
        CAMPAIGN_GOAL_AMOUNT,
        CAMPAIGN_DURATION
      } = await loadFixture(deployCampaignFixture)

      const mockToken1Address = await mockToken1.getAddress()

      // Get the Campaign contract factory
      const CampaignContractFactory = await ethers.getContractFactory(
        'Campaign'
      )

      // Try to deploy with zero address for defiManager (should fail)
      await expect(
        CampaignContractFactory.deploy(
          owner.address,
          mockToken1Address,
          CAMPAIGN_GOAL_AMOUNT,
          CAMPAIGN_DURATION,
          ethers.ZeroAddress, // Invalid defiManager address
          await platformAdmin.getAddress()
        )
      )
        .to.be.revertedWithCustomError(CampaignContractFactory, 'CampaignError')
        .withArgs(ERR_INVALID_ADDRESS, ethers.ZeroAddress, 0)
    })

    it('Should revert if zero address is provided as token', async function () {
      // Load the fixture to get common components
      const {
        owner,
        platformAdmin,
        mockDefiManager,
        CAMPAIGN_GOAL_AMOUNT,
        CAMPAIGN_DURATION
      } = await loadFixture(deployCampaignFixture)

      // Get the Campaign contract factory
      const CampaignContractFactory = await ethers.getContractFactory(
        'Campaign'
      )

      // Try to deploy with zero address for token (should fail)
      await expect(
        CampaignContractFactory.deploy(
          owner.address,
          ethers.ZeroAddress, // Zero address for token
          CAMPAIGN_GOAL_AMOUNT,
          CAMPAIGN_DURATION,
          await mockDefiManager.getAddress(),
          await platformAdmin.getAddress()
        )
      )
        .to.be.revertedWithCustomError(CampaignContractFactory, 'CampaignError')
        .withArgs(ERR_INVALID_ADDRESS, ethers.ZeroAddress, 0)
    })

    it('Should revert if non-supported token address is provided to campaign constructor', async function () {
      // Load the fixture
      const {
        owner,
        tokenRegistry,
        mockDefiManager,
        platformAdmin,
        CAMPAIGN_GOAL_AMOUNT,
        CAMPAIGN_DURATION
      } = await loadFixture(deployCampaignFixture)

      // Deploy a new token that will be marked as not supported
      const unsupportedToken = await ethers.deployContract('MockERC20', [
        'Unsupported Token',
        'UNSUPP',
        ethers.parseUnits('100')
      ])
      await unsupportedToken.waitForDeployment()
      const unsupportedTokenAddress = await unsupportedToken.getAddress()

      // Add token to registry but mark it as unsupported
      await tokenRegistry.addToken(unsupportedTokenAddress, 0)
      await tokenRegistry.disableTokenSupport(unsupportedTokenAddress)

      // Try to deploy campaign with unsupported token
      const CampaignContractFactory = await ethers.getContractFactory(
        'Campaign'
      )
      await expect(
        CampaignContractFactory.deploy(
          owner.address,
          unsupportedTokenAddress,
          CAMPAIGN_GOAL_AMOUNT,
          CAMPAIGN_DURATION,
          await mockDefiManager.getAddress(),
          await platformAdmin.getAddress()
        )
      )
        .to.be.revertedWithCustomError(CampaignContractFactory, 'CampaignError')
        .withArgs(ERR_TOKEN_NOT_SUPPORTED, unsupportedTokenAddress, 0)
    })

    it('Should revert if token address not in registry is provided to campaign constructor', async function () {
      // Load the fixture
      const {
        owner,
        tokenRegistry,
        mockDefiManager,
        platformAdmin,
        CAMPAIGN_GOAL_AMOUNT,
        CAMPAIGN_DURATION
      } = await loadFixture(deployCampaignFixture)

      // Deploy a non-compliant token
      const nonCompliantToken = await ethers.deployContract(
        'MockNonCompliantToken'
      )
      await nonCompliantToken.waitForDeployment()
      const nonCompliantAddress = await nonCompliantToken.getAddress()

      // Try to deploy campaign with non-registered token
      const CampaignContractFactory = await ethers.getContractFactory(
        'Campaign'
      )

      await expect(
        CampaignContractFactory.deploy(
          owner.address,
          nonCompliantAddress,
          CAMPAIGN_GOAL_AMOUNT,
          CAMPAIGN_DURATION,
          await mockDefiManager.getAddress(),
          await platformAdmin.getAddress()
        )
      )
        .to.be.revertedWithCustomError(tokenRegistry, 'TokenRegistryError')
        .withArgs(4, nonCompliantAddress, 0) //ERR comes from token registry contract
    })

    it('Should revert if invalid goal amount is provided to campaign constructor', async function () {
      // Load the fixture
      const {
        owner,
        mockToken1,
        mockDefiManager,
        platformAdmin,
        CAMPAIGN_DURATION
      } = await loadFixture(deployCampaignFixture)

      // Try to deploy campaign with zero goal amount
      const CAMPAIGN_GOAL_AMOUNT = 0
      const CampaignContractFactory = await ethers.getContractFactory(
        'Campaign'
      )

      await expect(
        CampaignContractFactory.deploy(
          owner.address,
          await mockToken1.getAddress(),
          CAMPAIGN_GOAL_AMOUNT,
          CAMPAIGN_DURATION,
          await mockDefiManager.getAddress(),
          await platformAdmin.getAddress()
        )
      )
        .to.be.revertedWithCustomError(CampaignContractFactory, 'CampaignError')
        .withArgs(ERR_INVALID_GOAL, ethers.ZeroAddress, CAMPAIGN_GOAL_AMOUNT)
    })

    it('Should revert if invalid campaign duration is provided to campaign constructor', async function () {
      // Load the fixture
      const {
        owner,
        mockToken1,
        mockDefiManager,
        platformAdmin,
        CAMPAIGN_GOAL_AMOUNT
      } = await loadFixture(deployCampaignFixture)

      // Try to deploy campaign with zero duration
      const CAMPAIGN_DURATION = 0
      const CampaignContractFactory = await ethers.getContractFactory(
        'Campaign'
      )

      await expect(
        CampaignContractFactory.deploy(
          owner.address,
          await mockToken1.getAddress(),
          CAMPAIGN_GOAL_AMOUNT,
          CAMPAIGN_DURATION,
          await mockDefiManager.getAddress(),
          await platformAdmin.getAddress()
        )
      )
        .to.be.revertedWithCustomError(CampaignContractFactory, 'CampaignError')
        .withArgs(ERR_INVALID_DURATION, ethers.ZeroAddress, CAMPAIGN_DURATION)
    })
  })

  describe('Contribution Functions', function () {
    it('Should allow user to contribute ERC20 tokens to an active campaign', async function () {
      const { campaign, mockToken1, user1 } = await loadFixture(
        deployCampaignFixture
      )

      const contributionAmount = 2

      await mockToken1
        .connect(user1)
        .approve(await campaign.getAddress(), contributionAmount)

      const initialBalance = await mockToken1.balanceOf(
        await campaign.getAddress()
      )
      const initialContribution = await campaign.contributions(user1.address)
      const initialTotalRaised = await campaign.totalAmountRaised()

      await expect(
        campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), contributionAmount)
      )
        .to.emit(campaign, 'Contribution')
        .withArgs(user1.address, contributionAmount)

      expect(await mockToken1.balanceOf(await campaign.getAddress())).to.equal(
        initialBalance + BigInt(contributionAmount)
      )
      expect(await campaign.contributions(user1.address)).to.equal(
        initialContribution + BigInt(contributionAmount)
      )
      expect(await campaign.totalAmountRaised()).to.equal(
        initialTotalRaised + BigInt(contributionAmount)
      )
    })

    it('Should allow user to contribute with a different token which gets swapped to campaign token', async function () {
      const { campaign, mockToken1, user1, tokenRegistry, mockDefiManager } =
        await loadFixture(deployCampaignFixture)

      const mockToken2 = await ethers.deployContract('MockERC20', [
        'Second Token',
        'TKN2',
        ethers.parseUnits('100')
      ])
      await mockToken2.waitForDeployment()
      const token2Address = await mockToken2.getAddress()
      await tokenRegistry.addToken(token2Address, 1)

      await mockToken2.transfer(user1.address, ethers.parseUnits('10'))

      const contributionAmount = 2
      const expectedSwappedAmount = contributionAmount * 2

      await mockToken1.transfer(
        await mockDefiManager.getAddress(),
        expectedSwappedAmount
      )

      await mockToken2
        .connect(user1)
        .approve(await campaign.getAddress(), contributionAmount)

      const initialCampaignToken1Balance = await mockToken1.balanceOf(
        await campaign.getAddress()
      )
      const initialCampaignToken2Balance = await mockToken2.balanceOf(
        await campaign.getAddress()
      )
      const initialContribution = await campaign.contributions(user1.address)
      const initialTotalRaised = await campaign.totalAmountRaised()

      const tx = await campaign
        .connect(user1)
        .contribute(token2Address, contributionAmount)

      await expect(tx)
        .to.emit(campaign, 'Contribution')
        .withArgs(user1.address, expectedSwappedAmount)

      await expect(tx)
        .to.emit(campaign, 'TokensSwapped')
        .withArgs(
          token2Address,
          await mockToken1.getAddress(),
          contributionAmount,
          expectedSwappedAmount
        )

      expect(await mockToken1.balanceOf(await campaign.getAddress())).to.equal(
        initialCampaignToken1Balance + BigInt(expectedSwappedAmount)
      )
      expect(await mockToken2.balanceOf(await campaign.getAddress())).to.equal(
        initialCampaignToken2Balance
      )

      expect(await campaign.contributions(user1.address)).to.equal(
        initialContribution + BigInt(expectedSwappedAmount)
      )
      expect(await campaign.totalAmountRaised()).to.equal(
        initialTotalRaised + BigInt(expectedSwappedAmount)
      )
    })

    it('Should  correctly track contributions from multiple users', async function () {
      const { campaign, mockToken1, user1, user2 } = await loadFixture(
        deployCampaignFixture
      )

      const contributionAmount = 2

      await mockToken1
        .connect(user1)
        .approve(await campaign.getAddress(), contributionAmount)

      await mockToken1
        .connect(user2)
        .approve(await campaign.getAddress(), contributionAmount)

      const initialBalance = await mockToken1.balanceOf(
        await campaign.getAddress()
      )

      const initialTotalRaised = await campaign.totalAmountRaised()

      await expect(
        campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), contributionAmount)
      )
        .to.emit(campaign, 'Contribution')
        .withArgs(user1.address, contributionAmount)

      expect(await mockToken1.balanceOf(await campaign.getAddress())).to.equal(
        initialBalance + BigInt(contributionAmount)
      )
      expect(await campaign.contributions(user1.address)).to.equal(
        BigInt(contributionAmount)
      )

      expect(await campaign.totalAmountRaised()).to.equal(
        initialTotalRaised + BigInt(contributionAmount)
      )

      await expect(
        campaign
          .connect(user2)
          .contribute(await mockToken1.getAddress(), contributionAmount)
      )
        .to.emit(campaign, 'Contribution')
        .withArgs(user2.address, contributionAmount)

      expect(await mockToken1.balanceOf(await campaign.getAddress())).to.equal(
        initialBalance + BigInt(2) * BigInt(contributionAmount)
      )

      expect(await campaign.contributions(user2.address)).to.equal(
        BigInt(contributionAmount)
      )

      expect(await campaign.totalAmountRaised()).to.equal(
        initialTotalRaised + BigInt(2) * BigInt(contributionAmount)
      )
    })

    it('Should track contributions correctly when user contributes with multiple tokens', async function () {
      const {
        campaign,
        mockToken1,
        user1,
        mockDefiManager,
        CAMPAIGN_GOAL_AMOUNT,
        tokenRegistry,
        mockToken2
      } = await loadFixture(deployCampaignFixture)

      const mockToken2Address = await mockToken2.getAddress()
      await mockToken2.transfer(user1.address, 100)

      // Calculate amounts to stay under the campaign goal
      // Assuming CAMPAIGN_GOAL_AMOUNT = 5, we'll contribute a total of 4
      const token1ContributionAmount = 1
      const token2ContributionAmount = 1 // This will become 2 after swap (2x rate)
      const token2SwappedAmount = token2ContributionAmount * 2

      // Fund defi manager for the swap
      await mockToken1.transfer(
        await mockDefiManager.getAddress(),
        token2SwappedAmount
      )

      // Approve both tokens
      await mockToken1
        .connect(user1)
        .approve(await campaign.getAddress(), token1ContributionAmount)
      await mockToken2
        .connect(user1)
        .approve(await campaign.getAddress(), token2ContributionAmount)

      // First contribution with campaign token
      await campaign
        .connect(user1)
        .contribute(await mockToken1.getAddress(), token1ContributionAmount)

      // Second contribution with different token
      await campaign
        .connect(user1)
        .contribute(mockToken2Address, token2ContributionAmount)

      // Total contribution should be original amount + swapped amount
      const expectedTotalContribution =
        BigInt(token1ContributionAmount) + BigInt(token2SwappedAmount)
      expect(await campaign.contributions(user1.address)).to.equal(
        expectedTotalContribution
      )

      // Total raised should reflect the sum of both contributions
      expect(await campaign.totalAmountRaised()).to.equal(
        expectedTotalContribution
      )

      // Verify we're still under the goal
      expect(await campaign.totalAmountRaised()).to.be.lessThan(
        CAMPAIGN_GOAL_AMOUNT
      )
    })

    it('Should correctly track multiple contributions from the same user', async function () {
      const { campaign, mockToken1, user1 } = await loadFixture(
        deployCampaignFixture
      )

      const contributionAmount = 2

      await mockToken1
        .connect(user1)
        .approve(await campaign.getAddress(), 2 * contributionAmount)

      const initialBalance = await mockToken1.balanceOf(
        await campaign.getAddress()
      )

      const initialTotalRaised = await campaign.totalAmountRaised()

      await expect(
        campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), contributionAmount)
      )
        .to.emit(campaign, 'Contribution')
        .withArgs(user1.address, contributionAmount)

      expect(await mockToken1.balanceOf(await campaign.getAddress())).to.equal(
        initialBalance + BigInt(contributionAmount)
      )
      expect(await campaign.contributions(user1.address)).to.equal(
        BigInt(contributionAmount)
      )

      expect(await campaign.totalAmountRaised()).to.equal(
        initialTotalRaised + BigInt(contributionAmount)
      )

      await expect(
        campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), contributionAmount)
      )
        .to.emit(campaign, 'Contribution')
        .withArgs(user1.address, contributionAmount)

      expect(await mockToken1.balanceOf(await campaign.getAddress())).to.equal(
        initialBalance + BigInt(2) * BigInt(contributionAmount)
      )

      expect(await campaign.contributions(user1.address)).to.equal(
        BigInt(2) * BigInt(contributionAmount)
      )

      expect(await campaign.totalAmountRaised()).to.equal(
        initialTotalRaised + BigInt(2) * BigInt(contributionAmount)
      )
    })

    it('Should revert when contribution amount is 0', async function () {
      const { campaign, mockToken1, user1 } = await loadFixture(
        deployCampaignFixture
      )

      await mockToken1.connect(user1).approve(await campaign.getAddress(), 100)
      await expect(
        campaign.connect(user1).contribute(await mockToken1.getAddress(), 0)
      )
        .to.be.revertedWithCustomError(campaign, 'CampaignError')
        .withArgs(ERR_INVALID_AMOUNT, ethers.ZeroAddress, 0)
    })

    it('Should handle swap failure during contribution', async function () {
      const { campaign, mockToken1, user1, mockDefiManager, mockToken2 } =
        await loadFixture(deployCampaignFixture)

      await mockToken2.transfer(user1.address, 50)
      const mockToken2Address = await mockToken2.getAddress()

      // Set swap to fail
      await mockDefiManager.setSwapSuccess(false)

      // Approve the token
      await mockToken2.connect(user1).approve(await campaign.getAddress(), 20)

      // Attempt to contribute with token that requires swap
      await expect(
        campaign.connect(user1).contribute(mockToken2Address, 20)
      ).to.be.revertedWithCustomError(mockDefiManager, 'SwapFailed')

      // Check that no contribution was recorded
      expect(await campaign.contributions(user1.address)).to.equal(0)
      expect(await campaign.totalAmountRaised()).to.equal(0)
    })

    it('Should correctly apply different exchange rates during swap', async function () {
      const {
        campaign,
        mockToken1,
        user1,
        mockDefiManager,
        CAMPAIGN_GOAL_AMOUNT,
        mockToken2,
        tokenRegistry
      } = await loadFixture(deployCampaignFixture)

      const mockToken2Address = await mockToken2.getAddress()

      // Setup third token with different exchange rate
      const mockToken3 = await ethers.deployContract('MockERC20', [
        'Third Token',
        'TKN3',
        ethers.parseUnits('100')
      ])
      await mockToken3.waitForDeployment()
      const mockToken3Address = await mockToken3.getAddress()

      await tokenRegistry.addToken(mockToken3Address, 1)

      // Transfer tokens to user
      await mockToken2.transfer(user1.address, 50)
      await mockToken3.transfer(user1.address, 50)

      // Use small amounts to stay under goal (CAMPAIGN_GOAL_AMOUNT = 5)
      const token2Amount = 1
      const token2SwappedAmount = token2Amount * 2 // = 2 after swap

      const token3Amount = 1
      const token3SwappedAmount = token3Amount * 2 // = 2 after swap

      // Total after both swaps: 4 (under the goal of 5)

      // Fund defi manager for swaps
      await mockToken1.transfer(
        await mockDefiManager.getAddress(),
        token2SwappedAmount + token3SwappedAmount
      )

      // Approve tokens
      await mockToken2
        .connect(user1)
        .approve(await campaign.getAddress(), token2Amount)
      await mockToken3
        .connect(user1)
        .approve(await campaign.getAddress(), token3Amount)

      // Contribute with Token2
      await campaign.connect(user1).contribute(mockToken2Address, token2Amount)

      // Contribute with Token3
      await campaign.connect(user1).contribute(mockToken3Address, token3Amount)

      // Check total contribution
      const expectedTotalContribution =
        BigInt(token2SwappedAmount) + BigInt(token3SwappedAmount)
      expect(await campaign.contributions(user1.address)).to.equal(
        expectedTotalContribution
      )

      // Verify we're still under the goal
      expect(await campaign.totalAmountRaised()).to.equal(
        expectedTotalContribution
      )
      expect(expectedTotalContribution).to.be.lessThan(
        BigInt(CAMPAIGN_GOAL_AMOUNT)
      )
    })

    it('Should emit correct events when contributing with non-campaign token', async function () {
      const { campaign, mockToken1, user1, mockDefiManager, mockToken2 } =
        await loadFixture(deployCampaignFixture)

      const mockToken2Address = await mockToken2.getAddress()

      await mockToken2.transfer(user1.address, 100)

      // Setup for swap
      const contributionAmount = 25
      const expectedSwappedAmount = contributionAmount * 2
      await mockToken1.transfer(
        await mockDefiManager.getAddress(),
        expectedSwappedAmount
      )

      // Approve token
      await mockToken2
        .connect(user1)
        .approve(await campaign.getAddress(), contributionAmount)

      // Contribute with different token
      const tx = await campaign
        .connect(user1)
        .contribute(mockToken2Address, contributionAmount)

      // Check emitted events - both Contribution and TokensSwapped should be emitted
      await expect(tx)
        .to.emit(campaign, 'Contribution')
        .withArgs(user1.address, expectedSwappedAmount)

      await expect(tx)
        .to.emit(campaign, 'TokensSwapped')
        .withArgs(
          mockToken2Address,
          await mockToken1.getAddress(),
          contributionAmount,
          expectedSwappedAmount
        )
    })

    it('Should revert when contributing with unsupported token', async function () {
      const { campaign, mockToken1, user1, tokenRegistry } = await loadFixture(
        deployCampaignFixture
      )

      await tokenRegistry.disableTokenSupport(mockToken1)

      await mockToken1.transfer(user1.address, 100)
      const mockToken1Address = await mockToken1.getAddress()

      await mockToken1.connect(user1).approve(await campaign.getAddress(), 10)

      await expect(campaign.connect(user1).contribute(mockToken1, 10))
        .to.be.revertedWithCustomError(campaign, 'CampaignError')
        .withArgs(ERR_TOKEN_NOT_SUPPORTED, mockToken1Address, 0)
    })

    it('Should revert when campaignGoalAmount is reached', async function () {
      const { campaign, mockToken1, user1, CAMPAIGN_GOAL_AMOUNT } =
        await loadFixture(deployCampaignFixture)

      await mockToken1
        .connect(user1)
        .approve(await campaign.getAddress(), CAMPAIGN_GOAL_AMOUNT * 2)

      await campaign
        .connect(user1)
        .contribute(await mockToken1.getAddress(), CAMPAIGN_GOAL_AMOUNT)

      await expect(
        campaign.connect(user1).contribute(await mockToken1.getAddress(), 1)
      )
        .to.be.revertedWithCustomError(campaign, 'CampaignError')
        .withArgs(ERR_GOAL_REACHED, ethers.ZeroAddress, CAMPAIGN_GOAL_AMOUNT)
    })

    it('Should revert when campaign is not active', async function () {
      const { campaign, mockToken1, user1 } = await loadFixture(
        deployCampaignFixture
      )

      await ethers.provider.send('evm_increaseTime', [31 * 24 * 60 * 60])
      await ethers.provider.send('evm_mine')

      await mockToken1.connect(user1).approve(await campaign.getAddress(), 10)

      await expect(
        campaign.connect(user1).contribute(await mockToken1.getAddress(), 1)
      )
        .to.be.revertedWithCustomError(campaign, 'CampaignError')
        .withArgs(ERR_CAMPAIGN_NOT_ACTIVE, ethers.ZeroAddress, 0)
    })

    it('Should reject ETH sent directly to the contract', async function () {
      const { campaign, user1 } = await loadFixture(deployCampaignFixture)

      await expect(
        user1.sendTransaction({
          to: await campaign.getAddress(),
          value: ethers.parseEther('1')
        })
      )
        .to.be.revertedWithCustomError(campaign, 'CampaignError')
        .withArgs(ERR_ETH_NOT_ACCEPTED, ethers.ZeroAddress, 0)
    })
  })

  describe('Fund Management', function () {
    describe('Campaign owner claiming Funds', function () {
      it('Successful fund claiming when the campaign is over and goal is reached', async function () {
        const {
          owner,
          campaign,
          mockToken1,
          user1,
          CAMPAIGN_GOAL_AMOUNT,
          CAMPAIGN_DURATION
        } = await loadFixture(deployCampaignFixture)

        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), CAMPAIGN_GOAL_AMOUNT)

        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), CAMPAIGN_GOAL_AMOUNT)

        await ethers.provider.send('evm_increaseTime', [
          (CAMPAIGN_DURATION + 1) * 24 * 60 * 60
        ])
        await ethers.provider.send('evm_mine')

        const campaignBalanceBefore = await mockToken1.balanceOf(
          await campaign.getAddress()
        )
        const ownerBalanceBefore = await mockToken1.balanceOf(owner.address)

        await expect(campaign.connect(owner).claimFunds())
          .to.emit(campaign, 'FundsClaimed')
          .withArgs(owner.address, campaignBalanceBefore)

        expect(await campaign.isClaimed()).to.equal(true)

        expect(
          await mockToken1.balanceOf(await campaign.getAddress())
        ).to.equal(0)
        expect(await mockToken1.balanceOf(owner.address)).to.equal(
          ownerBalanceBefore + campaignBalanceBefore
        )
      })

      it('Should revert if owner tries to claim funds after they have already been claimed', async function () {
        const {
          owner,
          campaign,
          mockToken1,
          user1,
          CAMPAIGN_GOAL_AMOUNT,
          CAMPAIGN_DURATION
        } = await loadFixture(deployCampaignFixture)

        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), CAMPAIGN_GOAL_AMOUNT)

        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), CAMPAIGN_GOAL_AMOUNT)

        await ethers.provider.send('evm_increaseTime', [
          (CAMPAIGN_DURATION + 1) * 24 * 60 * 60
        ])
        await ethers.provider.send('evm_mine')

        const campaignBalanceBefore = await mockToken1.balanceOf(
          await campaign.getAddress()
        )
        const ownerBalanceBefore = await mockToken1.balanceOf(owner.address)

        await expect(campaign.connect(owner).claimFunds())
          .to.emit(campaign, 'FundsClaimed')
          .withArgs(owner.address, campaignBalanceBefore)

        expect(await campaign.isClaimed()).to.equal(true)

        expect(
          await mockToken1.balanceOf(await campaign.getAddress())
        ).to.equal(0)
        expect(await mockToken1.balanceOf(owner.address)).to.equal(
          ownerBalanceBefore + campaignBalanceBefore
        )

        await expect(campaign.connect(owner).claimFunds())
          .to.be.revertedWithCustomError(campaign, 'CampaignError')
          .withArgs(ERR_FUNDS_CLAIMED, ethers.ZeroAddress, 0)
      })

      it('Should Revert when trying to claim before campaign ends', async function () {
        const {
          owner,
          campaign,
          mockToken1,
          user1,
          CAMPAIGN_GOAL_AMOUNT,
          CAMPAIGN_DURATION
        } = await loadFixture(deployCampaignFixture)

        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), CAMPAIGN_GOAL_AMOUNT)

        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), CAMPAIGN_GOAL_AMOUNT)

        await ethers.provider.send('evm_increaseTime', [
          (CAMPAIGN_DURATION - 1) * 24 * 60 * 60
        ])
        await ethers.provider.send('evm_mine')

        const campaignBalanceBefore = await mockToken1.balanceOf(
          await campaign.getAddress()
        )
        const ownerBalanceBefore = await mockToken1.balanceOf(owner.address)

        await expect(campaign.connect(owner).claimFunds())
          .to.be.revertedWithCustomError(campaign, 'CampaignError')
          .withArgs(ERR_CAMPAIGN_STILL_ACTIVE, ethers.ZeroAddress, 0)

        const campaignBalanceAfter = await mockToken1.balanceOf(
          await campaign.getAddress()
        )
        const ownerBalanceAfter = await mockToken1.balanceOf(owner.address)

        expect(campaignBalanceBefore).to.equal(campaignBalanceAfter)
        expect(ownerBalanceBefore).to.equal(ownerBalanceAfter)
      })

      it('Should revert when trying to claim if goal not reached, but campaign is past end date', async function () {
        const {
          owner,
          campaign,
          mockToken1,
          user1,
          CAMPAIGN_GOAL_AMOUNT,
          CAMPAIGN_DURATION
        } = await loadFixture(deployCampaignFixture)

        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), CAMPAIGN_GOAL_AMOUNT - 1)

        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), CAMPAIGN_GOAL_AMOUNT - 1)

        await ethers.provider.send('evm_increaseTime', [
          (CAMPAIGN_DURATION + 1) * 24 * 60 * 60
        ])
        await ethers.provider.send('evm_mine')

        const campaignBalanceBefore = await mockToken1.balanceOf(
          await campaign.getAddress()
        )
        const ownerBalanceBefore = await mockToken1.balanceOf(owner.address)

        await expect(campaign.connect(owner).claimFunds())
          .to.be.revertedWithCustomError(campaign, 'CampaignError')
          .withArgs(
            ERR_GOAL_NOT_REACHED,
            ethers.ZeroAddress,
            CAMPAIGN_GOAL_AMOUNT - 1
          )

        const campaignBalanceAfter = await mockToken1.balanceOf(
          await campaign.getAddress()
        )
        const ownerBalanceAfter = await mockToken1.balanceOf(owner.address)

        expect(campaignBalanceBefore).to.equal(campaignBalanceAfter)
        expect(ownerBalanceBefore).to.equal(ownerBalanceAfter)
      })

      it('Should revert when a non-owner tries to claim funds', async function () {
        const {
          owner,
          campaign,
          mockToken1,
          user1,
          CAMPAIGN_GOAL_AMOUNT,
          CAMPAIGN_DURATION
        } = await loadFixture(deployCampaignFixture)

        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), CAMPAIGN_GOAL_AMOUNT)

        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), CAMPAIGN_GOAL_AMOUNT)

        await ethers.provider.send('evm_increaseTime', [
          (CAMPAIGN_DURATION + 1) * 24 * 60 * 60
        ])
        await ethers.provider.send('evm_mine')

        const campaignBalanceBefore = await mockToken1.balanceOf(
          await campaign.getAddress()
        )
        const ownerBalanceBefore = await mockToken1.balanceOf(owner.address)
        const usser1BalanceBefore = await mockToken1
          .connect(user1)
          .balanceOf(owner.address)

        await expect(campaign.connect(user1).claimFunds())
          .to.be.revertedWithCustomError(campaign, 'OwnableUnauthorizedAccount')
          .withArgs(user1.address)

        const campaignBalanceAfter = await mockToken1.balanceOf(
          await campaign.getAddress()
        )
        const ownerBalanceAfter = await mockToken1.balanceOf(owner.address)
        const usser1BalanceAfter = await mockToken1
          .connect(user1)
          .balanceOf(owner.address)

        expect(campaignBalanceBefore).to.equal(campaignBalanceAfter)
        expect(ownerBalanceBefore).to.equal(ownerBalanceAfter)
        expect(usser1BalanceBefore).to.equal(usser1BalanceAfter)
      })

      it('Should revert when token transfer fails during claim', async function () {
        // Load the fixture
        const {
          owner,
          user1,
          platformAdmin,
          platformTreasury,
          tokenRegistry,
          mockDefiManager,
          CAMPAIGN_GOAL_AMOUNT,
          CAMPAIGN_DURATION
        } = await loadFixture(deployCampaignFixture)

        // Deploy a failing token for this test
        const mockFailingToken = await ethers.deployContract(
          'MockFailingERC20',
          ['Failing Token', 'FAIL', ethers.parseUnits('100')]
        )
        await mockFailingToken.waitForDeployment()
        const mockFailingTokenAddress = await mockFailingToken.getAddress()

        // Add token to registry
        await tokenRegistry.addToken(mockFailingTokenAddress, 1)

        // Deploy campaign with failing token
        const CampaignContractFactory = await ethers.getContractFactory(
          'Campaign'
        )
        const campaign = await CampaignContractFactory.deploy(
          owner.address,
          mockFailingTokenAddress,
          CAMPAIGN_GOAL_AMOUNT,
          CAMPAIGN_DURATION,
          await mockDefiManager.getAddress(),
          await platformAdmin.getAddress()
        )
        await campaign.waitForDeployment()

        // Setup: Transfer tokens, approve, and contribute
        await mockFailingToken.transfer(user1.address, CAMPAIGN_GOAL_AMOUNT)
        await mockFailingToken
          .connect(user1)
          .approve(await campaign.getAddress(), CAMPAIGN_GOAL_AMOUNT)
        await campaign
          .connect(user1)
          .contribute(mockFailingTokenAddress, CAMPAIGN_GOAL_AMOUNT)

        // Advance time past campaign end
        await ethers.provider.send('evm_increaseTime', [
          (CAMPAIGN_DURATION + 1) * 24 * 60 * 60
        ])
        await ethers.provider.send('evm_mine')

        // Track balances before claim
        const campaignBalanceBefore = await mockFailingToken.balanceOf(
          await campaign.getAddress()
        )
        const ownerBalanceBefore = await mockFailingToken.balanceOf(
          owner.address
        )

        // Configure token to fail transfers
        await mockFailingToken.setTransferShouldFail(true)

        // Attempt to claim funds (should fail)
        await expect(
          campaign.connect(owner).claimFunds()
        ).to.be.revertedWithCustomError(campaign, 'SafeERC20FailedOperation')

        // Verify state remains unchanged
        expect(await campaign.isClaimed()).to.equal(false)
        expect(
          await mockFailingToken.balanceOf(await campaign.getAddress())
        ).to.equal(campaignBalanceBefore)
        expect(await mockFailingToken.balanceOf(owner.address)).to.equal(
          ownerBalanceBefore
        )
      })
    })

    describe('Campaign contributor issuing refunds', function () {
      it('Should allow successful refund when campaign is over and goal not reached', async function () {
        const {
          campaign,
          mockToken1,
          user1,
          CAMPAIGN_GOAL_AMOUNT,
          CAMPAIGN_DURATION
        } = await loadFixture(deployCampaignFixture)

        const contributionAmount = CAMPAIGN_GOAL_AMOUNT - 1

        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), contributionAmount)

        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), contributionAmount)

        const userBalanceAfterContribution = await mockToken1.balanceOf(
          user1.address
        )

        await ethers.provider.send('evm_increaseTime', [
          (CAMPAIGN_DURATION + 1) * 24 * 60 * 60
        ])
        await ethers.provider.send('evm_mine')

        await expect(campaign.connect(user1).requestRefund())
          .to.emit(campaign, 'RefundIssued')
          .withArgs(user1.address, contributionAmount)

        expect(
          await mockToken1.balanceOf(await campaign.getAddress())
        ).to.equal(0)

        expect(await mockToken1.balanceOf(user1.address)).to.equal(
          userBalanceAfterContribution + BigInt(contributionAmount)
        )

        expect(await campaign.contributions(user1.address)).to.equal(0)

        await expect(campaign.connect(user1).requestRefund())
          .to.be.revertedWithCustomError(campaign, 'CampaignError')
          .withArgs(ERR_ALREADY_REFUNDED, user1.address, 0)
      })

      it('Should revert when trying to request refund before campaign ends', async function () {
        const {
          campaign,
          mockToken1,
          user1,
          CAMPAIGN_GOAL_AMOUNT,
          CAMPAIGN_DURATION
        } = await loadFixture(deployCampaignFixture)

        const contributionAmount = CAMPAIGN_GOAL_AMOUNT - 1

        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), contributionAmount)

        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), contributionAmount)

        const userBalanceAfterContribution = await mockToken1.balanceOf(
          user1.address
        )

        const campaignBalanceAfterContribution = await mockToken1.balanceOf(
          campaign.getAddress()
        )

        await ethers.provider.send('evm_increaseTime', [
          (CAMPAIGN_DURATION - 1) * 24 * 60 * 60
        ])
        await ethers.provider.send('evm_mine')

        await expect(campaign.connect(user1).requestRefund())
          .to.be.revertedWithCustomError(campaign, 'CampaignError')
          .withArgs(ERR_CAMPAIGN_STILL_ACTIVE, ethers.ZeroAddress, 0)

        const userBalanceAfterFailedRefund = await mockToken1.balanceOf(
          user1.address
        )

        const campaignBalanceAfterFailedRefund = await mockToken1.balanceOf(
          campaign.getAddress()
        )

        expect(userBalanceAfterContribution).to.equal(
          userBalanceAfterFailedRefund
        )
        expect(campaignBalanceAfterContribution).to.equal(
          campaignBalanceAfterFailedRefund
        )
      })

      it('Should revert when trying to request refund if goal is reached', async function () {
        const {
          campaign,
          mockToken1,
          user1,
          CAMPAIGN_GOAL_AMOUNT,
          CAMPAIGN_DURATION
        } = await loadFixture(deployCampaignFixture)

        const contributionAmount = CAMPAIGN_GOAL_AMOUNT + 1

        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), contributionAmount)

        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), contributionAmount)

        const userBalanceAfterContribution = await mockToken1.balanceOf(
          user1.address
        )

        const campaignBalanceAfterContribution = await mockToken1.balanceOf(
          campaign.getAddress()
        )

        await ethers.provider.send('evm_increaseTime', [
          (CAMPAIGN_DURATION + 1) * 24 * 60 * 60
        ])
        await ethers.provider.send('evm_mine')

        await expect(campaign.connect(user1).requestRefund())
          .to.be.revertedWithCustomError(campaign, 'CampaignError')
          .withArgs(
            ERR_GOAL_REACHED,
            ethers.ZeroAddress,
            campaignBalanceAfterContribution
          )

        const userBalanceAfterFailedRefund = await mockToken1.balanceOf(
          user1.address
        )

        const campaignBalanceAfterFailedRefund = await mockToken1.balanceOf(
          campaign.getAddress()
        )

        expect(userBalanceAfterContribution).to.equal(
          userBalanceAfterFailedRefund
        )
        expect(campaignBalanceAfterContribution).to.equal(
          campaignBalanceAfterFailedRefund
        )
      })

      it('Should revert when trying to request refund with zero contribution', async function () {
        const {
          campaign,
          mockToken1,
          user1,
          user2,
          CAMPAIGN_GOAL_AMOUNT,
          CAMPAIGN_DURATION
        } = await loadFixture(deployCampaignFixture)

        const contributionAmount = CAMPAIGN_GOAL_AMOUNT - 1

        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), contributionAmount)

        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), contributionAmount)

        const userBalanceAfterContribution = await mockToken1.balanceOf(
          user1.address
        )

        const user2BalanceAfterContribution = await mockToken1.balanceOf(
          user2.address
        )

        const campaignBalanceAfterContribution = await mockToken1.balanceOf(
          campaign.getAddress()
        )

        await ethers.provider.send('evm_increaseTime', [
          (CAMPAIGN_DURATION + 1) * 24 * 60 * 60
        ])
        await ethers.provider.send('evm_mine')

        await expect(campaign.connect(user2).requestRefund())
          .to.be.revertedWithCustomError(campaign, 'CampaignError')
          .withArgs(ERR_NOTHING_TO_REFUND, user2.address, 0)

        const userBalanceAfterFailedRefund = await mockToken1.balanceOf(
          user1.address
        )

        const user2BalanceAfterFailedRefund = await mockToken1.balanceOf(
          user2.address
        )

        const campaignBalanceAfterFailedRefund = await mockToken1.balanceOf(
          campaign.getAddress()
        )

        expect(userBalanceAfterContribution).to.equal(
          userBalanceAfterFailedRefund
        )

        expect(user2BalanceAfterContribution).to.equal(
          user2BalanceAfterFailedRefund
        )

        expect(campaignBalanceAfterContribution).to.equal(
          campaignBalanceAfterFailedRefund
        )
      })

      it('Should revert when token transfer fails during refund', async function () {
        const {
          owner,
          user1,
          platformAdmin,
          tokenRegistry,
          mockDefiManager,
          CAMPAIGN_DURATION
        } = await loadFixture(deployCampaignFixture)

        // Deploy a special failing token for this test
        const mockFailingToken = await ethers.deployContract(
          'MockFailingERC20',
          ['Failing Token', 'FAIL', ethers.parseUnits('100')]
        )
        await mockFailingToken.waitForDeployment()
        const mockFailingTokenAddress = await mockFailingToken.getAddress()

        // Add the failing token to the registry
        await tokenRegistry.addToken(mockFailingTokenAddress, 1)

        // Create a campaign that uses the failing token
        const CAMPAIGN_GOAL_AMOUNT = 5
        const campaign = await ethers.deployContract('Campaign', [
          owner.address,
          mockFailingTokenAddress,
          CAMPAIGN_GOAL_AMOUNT,
          CAMPAIGN_DURATION,
          await mockDefiManager.getAddress(),
          await platformAdmin.getAddress()
        ])
        await campaign.waitForDeployment()

        // Set up contribution that's below the goal
        const contributionAmount = CAMPAIGN_GOAL_AMOUNT - 1
        await mockFailingToken.transfer(user1.address, contributionAmount)

        // User approves and contributes to the campaign
        await mockFailingToken
          .connect(user1)
          .approve(await campaign.getAddress(), contributionAmount)

        await campaign
          .connect(user1)
          .contribute(mockFailingTokenAddress, contributionAmount)

        // Move time past campaign end date
        await ethers.provider.send('evm_increaseTime', [
          (CAMPAIGN_DURATION + 1) * 24 * 60 * 60
        ])
        await ethers.provider.send('evm_mine')

        // Configure the token to fail on transfers
        await mockFailingToken.setTransferShouldFail(true)

        // The refund call should fail with SafeERC20 error
        await expect(
          campaign.connect(user1).requestRefund()
        ).to.be.revertedWithCustomError(campaign, 'SafeERC20FailedOperation')

        // Contribution record should still be intact
        expect(await campaign.contributions(user1.address)).to.equal(
          contributionAmount
        )
      })
    })
  })

  describe('Defi Integration', function () {
    describe('Depositing into yield protocols', function () {
      it('Should allow owner to deposit funds into yield protocol', async function () {
        const { campaign, mockDefiManager, mockToken1, user1, owner } =
          await loadFixture(deployCampaignFixture)

        const contributionAmount = 2

        const contributionAmountBigInt = BigInt(contributionAmount)

        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), contributionAmount)

        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), contributionAmount)

        const mockDefiManagerAddress = await mockDefiManager.getAddress()
        const campaignAddress = await campaign.getAddress()

        const campaignBalanceBeforeYieldProtocolDeposit =
          await mockToken1.balanceOf(campaignAddress)

        const mockDefiManagerBalanceBeforeYieldProtocolDeposit =
          await mockToken1.balanceOf(mockDefiManagerAddress)

        await expect(
          campaign.depositToYieldProtocol(mockToken1, contributionAmount)
        )
          .to.emit(campaign, 'FundsOperation')
          .withArgs(
            await mockToken1.getAddress(),
            contributionAmount,
            OP_DEPOSIT,
            0,
            owner.address
          )

        const campaignBalanceAfterYieldProtocolDeposit =
          await mockToken1.balanceOf(campaignAddress)

        const mockDefiManagerBalanceAfterYieldProtocolDeposit =
          await mockToken1.balanceOf(mockDefiManagerAddress)

        expect(campaignBalanceAfterYieldProtocolDeposit).to.equal(
          campaignBalanceBeforeYieldProtocolDeposit - contributionAmountBigInt
        )

        //From the POV of the campaign, the transfer ends here
        expect(mockDefiManagerBalanceAfterYieldProtocolDeposit).to.equal(
          mockDefiManagerBalanceBeforeYieldProtocolDeposit +
            contributionAmountBigInt
        )
      })

      it('Should revert if non-owner tries to deposit to yield protocol', async function () {
        const { campaign, mockDefiManager, mockToken1, user1 } =
          await loadFixture(deployCampaignFixture)

        const contributionAmount = 2

        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), contributionAmount)

        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), contributionAmount)

        const mockDefiManagerAddress = await mockDefiManager.getAddress()
        const campaignAddress = await campaign.getAddress()

        const campaignBalanceBeforeYieldProtocolDeposit =
          await mockToken1.balanceOf(campaignAddress)

        const mockDefiManagerBalanceBeforeYieldProtocolDeposit =
          await mockToken1.balanceOf(mockDefiManagerAddress)

        await expect(
          campaign
            .connect(user1)
            .depositToYieldProtocol(
              await mockToken1.getAddress(),
              contributionAmount
            )
        )
          .to.revertedWithCustomError(campaign, 'OwnableUnauthorizedAccount')
          .withArgs(user1.address)

        const campaignBalanceAfterYieldProtocolDeposit =
          await mockToken1.balanceOf(campaignAddress)

        const mockDefiManagerBalanceAfterYieldProtocolDeposit =
          await mockToken1.balanceOf(mockDefiManagerAddress)

        expect(campaignBalanceAfterYieldProtocolDeposit).to.equal(
          campaignBalanceBeforeYieldProtocolDeposit
        )

        expect(mockDefiManagerBalanceAfterYieldProtocolDeposit).to.equal(
          mockDefiManagerBalanceBeforeYieldProtocolDeposit
        )
      })

      it('Should propagate specific error when deposit to yield protocol fails', async function () {
        const { campaign, mockDefiManager, mockToken1, user1, owner } =
          await loadFixture(deployCampaignFixture)

        const contributionAmount = 2

        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), contributionAmount)

        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), contributionAmount)

        await mockDefiManager.setDepositSuccess(false)
        const mockDefiManagerAddress = await mockDefiManager.getAddress()
        const campaignAddress = await campaign.getAddress()

        const campaignBalanceBeforeYieldProtocolDeposit =
          await mockToken1.balanceOf(campaignAddress)

        const mockDefiManagerBalanceBeforeYieldProtocolDeposit =
          await mockToken1.balanceOf(mockDefiManagerAddress)

        await expect(
          campaign
            .connect(owner)
            .depositToYieldProtocol(
              await mockToken1.getAddress(),
              contributionAmount
            )
        ).to.be.revertedWithCustomError(mockDefiManager, 'YieldDepositFailed')

        const campaignBalanceAfterYieldProtocolDeposit =
          await mockToken1.balanceOf(campaignAddress)

        const mockDefiManagerBalanceAfterYieldProtocolDeposit =
          await mockToken1.balanceOf(mockDefiManagerAddress)

        expect(campaignBalanceAfterYieldProtocolDeposit).to.equal(
          campaignBalanceBeforeYieldProtocolDeposit
        )

        expect(mockDefiManagerBalanceAfterYieldProtocolDeposit).to.equal(
          mockDefiManagerBalanceBeforeYieldProtocolDeposit
        )
      })
    })

    describe('Harvesting yield', function () {
      it('Should allow owner to harvest yield', async function () {
        const {
          campaign,
          mockDefiManager,
          mockToken1,
          yieldDistributor,
          user1,
          platformTreasury,
          owner
        } = await loadFixture(deployCampaignFixture)

        const depositAmount = 100
        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), depositAmount)
        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), depositAmount)

        await campaign.depositToYieldProtocol(
          await mockToken1.getAddress(),
          depositAmount
        )

        const yieldRate = await mockDefiManager.yieldRate()

        const totalYield =
          (BigInt(depositAmount) * BigInt(yieldRate)) / BigInt(10000)

        const [expectedCreatorYield, expectedPlatformYield] =
          await yieldDistributor.calculateYieldShares(totalYield)

        await mockToken1.mint(await mockDefiManager.getAddress(), totalYield)

        const campaignAddress = campaign.getAddress()
        const platformTreasuryAddress = platformTreasury.address

        const campaignBalanceBefore = await mockToken1.balanceOf(
          campaignAddress
        )

        const platformTreasuryBalanceBefore = await mockToken1.balanceOf(
          platformTreasuryAddress
        )

        await expect(campaign.harvestYield(await mockToken1.getAddress()))
          .to.emit(campaign, 'FundsOperation')
          .withArgs(
            await mockToken1.getAddress(),
            0,
            OP_HARVEST,
            expectedCreatorYield,
            owner.address
          )

        const campaignBalanceAfter = await mockToken1.balanceOf(campaignAddress)
        const platformTreasuryBalanceAfter = await mockToken1.balanceOf(
          platformTreasuryAddress
        )

        expect(campaignBalanceAfter - campaignBalanceBefore).to.equal(
          expectedCreatorYield
        )

        expect(
          platformTreasuryBalanceAfter - platformTreasuryBalanceBefore
        ).to.equal(expectedPlatformYield)

        const depositedAmount = await mockDefiManager.getDepositedAmount(
          await campaign.getAddress(),
          await mockToken1.getAddress()
        )
        expect(depositedAmount).to.equal(BigInt(depositAmount))
      })

      it('Should revert if non-owner tries to harvest yield', async function () {
        const {
          campaign,
          mockDefiManager,
          mockToken1,
          user1,
          platformTreasury
        } = await loadFixture(deployCampaignFixture)

        const depositAmount = 100
        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), depositAmount)
        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), depositAmount)

        await campaign.depositToYieldProtocol(
          await mockToken1.getAddress(),
          depositAmount
        )

        const yieldRate = await mockDefiManager.yieldRate()

        const totalYield =
          (BigInt(depositAmount) * BigInt(yieldRate)) / BigInt(10000)

        await mockToken1.mint(await mockDefiManager.getAddress(), totalYield)

        const campaignAddress = campaign.getAddress()
        const platformTreasuryAddress = platformTreasury.address
        const mockDefiManagerBalanceBeforeAddress =
          await mockDefiManager.getAddress()

        const campaignBalanceBefore = await mockToken1.balanceOf(
          campaignAddress
        )

        const mockDefiManagerBalanceBefore = await mockToken1.balanceOf(
          mockDefiManagerBalanceBeforeAddress
        )

        const platformTreasuryBalanceBefore = await mockToken1.balanceOf(
          platformTreasuryAddress
        )

        await expect(
          campaign.connect(user1).harvestYield(await mockToken1.getAddress())
        )
          .to.be.revertedWithCustomError(campaign, 'OwnableUnauthorizedAccount')
          .withArgs(user1.address)

        const campaignBalanceAfter = await mockToken1.balanceOf(campaignAddress)
        const mockDefiManagerBalanceAfter = await mockToken1.balanceOf(
          mockDefiManagerBalanceBeforeAddress
        )

        const platformTreasuryBalanceAfter = await mockToken1.balanceOf(
          platformTreasuryAddress
        )

        expect(campaignBalanceAfter).to.equal(campaignBalanceBefore)
        expect(mockDefiManagerBalanceAfter).to.equal(
          mockDefiManagerBalanceBefore
        )

        expect(platformTreasuryBalanceAfter).to.equal(
          platformTreasuryBalanceBefore
        )

        const depositedAmount = await mockDefiManager.getDepositedAmount(
          await campaign.getAddress(),
          await mockToken1.getAddress()
        )
        expect(depositedAmount).to.equal(BigInt(depositAmount))
      })

      it('Should handle failed transfer during harvest yield', async function () {
        const { campaign, mockDefiManager, mockToken1, user1 } =
          await loadFixture(deployCampaignFixture)

        const depositAmount = 100
        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), depositAmount)
        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), depositAmount)

        await campaign.depositToYieldProtocol(
          await mockToken1.getAddress(),
          depositAmount
        )

        await mockDefiManager.setHarvestSuccess(false)

        await expect(
          campaign.harvestYield(await mockToken1.getAddress())
        ).to.be.revertedWithCustomError(
          mockDefiManager,
          'YieldwithdrawalFailed'
        )
      })
    })

    describe('Withdrawing from yield protocols', function () {
      it('Should allow owner to withdraw a specific amount from yield protocol', async function () {
        const { campaign, mockDefiManager, mockToken1, user1, owner } =
          await loadFixture(deployCampaignFixture)

        const depositAmount = 100
        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), depositAmount)
        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), depositAmount)

        await campaign.depositToYieldProtocol(
          await mockToken1.getAddress(),
          depositAmount
        )

        const depositedAmount = await mockDefiManager.getDepositedAmount(
          await campaign.getAddress(),
          await mockToken1.getAddress()
        )
        expect(depositedAmount).to.equal(BigInt(depositAmount))

        const withdrawAmount = depositAmount / 2
        const campaignBalanceBefore = await mockToken1.balanceOf(
          await campaign.getAddress()
        )

        await expect(
          campaign.withdrawFromYieldProtocol(
            await mockToken1.getAddress(),
            withdrawAmount
          )
        )
          .to.emit(campaign, 'FundsOperation')
          .withArgs(
            await mockToken1.getAddress(),
            withdrawAmount,
            OP_WITHDRAW,
            0,
            owner.address
          )

        const campaignBalanceAfter = await mockToken1.balanceOf(
          await campaign.getAddress()
        )
        expect(campaignBalanceAfter - campaignBalanceBefore).to.equal(
          BigInt(withdrawAmount)
        )

        const remainingDepositedAmount =
          await mockDefiManager.getDepositedAmount(
            await campaign.getAddress(),
            await mockToken1.getAddress()
          )
        expect(remainingDepositedAmount).to.equal(
          BigInt(depositAmount - withdrawAmount)
        )
      })

      it('Should allow owner to withdraw all funds from yield protocol', async function () {
        const { campaign, mockDefiManager, mockToken1, user1, owner } =
          await loadFixture(deployCampaignFixture)

        const depositAmount = 100
        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), depositAmount)
        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), depositAmount)

        await campaign.depositToYieldProtocol(
          await mockToken1.getAddress(),
          depositAmount
        )

        const depositedAmount = await mockDefiManager.getDepositedAmount(
          await campaign.getAddress(),
          await mockToken1.getAddress()
        )
        expect(depositedAmount).to.equal(BigInt(depositAmount))

        const campaignBalanceBefore = await mockToken1.balanceOf(
          await campaign.getAddress()
        )

        await expect(
          campaign.withdrawAllFromYieldProtocol(await mockToken1.getAddress())
        )
          .to.emit(campaign, 'FundsOperation')
          .withArgs(
            await mockToken1.getAddress(),
            depositedAmount,
            OP_WITHDRAW_ALL,
            0,
            owner.address
          )

        const campaignBalanceAfter = await mockToken1.balanceOf(
          await campaign.getAddress()
        )
        expect(campaignBalanceAfter - campaignBalanceBefore).to.equal(
          BigInt(depositAmount)
        )

        const remainingDepositedAmount =
          await mockDefiManager.getDepositedAmount(
            await campaign.getAddress(),
            await mockToken1.getAddress()
          )
        expect(remainingDepositedAmount).to.equal(0)
      })

      it('Should revert when non-owner tries to withdraw from yield protocol', async function () {
        const { campaign, mockDefiManager, mockToken1, user1, user2 } =
          await loadFixture(deployCampaignFixture)

        const depositAmount = 100
        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), depositAmount)
        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), depositAmount)

        await campaign.depositToYieldProtocol(
          await mockToken1.getAddress(),
          depositAmount
        )

        const depositedAmount = await mockDefiManager.getDepositedAmount(
          await campaign.getAddress(),
          await mockToken1.getAddress()
        )
        expect(depositedAmount).to.equal(BigInt(depositAmount))

        await expect(
          campaign
            .connect(user2)
            .withdrawFromYieldProtocol(await mockToken1.getAddress(), 50)
        )
          .to.be.revertedWithCustomError(campaign, 'OwnableUnauthorizedAccount')
          .withArgs(user2.address)

        await expect(
          campaign
            .connect(user2)
            .withdrawAllFromYieldProtocol(await mockToken1.getAddress())
        )
          .to.be.revertedWithCustomError(campaign, 'OwnableUnauthorizedAccount')
          .withArgs(user2.address)

        const remainingDepositedAmount =
          await mockDefiManager.getDepositedAmount(
            await campaign.getAddress(),
            await mockToken1.getAddress()
          )
        expect(remainingDepositedAmount).to.equal(BigInt(depositAmount))
      })

      it('Should revert when withdrawal from yield protocol fails', async function () {
        const { campaign, mockDefiManager, mockToken1, user1, owner } =
          await loadFixture(deployCampaignFixture)

        const depositAmount = 100
        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), depositAmount)
        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), depositAmount)

        await campaign.depositToYieldProtocol(
          await mockToken1.getAddress(),
          depositAmount
        )

        await mockDefiManager.setWithdrawSuccess(false)

        await expect(
          campaign.withdrawFromYieldProtocol(await mockToken1.getAddress(), 50)
        ).to.be.revertedWithCustomError(
          mockDefiManager,
          'YieldwithdrawalFailed'
        )

        await expect(
          campaign.withdrawAllFromYieldProtocol(await mockToken1.getAddress())
        ).to.be.revertedWithCustomError(
          mockDefiManager,
          'YieldwithdrawalFailed'
        )

        const remainingDepositedAmount =
          await mockDefiManager.getDepositedAmount(
            await campaign.getAddress(),
            await mockToken1.getAddress()
          )
        expect(remainingDepositedAmount).to.equal(BigInt(depositAmount))
      })

      it('Should revert when attempting to withdraw more than deposited amount', async function () {
        const { campaign, mockDefiManager, mockToken1, user1, owner } =
          await loadFixture(deployCampaignFixture)

        const depositAmount = 100
        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), depositAmount)
        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), depositAmount)

        await campaign.depositToYieldProtocol(
          await mockToken1.getAddress(),
          depositAmount
        )

        const initialDepositedAmount = await mockDefiManager.getDepositedAmount(
          await campaign.getAddress(),
          await mockToken1.getAddress()
        )
        expect(initialDepositedAmount).to.equal(BigInt(depositAmount))

        const excessiveAmount = depositAmount * 2

        // Updated to expect InsufficientDeposit error from mockDefiManager
        await expect(
          campaign.withdrawFromYieldProtocol(
            await mockToken1.getAddress(),
            excessiveAmount
          )
        )
          .to.be.revertedWithCustomError(mockDefiManager, 'InsufficientDeposit')
          .withArgs(
            await mockToken1.getAddress(),
            excessiveAmount,
            depositAmount
          )

        const afterDepositedAmount = await mockDefiManager.getDepositedAmount(
          await campaign.getAddress(),
          await mockToken1.getAddress()
        )
        expect(afterDepositedAmount).to.equal(initialDepositedAmount)

        await expect(
          campaign.withdrawFromYieldProtocol(
            await mockToken1.getAddress(),
            depositAmount
          )
        )
          .to.emit(campaign, 'FundsOperation')
          .withArgs(
            await mockToken1.getAddress(),
            depositAmount,
            OP_WITHDRAW,
            0,
            owner.address
          )
      })

      it('Should revert with ZeroAmount when trying to withdraw nothing', async function () {
        const { campaign, mockDefiManager, mockToken1, owner } =
          await loadFixture(deployCampaignFixture)

        const depositedAmount = await mockDefiManager.getDepositedAmount(
          await campaign.getAddress(),
          await mockToken1.getAddress()
        )
        expect(depositedAmount).to.equal(0)

        // When withdrawing all with no deposit, expect ZeroAmount error
        await expect(
          campaign.withdrawAllFromYieldProtocol(await mockToken1.getAddress())
        )
          .to.be.revertedWithCustomError(mockDefiManager, 'ZeroAmount')
          .withArgs(0)

        // When trying to withdraw specific amount with no deposit, expect InsufficientDeposit
        await expect(
          campaign.withdrawFromYieldProtocol(await mockToken1.getAddress(), 50)
        )
          .to.be.revertedWithCustomError(mockDefiManager, 'InsufficientDeposit')
          .withArgs(await mockToken1.getAddress(), 50, 0)
      })
    })
  })

  describe('Admin Functions', function () {
    describe('withdrawAllFromYieldProtocolAdmin()', function () {
      it('Should allow admin to withdraw all yield after grace period has passed', async function () {
        const {
          campaign,
          mockDefiManager,
          mockToken1,
          user1,
          otherAdmin,
          GRACE_PERIOD
        } = await loadFixture(deployCampaignFixture)

        const depositAmount = 100
        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), depositAmount)
        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), depositAmount)

        await campaign.depositToYieldProtocol(
          await mockToken1.getAddress(),
          depositAmount
        )

        const depositedAmount = await mockDefiManager.getDepositedAmount(
          await campaign.getAddress(),
          await mockToken1.getAddress()
        )
        expect(depositedAmount).to.equal(BigInt(depositAmount))

        const campaignEndTime = await campaign.campaignEndTime()

        const latestBlock = await ethers.provider.getBlock('latest')

        if (!latestBlock) {
          throw new Error('Latest block does not exist')
        }

        const currentTimestamp = latestBlock.timestamp

        // Convert campaignEndTime to a number before subtraction
        const timeToAdvance =
          Number(campaignEndTime) -
          currentTimestamp +
          (GRACE_PERIOD + 1) * 24 * 60 * 60

        await ethers.provider.send('evm_increaseTime', [timeToAdvance])
        await ethers.provider.send('evm_mine')

        expect(await campaign.isCampaignActive()).to.be.false

        const campaignBalanceBefore = await mockToken1.balanceOf(
          await campaign.getAddress()
        )

        await expect(
          campaign
            .connect(otherAdmin)
            .withdrawAllFromYieldProtocolAdmin(await mockToken1.getAddress())
        )
          .to.emit(campaign, 'FundsOperation')
          .withArgs(
            await mockToken1,
            depositedAmount,
            OP_WITHDRAW_ALL,
            0,
            otherAdmin.address
          )

        const campaignBalanceAfter = await mockToken1.balanceOf(
          await campaign.getAddress()
        )
        expect(campaignBalanceAfter - campaignBalanceBefore).to.equal(
          BigInt(depositAmount)
        )

        const remainingDepositedAmount =
          await mockDefiManager.getDepositedAmount(
            await campaign.getAddress(),
            await mockToken1.getAddress()
          )
        expect(remainingDepositedAmount).to.equal(0)
      })

      it('Should should revert if admin tries to harvest yield before grace period', async function () {
        const {
          campaign,
          mockDefiManager,
          mockToken1,
          yieldDistributor,
          user1,
          platformTreasury,
          otherAdmin
        } = await loadFixture(deployCampaignFixture)

        const depositAmount = 100
        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), depositAmount)
        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), depositAmount)

        await campaign.depositToYieldProtocol(
          await mockToken1.getAddress(),
          depositAmount
        )

        const yieldRate = await mockDefiManager.yieldRate()

        const totalYield =
          (BigInt(depositAmount) * BigInt(yieldRate)) / BigInt(10000)

        const [expectedCreatorYield, expectedPlatformYield] =
          await yieldDistributor.calculateYieldShares(totalYield)

        await mockToken1.mint(await mockDefiManager.getAddress(), totalYield)

        const campaignAddress = campaign.getAddress()
        const platformTreasuryAddress = platformTreasury.address

        const campaignBalanceBefore = await mockToken1.balanceOf(
          campaignAddress
        )

        const platformTreasuryBalanceBefore = await mockToken1.balanceOf(
          platformTreasuryAddress
        )

        await expect(
          campaign
            .connect(otherAdmin)
            .withdrawAllFromYieldProtocolAdmin(await mockToken1.getAddress())
        ).to.be.revertedWithCustomError(campaign, 'GracePeriodNotOver')

        const campaignBalanceAfter = await mockToken1.balanceOf(campaignAddress)
        const platformTreasuryBalanceAfter = await mockToken1.balanceOf(
          platformTreasuryAddress
        )

        expect(campaignBalanceAfter).to.equal(campaignBalanceBefore)

        expect(platformTreasuryBalanceAfter).to.equal(
          platformTreasuryBalanceBefore
        )
      })
      it('Should revert if non-admin tries to harvest yield using admin function', async function () {
        const {
          campaign,
          mockDefiManager,
          mockToken1,
          yieldDistributor,
          user1,
          platformTreasury,
          GRACE_PERIOD,
          otherAdmin
        } = await loadFixture(deployCampaignFixture)

        const depositAmount = 100
        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), depositAmount)
        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), depositAmount)

        await campaign.depositToYieldProtocol(
          await mockToken1.getAddress(),
          depositAmount
        )

        const yieldRate = await mockDefiManager.yieldRate()

        const totalYield =
          (BigInt(depositAmount) * BigInt(yieldRate)) / BigInt(10000)

        const [expectedCreatorYield, expectedPlatformYield] =
          await yieldDistributor.calculateYieldShares(totalYield)

        await mockToken1.mint(await mockDefiManager.getAddress(), totalYield)

        const campaignAddress = campaign.getAddress()
        const platformTreasuryAddress = platformTreasury.address

        const campaignBalanceBefore = await mockToken1.balanceOf(
          campaignAddress
        )

        const platformTreasuryBalanceBefore = await mockToken1.balanceOf(
          platformTreasuryAddress
        )

        const campaignEndTime = await campaign.campaignEndTime()

        const latestBlock = await ethers.provider.getBlock('latest')

        if (!latestBlock) {
          throw new Error('Latest block does not exist')
        }

        const currentTimestamp = latestBlock.timestamp

        const timeToAdvance =
          Number(campaignEndTime) -
          currentTimestamp +
          (GRACE_PERIOD + 1) * 24 * 60 * 60

        await ethers.provider.send('evm_increaseTime', [timeToAdvance])
        await ethers.provider.send('evm_mine')

        await expect(
          campaign
            .connect(user1)
            .withdrawAllFromYieldProtocolAdmin(await mockToken1.getAddress())
        ).to.be.revertedWithCustomError(campaign, 'NotAuthorizedAdmin')

        const campaignBalanceAfter = await mockToken1.balanceOf(campaignAddress)
        const platformTreasuryBalanceAfter = await mockToken1.balanceOf(
          platformTreasuryAddress
        )

        expect(campaignBalanceAfter).to.equal(campaignBalanceBefore)

        expect(platformTreasuryBalanceAfter).to.equal(
          platformTreasuryBalanceBefore
        )
      })
    })

    describe('withdrawFromYieldProtocolAdmin()', function () {
      it('Should allow admin to withdraw a specific amount of yield after grace period', async function () {
        const {
          campaign,
          mockDefiManager,
          mockToken1,
          user1,
          otherAdmin,
          GRACE_PERIOD
        } = await loadFixture(deployCampaignFixture)

        const depositAmount = 100
        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), depositAmount)
        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), depositAmount)

        await campaign.depositToYieldProtocol(
          await mockToken1.getAddress(),
          depositAmount
        )

        const depositedAmount = await mockDefiManager.getDepositedAmount(
          await campaign.getAddress(),
          await mockToken1.getAddress()
        )
        expect(depositedAmount).to.equal(BigInt(depositAmount))

        const withdrawAmount = depositAmount / 2
        const campaignBalanceBefore = await mockToken1.balanceOf(
          await campaign.getAddress()
        )

        const campaignEndTime = await campaign.campaignEndTime()

        const latestBlock = await ethers.provider.getBlock('latest')

        if (!latestBlock) {
          throw new Error('Latest block does not exist')
        }

        const currentTimestamp = latestBlock.timestamp

        // Convert campaignEndTime to a number before subtraction
        const timeToAdvance =
          Number(campaignEndTime) -
          currentTimestamp +
          (GRACE_PERIOD + 1) * 24 * 60 * 60

        await ethers.provider.send('evm_increaseTime', [timeToAdvance])
        await ethers.provider.send('evm_mine')

        expect(await campaign.isCampaignActive()).to.be.false

        await expect(
          campaign
            .connect(otherAdmin)
            .withdrawFromYieldProtocolAdmin(
              await mockToken1.getAddress(),
              withdrawAmount
            )
        )
          .to.emit(campaign, 'FundsOperation')
          .withArgs(
            await mockToken1.getAddress(),
            withdrawAmount,
            OP_WITHDRAW,
            0,
            otherAdmin.address
          )

        const campaignBalanceAfter = await mockToken1.balanceOf(
          await campaign.getAddress()
        )
        expect(campaignBalanceAfter - campaignBalanceBefore).to.equal(
          BigInt(withdrawAmount)
        )

        const remainingDepositedAmount =
          await mockDefiManager.getDepositedAmount(
            await campaign.getAddress(),
            await mockToken1.getAddress()
          )
        expect(remainingDepositedAmount).to.equal(
          BigInt(depositAmount - withdrawAmount)
        )
      })

      it('Should should revert if admin tries to harvest yield before grace period', async function () {
        const {
          campaign,
          mockDefiManager,
          mockToken1,
          yieldDistributor,
          user1,
          platformTreasury,
          otherAdmin
        } = await loadFixture(deployCampaignFixture)

        const depositAmount = 100
        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), depositAmount)
        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), depositAmount)

        await campaign.depositToYieldProtocol(
          await mockToken1.getAddress(),
          depositAmount
        )

        const yieldRate = await mockDefiManager.yieldRate()

        const totalYield =
          (BigInt(depositAmount) * BigInt(yieldRate)) / BigInt(10000)

        const [expectedCreatorYield, expectedPlatformYield] =
          await yieldDistributor.calculateYieldShares(totalYield)

        await mockToken1.mint(await mockDefiManager.getAddress(), totalYield)

        const campaignAddress = campaign.getAddress()
        const platformTreasuryAddress = platformTreasury.address

        const withdrawAmount = depositAmount / 2

        const campaignBalanceBefore = await mockToken1.balanceOf(
          campaignAddress
        )

        const platformTreasuryBalanceBefore = await mockToken1.balanceOf(
          platformTreasuryAddress
        )

        await expect(
          campaign
            .connect(otherAdmin)
            .withdrawFromYieldProtocolAdmin(
              await mockToken1.getAddress(),
              withdrawAmount
            )
        ).to.be.revertedWithCustomError(campaign, 'GracePeriodNotOver')

        const campaignBalanceAfter = await mockToken1.balanceOf(campaignAddress)
        const platformTreasuryBalanceAfter = await mockToken1.balanceOf(
          platformTreasuryAddress
        )

        expect(campaignBalanceAfter).to.equal(campaignBalanceBefore)

        expect(platformTreasuryBalanceAfter).to.equal(
          platformTreasuryBalanceBefore
        )
      })
      it('Should revert if non-admin tries to harvest yield using admin function', async function () {
        const {
          campaign,
          mockDefiManager,
          mockToken1,
          yieldDistributor,
          user1,
          platformTreasury,
          GRACE_PERIOD,
          otherAdmin
        } = await loadFixture(deployCampaignFixture)

        const depositAmount = 100
        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), depositAmount)
        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), depositAmount)

        await campaign.depositToYieldProtocol(
          await mockToken1.getAddress(),
          depositAmount
        )

        const yieldRate = await mockDefiManager.yieldRate()

        const totalYield =
          (BigInt(depositAmount) * BigInt(yieldRate)) / BigInt(10000)

        const [expectedCreatorYield, expectedPlatformYield] =
          await yieldDistributor.calculateYieldShares(totalYield)

        await mockToken1.mint(await mockDefiManager.getAddress(), totalYield)

        const campaignAddress = campaign.getAddress()
        const platformTreasuryAddress = platformTreasury.address
        const withdrawAmount = depositAmount / 2

        const campaignBalanceBefore = await mockToken1.balanceOf(
          campaignAddress
        )

        const platformTreasuryBalanceBefore = await mockToken1.balanceOf(
          platformTreasuryAddress
        )

        const campaignEndTime = await campaign.campaignEndTime()

        const latestBlock = await ethers.provider.getBlock('latest')

        if (!latestBlock) {
          throw new Error('Latest block does not exist')
        }

        const currentTimestamp = latestBlock.timestamp

        const timeToAdvance =
          Number(campaignEndTime) -
          currentTimestamp +
          (GRACE_PERIOD + 1) * 24 * 60 * 60

        await ethers.provider.send('evm_increaseTime', [timeToAdvance])
        await ethers.provider.send('evm_mine')

        await expect(
          campaign
            .connect(user1)
            .withdrawFromYieldProtocolAdmin(
              await mockToken1.getAddress(),
              withdrawAmount
            )
        ).to.be.revertedWithCustomError(campaign, 'NotAuthorizedAdmin')

        const campaignBalanceAfter = await mockToken1.balanceOf(campaignAddress)
        const platformTreasuryBalanceAfter = await mockToken1.balanceOf(
          platformTreasuryAddress
        )

        expect(campaignBalanceAfter).to.equal(campaignBalanceBefore)

        expect(platformTreasuryBalanceAfter).to.equal(
          platformTreasuryBalanceBefore
        )
      })
    })

    describe('harvestYieldAdmin()', function () {
      it('Should allow admin to harvest yield after grace period', async function () {
        const {
          campaign,
          mockDefiManager,
          mockToken1,
          yieldDistributor,
          user1,
          platformTreasury,
          GRACE_PERIOD,
          otherAdmin
        } = await loadFixture(deployCampaignFixture)

        const depositAmount = 100
        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), depositAmount)
        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), depositAmount)

        await campaign.depositToYieldProtocol(
          await mockToken1.getAddress(),
          depositAmount
        )

        const yieldRate = await mockDefiManager.yieldRate()

        const totalYield =
          (BigInt(depositAmount) * BigInt(yieldRate)) / BigInt(10000)

        const [expectedCreatorYield, expectedPlatformYield] =
          await yieldDistributor.calculateYieldShares(totalYield)

        await mockToken1.mint(await mockDefiManager.getAddress(), totalYield)

        const campaignAddress = campaign.getAddress()
        const platformTreasuryAddress = platformTreasury.address

        const campaignBalanceBefore = await mockToken1.balanceOf(
          campaignAddress
        )

        const platformTreasuryBalanceBefore = await mockToken1.balanceOf(
          platformTreasuryAddress
        )

        const campaignEndTime = await campaign.campaignEndTime()

        const latestBlock = await ethers.provider.getBlock('latest')

        if (!latestBlock) {
          throw new Error('Latest block does not exist')
        }

        const currentTimestamp = latestBlock.timestamp

        const timeToAdvance =
          Number(campaignEndTime) -
          currentTimestamp +
          (GRACE_PERIOD + 1) * 24 * 60 * 60

        await ethers.provider.send('evm_increaseTime', [timeToAdvance])
        await ethers.provider.send('evm_mine')

        await expect(
          campaign
            .connect(otherAdmin)
            .harvestYieldAdmin(await mockToken1.getAddress())
        )
          .to.emit(campaign, 'FundsOperation')
          .withArgs(
            await mockToken1.getAddress(),
            0,
            OP_HARVEST,
            expectedCreatorYield,
            otherAdmin.address
          )

        const campaignBalanceAfter = await mockToken1.balanceOf(campaignAddress)
        const platformTreasuryBalanceAfter = await mockToken1.balanceOf(
          platformTreasuryAddress
        )

        expect(campaignBalanceAfter - campaignBalanceBefore).to.equal(
          expectedCreatorYield
        )

        expect(
          platformTreasuryBalanceAfter - platformTreasuryBalanceBefore
        ).to.equal(expectedPlatformYield)

        const depositedAmount = await mockDefiManager.getDepositedAmount(
          await campaign.getAddress(),
          await mockToken1.getAddress()
        )
        expect(depositedAmount).to.equal(BigInt(depositAmount))
      })
      it('Should should revert if admin tries to harvest yield before grace period', async function () {
        const {
          campaign,
          mockDefiManager,
          mockToken1,
          yieldDistributor,
          user1,
          platformTreasury,
          otherAdmin
        } = await loadFixture(deployCampaignFixture)

        const depositAmount = 100
        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), depositAmount)
        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), depositAmount)

        await campaign.depositToYieldProtocol(
          await mockToken1.getAddress(),
          depositAmount
        )

        const yieldRate = await mockDefiManager.yieldRate()

        const totalYield =
          (BigInt(depositAmount) * BigInt(yieldRate)) / BigInt(10000)

        const [expectedCreatorYield, expectedPlatformYield] =
          await yieldDistributor.calculateYieldShares(totalYield)

        await mockToken1.mint(await mockDefiManager.getAddress(), totalYield)

        const campaignAddress = campaign.getAddress()
        const platformTreasuryAddress = platformTreasury.address

        const campaignBalanceBefore = await mockToken1.balanceOf(
          campaignAddress
        )

        const platformTreasuryBalanceBefore = await mockToken1.balanceOf(
          platformTreasuryAddress
        )

        await expect(
          campaign
            .connect(otherAdmin)
            .harvestYieldAdmin(await mockToken1.getAddress())
        ).to.be.revertedWithCustomError(campaign, 'GracePeriodNotOver')

        const campaignBalanceAfter = await mockToken1.balanceOf(campaignAddress)
        const platformTreasuryBalanceAfter = await mockToken1.balanceOf(
          platformTreasuryAddress
        )

        expect(campaignBalanceAfter).to.equal(campaignBalanceBefore)

        expect(platformTreasuryBalanceAfter).to.equal(
          platformTreasuryBalanceBefore
        )
      })
      it('Should revert if non-admin tries to harvest yield using admin function', async function () {
        const {
          campaign,
          mockDefiManager,
          mockToken1,
          yieldDistributor,
          user1,
          platformTreasury,
          GRACE_PERIOD,
          otherAdmin
        } = await loadFixture(deployCampaignFixture)

        const depositAmount = 100
        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), depositAmount)
        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), depositAmount)

        await campaign.depositToYieldProtocol(
          await mockToken1.getAddress(),
          depositAmount
        )

        const yieldRate = await mockDefiManager.yieldRate()

        const totalYield =
          (BigInt(depositAmount) * BigInt(yieldRate)) / BigInt(10000)

        const [expectedCreatorYield, expectedPlatformYield] =
          await yieldDistributor.calculateYieldShares(totalYield)

        await mockToken1.mint(await mockDefiManager.getAddress(), totalYield)

        const campaignAddress = campaign.getAddress()
        const platformTreasuryAddress = platformTreasury.address

        const campaignBalanceBefore = await mockToken1.balanceOf(
          campaignAddress
        )

        const platformTreasuryBalanceBefore = await mockToken1.balanceOf(
          platformTreasuryAddress
        )

        const campaignEndTime = await campaign.campaignEndTime()

        const latestBlock = await ethers.provider.getBlock('latest')

        if (!latestBlock) {
          throw new Error('Latest block does not exist')
        }

        const currentTimestamp = latestBlock.timestamp

        const timeToAdvance =
          Number(campaignEndTime) -
          currentTimestamp +
          (GRACE_PERIOD + 1) * 24 * 60 * 60

        await ethers.provider.send('evm_increaseTime', [timeToAdvance])
        await ethers.provider.send('evm_mine')

        await expect(
          campaign
            .connect(user1)
            .harvestYieldAdmin(await mockToken1.getAddress())
        ).to.be.revertedWithCustomError(campaign, 'NotAuthorizedAdmin')

        const campaignBalanceAfter = await mockToken1.balanceOf(campaignAddress)
        const platformTreasuryBalanceAfter = await mockToken1.balanceOf(
          platformTreasuryAddress
        )

        expect(campaignBalanceAfter).to.equal(campaignBalanceBefore)

        expect(platformTreasuryBalanceAfter).to.equal(
          platformTreasuryBalanceBefore
        )
      })
    })

    describe('Admin Override Functions', function () {
      it('Should allow other platform admin to set admin override', async function () {
        const { campaign, platformAdmin, otherAdmin } = await loadFixture(
          deployCampaignFixture
        )

        // Initially campaign should be active
        expect(await campaign.isCampaignActive()).to.be.true
        expect(await campaign.adminOverride()).to.be.false

        // Set admin override to true

        await expect(campaign.connect(otherAdmin).setAdminOverride(true))
          .to.emit(campaign, 'AdminOverrideSet')
          .withArgs(true, otherAdmin.address)

        // Campaign should now be inactive due to override
        expect(await campaign.isCampaignActive()).to.be.false
        expect(await campaign.adminOverride()).to.be.true
      })

      it('Should revert when non-admin tries to set admin override', async function () {
        const { campaign, user1 } = await loadFixture(deployCampaignFixture)

        await expect(
          campaign.connect(user1).setAdminOverride(true)
        ).to.be.revertedWithCustomError(campaign, 'NotAuthorizedAdmin')
      })

      it('Should prevent contributions when admin override is active', async function () {
        const { campaign, mockToken1, user1, platformAdmin, otherAdmin } =
          await loadFixture(deployCampaignFixture)

        await campaign.connect(otherAdmin).setAdminOverride(true)

        // Try to contribute
        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), 100)
        await expect(
          campaign.connect(user1).contribute(await mockToken1.getAddress(), 100)
        )
          .to.be.revertedWithCustomError(campaign, 'CampaignError')
          .withArgs(ERR_CAMPAIGN_NOT_ACTIVE, ethers.ZeroAddress, 0)
      })

      it('Should allow admin to reactivate campaign by removing override', async function () {
        const { campaign, mockToken1, user1, platformAdmin, otherAdmin } =
          await loadFixture(deployCampaignFixture)

        // Set admin override to true

        await campaign.connect(otherAdmin).setAdminOverride(true)
        expect(await campaign.isCampaignActive()).to.be.false

        // Remove override
        await expect(campaign.connect(otherAdmin).setAdminOverride(false))
          .to.emit(campaign, 'AdminOverrideSet')
          .withArgs(false, otherAdmin.address)

        // Campaign should be active again
        expect(await campaign.isCampaignActive()).to.be.true

        // Should allow contributions
        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), 100)
        await expect(
          campaign.connect(user1).contribute(await mockToken1.getAddress(), 100)
        )
          .to.emit(campaign, 'Contribution')
          .withArgs(user1.address, 100)
      })
    })
  })

  describe('Getter Functions', function () {
    describe('isCampaignActive', function () {
      it('Should return true when campaign is within its timeframe', async function () {
        const { campaign } = await loadFixture(deployCampaignFixture)

        // Campaign should be active by default right after deployment
        expect(await campaign.isCampaignActive()).to.be.true
      })

      it('Should return false when campaign timeframe has passed', async function () {
        const { campaign, CAMPAIGN_DURATION } = await loadFixture(
          deployCampaignFixture
        )

        // Increase time to after campaign end
        await ethers.provider.send('evm_increaseTime', [
          (CAMPAIGN_DURATION + 1) * 24 * 60 * 60
        ])
        await ethers.provider.send('evm_mine')

        // Campaign should now be inactive
        expect(await campaign.isCampaignActive()).to.be.false
      })
    })

    describe('isCampaignSuccessful', function () {
      it('Should return true when goal is reached', async function () {
        const { campaign, mockToken1, user1, CAMPAIGN_GOAL_AMOUNT } =
          await loadFixture(deployCampaignFixture)

        // Campaign should not be successful initially
        expect(await campaign.isCampaignSuccessful()).to.be.false

        // Contribute enough to reach the goal
        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), CAMPAIGN_GOAL_AMOUNT)
        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), CAMPAIGN_GOAL_AMOUNT)

        // Campaign should now be successful
        expect(await campaign.isCampaignSuccessful()).to.be.true
      })

      it('Should return false when goal is not reached', async function () {
        const { campaign, mockToken1, user1, CAMPAIGN_GOAL_AMOUNT } =
          await loadFixture(deployCampaignFixture)

        // Contribute less than the goal
        const partialAmount = CAMPAIGN_GOAL_AMOUNT - 1
        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), partialAmount)
        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), partialAmount)

        // Campaign should not be successful
        expect(await campaign.isCampaignSuccessful()).to.be.false
      })
    })

    describe('getDepositedAmount', function () {
      it('Should return correct deposited amount after deposits and withdrawals', async function () {
        const { campaign, mockDefiManager, mockToken1, user1 } =
          await loadFixture(deployCampaignFixture)

        // Initially no deposits
        expect(
          await campaign.getDepositedAmount(await mockToken1.getAddress())
        ).to.equal(0)

        // Contribute and deposit to yield protocol
        const depositAmount = 100
        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), depositAmount)
        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), depositAmount)

        await campaign.depositToYieldProtocol(
          await mockToken1.getAddress(),
          depositAmount
        )

        // Check deposited amount
        expect(
          await campaign.getDepositedAmount(await mockToken1.getAddress())
        ).to.equal(BigInt(depositAmount))

        // Withdraw half the amount
        const withdrawAmount = depositAmount / 2
        await campaign.withdrawFromYieldProtocol(
          await mockToken1.getAddress(),
          withdrawAmount
        )

        // Check updated deposited amount
        expect(
          await campaign.getDepositedAmount(await mockToken1.getAddress())
        ).to.equal(BigInt(depositAmount - withdrawAmount))

        await campaign.withdrawFromYieldProtocol(
          await mockToken1.getAddress(),
          withdrawAmount
        )

        expect(
          await campaign.getDepositedAmount(await mockToken1.getAddress())
        ).to.equal(0)
      })

      it('Should return zero for any address with no deposits', async function () {
        const { campaign, mockToken1 } = await loadFixture(
          deployCampaignFixture
        )
        const initialDeposit = await campaign.getDepositedAmount(
          await mockToken1.getAddress()
        )
        expect(initialDeposit).to.equal(0)

        const randomAddress = await campaign.getAddress()
        const randomDeposit = await campaign.getDepositedAmount(randomAddress)
        expect(randomDeposit).to.equal(0)
      })
    })

    describe('getCurrentYieldRate', function () {
      it('Should return the yield rate from DefiManager', async function () {
        const { campaign, mockDefiManager, mockToken1 } = await loadFixture(
          deployCampaignFixture
        )

        // Get the yield rate directly from mockDefiManager for comparison
        const expectedRate = await mockDefiManager.getCurrentYieldRate(
          await mockToken1.getAddress()
        )

        // Get the yield rate through the campaign contract
        const actualRate = await campaign.getCurrentYieldRate(
          await mockToken1.getAddress()
        )

        // Verify the rates match
        expect(actualRate).to.equal(expectedRate)
      })
    })
  })

  describe('Weighted Contribution Calculations', function () {
    describe('calculateWeightedContributions', function () {
      it('Should calculate weighted contributions correctly for all contributors', async function () {
        const { campaign, mockToken1, user1, user2, CAMPAIGN_DURATION } =
          await loadFixture(deployCampaignFixture)

        // First contribution
        await mockToken1.connect(user1).approve(await campaign.getAddress(), 2)
        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), 2)

        // Advance time by 1/4 of campaign duration
        await ethers.provider.send('evm_increaseTime', [
          (CAMPAIGN_DURATION * 24 * 60 * 60) / 4
        ])
        await ethers.provider.send('evm_mine')

        // Second contribution
        await mockToken1.connect(user2).approve(await campaign.getAddress(), 2)
        await campaign
          .connect(user2)
          .contribute(await mockToken1.getAddress(), 2)

        // Move past campaign end
        await ethers.provider.send('evm_increaseTime', [
          CAMPAIGN_DURATION * 24 * 60 * 60
        ])
        await ethers.provider.send('evm_mine')

        // Calculate weighted contributions
        await expect(campaign.calculateWeightedContributions())
          .to.emit(campaign, 'YieldSharesCalculationUpdate')
          .withArgs(2, true, 2) // 2 contributors processed, calculation complete, 2 total processed

        // Early contributor should have higher weight
        const user1Weight = await campaign.weightedContributions(user1.address)
        const user2Weight = await campaign.weightedContributions(user2.address)
        expect(user1Weight).to.be.gt(user2Weight)

        expect(await campaign.weightedContributionsCalculated()).to.be.true
        expect(await campaign.totalWeightedContributions()).to.equal(
          user1Weight + user2Weight
        )
      })

      it('Should revert if campaign is still active', async function () {
        const { campaign, mockToken1, user1 } = await loadFixture(
          deployCampaignFixture
        )

        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), 100)
        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), 100)

        await expect(campaign.calculateWeightedContributions())
          .to.be.revertedWithCustomError(campaign, 'CampaignError')
          .withArgs(ERR_CAMPAIGN_STILL_ACTIVE, ethers.ZeroAddress, 0)
      })

      it('Should revert if calculation is already complete', async function () {
        const { campaign, mockToken1, user1, CAMPAIGN_DURATION } =
          await loadFixture(deployCampaignFixture)

        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), 100)
        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), 100)

        // Move past campaign end
        await ethers.provider.send('evm_increaseTime', [
          CAMPAIGN_DURATION * 24 * 60 * 60
        ])
        await ethers.provider.send('evm_mine')

        // First calculation
        await campaign.calculateWeightedContributions()

        // Second calculation should fail
        await expect(campaign.calculateWeightedContributions())
          .to.be.revertedWithCustomError(campaign, 'CampaignError')
          .withArgs(ERR_CALCULATION_COMPLETE, ethers.ZeroAddress, 0)
      })
    })

    describe('calculateWeightedContributionsBatch', function () {
      it('Should process contributions in batches', async function () {
        const { campaign, mockToken1, user1, user2, CAMPAIGN_DURATION } =
          await loadFixture(deployCampaignFixture)

        // Setup multiple contributions
        await mockToken1.connect(user1).approve(await campaign.getAddress(), 2)
        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), 2)

        await mockToken1.connect(user2).approve(await campaign.getAddress(), 2)
        await campaign
          .connect(user2)
          .contribute(await mockToken1.getAddress(), 2)

        // Move past campaign end
        await ethers.provider.send('evm_increaseTime', [
          CAMPAIGN_DURATION * 24 * 60 * 60
        ])
        await ethers.provider.send('evm_mine')

        // Process first batch
        const batchSize = 1
        const result1 =
          await campaign.calculateWeightedContributionsBatch.staticCall(
            batchSize
          )
        const isComplete1 = result1[0]
        const processed1 = result1[1]
        await campaign.calculateWeightedContributionsBatch(batchSize)
        expect(isComplete1).to.be.false
        expect(processed1).to.equal(1)

        // Process second batch
        const result2 =
          await campaign.calculateWeightedContributionsBatch.staticCall(
            batchSize
          )
        const isComplete2 = result2[0]
        const processed2 = result2[1]
        await campaign.calculateWeightedContributionsBatch(batchSize)
        expect(isComplete2).to.be.true
        expect(processed2).to.equal(1)

        expect(await campaign.weightedContributionsCalculated()).to.be.true
      })

      it('Should revert batch calculation when campaign is active', async function () {
        const { campaign, mockToken1, user1 } = await loadFixture(
          deployCampaignFixture
        )

        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), 100)
        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), 100)

        await expect(campaign.calculateWeightedContributionsBatch(1))
          .to.be.revertedWithCustomError(campaign, 'CampaignError')
          .withArgs(ERR_CAMPAIGN_STILL_ACTIVE, ethers.ZeroAddress, 0)
      })

      it('Should revert batch calculation when already complete', async function () {
        const { campaign, mockToken1, user1, CAMPAIGN_DURATION } =
          await loadFixture(deployCampaignFixture)

        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), 100)
        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), 100)

        // Move past campaign end
        await ethers.provider.send('evm_increaseTime', [
          CAMPAIGN_DURATION * 24 * 60 * 60
        ])
        await ethers.provider.send('evm_mine')

        // Complete calculation
        await campaign.calculateWeightedContributions()

        // Try batch calculation after completion
        await expect(campaign.calculateWeightedContributionsBatch(1))
          .to.be.revertedWithCustomError(campaign, 'CampaignError')
          .withArgs(ERR_CALCULATION_COMPLETE, ethers.ZeroAddress, 0)
      })
    })

    describe('resetWeightedContributionsCalculation', function () {
      it('Should allow platform admin to reset calculation', async function () {
        const {
          campaign,
          mockToken1,
          user1,
          user2,
          user3,
          user4,
          CAMPAIGN_DURATION,
          otherAdmin
        } = await loadFixture(deployCampaignFixture)

        // Make multiple contributions to ensure we have enough contributors
        // for the batch calculation to not complete in one go
        await mockToken1.connect(user1).approve(await campaign.getAddress(), 1)
        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), 1)

        await mockToken1.connect(user2).approve(await campaign.getAddress(), 1)
        await campaign
          .connect(user2)
          .contribute(await mockToken1.getAddress(), 1)

        await mockToken1.connect(user3).approve(await campaign.getAddress(), 1)
        await campaign
          .connect(user3)
          .contribute(await mockToken1.getAddress(), 1)

        await mockToken1.connect(user4).approve(await campaign.getAddress(), 1)
        await campaign
          .connect(user4)
          .contribute(await mockToken1.getAddress(), 1)

        // Move past campaign end
        await ethers.provider.send('evm_increaseTime', [
          CAMPAIGN_DURATION * 24 * 60 * 60
        ])
        await ethers.provider.send('evm_mine')

        // Start batch calculation with a small batch size to ensure it doesn't complete
        const batchSize = 1
        const result =
          await campaign.calculateWeightedContributionsBatch.staticCall(
            batchSize
          )
        const isComplete = result[0]

        // Execute the batch calculation (should process just one contributor)
        await campaign.calculateWeightedContributionsBatch(batchSize)

        // Verify the calculation isn't complete
        expect(await campaign.weightedContributionsCalculated()).to.be.false

        // Verify there is a current processing contributor (not zero address)
        const currentContributor = await campaign.currentProcessingContributor()
        expect(currentContributor).to.not.equal(ethers.ZeroAddress)

        // Reset calculation as platform admin
        await campaign
          .connect(otherAdmin)
          .resetWeightedContributionsCalculation()

        // Verify reset was successful
        expect(await campaign.currentProcessingContributor()).to.equal(
          ethers.ZeroAddress
        )
        expect(await campaign.weightedContributionsCalculated()).to.be.false
      })

      it('Should revert reset when calculation is complete', async function () {
        const { campaign, mockToken1, user1, CAMPAIGN_DURATION, otherAdmin } =
          await loadFixture(deployCampaignFixture)

        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), 100)
        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), 100)

        // Move past campaign end
        await ethers.provider.send('evm_increaseTime', [
          CAMPAIGN_DURATION * 24 * 60 * 60
        ])
        await ethers.provider.send('evm_mine')

        // Complete calculation
        await campaign.calculateWeightedContributions()

        // Try to reset
        await expect(
          campaign.connect(otherAdmin).resetWeightedContributionsCalculation()
        )
          .to.be.revertedWithCustomError(campaign, 'CampaignError')
          .withArgs(ERR_CALCULATION_COMPLETE, ethers.ZeroAddress, 0)
      })

      it('Should revert reset when called by non-admin', async function () {
        const { campaign, mockToken1, user1, CAMPAIGN_DURATION } =
          await loadFixture(deployCampaignFixture)

        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), 100)
        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), 100)

        // Move past campaign end
        await ethers.provider.send('evm_increaseTime', [
          CAMPAIGN_DURATION * 24 * 60 * 60
        ])
        await ethers.provider.send('evm_mine')

        // Start batch calculation
        await campaign.calculateWeightedContributionsBatch(1)

        // Try to reset as non-admin
        await expect(
          campaign.connect(user1).resetWeightedContributionsCalculation()
        ).to.be.revertedWithCustomError(campaign, 'NotAuthorizedAdmin')
      })
    })
  })

  describe('Yield Claiming', function () {
    describe('claimYield', function () {
      it('Should allow contributor to claim their yield share after campaign ends', async function () {
        const {
          campaign,
          mockToken1,
          user1,
          user2,
          mockDefiManager,
          CAMPAIGN_DURATION
        } = await loadFixture(deployCampaignFixture)

        // Setup: Make contributions
        await mockToken1.connect(user1).approve(await campaign.getAddress(), 1)
        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), 1)

        await mockToken1.connect(user2).approve(await campaign.getAddress(), 1)
        await campaign
          .connect(user2)
          .contribute(await mockToken1.getAddress(), 1)

        await mockToken1.mint(await campaign.getAddress(), 148)

        // Generate some yield
        await campaign.depositToYieldProtocol(
          await mockToken1.getAddress(),
          150
        )
        const yieldAmount = 30 // 20% yield
        await mockToken1.mint(await mockDefiManager.getAddress(), yieldAmount)
        await campaign.harvestYield(await mockToken1.getAddress())

        // Move past campaign end
        await ethers.provider.send('evm_increaseTime', [
          CAMPAIGN_DURATION * 24 * 60 * 60
        ])
        await ethers.provider.send('evm_mine')

        // Calculate weighted contributions
        await campaign.calculateWeightedContributions()

        // Get initial balances
        const user1BalanceBefore = await mockToken1.balanceOf(user1.address)

        // Claim yield
        await expect(campaign.connect(user1).claimYield()).to.emit(
          campaign,
          'YieldDistributed'
        )

        const user1BalanceAfter = await mockToken1.balanceOf(user1.address)
        expect(user1BalanceAfter).to.be.gt(user1BalanceBefore)

        // Verify user can't claim twice
        await expect(campaign.connect(user1).claimYield())
          .to.be.revertedWithCustomError(campaign, 'CampaignError')
          .withArgs(ERR_YIELD_CLAIMED, user1.address, 0)
      })

      it('Should revert if campaign is still active', async function () {
        const { campaign, mockToken1, user1, mockDefiManager } =
          await loadFixture(deployCampaignFixture)

        // Setup: Make contribution and generate yield
        await mockToken1.connect(user1).approve(await campaign.getAddress(), 4)
        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), 4)

        await mockToken1.mint(await campaign.getAddress(), 146)

        await campaign.depositToYieldProtocol(
          await mockToken1.getAddress(),
          150
        )
        await mockToken1.mint(await mockDefiManager.getAddress(), 20)
        await campaign.harvestYield(await mockToken1.getAddress())

        await expect(campaign.connect(user1).claimYield())
          .to.be.revertedWithCustomError(campaign, 'CampaignError')
          .withArgs(ERR_CAMPAIGN_STILL_ACTIVE, ethers.ZeroAddress, 0)
      })

      it('Should revert if weighted contributions are not calculated', async function () {
        const {
          campaign,
          mockToken1,
          user1,
          mockDefiManager,
          CAMPAIGN_DURATION
        } = await loadFixture(deployCampaignFixture)

        // Setup: Make contribution and generate yield
        await mockToken1.connect(user1).approve(await campaign.getAddress(), 2)
        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), 2)

        await mockToken1.mint(await campaign.getAddress(), 148)

        await campaign.depositToYieldProtocol(
          await mockToken1.getAddress(),
          150
        )
        await mockToken1.mint(await mockDefiManager.getAddress(), 20)
        await campaign.harvestYield(await mockToken1.getAddress())

        // Move past campaign end
        await ethers.provider.send('evm_increaseTime', [
          CAMPAIGN_DURATION * 24 * 60 * 60
        ])
        await ethers.provider.send('evm_mine')

        await expect(campaign.connect(user1).claimYield())
          .to.be.revertedWithCustomError(campaign, 'CampaignError')
          .withArgs(ERR_WEIGHTED_NOT_CALCULATED, ethers.ZeroAddress, 0)
      })

      it('Should revert if user has no contributions', async function () {
        const {
          campaign,
          mockToken1,
          user1,
          user2,
          mockDefiManager,
          CAMPAIGN_DURATION
        } = await loadFixture(deployCampaignFixture)

        // Setup: Make contribution with user1 and generate yield
        await mockToken1.connect(user1).approve(await campaign.getAddress(), 2)
        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), 2)

        await mockToken1.mint(await campaign.getAddress(), 148)

        await campaign.depositToYieldProtocol(
          await mockToken1.getAddress(),
          150
        )
        await mockToken1.mint(await mockDefiManager.getAddress(), 20)
        await campaign.harvestYield(await mockToken1.getAddress())

        // Move past campaign end
        await ethers.provider.send('evm_increaseTime', [
          CAMPAIGN_DURATION * 24 * 60 * 60
        ])
        await ethers.provider.send('evm_mine')

        await campaign.calculateWeightedContributions()

        // Try to claim with user2 who hasn't contributed
        await expect(campaign.connect(user2).claimYield())
          .to.be.revertedWithCustomError(campaign, 'CampaignError')
          .withArgs(ERR_NO_YIELD, user2.address, 0)
      })

      it('Should revert if user has been refunded', async function () {
        const {
          campaign,
          mockToken1,
          user1,
          mockDefiManager,
          CAMPAIGN_DURATION
        } = await loadFixture(deployCampaignFixture)

        // Setup: Make contribution that's less than goal
        await mockToken1.connect(user1).approve(await campaign.getAddress(), 2)
        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), 2)

        await mockToken1.mint(await campaign.getAddress(), 148)

        // Generate some yield
        await campaign.depositToYieldProtocol(
          await mockToken1.getAddress(),
          150
        )

        const yieldAmount = 30 // 20% yield
        await mockToken1.mint(await mockDefiManager.getAddress(), yieldAmount)
        await campaign.harvestYield(await mockToken1.getAddress())

        // Move past campaign end
        await ethers.provider.send('evm_increaseTime', [
          CAMPAIGN_DURATION * 24 * 60 * 60
        ])
        await ethers.provider.send('evm_mine')

        // // Get refund
        await campaign.connect(user1).requestRefund()

        await campaign.calculateWeightedContributions()

        // Try to claim yield
        await expect(campaign.connect(user1).claimYield())
          .to.be.revertedWithCustomError(campaign, 'CampaignError')
          .withArgs(ERR_NO_YIELD, user1.address, 0)
      })

      it('Should revert if no yield has been generated', async function () {
        const { campaign, mockToken1, user1, CAMPAIGN_DURATION } =
          await loadFixture(deployCampaignFixture)

        // Setup: Make contribution but don't generate yield
        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), 100)
        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), 100)

        // Move past campaign end
        await ethers.provider.send('evm_increaseTime', [
          CAMPAIGN_DURATION * 24 * 60 * 60
        ])
        await ethers.provider.send('evm_mine')

        await campaign.calculateWeightedContributions()

        await expect(campaign.connect(user1).claimYield())
          .to.be.revertedWithCustomError(campaign, 'CampaignError')
          .withArgs(ERR_NO_YIELD, ethers.ZeroAddress, 0)
      })

      it('Should distribute yield proportionally based on weighted contributions', async function () {
        const {
          campaign,
          mockToken1,
          user1,
          user2,
          mockDefiManager,
          CAMPAIGN_DURATION
        } = await loadFixture(deployCampaignFixture)

        // First contribution
        await mockToken1.connect(user1).approve(await campaign.getAddress(), 2)
        await campaign
          .connect(user1)
          .contribute(await mockToken1.getAddress(), 2)

        // Advance time by 1/4 of campaign duration
        await ethers.provider.send('evm_increaseTime', [
          (CAMPAIGN_DURATION * 24 * 60 * 60) / 4
        ])
        await ethers.provider.send('evm_mine')

        // Second contribution
        await mockToken1.connect(user2).approve(await campaign.getAddress(), 2)
        await campaign
          .connect(user2)
          .contribute(await mockToken1.getAddress(), 2)

        await mockToken1.mint(await campaign.getAddress(), 146)

        // Generate yield
        await campaign.depositToYieldProtocol(
          await mockToken1.getAddress(),
          150
        )
        const yieldAmount = 40 // 20% yield
        await mockToken1.mint(await mockDefiManager.getAddress(), yieldAmount)
        await campaign.harvestYield(await mockToken1.getAddress())

        // Move past campaign end
        await ethers.provider.send('evm_increaseTime', [
          CAMPAIGN_DURATION * 24 * 60 * 60
        ])
        await ethers.provider.send('evm_mine')

        await campaign.calculateWeightedContributions()

        // Get initial balances
        const user1BalanceBefore = await mockToken1.balanceOf(user1.address)
        const user2BalanceBefore = await mockToken1.balanceOf(user2.address)

        // Claim yield for both users
        await campaign.connect(user1).claimYield()
        await campaign.connect(user2).claimYield()

        const user1YieldAmount =
          (await mockToken1.balanceOf(user1.address)) - user1BalanceBefore
        const user2YieldAmount =
          (await mockToken1.balanceOf(user2.address)) - user2BalanceBefore

        // User1 should receive more yield due to earlier contribution
        expect(user1YieldAmount).to.be.gt(user2YieldAmount)
      })
    })
  })
})
