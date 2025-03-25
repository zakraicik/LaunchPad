import { token } from '../typechain-types/@openzeppelin/contracts'

const { expect } = require('chai')
const { ethers, network } = require('hardhat')
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers')

import { deployPlatformFixture } from './fixture'
import { Campaign, IERC20Metadata } from '../typechain-types'

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

  describe('Deployment', function () {
    it('Should correctly deploy the defimanager', async function () {
      const {
        aavePool,
        tokenRegistry,
        yieldDistributor,
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
      expect(await defiIntegrationManager.yieldDistributor()).to.equal(
        await yieldDistributor.getAddress()
      )

      expect(await defiIntegrationManager.owner()).to.equal(deployer.address)
    })

    it('Should revert on any incorrect constructor inputs', async function () {
      const {
        aavePool, //Base mainnet address
        deployer,
        tokenRegistry,
        yieldDistributor,
        platformAdmin
      } = await loadFixture(deployPlatformFixture)

      const aavePoolAddress = await aavePool.getAddress()
      const tokenRegistryAddress = await tokenRegistry.getAddress()
      const yieldDistributorAddress = await yieldDistributor.getAddress()
      const platformAdminAddress = await platformAdmin.getAddress()

      const DefiManager = await ethers.getContractFactory(
        'DefiIntegrationManager'
      )

      await expect(
        DefiManager.deploy(
          ethers.ZeroAddress,
          tokenRegistryAddress,
          yieldDistributorAddress,
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
          yieldDistributorAddress,
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
          yieldDistributorAddress,
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
        const defiEvent = receipt.logs.find(log => {
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
        expect(parsedEvent.args.opType).to.equal(1) // OP_DEPOSITED
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
        const firstDefiEvent = firstReceipt.logs.find(log => {
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
        expect(firstParsedEvent.args.opType).to.equal(1) // OP_DEPOSITED
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
        const secondDefiEvent = secondReceipt.logs.find(log => {
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
        expect(secondParsedEvent.args.opType).to.equal(1) // OP_DEPOSITED
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
    })

    describe('Withdrawing from yield protocol', function () {
      it('Should successfully withdraw tokens from the yield protocol', async function () {
        const {
          defiIntegrationManager,
          usdc,
          contributor1,
          yieldDistributor,
          IERC20ABI
        } = await loadFixture(deployPlatformFixture)

        // Get USDC details
        const usdcDecimals = await usdc.decimals()
        const depositAmount = ethers.parseUnits('100', usdcDecimals)
        const usdcAddress = await usdc.getAddress()

        // Get platform treasury address
        const platformTreasury = await yieldDistributor.platformTreasury()

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
          await yieldDistributor.calculateYieldShares(contributorATokenBalance)

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

      // it('Should revert when trying to withdraw zero amount', async function () {
      //   const { defiManager, mockToken1, mockCampaign } = await loadFixture(
      //     deployPlatformFixture
      //   )

      //   const campaignAddress = await mockCampaign.getAddress()

      //   const tokenAddress = await mockToken1.getAddress()
      //   const zeroAmount = 0

      //   await expect(mockCampaign.withdrawFromYield(tokenAddress, zeroAmount))
      //     .to.be.revertedWithCustomError(defiManager, 'DefiError')
      //     .withArgs(ERR_ZERO_AMOUNT, tokenAddress, zeroAmount)
      // })

      // it('Should revert when trying to withdraw more than deposited', async function () {
      //   const { defiManager, mockToken1, mockCampaign } = await loadFixture(
      //     deployPlatformFixture
      //   )

      //   const campaignAddress = await mockCampaign.getAddress()

      //   // Set up token
      //   const tokenAddress = await mockToken1.getAddress()
      //   const depositAmount = ethers.parseUnits('100')
      //   const withdrawAmount = ethers.parseUnits('150') // More than deposited

      //   // Transfer tokens to campaign
      //   await mockToken1.transfer(campaignAddress, depositAmount)

      //   // First deposit the tokens
      //   await mockCampaign.depositToYield(tokenAddress, depositAmount)

      //   // Attempt to withdraw more than deposited
      //   await expect(
      //     mockCampaign.withdrawFromYield(tokenAddress, withdrawAmount)
      //   )
      //     .to.be.revertedWithCustomError(defiManager, 'DefiError')
      //     .withArgs(ERR_INSUFFICIENT_DEPOSIT, tokenAddress, withdrawAmount)
      // })

      // it('Should revert when Aave withdrawal fails', async function () {
      //   const { defiManager, mockToken1, mockAavePool, mockCampaign } =
      //     await loadFixture(deployPlatformFixture)

      //   const campaignAddress = await mockCampaign.getAddress()

      //   // Set up token
      //   const tokenAddress = await mockToken1.getAddress()
      //   const depositAmount = ethers.parseUnits('100')
      //   const withdrawAmount = ethers.parseUnits('50')

      //   // Transfer tokens to campaign
      //   await mockToken1.transfer(campaignAddress, depositAmount)

      //   // First deposit the tokens
      //   await mockCampaign.depositToYield(tokenAddress, depositAmount)

      //   // Configure Aave mock to fail withdrawals
      //   await mockAavePool.setShouldFailWithdraw(true)

      //   // Attempt withdraw, should fail due to Aave withdrawal failure
      //   await expect(
      //     mockCampaign.withdrawFromYield(tokenAddress, withdrawAmount)
      //   )
      //     .to.be.revertedWithCustomError(defiManager, 'DefiError')
      //     .withArgs(ERR_YIELD_WITHDRAWAL_FAILED, tokenAddress, withdrawAmount)
      // })

      // it('Should revert when withdrawal amount does not match expected amount', async function () {
      //   const { defiManager, mockToken1, mockAavePool, mockCampaign } =
      //     await loadFixture(deployPlatformFixture)

      //   const campaignAddress = await mockCampaign.getAddress()

      //   // Set up token
      //   const tokenAddress = await mockToken1.getAddress()
      //   const depositAmount = ethers.parseUnits('100')
      //   const withdrawAmount = ethers.parseUnits('50')

      //   // Calculate mismatch amount consistently as BigInt
      //   const mismatchAmount = withdrawAmount - 1n

      //   // Transfer tokens to campaign
      //   await mockToken1.transfer(campaignAddress, depositAmount)

      //   // First deposit the tokens
      //   await mockCampaign.depositToYield(tokenAddress, depositAmount)

      //   // Configure the mock Aave pool to return a different amount than requested
      //   await mockAavePool.setMismatchWithdraw(true, mismatchAmount)

      //   // Attempt withdraw, should fail due to amount mismatch
      //   await expect(
      //     mockCampaign.withdrawFromYield(tokenAddress, withdrawAmount)
      //   )
      //     .to.be.revertedWithCustomError(defiManager, 'DefiError')
      //     .withArgs(ERR_WITHDRAWAL_MISMATCH, tokenAddress, withdrawAmount)
      // })

      // it('Should successfully withdraw all tokens from the yield protocol', async function () {
      //   const { defiManager, mockToken1, mockCampaign, owner } =
      //     await loadFixture(deployPlatformFixture)

      //   const campaignAddress = await mockCampaign.getAddress()

      //   // Set up token
      //   const tokenAddress = await mockToken1.getAddress()
      //   const depositAmount = ethers.parseUnits('100')

      //   // Transfer tokens to campaign
      //   await mockToken1.transfer(campaignAddress, depositAmount)

      //   // First deposit the tokens
      //   await mockCampaign.depositToYield(tokenAddress, depositAmount)

      //   // Verify deposit state
      //   expect(
      //     await defiManager.getDepositedAmount(campaignAddress, tokenAddress)
      //   ).to.equal(depositAmount)

      //   // Withdraw all tokens
      //   await expect(mockCampaign.withdrawAllFromYield(tokenAddress))
      //     .to.emit(defiManager, 'DefiOperation')
      //     .withArgs(
      //       OP_YIELD_WITHDRAWN,
      //       campaignAddress,
      //       tokenAddress,
      //       ethers.ZeroAddress,
      //       depositAmount,
      //       0
      //     )

      //   // Verify state changes after withdrawal
      //   expect(
      //     await defiManager.getDepositedAmount(campaignAddress, tokenAddress)
      //   ).to.equal(0)
      //   expect(await mockToken1.balanceOf(campaignAddress)).to.equal(
      //     depositAmount
      //   )
      // })

      // it('Should revert when trying to withdraw all with zero deposit', async function () {
      //   const { defiManager, mockToken1, mockCampaign } = await loadFixture(
      //     deployPlatformFixture
      //   )

      //   const campaignAddress = await mockCampaign.getAddress()

      //   // Attempt to withdraw with no deposit
      //   const tokenAddress = await mockToken1.getAddress()

      //   await expect(mockCampaign.withdrawAllFromYield(tokenAddress))
      //     .to.be.revertedWithCustomError(defiManager, 'DefiError')
      //     .withArgs(ERR_ZERO_AMOUNT, tokenAddress, 0)
      // })

      // it('Should revert when Aave withdrawal fails for withdrawAll', async function () {
      //   const { defiManager, mockToken1, mockAavePool, mockCampaign } =
      //     await loadFixture(deployPlatformFixture)

      //   const campaignAddress = await mockCampaign.getAddress()

      //   // Set up token
      //   const tokenAddress = await mockToken1.getAddress()
      //   const depositAmount = ethers.parseUnits('100')

      //   // Transfer tokens to campaign
      //   await mockToken1.transfer(campaignAddress, depositAmount)

      //   // First deposit the tokens
      //   await mockCampaign.depositToYield(tokenAddress, depositAmount)

      //   // Configure Aave mock to fail withdrawals
      //   await mockAavePool.setShouldFailWithdraw(true)

      //   // Attempt withdraw all, should fail due to Aave withdrawal failure
      //   await expect(mockCampaign.withdrawAllFromYield(tokenAddress))
      //     .to.be.revertedWithCustomError(defiManager, 'DefiError')
      //     .withArgs(ERR_YIELD_WITHDRAWAL_FAILED, tokenAddress, depositAmount)
      // })

      // it('Should revert when withdrawal amount does not match expected amount for withdrawAll', async function () {
      //   const { defiManager, mockToken1, mockAavePool, mockCampaign } =
      //     await loadFixture(deployPlatformFixture)

      //   const campaignAddress = await mockCampaign.getAddress()

      //   // Set up token
      //   const tokenAddress = await mockToken1.getAddress()
      //   const depositAmount = ethers.parseUnits('100')

      //   // Calculate mismatch amount consistently as BigInt
      //   const mismatchAmount = depositAmount - 1n

      //   // Transfer tokens to campaign
      //   await mockToken1.transfer(campaignAddress, depositAmount)

      //   // First deposit the tokens
      //   await mockCampaign.depositToYield(tokenAddress, depositAmount)

      //   // Configure the mock Aave pool to return a different amount than requested
      //   await mockAavePool.setMismatchWithdraw(true, mismatchAmount)

      //   // Attempt withdraw all, should fail due to amount mismatch
      //   await expect(mockCampaign.withdrawAllFromYield(tokenAddress))
      //     .to.be.revertedWithCustomError(defiManager, 'DefiError')
      //     .withArgs(ERR_WITHDRAWAL_MISMATCH, tokenAddress, depositAmount)
      // })
    })
  })

  // describe('Getter functions', function () {})

  // describe('Setter functions', function () {
  //   describe('setTokenRegistry()', function () {
  //     it('Should allow owner the token registry', async function () {
  //       const { defiManager, owner, platformAdmin } = await loadFixture(
  //         deployPlatformFixture
  //       )

  //       const tokenRegistryBefore = await defiManager.tokenRegistry()
  //       const platformAdminAddress = await platformAdmin.getAddress()

  //       const tokenRegistryNew = await ethers.deployContract('TokenRegistry', [
  //         owner.address,
  //         platformAdminAddress
  //       ])
  //       await tokenRegistryNew.waitForDeployment()
  //       const tokenRegistryNewAddress = await tokenRegistryNew.getAddress()

  //       await expect(defiManager.setTokenRegistry(tokenRegistryNewAddress))
  //         .to.emit(defiManager, 'ConfigUpdated')
  //         .withArgs(1, tokenRegistryBefore, tokenRegistryNewAddress)

  //       expect(await defiManager.tokenRegistry()).to.equal(
  //         tokenRegistryNewAddress
  //       )

  //       expect(await defiManager.tokenRegistry()).to.equal(
  //         tokenRegistryNewAddress
  //       )
  //     })

  //     it('Should allow otheradmin the token registry', async function () {
  //       const { defiManager, owner, platformAdmin, otherAdmin } =
  //         await loadFixture(deployPlatformFixture)

  //       const tokenRegistryBefore = await defiManager.tokenRegistry()
  //       const platformAdminAddress = await platformAdmin.getAddress()

  //       const tokenRegistryNew = await ethers.deployContract('TokenRegistry', [
  //         owner.address,
  //         platformAdminAddress
  //       ])
  //       await tokenRegistryNew.waitForDeployment()
  //       const tokenRegistryNewAddress = await tokenRegistryNew.getAddress()

  //       await expect(
  //         defiManager
  //           .connect(otherAdmin)
  //           .setTokenRegistry(tokenRegistryNewAddress)
  //       )
  //         .to.emit(defiManager, 'ConfigUpdated')
  //         .withArgs(1, tokenRegistryBefore, tokenRegistryNewAddress)

  //       expect(await defiManager.tokenRegistry()).to.equal(
  //         tokenRegistryNewAddress
  //       )

  //       expect(await defiManager.tokenRegistry()).to.equal(
  //         tokenRegistryNewAddress
  //       )
  //     })

  //     it('Should revert if non-owner tries to set token registry', async function () {
  //       const { defiManager, owner, platformAdmin, user1 } = await loadFixture(
  //         deployPlatformFixture
  //       )

  //       const tokenRegistryBefore = await defiManager.tokenRegistry()
  //       const platformAdminAddress = await platformAdmin.getAddress()

  //       const tokenRegistryNew = await ethers.deployContract('TokenRegistry', [
  //         owner.address,
  //         platformAdminAddress
  //       ])
  //       await tokenRegistryNew.waitForDeployment()
  //       const tokenRegistryNewAddress = await tokenRegistryNew.getAddress()

  //       await expect(
  //         defiManager.connect(user1).setTokenRegistry(tokenRegistryNewAddress)
  //       )
  //         .to.be.revertedWithCustomError(defiManager, 'NotAuthorizedAdmin')
  //         .withArgs(user1.address)

  //       expect(await defiManager.tokenRegistry()).to.equal(tokenRegistryBefore)
  //     })

  //     it('Should revert if invalid address passed to setTokenRegistry()', async function () {
  //       const { defiManager, user1 } = await loadFixture(deployPlatformFixture)

  //       const tokenRegistryBefore = await defiManager.tokenRegistry()

  //       await expect(defiManager.setTokenRegistry(ethers.ZeroAddress))
  //         .to.be.revertedWithCustomError(defiManager, 'DefiError')
  //         .withArgs(ERR_INVALID_ADDRESS, ethers.ZeroAddress, 0)

  //       expect(await defiManager.tokenRegistry()).to.equal(tokenRegistryBefore)
  //     })
  //   })

  //   describe('setYieldDistributor()', function () {
  //     it('Should allow owner to set the yield distributor', async function () {
  //       const { defiManager, platformTreasury, platformAdmin, owner } =
  //         await loadFixture(deployPlatformFixture)

  //       const yieldDistributorBefore = await defiManager.yieldDistributor()
  //       const platformAdminAddress = await platformAdmin.getAddress()

  //       const yieldDistributorAfter = await ethers.deployContract(
  //         'YieldDistributor',
  //         [platformTreasury.address, platformAdminAddress, owner.address]
  //       )
  //       await yieldDistributorAfter.waitForDeployment()
  //       const yieldDistributorAfterAddress =
  //         await yieldDistributorAfter.getAddress()

  //       await expect(
  //         defiManager.setYieldDistributor(yieldDistributorAfterAddress)
  //       )
  //         .to.emit(defiManager, 'ConfigUpdated')
  //         .withArgs(2, yieldDistributorBefore, yieldDistributorAfterAddress)

  //       expect(await defiManager.yieldDistributor()).to.equal(
  //         yieldDistributorAfterAddress
  //       )
  //     })

  //     it('Should allow otheradmin to set the yield distributor', async function () {
  //       const {
  //         defiManager,
  //         platformTreasury,
  //         platformAdmin,
  //         owner,
  //         otherAdmin
  //       } = await loadFixture(deployPlatformFixture)

  //       const yieldDistributorBefore = await defiManager.yieldDistributor()
  //       const platformAdminAddress = await platformAdmin.getAddress()

  //       const yieldDistributorAfter = await ethers.deployContract(
  //         'YieldDistributor',
  //         [platformTreasury.address, platformAdminAddress, owner.address]
  //       )
  //       await yieldDistributorAfter.waitForDeployment()
  //       const yieldDistributorAfterAddress =
  //         await yieldDistributorAfter.getAddress()

  //       await expect(
  //         defiManager
  //           .connect(otherAdmin)
  //           .setYieldDistributor(yieldDistributorAfterAddress)
  //       )
  //         .to.emit(defiManager, 'ConfigUpdated')
  //         .withArgs(2, yieldDistributorBefore, yieldDistributorAfter)

  //       expect(await defiManager.yieldDistributor()).to.equal(
  //         yieldDistributorAfterAddress
  //       )
  //     })

  //     it('Should revert if non-owner tries to set yieldDistributor', async function () {
  //       const { defiManager, platformTreasury, platformAdmin, owner, user1 } =
  //         await loadFixture(deployPlatformFixture)

  //       const yieldDistributorBefore = await defiManager.yieldDistributor()
  //       const platformAdminAddress = await platformAdmin.getAddress()

  //       const yieldDistributorAfter = await ethers.deployContract(
  //         'YieldDistributor',
  //         [platformTreasury.address, platformAdminAddress, owner.address]
  //       )

  //       await expect(
  //         defiManager.connect(user1).setYieldDistributor(yieldDistributorAfter)
  //       )
  //         .to.be.revertedWithCustomError(defiManager, 'NotAuthorizedAdmin')
  //         .withArgs(user1.address)

  //       expect(await defiManager.yieldDistributor()).to.equal(
  //         yieldDistributorBefore
  //       )
  //     })

  //     it('Should revert if invalid address passed to setYieldDistributor()', async function () {
  //       const { defiManager, user1 } = await loadFixture(deployPlatformFixture)

  //       const yieldDistributorBefore = await defiManager.yieldDistributor()

  //       await expect(defiManager.setYieldDistributor(ethers.ZeroAddress))
  //         .to.be.revertedWithCustomError(defiManager, 'DefiError')
  //         .withArgs(ERR_INVALID_ADDRESS, ethers.ZeroAddress, 0)

  //       expect(await defiManager.yieldDistributor()).to.equal(
  //         yieldDistributorBefore
  //       )
  //     })
  //   })

  //   describe('setAavePool()', function () {
  //     it('Should allow owner to set the Aave Pool', async function () {
  //       const { defiManager, mockAToken1 } = await loadFixture(
  //         deployPlatformFixture
  //       )

  //       const mockAavePoolBefore = await defiManager.aavePool()

  //       const mockAavePool = await ethers.deployContract('MockAavePool', [
  //         await mockAToken1.getAddress()
  //       ])
  //       await mockAavePool.waitForDeployment()

  //       const mockAavePoolAfter = await mockAavePool.getAddress()

  //       await expect(defiManager.setAavePool(mockAavePoolAfter))
  //         .to.emit(defiManager, 'ConfigUpdated')
  //         .withArgs(3, mockAavePoolBefore, mockAavePoolAfter)

  //       expect(await defiManager.aavePool()).to.equal(mockAavePoolAfter)
  //     })

  //     it('Should allow other admin to set the Aave Pool', async function () {
  //       const { defiManager, mockAToken1, otherAdmin } = await loadFixture(
  //         deployPlatformFixture
  //       )

  //       const mockAavePoolBefore = await defiManager.aavePool()

  //       const mockAavePool = await ethers.deployContract('MockAavePool', [
  //         await mockAToken1.getAddress()
  //       ])
  //       await mockAavePool.waitForDeployment()

  //       const mockAavePoolAfter = await mockAavePool.getAddress()

  //       await expect(
  //         defiManager.connect(otherAdmin).setAavePool(mockAavePoolAfter)
  //       )
  //         .to.emit(defiManager, 'ConfigUpdated')
  //         .withArgs(3, mockAavePoolBefore, mockAavePoolAfter)

  //       expect(await defiManager.aavePool()).to.equal(mockAavePoolAfter)
  //     })

  //     it('Should revert if non-owner tries to set Aave pool', async function () {
  //       const { defiManager, mockAToken1, user1 } = await loadFixture(
  //         deployPlatformFixture
  //       )

  //       const mockAavePoolBefore = await defiManager.aavePool()

  //       const mockAavePool = await ethers.deployContract('MockAavePool', [
  //         await mockAToken1.getAddress()
  //       ])
  //       await mockAavePool.waitForDeployment()

  //       const mockAavePoolAfter = await mockAavePool.getAddress()

  //       await expect(defiManager.connect(user1).setAavePool(mockAavePoolAfter))
  //         .to.be.revertedWithCustomError(defiManager, 'NotAuthorizedAdmin')
  //         .withArgs(user1.address)

  //       expect(await defiManager.aavePool()).to.equal(mockAavePoolBefore)
  //     })

  //     it('Should revert if invalid address passed to setAavePool()', async function () {
  //       const { defiManager, user1 } = await loadFixture(deployPlatformFixture)

  //       const mockAavePoolBefore = await defiManager.aavePool()

  //       await expect(defiManager.setAavePool(ethers.ZeroAddress))
  //         .to.be.revertedWithCustomError(defiManager, 'DefiError')
  //         .withArgs(ERR_INVALID_ADDRESS, ethers.ZeroAddress, 0)

  //       expect(await defiManager.aavePool()).to.equal(mockAavePoolBefore)
  //     })
  //   })

  //   describe('setUniswapRouter()', function () {
  //     it('Should allow owner to set the Uniswap Router', async function () {
  //       const { defiManager } = await loadFixture(deployPlatformFixture)

  //       const mockUniswapRouterBefore = await defiManager.uniswapRouter()

  //       const mockUniswapRouter = await ethers.deployContract(
  //         'MockUniswapRouter'
  //       )
  //       await mockUniswapRouter.waitForDeployment()

  //       const mockUniswapRouterAfter = await mockUniswapRouter.getAddress()

  //       await expect(defiManager.setUniswapRouter(mockUniswapRouterAfter))
  //         .to.emit(defiManager, 'ConfigUpdated')
  //         .withArgs(4, mockUniswapRouterBefore, mockUniswapRouterAfter)

  //       expect(await defiManager.uniswapRouter()).to.equal(
  //         mockUniswapRouterAfter
  //       )
  //     })

  //     it('Should allow otheradmin to set the Uniswap Router', async function () {
  //       const { defiManager, otherAdmin } = await loadFixture(
  //         deployPlatformFixture
  //       )

  //       const mockUniswapRouterBefore = await defiManager.uniswapRouter()

  //       const mockUniswapRouter = await ethers.deployContract(
  //         'MockUniswapRouter'
  //       )
  //       await mockUniswapRouter.waitForDeployment()

  //       const mockUniswapRouterAfter = await mockUniswapRouter.getAddress()

  //       await expect(
  //         defiManager
  //           .connect(otherAdmin)
  //           .setUniswapRouter(mockUniswapRouterAfter)
  //       )
  //         .to.emit(defiManager, 'ConfigUpdated')
  //         .withArgs(4, mockUniswapRouterBefore, mockUniswapRouterAfter)

  //       expect(await defiManager.uniswapRouter()).to.equal(
  //         mockUniswapRouterAfter
  //       )
  //     })

  //     it('Should revert if non-owner tries to set Uniswap Router', async function () {
  //       const { defiManager, user1 } = await loadFixture(deployPlatformFixture)

  //       const mockUniswapRouterBefore = await defiManager.uniswapRouter()

  //       const mockUniswapRouter = await ethers.deployContract(
  //         'MockUniswapRouter'
  //       )
  //       await mockUniswapRouter.waitForDeployment()

  //       const mockUniswapRouterAfter = await mockUniswapRouter.getAddress()

  //       await expect(
  //         defiManager.connect(user1).setUniswapRouter(mockUniswapRouterAfter)
  //       )
  //         .to.be.revertedWithCustomError(defiManager, 'NotAuthorizedAdmin')
  //         .withArgs(user1.address)

  //       expect(await defiManager.uniswapRouter()).to.equal(
  //         mockUniswapRouterBefore
  //       )
  //     })

  //     it('Should revert if invalid address passed to setUniswapRouter()', async function () {
  //       const { defiManager, user1 } = await loadFixture(deployPlatformFixture)

  //       const mockUniswapRouterBefore = await defiManager.uniswapRouter()

  //       await expect(defiManager.setUniswapRouter(ethers.ZeroAddress))
  //         .to.be.revertedWithCustomError(defiManager, 'DefiError')
  //         .withArgs(ERR_INVALID_ADDRESS, ethers.ZeroAddress, 0)

  //       expect(await defiManager.uniswapRouter()).to.equal(
  //         mockUniswapRouterBefore
  //       )
  //     })
  //   })

  //   describe('setUniswapQuoter()', function () {
  //     it('Should allow owner to set the Uniswap Quoter', async function () {
  //       const { defiManager } = await loadFixture(deployPlatformFixture)

  //       const mockUniswapQuoterBefore = await defiManager.uniswapQuoter()

  //       const mockUniswapQuoter = await ethers.deployContract(
  //         'MockUniswapQuoter'
  //       )
  //       await mockUniswapQuoter.waitForDeployment()

  //       const mockUniswapQuoterAfter = await mockUniswapQuoter.getAddress()

  //       await expect(defiManager.setUniswapQuoter(mockUniswapQuoterAfter))
  //         .to.emit(defiManager, 'ConfigUpdated')
  //         .withArgs(5, mockUniswapQuoterBefore, mockUniswapQuoterAfter)

  //       expect(await defiManager.uniswapQuoter()).to.equal(
  //         mockUniswapQuoterAfter
  //       )
  //     })

  //     it('Should allow otheradmin to set the Uniswap Quoter', async function () {
  //       const { defiManager, otherAdmin } = await loadFixture(
  //         deployPlatformFixture
  //       )

  //       const mockUniswapQuoterBefore = await defiManager.uniswapQuoter()

  //       const mockUniswapQuoter = await ethers.deployContract(
  //         'MockUniswapQuoter'
  //       )
  //       await mockUniswapQuoter.waitForDeployment()

  //       const mockUniswapQuoterAfter = await mockUniswapQuoter.getAddress()

  //       await expect(
  //         defiManager
  //           .connect(otherAdmin)
  //           .setUniswapQuoter(mockUniswapQuoterAfter)
  //       )
  //         .to.emit(defiManager, 'ConfigUpdated')
  //         .withArgs(5, mockUniswapQuoterBefore, mockUniswapQuoterAfter)

  //       expect(await defiManager.uniswapQuoter()).to.equal(
  //         mockUniswapQuoterAfter
  //       )
  //     })

  //     it('Should revert if non-owner tries to set Uniswap Quoter', async function () {
  //       const { defiManager, user1 } = await loadFixture(deployPlatformFixture)

  //       const mockUniswapQuoterrBefore = await defiManager.uniswapQuoter()

  //       const mockUniswapQuoter = await ethers.deployContract(
  //         'MockUniswapQuoter'
  //       )
  //       await mockUniswapQuoter.waitForDeployment()

  //       const mockUniswapQuoterAfter = await mockUniswapQuoter.getAddress()

  //       await expect(
  //         defiManager.connect(user1).setUniswapQuoter(mockUniswapQuoterAfter)
  //       )
  //         .to.be.revertedWithCustomError(defiManager, 'NotAuthorizedAdmin')
  //         .withArgs(user1.address)

  //       expect(await defiManager.uniswapQuoter()).to.equal(
  //         mockUniswapQuoterrBefore
  //       )
  //     })

  //     it('Should revert if invalid address passed to setUniswapQuoter()', async function () {
  //       const { defiManager, user1 } = await loadFixture(deployPlatformFixture)
  //       const mockUniswapQuoterrBefore = await defiManager.uniswapQuoter()

  //       await expect(defiManager.setUniswapQuoter(ethers.ZeroAddress))
  //         .to.be.revertedWithCustomError(defiManager, 'DefiError')
  //         .withArgs(ERR_INVALID_ADDRESS, ethers.ZeroAddress, 0)

  //       expect(await defiManager.uniswapQuoter()).to.equal(
  //         mockUniswapQuoterrBefore
  //       )
  //     })
  //   })
  // })
})
