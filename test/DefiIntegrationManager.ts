import { token } from '../typechain-types/@openzeppelin/contracts'

const { expect } = require('chai')
const { ethers } = require('hardhat')
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers')

describe('DefiIntegrationManager', function () {
  const OP_YIELD_DEPOSITED = 1
  const OP_YIELD_WITHDRAWN = 2
  const OP_YIELD_HARVESTED = 3
  const OP_TOKEN_SWAPPED = 4
  const OP_CONFIG_UPDATED = 5

  // Error codes
  const ERR_UNAUTHORIZED = 1
  const ERR_ZERO_AMOUNT = 2
  const ERR_INSUFFICIENT_DEPOSIT = 3
  const ERR_TOKEN_NOT_SUPPORTED = 4
  const ERR_SLIPPAGE_EXCEEDED = 5
  const ERR_YIELD_DEPOSIT_FAILED = 6
  const ERR_YIELD_WITHDRAWAL_FAILED = 7
  const ERR_INVALID_ADDRESS = 8
  const ERR_INVALID_CONSTRUCTOR = 9
  const ERR_NO_YIELD = 10
  const ERR_WITHDRAWAL_MISMATCH = 11
  const ERR_FAILED_GET_ATOKEN = 12
  const ERR_TOKENS_SAME = 13
  const ERR_SWAP_QUOTE_INVALID = 14
  const ERR_SWAP_FAILED = 15

  async function deployDefiManagerFixture () {
    const CAMPAIGN_GOAL_AMOUNT = 5
    const CAMPAIGN_DURATION = 30

    const GRACE_PERIOD = 7 // 7 days grace period

    const [owner, user1, user2, platformTreasury, otherAdmin] =
      await ethers.getSigners()

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

    const platformAdmin = await ethers.deployContract('PlatformAdmin', [
      GRACE_PERIOD,
      owner
    ])
    await platformAdmin.waitForDeployment()

    await platformAdmin.addPlatformAdmin(await otherAdmin.getAddress())

    const platformAdminAddress = await platformAdmin.getAddress()

    const tokenRegistry = await ethers.deployContract('TokenRegistry', [
      owner.address,
      platformAdminAddress
    ])
    await tokenRegistry.waitForDeployment()
    const tokenRegistryAddress = await tokenRegistry.getAddress()

    await tokenRegistry.addToken(await mockToken1.getAddress(), 1)
    await tokenRegistry.addToken(await mockToken2.getAddress(), 1)

    // Deploy yield distributor with platform admin
    const yieldDistributor = await ethers.deployContract('YieldDistributor', [
      platformTreasury.address,
      platformAdminAddress,
      owner.address
    ])
    await yieldDistributor.waitForDeployment()
    const yieldDistributorAddress = await yieldDistributor.getAddress()

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

    const mockUniswapRouter = await ethers.deployContract('MockUniswapRouter')
    await mockUniswapRouter.waitForDeployment()

    const mockUniswapQuoter = await ethers.deployContract('MockUniswapQuoter')
    await mockUniswapQuoter.waitForDeployment()

    // 9. Now deploy the DefiIntegrationManager with all dependencies
    const defiManager = await ethers.deployContract('DefiIntegrationManager', [
      await mockAavePool.getAddress(),
      await mockUniswapRouter.getAddress(),
      await mockUniswapQuoter.getAddress(),
      tokenRegistryAddress,
      yieldDistributorAddress,
      platformAdminAddress,
      owner.address
    ])
    await defiManager.waitForDeployment()

    const mockCampaign = await ethers.deployContract('MockCampaign', [
      owner.address,
      await mockToken1.getAddress(),
      CAMPAIGN_GOAL_AMOUNT,
      CAMPAIGN_DURATION,
      await defiManager.getAddress()
    ])
    await mockCampaign.waitForDeployment()

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
      tokenRegistry,
      yieldDistributor,
      mockCampaign,
      defiManager,
      platformAdmin,
      CAMPAIGN_GOAL_AMOUNT,
      CAMPAIGN_DURATION,
      otherAdmin
    }
  }

  describe('Deployment', function () {
    it('Should correctly deploy all defimanager', async function () {
      const {
        mockAavePool,
        mockUniswapRouter,
        mockUniswapQuoter,
        tokenRegistry,
        yieldDistributor,
        platformAdmin,
        owner,
        defiManager
      } = await loadFixture(deployDefiManagerFixture)

      expect(await defiManager.getAddress()).to.be.properAddress

      const aavePoolAddress = await defiManager.aavePool()
      const uniswapRouterAddress = await defiManager.uniswapRouter()
      const uniswapQuoterAddress = await defiManager.uniswapQuoter()
      const tokenRegistryAddress = await defiManager.tokenRegistry()
      const yieldDistributorAddress = await defiManager.yieldDistributor()
      const platformAdminAddress = await defiManager.platformAdmin()

      expect(await mockAavePool.getAddress()).to.equal(aavePoolAddress)
      expect(await mockUniswapRouter.getAddress()).to.equal(
        uniswapRouterAddress
      )
      expect(await mockUniswapQuoter.getAddress()).to.equal(
        uniswapQuoterAddress
      )
      expect(await tokenRegistry.getAddress()).to.equal(tokenRegistryAddress)
      expect(await yieldDistributor.getAddress()).to.equal(
        yieldDistributorAddress
      )
      expect(await platformAdmin.getAddress()).to.equal(platformAdminAddress)
    })

    it('Should revert on any incorrect constructor inputs', async function () {
      const {
        mockAavePool,
        mockUniswapRouter,
        mockUniswapQuoter,
        owner,
        tokenRegistry,
        yieldDistributor,
        platformAdmin
      } = await loadFixture(deployDefiManagerFixture)

      // Store addresses
      const aavePoolAddress = await mockAavePool.getAddress()
      const uniswapRouterAddress = await mockUniswapRouter.getAddress()
      const uniswapQuoterAddress = await mockUniswapQuoter.getAddress()
      const tokenRegistryAddress = await tokenRegistry.getAddress()
      const yieldDistributorAddress = await yieldDistributor.getAddress()
      const platformAdminAddress = await platformAdmin.getAddress()

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
          yieldDistributorAddress,
          platformAdminAddress,
          owner.address
        )
      )
        .to.be.revertedWithCustomError(DefiManager, 'DefiError')
        .withArgs(ERR_INVALID_CONSTRUCTOR, ethers.ZeroAddress, 0)

      // Test zero address for uniswapRouter (index 1)
      await expect(
        DefiManager.deploy(
          aavePoolAddress,
          ethers.ZeroAddress,
          uniswapQuoterAddress,
          tokenRegistryAddress,
          yieldDistributorAddress,
          platformAdminAddress,
          owner.address
        )
      )
        .to.be.revertedWithCustomError(DefiManager, 'DefiError')
        .withArgs(ERR_INVALID_CONSTRUCTOR, ethers.ZeroAddress, 1)

      // Test zero address for uniswapQuoter (index 2)
      await expect(
        DefiManager.deploy(
          aavePoolAddress,
          uniswapRouterAddress,
          ethers.ZeroAddress,
          tokenRegistryAddress,
          yieldDistributorAddress,
          platformAdminAddress,
          owner.address
        )
      )
        .to.be.revertedWithCustomError(DefiManager, 'DefiError')
        .withArgs(ERR_INVALID_CONSTRUCTOR, ethers.ZeroAddress, 2)

      await expect(
        DefiManager.deploy(
          aavePoolAddress,
          uniswapRouterAddress,
          uniswapQuoterAddress,
          ethers.ZeroAddress,
          yieldDistributorAddress,
          platformAdminAddress,
          owner.address
        )
      )
        .to.be.revertedWithCustomError(DefiManager, 'DefiError')
        .withArgs(ERR_INVALID_CONSTRUCTOR, ethers.ZeroAddress, 3)

      await expect(
        DefiManager.deploy(
          aavePoolAddress,
          uniswapRouterAddress,
          uniswapQuoterAddress,
          tokenRegistryAddress,
          ethers.ZeroAddress,
          platformAdminAddress,
          owner.address
        )
      )
        .to.be.revertedWithCustomError(DefiManager, 'DefiError')
        .withArgs(ERR_INVALID_CONSTRUCTOR, ethers.ZeroAddress, 4)
    })
  })

  describe('Yield Distributor Integration', function () {
    describe('Depositing to yield protocol', function () {
      it('Should successfully deposit tokens to the yield protocol', async function () {
        const { defiManager, mockToken1, mockAToken1, mockCampaign, owner } =
          await loadFixture(deployDefiManagerFixture)

        const campaignAddress = await mockCampaign.getAddress()

        const tokenAddress = await mockToken1.getAddress()
        const depositAmount = ethers.parseUnits('100')

        await mockToken1.transfer(campaignAddress, depositAmount)

        expect(
          await defiManager.getDepositedAmount(campaignAddress, tokenAddress)
        ).to.equal(0)

        await expect(mockCampaign.depositToYield(tokenAddress, depositAmount))
          .to.emit(defiManager, 'DefiOperation')
          .withArgs(
            OP_YIELD_DEPOSITED,
            campaignAddress,
            await mockToken1.getAddress(),
            ethers.ZeroAddress,
            depositAmount,
            0
          )

        expect(
          await defiManager.getDepositedAmount(campaignAddress, tokenAddress)
        ).to.equal(depositAmount)
        expect(await mockToken1.balanceOf(campaignAddress)).to.equal(0)
        expect(
          await mockAToken1.balanceOf(await defiManager.getAddress())
        ).to.equal(depositAmount)
      })

      it('Should revert when trying to deposit zero amount', async function () {
        const { defiManager, mockToken1, mockCampaign } = await loadFixture(
          deployDefiManagerFixture
        )

        const campaignAddress = await mockCampaign.getAddress()

        const tokenAddress = await mockToken1.getAddress()
        const zeroAmount = 0

        await expect(mockCampaign.depositToYield(tokenAddress, zeroAmount))
          .to.be.revertedWithCustomError(defiManager, 'DefiError')
          .withArgs(ERR_ZERO_AMOUNT, await mockToken1.getAddress(), 0)
      })

      it('Should revert when trying to deposit an unsupported token', async function () {
        const { defiManager, tokenRegistry, mockCampaign } = await loadFixture(
          deployDefiManagerFixture
        )

        const campaignAddress = await mockCampaign.getAddress()

        const initialSupply = ethers.parseUnits('1000')
        const unsupportedToken = await ethers.deployContract('MockERC20', [
          'Unsupported',
          'UNSUP',
          initialSupply
        ])
        await unsupportedToken.waitForDeployment()
        const unsupportedTokenAddress = await unsupportedToken.getAddress()

        await tokenRegistry.addToken(unsupportedTokenAddress, 1)
        await tokenRegistry.disableTokenSupport(unsupportedTokenAddress)

        // Transfer tokens to campaign
        const depositAmount = ethers.parseUnits('100')
        await unsupportedToken.transfer(campaignAddress, depositAmount)

        // Attempt to deposit unsupported token
        await expect(
          mockCampaign.depositToYield(unsupportedTokenAddress, depositAmount)
        )
          .to.be.revertedWithCustomError(defiManager, 'DefiError')
          .withArgs(ERR_TOKEN_NOT_SUPPORTED, unsupportedTokenAddress, 0)
      })

      it('Should revert when Aave supply fails', async function () {
        const { defiManager, mockToken1, mockCampaign, mockAavePool } =
          await loadFixture(deployDefiManagerFixture)

        // Authorize a mock campaign

        const campaignAddress = await mockCampaign.getAddress()

        // Set up token
        const tokenAddress = await mockToken1.getAddress()
        const depositAmount = ethers.parseUnits('100')

        // Transfer tokens to campaign
        await mockToken1.transfer(campaignAddress, depositAmount)

        // Configure Aave mock to fail
        await mockAavePool.setShouldFailSupply(true)

        // Attempt deposit, should fail due to Aave supply failure
        await expect(mockCampaign.depositToYield(tokenAddress, depositAmount))
          .to.be.revertedWithCustomError(defiManager, 'DefiError')
          .withArgs(ERR_YIELD_DEPOSIT_FAILED, tokenAddress, depositAmount)
      })

      it('Should correctly add to existing deposits when depositing more of the same token', async function () {
        const { defiManager, mockToken1, mockCampaign } = await loadFixture(
          deployDefiManagerFixture
        )

        const campaignAddress = await mockCampaign.getAddress()

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
        const { defiManager, mockToken1, mockCampaign, owner } =
          await loadFixture(deployDefiManagerFixture)

        const campaignAddress = await mockCampaign.getAddress()

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
          .to.emit(defiManager, 'DefiOperation')
          .withArgs(
            OP_YIELD_WITHDRAWN,
            campaignAddress,
            tokenAddress,
            ethers.ZeroAddress,
            withdrawAmount,
            0
          )

        // Verify state changes after withdrawal
        expect(
          await defiManager.getDepositedAmount(campaignAddress, tokenAddress)
        ).to.equal(depositAmount - withdrawAmount)
        expect(await mockToken1.balanceOf(campaignAddress)).to.equal(
          withdrawAmount
        )
      })

      it('Should revert when trying to withdraw zero amount', async function () {
        const { defiManager, mockToken1, mockCampaign } = await loadFixture(
          deployDefiManagerFixture
        )

        const campaignAddress = await mockCampaign.getAddress()

        const tokenAddress = await mockToken1.getAddress()
        const zeroAmount = 0

        await expect(mockCampaign.withdrawFromYield(tokenAddress, zeroAmount))
          .to.be.revertedWithCustomError(defiManager, 'DefiError')
          .withArgs(ERR_ZERO_AMOUNT, tokenAddress, zeroAmount)
      })

      it('Should revert when trying to withdraw more than deposited', async function () {
        const { defiManager, mockToken1, mockCampaign } = await loadFixture(
          deployDefiManagerFixture
        )

        const campaignAddress = await mockCampaign.getAddress()

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
          .to.be.revertedWithCustomError(defiManager, 'DefiError')
          .withArgs(ERR_INSUFFICIENT_DEPOSIT, tokenAddress, withdrawAmount)
      })

      it('Should revert when Aave withdrawal fails', async function () {
        const { defiManager, mockToken1, mockAavePool, mockCampaign } =
          await loadFixture(deployDefiManagerFixture)

        const campaignAddress = await mockCampaign.getAddress()

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
          .to.be.revertedWithCustomError(defiManager, 'DefiError')
          .withArgs(ERR_YIELD_WITHDRAWAL_FAILED, tokenAddress, withdrawAmount)
      })

      it('Should revert when withdrawal amount does not match expected amount', async function () {
        const { defiManager, mockToken1, mockAavePool, mockCampaign } =
          await loadFixture(deployDefiManagerFixture)

        const campaignAddress = await mockCampaign.getAddress()

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
          .to.be.revertedWithCustomError(defiManager, 'DefiError')
          .withArgs(ERR_WITHDRAWAL_MISMATCH, tokenAddress, withdrawAmount)
      })

      it('Should successfully withdraw all tokens from the yield protocol', async function () {
        const { defiManager, mockToken1, mockCampaign, owner } =
          await loadFixture(deployDefiManagerFixture)

        const campaignAddress = await mockCampaign.getAddress()

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
          .to.emit(defiManager, 'DefiOperation')
          .withArgs(
            OP_YIELD_WITHDRAWN,
            campaignAddress,
            tokenAddress,
            ethers.ZeroAddress,
            depositAmount,
            0
          )

        // Verify state changes after withdrawal
        expect(
          await defiManager.getDepositedAmount(campaignAddress, tokenAddress)
        ).to.equal(0)
        expect(await mockToken1.balanceOf(campaignAddress)).to.equal(
          depositAmount
        )
      })

      it('Should revert when trying to withdraw all with zero deposit', async function () {
        const { defiManager, mockToken1, mockCampaign } = await loadFixture(
          deployDefiManagerFixture
        )

        const campaignAddress = await mockCampaign.getAddress()

        // Attempt to withdraw with no deposit
        const tokenAddress = await mockToken1.getAddress()

        await expect(mockCampaign.withdrawAllFromYield(tokenAddress))
          .to.be.revertedWithCustomError(defiManager, 'DefiError')
          .withArgs(ERR_ZERO_AMOUNT, tokenAddress, 0)
      })

      it('Should revert when Aave withdrawal fails for withdrawAll', async function () {
        const { defiManager, mockToken1, mockAavePool, mockCampaign } =
          await loadFixture(deployDefiManagerFixture)

        const campaignAddress = await mockCampaign.getAddress()

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
          .to.be.revertedWithCustomError(defiManager, 'DefiError')
          .withArgs(ERR_YIELD_WITHDRAWAL_FAILED, tokenAddress, depositAmount)
      })

      it('Should revert when withdrawal amount does not match expected amount for withdrawAll', async function () {
        const { defiManager, mockToken1, mockAavePool, mockCampaign } =
          await loadFixture(deployDefiManagerFixture)

        const campaignAddress = await mockCampaign.getAddress()

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
          .to.be.revertedWithCustomError(defiManager, 'DefiError')
          .withArgs(ERR_WITHDRAWAL_MISMATCH, tokenAddress, depositAmount)
      })
    })

    describe('Harvesting yield', function () {
      it('Should successfully harvest yield and distribute correctly', async function () {
        const {
          defiManager,
          mockToken1,
          mockAToken1,
          yieldDistributor,
          mockCampaign,
          platformTreasury
        } = await loadFixture(deployDefiManagerFixture)

        const campaignAddress = await mockCampaign.getAddress()

        // Set up token
        const tokenAddress = await mockToken1.getAddress()
        const depositAmount = ethers.parseUnits('100')
        const yieldAmount = ethers.parseUnits('10')

        console.log(await yieldDistributor.platformYieldShare())
        // Calculate expected shares
        const platformSharePercentage =
          await yieldDistributor.platformYieldShare()
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
          .to.emit(defiManager, 'DefiOperation')
          .withArgs(
            OP_YIELD_HARVESTED,
            campaignAddress,
            tokenAddress,
            await platformTreasury.getAddress(),
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

      it('Should revert when trying to harvest with no deposits', async function () {
        const { defiManager, mockToken1, mockCampaign } = await loadFixture(
          deployDefiManagerFixture
        )

        const campaignAddress = await mockCampaign.getAddress()

        // Attempt to harvest with no deposit
        const tokenAddress = await mockToken1.getAddress()

        await expect(mockCampaign.harvestYield(tokenAddress))
          .to.be.revertedWithCustomError(defiManager, 'DefiError')
          .withArgs(ERR_INSUFFICIENT_DEPOSIT, tokenAddress, 0)
      })

      it('Should revert when there is no yield to harvest', async function () {
        const { defiManager, mockToken1, mockAToken1, mockCampaign } =
          await loadFixture(deployDefiManagerFixture)

        const campaignAddress = await mockCampaign.getAddress()

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
          .to.be.revertedWithCustomError(defiManager, 'DefiError')
          .withArgs(ERR_NO_YIELD, tokenAddress, 0)
      })

      it('Should revert when getReserveData fails', async function () {
        const {
          defiManager,
          mockToken1,
          mockAavePool,
          mockAToken1,
          mockCampaign
        } = await loadFixture(deployDefiManagerFixture)

        const campaignAddress = await mockCampaign.getAddress()

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
        await expect(mockCampaign.harvestYield(tokenAddress))
          .to.be.revertedWithCustomError(defiManager, 'DefiError')
          .withArgs(ERR_FAILED_GET_ATOKEN, tokenAddress, 0)
      })

      it('Should revert when aTokenAddress is zero', async function () {
        const { defiManager, mockToken1, mockAavePool, mockCampaign } =
          await loadFixture(deployDefiManagerFixture)

        const campaignAddress = await mockCampaign.getAddress()

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
        ).to.be.revertedWithCustomError(defiManager, 'DefiError')
      })

      it('Should revert when Aave withdrawal fails during harvest', async function () {
        const {
          defiManager,
          mockToken1,
          mockAavePool,
          mockAToken1,
          mockCampaign
        } = await loadFixture(deployDefiManagerFixture)

        const campaignAddress = await mockCampaign.getAddress()

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
        await mockAToken1.mint(defiManagerAddress, yieldAmount)

        // Configure Aave mock to fail on withdraw
        await mockAavePool.setShouldFailWithdraw(true)

        // Attempt to harvest
        await expect(mockCampaign.harvestYield(tokenAddress))
          .to.be.revertedWithCustomError(defiManager, 'DefiError')
          .withArgs(ERR_YIELD_WITHDRAWAL_FAILED, tokenAddress, yieldAmount)
      })

      it('Should revert when withdrawal amount mismatch during harvest', async function () {
        const {
          defiManager,
          mockToken1,
          mockAavePool,
          mockAToken1,
          mockCampaign
        } = await loadFixture(deployDefiManagerFixture)

        const campaignAddress = await mockCampaign.getAddress()
        const defiManagerAddress = await defiManager.getAddress()

        // Set up token
        const tokenAddress = await mockToken1.getAddress()
        const depositAmount = ethers.parseUnits('100')
        const yieldAmount = ethers.parseUnits('10')
        const totalAmount = depositAmount + yieldAmount
        const mismatchAmount = yieldAmount - 1n // Slightly less than requested yield

        // Transfer tokens to campaign for the initial deposit
        await mockToken1.transfer(campaignAddress, depositAmount)

        // Transfer tokens to defi manager for the later withdrawal
        // This is needed so the mock can actually transfer tokens
        await mockToken1.transfer(defiManagerAddress, mismatchAmount)

        // Setup the deposit in the aaveDeposits mapping
        await mockCampaign.depositToYield(tokenAddress, depositAmount)

        // Reset any existing aToken balance to avoid interference
        const existingBalance = await mockAToken1.balanceOf(defiManagerAddress)
        if (existingBalance > 0) {
          await mockAToken1.burn(defiManagerAddress, existingBalance)
        }

        // Mint aTokens representing deposit + yield
        // This simulates how Aave works - your aToken balance increases over time
        await mockAToken1.mint(defiManagerAddress, totalAmount)

        // Verify the aToken balance is correct
        expect(await mockAToken1.balanceOf(defiManagerAddress)).to.equal(
          totalAmount
        )

        // Configure the mock Aave pool to return a different amount than requested
        // When trying to withdraw yieldAmount, it will return mismatchAmount instead
        await mockAavePool.setMismatchWithdraw(true, mismatchAmount)

        // Attempt to harvest yield - should revert because of the mismatch
        // The contract will calculate yield as (totalAmount - depositAmount) = yieldAmount
        // Then attempt to withdraw yieldAmount, but mockAavePool returns mismatchAmount
        await expect(mockCampaign.harvestYield(tokenAddress))
          .to.be.revertedWithCustomError(defiManager, 'DefiError')
          .withArgs(ERR_WITHDRAWAL_MISMATCH, tokenAddress, yieldAmount)
      })
    })

    describe('getCurrentYieldRate', function () {
      it('Should return the correct yield rate for a supported token', async function () {
        const { defiManager, mockToken1, mockAavePool, owner } =
          await loadFixture(deployDefiManagerFixture)

        // Set up a test liquidity rate in the mock Aave pool
        // The rate is stored in ray units (1e27) - e.g., 5% APY would be 0.05 * 1e27
        const testRateInRay = ethers.parseUnits('0.05', 27) // 5% APY
        const expectedScaledRate = 500 // 5% * 10000 = 500 basis points

        // Configure the mock Aave pool with our test rate
        await mockAavePool.setLiquidityRate(
          await mockToken1.getAddress(),
          testRateInRay
        )

        // Call the function and check the result
        const yieldRate = await defiManager.getCurrentYieldRate(
          await mockToken1.getAddress()
        )

        // The function should scale down from ray (1e27) and multiply by 10000 for basis points
        expect(yieldRate).to.equal(expectedScaledRate)
      })

      it('Should return 0 when getReserveData fails', async function () {
        const { defiManager, mockToken1, mockAavePool, owner } =
          await loadFixture(deployDefiManagerFixture)

        // Configure Aave mock to fail on getReserveData
        await mockAavePool.setShouldFailGetReserveData(true)

        // Call should return 0 instead of reverting
        const yieldRate = await defiManager.getCurrentYieldRate(
          await mockToken1.getAddress()
        )
        expect(yieldRate).to.equal(0)

        // Reset for other tests
        await mockAavePool.setShouldFailGetReserveData(false)
      })

      it('Should return 0 for an unsupported token with no reserve data', async function () {
        const { defiManager, owner } = await loadFixture(
          deployDefiManagerFixture
        )

        // Deploy a new token that doesn't have reserve data set up
        const unsupportedToken = await ethers.deployContract('MockERC20', [
          'Unsupported',
          'UNSUP',
          ethers.parseUnits('1000000')
        ])
        await unsupportedToken.waitForDeployment()

        // Call should return 0 for this unsupported token
        const yieldRate = await defiManager.getCurrentYieldRate(
          await unsupportedToken.getAddress()
        )
        expect(yieldRate).to.equal(0)
      })

      it('Should handle various rate values correctly', async function () {
        const { defiManager, mockToken1, mockToken2, mockAavePool, owner } =
          await loadFixture(deployDefiManagerFixture)

        // Test various rates
        const testCases = [
          { rateInRay: ethers.parseUnits('0.01', 27), expectedBps: 100 }, // 1%
          { rateInRay: ethers.parseUnits('0.1', 27), expectedBps: 1000 }, // 10%
          { rateInRay: ethers.parseUnits('0.2', 27), expectedBps: 2000 }, // 20%
          { rateInRay: ethers.parseUnits('0', 27), expectedBps: 0 } // 0%
        ]

        // Use mockToken1 and mockToken2 for different test cases
        const tokens = [
          await mockToken1.getAddress(),
          await mockToken2.getAddress()
        ]

        for (let i = 0; i < testCases.length; i++) {
          const testCase = testCases[i]
          const token = tokens[i % tokens.length]

          // Configure the mock pool with this rate
          await mockAavePool.setLiquidityRate(token, testCase.rateInRay)

          // Call the function and check the result
          const yieldRate = await defiManager.getCurrentYieldRate(token)
          expect(yieldRate).to.equal(testCase.expectedBps)
        }
      })
    })
  })

  describe('Swapping Tokens', function () {
    describe('getTargetTokenEquivalent()', function () {
      it('Should correctly return the token equivalent amount using default rate', async function () {
        const { defiManager, mockToken1, mockToken2, mockUniswapQuoter } =
          await loadFixture(deployDefiManagerFixture)

        const fromTokenAddress = await mockToken1.getAddress()
        const toTokenAddress = await mockToken2.getAddress()
        const amount = ethers.parseUnits('100')

        // Get the default quote rate (should be 2)
        const defaultRate = await mockUniswapQuoter.defaultQuoteRate()
        const expectedQuote = amount * BigInt(defaultRate)

        // Call the function and verify the result
        const result = await defiManager.getTargetTokenEquivalent(
          fromTokenAddress,
          amount,
          toTokenAddress
        )

        expect(result).to.equal(expectedQuote)
      })

      it('Should correctly return the token equivalent amount using custom rate', async function () {
        const { defiManager, mockToken1, mockToken2, mockUniswapQuoter } =
          await loadFixture(deployDefiManagerFixture)

        const fromTokenAddress = await mockToken1.getAddress()
        const toTokenAddress = await mockToken2.getAddress()
        const amount = ethers.parseUnits('100')
        const customRate = 3 // Custom 1:3 exchange rate

        // Set up the mock quoter with a custom rate
        await mockUniswapQuoter.setCustomQuoteRate(
          fromTokenAddress,
          toTokenAddress,
          customRate
        )

        const expectedQuote = amount * BigInt(customRate)

        // Call the function and verify the result
        const result = await defiManager.getTargetTokenEquivalent(
          fromTokenAddress,
          amount,
          toTokenAddress
        )

        expect(result).to.equal(expectedQuote)
      })

      it('Should revert when tokens are the same', async function () {
        const { defiManager, mockToken1 } = await loadFixture(
          deployDefiManagerFixture
        )

        const tokenAddress = await mockToken1.getAddress()
        const amount = ethers.parseUnits('100')

        // Should revert when from and to tokens are the same
        await expect(
          defiManager.getTargetTokenEquivalent(
            tokenAddress,
            amount,
            tokenAddress
          )
        )
          .to.be.revertedWithCustomError(defiManager, 'DefiError')
          .withArgs(ERR_TOKENS_SAME, tokenAddress, 0)
      })

      it('Should return 0 when quoter fails globally', async function () {
        const { defiManager, mockToken1, mockToken2, mockUniswapQuoter } =
          await loadFixture(deployDefiManagerFixture)

        const fromTokenAddress = await mockToken1.getAddress()
        const toTokenAddress = await mockToken2.getAddress()
        const amount = ethers.parseUnits('100')

        // Set up the mock quoter to fail globally
        await mockUniswapQuoter.setShouldFailQuote(true)

        // Function should return 0 instead of reverting
        const result = await defiManager.getTargetTokenEquivalent(
          fromTokenAddress,
          amount,
          toTokenAddress
        )

        expect(result).to.equal(0)

        // Reset for other tests
        await mockUniswapQuoter.setShouldFailQuote(false)
      })

      it('Should return 0 when quoter fails for specific token pair', async function () {
        const { defiManager, mockToken1, mockToken2, mockUniswapQuoter } =
          await loadFixture(deployDefiManagerFixture)

        const fromTokenAddress = await mockToken1.getAddress()
        const toTokenAddress = await mockToken2.getAddress()
        const amount = ethers.parseUnits('100')

        // Set up the mock quoter to fail for this specific pair
        await mockUniswapQuoter.setFailForSpecificPair(
          fromTokenAddress,
          toTokenAddress,
          true
        )

        // Function should return 0 instead of reverting
        const result = await defiManager.getTargetTokenEquivalent(
          fromTokenAddress,
          amount,
          toTokenAddress
        )

        expect(result).to.equal(0)

        // Reset for other tests
        await mockUniswapQuoter.setFailForSpecificPair(
          fromTokenAddress,
          toTokenAddress,
          false
        )
      })
    })

    describe('swapTokenForTarget', function () {
      it('Should successfully swap tokens and emit the correct event', async function () {
        const {
          defiManager,
          mockToken1,
          mockToken2,
          mockUniswapRouter,
          mockCampaign
        } = await loadFixture(deployDefiManagerFixture)

        // Get the campaign address which will be used as the caller
        const campaignAddress = await mockCampaign.getAddress()

        // Set up tokens
        const fromTokenAddress = await mockToken1.getAddress()
        const toTokenAddress = await mockToken2.getAddress()
        const swapAmount = ethers.parseUnits('100')

        // Transfer tokens to campaign (which will approve and transfer to defi manager)
        await mockToken1.transfer(campaignAddress, swapAmount)

        // Set expected swap output rate
        const swapRate = await mockUniswapRouter.swapRate()
        const expectedOutput = swapAmount * BigInt(swapRate)

        // Pre-fund the Uniswap router with output tokens
        await mockToken2.transfer(
          await mockUniswapRouter.getAddress(),
          expectedOutput
        )

        // First impersonate the account
        await ethers.provider.send('hardhat_impersonateAccount', [
          campaignAddress
        ])

        // Then set the balance
        await ethers.provider.send('hardhat_setBalance', [
          campaignAddress,
          '0x56BC75E2D63100000' // 100 ETH
        ])

        // Then get the signer
        const campaignSigner = await ethers.provider.getSigner(campaignAddress)

        // Approve the DefiIntegrationManager to spend tokens on behalf of the campaign
        await mockToken1
          .connect(campaignSigner)
          .approve(await defiManager.getAddress(), swapAmount)

        // Directly call swapTokenForTarget from the campaign address
        await expect(
          defiManager
            .connect(campaignSigner)
            .swapTokenForTarget(fromTokenAddress, swapAmount, toTokenAddress)
        )
          .to.emit(defiManager, 'DefiOperation')
          .withArgs(
            OP_TOKEN_SWAPPED,
            campaignAddress,
            fromTokenAddress,
            toTokenAddress,
            swapAmount,
            expectedOutput
          )

        // Verify token balances after swap
        expect(await mockToken1.balanceOf(campaignAddress)).to.equal(0)
        expect(await mockToken2.balanceOf(campaignAddress)).to.equal(
          expectedOutput
        )
      })

      it('Should revert when swapping zero amount', async function () {
        const { defiManager, mockToken1, mockToken2, mockCampaign } =
          await loadFixture(deployDefiManagerFixture)

        const campaignAddress = await mockCampaign.getAddress()

        // Set up tokens
        const fromTokenAddress = await mockToken1.getAddress()
        const toTokenAddress = await mockToken2.getAddress()
        const zeroAmount = 0

        // First impersonate the account
        await ethers.provider.send('hardhat_impersonateAccount', [
          campaignAddress
        ])

        // Then set the balance
        await ethers.provider.send('hardhat_setBalance', [
          campaignAddress,
          '0x56BC75E2D63100000' // 100 ETH
        ])

        // Then get the signer
        const campaignSigner = await ethers.provider.getSigner(campaignAddress)

        // Direct call with zero amount should fail
        await expect(
          defiManager
            .connect(campaignSigner)
            .swapTokenForTarget(fromTokenAddress, zeroAmount, toTokenAddress)
        )
          .to.be.revertedWithCustomError(defiManager, 'DefiError')
          .withArgs(ERR_ZERO_AMOUNT, fromTokenAddress, zeroAmount)
      })

      it('Should revert when fromToken is not supported', async function () {
        const {
          defiManager,
          mockToken1,
          mockToken2,
          tokenRegistry,
          mockCampaign
        } = await loadFixture(deployDefiManagerFixture)

        const campaignAddress = await mockCampaign.getAddress()

        // Set up tokens
        const fromTokenAddress = await mockToken1.getAddress()
        const toTokenAddress = await mockToken2.getAddress()
        const swapAmount = ethers.parseUnits('100')

        // Setup token registry to only support toToken
        await tokenRegistry.disableTokenSupport(fromTokenAddress)

        // Transfer tokens to campaign
        await mockToken1.transfer(campaignAddress, swapAmount)

        // First impersonate the account
        await ethers.provider.send('hardhat_impersonateAccount', [
          campaignAddress
        ])

        // Then set the balance
        await ethers.provider.send('hardhat_setBalance', [
          campaignAddress,
          '0x56BC75E2D63100000' // 100 ETH
        ])

        // Then get the signer
        const campaignSigner = await ethers.provider.getSigner(campaignAddress)

        // Approve the DefiIntegrationManager to spend tokens
        await mockToken1
          .connect(campaignSigner)
          .approve(await defiManager.getAddress(), swapAmount)

        await expect(
          defiManager
            .connect(campaignSigner)
            .swapTokenForTarget(fromTokenAddress, swapAmount, toTokenAddress)
        )
          .to.be.revertedWithCustomError(defiManager, 'DefiError')
          .withArgs(ERR_TOKEN_NOT_SUPPORTED, fromTokenAddress, 0)
      })

      it('Should revert when toToken is not supported', async function () {
        const {
          defiManager,
          mockToken1,
          mockToken2,
          tokenRegistry,
          mockCampaign
        } = await loadFixture(deployDefiManagerFixture)

        const campaignAddress = await mockCampaign.getAddress()

        // Set up tokens
        const fromTokenAddress = await mockToken1.getAddress()
        const toTokenAddress = await mockToken2.getAddress()
        const swapAmount = ethers.parseUnits('100')

        // Setup token registry to only support fromToken
        await tokenRegistry.disableTokenSupport(toTokenAddress)

        // Transfer tokens to campaign
        await mockToken1.transfer(campaignAddress, swapAmount)

        // First impersonate the account
        await ethers.provider.send('hardhat_impersonateAccount', [
          campaignAddress
        ])

        // Then set the balance
        await ethers.provider.send('hardhat_setBalance', [
          campaignAddress,
          '0x56BC75E2D63100000' // 100 ETH
        ])

        // Then get the signer
        const campaignSigner = await ethers.provider.getSigner(campaignAddress)

        // Approve the DefiIntegrationManager to spend tokens
        await mockToken1
          .connect(campaignSigner)
          .approve(await defiManager.getAddress(), swapAmount)

        await expect(
          defiManager
            .connect(campaignSigner)
            .swapTokenForTarget(fromTokenAddress, swapAmount, toTokenAddress)
        )
          .to.be.revertedWithCustomError(defiManager, 'DefiError')
          .withArgs(ERR_TOKEN_NOT_SUPPORTED, toTokenAddress, 0)
      })

      it('Should revert when tokens are the same', async function () {
        const { defiManager, mockToken1, mockTokenRegistry, mockCampaign } =
          await loadFixture(deployDefiManagerFixture)

        const campaignAddress = await mockCampaign.getAddress()

        // Set up tokens - same token for from and to
        const tokenAddress = await mockToken1.getAddress()
        const swapAmount = ethers.parseUnits('100')

        // Transfer tokens to campaign
        await mockToken1.transfer(campaignAddress, swapAmount)

        // First impersonate the account
        await ethers.provider.send('hardhat_impersonateAccount', [
          campaignAddress
        ])

        // Then set the balance
        await ethers.provider.send('hardhat_setBalance', [
          campaignAddress,
          '0x56BC75E2D63100000' // 100 ETH
        ])

        // Then get the signer
        const campaignSigner = await ethers.provider.getSigner(campaignAddress)

        // Approve the DefiIntegrationManager to spend tokens
        await mockToken1
          .connect(campaignSigner)
          .approve(await defiManager.getAddress(), swapAmount)

        await expect(
          defiManager
            .connect(campaignSigner)
            .swapTokenForTarget(tokenAddress, swapAmount, tokenAddress)
        )
          .to.be.revertedWithCustomError(defiManager, 'DefiError')
          .withArgs(ERR_TOKENS_SAME, tokenAddress, 0)
      })

      it('Should revert when swap quote is invalid', async function () {
        const {
          defiManager,
          mockToken1,
          mockToken2,

          mockUniswapQuoter,
          mockCampaign
        } = await loadFixture(deployDefiManagerFixture)

        const campaignAddress = await mockCampaign.getAddress()

        // Set up tokens
        const fromTokenAddress = await mockToken1.getAddress()
        const toTokenAddress = await mockToken2.getAddress()
        const swapAmount = ethers.parseUnits('100')

        // Set up the quoter to fail for this pair
        await mockUniswapQuoter.setFailForSpecificPair(
          fromTokenAddress,
          toTokenAddress,
          true
        )

        // Transfer tokens to campaign
        await mockToken1.transfer(campaignAddress, swapAmount)

        // First impersonate the account
        await ethers.provider.send('hardhat_impersonateAccount', [
          campaignAddress
        ])

        // Then set the balance
        await ethers.provider.send('hardhat_setBalance', [
          campaignAddress,
          '0x56BC75E2D63100000' // 100 ETH
        ])

        // Then get the signer
        const campaignSigner = await ethers.provider.getSigner(campaignAddress)

        // Approve the DefiIntegrationManager to spend tokens
        await mockToken1
          .connect(campaignSigner)
          .approve(await defiManager.getAddress(), swapAmount)

        await expect(
          defiManager
            .connect(campaignSigner)
            .swapTokenForTarget(fromTokenAddress, swapAmount, toTokenAddress)
        )
          .to.be.revertedWithCustomError(defiManager, 'DefiError')
          .withArgs(ERR_SWAP_QUOTE_INVALID, fromTokenAddress, swapAmount)
      })

      it('Should revert when Uniswap swap fails', async function () {
        const {
          defiManager,
          mockToken1,
          mockToken2,
          mockTokenRegistry,
          mockUniswapRouter,
          mockCampaign
        } = await loadFixture(deployDefiManagerFixture)

        const campaignAddress = await mockCampaign.getAddress()

        // Set up tokens
        const fromTokenAddress = await mockToken1.getAddress()
        const toTokenAddress = await mockToken2.getAddress()
        const swapAmount = ethers.parseUnits('100')

        // Configure the Uniswap router to fail
        await mockUniswapRouter.setShouldFailSwap(true)

        // Transfer tokens to campaign
        await mockToken1.transfer(campaignAddress, swapAmount)

        // First impersonate the account
        await ethers.provider.send('hardhat_impersonateAccount', [
          campaignAddress
        ])

        // Then set the balance
        await ethers.provider.send('hardhat_setBalance', [
          campaignAddress,
          '0x56BC75E2D63100000' // 100 ETH
        ])

        // Then get the signer
        const campaignSigner = await ethers.provider.getSigner(campaignAddress)

        // Approve the DefiIntegrationManager to spend tokens
        await mockToken1
          .connect(campaignSigner)
          .approve(await defiManager.getAddress(), swapAmount)

        await expect(
          defiManager
            .connect(campaignSigner)
            .swapTokenForTarget(fromTokenAddress, swapAmount, toTokenAddress)
        )
          .to.be.revertedWithCustomError(defiManager, 'DefiError')
          .withArgs(ERR_SWAP_FAILED, fromTokenAddress, swapAmount)
      })

      it('Should revert when slippage exceeds tolerance', async function () {
        const {
          defiManager,
          mockToken1,
          mockToken2,

          mockUniswapRouter,
          mockCampaign
        } = await loadFixture(deployDefiManagerFixture)

        const campaignAddress = await mockCampaign.getAddress()

        // Set up tokens
        const fromTokenAddress = await mockToken1.getAddress()
        const toTokenAddress = await mockToken2.getAddress()
        const swapAmount = ethers.parseUnits('100')

        // Configure the router to return less than minimum
        await mockUniswapRouter.setShouldReturnLessThanMinimum(true)

        // Transfer tokens to campaign
        await mockToken1.transfer(campaignAddress, swapAmount)

        // Also transfer some output tokens to the router for the swap
        await mockToken2.transfer(
          await mockUniswapRouter.getAddress(),
          ethers.parseUnits('200')
        )

        // First impersonate the account
        await ethers.provider.send('hardhat_impersonateAccount', [
          campaignAddress
        ])

        // Then set the balance
        await ethers.provider.send('hardhat_setBalance', [
          campaignAddress,
          '0x56BC75E2D63100000' // 100 ETH
        ])

        // Then get the signer
        const campaignSigner = await ethers.provider.getSigner(campaignAddress)

        // Approve the DefiIntegrationManager to spend tokens
        await mockToken1
          .connect(campaignSigner)
          .approve(await defiManager.getAddress(), swapAmount)

        // Get expected values for the error args
        const slippageTolerance = await defiManager.SLIPPAGE_TOLERANCE()
        const swapRate = await mockUniswapRouter.swapRate()
        const expectedOutput = swapAmount * BigInt(swapRate)
        const minAmountOut =
          (expectedOutput * (10000n - BigInt(slippageTolerance))) / 10000n
        const actualOut = minAmountOut - 1n // This is what the mock will return when shouldReturnLessThanMinimum is true

        await expect(
          defiManager
            .connect(campaignSigner)
            .swapTokenForTarget(fromTokenAddress, swapAmount, toTokenAddress)
        )
          .to.be.revertedWithCustomError(defiManager, 'DefiError')
          .withArgs(ERR_SLIPPAGE_EXCEEDED, toTokenAddress, actualOut)
      })
    })
  })

  describe('Setter functions', function () {
    describe('setTokenRegistry()', function () {
      it('Should allow owner the token registry', async function () {
        const { defiManager, owner, platformAdmin } = await loadFixture(
          deployDefiManagerFixture
        )

        const tokenRegistryBefore = await defiManager.tokenRegistry()
        const platformAdminAddress = await platformAdmin.getAddress()

        const tokenRegistryNew = await ethers.deployContract('TokenRegistry', [
          owner.address,
          platformAdminAddress
        ])
        await tokenRegistryNew.waitForDeployment()
        const tokenRegistryNewAddress = await tokenRegistryNew.getAddress()

        await expect(defiManager.setTokenRegistry(tokenRegistryNewAddress))
          .to.emit(defiManager, 'ConfigUpdated')
          .withArgs(1, tokenRegistryBefore, tokenRegistryNewAddress)

        expect(await defiManager.tokenRegistry()).to.equal(
          tokenRegistryNewAddress
        )

        expect(await defiManager.tokenRegistry()).to.equal(
          tokenRegistryNewAddress
        )
      })

      it('Should allow otheradmin the token registry', async function () {
        const { defiManager, owner, platformAdmin, otherAdmin } =
          await loadFixture(deployDefiManagerFixture)

        const tokenRegistryBefore = await defiManager.tokenRegistry()
        const platformAdminAddress = await platformAdmin.getAddress()

        const tokenRegistryNew = await ethers.deployContract('TokenRegistry', [
          owner.address,
          platformAdminAddress
        ])
        await tokenRegistryNew.waitForDeployment()
        const tokenRegistryNewAddress = await tokenRegistryNew.getAddress()

        await expect(
          defiManager
            .connect(otherAdmin)
            .setTokenRegistry(tokenRegistryNewAddress)
        )
          .to.emit(defiManager, 'ConfigUpdated')
          .withArgs(1, tokenRegistryBefore, tokenRegistryNewAddress)

        expect(await defiManager.tokenRegistry()).to.equal(
          tokenRegistryNewAddress
        )

        expect(await defiManager.tokenRegistry()).to.equal(
          tokenRegistryNewAddress
        )
      })

      it('Should revert if non-owner tries to set token registry', async function () {
        const { defiManager, owner, platformAdmin, user1 } = await loadFixture(
          deployDefiManagerFixture
        )

        const tokenRegistryBefore = await defiManager.tokenRegistry()
        const platformAdminAddress = await platformAdmin.getAddress()

        const tokenRegistryNew = await ethers.deployContract('TokenRegistry', [
          owner.address,
          platformAdminAddress
        ])
        await tokenRegistryNew.waitForDeployment()
        const tokenRegistryNewAddress = await tokenRegistryNew.getAddress()

        await expect(
          defiManager.connect(user1).setTokenRegistry(tokenRegistryNewAddress)
        )
          .to.be.revertedWithCustomError(defiManager, 'NotAuthorizedAdmin')
          .withArgs(user1.address)

        expect(await defiManager.tokenRegistry()).to.equal(tokenRegistryBefore)
      })

      it('Should revert if invalid address passed to setTokenRegistry()', async function () {
        const { defiManager, user1 } = await loadFixture(
          deployDefiManagerFixture
        )

        const tokenRegistryBefore = await defiManager.tokenRegistry()

        await expect(defiManager.setTokenRegistry(ethers.ZeroAddress))
          .to.be.revertedWithCustomError(defiManager, 'DefiError')
          .withArgs(ERR_INVALID_ADDRESS, ethers.ZeroAddress, 0)

        expect(await defiManager.tokenRegistry()).to.equal(tokenRegistryBefore)
      })
    })

    describe('setYieldDistributor()', function () {
      it('Should allow owner to set the yield distributor', async function () {
        const { defiManager, platformTreasury, platformAdmin, owner } =
          await loadFixture(deployDefiManagerFixture)

        const yieldDistributorBefore = await defiManager.yieldDistributor()
        const platformAdminAddress = await platformAdmin.getAddress()

        const yieldDistributorAfter = await ethers.deployContract(
          'YieldDistributor',
          [platformTreasury.address, platformAdminAddress, owner.address]
        )
        await yieldDistributorAfter.waitForDeployment()
        const yieldDistributorAfterAddress =
          await yieldDistributorAfter.getAddress()

        await expect(
          defiManager.setYieldDistributor(yieldDistributorAfterAddress)
        )
          .to.emit(defiManager, 'ConfigUpdated')
          .withArgs(2, yieldDistributorBefore, yieldDistributorAfterAddress)

        expect(await defiManager.yieldDistributor()).to.equal(
          yieldDistributorAfterAddress
        )
      })

      it('Should allow otheradmin to set the yield distributor', async function () {
        const {
          defiManager,
          platformTreasury,
          platformAdmin,
          owner,
          otherAdmin
        } = await loadFixture(deployDefiManagerFixture)

        const yieldDistributorBefore = await defiManager.yieldDistributor()
        const platformAdminAddress = await platformAdmin.getAddress()

        const yieldDistributorAfter = await ethers.deployContract(
          'YieldDistributor',
          [platformTreasury.address, platformAdminAddress, owner.address]
        )
        await yieldDistributorAfter.waitForDeployment()
        const yieldDistributorAfterAddress =
          await yieldDistributorAfter.getAddress()

        await expect(
          defiManager
            .connect(otherAdmin)
            .setYieldDistributor(yieldDistributorAfterAddress)
        )
          .to.emit(defiManager, 'ConfigUpdated')
          .withArgs(2, yieldDistributorBefore, yieldDistributorAfter)

        expect(await defiManager.yieldDistributor()).to.equal(
          yieldDistributorAfterAddress
        )
      })

      it('Should revert if non-owner tries to set yieldDistributor', async function () {
        const { defiManager, platformTreasury, platformAdmin, owner, user1 } =
          await loadFixture(deployDefiManagerFixture)

        const yieldDistributorBefore = await defiManager.yieldDistributor()
        const platformAdminAddress = await platformAdmin.getAddress()

        const yieldDistributorAfter = await ethers.deployContract(
          'YieldDistributor',
          [platformTreasury.address, platformAdminAddress, owner.address]
        )

        await expect(
          defiManager.connect(user1).setYieldDistributor(yieldDistributorAfter)
        )
          .to.be.revertedWithCustomError(defiManager, 'NotAuthorizedAdmin')
          .withArgs(user1.address)

        expect(await defiManager.yieldDistributor()).to.equal(
          yieldDistributorBefore
        )
      })

      it('Should revert if invalid address passed to setYieldDistributor()', async function () {
        const { defiManager, user1 } = await loadFixture(
          deployDefiManagerFixture
        )

        const yieldDistributorBefore = await defiManager.yieldDistributor()

        await expect(defiManager.setYieldDistributor(ethers.ZeroAddress))
          .to.be.revertedWithCustomError(defiManager, 'DefiError')
          .withArgs(ERR_INVALID_ADDRESS, ethers.ZeroAddress, 0)

        expect(await defiManager.yieldDistributor()).to.equal(
          yieldDistributorBefore
        )
      })
    })

    describe('setAavePool()', function () {
      it('Should allow owner to set the Aave Pool', async function () {
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
          .to.emit(defiManager, 'ConfigUpdated')
          .withArgs(3, mockAavePoolBefore, mockAavePoolAfter)

        expect(await defiManager.aavePool()).to.equal(mockAavePoolAfter)
      })

      it('Should allow other admin to set the Aave Pool', async function () {
        const { defiManager, mockAToken1, otherAdmin } = await loadFixture(
          deployDefiManagerFixture
        )

        const mockAavePoolBefore = await defiManager.aavePool()

        const mockAavePool = await ethers.deployContract('MockAavePool', [
          await mockAToken1.getAddress()
        ])
        await mockAavePool.waitForDeployment()

        const mockAavePoolAfter = await mockAavePool.getAddress()

        await expect(
          defiManager.connect(otherAdmin).setAavePool(mockAavePoolAfter)
        )
          .to.emit(defiManager, 'ConfigUpdated')
          .withArgs(3, mockAavePoolBefore, mockAavePoolAfter)

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
          .to.be.revertedWithCustomError(defiManager, 'NotAuthorizedAdmin')
          .withArgs(user1.address)

        expect(await defiManager.aavePool()).to.equal(mockAavePoolBefore)
      })

      it('Should revert if invalid address passed to setAavePool()', async function () {
        const { defiManager, user1 } = await loadFixture(
          deployDefiManagerFixture
        )

        const mockAavePoolBefore = await defiManager.aavePool()

        await expect(defiManager.setAavePool(ethers.ZeroAddress))
          .to.be.revertedWithCustomError(defiManager, 'DefiError')
          .withArgs(ERR_INVALID_ADDRESS, ethers.ZeroAddress, 0)

        expect(await defiManager.aavePool()).to.equal(mockAavePoolBefore)
      })
    })

    describe('setUniswapRouter()', function () {
      it('Should allow owner to set the Uniswap Router', async function () {
        const { defiManager } = await loadFixture(deployDefiManagerFixture)

        const mockUniswapRouterBefore = await defiManager.uniswapRouter()

        const mockUniswapRouter = await ethers.deployContract(
          'MockUniswapRouter'
        )
        await mockUniswapRouter.waitForDeployment()

        const mockUniswapRouterAfter = await mockUniswapRouter.getAddress()

        await expect(defiManager.setUniswapRouter(mockUniswapRouterAfter))
          .to.emit(defiManager, 'ConfigUpdated')
          .withArgs(4, mockUniswapRouterBefore, mockUniswapRouterAfter)

        expect(await defiManager.uniswapRouter()).to.equal(
          mockUniswapRouterAfter
        )
      })

      it('Should allow otheradmin to set the Uniswap Router', async function () {
        const { defiManager, otherAdmin } = await loadFixture(
          deployDefiManagerFixture
        )

        const mockUniswapRouterBefore = await defiManager.uniswapRouter()

        const mockUniswapRouter = await ethers.deployContract(
          'MockUniswapRouter'
        )
        await mockUniswapRouter.waitForDeployment()

        const mockUniswapRouterAfter = await mockUniswapRouter.getAddress()

        await expect(
          defiManager
            .connect(otherAdmin)
            .setUniswapRouter(mockUniswapRouterAfter)
        )
          .to.emit(defiManager, 'ConfigUpdated')
          .withArgs(4, mockUniswapRouterBefore, mockUniswapRouterAfter)

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
          .to.be.revertedWithCustomError(defiManager, 'NotAuthorizedAdmin')
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

        await expect(defiManager.setUniswapRouter(ethers.ZeroAddress))
          .to.be.revertedWithCustomError(defiManager, 'DefiError')
          .withArgs(ERR_INVALID_ADDRESS, ethers.ZeroAddress, 0)

        expect(await defiManager.uniswapRouter()).to.equal(
          mockUniswapRouterBefore
        )
      })
    })

    describe('setUniswapQuoter()', function () {
      it('Should allow owner to set the Uniswap Quoter', async function () {
        const { defiManager } = await loadFixture(deployDefiManagerFixture)

        const mockUniswapQuoterBefore = await defiManager.uniswapQuoter()

        const mockUniswapQuoter = await ethers.deployContract(
          'MockUniswapQuoter'
        )
        await mockUniswapQuoter.waitForDeployment()

        const mockUniswapQuoterAfter = await mockUniswapQuoter.getAddress()

        await expect(defiManager.setUniswapQuoter(mockUniswapQuoterAfter))
          .to.emit(defiManager, 'ConfigUpdated')
          .withArgs(5, mockUniswapQuoterBefore, mockUniswapQuoterAfter)

        expect(await defiManager.uniswapQuoter()).to.equal(
          mockUniswapQuoterAfter
        )
      })

      it('Should allow otheradmin to set the Uniswap Quoter', async function () {
        const { defiManager, otherAdmin } = await loadFixture(
          deployDefiManagerFixture
        )

        const mockUniswapQuoterBefore = await defiManager.uniswapQuoter()

        const mockUniswapQuoter = await ethers.deployContract(
          'MockUniswapQuoter'
        )
        await mockUniswapQuoter.waitForDeployment()

        const mockUniswapQuoterAfter = await mockUniswapQuoter.getAddress()

        await expect(
          defiManager
            .connect(otherAdmin)
            .setUniswapQuoter(mockUniswapQuoterAfter)
        )
          .to.emit(defiManager, 'ConfigUpdated')
          .withArgs(5, mockUniswapQuoterBefore, mockUniswapQuoterAfter)

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
          .to.be.revertedWithCustomError(defiManager, 'NotAuthorizedAdmin')
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

        await expect(defiManager.setUniswapQuoter(ethers.ZeroAddress))
          .to.be.revertedWithCustomError(defiManager, 'DefiError')
          .withArgs(ERR_INVALID_ADDRESS, ethers.ZeroAddress, 0)

        expect(await defiManager.uniswapQuoter()).to.equal(
          mockUniswapQuoterrBefore
        )
      })
    })
  })
})
