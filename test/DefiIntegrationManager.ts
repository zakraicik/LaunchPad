import { token } from '../typechain-types/@openzeppelin/contracts'

const { expect } = require('chai')
const { ethers } = require('hardhat')
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers')

describe('DefiIntegrationManager', function () {
  async function deployDefiManagerFixture () {
    const [owner, user1, user2, platformTreasury] = await ethers.getSigners()

    const mockToken1 = await ethers.deployContract('MockERC20', [
      'Mock Token 1',
      'MT1',
      ethers.parseUnits('100000')
    ])
    await mockToken1.waitForDeployment()

    const mockToken2 = await ethers.deployContract('MockERC20', [
      'Mock Token 2',
      'MT2',
      ethers.parseUnits('100000')
    ])
    await mockToken2.waitForDeployment()

    const mockTokenRegistry = await ethers.deployContract('MockTokenRegistry')
    await mockTokenRegistry.waitForDeployment()
    const mockTokenRegistryAddress = await mockTokenRegistry.getAddress()

    await mockTokenRegistry.addSupportedToken(
      await mockToken1.getAddress(),
      true
    )
    await mockTokenRegistry.addSupportedToken(
      await mockToken2.getAddress(),
      true
    )
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

    await mockAavePool.setAToken(
      await mockToken1.getAddress(),
      await mockAToken1.getAddress()
    )
    await mockAavePool.setAToken(
      await mockToken2.getAddress(),
      await mockAToken2.getAddress()
    )
    await mockAavePool.setLiquidityRate(
      await mockToken1.getAddress(),
      ethers.parseUnits('0.5', 27)
    )

    await mockAavePool.setLiquidityRate(
      await mockToken2.getAddress(),
      ethers.parseUnits('1', 27)
    )

    const mockUniswapQuoter = await ethers.deployContract('MockUniswapQuoter')
    await mockUniswapQuoter.waitForDeployment()

    const mockUniswapRouter = await ethers.deployContract('MockUniswapRouter')
    await mockUniswapRouter.waitForDeployment()

    const mockYieldDistributor = await ethers.deployContract(
      'MockYieldDistributor',
      [platformTreasury.address]
    )
    await mockYieldDistributor.waitForDeployment()
    const mockYieldDistributorAddress = await mockYieldDistributor.getAddress()

    const tempCampaignFactory = await ethers.deployContract(
      'MockCampaignFactory',
      [
        ethers.ZeroAddress // Temporary address, will update later
      ]
    )
    await tempCampaignFactory.waitForDeployment()

    // 9. Now deploy the DefiIntegrationManager with all dependencies
    const defiManager = await ethers.deployContract('DefiIntegrationManager', [
      await mockAavePool.getAddress(),
      await mockUniswapRouter.getAddress(),
      await mockUniswapQuoter.getAddress(),
      mockTokenRegistryAddress,
      await tempCampaignFactory.getAddress(),
      mockYieldDistributorAddress,
      owner.address
    ])
    await defiManager.waitForDeployment()

    // 10. Deploy the real CampaignFactory with the correct DefiManager address
    const campaignFactory = await ethers.deployContract('MockCampaignFactory', [
      await defiManager.getAddress()
    ])
    await campaignFactory.waitForDeployment()

    // 11. Update the DefiManager to use the real CampaignFactory
    await defiManager.setCampaignFactory(await campaignFactory.getAddress())

    // 12. Deploy a mock campaign for testing
    const mockCampaign = await ethers.deployContract('MockCampaign', [
      owner.address,
      await mockToken1.getAddress(),
      ethers.parseUnits('1000'),
      30, // 30 days duration
      await defiManager.getAddress()
    ])
    await mockCampaign.waitForDeployment()

    // 13. Authorize the campaign through the factory
    await campaignFactory.registerExistingCampaign(
      await mockCampaign.getAddress()
    )

    // 14. Send some tokens to the campaign for testing
    await mockToken1.transfer(
      await mockCampaign.getAddress(),
      ethers.parseUnits('500')
    )
    await mockToken2.transfer(
      await mockCampaign.getAddress(),
      ethers.parseUnits('500')
    )

    return {
      owner,
      user1,
      user2,
      platformTreasury,
      mockToken1,
      mockToken2,
      mockAToken1,
      mockAToken2,
      mockAavePool,
      mockUniswapRouter,
      mockUniswapQuoter,
      mockTokenRegistry,
      mockYieldDistributor,
      campaignFactory,
      mockCampaign,
      defiManager
    }
  }

  describe('Deployment', function () {
    it('Should correctly deploy all defimanager', async function () {
      const {
        defiManager,
        mockAavePool,
        mockUniswapRouter,
        mockUniswapQuoter,
        mockTokenRegistry,
        campaignFactory,
        mockYieldDistributor
      } = await loadFixture(deployDefiManagerFixture)

      expect(await defiManager.getAddress()).to.be.properAddress

      const aavePoolAddress = await defiManager.aavePool()
      const uniswapRouterAddress = await defiManager.uniswapRouter()
      const uniswapQuoterAddress = await defiManager.uniswapQuoter()
      const tokenRegistryAddress = await defiManager.tokenRegistry()
      const campaignFactoryAddress = await defiManager.campaignFactory()
      const yieldDistributorAddress = await defiManager.yieldDistributor()

      expect(await mockAavePool.getAddress()).to.equal(aavePoolAddress)
      expect(await mockUniswapRouter.getAddress()).to.equal(
        uniswapRouterAddress
      )
      expect(await mockUniswapQuoter.getAddress()).to.equal(
        uniswapQuoterAddress
      )
      expect(await mockTokenRegistry.getAddress()).to.equal(
        tokenRegistryAddress
      )
      expect(await campaignFactory.getAddress()).to.equal(
        campaignFactoryAddress
      )
      expect(await mockYieldDistributor.getAddress()).to.equal(
        yieldDistributorAddress
      )
    })

    it('Should revert on any incorrect constructor inputs', async function () {
      const [owner, user1, platformTreasury] = await ethers.getSigners()

      // Deploy mock dependencies
      const mockAToken = await ethers.deployContract('MockAToken', [
        'aMock Token',
        'aMT',
        ethers.ZeroAddress
      ])
      await mockAToken.waitForDeployment()

      const mockAavePool = await ethers.deployContract('MockAavePool', [
        await mockAToken.getAddress()
      ])
      const mockUniswapRouter = await ethers.deployContract('MockUniswapRouter')
      const mockUniswapQuoter = await ethers.deployContract('MockUniswapQuoter')
      const mockTokenRegistry = await ethers.deployContract('MockTokenRegistry')
      const mockCampaignFactory = await ethers.deployContract(
        'MockCampaignFactory',
        [ethers.ZeroAddress]
      )
      const mockYieldDistributor = await ethers.deployContract(
        'MockYieldDistributor',
        [platformTreasury.address]
      )

      await Promise.all([
        mockAavePool.waitForDeployment(),
        mockUniswapRouter.waitForDeployment(),
        mockUniswapQuoter.waitForDeployment(),
        mockTokenRegistry.waitForDeployment(),
        mockCampaignFactory.waitForDeployment(),
        mockYieldDistributor.waitForDeployment()
      ])

      // Store addresses
      const aavePoolAddress = await mockAavePool.getAddress()
      const uniswapRouterAddress = await mockUniswapRouter.getAddress()
      const uniswapQuoterAddress = await mockUniswapQuoter.getAddress()
      const tokenRegistryAddress = await mockTokenRegistry.getAddress()
      const campaignFactoryAddress = await mockCampaignFactory.getAddress()
      const yieldDistributorAddress = await mockYieldDistributor.getAddress()

      // Get contract factory
      const DefiManager = await ethers.getContractFactory(
        'DefiIntegrationManager'
      )

      // Test zero address for aavePool (index 0)
      await expect(
        DefiManager.deploy(
          ethers.ZeroAddress,
          uniswapRouterAddress,
          uniswapQuoterAddress,
          tokenRegistryAddress,
          campaignFactoryAddress,
          yieldDistributorAddress,
          owner.address
        )
      ).to.be.revertedWithCustomError(DefiManager, 'InvalidConstructorInput')

      // Test zero address for uniswapRouter (index 1)
      await expect(
        DefiManager.deploy(
          aavePoolAddress,
          ethers.ZeroAddress,
          uniswapQuoterAddress,
          tokenRegistryAddress,
          campaignFactoryAddress,
          yieldDistributorAddress,
          owner.address
        )
      ).to.be.revertedWithCustomError(DefiManager, 'InvalidConstructorInput')

      // Test zero address for uniswapQuoter (index 2)
      await expect(
        DefiManager.deploy(
          aavePoolAddress,
          uniswapRouterAddress,
          ethers.ZeroAddress,
          tokenRegistryAddress,
          campaignFactoryAddress,
          yieldDistributorAddress,
          owner.address
        )
      ).to.be.revertedWithCustomError(DefiManager, 'InvalidConstructorInput')

      // Test zero address for tokenRegistry (index 3)
      await expect(
        DefiManager.deploy(
          aavePoolAddress,
          uniswapRouterAddress,
          uniswapQuoterAddress,
          ethers.ZeroAddress,
          campaignFactoryAddress,
          yieldDistributorAddress,
          owner.address
        )
      ).to.be.revertedWithCustomError(DefiManager, 'InvalidConstructorInput')

      // Test zero address for campaignFactory (index 4)
      await expect(
        DefiManager.deploy(
          aavePoolAddress,
          uniswapRouterAddress,
          uniswapQuoterAddress,
          tokenRegistryAddress,
          ethers.ZeroAddress,
          yieldDistributorAddress,
          owner.address
        )
      ).to.be.revertedWithCustomError(DefiManager, 'InvalidConstructorInput')

      // Test zero address for yieldDistributor (index 5)
      await expect(
        DefiManager.deploy(
          aavePoolAddress,
          uniswapRouterAddress,
          uniswapQuoterAddress,
          tokenRegistryAddress,
          campaignFactoryAddress,
          ethers.ZeroAddress,
          owner.address
        )
      ).to.be.revertedWithCustomError(DefiManager, 'InvalidConstructorInput')
    })
  })

  describe('Authorizing Campaigns', function () {
    it('Should allow campaign faactory to authorize new campaigns', async function () {
      const { defiManager, owner, mockToken1 } = await loadFixture(
        deployDefiManagerFixture
      )

      const campaignFactoryAddress = await defiManager.campaignFactory()

      await ethers.provider.send('hardhat_setBalance', [
        campaignFactoryAddress,
        '0x56BC75E2D63100000'
      ])

      await ethers.provider.send('hardhat_impersonateAccount', [
        campaignFactoryAddress
      ])
      const campaignFactorySigner = await ethers.provider.getSigner(
        campaignFactoryAddress
      )

      const mockCampaign = await ethers.deployContract('MockCampaign', [
        owner.address,
        await mockToken1.getAddress(),
        ethers.parseUnits('1000'),
        30,
        await defiManager.getAddress()
      ])
      await mockCampaign.waitForDeployment()

      const campaignAddress = await mockCampaign.getAddress()

      await expect(
        defiManager
          .connect(campaignFactorySigner)
          .authorizeCampaign(campaignAddress)
      )
        .to.emit(defiManager, 'CampaignAuthorized')
        .withArgs(campaignAddress)

      expect(await defiManager.authorizedCampaigns(campaignAddress)).to.equal(
        true
      )
    })
    it('Should revert when address besides campaign factory calls authorizeCampaign()', async function () {
      const { defiManager, owner, mockToken1 } = await loadFixture(
        deployDefiManagerFixture
      )

      const mockCampaign = await ethers.deployContract('MockCampaign', [
        owner.address,
        await mockToken1.getAddress(),
        ethers.parseUnits('1000'),
        30,
        await defiManager.getAddress()
      ])
      await mockCampaign.waitForDeployment()

      const campaignAddress = await mockCampaign.getAddress()

      expect(await defiManager.authorizedCampaigns(campaignAddress)).to.equal(
        false
      )

      await expect(defiManager.authorizeCampaign(campaignAddress))
        .to.revertedWithCustomError(defiManager, 'notCampaignFactory')
        .withArgs(owner.address)
    })

    it('Should allow owner to deauthorize campaigns', async function () {
      const { defiManager, owner, mockToken1 } = await loadFixture(
        deployDefiManagerFixture
      )

      const campaignFactoryAddress = await defiManager.campaignFactory()

      await ethers.provider.send('hardhat_setBalance', [
        campaignFactoryAddress,
        '0x56BC75E2D63100000'
      ])

      await ethers.provider.send('hardhat_impersonateAccount', [
        campaignFactoryAddress
      ])
      const campaignFactorySigner = await ethers.provider.getSigner(
        campaignFactoryAddress
      )

      const mockCampaign = await ethers.deployContract('MockCampaign', [
        owner.address,
        await mockToken1.getAddress(),
        ethers.parseUnits('1000'),
        30,
        await defiManager.getAddress()
      ])
      await mockCampaign.waitForDeployment()

      const campaignAddress = await mockCampaign.getAddress()

      await defiManager
        .connect(campaignFactorySigner)
        .authorizeCampaign(campaignAddress)

      await expect(defiManager.unauthorizeCampaign(campaignAddress))
        .to.emit(defiManager, 'CampaignUnauthorized')
        .withArgs(campaignAddress)

      expect(await defiManager.authorizedCampaigns(campaignAddress)).to.equal(
        false
      )
    })

    it('Should revert if anyone other than owner tries to deauthorize a campaign', async function () {
      const { defiManager, owner, user1, mockToken1 } = await loadFixture(
        deployDefiManagerFixture
      )

      const campaignFactoryAddress = await defiManager.campaignFactory()

      await ethers.provider.send('hardhat_setBalance', [
        campaignFactoryAddress,
        '0x56BC75E2D63100000'
      ])

      await ethers.provider.send('hardhat_impersonateAccount', [
        campaignFactoryAddress
      ])
      const campaignFactorySigner = await ethers.provider.getSigner(
        campaignFactoryAddress
      )

      const mockCampaign = await ethers.deployContract('MockCampaign', [
        owner.address,
        await mockToken1.getAddress(),
        ethers.parseUnits('1000'),
        30,
        await defiManager.getAddress()
      ])
      await mockCampaign.waitForDeployment()

      const campaignAddress = await mockCampaign.getAddress()

      await defiManager
        .connect(campaignFactorySigner)
        .authorizeCampaign(campaignAddress)

      await expect(
        defiManager.connect(user1).unauthorizeCampaign(campaignAddress)
      )
        .to.be.revertedWithCustomError(
          defiManager,
          'OwnableUnauthorizedAccount'
        )
        .withArgs(user1.address)

      expect(await defiManager.authorizedCampaigns(campaignAddress)).to.equal(
        true
      )
    })
  })

  describe('Yield Distributor Integration', function () {})

  describe('Swapping Tokens', function () {})

  describe('Setter functions', function () {
    describe('setCampaignFactory()', function () {
      it('Should correctly set the campaign factory', async function () {
        const { defiManager } = await loadFixture(deployDefiManagerFixture)

        const campaignFactoryBefore = await defiManager.campaignFactory()

        const campaignFactory = await ethers.deployContract(
          'MockCampaignFactory',
          [await defiManager.getAddress()]
        )
        await campaignFactory.waitForDeployment()

        const campaignFactoryAfter = await campaignFactory.getAddress()

        await expect(defiManager.setCampaignFactory(campaignFactoryAfter))
          .to.emit(defiManager, 'CampaignFactoryUpdated')
          .withArgs(campaignFactoryBefore, campaignFactoryAfter)

        expect(await defiManager.campaignFactory()).to.equal(
          campaignFactoryAfter
        )
      })

      it('Should revert if non-owner tries to set campaign factory', async function () {
        const { defiManager, user1 } = await loadFixture(
          deployDefiManagerFixture
        )

        const campaignFactoryBefore = await defiManager.campaignFactory()

        const campaignFactory = await ethers.deployContract(
          'MockCampaignFactory',
          [await defiManager.getAddress()]
        )
        await campaignFactory.waitForDeployment()

        const campaignFactoryAfter = await campaignFactory.getAddress()

        await expect(
          defiManager.connect(user1).setCampaignFactory(campaignFactoryAfter)
        )
          .to.be.revertedWithCustomError(
            defiManager,
            'OwnableUnauthorizedAccount'
          )
          .withArgs(user1.address)

        expect(await defiManager.campaignFactory()).to.equal(
          campaignFactoryBefore
        )
      })

      it('Should revert if invalid address passed to setCampaignFactory()', async function () {
        const { defiManager, user1 } = await loadFixture(
          deployDefiManagerFixture
        )

        const campaignFactoryBefore = await defiManager.campaignFactory()

        await expect(
          defiManager.setCampaignFactory(ethers.ZeroAddress)
        ).to.be.revertedWithCustomError(defiManager, 'InvalidAddress')

        expect(await defiManager.campaignFactory()).to.equal(
          campaignFactoryBefore
        )
      })
    })

    describe('setTokenRegistry()', function () {
      it('Should correctly set the token registry', async function () {
        const { defiManager } = await loadFixture(deployDefiManagerFixture)

        const mockTokenRegistryBefore = await defiManager.tokenRegistry()

        const mockTokenRegistry = await ethers.deployContract(
          'MockTokenRegistry'
        )
        await mockTokenRegistry.waitForDeployment()

        const mockTokenRegistryAfter = await mockTokenRegistry.getAddress()

        await expect(defiManager.setTokenRegistry(mockTokenRegistryAfter))
          .to.emit(defiManager, 'TokenRegistryUpdated')
          .withArgs(mockTokenRegistryBefore, mockTokenRegistryAfter)

        expect(await defiManager.tokenRegistry()).to.equal(
          mockTokenRegistryAfter
        )
      })

      it('Should revert if non-owner tries to set token registry', async function () {
        const { defiManager, user1 } = await loadFixture(
          deployDefiManagerFixture
        )

        const mockTokenRegistryBefore = await defiManager.tokenRegistry()

        const mockTokenRegistry = await ethers.deployContract(
          'MockTokenRegistry'
        )
        await mockTokenRegistry.waitForDeployment()

        const mockTokenRegistryAfter = await mockTokenRegistry.getAddress()

        await expect(
          defiManager.connect(user1).setTokenRegistry(mockTokenRegistryAfter)
        )
          .to.be.revertedWithCustomError(
            defiManager,
            'OwnableUnauthorizedAccount'
          )
          .withArgs(user1.address)

        expect(await defiManager.tokenRegistry()).to.equal(
          mockTokenRegistryBefore
        )
      })

      it('Should revert if invalid address passed to setTokenRegistry()', async function () {
        const { defiManager, user1 } = await loadFixture(
          deployDefiManagerFixture
        )

        const mockTokenRegistryBefore = await defiManager.tokenRegistry()

        await expect(
          defiManager.setTokenRegistry(ethers.ZeroAddress)
        ).to.be.revertedWithCustomError(defiManager, 'InvalidAddress')

        expect(await defiManager.tokenRegistry()).to.equal(
          mockTokenRegistryBefore
        )
      })
    })

    describe('setYieldDistributor()', function () {
      it('Should correctly set the yield distributor', async function () {
        const { defiManager, platformTreasury } = await loadFixture(
          deployDefiManagerFixture
        )

        const mockYieldDistributorBefore = await defiManager.yieldDistributor()

        const mockYieldDistributor = await ethers.deployContract(
          'MockYieldDistributor',
          [platformTreasury.address]
        )
        await mockYieldDistributor.waitForDeployment()

        const mockYieldDistributorAfter =
          await mockYieldDistributor.getAddress()

        await expect(defiManager.setYieldDistributor(mockYieldDistributorAfter))
          .to.emit(defiManager, 'YieldDistributorUpdated')
          .withArgs(mockYieldDistributorBefore, mockYieldDistributorAfter)

        expect(await defiManager.yieldDistributor()).to.equal(
          mockYieldDistributorAfter
        )
      })

      it('Should revert if non-owner tries to set yieldDistributor', async function () {
        const { defiManager, user1, platformTreasury } = await loadFixture(
          deployDefiManagerFixture
        )

        const mockYieldDistributorBefore = await defiManager.yieldDistributor()

        const mockYieldDistributor = await ethers.deployContract(
          'MockYieldDistributor',
          [platformTreasury.address]
        )
        await mockYieldDistributor.waitForDeployment()

        const mockYieldDistributorAfter =
          await mockYieldDistributor.getAddress()

        await expect(
          defiManager
            .connect(user1)
            .setYieldDistributor(mockYieldDistributorAfter)
        )
          .to.be.revertedWithCustomError(
            defiManager,
            'OwnableUnauthorizedAccount'
          )
          .withArgs(user1.address)

        expect(await defiManager.yieldDistributor()).to.equal(
          mockYieldDistributorBefore
        )
      })

      it('Should revert if invalid address passed to setYieldDistributor()', async function () {
        const { defiManager, user1 } = await loadFixture(
          deployDefiManagerFixture
        )

        const mockYieldDistributorBefore = await defiManager.yieldDistributor()

        await expect(
          defiManager.setYieldDistributor(ethers.ZeroAddress)
        ).to.be.revertedWithCustomError(defiManager, 'InvalidAddress')

        expect(await defiManager.yieldDistributor()).to.equal(
          mockYieldDistributorBefore
        )
      })
    })

    describe('setAavePool()', function () {
      it('Should correctly set the Aave Pool', async function () {
        const { defiManager, mockAToken1 } = await loadFixture(
          deployDefiManagerFixture
        )

        const mockAavePoolBefore = await defiManager.aavePool()

        const mockAavePool = await ethers.deployContract('MockAavePool', [
          await mockAToken1.getAddress()
        ])
        await mockAavePool.waitForDeployment()

        const mockAavePoolAfter = await mockAavePool.getAddress()

        await expect(defiManager.setAavePool(mockAavePoolAfter))
          .to.emit(defiManager, 'AavePoolUpdated')
          .withArgs(mockAavePoolBefore, mockAavePoolAfter)

        expect(await defiManager.aavePool()).to.equal(mockAavePoolAfter)
      })

      it('Should revert if non-owner tries to set Aave pool', async function () {
        const { defiManager, mockAToken1, user1 } = await loadFixture(
          deployDefiManagerFixture
        )

        const mockAavePoolBefore = await defiManager.aavePool()

        const mockAavePool = await ethers.deployContract('MockAavePool', [
          await mockAToken1.getAddress()
        ])
        await mockAavePool.waitForDeployment()

        const mockAavePoolAfter = await mockAavePool.getAddress()

        await expect(defiManager.connect(user1).setAavePool(mockAavePoolAfter))
          .to.be.revertedWithCustomError(
            defiManager,
            'OwnableUnauthorizedAccount'
          )
          .withArgs(user1.address)

        expect(await defiManager.aavePool()).to.equal(mockAavePoolBefore)
      })

      it('Should revert if invalid address passed to setAavePool()', async function () {
        const { defiManager, user1 } = await loadFixture(
          deployDefiManagerFixture
        )

        const mockAavePoolBefore = await defiManager.aavePool()

        await expect(
          defiManager.setAavePool(ethers.ZeroAddress)
        ).to.be.revertedWithCustomError(defiManager, 'InvalidAddress')

        expect(await defiManager.aavePool()).to.equal(mockAavePoolBefore)
      })
    })

    describe('setUniswapRouter()', function () {
      it('Should correctly set the Uniswap Router', async function () {
        const { defiManager } = await loadFixture(deployDefiManagerFixture)

        const mockUniswapRouterBefore = await defiManager.uniswapRouter()

        const mockUniswapRouter = await ethers.deployContract(
          'MockUniswapRouter'
        )
        await mockUniswapRouter.waitForDeployment()

        const mockUniswapRouterAfter = await mockUniswapRouter.getAddress()

        await expect(defiManager.setUniswapRouter(mockUniswapRouterAfter))
          .to.emit(defiManager, 'UniswapRouterUpdated')
          .withArgs(mockUniswapRouterBefore, mockUniswapRouterAfter)

        expect(await defiManager.uniswapRouter()).to.equal(
          mockUniswapRouterAfter
        )
      })

      it('Should revert if non-owner tries to set Uniswap Router', async function () {
        const { defiManager, user1 } = await loadFixture(
          deployDefiManagerFixture
        )

        const mockUniswapRouterBefore = await defiManager.uniswapRouter()

        const mockUniswapRouter = await ethers.deployContract(
          'MockUniswapRouter'
        )
        await mockUniswapRouter.waitForDeployment()

        const mockUniswapRouterAfter = await mockUniswapRouter.getAddress()

        await expect(
          defiManager.connect(user1).setUniswapRouter(mockUniswapRouterAfter)
        )
          .to.be.revertedWithCustomError(
            defiManager,
            'OwnableUnauthorizedAccount'
          )
          .withArgs(user1.address)

        expect(await defiManager.uniswapRouter()).to.equal(
          mockUniswapRouterBefore
        )
      })

      it('Should revert if invalid address passed to setUniswapRouter()', async function () {
        const { defiManager, user1 } = await loadFixture(
          deployDefiManagerFixture
        )

        const mockUniswapRouterBefore = await defiManager.uniswapRouter()

        await expect(
          defiManager.setUniswapRouter(ethers.ZeroAddress)
        ).to.be.revertedWithCustomError(defiManager, 'InvalidAddress')

        expect(await defiManager.uniswapRouter()).to.equal(
          mockUniswapRouterBefore
        )
      })
    })

    describe('setUniswapQuoter()', function () {
      it('Should correctly set the Uniswap Quoter', async function () {
        const { defiManager } = await loadFixture(deployDefiManagerFixture)

        const mockUniswapQuoterBefore = await defiManager.uniswapQuoter()

        const mockUniswapQuoter = await ethers.deployContract(
          'MockUniswapQuoter'
        )
        await mockUniswapQuoter.waitForDeployment()

        const mockUniswapQuoterAfter = await mockUniswapQuoter.getAddress()

        await expect(defiManager.setUniswapQuoter(mockUniswapQuoterAfter))
          .to.emit(defiManager, 'UniswapQuoterUpdated')
          .withArgs(mockUniswapQuoterBefore, mockUniswapQuoterAfter)

        expect(await defiManager.uniswapQuoter()).to.equal(
          mockUniswapQuoterAfter
        )
      })

      it('Should revert if non-owner tries to set Uniswap Quoter', async function () {
        const { defiManager, user1 } = await loadFixture(
          deployDefiManagerFixture
        )

        const mockUniswapQuoterrBefore = await defiManager.uniswapQuoter()

        const mockUniswapQuoter = await ethers.deployContract(
          'MockUniswapQuoter'
        )
        await mockUniswapQuoter.waitForDeployment()

        const mockUniswapQuoterAfter = await mockUniswapQuoter.getAddress()

        await expect(
          defiManager.connect(user1).setUniswapQuoter(mockUniswapQuoterAfter)
        )
          .to.be.revertedWithCustomError(
            defiManager,
            'OwnableUnauthorizedAccount'
          )
          .withArgs(user1.address)

        expect(await defiManager.uniswapQuoter()).to.equal(
          mockUniswapQuoterrBefore
        )
      })

      it('Should revert if invalid address passed to setUniswapQuoter()', async function () {
        const { defiManager, user1 } = await loadFixture(
          deployDefiManagerFixture
        )
        const mockUniswapQuoterrBefore = await defiManager.uniswapQuoter()

        await expect(
          defiManager.setUniswapQuoter(ethers.ZeroAddress)
        ).to.be.revertedWithCustomError(defiManager, 'InvalidAddress')

        expect(await defiManager.uniswapQuoter()).to.equal(
          mockUniswapQuoterrBefore
        )
      })
    })
  })
})
