import { token } from '../typechain-types/@openzeppelin/contracts'

import { expect } from 'chai'
import { ethers } from 'hardhat'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'

describe('Campaign', function () {
  async function deployCampaignFixture () {
    const CAMPAIGN_GOAL_AMOUNT = 5
    const CAMPAIGN_DURATION = 30

    const [owner, user1, user2, platformTreasury] = await ethers.getSigners()

    const mockToken1 = await ethers.deployContract('MockERC20', [
      'Mock Token 1',
      'MT1',
      ethers.parseUnits('100')
    ])

    await mockToken1.waitForDeployment()

    const mockTokenRegistry = await ethers.deployContract('MockTokenRegistry')
    await mockTokenRegistry.waitForDeployment()
    const mockTokenRegistryAddress = await mockTokenRegistry.getAddress()

    const mockERC20Address = await mockToken1.getAddress()

    await mockTokenRegistry.addSupportedToken(mockERC20Address, true)

    const mockYieldDistributor = await ethers.deployContract(
      'MockYieldDistributor',
      [platformTreasury.address]
    )
    await mockYieldDistributor.waitForDeployment()
    const mockYieldDistributorAddress = await mockYieldDistributor.getAddress()

    const mockDefiManager = await ethers.deployContract('MockDefiManager', [
      mockTokenRegistryAddress,
      mockYieldDistributorAddress
    ])
    await mockDefiManager.waitForDeployment()
    const mockDefiManagerAddress = await mockDefiManager.getAddress()

    const campaign = await ethers.deployContract('Campaign', [
      owner,
      mockERC20Address,
      CAMPAIGN_GOAL_AMOUNT,
      CAMPAIGN_DURATION,
      mockDefiManagerAddress
    ])

    await campaign.waitForDeployment()

    await mockToken1.transfer(user1.address, ethers.parseUnits('10'))
    await mockToken1.transfer(user2.address, ethers.parseUnits('10'))

    return {
      owner,
      user1,
      user2,
      platformTreasury,
      mockToken1,
      campaign,
      mockTokenRegistry,
      mockDefiManager,
      mockYieldDistributor,
      CAMPAIGN_GOAL_AMOUNT,
      CAMPAIGN_DURATION
    }
  }

  describe('Deployment', function () {
    it('should deploy all contracts successfully', async function () {
      const { campaign, mockToken1 } = await loadFixture(deployCampaignFixture)

      expect(await campaign.getAddress()).to.be.properAddress
      expect(await mockToken1.getAddress()).to.be.properAddress
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
      const currentTimestamp = latestBlock.timestamp

      expect(startTime).to.be.closeTo(currentTimestamp, 5)

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
      const [owner] = await ethers.getSigners()

      const mockToken1 = await ethers.deployContract('MockERC20', [
        'Mock Token 1',
        'MT1',
        ethers.parseUnits('100')
      ])

      await mockToken1.waitForDeployment()

      const mockTokenRegistry = await ethers.deployContract('MockTokenRegistry')
      await mockTokenRegistry.waitForDeployment()
      const mockTokenRegistryAddress = await mockTokenRegistry.getAddress()

      const mockERC20Address = await mockToken1.getAddress()

      const CAMPAIGN_GOAL_AMOUNT = 5
      const CAMPAIGN_DURATION = 30

      const CampaignFactory = await ethers.getContractFactory('Campaign')

      await expect(
        CampaignFactory.deploy(
          owner.address,
          mockERC20Address,
          CAMPAIGN_GOAL_AMOUNT,
          CAMPAIGN_DURATION,
          ethers.ZeroAddress
        )
      ).to.be.revertedWithCustomError(CampaignFactory, 'InvalidAddress')
    })

    it('Should revert if zero address is provided as token', async function () {
      const [owner, platformTreasury] = await ethers.getSigners()

      const mockTokenRegistry = await ethers.deployContract('MockTokenRegistry')
      await mockTokenRegistry.waitForDeployment()
      const mockTokenRegistryAddress = await mockTokenRegistry.getAddress()

      const mockYieldDistributor = await ethers.deployContract(
        'MockYieldDistributor',
        [platformTreasury.address]
      )
      await mockYieldDistributor.waitForDeployment()
      const mockYieldDistributorAddress =
        await mockYieldDistributor.getAddress()

      const mockDefiManager = await ethers.deployContract('MockDefiManager', [
        mockTokenRegistryAddress,
        mockYieldDistributorAddress
      ])

      mockDefiManager.waitForDeployment()

      const mockDefiManagerAddress = await mockDefiManager.getAddress()

      const CAMPAIGN_GOAL_AMOUNT = 5
      const CAMPAIGN_DURATION = 30

      const CampaignFactory = await ethers.getContractFactory('Campaign')

      await expect(
        CampaignFactory.deploy(
          owner.address,
          ethers.ZeroAddress,
          CAMPAIGN_GOAL_AMOUNT,
          CAMPAIGN_DURATION,
          mockDefiManagerAddress
        )
      ).to.be.revertedWithCustomError(CampaignFactory, 'InvalidAddress')
    })

    it('Should revert if non-supported token address is provided to campaign constructor', async function () {
      const [owner, platformTreasury] = await ethers.getSigners()

      const mockTokenRegistry = await ethers.deployContract('MockTokenRegistry')
      await mockTokenRegistry.waitForDeployment()
      const mockTokenRegistryAddress = await mockTokenRegistry.getAddress()

      const mockYieldDistributor = await ethers.deployContract(
        'MockYieldDistributor',
        [platformTreasury.address]
      )
      await mockYieldDistributor.waitForDeployment()
      const mockYieldDistributorAddress =
        await mockYieldDistributor.getAddress()

      const mockDefiManager = await ethers.deployContract('MockDefiManager', [
        mockTokenRegistryAddress,
        mockYieldDistributorAddress
      ])

      mockDefiManager.waitForDeployment()

      const mockDefiManagerAddress = await mockDefiManager.getAddress()

      const nonCompliantToken = await ethers.deployContract(
        'MockNonCompliantToken'
      )

      await nonCompliantToken.waitForDeployment()

      const nonCompliantAddress = await nonCompliantToken.getAddress()

      const CAMPAIGN_GOAL_AMOUNT = 5
      const CAMPAIGN_DURATION = 30

      const CampaignFactory = await ethers.getContractFactory('Campaign')

      await expect(
        CampaignFactory.deploy(
          owner.address,
          nonCompliantAddress,
          CAMPAIGN_GOAL_AMOUNT,
          CAMPAIGN_DURATION,
          mockDefiManagerAddress
        )
      )
        .to.be.revertedWithCustomError(
          CampaignFactory,
          'ContributionTokenNotSupported'
        )
        .withArgs(nonCompliantAddress)
    })

    it('Should revert if invalid goal amount is provided to campaign constructor', async function () {
      const [owner, platformTreasury] = await ethers.getSigners()

      const mockTokenRegistry = await ethers.deployContract('MockTokenRegistry')
      await mockTokenRegistry.waitForDeployment()
      const mockTokenRegistryAddress = await mockTokenRegistry.getAddress()

      const mockYieldDistributor = await ethers.deployContract(
        'MockYieldDistributor',
        [platformTreasury.address]
      )
      await mockYieldDistributor.waitForDeployment()
      const mockYieldDistributorAddress =
        await mockYieldDistributor.getAddress()

      const mockDefiManager = await ethers.deployContract('MockDefiManager', [
        mockTokenRegistryAddress,
        mockYieldDistributorAddress
      ])

      mockDefiManager.waitForDeployment()

      const mockDefiManagerAddress = await mockDefiManager.getAddress()

      const mockToken1 = await ethers.deployContract('MockERC20', [
        'Mock Token 1',
        'MT1',
        ethers.parseUnits('100')
      ])

      await mockToken1.waitForDeployment()

      const mockERC20Address = await mockToken1.getAddress()

      await mockTokenRegistry.addSupportedToken(mockERC20Address, true)

      const CAMPAIGN_GOAL_AMOUNT = 0
      const CAMPAIGN_DURATION = 30

      const CampaignFactory = await ethers.getContractFactory('Campaign')

      await expect(
        CampaignFactory.deploy(
          owner.address,
          mockERC20Address,
          CAMPAIGN_GOAL_AMOUNT,
          CAMPAIGN_DURATION,
          mockDefiManagerAddress
        )
      )
        .to.be.revertedWithCustomError(CampaignFactory, 'InvalidGoalAmount')
        .withArgs(CAMPAIGN_GOAL_AMOUNT)
    })

    it('Should revert if invalid campaign duration is provided to campaign constructor', async function () {
      const [owner, platformTreasury] = await ethers.getSigners()

      const mockTokenRegistry = await ethers.deployContract('MockTokenRegistry')
      await mockTokenRegistry.waitForDeployment()
      const mockTokenRegistryAddress = await mockTokenRegistry.getAddress()

      const mockYieldDistributor = await ethers.deployContract(
        'MockYieldDistributor',
        [platformTreasury.address]
      )
      await mockYieldDistributor.waitForDeployment()
      const mockYieldDistributorAddress =
        await mockYieldDistributor.getAddress()

      const mockDefiManager = await ethers.deployContract('MockDefiManager', [
        mockTokenRegistryAddress,
        mockYieldDistributorAddress
      ])

      await mockDefiManager.waitForDeployment()
      const mockDefiManagerAddress = await mockDefiManager.getAddress()

      const mockToken1 = await ethers.deployContract('MockERC20', [
        'Mock Token 1',
        'MT1',
        ethers.parseUnits('100')
      ])

      await mockToken1.waitForDeployment()

      const mockERC20Address = await mockToken1.getAddress()

      await mockTokenRegistry.addSupportedToken(mockERC20Address, true)

      const CAMPAIGN_GOAL_AMOUNT = 5
      const CAMPAIGN_DURATION = 0

      const CampaignFactory = await ethers.getContractFactory('Campaign')

      await expect(
        CampaignFactory.deploy(
          owner.address,
          mockERC20Address,
          CAMPAIGN_GOAL_AMOUNT,
          CAMPAIGN_DURATION,
          mockDefiManagerAddress
        )
      )
        .to.be.revertedWithCustomError(
          CampaignFactory,
          'InvalidCampaignDuration'
        )
        .withArgs(CAMPAIGN_DURATION)
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

      await expect(campaign.connect(user1).contribute(contributionAmount))
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

      await expect(campaign.connect(user1).contribute(contributionAmount))
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

      await expect(campaign.connect(user2).contribute(contributionAmount))
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

      await expect(campaign.connect(user1).contribute(contributionAmount))
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

      await expect(campaign.connect(user1).contribute(contributionAmount))
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

      await expect(campaign.connect(user1).contribute(0))
        .to.be.revertedWithCustomError(campaign, 'InvalidContributionAmount')
        .withArgs(0)
    })

    it('Should revert when campaignGoalAmount is reached', async function () {
      const { campaign, mockToken1, user1, CAMPAIGN_GOAL_AMOUNT } =
        await loadFixture(deployCampaignFixture)

      await mockToken1
        .connect(user1)
        .approve(await campaign.getAddress(), CAMPAIGN_GOAL_AMOUNT * 2)

      await campaign.connect(user1).contribute(CAMPAIGN_GOAL_AMOUNT)

      await expect(
        campaign.connect(user1).contribute(1)
      ).to.be.revertedWithCustomError(campaign, 'CampaignGoalReached')
    })

    it('Should revert when campaign is not active', async function () {
      const { campaign, mockToken1, user1 } = await loadFixture(
        deployCampaignFixture
      )

      await ethers.provider.send('evm_increaseTime', [31 * 24 * 60 * 60])
      await ethers.provider.send('evm_mine')

      await mockToken1.connect(user1).approve(await campaign.getAddress(), 10)

      await expect(
        campaign.connect(user1).contribute(1)
      ).to.be.revertedWithCustomError(campaign, 'CampaignNotActive')
    })

    it('Should reject ETH sent directly to the contract', async function () {
      const { campaign, user1 } = await loadFixture(deployCampaignFixture)

      await expect(
        user1.sendTransaction({
          to: await campaign.getAddress(),
          value: ethers.parseEther('1')
        })
      ).to.be.revertedWithCustomError(campaign, 'ETHNotAccepted')
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

        await campaign.connect(user1).contribute(CAMPAIGN_GOAL_AMOUNT)

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

        await campaign.connect(user1).contribute(CAMPAIGN_GOAL_AMOUNT)

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

        await expect(
          campaign.connect(owner).claimFunds()
        ).to.be.revertedWithCustomError(campaign, 'FundsAlreadyClaimed')
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

        await campaign.connect(user1).contribute(CAMPAIGN_GOAL_AMOUNT)

        await ethers.provider.send('evm_increaseTime', [
          (CAMPAIGN_DURATION - 1) * 24 * 60 * 60
        ])
        await ethers.provider.send('evm_mine')

        const campaignBalanceBefore = await mockToken1.balanceOf(
          await campaign.getAddress()
        )
        const ownerBalanceBefore = await mockToken1.balanceOf(owner.address)

        await expect(
          campaign.connect(owner).claimFunds()
        ).to.be.revertedWithCustomError(campaign, 'CampaignStillActive')

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

        await campaign.connect(user1).contribute(CAMPAIGN_GOAL_AMOUNT - 1)

        await ethers.provider.send('evm_increaseTime', [
          (CAMPAIGN_DURATION + 1) * 24 * 60 * 60
        ])
        await ethers.provider.send('evm_mine')

        const campaignBalanceBefore = await mockToken1.balanceOf(
          await campaign.getAddress()
        )
        const ownerBalanceBefore = await mockToken1.balanceOf(owner.address)

        await expect(
          campaign.connect(owner).claimFunds()
        ).to.be.revertedWithCustomError(campaign, 'CampaignGoalNotReached')

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

        await campaign.connect(user1).contribute(CAMPAIGN_GOAL_AMOUNT)

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
        const [owner, user1, platformTreasury] = await ethers.getSigners()

        const CAMPAIGN_GOAL_AMOUNT = 5
        const CAMPAIGN_DURATION = 30

        const mockFailingToken = await ethers.deployContract(
          'MockFailingERC20',
          ['Failing Token', 'FAIL', ethers.parseUnits('100')]
        )

        await mockFailingToken.waitForDeployment()

        const mockTokenRegistry = await ethers.deployContract(
          'MockTokenRegistry'
        )
        await mockTokenRegistry.waitForDeployment()
        await mockTokenRegistry.addSupportedToken(
          await mockFailingToken.getAddress(),
          true
        )
        const mockTokenRegistryAddress = await mockTokenRegistry.getAddress()

        const mockYieldDistributor = await ethers.deployContract(
          'MockYieldDistributor',
          [platformTreasury.address]
        )
        await mockYieldDistributor.waitForDeployment()
        const mockYieldDistributorAddress =
          await mockYieldDistributor.getAddress()

        const mockDefiManager = await ethers.deployContract('MockDefiManager', [
          mockTokenRegistryAddress,
          mockYieldDistributorAddress
        ])

        await mockDefiManager.waitForDeployment()

        const CampaignFactory = await ethers.getContractFactory('Campaign')
        const campaign = await CampaignFactory.deploy(
          owner.address,
          await mockFailingToken.getAddress(),
          CAMPAIGN_GOAL_AMOUNT,
          CAMPAIGN_DURATION,
          await mockDefiManager.getAddress()
        )
        await campaign.waitForDeployment()

        await mockFailingToken.transfer(user1.address, CAMPAIGN_GOAL_AMOUNT)

        await mockFailingToken
          .connect(user1)
          .approve(await campaign.getAddress(), CAMPAIGN_GOAL_AMOUNT)

        await campaign.connect(user1).contribute(CAMPAIGN_GOAL_AMOUNT)

        await ethers.provider.send('evm_increaseTime', [
          (CAMPAIGN_DURATION + 1) * 24 * 60 * 60
        ])
        await ethers.provider.send('evm_mine')

        const campaignBalanceBefore = await mockFailingToken.balanceOf(
          await campaign.getAddress()
        )
        const ownerBalanceBefore = await mockFailingToken.balanceOf(
          owner.address
        )

        await mockFailingToken.setTransferShouldFail(true)

        await expect(
          campaign.connect(owner).claimFunds()
        ).to.be.revertedWithCustomError(campaign, 'SafeERC20FailedOperation')

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

        await campaign.connect(user1).contribute(contributionAmount)

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

        await expect(
          campaign.connect(user1).requestRefund()
        ).to.be.revertedWithCustomError(campaign, 'AlreadyRefunded')
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

        await campaign.connect(user1).contribute(contributionAmount)

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

        await expect(
          campaign.connect(user1).requestRefund()
        ).to.be.revertedWithCustomError(campaign, 'CampaignStillActive')

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

        await campaign.connect(user1).contribute(contributionAmount)

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

        await expect(
          campaign.connect(user1).requestRefund()
        ).to.be.revertedWithCustomError(campaign, 'CampaignGoalReached')

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

        await campaign.connect(user1).contribute(contributionAmount)

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
          .to.be.revertedWithCustomError(campaign, 'NothingToRefund')
          .withArgs(user2.address)

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
        const [owner, user1, platformTreasury] = await ethers.getSigners()

        const CAMPAIGN_GOAL_AMOUNT = 5
        const CAMPAIGN_DURATION = 30

        const mockFailingToken = await ethers.deployContract(
          'MockFailingERC20',
          ['Failing Token', 'FAIL', ethers.parseUnits('100')]
        )

        await mockFailingToken.waitForDeployment()

        const mockTokenRegistry = await ethers.deployContract(
          'MockTokenRegistry'
        )
        await mockTokenRegistry.waitForDeployment()
        await mockTokenRegistry.addSupportedToken(
          await mockFailingToken.getAddress(),
          true
        )

        const mockTokenRegistryAddress = await mockTokenRegistry.getAddress()

        const mockYieldDistributor = await ethers.deployContract(
          'MockYieldDistributor',
          [platformTreasury.address]
        )
        await mockYieldDistributor.waitForDeployment()
        const mockYieldDistributorAddress =
          await mockYieldDistributor.getAddress()

        const mockDefiManager = await ethers.deployContract('MockDefiManager', [
          mockTokenRegistryAddress,
          mockYieldDistributorAddress
        ])

        await mockDefiManager.waitForDeployment()

        const CampaignFactory = await ethers.getContractFactory('Campaign')
        const campaign = await CampaignFactory.deploy(
          owner.address,
          await mockFailingToken.getAddress(),
          CAMPAIGN_GOAL_AMOUNT,
          CAMPAIGN_DURATION,
          await mockDefiManager.getAddress()
        )
        await campaign.waitForDeployment()

        await mockFailingToken.transfer(user1.address, CAMPAIGN_GOAL_AMOUNT - 1)
        const contributionAmount = CAMPAIGN_GOAL_AMOUNT - 1

        await mockFailingToken
          .connect(user1)
          .approve(await campaign.getAddress(), contributionAmount)

        await campaign.connect(user1).contribute(contributionAmount)

        await ethers.provider.send('evm_increaseTime', [
          (CAMPAIGN_DURATION + 1) * 24 * 60 * 60
        ])
        await ethers.provider.send('evm_mine')

        await mockFailingToken.setTransferShouldFail(true)

        await expect(
          campaign.connect(user1).requestRefund()
        ).to.be.revertedWithCustomError(campaign, 'SafeERC20FailedOperation')

        expect(await campaign.contributions(user1.address)).to.equal(
          contributionAmount
        )
      })
    })
  })

  describe('Defi Integration', function () {
    describe('Depositing into yield protocols', function () {
      it('Should allow owner to deposit funds into yield protocol', async function () {
        const { campaign, mockDefiManager, mockToken1, user1 } =
          await loadFixture(deployCampaignFixture)

        const contributionAmount = 2

        const contributionAmountBigInt = BigInt(contributionAmount)

        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), contributionAmount)

        await campaign.connect(user1).contribute(contributionAmount)

        const mockDefiManagerAddress = await mockDefiManager.getAddress()
        const campaignAddress = await campaign.getAddress()

        const campaignBalanceBeforeYieldProtocolDeposit =
          await mockToken1.balanceOf(campaignAddress)

        const mockDefiManagerBalanceBeforeYieldProtocolDeposit =
          await mockToken1.balanceOf(mockDefiManagerAddress)

        await expect(
          campaign.depositToYieldProtocol(mockToken1, contributionAmount)
        )
          .to.emit(campaign, 'FundsDeposited')
          .withArgs(mockToken1, contributionAmount)

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

        const contributionAmountBigInt = BigInt(contributionAmount)

        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), contributionAmount)

        await campaign.connect(user1).contribute(contributionAmount)

        const mockDefiManagerAddress = await mockDefiManager.getAddress()
        const campaignAddress = await campaign.getAddress()

        const campaignBalanceBeforeYieldProtocolDeposit =
          await mockToken1.balanceOf(campaignAddress)

        const mockDefiManagerBalanceBeforeYieldProtocolDeposit =
          await mockToken1.balanceOf(mockDefiManagerAddress)

        await expect(
          campaign
            .connect(user1)
            .depositToYieldProtocol(mockToken1, contributionAmount)
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

        //From the POV of the campaign, the transfer ends here
        expect(mockDefiManagerBalanceAfterYieldProtocolDeposit).to.equal(0)
      })

      it('Should revert with DefiActionFailed if deposit to yield protocol fails', async function () {
        const { campaign, mockDefiManager, mockToken1, user1, owner } =
          await loadFixture(deployCampaignFixture)

        const contributionAmount = 2

        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), contributionAmount)

        await campaign.connect(user1).contribute(contributionAmount)

        await mockDefiManager.setDepositSuccess(false)

        await expect(
          campaign
            .connect(owner)
            .depositToYieldProtocol(
              await mockToken1.getAddress(),
              contributionAmount
            )
        ).to.be.revertedWithCustomError(campaign, 'DefiActionFailed')

        const campaignBalance = await mockToken1.balanceOf(
          await campaign.getAddress()
        )
        expect(campaignBalance).to.equal(BigInt(contributionAmount))

        const defiManagerBalance = await mockToken1.balanceOf(
          await mockDefiManager.getAddress()
        )
        expect(defiManagerBalance).to.equal(0)
      })
    })

    describe('Harvesting yield', function () {
      it('Should allow owner to harvest yield', async function () {
        const {
          campaign,
          mockDefiManager,
          mockToken1,
          mockYieldDistributor,
          user1,
          platformTreasury
        } = await loadFixture(deployCampaignFixture)

        const depositAmount = 100
        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), depositAmount)
        await campaign.connect(user1).contribute(depositAmount)

        await campaign.depositToYieldProtocol(
          await mockToken1.getAddress(),
          depositAmount
        )

        const yieldRate = await mockDefiManager.yieldRate()

        const totalYield =
          (BigInt(depositAmount) * BigInt(yieldRate)) / BigInt(10000)

        const [expectedCreatorYield, expectedPlatformYield] =
          await mockYieldDistributor.calculateYieldShares(totalYield)

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
          .to.emit(campaign, 'YieldHarvested')
          .withArgs(await mockToken1.getAddress(), expectedCreatorYield)

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
        await campaign.connect(user1).contribute(depositAmount)

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
        await campaign.connect(user1).contribute(depositAmount)

        await campaign.depositToYieldProtocol(
          await mockToken1.getAddress(),
          depositAmount
        )

        await mockDefiManager.setHarvestSuccess(false)

        await expect(
          campaign.harvestYield(await mockToken1.getAddress())
        ).to.be.revertedWithCustomError(campaign, 'DefiActionFailed')
      })
    })

    describe('Withdrawing from yield protocols', function () {
      describe('Withdrawing from yield protocols', function () {
        it('Should allow owner to withdraw a specific amount from yield protocol', async function () {
          const { campaign, mockDefiManager, mockToken1, user1, owner } =
            await loadFixture(deployCampaignFixture)

          const depositAmount = 100
          await mockToken1
            .connect(user1)
            .approve(await campaign.getAddress(), depositAmount)
          await campaign.connect(user1).contribute(depositAmount)

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
            .to.emit(campaign, 'WithdrawnFromYield')
            .withArgs(await mockToken1.getAddress(), withdrawAmount)

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
          await campaign.connect(user1).contribute(depositAmount)

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
            .to.emit(campaign, 'WithdrawnFromYield')
            .withArgs(await mockToken1.getAddress(), depositAmount)

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
          await campaign.connect(user1).contribute(depositAmount)

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
            .to.be.revertedWithCustomError(
              campaign,
              'OwnableUnauthorizedAccount'
            )
            .withArgs(user2.address)

          await expect(
            campaign
              .connect(user2)
              .withdrawAllFromYieldProtocol(await mockToken1.getAddress())
          )
            .to.be.revertedWithCustomError(
              campaign,
              'OwnableUnauthorizedAccount'
            )
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
          await campaign.connect(user1).contribute(depositAmount)

          await campaign.depositToYieldProtocol(
            await mockToken1.getAddress(),
            depositAmount
          )

          await mockDefiManager.setWithdrawSuccess(false)

          await expect(
            campaign.withdrawFromYieldProtocol(
              await mockToken1.getAddress(),
              50
            )
          ).to.be.revertedWithCustomError(campaign, 'DefiActionFailed')

          await expect(
            campaign.withdrawAllFromYieldProtocol(await mockToken1.getAddress())
          ).to.be.revertedWithCustomError(campaign, 'DefiActionFailed')

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
          await campaign.connect(user1).contribute(depositAmount)

          await campaign.depositToYieldProtocol(
            await mockToken1.getAddress(),
            depositAmount
          )

          const initialDepositedAmount =
            await mockDefiManager.getDepositedAmount(
              await campaign.getAddress(),
              await mockToken1.getAddress()
            )
          expect(initialDepositedAmount).to.equal(BigInt(depositAmount))

          const excessiveAmount = depositAmount * 2

          await expect(
            campaign.withdrawFromYieldProtocol(
              await mockToken1.getAddress(),
              excessiveAmount
            )
          ).to.be.revertedWithCustomError(campaign, 'DefiActionFailed')

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
            .to.emit(campaign, 'WithdrawnFromYield')
            .withArgs(await mockToken1.getAddress(), depositAmount)
        })

        it('Should withdraw zero if nothing is deposited', async function () {
          const { campaign, mockDefiManager, mockToken1, owner } =
            await loadFixture(deployCampaignFixture)

          const depositedAmount = await mockDefiManager.getDepositedAmount(
            await campaign.getAddress(),
            await mockToken1.getAddress()
          )
          expect(depositedAmount).to.equal(0)

          await expect(
            campaign.withdrawAllFromYieldProtocol(await mockToken1.getAddress())
          ).to.revertedWithCustomError(campaign, 'DefiActionFailed')

          await expect(
            campaign.withdrawFromYieldProtocol(
              await mockToken1.getAddress(),
              50
            )
          ).to.revertedWithCustomError(campaign, 'DefiActionFailed')
        })
      })
    })

    describe('Token swaps', function () {
      it('Should allow owner to swap tokens successfully', async function () {
        const { campaign, mockDefiManager, mockToken1, owner, user1 } =
          await loadFixture(deployCampaignFixture)

        const mockToken2 = await ethers.deployContract('MockERC20', [
          'Second Token',
          'TKN2',
          ethers.parseUnits('1000')
        ])
        await mockToken2.waitForDeployment()

        const token1Address = await mockToken1.getAddress()
        const token2Address = await mockToken2.getAddress()

        const tokenRegistry = await ethers.getContractAt(
          'MockTokenRegistry',
          await mockDefiManager.mockTokenRegistryAddress()
        )
        await tokenRegistry.addSupportedToken(token2Address, true)

        const swapAmount = 50
        const expectedReturnAmount = swapAmount * 2
        await mockToken2.transfer(
          await mockDefiManager.getAddress(),
          expectedReturnAmount
        )

        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), 100)
        await campaign.connect(user1).contribute(100)

        const initialToken1Balance = await mockToken1.balanceOf(
          await campaign.getAddress()
        )
        const initialToken2Balance = await mockToken2.balanceOf(
          await campaign.getAddress()
        )

        expect(initialToken1Balance).to.equal(100)
        expect(initialToken2Balance).to.equal(0)

        await expect(
          campaign
            .connect(owner)
            .swapTokens(token1Address, swapAmount, token2Address)
        )
          .to.emit(campaign, 'TokensSwapped')
          .withArgs(
            token1Address,
            token2Address,
            swapAmount,
            expectedReturnAmount
          )

        const finalToken1Balance = await mockToken1.balanceOf(
          await campaign.getAddress()
        )
        const finalToken2Balance = await mockToken2.balanceOf(
          await campaign.getAddress()
        )

        expect(finalToken1Balance).to.equal(
          initialToken1Balance - BigInt(swapAmount)
        )
        expect(finalToken2Balance).to.equal(
          initialToken2Balance + BigInt(expectedReturnAmount)
        )
      })

      it('Should revert if someone other than owner tries to swap tokens', async function () {
        const { campaign, mockDefiManager, mockToken1, owner, user1 } =
          await loadFixture(deployCampaignFixture)

        const mockToken2 = await ethers.deployContract('MockERC20', [
          'Second Token',
          'TKN2',
          ethers.parseUnits('1000')
        ])
        await mockToken2.waitForDeployment()

        const token1Address = await mockToken1.getAddress()
        const token2Address = await mockToken2.getAddress()

        const tokenRegistry = await ethers.getContractAt(
          'MockTokenRegistry',
          await mockDefiManager.mockTokenRegistryAddress()
        )
        await tokenRegistry.addSupportedToken(token2Address, true)

        const swapAmount = 50
        const expectedReturnAmount = swapAmount * 2
        await mockToken2.transfer(
          await mockDefiManager.getAddress(),
          expectedReturnAmount
        )

        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), 100)
        await campaign.connect(user1).contribute(100)

        const initialToken1Balance = await mockToken1.balanceOf(
          await campaign.getAddress()
        )
        const initialToken2Balance = await mockToken2.balanceOf(
          await campaign.getAddress()
        )

        expect(initialToken1Balance).to.equal(100)
        expect(initialToken2Balance).to.equal(0)

        await expect(
          campaign
            .connect(user1)
            .swapTokens(token1Address, swapAmount, token2Address)
        )
          .to.revertedWithCustomError(campaign, 'OwnableUnauthorizedAccount')
          .withArgs(user1.address)

        const finalToken1Balance = await mockToken1.balanceOf(
          await campaign.getAddress()
        )
        const finalToken2Balance = await mockToken2.balanceOf(
          await campaign.getAddress()
        )

        expect(finalToken1Balance).to.equal(initialToken1Balance)
        expect(finalToken2Balance).to.equal(initialToken2Balance)
      })

      it('Should revert if swap amount is 0', async function () {
        const { campaign, mockDefiManager, mockToken1, owner, user1 } =
          await loadFixture(deployCampaignFixture)

        const mockToken2 = await ethers.deployContract('MockERC20', [
          'Second Token',
          'TKN2',
          ethers.parseUnits('1000')
        ])
        await mockToken2.waitForDeployment()

        const token1Address = await mockToken1.getAddress()
        const token2Address = await mockToken2.getAddress()

        const tokenRegistry = await ethers.getContractAt(
          'MockTokenRegistry',
          await mockDefiManager.mockTokenRegistryAddress()
        )
        await tokenRegistry.addSupportedToken(token2Address, true)

        const swapAmount = 0
        const expectedReturnAmount = swapAmount * 2
        await mockToken2.transfer(
          await mockDefiManager.getAddress(),
          expectedReturnAmount
        )

        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), 100)
        await campaign.connect(user1).contribute(100)

        const initialToken1Balance = await mockToken1.balanceOf(
          await campaign.getAddress()
        )
        const initialToken2Balance = await mockToken2.balanceOf(
          await campaign.getAddress()
        )

        expect(initialToken1Balance).to.equal(100)
        expect(initialToken2Balance).to.equal(0)

        await expect(
          campaign.swapTokens(token1Address, swapAmount, token2Address)
        )
          .to.revertedWithCustomError(campaign, 'InvalidSwapAmount')
          .withArgs(swapAmount)

        const finalToken1Balance = await mockToken1.balanceOf(
          await campaign.getAddress()
        )
        const finalToken2Balance = await mockToken2.balanceOf(
          await campaign.getAddress()
        )

        expect(finalToken1Balance).to.equal(initialToken1Balance)
        expect(finalToken2Balance).to.equal(initialToken2Balance)
      })

      it('Should revert if swap amount is larger than campaign balance', async function () {
        const { campaign, mockDefiManager, mockToken1, owner, user1 } =
          await loadFixture(deployCampaignFixture)

        const mockToken2 = await ethers.deployContract('MockERC20', [
          'Second Token',
          'TKN2',
          ethers.parseUnits('1000')
        ])
        await mockToken2.waitForDeployment()

        const token1Address = await mockToken1.getAddress()
        const token2Address = await mockToken2.getAddress()

        const tokenRegistry = await ethers.getContractAt(
          'MockTokenRegistry',
          await mockDefiManager.mockTokenRegistryAddress()
        )
        await tokenRegistry.addSupportedToken(token2Address, true)

        const swapAmount = 200
        const expectedReturnAmount = swapAmount * 2
        await mockToken2.transfer(
          await mockDefiManager.getAddress(),
          expectedReturnAmount
        )

        await mockToken1
          .connect(user1)
          .approve(await campaign.getAddress(), 100)
        await campaign.connect(user1).contribute(100)

        const initialToken1Balance = await mockToken1.balanceOf(
          await campaign.getAddress()
        )
        const initialToken2Balance = await mockToken2.balanceOf(
          await campaign.getAddress()
        )

        expect(initialToken1Balance).to.equal(100)
        expect(initialToken2Balance).to.equal(0)

        await expect(
          campaign.swapTokens(token1Address, swapAmount, token2Address)
        ).to.revertedWithCustomError(campaign, 'DefiActionFailed')

        const finalToken1Balance = await mockToken1.balanceOf(
          await campaign.getAddress()
        )
        const finalToken2Balance = await mockToken2.balanceOf(
          await campaign.getAddress()
        )

        expect(finalToken1Balance).to.equal(initialToken1Balance)
        expect(finalToken2Balance).to.equal(initialToken2Balance)
      })

      it('Should revert when swapping with a non-compliant token', async function () {
        const { campaign, mockDefiManager, mockToken1, owner } =
          await loadFixture(deployCampaignFixture)

        // Deploy the non-compliant token
        const nonCompliantToken = await ethers.deployContract(
          'MockNonCompliantToken'
        )
        await nonCompliantToken.waitForDeployment()

        const nonCompliantTokenAddress = await nonCompliantToken.getAddress()
        const token1Address = await mockToken1.getAddress()

        // Try to swap from the non-compliant token to a valid token
        await expect(
          campaign
            .connect(owner)
            .swapTokens(nonCompliantTokenAddress, 50, token1Address)
        ).to.be.reverted // This should revert, but the exact error might depend on your implementation

        // Also test swapping to the non-compliant token
        await mockToken1.transfer(await campaign.getAddress(), 100)

        await expect(
          campaign
            .connect(owner)
            .swapTokens(token1Address, 50, nonCompliantTokenAddress)
        ).to.be.revertedWithCustomError(campaign, 'DefiActionFailed')
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
        await campaign.connect(user1).contribute(CAMPAIGN_GOAL_AMOUNT)

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
        await campaign.connect(user1).contribute(partialAmount)

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
        await campaign.connect(user1).contribute(depositAmount)

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
})
