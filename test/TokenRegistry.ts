import { token } from '../typechain-types/@openzeppelin/contracts'

const { expect } = require('chai')
const { ethers } = require('hardhat')
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers')

describe('TokenRegistry', function () {
  async function deployTokenRegistryFixture () {
    const [owner, user1, user2] = await ethers.getSigners()

    const GRACE_PERIOD = 7 // 7 days
    const platformAdmin = await ethers.deployContract('PlatformAdmin', [
      GRACE_PERIOD,
      owner
    ])
    await platformAdmin.waitForDeployment()
    const platformAdminAddress = await platformAdmin.getAddress()

    const mockToken1 = await ethers.deployContract('MockERC20', [
      'Mock Token 1',
      'MT1',
      ethers.parseUnits('100')
    ])

    const mockToken2 = await ethers.deployContract('MockERC20', [
      'Mock Token 2',
      'MT2',
      ethers.parseUnits('100')
    ])

    const tokenRegistry = await ethers.deployContract('TokenRegistry', [
      owner.address,
      platformAdminAddress
    ])

    await mockToken1.waitForDeployment()
    await mockToken2.waitForDeployment()
    await tokenRegistry.waitForDeployment()

    return {
      tokenRegistry,
      mockToken1,
      mockToken2,
      owner,
      user1,
      user2,
      platformAdmin,
      platformAdminAddress,
      GRACE_PERIOD
    }
  }

  describe('Deployment', function () {
    it('Should deploy all contracts successfully.', async function () {
      const { tokenRegistry } = await loadFixture(deployTokenRegistryFixture)

      expect(await tokenRegistry.getAddress()).to.be.properAddress
    })

    it('Should correctly set owner and initial state.', async function () {
      const { tokenRegistry, owner } = await loadFixture(
        deployTokenRegistryFixture
      )

      expect(await tokenRegistry.owner()).to.equal(owner.address)
      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(0)
    })
  })

  describe('Adding tokens', function () {
    it('Should allow owner to add ERC20 token', async function () {
      const { tokenRegistry, mockToken1 } = await loadFixture(
        deployTokenRegistryFixture
      )

      const mockToken1Address = await mockToken1.getAddress()

      await expect(tokenRegistry.addToken(mockToken1Address, 0))
        .to.emit(tokenRegistry, 'TokenAdded')
        .withArgs(mockToken1Address, 0, 18)

      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(1)

      expect(await tokenRegistry.isTokenSupported(mockToken1Address)).to.be.true

      const config = await tokenRegistry.tokenConfigs(mockToken1Address)
      expect(config.isSupported).to.be.true
      expect(config.minimumContributionAmount).to.equal(0)
      expect(config.decimals).to.equal(18)
    })

    it('Should allow owner to add multiple ERC20 tokens', async function () {
      const { tokenRegistry, mockToken1, mockToken2 } = await loadFixture(
        deployTokenRegistryFixture
      )

      const mockToken1Address = await mockToken1.getAddress()
      const mockToken2Address = await mockToken2.getAddress()

      await expect(tokenRegistry.addToken(mockToken1Address, 0))
        .to.emit(tokenRegistry, 'TokenAdded')
        .withArgs(mockToken1Address, 0, 18)

      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(1)

      expect(await tokenRegistry.isTokenSupported(mockToken1Address)).to.be.true

      const config1 = await tokenRegistry.tokenConfigs(mockToken1Address)
      expect(config1.isSupported).to.be.true
      expect(config1.minimumContributionAmount).to.equal(0)
      expect(config1.decimals).to.equal(18)

      await expect(tokenRegistry.addToken(mockToken2Address, 0))
        .to.emit(tokenRegistry, 'TokenAdded')
        .withArgs(mockToken2Address, 0, 18)

      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(2)

      expect(await tokenRegistry.isTokenSupported(mockToken2Address)).to.be.true

      const config2 = await tokenRegistry.tokenConfigs(mockToken2Address)
      expect(config2.isSupported).to.be.true
      expect(config2.minimumContributionAmount).to.equal(0)
      expect(config2.decimals).to.equal(18)
    })

    it('Should allow owner to add ERC20 token with non-zero minimum contribution', async function () {
      const { tokenRegistry, mockToken1 } = await loadFixture(
        deployTokenRegistryFixture
      )
      const mockToken1Address = await mockToken1.getAddress()

      const wholeTokenAmount = 5
      const expectedSmallestUnit = ethers.parseUnits('5', 18)

      await expect(tokenRegistry.addToken(mockToken1Address, wholeTokenAmount))
        .to.emit(tokenRegistry, 'TokenAdded')
        .withArgs(mockToken1Address, expectedSmallestUnit, 18)

      const config = await tokenRegistry.tokenConfigs(mockToken1Address)
      expect(config.isSupported).to.be.true

      expect(config.minimumContributionAmount).to.equal(expectedSmallestUnit)
      expect(config.decimals).to.equal(18)
    })

    it('Should revert when trying to add token already in registry.', async function () {
      const { tokenRegistry, mockToken1 } = await loadFixture(
        deployTokenRegistryFixture
      )

      const mockToken1Address = await mockToken1.getAddress()

      await tokenRegistry.addToken(mockToken1Address, 0)

      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(1)

      expect(await tokenRegistry.isTokenSupported(mockToken1Address)).to.be.true

      await expect(tokenRegistry.addToken(mockToken1Address, 0))
        .to.be.revertedWithCustomError(tokenRegistry, 'TokenAlreadyInRegistry')
        .withArgs(mockToken1Address)
    })

    it('Should revert when trying to add token with 0 address', async function () {
      const { tokenRegistry } = await loadFixture(deployTokenRegistryFixture)

      await expect(tokenRegistry.addToken(ethers.ZeroAddress, 0))
        .to.be.revertedWithCustomError(tokenRegistry, 'InvalidToken')
        .withArgs(ethers.ZeroAddress)
    })

    it('Should revert when trying to add a non-contract address', async function () {
      const { tokenRegistry, user1 } = await loadFixture(
        deployTokenRegistryFixture
      )

      await expect(tokenRegistry.addToken(user1.address, 0))
        .to.be.revertedWithCustomError(tokenRegistry, 'NotAContract')
        .withArgs(user1.address)
    })

    it('Should revert when trying to add a non-ERC20 compliant contract', async function () {
      const { tokenRegistry } = await loadFixture(deployTokenRegistryFixture)

      const nonCompliantToken = await ethers.deployContract(
        'MockNonCompliantToken'
      )

      await nonCompliantToken.waitForDeployment()

      const nonCompliantAddress = await nonCompliantToken.getAddress()

      await expect(tokenRegistry.addToken(nonCompliantAddress, 0))
        .to.be.revertedWithCustomError(tokenRegistry, 'NotERC20Compliant')
        .withArgs(nonCompliantAddress)
    })

    it('Should revert when non-owner tries to add tokens', async function () {
      const { tokenRegistry, mockToken1, user1 } = await loadFixture(
        deployTokenRegistryFixture
      )
      const mockToken1Address = await mockToken1.getAddress()

      await expect(tokenRegistry.connect(user1).addToken(mockToken1Address, 0))
        .to.be.revertedWithCustomError(tokenRegistry, 'NotAuthorizedAdmin')
        .withArgs(user1.address)

      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(0)
      await expect(tokenRegistry.isTokenSupported(mockToken1Address))
        .to.be.revertedWithCustomError(tokenRegistry, 'TokenNotInRegistry')
        .withArgs(mockToken1Address)
    })

    it('Should revert when minimum contribution amount would cause overflow', async function () {
      const { tokenRegistry, mockToken1 } = await loadFixture(
        deployTokenRegistryFixture
      )
      const mockToken1Address = await mockToken1.getAddress()

      const tooLargeAmount = ethers.parseUnits('1', 60)

      await expect(
        tokenRegistry.addToken(mockToken1Address, tooLargeAmount)
      ).to.be.revertedWithCustomError(tokenRegistry, 'Overflow')
    })
  })

  describe('Removing tokens', function () {
    it('Should allow owner to remove a token from the registry', async function () {
      const { tokenRegistry, mockToken1 } = await loadFixture(
        deployTokenRegistryFixture
      )

      const mockToken1Address = await mockToken1.getAddress()

      await tokenRegistry.addToken(mockToken1Address, 0)

      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(1)

      await expect(tokenRegistry.removeToken(mockToken1Address))
        .to.emit(tokenRegistry, 'TokenRemovedFromRegistry')
        .withArgs(mockToken1Address)

      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(0)

      await expect(tokenRegistry.isTokenSupported(mockToken1Address))
        .to.be.revertedWithCustomError(tokenRegistry, 'TokenNotInRegistry')
        .withArgs(mockToken1Address)
    })

    it('Should properly clean up all token data when removed', async function () {
      const { tokenRegistry, mockToken1 } = await loadFixture(
        deployTokenRegistryFixture
      )
      const mockToken1Address = await mockToken1.getAddress()

      await tokenRegistry.addToken(mockToken1Address, 5)

      await expect(tokenRegistry.removeToken(mockToken1Address))
        .to.emit(tokenRegistry, 'TokenRemovedFromRegistry')
        .withArgs(mockToken1Address)

      const config = await tokenRegistry.tokenConfigs(mockToken1Address)
      expect(config.isSupported).to.equal(false)
      expect(config.minimumContributionAmount).to.equal(0)
      expect(config.decimals).to.equal(0)
      await expect(
        tokenRegistry.isTokenSupported(mockToken1Address)
      ).to.be.revertedWithCustomError(tokenRegistry, 'TokenNotInRegistry')
    })

    it('Should revert when removing a token not in registry', async function () {
      const { tokenRegistry, mockToken1 } = await loadFixture(
        deployTokenRegistryFixture
      )

      const mockToken1Address = await mockToken1.getAddress()

      await expect(tokenRegistry.removeToken(mockToken1Address))
        .to.be.revertedWithCustomError(tokenRegistry, 'TokenNotInRegistry')
        .withArgs(mockToken1Address)
    })

    it('Should revert when non-owner tries to remove tokens', async function () {
      const { tokenRegistry, user1, mockToken1 } = await loadFixture(
        deployTokenRegistryFixture
      )

      const mockToken1Address = await mockToken1.getAddress()

      await tokenRegistry.addToken(mockToken1Address, 0)

      await expect(tokenRegistry.connect(user1).removeToken(mockToken1Address))
        .to.be.revertedWithCustomError(tokenRegistry, 'NotAuthorizedAdmin')
        .withArgs(user1.address)
    })

    it('Should handle removing a token when supportedTokens array manipulations are skipped', async function () {
      const { tokenRegistry, mockToken1 } = await loadFixture(
        deployTokenRegistryFixture
      )
      const mockToken1Address = await mockToken1.getAddress()

      await tokenRegistry.addToken(mockToken1Address, 0)

      await tokenRegistry.removeToken(mockToken1Address)
      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(0)

      await tokenRegistry.addToken(mockToken1Address, 0)
      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(1)
    })

    it('Should correctly remove a token that is not at the first position', async function () {
      const { tokenRegistry, mockToken1, mockToken2 } = await loadFixture(
        deployTokenRegistryFixture
      )
      const mockToken1Address = await mockToken1.getAddress()
      const mockToken2Address = await mockToken2.getAddress()

      await tokenRegistry.addToken(mockToken1Address, 0)
      await tokenRegistry.addToken(mockToken2Address, 0)

      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(2)

      await tokenRegistry.removeToken(mockToken2Address)

      const remainingTokens = await tokenRegistry.getAllSupportedTokens()
      expect(remainingTokens).to.have.lengthOf(1)
      expect(remainingTokens).to.include(mockToken1Address)
      expect(remainingTokens).to.not.include(mockToken2Address)
    })
  })

  describe('Enabling token support', function () {
    it('Should allow owner to enable support for disabled tokens', async function () {
      const { tokenRegistry, mockToken1 } = await loadFixture(
        deployTokenRegistryFixture
      )

      const mockToken1Address = await mockToken1.getAddress()

      await tokenRegistry.addToken(mockToken1Address, 0)

      await tokenRegistry.disableTokenSupport(mockToken1Address)

      expect(await tokenRegistry.isTokenSupported(mockToken1Address)).to.be
        .false

      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(0)

      await expect(tokenRegistry.enableTokenSupport(mockToken1Address))
        .to.emit(tokenRegistry, 'TokenSupportEnabled')
        .withArgs(mockToken1Address)

      expect(await tokenRegistry.isTokenSupported(mockToken1Address)).to.be.true

      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(1)
    })

    it('Should revert when trying to enable support for already enabled token', async function () {
      const { tokenRegistry, mockToken1 } = await loadFixture(
        deployTokenRegistryFixture
      )

      const mockToken1Address = await mockToken1.getAddress()

      await tokenRegistry.addToken(mockToken1Address, 0)

      expect(await tokenRegistry.isTokenSupported(mockToken1Address)).to.be.true

      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(1)

      await expect(tokenRegistry.enableTokenSupport(mockToken1Address))
        .to.be.revertedWithCustomError(
          tokenRegistry,
          'TokenSupportAlreadyEnabled'
        )
        .withArgs(mockToken1Address)

      expect(await tokenRegistry.isTokenSupported(mockToken1Address)).to.be.true

      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(1)
    })

    it('Should revert when trying to enable support for token not in registry', async function () {
      const { tokenRegistry, mockToken1 } = await loadFixture(
        deployTokenRegistryFixture
      )

      const mockToken1Address = await mockToken1.getAddress()

      await expect(tokenRegistry.enableTokenSupport(mockToken1Address))
        .to.be.revertedWithCustomError(tokenRegistry, 'TokenNotInRegistry')
        .withArgs(mockToken1Address)
    })

    it('Should revert when non-owner tries to enable support for disabled token', async function () {
      const { tokenRegistry, user1, mockToken1 } = await loadFixture(
        deployTokenRegistryFixture
      )

      const mockToken1Address = await mockToken1.getAddress()

      await tokenRegistry.addToken(mockToken1Address, 0)

      await tokenRegistry.disableTokenSupport(mockToken1Address)

      expect(await tokenRegistry.isTokenSupported(mockToken1Address)).to.be
        .false

      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(0)

      await expect(
        tokenRegistry.connect(user1).enableTokenSupport(mockToken1Address)
      )
        .to.be.revertedWithCustomError(tokenRegistry, 'NotAuthorizedAdmin')
        .withArgs(user1.address)
      expect(await tokenRegistry.isTokenSupported(mockToken1Address)).to.be
        .false

      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(0)
    })
  })

  describe('Disabling token support', function () {
    it('Should allow owner to disable support for enabled tokens', async function () {
      const { tokenRegistry, mockToken1 } = await loadFixture(
        deployTokenRegistryFixture
      )

      const mockToken1Address = await mockToken1.getAddress()

      await tokenRegistry.addToken(mockToken1Address, 0)

      expect(await tokenRegistry.isTokenSupported(mockToken1Address)).to.be.true

      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(1)

      await expect(tokenRegistry.disableTokenSupport(mockToken1Address))
        .to.emit(tokenRegistry, 'TokenSupportDisabled')
        .withArgs(mockToken1Address)

      expect(await tokenRegistry.isTokenSupported(mockToken1Address)).to.be
        .false

      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(0)
    })

    it('Should revert when trying to disable support for already disabled token', async function () {
      const { tokenRegistry, mockToken1 } = await loadFixture(
        deployTokenRegistryFixture
      )

      const mockToken1Address = await mockToken1.getAddress()

      await tokenRegistry.addToken(mockToken1Address, 0)

      await tokenRegistry.disableTokenSupport(mockToken1Address)

      await expect(tokenRegistry.disableTokenSupport(mockToken1Address))
        .to.be.revertedWithCustomError(
          tokenRegistry,
          'TokenSupportAlreadyDisabled'
        )
        .withArgs(mockToken1Address)
    })

    it('Should revert when trying to disable support for token not in registry', async function () {
      const { tokenRegistry, mockToken1 } = await loadFixture(
        deployTokenRegistryFixture
      )

      const mockToken1Address = await mockToken1.getAddress()

      await expect(tokenRegistry.disableTokenSupport(mockToken1Address))
        .to.be.revertedWithCustomError(tokenRegistry, 'TokenNotInRegistry')
        .withArgs(mockToken1Address)
    })

    it('Should revert when non-owner tries to disable support for enabled token', async function () {
      const { tokenRegistry, user1, mockToken1 } = await loadFixture(
        deployTokenRegistryFixture
      )

      const mockToken1Address = await mockToken1.getAddress()

      await tokenRegistry.addToken(mockToken1Address, 0)

      expect(await tokenRegistry.isTokenSupported(mockToken1Address)).to.be.true

      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(1)

      await expect(
        tokenRegistry.connect(user1).disableTokenSupport(mockToken1Address)
      )
        .to.be.revertedWithCustomError(tokenRegistry, 'NotAuthorizedAdmin')
        .withArgs(user1.address)

      expect(await tokenRegistry.isTokenSupported(mockToken1Address)).to.be.true

      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(1)
    })
  })

  describe('Updating minimum contribution amount', function () {
    it('Should allow owner to update minimum contribution amount', async function () {
      const { tokenRegistry, mockToken1 } = await loadFixture(
        deployTokenRegistryFixture
      )

      const mockToken1Address = await mockToken1.getAddress()

      await tokenRegistry.addToken(mockToken1Address, 0)

      const initialConfig = await tokenRegistry.tokenConfigs(mockToken1Address)
      expect(initialConfig.minimumContributionAmount).to.equal(0)

      const newMinContribution = 5
      const expectedSmallestUnit = ethers.parseUnits('5', 18)

      await expect(
        tokenRegistry.updateTokenMinimumContribution(
          mockToken1Address,
          newMinContribution
        )
      )
        .to.emit(tokenRegistry, 'TokenMinimumContributionUpdated')
        .withArgs(mockToken1Address, expectedSmallestUnit)

      const updatedConfig = await tokenRegistry.tokenConfigs(mockToken1Address)
      expect(updatedConfig.minimumContributionAmount).to.equal(
        expectedSmallestUnit
      )

      expect(updatedConfig.isSupported).to.equal(true)
      expect(updatedConfig.decimals).to.equal(18)
    })

    it('Should revert when trying to update minimum contribution amount for a nonexistant token', async function () {
      const { tokenRegistry, mockToken1 } = await loadFixture(
        deployTokenRegistryFixture
      )

      const mockToken1Address = await mockToken1.getAddress()

      const newMinContribution = 5
      const expectedSmallestUnit = ethers.parseUnits('5', 18)

      await expect(
        tokenRegistry.updateTokenMinimumContribution(
          mockToken1Address,
          newMinContribution
        )
      )
        .to.be.revertedWithCustomError(tokenRegistry, 'TokenNotInRegistry')
        .withArgs(mockToken1Address)
    })

    it('Should revert when non-owner tries to update minimum contribution amount', async function () {
      const { tokenRegistry, user1, mockToken1 } = await loadFixture(
        deployTokenRegistryFixture
      )

      const mockToken1Address = await mockToken1.getAddress()

      await tokenRegistry.addToken(mockToken1Address, 0)

      const initialConfig = await tokenRegistry.tokenConfigs(mockToken1Address)
      expect(initialConfig.minimumContributionAmount).to.equal(0)

      const newMinContribution = 5
      const expectedSmallestUnit = ethers.parseUnits('5', 18)

      await expect(
        tokenRegistry
          .connect(user1)
          .updateTokenMinimumContribution(mockToken1Address, newMinContribution)
      )
        .to.be.revertedWithCustomError(tokenRegistry, 'NotAuthorizedAdmin')
        .withArgs(user1.address)

      const updatedConfig = await tokenRegistry.tokenConfigs(mockToken1Address)
      expect(updatedConfig.minimumContributionAmount).to.equal(0)

      expect(updatedConfig.isSupported).to.equal(true)
      expect(updatedConfig.decimals).to.equal(18)
    })
  })

  describe('Getter functions', function () {
    it('getMinContributionAmount() returns correct amount and decimals', async function () {
      const { tokenRegistry, mockToken1 } = await loadFixture(
        deployTokenRegistryFixture
      )
      const mockToken1Address = await mockToken1.getAddress()

      const wholeTokenAmount = 5
      await tokenRegistry.addToken(mockToken1Address, wholeTokenAmount)

      const [minAmount, decimals] =
        await tokenRegistry.getMinContributionAmount(mockToken1Address)
      expect(minAmount).to.equal(ethers.parseUnits('5', 18))
      expect(decimals).to.equal(18)

      await expect(tokenRegistry.getMinContributionAmount(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(tokenRegistry, 'TokenNotInRegistry')
        .withArgs(ethers.ZeroAddress)
    })

    it('getTokenDecimals() returns correct decimals', async function () {
      const { tokenRegistry, mockToken1 } = await loadFixture(
        deployTokenRegistryFixture
      )
      const mockToken1Address = await mockToken1.getAddress()

      await tokenRegistry.addToken(mockToken1Address, 0)

      expect(await tokenRegistry.getTokenDecimals(mockToken1Address)).to.equal(
        18
      )

      await expect(tokenRegistry.getTokenDecimals(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(tokenRegistry, 'TokenNotInRegistry')
        .withArgs(ethers.ZeroAddress)
    })

    it('getAllSupportedTokens() returns correct array', async function () {
      const { tokenRegistry, mockToken1, mockToken2 } = await loadFixture(
        deployTokenRegistryFixture
      )
      const mockToken1Address = await mockToken1.getAddress()
      const mockToken2Address = await mockToken2.getAddress()

      expect(await tokenRegistry.getAllSupportedTokens()).to.deep.equal([])

      await tokenRegistry.addToken(mockToken1Address, 0)
      expect(await tokenRegistry.getAllSupportedTokens()).to.deep.equal([
        mockToken1Address
      ])

      await tokenRegistry.addToken(mockToken2Address, 0)
      const tokensAfterAddingTwo = await tokenRegistry.getAllSupportedTokens()
      expect(tokensAfterAddingTwo.length).to.equal(2)
      expect(tokensAfterAddingTwo).to.include(mockToken1Address)
      expect(tokensAfterAddingTwo).to.include(mockToken2Address)

      await tokenRegistry.removeToken(mockToken1Address)
      const tokensAfterRemovingFirst =
        await tokenRegistry.getAllSupportedTokens()
      expect(tokensAfterRemovingFirst.length).to.equal(1)
      expect(tokensAfterRemovingFirst).to.include(mockToken2Address)
    })

    it('isTokenSupported() returns correct status', async function () {
      const { tokenRegistry, mockToken1 } = await loadFixture(
        deployTokenRegistryFixture
      )
      const mockToken1Address = await mockToken1.getAddress()

      await expect(tokenRegistry.isTokenSupported(mockToken1Address))
        .to.be.revertedWithCustomError(tokenRegistry, 'TokenNotInRegistry')
        .withArgs(mockToken1Address)

      await tokenRegistry.addToken(mockToken1Address, 0)
      expect(await tokenRegistry.isTokenSupported(mockToken1Address)).to.be.true

      await tokenRegistry.disableTokenSupport(mockToken1Address)
      expect(await tokenRegistry.isTokenSupported(mockToken1Address)).to.be
        .false

      await tokenRegistry.enableTokenSupport(mockToken1Address)
      expect(await tokenRegistry.isTokenSupported(mockToken1Address)).to.be.true

      await tokenRegistry.removeToken(mockToken1Address)
      await expect(tokenRegistry.isTokenSupported(mockToken1Address))
        .to.be.revertedWithCustomError(tokenRegistry, 'TokenNotInRegistry')
        .withArgs(mockToken1Address)
    })

    it('_convertFromSmallestUnit() correctly converts from smallest unit to whole tokens', async function () {
      const { tokenRegistry } = await loadFixture(deployTokenRegistryFixture)

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
      const { tokenRegistry, mockToken1 } = await loadFixture(
        deployTokenRegistryFixture
      )
      const mockToken1Address = await mockToken1.getAddress()

      const smallAmount = 1
      await tokenRegistry.addToken(mockToken1Address, smallAmount)

      const config = await tokenRegistry.tokenConfigs(mockToken1Address)
      expect(config.minimumContributionAmount).to.equal(
        ethers.parseUnits('1', 18)
      )

      const smallTestAmount = await tokenRegistry.testConvertFromSmallestUnit(
        ethers.parseUnits('1', 18),
        18
      )
      expect(smallTestAmount).to.equal(1)
    })
  })
})
