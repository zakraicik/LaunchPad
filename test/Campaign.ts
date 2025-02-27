import { token } from '../typechain-types/@openzeppelin/contracts'

const { expect } = require('chai')
const { ethers } = require('hardhat')
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers')

describe('Campaign', function () {
  async function deployCampaignFixture () {
    const CAMPAIGN_GOAL_AMOUNT = 5
    const CAMPAIGN_DURATION = 30

    const [owner, user1, user2] = await ethers.getSigners()

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

    const mockDefiManager = await ethers.deployContract('MockDefiManager', [
      mockTokenRegistryAddress
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
      mockToken1,
      campaign,
      mockTokenRegistry,
      mockDefiManager,
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
      const [owner] = await ethers.getSigners()

      const mockTokenRegistry = await ethers.deployContract('MockTokenRegistry')
      await mockTokenRegistry.waitForDeployment()
      const mockTokenRegistryAddress = await mockTokenRegistry.getAddress()

      const mockDefiManager = await ethers.deployContract('MockDefiManager', [
        mockTokenRegistryAddress
      ])
      await mockDefiManager.waitForDeployment()
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
      const [owner] = await ethers.getSigners()

      const mockTokenRegistry = await ethers.deployContract('MockTokenRegistry')
      await mockTokenRegistry.waitForDeployment()
      const mockTokenRegistryAddress = await mockTokenRegistry.getAddress()

      const mockDefiManager = await ethers.deployContract('MockDefiManager', [
        mockTokenRegistryAddress
      ])
      await mockDefiManager.waitForDeployment()
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
      const [owner] = await ethers.getSigners()

      const mockTokenRegistry = await ethers.deployContract('MockTokenRegistry')
      await mockTokenRegistry.waitForDeployment()
      const mockTokenRegistryAddress = await mockTokenRegistry.getAddress()

      const mockDefiManager = await ethers.deployContract('MockDefiManager', [
        mockTokenRegistryAddress
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
      const [owner] = await ethers.getSigners()

      const mockTokenRegistry = await ethers.deployContract('MockTokenRegistry')
      await mockTokenRegistry.waitForDeployment()
      const mockTokenRegistryAddress = await mockTokenRegistry.getAddress()

      const mockDefiManager = await ethers.deployContract('MockDefiManager', [
        mockTokenRegistryAddress
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
        const [owner, user1] = await ethers.getSigners()

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

        const mockDefiManager = await ethers.deployContract('MockDefiManager', [
          await mockTokenRegistry.getAddress()
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
        ).to.be.revertedWithCustomError(campaign, 'ClaimTransferFailed')

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
        const [owner, user1] = await ethers.getSigners()

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

        const mockDefiManager = await ethers.deployContract('MockDefiManager', [
          await mockTokenRegistry.getAddress()
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
        ).to.be.revertedWithCustomError(campaign, 'RefundFailed')

        expect(await campaign.contributions(user1.address)).to.equal(
          contributionAmount
        )
      })
    })
  })

  describe('Defi Integration', function () {
    describe('Depositing into yield protocols', function () {})

    describe('Harvesting yield', function () {})

    describe('Withdrawing from yield protocols', function () {})

    describe('Token swaps', function () {})
  })

  describe('Getter Functions', function () {})
})
