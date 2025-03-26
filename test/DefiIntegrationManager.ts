import { token } from '../typechain-types/@openzeppelin/contracts'

const { expect } = require('chai')
const { ethers, network } = require('hardhat')
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers')

import { deployPlatformFixture } from './fixture'

describe('DefiIntegrationManager', function () {
  const OP_DEPOSITED = 1
  const OP_WITHDRAWN = 2
  const OP_CONFIG_UPDATED = 3

  // Error codes
  const ERR_ZERO_AMOUNT = 1
  const ERR_TOKEN_NOT_SUPPORTED = 2
  const ERR_DEPOSIT_FAILED = 3
  const ERR_WITHDRAWAL_FAILED = 4
  const ERR_INVALID_ADDRESS = 5
  const ERR_INVALID_CONSTRUCTOR = 6
  const ERR_WITHDRAWAL_DOESNT_BALANCE = 7
  describe('Deployment', function () {
    it('Should correctly deploy the defimanager', async function () {
      const {
        aavePool,
        tokenRegistry,
        feeManager,
        platformAdmin,
        deployer,
        defiIntegrationManager
      } = await loadFixture(deployPlatformFixture)

      expect(await defiIntegrationManager.getAddress()).to.be.properAddress

      expect(await defiIntegrationManager.aavePool()).to.equal(
        ethers.getAddress(await aavePool.getAddress())
      )

      expect(await defiIntegrationManager.tokenRegistry()).to.equal(
        await tokenRegistry.getAddress()
      )

      expect(await defiIntegrationManager.platformAdmin()).to.equal(
        await platformAdmin.getAddress()
      )
      expect(await defiIntegrationManager.feeManager()).to.equal(
        await feeManager.getAddress()
      )

      expect(await defiIntegrationManager.owner()).to.equal(deployer.address)
    })

    it('Should revert on any incorrect constructor inputs', async function () {
      const {
        aavePool, //Base mainnet address
        deployer,
        tokenRegistry,
        feeManager,
        platformAdmin
      } = await loadFixture(deployPlatformFixture)

      const aavePoolAddress = await aavePool.getAddress()
      const tokenRegistryAddress = await tokenRegistry.getAddress()
      const feeManagerAddress = await feeManager.getAddress()
      const platformAdminAddress = await platformAdmin.getAddress()

      const DefiManager = await ethers.getContractFactory(
        'DefiIntegrationManager'
      )

      await expect(
        DefiManager.deploy(
          ethers.ZeroAddress,
          tokenRegistryAddress,
          feeManagerAddress,
          platformAdminAddress,
          deployer.address
        )
      )
        .to.be.revertedWithCustomError(DefiManager, 'DefiError')
        .withArgs(ERR_INVALID_CONSTRUCTOR, ethers.ZeroAddress)

      await expect(
        DefiManager.deploy(
          aavePoolAddress,
          ethers.ZeroAddress,
          feeManagerAddress,
          platformAdminAddress,
          deployer.address
        )
      )
        .to.be.revertedWithCustomError(DefiManager, 'DefiError')
        .withArgs(ERR_INVALID_CONSTRUCTOR, ethers.ZeroAddress)

      await expect(
        DefiManager.deploy(
          aavePoolAddress,
          tokenRegistryAddress,
          ethers.ZeroAddress,
          platformAdminAddress,
          deployer.address
        )
      )
        .to.be.revertedWithCustomError(DefiManager, 'DefiError')
        .withArgs(ERR_INVALID_CONSTRUCTOR, ethers.ZeroAddress)

      // Test zero address for platformAdmin
      await expect(
        DefiManager.deploy(
          aavePoolAddress,
          tokenRegistryAddress,
          feeManagerAddress,
          ethers.ZeroAddress,
          deployer.address
        )
      )
        .to.be.revertedWithCustomError(DefiManager, 'DefiError')
        .withArgs(ERR_INVALID_CONSTRUCTOR, ethers.ZeroAddress)
    })
  })

  describe('AAVE Integration', function () {
    describe('Depositing to yield protocol', function () {
      it('Should successfully deposit tokens to the yield protocol directly', async function () {
        const { defiIntegrationManager, usdc, contributor1, IERC20ABI } =
          await loadFixture(deployPlatformFixture)

        // Get USDC details
        const usdcDecimals = await usdc.decimals()
        const depositAmount = ethers.parseUnits('100', usdcDecimals)
        const usdcAddress = await usdc.getAddress()

        // First, the contributor needs to approve the DefiIntegrationManager to spend their USDC
        await usdc
          .connect(contributor1)
          .approve(await defiIntegrationManager.getAddress(), depositAmount)

        // Get initial balances to verify changes
        const initialContributorBalance = await usdc.balanceOf(
          contributor1.address
        )
        const initialManagerBalance = await usdc.balanceOf(
          await defiIntegrationManager.getAddress()
        )

        // Get aToken address to check balances after
        const aTokenAddress = await defiIntegrationManager.getATokenAddress(
          usdcAddress
        )
        const aToken = await ethers.getContractAt(IERC20ABI, aTokenAddress)
        const initialATokenBalance = await aToken.balanceOf(
          contributor1.address
        )

        // Execute the deposit directly through the DefiIntegrationManager
        const depositTx = await defiIntegrationManager
          .connect(contributor1)
          .depositToYieldProtocol(usdcAddress, depositAmount)

        const receipt = await depositTx.wait()

        // Check for the DefiOperation event
        const defiEvent = receipt.logs.find((log: any) => {
          try {
            const parsed = defiIntegrationManager.interface.parseLog(log)
            return parsed && parsed.name === 'DefiOperation'
          } catch {
            return false
          }
        })

        expect(defiEvent).to.not.be.undefined

        const parsedEvent = defiIntegrationManager.interface.parseLog(defiEvent)

        // Verify event parameters
        expect(parsedEvent.args.opType).to.equal(OP_DEPOSITED) // OP_DEPOSITED
        expect(parsedEvent.args.sender).to.equal(contributor1.address)
        expect(parsedEvent.args.token).to.equal(ethers.getAddress(usdcAddress))
        expect(parsedEvent.args.amount).to.equal(depositAmount)

        // Verify USDC was transferred from contributor to the manager
        const finalContributorBalance = await usdc.balanceOf(
          contributor1.address
        )
        expect(initialContributorBalance - finalContributorBalance).to.equal(
          depositAmount
        )

        // Verify aToken balance increase for the user (Aave sends aTokens to the msg.sender per your implementation)
        const finalATokenBalance = await aToken.balanceOf(contributor1.address)
        expect(finalATokenBalance - initialATokenBalance).to.be.closeTo(
          depositAmount,
          10
        )

        // Verify the manager's internal accounting
        expect(
          await defiIntegrationManager.aaveBalances(
            usdcAddress,
            contributor1.address
          )
        ).to.equal(depositAmount)
      })

      it('Should revert when trying to deposit zero amount', async function () {
        const { defiIntegrationManager, usdc, contributor1 } =
          await loadFixture(deployPlatformFixture)

        const usdcAddress = await usdc.getAddress()
        const zeroAmount = ethers.parseUnits('0', await usdc.decimals())

        // Try to deposit zero amount
        await expect(
          defiIntegrationManager
            .connect(contributor1)
            .depositToYieldProtocol(usdcAddress, zeroAmount)
        )
          .to.be.revertedWithCustomError(defiIntegrationManager, 'DefiError')
          .withArgs(ERR_ZERO_AMOUNT, ethers.getAddress(usdcAddress))

        expect(
          await defiIntegrationManager.aaveBalances(
            usdcAddress,
            contributor1.address
          )
        ).to.equal(0)
      })

      it('Should revert when trying to deposit an unsupported token', async function () {
        const { defiIntegrationManager, contributor1, wbtc } =
          await loadFixture(deployPlatformFixture)

        // Create a mock unsupported token address
        const wbtcAddress = await wbtc.getAddress()
        const wbtcDecimals = await wbtc.decimals()

        const amount = ethers.parseUnits('100', wbtcDecimals)

        // Try to deposit unsupported token
        await expect(
          defiIntegrationManager
            .connect(contributor1)
            .depositToYieldProtocol(wbtcAddress, amount)
        )
          .to.be.revertedWithCustomError(defiIntegrationManager, 'DefiError')
          .withArgs(ERR_TOKEN_NOT_SUPPORTED, ethers.getAddress(wbtcAddress))
      })

      it('Should revert when Aave supply fails', async function () {})

      it('Should correctly add to existing deposits for multiple deposits', async function () {
        const { defiIntegrationManager, usdc, contributor1, IERC20ABI } =
          await loadFixture(deployPlatformFixture)

        // Get USDC details
        const usdcDecimals = await usdc.decimals()
        const firstDepositAmount = ethers.parseUnits('100', usdcDecimals)
        const secondDepositAmount = ethers.parseUnits('50', usdcDecimals)
        const totalDepositAmount = firstDepositAmount + secondDepositAmount
        const usdcAddress = await usdc.getAddress()

        // Approve the DefiIntegrationManager to spend USDC
        await usdc
          .connect(contributor1)
          .approve(
            await defiIntegrationManager.getAddress(),
            totalDepositAmount
          )

        // Get aToken address to check balances
        const aTokenAddress = await defiIntegrationManager.getATokenAddress(
          usdcAddress
        )
        const aToken = await ethers.getContractAt(IERC20ABI, aTokenAddress)
        const initialATokenBalance = await aToken.balanceOf(
          contributor1.address
        )

        // First deposit
        const firstDepositTx = await defiIntegrationManager
          .connect(contributor1)
          .depositToYieldProtocol(usdcAddress, firstDepositAmount)

        const firstReceipt = await firstDepositTx.wait()

        // Check for first DefiOperation event
        const firstDefiEvent = firstReceipt.logs.find((log: any) => {
          try {
            const parsed = defiIntegrationManager.interface.parseLog(log)
            return parsed && parsed.name === 'DefiOperation'
          } catch {
            return false
          }
        })

        expect(firstDefiEvent).to.not.be.undefined

        const firstParsedEvent =
          defiIntegrationManager.interface.parseLog(firstDefiEvent)

        // Verify first event parameters
        expect(firstParsedEvent.args.opType).to.equal(OP_DEPOSITED)
        expect(firstParsedEvent.args.sender).to.equal(contributor1.address)
        expect(firstParsedEvent.args.token).to.equal(
          ethers.getAddress(usdcAddress)
        )
        expect(firstParsedEvent.args.amount).to.equal(firstDepositAmount)

        // Check balance after first deposit
        const firstDepositBalance = await defiIntegrationManager.aaveBalances(
          usdcAddress,
          contributor1.address
        )
        expect(firstDepositBalance).to.equal(firstDepositAmount)

        // Second deposit
        const secondDepositTx = await defiIntegrationManager
          .connect(contributor1)
          .depositToYieldProtocol(usdcAddress, secondDepositAmount)

        const secondReceipt = await secondDepositTx.wait()

        // Check for second DefiOperation event
        const secondDefiEvent = secondReceipt.logs.find((log: any) => {
          try {
            const parsed = defiIntegrationManager.interface.parseLog(log)
            return parsed && parsed.name === 'DefiOperation'
          } catch {
            return false
          }
        })

        expect(secondDefiEvent).to.not.be.undefined

        const secondParsedEvent =
          defiIntegrationManager.interface.parseLog(secondDefiEvent)

        // Verify second event parameters
        expect(secondParsedEvent.args.opType).to.equal(OP_DEPOSITED)
        expect(secondParsedEvent.args.sender).to.equal(contributor1.address)
        expect(secondParsedEvent.args.token).to.equal(
          ethers.getAddress(usdcAddress)
        )
        expect(secondParsedEvent.args.amount).to.equal(secondDepositAmount)

        // Verify the balance has increased correctly
        const finalDepositBalance = await defiIntegrationManager.aaveBalances(
          usdcAddress,
          contributor1.address
        )
        expect(finalDepositBalance).to.equal(totalDepositAmount)

        // Verify aToken balance increase
        const finalATokenBalance = await aToken.balanceOf(contributor1.address)
        expect(finalATokenBalance - initialATokenBalance).to.be.closeTo(
          totalDepositAmount,
          ethers.parseUnits('1', usdcDecimals) // Allow for small rounding differences
        )
      })

      it('Should revert when Aave pool supply fails', async function () {
        const { defiIntegrationManager, usdc, contributor1 } =
          await loadFixture(deployPlatformFixture)

        const usdcAddress = await usdc.getAddress()
        const usdcDecimals = await usdc.decimals()
        const depositAmount = ethers.parseUnits('100', usdcDecimals)

        // Deploy mock aToken and mock Aave pool
        const mockAToken = await ethers.deployContract('MockAToken', [
          'aMock Token 1',
          'aMT1',
          usdcAddress
        ])
        await mockAToken.waitForDeployment()
        const mockATokenAddress = await mockAToken.getAddress()

        const mockAavePool = await ethers.deployContract('MockAavePool', [
          mockATokenAddress
        ])
        await mockAavePool.waitForDeployment()
        const mockAavePoolAddress = await mockAavePool.getAddress()

        // Configure the mock pool
        await mockAavePool.setAToken(usdcAddress, mockATokenAddress)
        await mockAavePool.setShouldFailSupply(true) // Make supply operation fail

        // Set the mock pool in the defi manager
        await defiIntegrationManager.setAavePool(mockAavePoolAddress)

        // Approve
        await usdc
          .connect(contributor1)
          .approve(await defiIntegrationManager.getAddress(), depositAmount)

        // Attempt to deposit - should revert with the deposit failed error
        await expect(
          defiIntegrationManager
            .connect(contributor1)
            .depositToYieldProtocol(usdcAddress, depositAmount)
        )
          .to.be.revertedWithCustomError(defiIntegrationManager, 'DefiError')
          .withArgs(ERR_DEPOSIT_FAILED, ethers.getAddress(usdcAddress))
      })

      it('Should revert when trying to deposit zero amount', async function () {
        const { defiIntegrationManager, usdc, contributor1 } =
          await loadFixture(deployPlatformFixture)

        const usdcAddress = await usdc.getAddress()
        const zeroAmount = 0

        // Attempt to deposit zero amount - should revert
        await expect(
          defiIntegrationManager
            .connect(contributor1)
            .depositToYieldProtocol(usdcAddress, zeroAmount)
        )
          .to.be.revertedWithCustomError(defiIntegrationManager, 'DefiError')
          .withArgs(ERR_ZERO_AMOUNT, ethers.getAddress(usdcAddress))
      })

      it('Should revert when trying to deposit an unsupported token', async function () {
        const { defiIntegrationManager, contributor1 } = await loadFixture(
          deployPlatformFixture
        )

        // Deploy a new token not registered in the system
        const mockUnsupportedToken = await ethers.deployContract('MockERC20', [
          'Unsupported Token',
          'UNSUPP',
          18
        ])
        await mockUnsupportedToken.waitForDeployment()
        const unsupportedTokenAddress = await mockUnsupportedToken.getAddress()

        const depositAmount = ethers.parseUnits('100', 18)

        // Mint some tokens to the user
        await mockUnsupportedToken.mint(contributor1.address, depositAmount)

        // Approve
        await mockUnsupportedToken
          .connect(contributor1)
          .approve(await defiIntegrationManager.getAddress(), depositAmount)

        // Attempt to deposit unsupported token - should revert
        await expect(
          defiIntegrationManager
            .connect(contributor1)
            .depositToYieldProtocol(unsupportedTokenAddress, depositAmount)
        )
          .to.be.revertedWithCustomError(defiIntegrationManager, 'DefiError')
          .withArgs(
            ERR_TOKEN_NOT_SUPPORTED,
            ethers.getAddress(unsupportedTokenAddress)
          )
      })

      it('Should revert when aToken address is zero for supported token', async function () {
        const { defiIntegrationManager, tokenRegistry, contributor1 } =
          await loadFixture(deployPlatformFixture)

        // Deploy a new token and add it to registry but don't set its aToken
        const mockSupportedToken = await ethers.deployContract('MockERC20', [
          'Supported Token',
          'SUPP',
          18
        ])
        await mockSupportedToken.waitForDeployment()
        const supportedTokenAddress = await mockSupportedToken.getAddress()

        await tokenRegistry.addToken(supportedTokenAddress, 1)

        const depositAmount = ethers.parseUnits('100', 18)

        // Mint some tokens to the user
        await mockSupportedToken.mint(contributor1.address, depositAmount)

        // Approve
        await mockSupportedToken
          .connect(contributor1)
          .approve(await defiIntegrationManager.getAddress(), depositAmount)

        // Attempt to deposit token with no aToken - should revert
        await expect(
          defiIntegrationManager
            .connect(contributor1)
            .depositToYieldProtocol(supportedTokenAddress, depositAmount)
        )
          .to.be.revertedWithCustomError(defiIntegrationManager, 'DefiError')
          .withArgs(ERR_INVALID_ADDRESS, ethers.ZeroAddress)
      })
    })

    describe('Withdrawing from yield protocol', function () {
      it('Should successfully withdraw tokens from the yield protocol (simulated campaign success)', async function () {
        const {
          defiIntegrationManager,
          usdc,
          contributor1,
          feeManager,
          IERC20ABI
        } = await loadFixture(deployPlatformFixture)

        // Get USDC details
        const usdcDecimals = await usdc.decimals()
        const depositAmount = ethers.parseUnits('100', usdcDecimals)
        const usdcAddress = await usdc.getAddress()

        // Get platform treasury address
        const platformTreasury = await feeManager.platformTreasury()

        // Get aToken details
        const aTokenAddress = await defiIntegrationManager.getATokenAddress(
          usdcAddress
        )
        const aToken = await ethers.getContractAt(IERC20ABI, aTokenAddress)

        // Approve and deposit first
        await usdc
          .connect(contributor1)
          .approve(await defiIntegrationManager.getAddress(), depositAmount)

        await defiIntegrationManager
          .connect(contributor1)
          .depositToYieldProtocol(usdcAddress, depositAmount)

        // Record balances before withdrawal
        const initialContributorBalance = await usdc.balanceOf(
          contributor1.address
        )
        const initialTreasuryBalance = await usdc.balanceOf(platformTreasury)

        // Time travel to generate some yield
        await network.provider.send('evm_increaseTime', [60 * 60 * 24 * 61]) // 61 days
        await network.provider.send('evm_mine')

        // IMPORTANT: Since aTokens are held by contributor1, we need to transfer them to the DefiManager first
        const contributorATokenBalance = await aToken.balanceOf(
          contributor1.address
        )

        // Transfer aTokens to DefiManager (simulating what Campaign contract would do)
        await aToken
          .connect(contributor1)
          .transfer(
            await defiIntegrationManager.getAddress(),
            contributorATokenBalance
          )

        // Calculate expected shares
        const { creatorShare, platformShare } =
          await feeManager.calculateFeeShares(contributorATokenBalance)

        // Now withdraw (using true for successful campaign)
        await expect(
          defiIntegrationManager
            .connect(contributor1)
            .withdrawFromYieldProtocol(usdcAddress, true, depositAmount)
        )
          .to.emit(defiIntegrationManager, 'DefiOperation')
          .withArgs(
            OP_WITHDRAWN,
            contributor1.address,
            ethers.getAddress(usdcAddress),
            ethers.ZeroAddress,
            contributorATokenBalance,
            0
          )

        // Verify final balances
        const finalContributorBalance = await usdc.balanceOf(
          contributor1.address
        )
        const finalTreasuryBalance = await usdc.balanceOf(platformTreasury)

        // Use BigNumber operations for safety
        expect(finalContributorBalance).to.equal(
          initialContributorBalance + creatorShare
        )

        expect(finalTreasuryBalance).to.equal(
          initialTreasuryBalance + platformShare
        )

        // Final aToken balance should be zero
        expect(await aToken.balanceOf(contributor1.address)).to.be.closeTo(
          ethers.parseUnits('0', await usdc.decimals()),
          ethers.parseUnits('0.001', await usdc.decimals()) // Small tolerance
        )
        expect(
          await aToken.balanceOf(await defiIntegrationManager.getAddress())
        ).to.be.closeTo(
          ethers.parseUnits('0', await usdc.decimals()),
          ethers.parseUnits('0.001', await usdc.decimals()) // Small tolerance
        )

        // Internal accounting should be cleared
        expect(
          await defiIntegrationManager.aaveBalances(
            usdcAddress,
            contributor1.address
          )
        ).to.equal(0)
      })

      it('Should successfully withdraw tokens from the yield protocol (simulated campaign failure)', async function () {
        const {
          defiIntegrationManager,
          usdc,
          contributor1,
          feeManager,
          IERC20ABI
        } = await loadFixture(deployPlatformFixture)

        // Get USDC details
        const usdcDecimals = await usdc.decimals()
        const depositAmount = ethers.parseUnits('100', usdcDecimals)
        const usdcAddress = await usdc.getAddress()

        // Get platform treasury address
        const platformTreasury = await feeManager.platformTreasury()

        // Get aToken details
        const aTokenAddress = await defiIntegrationManager.getATokenAddress(
          usdcAddress
        )
        const aToken = await ethers.getContractAt(IERC20ABI, aTokenAddress)

        // Approve and deposit first
        await usdc
          .connect(contributor1)
          .approve(await defiIntegrationManager.getAddress(), depositAmount)

        await defiIntegrationManager
          .connect(contributor1)
          .depositToYieldProtocol(usdcAddress, depositAmount)

        // Record balances before withdrawal
        const initialContributorBalance = await usdc.balanceOf(
          contributor1.address
        )
        const initialTreasuryBalance = await usdc.balanceOf(platformTreasury)

        // Time travel to generate some yield
        await network.provider.send('evm_increaseTime', [60 * 60 * 24 * 61]) // 61 days
        await network.provider.send('evm_mine')

        // IMPORTANT: Since aTokens are held by contributor1, we need to transfer them to the DefiManager first
        const contributorATokenBalance = await aToken.balanceOf(
          contributor1.address
        )

        // Transfer aTokens to DefiManager (simulating what Campaign contract would do)
        await aToken
          .connect(contributor1)
          .transfer(
            await defiIntegrationManager.getAddress(),
            contributorATokenBalance
          )

        const creatorShare = await defiIntegrationManager.aaveBalances(
          usdcAddress,
          contributor1.address
        )

        const platformShare = (await contributorATokenBalance) - creatorShare

        // Now withdraw (using true for successful campaign)
        await expect(
          defiIntegrationManager
            .connect(contributor1)
            .withdrawFromYieldProtocol(usdcAddress, false, creatorShare)
        )
          .to.emit(defiIntegrationManager, 'DefiOperation')
          .withArgs(
            OP_WITHDRAWN,
            contributor1.address,
            ethers.getAddress(usdcAddress),
            ethers.ZeroAddress,
            contributorATokenBalance,
            0
          )

        // Verify final balances
        const finalContributorBalance = await usdc.balanceOf(
          contributor1.address
        )
        const finalTreasuryBalance = await usdc.balanceOf(platformTreasury)

        // Use BigNumber operations for safety
        expect(finalContributorBalance).to.equal(
          initialContributorBalance + creatorShare
        )

        expect(finalTreasuryBalance).to.equal(
          initialTreasuryBalance + platformShare
        )

        // Final aToken balance should be zero
        expect(await aToken.balanceOf(contributor1.address)).to.be.closeTo(
          ethers.parseUnits('0', await usdc.decimals()),
          ethers.parseUnits('0.001', await usdc.decimals()) // Small tolerance
        )
        expect(
          await aToken.balanceOf(await defiIntegrationManager.getAddress())
        ).to.be.closeTo(
          ethers.parseUnits('0', await usdc.decimals()),
          ethers.parseUnits('0.001', await usdc.decimals()) // Small tolerance
        )

        // Internal accounting should be cleared
        expect(
          await defiIntegrationManager.aaveBalances(
            usdcAddress,
            contributor1.address
          )
        ).to.equal(0)
      })

      it('Should revert when trying to withdraw with insufficient aToken balance', async function () {
        const { defiIntegrationManager, usdc, IERC20ABI, contributor1 } =
          await loadFixture(deployPlatformFixture)

        const usdcAddress = await usdc.getAddress()
        const usdcDecimals = await usdc.decimals()

        const depositAmount = ethers.parseUnits('100', usdcDecimals)

        const aTokenAddress = await defiIntegrationManager.getATokenAddress(
          usdcAddress
        )
        const aToken = await ethers.getContractAt(IERC20ABI, aTokenAddress)

        // Approve and deposit first
        await usdc
          .connect(contributor1)
          .approve(await defiIntegrationManager.getAddress(), depositAmount)

        await defiIntegrationManager
          .connect(contributor1)
          .depositToYieldProtocol(usdcAddress, depositAmount)

        const contributorATokenBalance = await aToken.balanceOf(
          contributor1.address
        )

        await expect(
          defiIntegrationManager
            .connect(contributor1)
            .withdrawFromYieldProtocol(usdcAddress, true, 0)
        )
          .to.be.revertedWithCustomError(defiIntegrationManager, 'DefiError')
          .withArgs(ERR_WITHDRAWAL_FAILED, ethers.getAddress(usdcAddress))

        const depositBalance = await defiIntegrationManager.aaveBalances(
          usdcAddress,
          contributor1.address
        )

        expect(depositBalance).to.equal(depositAmount)
      })

      it('Should revert when withdraw amount does not match expected amount', async function () {
        const { defiIntegrationManager, usdc, contributor1 } =
          await loadFixture(deployPlatformFixture)

        const usdcAddress = await usdc.getAddress()
        const usdcDecimals = await usdc.decimals()
        const depositAmount = ethers.parseUnits('100', usdcDecimals)

        // Deploy mock aToken
        const mockAToken = await ethers.deployContract('MockAToken', [
          'aMock Token 1',
          'aMT1',
          usdcAddress
        ])
        await mockAToken.waitForDeployment()
        const mockATokenAddress = await mockAToken.getAddress()

        // Deploy mock Aave pool
        const mockAavePool = await ethers.deployContract('MockAavePool', [
          mockATokenAddress
        ])
        await mockAavePool.waitForDeployment()
        const mockAavePoolAddress = await mockAavePool.getAddress()

        // Configure the mock pool
        await mockAavePool.setAToken(usdcAddress, mockATokenAddress)

        // Set the mock pool in the defi manager
        await defiIntegrationManager.setAavePool(mockAavePoolAddress)

        // Approve and deposit
        await usdc
          .connect(contributor1)
          .approve(await defiIntegrationManager.getAddress(), depositAmount)

        await defiIntegrationManager
          .connect(contributor1)
          .depositToYieldProtocol(usdcAddress, depositAmount)

        // Configure mock aToken to have a balance for the defi manager
        await mockAToken.mint(
          await defiIntegrationManager.getAddress(),
          depositAmount
        )

        // Configure mock pool to return a mismatched withdraw amount (e.g., 90% of deposit)
        const mismatchAmount = (depositAmount * 90n) / 100n
        await mockAavePool.setMismatchWithdraw(true, mismatchAmount)

        // Now try to withdraw - should revert with the withdrawal balance error
        await expect(
          defiIntegrationManager
            .connect(contributor1)
            .withdrawFromYieldProtocol(usdcAddress, true, 0)
        )
          .to.be.revertedWithCustomError(defiIntegrationManager, 'DefiError')
          .withArgs(
            ERR_WITHDRAWAL_DOESNT_BALANCE,
            ethers.getAddress(usdcAddress)
          )
      })

      it('Should revert when Aave pool withdraw fails completely', async function () {
        const { defiIntegrationManager, usdc, contributor1 } =
          await loadFixture(deployPlatformFixture)

        const usdcAddress = await usdc.getAddress()
        const usdcDecimals = await usdc.decimals()
        const depositAmount = ethers.parseUnits('100', usdcDecimals)

        // Deploy mock aToken and mock Aave pool
        const mockAToken = await ethers.deployContract('MockAToken', [
          'aMock Token 1',
          'aMT1',
          usdcAddress
        ])
        await mockAToken.waitForDeployment()
        const mockATokenAddress = await mockAToken.getAddress()

        const mockAavePool = await ethers.deployContract('MockAavePool', [
          mockATokenAddress
        ])
        await mockAavePool.waitForDeployment()
        const mockAavePoolAddress = await mockAavePool.getAddress()

        // Configure the mock pool
        await mockAavePool.setAToken(usdcAddress, mockATokenAddress)
        await mockAavePool.setShouldFailWithdraw(true)

        // Set the mock pool in the defi manager
        await defiIntegrationManager.setAavePool(mockAavePoolAddress)

        // Approve and deposit
        await usdc
          .connect(contributor1)
          .approve(await defiIntegrationManager.getAddress(), depositAmount)

        await defiIntegrationManager
          .connect(contributor1)
          .depositToYieldProtocol(usdcAddress, depositAmount)

        // Configure mock aToken to have a balance for the defi manager
        await mockAToken.mint(
          await defiIntegrationManager.getAddress(),
          depositAmount
        )

        // Now try to withdraw - should revert with the withdrawal failed error
        await expect(
          defiIntegrationManager
            .connect(contributor1)
            .withdrawFromYieldProtocol(usdcAddress, true, 0)
        )
          .to.be.revertedWithCustomError(defiIntegrationManager, 'DefiError')
          .withArgs(ERR_WITHDRAWAL_FAILED, ethers.getAddress(usdcAddress))
      })

      it('Should handle zero aToken balance withdrawal attempt', async function () {
        const { defiIntegrationManager, usdc, contributor1 } =
          await loadFixture(deployPlatformFixture)

        const usdcAddress = await usdc.getAddress()

        // Deploy mock aToken and mock Aave pool
        const mockAToken = await ethers.deployContract('MockAToken', [
          'aMock Token 1',
          'aMT1',
          usdcAddress
        ])
        await mockAToken.waitForDeployment()
        const mockATokenAddress = await mockAToken.getAddress()

        const mockAavePool = await ethers.deployContract('MockAavePool', [
          mockATokenAddress
        ])
        await mockAavePool.waitForDeployment()
        const mockAavePoolAddress = await mockAavePool.getAddress()

        // Configure the mock pool
        await mockAavePool.setAToken(usdcAddress, mockATokenAddress)

        // Set the mock pool in the defi manager
        await defiIntegrationManager.setAavePool(mockAavePoolAddress)

        // Try to withdraw with zero balance (no prior deposit)
        await expect(
          defiIntegrationManager
            .connect(contributor1)
            .withdrawFromYieldProtocol(usdcAddress, true, 0)
        )
          .to.be.revertedWithCustomError(defiIntegrationManager, 'DefiError')
          .withArgs(ERR_WITHDRAWAL_FAILED, ethers.getAddress(usdcAddress))
      })

      it('Should handle coverRefunds greater than withdrawn amount', async function () {
        const { defiIntegrationManager, usdc, contributor1 } =
          await loadFixture(deployPlatformFixture)

        const usdcAddress = await usdc.getAddress()
        const usdcDecimals = await usdc.decimals()
        const depositAmount = ethers.parseUnits('100', usdcDecimals)

        // Deploy mock aToken and mock Aave pool
        const mockAToken = await ethers.deployContract('MockAToken', [
          'aMock Token 1',
          'aMT1',
          usdcAddress
        ])
        await mockAToken.waitForDeployment()
        const mockATokenAddress = await mockAToken.getAddress()

        const mockAavePool = await ethers.deployContract('MockAavePool', [
          mockATokenAddress
        ])
        await mockAavePool.waitForDeployment()
        const mockAavePoolAddress = await mockAavePool.getAddress()

        // Configure the mock pool
        await mockAavePool.setAToken(usdcAddress, mockATokenAddress)

        // Set the mock pool in the defi manager
        await defiIntegrationManager.setAavePool(mockAavePoolAddress)

        // Approve and deposit
        await usdc
          .connect(contributor1)
          .approve(await defiIntegrationManager.getAddress(), depositAmount)

        await defiIntegrationManager
          .connect(contributor1)
          .depositToYieldProtocol(usdcAddress, depositAmount)

        // Configure mock aToken to have a balance for the defi manager
        await mockAToken.mint(
          await defiIntegrationManager.getAddress(),
          depositAmount
        )

        // Try to withdraw with coverRefunds greater than the withdrawn amount
        // Campaign failed scenario with excessive coverRefunds
        const excessiveRefunds = depositAmount * 2n

        // This should revert with arithmetic underflow in the "remaining = withdrawn - coverRefunds" calculation
        await expect(
          defiIntegrationManager
            .connect(contributor1)
            .withdrawFromYieldProtocol(usdcAddress, false, excessiveRefunds)
        ).to.be.reverted // Should revert with arithmetic underflow
      })
    })
  })

  describe('Getter functions', function () {
    it('Should return the correct aToken address for a supported token', async function () {
      const { defiIntegrationManager, usdc } = await loadFixture(
        deployPlatformFixture
      )

      const usdcAddress = await usdc.getAddress()

      // Get aToken address from the contract
      const aTokenAddress = await defiIntegrationManager.getATokenAddress(
        usdcAddress
      )

      // It should return a non-zero address for a supported token
      expect(aTokenAddress).to.not.equal(ethers.ZeroAddress)

      // Verify this is actually the correct aToken by checking with Aave directly
      // This assumes your deployPlatformFixture is using the real Aave pool or a correctly configured mock
      const aavePool = await ethers.getContractAt(
        'IAavePool',
        await defiIntegrationManager.aavePool()
      )

      const reserveData = await aavePool.getReserveData(usdcAddress)
      expect(aTokenAddress).to.equal(reserveData.aTokenAddress)
    })

    it('Should return zero address when getReserveData fails', async function () {
      const { defiIntegrationManager } = await loadFixture(
        deployPlatformFixture
      )

      // Deploy mock aToken and mock Aave pool
      const mockAToken = await ethers.deployContract('MockAToken', [
        'aMock Token',
        'aMT',
        ethers.ZeroAddress
      ])
      await mockAToken.waitForDeployment()
      const mockATokenAddress = await mockAToken.getAddress()

      const mockAavePool = await ethers.deployContract('MockAavePool', [
        mockATokenAddress
      ])
      await mockAavePool.waitForDeployment()

      // Configure mock to fail getReserveData
      await mockAavePool.setShouldFailGetReserveData(true)

      // Set the mock pool in the defi manager
      await defiIntegrationManager.setAavePool(await mockAavePool.getAddress())

      // Try to get aToken for a token - should return zero address
      const randomTokenAddress = ethers.Wallet.createRandom().address
      const aTokenAddress = await defiIntegrationManager.getATokenAddress(
        randomTokenAddress
      )

      expect(aTokenAddress).to.equal(ethers.ZeroAddress)
    })

    it('Should return zero address for an unsupported token', async function () {
      const { defiIntegrationManager } = await loadFixture(
        deployPlatformFixture
      )

      // Use a random address as an unsupported token
      const unsupportedToken = ethers.Wallet.createRandom().address

      // Try to get aToken for an unsupported token
      const aTokenAddress = await defiIntegrationManager.getATokenAddress(
        unsupportedToken
      )

      // Should return zero address
      expect(aTokenAddress).to.equal(ethers.ZeroAddress)
    })

    it('Should return the correct yield rate for a supported token', async function () {
      const { defiIntegrationManager, usdc, AAVE_POOL_ABI } = await loadFixture(
        deployPlatformFixture
      )

      const usdcAddress = await usdc.getAddress()

      // Get yield rate from the contract
      const yieldRate = await defiIntegrationManager.getCurrentYieldRate(
        usdcAddress
      )

      // It should return a non-zero value for a supported token
      expect(yieldRate).to.be.gt(0)

      // Verify this is the correct rate by checking with Aave directly
      const aavePool = await ethers.getContractAt(
        'IAavePool',
        await defiIntegrationManager.aavePool()
      )

      const reserveData = await aavePool.getReserveData(usdcAddress)
      const expectedRate =
        (reserveData.currentLiquidityRate * 10000n) / BigInt(1e27)
      expect(yieldRate).to.equal(expectedRate)
    })

    it('Should return zero when getReserveData fails', async function () {
      const { defiIntegrationManager } = await loadFixture(
        deployPlatformFixture
      )

      // Deploy mock aToken and mock Aave pool
      const mockAToken = await ethers.deployContract('MockAToken', [
        'aMock Token',
        'aMT',
        ethers.ZeroAddress
      ])
      await mockAToken.waitForDeployment()
      const mockATokenAddress = await mockAToken.getAddress()

      const mockAavePool = await ethers.deployContract('MockAavePool', [
        mockATokenAddress
      ])
      await mockAavePool.waitForDeployment()

      // Configure mock to fail getReserveData
      await mockAavePool.setShouldFailGetReserveData(true)

      // Set the mock pool in the defi manager
      await defiIntegrationManager.setAavePool(await mockAavePool.getAddress())

      // Try to get yield rate for a token - should return zero
      const randomTokenAddress = ethers.Wallet.createRandom().address
      const yieldRate = await defiIntegrationManager.getCurrentYieldRate(
        randomTokenAddress
      )

      expect(yieldRate).to.equal(0)
    })

    it('Should return zero for an unsupported token', async function () {
      const { defiIntegrationManager } = await loadFixture(
        deployPlatformFixture
      )

      // Use a random address as an unsupported token
      const unsupportedToken = ethers.Wallet.createRandom().address

      // Try to get yield rate for an unsupported token
      const yieldRate = await defiIntegrationManager.getCurrentYieldRate(
        unsupportedToken
      )

      // Should return zero
      expect(yieldRate).to.equal(0)
    })

    it('Should return the correct platform treasury address', async function () {
      const { defiIntegrationManager, feeManager } = await loadFixture(
        deployPlatformFixture
      )

      // Get treasury address from the contract
      const treasuryAddress = await defiIntegrationManager.getPlatformTreasury()

      // Verify it matches the address from yield distributor
      const expectedTreasury = await feeManager.platformTreasury()
      expect(treasuryAddress).to.equal(expectedTreasury)
    })

    it('Should return correct platform treasury after treasury change', async function () {
      const { defiIntegrationManager, feeManager } = await loadFixture(
        deployPlatformFixture
      )

      // Deploy a new mock treasury address
      const newTreasury = ethers.Wallet.createRandom().address

      // Change the treasury address in the yield distributor (assuming it has a setter)
      // Note: You'll need to adjust this to match how your contract allows changing the treasury
      await feeManager.updatePlatformTreasury(newTreasury)

      // Get treasury address from the defi manager
      const treasuryAddress = await defiIntegrationManager.getPlatformTreasury()

      // Should return the new treasury address
      expect(treasuryAddress).to.equal(newTreasury)
    })
  })

  describe('Setter functions', function () {
    describe('setTokenRegistry()', function () {
      it('Should allow owner the token registry', async function () {
        const { defiIntegrationManager, deployer, platformAdmin } =
          await loadFixture(deployPlatformFixture)

        const tokenRegistryBefore = await defiIntegrationManager.tokenRegistry()
        const platformAdminAddress = await platformAdmin.getAddress()

        const tokenRegistryNew = await ethers.deployContract('TokenRegistry', [
          deployer.address,
          platformAdminAddress
        ])
        await tokenRegistryNew.waitForDeployment()
        const tokenRegistryNewAddress = await tokenRegistryNew.getAddress()

        await expect(
          defiIntegrationManager.setTokenRegistry(tokenRegistryNewAddress)
        )
          .to.emit(defiIntegrationManager, 'ConfigUpdated')
          .withArgs(
            OP_CONFIG_UPDATED,
            tokenRegistryBefore,
            tokenRegistryNewAddress
          )

        expect(await defiIntegrationManager.tokenRegistry()).to.equal(
          tokenRegistryNewAddress
        )

        expect(await defiIntegrationManager.tokenRegistry()).to.equal(
          tokenRegistryNewAddress
        )
      })

      it('Should allow otheradmin the token registry', async function () {
        const { defiIntegrationManager, deployer, platformAdmin, otherAdmin } =
          await loadFixture(deployPlatformFixture)

        const tokenRegistryBefore = await defiIntegrationManager.tokenRegistry()
        const platformAdminAddress = await platformAdmin.getAddress()

        await platformAdmin.addPlatformAdmin(otherAdmin.address)

        const tokenRegistryNew = await ethers.deployContract('TokenRegistry', [
          deployer.address,
          platformAdminAddress
        ])
        await tokenRegistryNew.waitForDeployment()
        const tokenRegistryNewAddress = await tokenRegistryNew.getAddress()

        await expect(
          defiIntegrationManager

            .connect(otherAdmin)
            .setTokenRegistry(tokenRegistryNewAddress)
        )
          .to.emit(defiIntegrationManager, 'ConfigUpdated')
          .withArgs(
            OP_CONFIG_UPDATED,
            tokenRegistryBefore,
            tokenRegistryNewAddress
          )

        expect(await defiIntegrationManager.tokenRegistry()).to.equal(
          tokenRegistryNewAddress
        )

        expect(await defiIntegrationManager.tokenRegistry()).to.equal(
          tokenRegistryNewAddress
        )
      })

      it('Should revert if non-owner tries to set token registry', async function () {
        const { defiIntegrationManager, deployer, platformAdmin, creator1 } =
          await loadFixture(deployPlatformFixture)

        const tokenRegistryBefore = await defiIntegrationManager.tokenRegistry()
        const platformAdminAddress = await platformAdmin.getAddress()

        const tokenRegistryNew = await ethers.deployContract('TokenRegistry', [
          deployer.address,
          platformAdminAddress
        ])
        await tokenRegistryNew.waitForDeployment()
        const tokenRegistryNewAddress = await tokenRegistryNew.getAddress()

        await expect(
          defiIntegrationManager
            .connect(creator1)
            .setTokenRegistry(tokenRegistryNewAddress)
        )
          .to.be.revertedWithCustomError(
            defiIntegrationManager,
            'NotAuthorizedAdmin'
          )
          .withArgs(creator1.address)

        expect(await defiIntegrationManager.tokenRegistry()).to.equal(
          tokenRegistryBefore
        )
      })

      it('Should revert if invalid address passed to setTokenRegistry()', async function () {
        const { defiIntegrationManager } = await loadFixture(
          deployPlatformFixture
        )

        const tokenRegistryBefore = await defiIntegrationManager.tokenRegistry()

        await expect(
          defiIntegrationManager.setTokenRegistry(ethers.ZeroAddress)
        )
          .to.be.revertedWithCustomError(defiIntegrationManager, 'DefiError')
          .withArgs(ERR_INVALID_ADDRESS, ethers.ZeroAddress)

        expect(await defiIntegrationManager.tokenRegistry()).to.equal(
          tokenRegistryBefore
        )
      })
    })

    describe('setFeeManager()', function () {
      it('Should allow owner to set the feeManager', async function () {
        const {
          defiIntegrationManager,
          platformTreasury,
          platformAdmin,
          deployer
        } = await loadFixture(deployPlatformFixture)

        const feeManagerBefore = await defiIntegrationManager.feeManager()
        const platformAdminAddress = await platformAdmin.getAddress()

        const feeManagerNew = await ethers.deployContract('FeeManager', [
          platformTreasury.address,
          platformAdminAddress,
          deployer.address
        ])
        await feeManagerNew.waitForDeployment()
        const feeManagerNewAddress = await feeManagerNew.getAddress()

        await expect(defiIntegrationManager.setFeeManager(feeManagerNewAddress))
          .to.emit(defiIntegrationManager, 'ConfigUpdated')
          .withArgs(OP_CONFIG_UPDATED, feeManagerBefore, feeManagerNewAddress)

        expect(await defiIntegrationManager.feeManager()).to.equal(
          feeManagerNewAddress
        )
      })

      it('Should allow otheradmin to set the feeManager', async function () {
        const {
          defiIntegrationManager,
          platformTreasury,
          platformAdmin,
          deployer,
          otherAdmin
        } = await loadFixture(deployPlatformFixture)

        const feeManagerBefore = await defiIntegrationManager.feeManager()
        const platformAdminAddress = await platformAdmin.getAddress()

        await platformAdmin.addPlatformAdmin(otherAdmin.address)

        const feeManagerNew = await ethers.deployContract('FeeManager', [
          platformTreasury.address,
          platformAdminAddress,
          deployer.address
        ])
        await feeManagerNew.waitForDeployment()
        const feeManagerNewAddress = await feeManagerNew.getAddress()

        await expect(
          defiIntegrationManager
            .connect(otherAdmin)
            .setFeeManager(feeManagerNewAddress)
        )
          .to.emit(defiIntegrationManager, 'ConfigUpdated')
          .withArgs(OP_CONFIG_UPDATED, feeManagerBefore, feeManagerNewAddress)

        expect(await defiIntegrationManager.feeManager()).to.equal(
          feeManagerNewAddress
        )
      })

      it('Should revert if non-owner tries to set feeManager', async function () {
        const {
          defiIntegrationManager,
          platformTreasury,
          platformAdmin,
          deployer,
          creator1
        } = await loadFixture(deployPlatformFixture)

        const feeManagerBefore = await defiIntegrationManager.feeManager()
        const platformAdminAddress = await platformAdmin.getAddress()

        const feeManagerNew = await ethers.deployContract('FeeManager', [
          platformTreasury.address,
          platformAdminAddress,
          deployer.address
        ])
        await feeManagerNew.waitForDeployment()
        const feeManagerNewAddress = await feeManagerNew.getAddress()

        await expect(
          defiIntegrationManager
            .connect(creator1)
            .setFeeManager(feeManagerNewAddress)
        )
          .to.be.revertedWithCustomError(
            defiIntegrationManager,
            'NotAuthorizedAdmin'
          )
          .withArgs(creator1.address)

        expect(await defiIntegrationManager.feeManager()).to.equal(
          feeManagerBefore
        )
      })

      it('Should revert if invalid address passed to setFeeManager()', async function () {
        const { defiIntegrationManager } = await loadFixture(
          deployPlatformFixture
        )

        const feeManagerBefore = await defiIntegrationManager.feeManager()

        await expect(defiIntegrationManager.setFeeManager(ethers.ZeroAddress))
          .to.be.revertedWithCustomError(defiIntegrationManager, 'DefiError')
          .withArgs(ERR_INVALID_ADDRESS, ethers.ZeroAddress)

        expect(await defiIntegrationManager.feeManager()).to.equal(
          feeManagerBefore
        )
      })
    })

    describe('setAavePool()', function () {
      it('Should allow owner to set the Aave Pool', async function () {
        const { defiIntegrationManager, usdc } = await loadFixture(
          deployPlatformFixture
        )

        const aavePoolBefore = await defiIntegrationManager.aavePool()

        const mockAavePool = await ethers.deployContract('MockAavePool', [
          await usdc.getAddress()
        ])
        await mockAavePool.waitForDeployment()
        const mockAavePoolAddress = await mockAavePool.getAddress()

        await expect(defiIntegrationManager.setAavePool(mockAavePoolAddress))
          .to.emit(defiIntegrationManager, 'ConfigUpdated')
          .withArgs(OP_CONFIG_UPDATED, aavePoolBefore, mockAavePoolAddress)

        expect(await defiIntegrationManager.aavePool()).to.equal(
          mockAavePoolAddress
        )
      })

      it('Should allow other admin to set the Aave Pool', async function () {
        const {
          defiIntegrationManager,
          mockAToken1,
          platformAdmin,
          otherAdmin,
          usdc
        } = await loadFixture(deployPlatformFixture)

        const aavePoolBefore = await defiIntegrationManager.aavePool()

        await platformAdmin.addPlatformAdmin(otherAdmin.address)

        const mockAavePool = await ethers.deployContract('MockAavePool', [
          await usdc.getAddress()
        ])
        await mockAavePool.waitForDeployment()
        const mockAavePoolAddress = await mockAavePool.getAddress()

        await expect(
          defiIntegrationManager
            .connect(otherAdmin)
            .setAavePool(mockAavePoolAddress)
        )
          .to.emit(defiIntegrationManager, 'ConfigUpdated')
          .withArgs(OP_CONFIG_UPDATED, aavePoolBefore, mockAavePoolAddress)

        expect(await defiIntegrationManager.aavePool()).to.equal(
          mockAavePoolAddress
        )
      })

      it('Should revert if non-owner tries to set Aave pool', async function () {
        const { defiIntegrationManager, usdc, creator1 } = await loadFixture(
          deployPlatformFixture
        )

        const aavePoolBefore = await defiIntegrationManager.aavePool()

        const mockAavePool = await ethers.deployContract('MockAavePool', [
          await usdc.getAddress()
        ])
        await mockAavePool.waitForDeployment()
        const mockAavePoolAddress = await mockAavePool.getAddress()

        await expect(
          defiIntegrationManager
            .connect(creator1)
            .setAavePool(mockAavePoolAddress)
        )
          .to.be.revertedWithCustomError(
            defiIntegrationManager,
            'NotAuthorizedAdmin'
          )
          .withArgs(creator1.address)

        expect(await defiIntegrationManager.aavePool()).to.equal(aavePoolBefore)
      })

      it('Should revert if invalid address passed to setAavePool()', async function () {
        const { defiIntegrationManager } = await loadFixture(
          deployPlatformFixture
        )

        const aavePoolBefore = await defiIntegrationManager.aavePool()

        await expect(defiIntegrationManager.setAavePool(ethers.ZeroAddress))
          .to.be.revertedWithCustomError(defiIntegrationManager, 'DefiError')
          .withArgs(ERR_INVALID_ADDRESS, ethers.ZeroAddress)

        expect(await defiIntegrationManager.aavePool()).to.equal(aavePoolBefore)
      })
    })
  })
})
