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
    it('Should allow user to contribute ERC20 tokens to campaign', async function () {
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
})
