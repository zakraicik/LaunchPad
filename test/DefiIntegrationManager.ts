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

  describe('Yield Distributor Integration', function () {
    describe('Depositing to yield protocol', function () {
      it('Should successfully deposit tokens to the yield protocol', async function () {
        const { defiManager, mockToken1, mockAavePool, mockAToken1, owner } =
          await loadFixture(deployDefiManagerFixture)

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

        const tokenAddress = await mockToken1.getAddress()
        const depositAmount = ethers.parseUnits('100')

        await mockToken1.transfer(campaignAddress, depositAmount)

        expect(
          await defiManager.getDepositedAmount(campaignAddress, tokenAddress)
        ).to.equal(0)

        await expect(mockCampaign.depositToYield(tokenAddress, depositAmount))
          .to.emit(defiManager, 'YieldDeposited')
          .withArgs(campaignAddress, tokenAddress, depositAmount)

        expect(
          await defiManager.getDepositedAmount(campaignAddress, tokenAddress)
        ).to.equal(depositAmount)
        expect(await mockToken1.balanceOf(campaignAddress)).to.equal(0)
        expect(
          await mockAToken1.balanceOf(await defiManager.getAddress())
        ).to.equal(depositAmount)
      })

      it('Should revert when a non-authorized campaign tries to deposit', async function () {
        const { defiManager, mockToken1, owner } = await loadFixture(
          deployDefiManagerFixture
        )

        // Create an unauthorized campaign
        const mockCampaign = await ethers.deployContract('MockCampaign', [
          owner.address,
          await mockToken1.getAddress(),
          ethers.parseUnits('1000'),
          30,
          await defiManager.getAddress()
        ])
        await mockCampaign.waitForDeployment()

        // Attempt to deposit
        const tokenAddress = await mockToken1.getAddress()
        const depositAmount = ethers.parseUnits('100')

        // Transfer tokens to campaign
        await mockToken1.transfer(
          await mockCampaign.getAddress(),
          depositAmount
        )

        await expect(
          mockCampaign.depositToYield(tokenAddress, depositAmount)
        ).to.be.revertedWithCustomError(defiManager, 'UnauthorizedAddress')
      })

      it('Should revert when trying to deposit zero amount', async function () {
        const { defiManager, mockToken1, owner } = await loadFixture(
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

        // Authorize a mock campaign
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

        // Attempt to deposit zero amount
        const tokenAddress = await mockToken1.getAddress()
        const zeroAmount = 0

        await expect(mockCampaign.depositToYield(tokenAddress, zeroAmount))
          .to.be.revertedWithCustomError(defiManager, 'ZeroAmount')
          .withArgs(zeroAmount)
      })

      it('Should revert when trying to deposit an unsupported token', async function () {
        const { defiManager, mockToken1, owner, mockTokenRegistry } =
          await loadFixture(deployDefiManagerFixture)

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

        // Authorize a mock campaign
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

        // Deploy an unsupported token with initial supply
        const initialSupply = ethers.parseUnits('1000')
        const unsupportedToken = await ethers.deployContract('MockERC20', [
          'Unsupported',
          'UNSUP',
          initialSupply
        ])
        await unsupportedToken.waitForDeployment()
        const unsupportedTokenAddress = await unsupportedToken.getAddress()

        // Transfer tokens to campaign
        const depositAmount = ethers.parseUnits('100')
        await unsupportedToken.transfer(campaignAddress, depositAmount)

        // Attempt to deposit unsupported token
        await expect(
          mockCampaign.depositToYield(unsupportedTokenAddress, depositAmount)
        )
          .to.be.revertedWithCustomError(defiManager, 'TokenNotSupported')
          .withArgs(unsupportedTokenAddress)
      })

      it('Should revert when Aave supply fails', async function () {
        const { defiManager, mockToken1, owner, mockAavePool } =
          await loadFixture(deployDefiManagerFixture)

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

        // Authorize a mock campaign
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

        // Set up token
        const tokenAddress = await mockToken1.getAddress()
        const depositAmount = ethers.parseUnits('100')

        // Transfer tokens to campaign
        await mockToken1.transfer(campaignAddress, depositAmount)

        // Configure Aave mock to fail
        await mockAavePool.setShouldFailSupply(true)

        // Attempt deposit, should fail due to Aave supply failure
        await expect(mockCampaign.depositToYield(tokenAddress, depositAmount))
          .to.be.revertedWithCustomError(defiManager, 'YieldDepositFailed')
          .withArgs('Supply failed')
      })

      it('Should correctly add to existing deposits when depositing more of the same token', async function () {
        const { defiManager, mockToken1, owner } = await loadFixture(
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

        // Authorize a mock campaign
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

        // Set up token
        const tokenAddress = await mockToken1.getAddress()
        const depositAmount1 = ethers.parseUnits('50')
        const depositAmount2 = ethers.parseUnits('75')
        const totalExpected = depositAmount1 + depositAmount2

        // Transfer tokens to campaign
        await mockToken1.transfer(
          campaignAddress,
          depositAmount1 + depositAmount2
        )

        // First deposit
        await mockCampaign.depositToYield(tokenAddress, depositAmount1)

        // Check state after first deposit
        expect(
          await defiManager.getDepositedAmount(campaignAddress, tokenAddress)
        ).to.equal(depositAmount1)

        // Second deposit
        await mockCampaign.depositToYield(tokenAddress, depositAmount2)

        // Verify state after second deposit
        expect(
          await defiManager.getDepositedAmount(campaignAddress, tokenAddress)
        ).to.equal(totalExpected)
      })
    })

    describe('Withdrawing to yield protocol', function () {
      it('Should successfully withdraw tokens from the yield protocol', async function () {
        const { defiManager, mockToken1, mockAavePool, mockAToken1, owner } =
          await loadFixture(deployDefiManagerFixture)

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

        // Set up token
        const tokenAddress = await mockToken1.getAddress()
        const depositAmount = ethers.parseUnits('100')
        const withdrawAmount = ethers.parseUnits('50')

        // Transfer tokens to campaign
        await mockToken1.transfer(campaignAddress, depositAmount)

        // First deposit the tokens
        await mockCampaign.depositToYield(tokenAddress, depositAmount)

        // Verify deposit state
        expect(
          await defiManager.getDepositedAmount(campaignAddress, tokenAddress)
        ).to.equal(depositAmount)

        // Withdraw half of the tokens
        await expect(
          mockCampaign.withdrawFromYield(tokenAddress, withdrawAmount)
        )
          .to.emit(defiManager, 'YieldWithdrawn')
          .withArgs(campaignAddress, tokenAddress, withdrawAmount)

        // Verify state changes after withdrawal
        expect(
          await defiManager.getDepositedAmount(campaignAddress, tokenAddress)
        ).to.equal(depositAmount - withdrawAmount)
        expect(await mockToken1.balanceOf(campaignAddress)).to.equal(
          withdrawAmount
        )
      })

      it('Should revert when a non-authorized campaign tries to withdraw', async function () {
        const { defiManager, mockToken1, owner } = await loadFixture(
          deployDefiManagerFixture
        )

        // Create an unauthorized campaign
        const mockCampaign = await ethers.deployContract('MockCampaign', [
          owner.address,
          await mockToken1.getAddress(),
          ethers.parseUnits('1000'),
          30,
          await defiManager.getAddress()
        ])
        await mockCampaign.waitForDeployment()

        // Attempt to withdraw
        const tokenAddress = await mockToken1.getAddress()
        const withdrawAmount = ethers.parseUnits('100')

        await expect(
          mockCampaign.withdrawFromYield(tokenAddress, withdrawAmount)
        ).to.be.revertedWithCustomError(defiManager, 'UnauthorizedAddress')
      })
      it('Should revert when trying to withdraw zero amount', async function () {
        const { defiManager, mockToken1, owner } = await loadFixture(
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

        // Authorize a mock campaign
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

        // Attempt to withdraw zero amount
        const tokenAddress = await mockToken1.getAddress()
        const zeroAmount = 0

        await expect(mockCampaign.withdrawFromYield(tokenAddress, zeroAmount))
          .to.be.revertedWithCustomError(defiManager, 'ZeroAmount')
          .withArgs(zeroAmount)
      })

      it('Should revert when trying to withdraw more than deposited', async function () {
        const { defiManager, mockToken1, owner } = await loadFixture(
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

        // Authorize a mock campaign
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

        // Set up token
        const tokenAddress = await mockToken1.getAddress()
        const depositAmount = ethers.parseUnits('100')
        const withdrawAmount = ethers.parseUnits('150') // More than deposited

        // Transfer tokens to campaign
        await mockToken1.transfer(campaignAddress, depositAmount)

        // First deposit the tokens
        await mockCampaign.depositToYield(tokenAddress, depositAmount)

        // Attempt to withdraw more than deposited
        await expect(
          mockCampaign.withdrawFromYield(tokenAddress, withdrawAmount)
        )
          .to.be.revertedWithCustomError(defiManager, 'InsufficientDeposit')
          .withArgs(tokenAddress, withdrawAmount, depositAmount)
      })

      it('Should revert when Aave withdrawal fails', async function () {
        const { defiManager, mockToken1, mockAavePool, owner } =
          await loadFixture(deployDefiManagerFixture)

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

        // Authorize a mock campaign
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

        // Set up token
        const tokenAddress = await mockToken1.getAddress()
        const depositAmount = ethers.parseUnits('100')
        const withdrawAmount = ethers.parseUnits('50')

        // Transfer tokens to campaign
        await mockToken1.transfer(campaignAddress, depositAmount)

        // First deposit the tokens
        await mockCampaign.depositToYield(tokenAddress, depositAmount)

        // Configure Aave mock to fail withdrawals
        await mockAavePool.setShouldFailWithdraw(true)

        // Attempt withdraw, should fail due to Aave withdrawal failure
        await expect(
          mockCampaign.withdrawFromYield(tokenAddress, withdrawAmount)
        )
          .to.be.revertedWithCustomError(defiManager, 'YieldwithdrawalFailed')
          .withArgs('Withdraw failed')
      })

      it('Should revert when withdrawal amount does not match expected amount', async function () {
        const { defiManager, mockToken1, mockAavePool, owner } =
          await loadFixture(deployDefiManagerFixture)

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

        // Authorize a mock campaign
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

        // Set up token
        const tokenAddress = await mockToken1.getAddress()
        const depositAmount = ethers.parseUnits('100')
        const withdrawAmount = ethers.parseUnits('50')

        // Calculate mismatch amount consistently as BigInt
        const mismatchAmount = withdrawAmount - 1n

        // Transfer tokens to campaign
        await mockToken1.transfer(campaignAddress, depositAmount)

        // First deposit the tokens
        await mockCampaign.depositToYield(tokenAddress, depositAmount)

        // Configure the mock Aave pool to return a different amount than requested
        await mockAavePool.setMismatchWithdraw(true, mismatchAmount)

        // Attempt withdraw, should fail due to amount mismatch
        await expect(
          mockCampaign.withdrawFromYield(tokenAddress, withdrawAmount)
        )
          .to.be.revertedWithCustomError(
            defiManager,
            'WithdrawalAmountMismatch'
          )
          .withArgs(withdrawAmount, mismatchAmount) // Use the same variable here
      })

      it('Should successfully withdraw all tokens from the yield protocol', async function () {
        const { defiManager, mockToken1, mockAavePool, owner } =
          await loadFixture(deployDefiManagerFixture)

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

        // Set up token
        const tokenAddress = await mockToken1.getAddress()
        const depositAmount = ethers.parseUnits('100')

        // Transfer tokens to campaign
        await mockToken1.transfer(campaignAddress, depositAmount)

        // First deposit the tokens
        await mockCampaign.depositToYield(tokenAddress, depositAmount)

        // Verify deposit state
        expect(
          await defiManager.getDepositedAmount(campaignAddress, tokenAddress)
        ).to.equal(depositAmount)

        // Withdraw all tokens
        await expect(mockCampaign.withdrawAllFromYield(tokenAddress))
          .to.emit(defiManager, 'YieldWithdrawn')
          .withArgs(campaignAddress, tokenAddress, depositAmount)

        // Verify state changes after withdrawal
        expect(
          await defiManager.getDepositedAmount(campaignAddress, tokenAddress)
        ).to.equal(0)
        expect(await mockToken1.balanceOf(campaignAddress)).to.equal(
          depositAmount
        )
      })

      it('Should revert when a non-authorized campaign tries to withdraw all', async function () {
        const { defiManager, mockToken1, owner } = await loadFixture(
          deployDefiManagerFixture
        )

        // Create an unauthorized campaign
        const mockCampaign = await ethers.deployContract('MockCampaign', [
          owner.address,
          await mockToken1.getAddress(),
          ethers.parseUnits('1000'),
          30,
          await defiManager.getAddress()
        ])
        await mockCampaign.waitForDeployment()

        // Attempt to withdraw
        const tokenAddress = await mockToken1.getAddress()

        await expect(
          mockCampaign.withdrawAllFromYield(tokenAddress)
        ).to.be.revertedWithCustomError(defiManager, 'UnauthorizedAddress')
      })

      it('Should revert when trying to withdraw all with zero deposit', async function () {
        const { defiManager, mockToken1, owner } = await loadFixture(
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

        // Authorize a mock campaign
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

        // Attempt to withdraw with no deposit
        const tokenAddress = await mockToken1.getAddress()

        await expect(mockCampaign.withdrawAllFromYield(tokenAddress))
          .to.be.revertedWithCustomError(defiManager, 'ZeroAmount')
          .withArgs(0)
      })

      it('Should revert when Aave withdrawal fails for withdrawAll', async function () {
        const { defiManager, mockToken1, mockAavePool, owner } =
          await loadFixture(deployDefiManagerFixture)

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

        // Authorize a mock campaign
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

        // Set up token
        const tokenAddress = await mockToken1.getAddress()
        const depositAmount = ethers.parseUnits('100')

        // Transfer tokens to campaign
        await mockToken1.transfer(campaignAddress, depositAmount)

        // First deposit the tokens
        await mockCampaign.depositToYield(tokenAddress, depositAmount)

        // Configure Aave mock to fail withdrawals
        await mockAavePool.setShouldFailWithdraw(true)

        // Attempt withdraw all, should fail due to Aave withdrawal failure
        await expect(mockCampaign.withdrawAllFromYield(tokenAddress))
          .to.be.revertedWithCustomError(defiManager, 'YieldwithdrawalFailed')
          .withArgs('Withdraw failed')
      })

      it('Should revert when withdrawal amount does not match expected amount for withdrawAll', async function () {
        const { defiManager, mockToken1, mockAavePool, owner } =
          await loadFixture(deployDefiManagerFixture)

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

        // Authorize a mock campaign
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

        // Set up token
        const tokenAddress = await mockToken1.getAddress()
        const depositAmount = ethers.parseUnits('100')

        // Calculate mismatch amount consistently as BigInt
        const mismatchAmount = depositAmount - 1n

        // Transfer tokens to campaign
        await mockToken1.transfer(campaignAddress, depositAmount)

        // First deposit the tokens
        await mockCampaign.depositToYield(tokenAddress, depositAmount)

        // Configure the mock Aave pool to return a different amount than requested
        await mockAavePool.setMismatchWithdraw(true, mismatchAmount)

        // Attempt withdraw all, should fail due to amount mismatch
        await expect(mockCampaign.withdrawAllFromYield(tokenAddress))
          .to.be.revertedWithCustomError(
            defiManager,
            'WithdrawalAmountMismatch'
          )
          .withArgs(depositAmount, mismatchAmount)
      })
    })

    describe('Harvesting yield', function () {
      it('Should successfully harvest yield and distribute correctly', async function () {
        const {
          defiManager,
          mockToken1,
          mockAavePool,
          mockAToken1,
          mockYieldDistributor,
          owner,
          platformTreasury
        } = await loadFixture(deployDefiManagerFixture)

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

        // Authorize a mock campaign
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

        // Set up token
        const tokenAddress = await mockToken1.getAddress()
        const depositAmount = ethers.parseUnits('100')
        const yieldAmount = ethers.parseUnits('10')

        // Calculate expected shares
        const platformSharePercentage =
          await mockYieldDistributor.getPlatformYieldShare()
        const platformShare =
          (yieldAmount * BigInt(platformSharePercentage)) / 10000n
        const creatorShare = yieldAmount - platformShare

        // Transfer tokens to campaign and defi manager (for yield withdrawal)
        await mockToken1.transfer(campaignAddress, depositAmount)

        // Important: Transfer tokens to the defi manager for the yield withdrawal
        await mockToken1.transfer(await defiManager.getAddress(), yieldAmount)

        // Deposit tokens
        await mockCampaign.depositToYield(tokenAddress, depositAmount)

        // Simulate yield generation by adding more aTokens than the deposit amount
        // First, check the current aToken balance
        const defiManagerAddress = await defiManager.getAddress()
        const currentATokenBalance = await mockAToken1.balanceOf(
          defiManagerAddress
        )

        // Ensure aToken balance is greater than the deposit
        // This is what creates the "yield" that can be harvested
        if (currentATokenBalance <= depositAmount) {
          // Mint additional aTokens to simulate yield
          const additionalTokens =
            depositAmount + yieldAmount - currentATokenBalance
          await mockAToken1.mint(defiManagerAddress, additionalTokens)
        }

        // Ensure the aToken balance is as expected
        const aTokenBalance = await mockAToken1.balanceOf(defiManagerAddress)

        // Harvest yield
        await expect(mockCampaign.harvestYield(tokenAddress))
          .to.emit(defiManager, 'YieldHarvested')
          .withArgs(
            campaignAddress,
            tokenAddress,
            yieldAmount,
            creatorShare,
            platformShare
          )

        // Verify state changes after harvest
        expect(await mockToken1.balanceOf(campaignAddress)).to.equal(
          creatorShare
        )
        expect(await mockToken1.balanceOf(platformTreasury.address)).to.equal(
          platformShare
        )

        // The deposit amount should remain unchanged
        expect(
          await defiManager.getDepositedAmount(campaignAddress, tokenAddress)
        ).to.equal(depositAmount)
      })

      it('Should revert when a non-authorized campaign tries to harvest yield', async function () {
        const { defiManager, mockToken1, owner } = await loadFixture(
          deployDefiManagerFixture
        )

        // Create an unauthorized campaign
        const mockCampaign = await ethers.deployContract('MockCampaign', [
          owner.address,
          await mockToken1.getAddress(),
          ethers.parseUnits('1000'),
          30,
          await defiManager.getAddress()
        ])
        await mockCampaign.waitForDeployment()

        // Attempt to harvest
        const tokenAddress = await mockToken1.getAddress()

        await expect(
          mockCampaign.harvestYield(tokenAddress)
        ).to.be.revertedWithCustomError(defiManager, 'UnauthorizedAddress')
      })

      it('Should revert when trying to harvest with no deposits', async function () {
        const { defiManager, mockToken1, owner } = await loadFixture(
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

        // Authorize a mock campaign
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

        // Attempt to harvest with no deposit
        const tokenAddress = await mockToken1.getAddress()

        await expect(mockCampaign.harvestYield(tokenAddress))
          .to.be.revertedWithCustomError(defiManager, 'NoYield')
          .withArgs(tokenAddress)
      })

      it('Should revert when there is no yield to harvest', async function () {
        const { defiManager, mockToken1, mockAToken1, owner } =
          await loadFixture(deployDefiManagerFixture)

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

        // Authorize a mock campaign
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

        // Set up token
        const tokenAddress = await mockToken1.getAddress()
        const depositAmount = ethers.parseUnits('100')

        // Transfer tokens to campaign
        await mockToken1.transfer(campaignAddress, depositAmount)

        // Deposit tokens
        await mockCampaign.depositToYield(tokenAddress, depositAmount)

        // Make sure aToken balance equals exactly the deposit amount (no yield)
        const defiManagerAddress = await defiManager.getAddress()

        // First reset any existing balance
        const currentBalance = await mockAToken1.balanceOf(defiManagerAddress)
        if (currentBalance > 0) {
          await mockAToken1.burn(defiManagerAddress, currentBalance)
        }

        // Now set exactly the deposit amount
        await mockAToken1.mint(defiManagerAddress, depositAmount)

        // Verify we have the exact deposit amount of aTokens
        expect(await mockAToken1.balanceOf(defiManagerAddress)).to.equal(
          depositAmount
        )

        // Attempt to harvest with no yield
        await expect(mockCampaign.harvestYield(tokenAddress))
          .to.be.revertedWithCustomError(defiManager, 'NoYield')
          .withArgs(tokenAddress)
      })

      it('Should revert when getReserveData fails', async function () {
        const { defiManager, mockToken1, mockAavePool, mockAToken1, owner } =
          await loadFixture(deployDefiManagerFixture)

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

        // Authorize a mock campaign
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

        // Set up token
        const tokenAddress = await mockToken1.getAddress()
        const depositAmount = ethers.parseUnits('100')
        const yieldAmount = ethers.parseUnits('10')

        // Transfer tokens to campaign
        await mockToken1.transfer(campaignAddress, depositAmount)

        // Transfer tokens to defi manager for the yield
        await mockToken1.transfer(await defiManager.getAddress(), yieldAmount)

        // Deposit tokens
        await mockCampaign.depositToYield(tokenAddress, depositAmount)

        // Set up aToken balance to include yield
        const defiManagerAddress = await defiManager.getAddress()
        await mockAToken1.mint(defiManagerAddress, depositAmount + yieldAmount)

        // Configure Aave mock to fail on getReserveData
        await mockAavePool.setShouldFailGetReserveData(true)

        // Attempt to harvest
        await expect(
          mockCampaign.harvestYield(tokenAddress)
        ).to.be.revertedWithCustomError(defiManager, 'FailedToGetATokenAddress')
      })

      it('Should revert when aTokenAddress is zero', async function () {
        const { defiManager, mockToken1, mockAavePool, mockAToken1, owner } =
          await loadFixture(deployDefiManagerFixture)

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

        // Authorize a mock campaign
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

        // Set up token
        const tokenAddress = await mockToken1.getAddress()
        const depositAmount = ethers.parseUnits('100')

        // Transfer tokens to campaign
        await mockToken1.transfer(campaignAddress, depositAmount)

        // Deposit tokens
        await mockCampaign.depositToYield(tokenAddress, depositAmount)

        // Set aToken address to zero
        await mockAavePool.setAToken(tokenAddress, ethers.ZeroAddress)

        // Attempt to harvest
        await expect(
          mockCampaign.harvestYield(tokenAddress)
        ).to.be.revertedWithCustomError(defiManager, 'InvalidAddress')
      })

      it('Should revert when Aave withdrawal fails during harvest', async function () {
        const { defiManager, mockToken1, mockAavePool, mockAToken1, owner } =
          await loadFixture(deployDefiManagerFixture)

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

        // Authorize a mock campaign
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

        // Set up token
        const tokenAddress = await mockToken1.getAddress()
        const depositAmount = ethers.parseUnits('100')
        const yieldAmount = ethers.parseUnits('10')

        // Transfer tokens to campaign
        await mockToken1.transfer(campaignAddress, depositAmount)

        // Transfer tokens to defi manager for potential yield (not needed due to withdrawal failure)
        await mockToken1.transfer(await defiManager.getAddress(), yieldAmount)

        // Deposit tokens
        await mockCampaign.depositToYield(tokenAddress, depositAmount)

        // Simulate yield generation by minting additional aTokens
        const defiManagerAddress = await defiManager.getAddress()
        await mockAToken1.mint(defiManagerAddress, depositAmount + yieldAmount)

        // Configure Aave mock to fail on withdraw
        await mockAavePool.setShouldFailWithdraw(true)

        // Attempt to harvest
        await expect(mockCampaign.harvestYield(tokenAddress))
          .to.be.revertedWithCustomError(defiManager, 'YieldwithdrawalFailed')
          .withArgs('Withdraw failed')
      })

      it('Should revert when withdrawal amount mismatch during harvest', async function () {
        const { defiManager, mockToken1, mockAavePool, mockAToken1, owner } =
          await loadFixture(deployDefiManagerFixture)

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

        // Authorize a mock campaign
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

        // Set up token
        const tokenAddress = await mockToken1.getAddress()
        const depositAmount = ethers.parseUnits('100')
        const yieldAmount = ethers.parseUnits('10')
        const mismatchAmount = yieldAmount - 1n

        // Transfer tokens to campaign
        await mockToken1.transfer(campaignAddress, depositAmount)

        // Transfer tokens to defi manager for the mismatched yield
        await mockToken1.transfer(
          await defiManager.getAddress(),
          mismatchAmount
        )

        // Deposit tokens
        await mockCampaign.depositToYield(tokenAddress, depositAmount)

        // Reset any existing aToken balance to avoid interference
        const defiManagerAddress = await defiManager.getAddress()
        const existingBalance = await mockAToken1.balanceOf(defiManagerAddress)
        if (existingBalance > 0) {
          await mockAToken1.burn(defiManagerAddress, existingBalance)
        }

        // Now mint exactly the deposit + yield amount
        await mockAToken1.mint(defiManagerAddress, depositAmount + yieldAmount)

        // Verify the aToken balance is correct for our test
        expect(await mockAToken1.balanceOf(defiManagerAddress)).to.equal(
          depositAmount + yieldAmount
        )

        // Configure the mock Aave pool to return a different amount than requested
        await mockAavePool.setMismatchWithdraw(true, mismatchAmount)

        // Attempt to harvest
        await expect(mockCampaign.harvestYield(tokenAddress))
          .to.be.revertedWithCustomError(
            defiManager,
            'WithdrawalAmountMismatch'
          )
          .withArgs(yieldAmount, mismatchAmount)
      })
    })
  })

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
