import { token } from '../typechain-types/@openzeppelin/contracts'

const { expect } = require('chai')
const { ethers } = require('hardhat')
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers')

describe('Campaign', function () {
  async function deployYieldDistributorFixture () {
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

    return {
      owner,
      user1,
      user2,
      mockToken1,
      campaign,
      CAMPAIGN_GOAL_AMOUNT,
      CAMPAIGN_DURATION
    }
  }

  describe('Deployment', function () {
    it('should deploy all contracts successfully', async function () {
      const { campaign, mockToken1 } = await loadFixture(
        deployYieldDistributorFixture
      )

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
      } = await loadFixture(deployYieldDistributorFixture)

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

      const mockERC20Address = mockToken1.getAddress()

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

      const mockERC20Address = mockToken1.getAddress()

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

      const mockERC20Address = mockToken1.getAddress()

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
})
