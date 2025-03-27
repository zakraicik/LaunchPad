import { token } from '../typechain-types/@openzeppelin/contracts'

const { expect } = require('chai')
const { ethers } = require('hardhat')
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers')

import { deployPlatformFixture } from './fixture'

describe('TokenRegistry', function () {
  const OP_TOKEN_ADDED = 1
  const OP_TOKEN_REMOVED = 2
  const OP_TOKEN_SUPPORT_DISABLED = 3
  const OP_TOKEN_SUPPORT_ENABLED = 4
  const OP_MIN_CONTRIBUTION_UPDATED = 5

  // Error codes for consolidated errors
  const ERR_INVALID_ADDRESS = 1
  const ERR_INVALID_TOKEN = 2
  const ERR_TOKEN_ALREADY_IN_REGISTRY = 3
  const ERR_TOKEN_NOT_IN_REGISTRY = 4
  const ERR_TOKEN_SUPPORT_ALREADY_ENABLED = 5
  const ERR_TOKEN_SUPPORT_ALREADY_DISABLED = 6
  const ERR_NOT_A_CONTRACT = 7
  const ERR_NOT_ERC20_COMPLIANT = 8
  const ERR_INVALID_MIN_CONTRIBUTION = 9
  const ERR_OVERFLOW = 10

  describe('Deployment', function () {
    it('Should deploy all contracts successfully.', async function () {
      const { tokenRegistry } = await loadFixture(deployPlatformFixture)

      expect(await tokenRegistry.getAddress()).to.be.properAddress
    })

    it('Should correctly set owner and initial state.', async function () {
      const { tokenRegistry, deployer } = await loadFixture(
        deployPlatformFixture
      )

      expect(await tokenRegistry.owner()).to.equal(deployer.address)
      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(1) //Fixture already adds USDC
    })
  })

  describe('Adding tokens', function () {
    it('Should allow owner to add ERC20 token', async function () {
      const { tokenRegistry, wbtc } = await loadFixture(deployPlatformFixture)

      const wbtcAddress = await wbtc.getAddress()
      const wbtcDecimals = await wbtc.decimals()

      await expect(tokenRegistry.addToken(wbtcAddress, 0))
        .to.emit(tokenRegistry, 'TokenRegistryOperation')
        .withArgs(
          OP_TOKEN_ADDED,
          ethers.getAddress(wbtcAddress),
          0,
          wbtcDecimals
        )

      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(2)

      expect(await tokenRegistry.isTokenSupported(wbtcAddress)).to.be.true

      const config = await tokenRegistry.tokenConfigs(wbtcAddress)
      expect(config.isSupported).to.be.true
      expect(config.minimumContributionAmount).to.equal(0)
      expect(config.decimals).to.equal(wbtcDecimals)
    })

    it('Should allow owner to add multiple ERC20 tokens', async function () {
      const { tokenRegistry, usdc, wbtc } = await loadFixture(
        deployPlatformFixture
      )

      const usdcAddress = await usdc.getAddress()
      const wbtcAddress = await wbtc.getAddress()

      const usdcDecimals = await usdc.decimals()
      const wbtcDecimals = await wbtc.decimals()

      await tokenRegistry.removeToken(usdcAddress)

      await expect(tokenRegistry.addToken(usdcAddress, 0))
        .to.emit(tokenRegistry, 'TokenRegistryOperation')
        .withArgs(
          OP_TOKEN_ADDED,
          ethers.getAddress(usdcAddress),
          0,
          usdcDecimals
        )

      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(1)

      expect(await tokenRegistry.isTokenSupported(usdcAddress)).to.be.true

      const config1 = await tokenRegistry.tokenConfigs(usdcAddress)
      expect(config1.isSupported).to.be.true
      expect(config1.minimumContributionAmount).to.equal(0)
      expect(config1.decimals).to.equal(usdcDecimals)

      await expect(tokenRegistry.addToken(wbtcAddress, 0))
        .to.emit(tokenRegistry, 'TokenRegistryOperation')
        .withArgs(
          OP_TOKEN_ADDED,
          ethers.getAddress(wbtcAddress),
          0,
          wbtcDecimals
        )

      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(2)

      expect(await tokenRegistry.isTokenSupported(wbtcAddress)).to.be.true

      const config2 = await tokenRegistry.tokenConfigs(wbtcAddress)
      expect(config2.isSupported).to.be.true
      expect(config2.minimumContributionAmount).to.equal(0)
      expect(config2.decimals).to.equal(wbtcDecimals)
    })

    it('Should allow owner to add ERC20 token with non-zero minimum contribution', async function () {
      const { tokenRegistry, wbtc } = await loadFixture(deployPlatformFixture)

      const wbtcAddress = await wbtc.getAddress()
      const wbtcDecimals = await wbtc.decimals()

      const wholeTokenAmount = 5
      const expectedSmallestUnit = ethers.parseUnits(
        wholeTokenAmount.toString(),
        wbtcDecimals
      )

      await expect(tokenRegistry.addToken(wbtcAddress, wholeTokenAmount))
        .to.emit(tokenRegistry, 'TokenRegistryOperation')
        .withArgs(
          OP_TOKEN_ADDED,
          ethers.getAddress(wbtcAddress),
          expectedSmallestUnit,
          wbtcDecimals
        )

      const config = await tokenRegistry.tokenConfigs(wbtcAddress)
      expect(config.isSupported).to.be.true

      expect(config.minimumContributionAmount).to.equal(expectedSmallestUnit)
      expect(config.decimals).to.equal(wbtcDecimals)
    })

    it('Should revert when trying to add token already in registry.', async function () {
      const { tokenRegistry, usdc } = await loadFixture(deployPlatformFixture)

      const usdcAddress = await usdc.getAddress()

      expect(await tokenRegistry.isTokenSupported(usdcAddress)).to.be.true

      await expect(tokenRegistry.addToken(usdcAddress, 0))
        .to.be.revertedWithCustomError(tokenRegistry, 'TokenRegistryError')
        .withArgs(
          ERR_TOKEN_ALREADY_IN_REGISTRY,
          ethers.getAddress(usdcAddress),
          0
        )
    })

    it('Should revert when trying to add token with 0 address', async function () {
      const { tokenRegistry } = await loadFixture(deployPlatformFixture)

      await expect(tokenRegistry.addToken(ethers.ZeroAddress, 0))
        .to.be.revertedWithCustomError(tokenRegistry, 'TokenRegistryError')
        .withArgs(ERR_INVALID_ADDRESS, ethers.ZeroAddress, 0)
    })

    it('Should revert when trying to add a non-contract address', async function () {
      const { tokenRegistry, contributor1 } = await loadFixture(
        deployPlatformFixture
      )

      await expect(tokenRegistry.addToken(contributor1.address, 0))
        .to.be.revertedWithCustomError(tokenRegistry, 'TokenRegistryError')
        .withArgs(ERR_NOT_A_CONTRACT, contributor1.address, 0)
    })

    it('Should revert when trying to add a non-ERC20 compliant contract', async function () {
      const { tokenRegistry } = await loadFixture(deployPlatformFixture)

      const nonCompliantToken = await ethers.deployContract(
        'MockNonCompliantToken'
      )

      await nonCompliantToken.waitForDeployment()

      const nonCompliantAddress = await nonCompliantToken.getAddress()

      await expect(tokenRegistry.addToken(nonCompliantAddress, 0))
        .to.be.revertedWithCustomError(tokenRegistry, 'TokenRegistryError')
        .withArgs(ERR_NOT_ERC20_COMPLIANT, nonCompliantAddress, 0)
    })

    it('Should revert when non-owner tries to add tokens', async function () {
      const { tokenRegistry, wbtc, contributor1 } = await loadFixture(
        deployPlatformFixture
      )

      const wbtcAddress = await wbtc.getAddress()
      const wbtcDecimals = await wbtc.decimals()

      await expect(tokenRegistry.connect(contributor1).addToken(wbtcAddress, 0))
        .to.be.revertedWithCustomError(tokenRegistry, 'NotAuthorizedAdmin')
        .withArgs(contributor1.address)

      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(1) //Fixture already adds USDC
      await expect(tokenRegistry.isTokenSupported(wbtcAddress))
        .to.be.revertedWithCustomError(tokenRegistry, 'TokenRegistryError')
        .withArgs(ERR_TOKEN_NOT_IN_REGISTRY, ethers.getAddress(wbtcAddress), 0)
    })

    it('Should revert when minimum contribution amount would cause overflow', async function () {
      const { tokenRegistry, usdc } = await loadFixture(deployPlatformFixture)

      // Get USDC token address
      const usdcAddress = await usdc.getAddress()

      await tokenRegistry.removeToken(usdcAddress)

      const tooLargeAmount = ethers.MaxUint256

      await expect(tokenRegistry.addToken(usdcAddress, tooLargeAmount))
        .to.be.revertedWithCustomError(tokenRegistry, 'TokenRegistryError')
        .withArgs(ERR_OVERFLOW, ethers.getAddress(usdcAddress), tooLargeAmount)
    })

    it('Should allow other admin to add ERC20 token', async function () {
      const { tokenRegistry, wbtc, otherAdmin, platformAdmin } =
        await loadFixture(deployPlatformFixture)

      await platformAdmin.addPlatformAdmin(otherAdmin.address)

      const wbtcAddress = await wbtc.getAddress()
      const wbtcDecimals = await wbtc.decimals()

      await expect(tokenRegistry.connect(otherAdmin).addToken(wbtcAddress, 0))
        .to.emit(tokenRegistry, 'TokenRegistryOperation')
        .withArgs(
          OP_TOKEN_ADDED,
          ethers.getAddress(wbtcAddress),
          0,
          wbtcDecimals
        )

      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(2)

      expect(await tokenRegistry.isTokenSupported(wbtcAddress)).to.be.true

      const config = await tokenRegistry.tokenConfigs(wbtcAddress)
      expect(config.isSupported).to.be.true
      expect(config.minimumContributionAmount).to.equal(0)
      expect(config.decimals).to.equal(wbtcDecimals)
    })
  })

  describe('Removing tokens', function () {
    it('Should allow owner to remove a token from the registry', async function () {
      const { tokenRegistry, usdc } = await loadFixture(deployPlatformFixture)

      const usdcAddress = await usdc.getAddress()

      await expect(tokenRegistry.removeToken(usdcAddress))
        .to.emit(tokenRegistry, 'TokenRegistryOperation')
        .withArgs(OP_TOKEN_REMOVED, ethers.getAddress(usdcAddress), 0, 0)

      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(0)

      await expect(tokenRegistry.isTokenSupported(usdcAddress))
        .to.be.revertedWithCustomError(tokenRegistry, 'TokenRegistryError')
        .withArgs(ERR_TOKEN_NOT_IN_REGISTRY, ethers.getAddress(usdcAddress), 0)
    })

    it('Should allow other admin to remove a token from the registry', async function () {
      const { tokenRegistry, usdc, otherAdmin, platformAdmin } =
        await loadFixture(deployPlatformFixture)

      const usdcAddress = await usdc.getAddress()

      await platformAdmin.addPlatformAdmin(otherAdmin.address)

      await expect(tokenRegistry.connect(otherAdmin).removeToken(usdcAddress))
        .to.emit(tokenRegistry, 'TokenRegistryOperation')
        .withArgs(OP_TOKEN_REMOVED, ethers.getAddress(usdcAddress), 0, 0)

      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(0)

      await expect(tokenRegistry.isTokenSupported(usdcAddress))
        .to.be.revertedWithCustomError(tokenRegistry, 'TokenRegistryError')
        .withArgs(ERR_TOKEN_NOT_IN_REGISTRY, ethers.getAddress(usdcAddress), 0)
    })

    it('Should properly clean up all token data when removed', async function () {
      const { tokenRegistry, usdc } = await loadFixture(deployPlatformFixture)
      const usdcAddress = await usdc.getAddress()

      await expect(tokenRegistry.removeToken(usdcAddress))
        .to.emit(tokenRegistry, 'TokenRegistryOperation')
        .withArgs(OP_TOKEN_REMOVED, ethers.getAddress(usdcAddress), 0, 0)

      const supportedTokens = await tokenRegistry.getAllSupportedTokens()
      expect(supportedTokens).to.not.include(ethers.getAddress(usdcAddress))
    })

    it('Should revert when removing a token not in registry', async function () {
      const { tokenRegistry, wbtc } = await loadFixture(deployPlatformFixture)

      const wbtcAddress = await wbtc.getAddress()

      await expect(tokenRegistry.removeToken(wbtcAddress))
        .to.be.revertedWithCustomError(tokenRegistry, 'TokenRegistryError')
        .withArgs(ERR_TOKEN_NOT_IN_REGISTRY, ethers.getAddress(wbtcAddress), 0)
    })

    it('Should revert when non-owner tries to remove tokens', async function () {
      const { tokenRegistry, contributor1, usdc } = await loadFixture(
        deployPlatformFixture
      )

      const usdcAddress = await usdc.getAddress()

      await expect(tokenRegistry.connect(contributor1).removeToken(usdcAddress))
        .to.be.revertedWithCustomError(tokenRegistry, 'NotAuthorizedAdmin')
        .withArgs(contributor1.address)
    })

    it('Should handle removing a token when supportedTokens array manipulations are skipped', async function () {
      const { tokenRegistry, wbtc } = await loadFixture(deployPlatformFixture)
      const wbtcAddress = await wbtc.getAddress()

      await tokenRegistry.addToken(wbtcAddress, 0)

      await tokenRegistry.removeToken(wbtcAddress)
      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(1)

      await tokenRegistry.addToken(wbtcAddress, 0)
      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(2)
    })

    it('Should correctly remove a token that is not at the first position', async function () {
      const { tokenRegistry, usdc, wbtc } = await loadFixture(
        deployPlatformFixture
      )
      const usdcAddress = await usdc.getAddress()
      const wbtcAddress = await wbtc.getAddress()

      await tokenRegistry.addToken(wbtcAddress, 0)

      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(2)

      await tokenRegistry.removeToken(wbtcAddress)

      const remainingTokens = await tokenRegistry.getAllSupportedTokens()
      expect(remainingTokens).to.have.lengthOf(1)
      expect(remainingTokens).to.include(ethers.getAddress(usdcAddress))
      expect(remainingTokens).to.not.include(ethers.getAddress(wbtcAddress))
    })
  })

  describe('Enabling token support', function () {
    it('Should allow owner to enable support for disabled tokens', async function () {
      const { tokenRegistry, usdc } = await loadFixture(deployPlatformFixture)

      const usdcAddress = await usdc.getAddress()

      await tokenRegistry.disableTokenSupport(usdcAddress)

      expect(await tokenRegistry.isTokenSupported(usdcAddress)).to.be.false

      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(0)

      await expect(tokenRegistry.enableTokenSupport(usdcAddress))
        .to.emit(tokenRegistry, 'TokenRegistryOperation')
        .withArgs(
          OP_TOKEN_SUPPORT_ENABLED,
          ethers.getAddress(usdcAddress),
          0,
          0
        )

      expect(await tokenRegistry.isTokenSupported(usdcAddress)).to.be.true

      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(1)
    })

    it('Should allow other admin to enable support for disabled tokens', async function () {
      const { tokenRegistry, usdc, otherAdmin, platformAdmin } =
        await loadFixture(deployPlatformFixture)

      const usdcAddress = await usdc.getAddress()

      await tokenRegistry.disableTokenSupport(usdcAddress)

      expect(await tokenRegistry.isTokenSupported(usdcAddress)).to.be.false

      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(0)

      await platformAdmin.addPlatformAdmin(otherAdmin.address)

      await expect(
        tokenRegistry.connect(otherAdmin).enableTokenSupport(usdcAddress)
      )
        .to.emit(tokenRegistry, 'TokenRegistryOperation')
        .withArgs(
          OP_TOKEN_SUPPORT_ENABLED,
          ethers.getAddress(usdcAddress),
          0,
          0
        )

      expect(await tokenRegistry.isTokenSupported(usdcAddress)).to.be.true

      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(1)
    })

    it('Should revert when trying to enable support for already enabled token', async function () {
      const { tokenRegistry, usdc } = await loadFixture(deployPlatformFixture)

      const usdcAddress = await usdc.getAddress()

      expect(await tokenRegistry.isTokenSupported(usdcAddress)).to.be.true

      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(1)

      await expect(tokenRegistry.enableTokenSupport(usdcAddress))
        .to.be.revertedWithCustomError(tokenRegistry, 'TokenRegistryError')
        .withArgs(
          ERR_TOKEN_SUPPORT_ALREADY_ENABLED,
          ethers.getAddress(usdcAddress),
          0
        )

      expect(await tokenRegistry.isTokenSupported(usdcAddress)).to.be.true

      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(1)
    })

    it('Should revert when trying to enable support for token not in registry', async function () {
      const { tokenRegistry, wbtc } = await loadFixture(deployPlatformFixture)

      const wbtcAddress = await wbtc.getAddress()

      await expect(tokenRegistry.enableTokenSupport(wbtcAddress))
        .to.be.revertedWithCustomError(tokenRegistry, 'TokenRegistryError')
        .withArgs(ERR_TOKEN_NOT_IN_REGISTRY, ethers.getAddress(wbtcAddress), 0)
    })

    it('Should revert when non-owner tries to enable support for disabled token', async function () {
      const { tokenRegistry, contributor1, usdc } = await loadFixture(
        deployPlatformFixture
      )

      const usdcAddress = await usdc.getAddress()

      await tokenRegistry.disableTokenSupport(usdcAddress)

      expect(await tokenRegistry.isTokenSupported(usdcAddress)).to.be.false

      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(0)

      await expect(
        tokenRegistry.connect(contributor1).enableTokenSupport(usdcAddress)
      )
        .to.be.revertedWithCustomError(tokenRegistry, 'NotAuthorizedAdmin')
        .withArgs(contributor1.address)
      expect(await tokenRegistry.isTokenSupported(usdcAddress)).to.be.false

      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(0)
    })
  })

  describe('Disabling token support', function () {
    it('Should allow owner to disable support for enabled tokens', async function () {
      const { tokenRegistry, usdc } = await loadFixture(deployPlatformFixture)

      const usdcAddress = await usdc.getAddress()

      expect(await tokenRegistry.isTokenSupported(usdcAddress)).to.be.true

      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(1)

      await expect(tokenRegistry.disableTokenSupport(usdcAddress))
        .to.emit(tokenRegistry, 'TokenRegistryOperation')
        .withArgs(
          OP_TOKEN_SUPPORT_DISABLED,
          ethers.getAddress(usdcAddress),
          0,
          0
        )

      expect(await tokenRegistry.isTokenSupported(usdcAddress)).to.be.false

      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(0)
    })

    it('Should allow otheradmin to disable support for enabled tokens', async function () {
      const { tokenRegistry, usdc, otherAdmin, platformAdmin } =
        await loadFixture(deployPlatformFixture)

      const usdcAddress = await usdc.getAddress()

      expect(await tokenRegistry.isTokenSupported(usdcAddress)).to.be.true

      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(1)

      await platformAdmin.addPlatformAdmin(otherAdmin.address)

      await expect(
        tokenRegistry.connect(otherAdmin).disableTokenSupport(usdcAddress)
      )
        .to.emit(tokenRegistry, 'TokenRegistryOperation')
        .withArgs(
          OP_TOKEN_SUPPORT_DISABLED,
          ethers.getAddress(usdcAddress),
          0,
          0
        )

      expect(await tokenRegistry.isTokenSupported(usdcAddress)).to.be.false

      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(0)
    })

    it('Should revert when trying to disable support for already disabled token', async function () {
      const { tokenRegistry, usdc } = await loadFixture(deployPlatformFixture)

      const usdcAddress = await usdc.getAddress()

      await tokenRegistry.disableTokenSupport(usdcAddress)

      await expect(tokenRegistry.disableTokenSupport(usdcAddress))
        .to.be.revertedWithCustomError(tokenRegistry, 'TokenRegistryError')
        .withArgs(
          ERR_TOKEN_SUPPORT_ALREADY_DISABLED,
          ethers.getAddress(usdcAddress),
          0
        )
    })

    it('Should revert when trying to disable support for token not in registry', async function () {
      const { tokenRegistry, wbtc } = await loadFixture(deployPlatformFixture)

      const wbtcAddress = await wbtc.getAddress()

      await expect(tokenRegistry.disableTokenSupport(wbtcAddress))
        .to.be.revertedWithCustomError(tokenRegistry, 'TokenRegistryError')
        .withArgs(ERR_TOKEN_NOT_IN_REGISTRY, ethers.getAddress(wbtcAddress), 0)
    })

    it('Should revert when non-owner tries to disable support for enabled token', async function () {
      const { tokenRegistry, contributor1, usdc } = await loadFixture(
        deployPlatformFixture
      )

      const usdcAddress = await usdc.getAddress()

      expect(await tokenRegistry.isTokenSupported(usdcAddress)).to.be.true

      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(1)

      await expect(
        tokenRegistry.connect(contributor1).disableTokenSupport(usdcAddress)
      )
        .to.be.revertedWithCustomError(tokenRegistry, 'NotAuthorizedAdmin')
        .withArgs(contributor1.address)

      expect(await tokenRegistry.isTokenSupported(usdcAddress)).to.be.true

      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(1)
    })
  })

  describe('Updating minimum contribution amount', function () {
    it('Should allow owner to update minimum contribution amount', async function () {
      const { tokenRegistry, usdc } = await loadFixture(deployPlatformFixture)

      const usdcAddress = await usdc.getAddress()
      const usdcDecimals = await usdc.decimals()

      const initialConfig = await tokenRegistry.tokenConfigs(usdcAddress)
      expect(initialConfig.minimumContributionAmount).to.equal(
        ethers.parseUnits('1', usdcDecimals)
      )

      const newMinContribution = 5
      const expectedSmallestUnit = ethers.parseUnits('5', usdcDecimals)

      await expect(
        tokenRegistry.updateTokenMinimumContribution(
          usdcAddress,
          newMinContribution
        )
      )
        .to.emit(tokenRegistry, 'TokenRegistryOperation')
        .withArgs(
          OP_MIN_CONTRIBUTION_UPDATED,
          ethers.getAddress(usdcAddress),
          expectedSmallestUnit,
          0
        )

      const updatedConfig = await tokenRegistry.tokenConfigs(usdcAddress)
      expect(updatedConfig.minimumContributionAmount).to.equal(
        expectedSmallestUnit
      )

      expect(updatedConfig.isSupported).to.equal(true)
      expect(updatedConfig.decimals).to.equal(usdcDecimals)
    })

    it('Should allow otheradmin to update minimum contribution amount', async function () {
      const { tokenRegistry, usdc, otherAdmin, platformAdmin } =
        await loadFixture(deployPlatformFixture)

      const usdcAddress = await usdc.getAddress()
      const usdcDecimals = await usdc.decimals()

      const initialConfig = await tokenRegistry.tokenConfigs(usdcAddress)
      expect(initialConfig.minimumContributionAmount).to.equal(
        ethers.parseUnits('1', usdcDecimals)
      )

      const newMinContribution = 5
      const expectedSmallestUnit = ethers.parseUnits('5', usdcDecimals)

      await platformAdmin.addPlatformAdmin(otherAdmin.address)

      await expect(
        tokenRegistry
          .connect(otherAdmin)
          .updateTokenMinimumContribution(usdcAddress, newMinContribution)
      )
        .to.emit(tokenRegistry, 'TokenRegistryOperation')
        .withArgs(
          OP_MIN_CONTRIBUTION_UPDATED,
          ethers.getAddress(usdcAddress),
          expectedSmallestUnit,
          0
        )

      const updatedConfig = await tokenRegistry.tokenConfigs(usdcAddress)
      expect(updatedConfig.minimumContributionAmount).to.equal(
        expectedSmallestUnit
      )

      expect(updatedConfig.isSupported).to.equal(true)
      expect(updatedConfig.decimals).to.equal(usdcDecimals)
    })

    it('Should revert when trying to update minimum contribution amount for a nonexistant token', async function () {
      const { tokenRegistry, wbtc } = await loadFixture(deployPlatformFixture)

      const wbtcAddress = await wbtc.getAddress()

      const newMinContribution = 5
      const expectedSmallestUnit = ethers.parseUnits('5', 18)

      await expect(
        tokenRegistry.updateTokenMinimumContribution(
          wbtcAddress,
          newMinContribution
        )
      )
        .to.be.revertedWithCustomError(tokenRegistry, 'TokenRegistryError')
        .withArgs(ERR_TOKEN_NOT_IN_REGISTRY, ethers.getAddress(wbtcAddress), 0)
    })

    it('Should revert when non-owner tries to update minimum contribution amount', async function () {
      const { tokenRegistry, contributor1, usdc } = await loadFixture(
        deployPlatformFixture
      )

      const usdcAddress = await usdc.getAddress()
      const usdcDecimals = await usdc.decimals()

      const initialConfig = await tokenRegistry.tokenConfigs(usdcAddress)
      expect(initialConfig.minimumContributionAmount).to.equal(
        ethers.parseUnits('1', usdcDecimals)
      )

      const newMinContribution = 5

      await expect(
        tokenRegistry
          .connect(contributor1)
          .updateTokenMinimumContribution(usdcAddress, newMinContribution)
      )
        .to.be.revertedWithCustomError(tokenRegistry, 'NotAuthorizedAdmin')
        .withArgs(contributor1.address)

      const updatedConfig = await tokenRegistry.tokenConfigs(usdcAddress)
      expect(updatedConfig.minimumContributionAmount).to.equal(
        ethers.parseUnits('1', usdcDecimals)
      )

      expect(updatedConfig.isSupported).to.equal(true)
      expect(updatedConfig.decimals).to.equal(usdcDecimals)
    })
  })

  describe('Getter functions', function () {
    it('getMinContributionAmount() returns correct amount and decimals', async function () {
      const { tokenRegistry, usdc } = await loadFixture(deployPlatformFixture)
      const usdcAddress = await usdc.getAddress()
      const usdcDecimals = await usdc.decimals()

      const [minAmount, decimals] =
        await tokenRegistry.getMinContributionAmount(usdcAddress)
      expect(minAmount).to.equal(ethers.parseUnits('1', usdcDecimals))
      expect(decimals).to.equal(usdcDecimals)

      await expect(tokenRegistry.getMinContributionAmount(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(tokenRegistry, 'TokenRegistryError')
        .withArgs(ERR_TOKEN_NOT_IN_REGISTRY, ethers.ZeroAddress, 0)
    })

    it('getTokenDecimals() returns correct decimals', async function () {
      const { tokenRegistry, usdc } = await loadFixture(deployPlatformFixture)
      const usdcAddress = await usdc.getAddress()
      const usdcDecimals = await usdc.decimals()

      expect(await tokenRegistry.getTokenDecimals(usdcAddress)).to.equal(
        usdcDecimals
      )

      await expect(tokenRegistry.getTokenDecimals(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(tokenRegistry, 'TokenRegistryError')
        .withArgs(ERR_TOKEN_NOT_IN_REGISTRY, ethers.ZeroAddress, 0)
    })

    it('getAllSupportedTokens() returns correct array', async function () {
      const { tokenRegistry, usdc, wbtc } = await loadFixture(
        deployPlatformFixture
      )

      const usdcAddress = await usdc.getAddress()
      const wbtcAddress = await wbtc.getAddress()

      // Get initial supported tokens (should include USDC from fixture)
      const initialTokens = await tokenRegistry.getAllSupportedTokens()
      expect(initialTokens.length).to.equal(1)
      expect(initialTokens).to.include(ethers.getAddress(usdcAddress))

      // Add WBTC
      await tokenRegistry.addToken(wbtcAddress, 0)

      // Verify both tokens are now in the array
      const tokensAfterAddingWbtc = await tokenRegistry.getAllSupportedTokens()
      expect(tokensAfterAddingWbtc.length).to.equal(2)
      expect(tokensAfterAddingWbtc).to.include(ethers.getAddress(usdcAddress))
      expect(tokensAfterAddingWbtc).to.include(ethers.getAddress(wbtcAddress))

      // Remove USDC
      await tokenRegistry.removeToken(usdcAddress)

      // Verify only WBTC remains
      const tokensAfterRemovingUsdc =
        await tokenRegistry.getAllSupportedTokens()
      expect(tokensAfterRemovingUsdc.length).to.equal(1)
      expect(tokensAfterRemovingUsdc).to.include(ethers.getAddress(wbtcAddress))
      expect(tokensAfterRemovingUsdc).to.not.include(
        ethers.getAddress(usdcAddress)
      )
    })

    it('isTokenSupported() returns correct status', async function () {
      const { tokenRegistry, wbtc } = await loadFixture(deployPlatformFixture)

      const wbtcAddress = await wbtc.getAddress()

      await expect(tokenRegistry.isTokenSupported(wbtcAddress))
        .to.be.revertedWithCustomError(tokenRegistry, 'TokenRegistryError')
        .withArgs(ERR_TOKEN_NOT_IN_REGISTRY, ethers.getAddress(wbtcAddress), 0)

      await tokenRegistry.addToken(wbtcAddress, 0)
      expect(await tokenRegistry.isTokenSupported(wbtcAddress)).to.be.true

      await tokenRegistry.disableTokenSupport(wbtcAddress)
      expect(await tokenRegistry.isTokenSupported(wbtcAddress)).to.be.false

      await tokenRegistry.enableTokenSupport(wbtcAddress)
      expect(await tokenRegistry.isTokenSupported(wbtcAddress)).to.be.true

      await tokenRegistry.removeToken(wbtcAddress)
      await expect(tokenRegistry.isTokenSupported(wbtcAddress))
        .to.be.revertedWithCustomError(tokenRegistry, 'TokenRegistryError')
        .withArgs(ERR_TOKEN_NOT_IN_REGISTRY, ethers.getAddress(wbtcAddress), 0)
    })

    it('_convertFromSmallestUnit() correctly converts from smallest unit to whole tokens', async function () {
      const { tokenRegistry } = await loadFixture(deployPlatformFixture)

      const smallestAmount = ethers.parseUnits('5', 18)
      const wholeTokens = await tokenRegistry.testConvertFromSmallestUnit(
        smallestAmount,
        18
      )
      expect(wholeTokens).to.equal(5)

      const smallAmount6Dec = ethers.parseUnits('10', 6)
      const wholeTokens6Dec = await tokenRegistry.testConvertFromSmallestUnit(
        smallAmount6Dec,
        6
      )
      expect(wholeTokens6Dec).to.equal(10)
    })

    it('Should convert small values without overflow in _convertToSmallestUnit', async function () {
      const { tokenRegistry, usdc } = await loadFixture(deployPlatformFixture)
      const usdcAddress = await usdc.getAddress()
      const usdcDecimals = await usdc.decimals()

      const smallAmount = 1

      const config = await tokenRegistry.tokenConfigs(usdcAddress)
      expect(config.minimumContributionAmount).to.equal(
        ethers.parseUnits('1', usdcDecimals)
      )

      const smallTestAmount = await tokenRegistry.testConvertFromSmallestUnit(
        ethers.parseUnits('1', usdcDecimals),
        usdcDecimals
      )
      expect(smallTestAmount).to.equal(1)
    })
  })
})
