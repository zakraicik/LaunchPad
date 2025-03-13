import { token } from '../typechain-types/@openzeppelin/contracts'

const { expect } = require('chai')
const { ethers } = require('hardhat')
import { Log } from 'ethers'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'

describe('CampaignContractFactory', function () {
  async function deployCampaignContractFactoryFixture () {
    const GRACE_PERIOD = 7 // 7 days grace period
    const [owner, user1, platformTreasury] = await ethers.getSigners()

    //Deploy mock ERC20 tokens
    const mockToken1 = await ethers.deployContract('MockERC20', [
      'Mock Token 1',
      'MT1',
      ethers.parseUnits('100000')
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

    //Deploy required mocks for defiManager
    const mockAToken1 = await ethers.deployContract('MockAToken', [
      'aMock Token 1',
      'aMT1',
      await mockToken1.getAddress()
    ])
    await mockAToken1.waitForDeployment()

    const mockAToken2 = await ethers.deployContract('MockAToken', [
      'aMock Token 2',
      'aMT2',
      await mockToken2.getAddress()
    ])
    await mockAToken2.waitForDeployment()

    const mockAavePool = await ethers.deployContract('MockAavePool', [
      await mockAToken1.getAddress()
    ])
    await mockAavePool.waitForDeployment()
    const mockAavePoolAddress = await mockAavePool.getAddress()

    const mockUniswapRouter = await ethers.deployContract('MockUniswapRouter')
    await mockUniswapRouter.waitForDeployment()
    const mockUniswapRouterAddress = await mockUniswapRouter.getAddress()

    const mockUniswapQuoter = await ethers.deployContract('MockUniswapQuoter')
    await mockUniswapQuoter.waitForDeployment()
    const mockUniswapQuoterAddress = await mockUniswapQuoter.getAddress()

    // Deploy defi manager with platform admin
    const defiManager = await ethers.deployContract('DefiIntegrationManager', [
      mockAavePoolAddress,
      mockUniswapRouterAddress,
      mockUniswapQuoterAddress,
      tokenRegistryAddress,
      yieldDistributorAddress,
      platformAdminAddress,
      owner
    ])
    await defiManager.waitForDeployment()
    const defiManagerAddress = await defiManager.getAddress()

    // Deploy campaign factory with defi manager and platform admin
    const campaignContractFactory = await ethers.deployContract(
      'CampaignContractFactory',
      [defiManagerAddress, platformAdminAddress]
    )
    await campaignContractFactory.waitForDeployment()

    return {
      campaignContractFactory,
      owner,
      user1,
      platformTreasury,
      platformAdmin,
      defiManager,
      tokenRegistry,
      yieldDistributor,
      GRACE_PERIOD,
      mockToken1,
      mockToken2
    }
  }

  describe('Deployment', function () {
    it('Should correctly deploy campaignContractFactory', async function () {
      const { campaignContractFactory } = await loadFixture(
        deployCampaignContractFactoryFixture
      )

      expect(await campaignContractFactory.getAddress()).to.be.properAddress
    })

    it('Should correctly set the initial state', async function () {
      const { campaignContractFactory, defiManager, platformAdmin } =
        await loadFixture(deployCampaignContractFactoryFixture)

      const defiManagerAddress = await defiManager.getAddress()
      const platformAdminAddress = await platformAdmin.getAddress()

      expect(await campaignContractFactory.defiManager()).to.equal(
        defiManagerAddress
      )
      expect(await campaignContractFactory.platformAdmin()).to.equal(
        platformAdminAddress
      )
    })

    it('Should revert if an invalid defiManager address is passed to the constructor', async function () {
      const { platformAdmin } = await loadFixture(
        deployCampaignContractFactoryFixture
      )

      await expect(
        ethers.deployContract('CampaignContractFactory', [
          ethers.ZeroAddress,
          await platformAdmin.getAddress()
        ])
      ).to.be.revertedWithCustomError(
        await ethers.getContractFactory('CampaignContractFactory'),
        'InvalidAddress'
      )
    })

    it('Should revert if an invalid platformAdmin address is passed to the constructor', async function () {
      const { defiManager } = await loadFixture(
        deployCampaignContractFactoryFixture
      )

      await expect(
        ethers.deployContract('CampaignContractFactory', [
          await defiManager.getAddress(),
          ethers.ZeroAddress
        ])
      ).to.be.revertedWithCustomError(
        await ethers.getContractFactory('CampaignContractFactory'),
        'InvalidAddress'
      )
    })
  })

  describe('Deploying new campaigns', function () {
    it('Should allow new campaigns to be deployed with ERC20 token', async function () {
      const { campaignContractFactory, owner, mockToken1, tokenRegistry } =
        await loadFixture(deployCampaignContractFactoryFixture)

      const mockERC20Address = await mockToken1.getAddress()
      const campaignGoalAmount = 5
      const campaignDuration = 10

      const initialCampaignsCount =
        await campaignContractFactory.getCampaignsCount()

      expect(initialCampaignsCount).to.equal(0)

      const initialCreatorCampaignsCount =
        await campaignContractFactory.getCreatorCampaignsCount(owner.address)

      expect(initialCreatorCampaignsCount).to.equal(0)

      const initialCampaigns = await campaignContractFactory.getAllCampaigns()

      expect(initialCampaigns).to.have.lengthOf(0)

      const initialCreatorCampaigns =
        await campaignContractFactory.getCampaignsByCreator(owner.address)

      expect(initialCreatorCampaigns).to.have.lengthOf(0)

      expect(await tokenRegistry.isTokenSupported(mockERC20Address)).to.be.true

      const tx = await campaignContractFactory.deploy(
        mockERC20Address,
        campaignGoalAmount,
        campaignDuration
      )

      const receipt = await tx.wait()
      if (!receipt) {
        throw new Error('Transaction failed to return a receipt')
      }

      const event = receipt.logs.find((log: Log) => {
        try {
          const parsed = campaignContractFactory.interface.parseLog(log)
          return parsed && parsed.name === 'CampaignCreated'
        } catch {
          return false
        }
      })

      if (!event) {
        throw new Error('Failed to find CampaignCreated event in logs')
      }

      const parsedEvent = campaignContractFactory.interface.parseLog(event)

      if (!parsedEvent) {
        throw new Error('Failed to parse event log')
      }

      await expect(tx)
        .to.emit(campaignContractFactory, 'CampaignCreated')
        .withArgs(parsedEvent.args[0], owner.address, parsedEvent.args[2])

      const newCampaignsCount =
        await campaignContractFactory.getCampaignsCount()
      const newCreatorCampaignsCount =
        await campaignContractFactory.getCreatorCampaignsCount(owner.address)

      expect(newCampaignsCount).to.equal(initialCampaignsCount + 1n)
      expect(newCreatorCampaignsCount).to.equal(
        initialCreatorCampaignsCount + 1n
      )

      const lastDeployedCampaign =
        await campaignContractFactory.deployedCampaigns(0)
      expect(lastDeployedCampaign).to.equal(parsedEvent.args[0])

      const creatorCampaign = await campaignContractFactory.creatorToCampaigns(
        owner.address,
        0
      )
      expect(creatorCampaign).to.equal(parsedEvent.args[0])

      const Campaign = await ethers.getContractFactory('Campaign')
      const deployedCampaign = Campaign.attach(parsedEvent.args[0])
      expect(await (deployedCampaign as any).owner()).to.equal(owner.address)
    })

    it('Should correctly manage multiple campaigns from the same creator', async function () {
      const { campaignContractFactory, owner, mockToken1 } = await loadFixture(
        deployCampaignContractFactoryFixture
      )

      const mockERC20Address = await mockToken1.getAddress()

      const tx1 = await campaignContractFactory.deploy(mockERC20Address, 5, 10)
      const receipt1 = await tx1.wait()
      if (!receipt1) {
        throw new Error('Transaction failed to return a receipt')
      }

      const tx2 = await campaignContractFactory.deploy(mockERC20Address, 10, 15)
      const receipt2 = await tx2.wait()
      if (!receipt2) {
        throw new Error('Transaction failed to return a receipt')
      }

      expect(await campaignContractFactory.getCampaignsCount()).to.equal(2n)
      expect(
        await campaignContractFactory.getCreatorCampaignsCount(owner.address)
      ).to.equal(2n)

      const allCampaigns = await campaignContractFactory.getAllCampaigns()
      const creatorCampaigns =
        await campaignContractFactory.getCampaignsByCreator(owner.address)

      expect(allCampaigns).to.have.lengthOf(2)
      expect(creatorCampaigns).to.have.lengthOf(2)

      expect(await campaignContractFactory.deployedCampaigns(0)).to.equal(
        allCampaigns[0]
      )
      expect(await campaignContractFactory.deployedCampaigns(1)).to.equal(
        allCampaigns[1]
      )

      expect(
        await campaignContractFactory.creatorToCampaigns(owner.address, 0)
      ).to.equal(creatorCampaigns[0])
      expect(
        await campaignContractFactory.creatorToCampaigns(owner.address, 1)
      ).to.equal(creatorCampaigns[1])
    })

    it('Should revert on unsupported contribution token', async function () {
      const { campaignContractFactory, mockToken1, tokenRegistry } =
        await loadFixture(deployCampaignContractFactoryFixture)

      const mockToken1Address = await mockToken1.getAddress()

      await tokenRegistry.disableTokenSupport(mockToken1Address)
      const campaignGoalAmount = 5
      const campaignDuration = 10

      await expect(
        campaignContractFactory.deploy(
          mockToken1Address,
          campaignGoalAmount,
          campaignDuration
        )
      )
        .to.be.revertedWithCustomError(
          campaignContractFactory,
          'ContributionTokenNotSupported'
        )
        .withArgs(mockToken1Address)
    })

    it('Should revert when using zero address for token', async function () {
      const { campaignContractFactory } = await loadFixture(
        deployCampaignContractFactoryFixture
      )

      const campaignGoalAmount = 5
      const campaignDuration = 10

      await expect(
        campaignContractFactory.deploy(
          ethers.ZeroAddress,
          campaignGoalAmount,
          campaignDuration
        )
      ).to.be.revertedWithCustomError(campaignContractFactory, 'InvalidAddress')
    })

    it('Should revert on campaignGoalAmount <= 0', async function () {
      const { campaignContractFactory, mockToken1 } = await loadFixture(
        deployCampaignContractFactoryFixture
      )

      const mockERC20Address = await mockToken1.getAddress()
      const campaignGoalAmount = 0
      const campaignDuration = 10

      await expect(
        campaignContractFactory.deploy(
          mockERC20Address,
          campaignGoalAmount,
          campaignDuration
        )
      )
        .to.be.revertedWithCustomError(
          campaignContractFactory,
          'InvalidGoalAmount'
        )
        .withArgs(campaignGoalAmount)
    })

    it('Should revert on campaignDuration <= 0', async function () {
      const { campaignContractFactory, mockToken1 } = await loadFixture(
        deployCampaignContractFactoryFixture
      )

      const mockERC20Address = await mockToken1.getAddress()
      const campaignGoalAmount = 10
      const campaignDuration = 0

      await expect(
        campaignContractFactory.deploy(
          mockERC20Address,
          campaignGoalAmount,
          campaignDuration
        )
      )
        .to.be.revertedWithCustomError(
          campaignContractFactory,
          'InvalidCampaignDuration'
        )
        .withArgs(campaignDuration)
    })

    it('Should correctly manage campaigns from different creators', async function () {
      const { campaignContractFactory, owner, user1, mockToken1 } =
        await loadFixture(deployCampaignContractFactoryFixture)

      const mockERC20Address = await mockToken1.getAddress()

      const tx1 = await campaignContractFactory.deploy(mockERC20Address, 5, 10)
      const receipt1 = await tx1.wait()

      const tx2 = await campaignContractFactory
        .connect(user1)
        .deploy(mockERC20Address, 10, 15)
      const receipt2 = await tx2.wait()

      expect(await campaignContractFactory.getCampaignsCount()).to.equal(2n)

      expect(
        await campaignContractFactory.getCreatorCampaignsCount(owner.address)
      ).to.equal(1n)
      expect(
        await campaignContractFactory.getCreatorCampaignsCount(user1.address)
      ).to.equal(1n)

      const ownerCampaigns =
        await campaignContractFactory.getCampaignsByCreator(owner.address)
      const user1Campaigns =
        await campaignContractFactory.getCampaignsByCreator(user1.address)

      expect(ownerCampaigns).to.have.lengthOf(1)
      expect(user1Campaigns).to.have.lengthOf(1)

      const Campaign = await ethers.getContractFactory('Campaign')
      const ownerCampaign = Campaign.attach(ownerCampaigns[0])
      const user1Campaign = Campaign.attach(user1Campaigns[0])

      expect(await (ownerCampaign as any).owner()).to.equal(owner.address)
      expect(await (user1Campaign as any).owner()).to.equal(user1.address)
    })
  })

  describe('Getter functions', function () {
    it('Should return correct values from getAllCampaigns', async function () {
      const { campaignContractFactory, mockToken1 } = await loadFixture(
        deployCampaignContractFactoryFixture
      )

      const mockERC20Address = await mockToken1.getAddress()

      const initialCampaigns = await campaignContractFactory.getAllCampaigns()
      expect(initialCampaigns).to.be.an('array').that.is.empty

      const tx = await campaignContractFactory.deploy(mockERC20Address, 5, 10)
      const receipt = await tx.wait()
      const event = receipt.logs.find((log: Log) => {
        try {
          const parsed = campaignContractFactory.interface.parseLog(log)
          return parsed && parsed.name === 'CampaignCreated'
        } catch {
          return false
        }
      })
      const parsedEvent = campaignContractFactory.interface.parseLog(event)
      const campaignAddress = parsedEvent.args[0]

      const campaigns = await campaignContractFactory.getAllCampaigns()
      expect(campaigns).to.have.lengthOf(1)
      expect(campaigns[0]).to.equal(campaignAddress)
    })

    it('Should return correct values from getCampaignsByCreator', async function () {
      const { campaignContractFactory, owner, user1, mockToken1 } =
        await loadFixture(deployCampaignContractFactoryFixture)

      const mockERC20Address = await mockToken1.getAddress()

      expect(
        await campaignContractFactory.getCampaignsByCreator(owner.address)
      ).to.be.an('array').that.is.empty
      expect(
        await campaignContractFactory.getCampaignsByCreator(user1.address)
      ).to.be.an('array').that.is.empty

      const tx1 = await campaignContractFactory.deploy(mockERC20Address, 5, 10)
      const receipt1 = await tx1.wait()
      const event1 = receipt1.logs.find((log: Log) => {
        try {
          const parsed = campaignContractFactory.interface.parseLog(log)
          return parsed && parsed.name === 'CampaignCreated'
        } catch {
          return false
        }
      })
      const parsedEvent1 = campaignContractFactory.interface.parseLog(event1)
      const ownerCampaignAddress = parsedEvent1.args[0]

      const tx2 = await campaignContractFactory
        .connect(user1)
        .deploy(mockERC20Address, 10, 15)
      const receipt2 = await tx2.wait()
      const event2 = receipt2.logs.find((log: Log) => {
        try {
          const parsed = campaignContractFactory.interface.parseLog(log)
          return parsed && parsed.name === 'CampaignCreated'
        } catch {
          return false
        }
      })
      const parsedEvent2 = campaignContractFactory.interface.parseLog(event2)
      const user1CampaignAddress = parsedEvent2.args[0]

      const ownerCampaigns =
        await campaignContractFactory.getCampaignsByCreator(owner.address)
      expect(ownerCampaigns).to.have.lengthOf(1)
      expect(ownerCampaigns[0]).to.equal(ownerCampaignAddress)

      const user1Campaigns =
        await campaignContractFactory.getCampaignsByCreator(user1.address)
      expect(user1Campaigns).to.have.lengthOf(1)
      expect(user1Campaigns[0]).to.equal(user1CampaignAddress)

      const randomAddress = ethers.Wallet.createRandom().address
      const randomCampaigns =
        await campaignContractFactory.getCampaignsByCreator(randomAddress)
      expect(randomCampaigns).to.be.an('array').that.is.empty
    })

    it('Should return correct values from getCampaignsCount', async function () {
      const { campaignContractFactory, mockToken1 } = await loadFixture(
        deployCampaignContractFactoryFixture
      )

      const mockERC20Address = await mockToken1.getAddress()

      expect(await campaignContractFactory.getCampaignsCount()).to.equal(0)

      await campaignContractFactory.deploy(mockERC20Address, 5, 10)
      expect(await campaignContractFactory.getCampaignsCount()).to.equal(1)

      await campaignContractFactory.deploy(mockERC20Address, 10, 15)
      expect(await campaignContractFactory.getCampaignsCount()).to.equal(2)
    })

    it('Should return correct values from getCreatorCampaignsCount', async function () {
      const { campaignContractFactory, owner, user1, mockToken1 } =
        await loadFixture(deployCampaignContractFactoryFixture)

      const mockERC20Address = await mockToken1.getAddress()

      expect(
        await campaignContractFactory.getCreatorCampaignsCount(owner.address)
      ).to.equal(0)
      expect(
        await campaignContractFactory.getCreatorCampaignsCount(user1.address)
      ).to.equal(0)

      await campaignContractFactory.deploy(mockERC20Address, 5, 10)
      expect(
        await campaignContractFactory.getCreatorCampaignsCount(owner.address)
      ).to.equal(1)
      expect(
        await campaignContractFactory.getCreatorCampaignsCount(user1.address)
      ).to.equal(0)

      await campaignContractFactory
        .connect(user1)
        .deploy(mockERC20Address, 10, 15)
      expect(
        await campaignContractFactory.getCreatorCampaignsCount(owner.address)
      ).to.equal(1)
      expect(
        await campaignContractFactory.getCreatorCampaignsCount(user1.address)
      ).to.equal(1)

      await campaignContractFactory.deploy(mockERC20Address, 15, 20)
      expect(
        await campaignContractFactory.getCreatorCampaignsCount(owner.address)
      ).to.equal(2)
      expect(
        await campaignContractFactory.getCreatorCampaignsCount(user1.address)
      ).to.equal(1)

      const randomAddress = ethers.Wallet.createRandom().address
      expect(
        await campaignContractFactory.getCreatorCampaignsCount(randomAddress)
      ).to.equal(0)
    })
  })
})
