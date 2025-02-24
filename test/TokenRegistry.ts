const { expect } = require('chai')
const { ethers } = require('hardhat')
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers')

describe('TokenRegistry', function () {
  async function deployTokenRegistryFixture () {
    const [owner, user1, user2] = await ethers.getSigners()

    const mockToken1 = await ethers.deployContract('MockERC20', [
      'Mock Token 1',
      'MT1',
      ethers.parseUnits('100')
    ])

    const mockToken2 = await ethers.deployContract('MockERC20', [
      'Mock Token 1',
      'MT1',
      ethers.parseUnits('100')
    ])

    const mockWETH = await ethers.deployContract('MockERC20', [
      'Mock WETH',
      'METH',
      ethers.parseUnits('100')
    ])

    const tokenRegistry = await ethers.deployContract('TokenRegistry', [owner])

    await mockToken1.waitForDeployment()
    await mockToken1.waitForDeployment()
    await mockWETH.waitForDeployment()
    await tokenRegistry.waitForDeployment()

    return {
      tokenRegistry,
      mockToken1,
      mockToken2,
      mockWETH,
      owner,
      user1,
      user2
    }
  }

  describe('Deployment', function () {
    it('Should deploy all contracts successfully.', async function () {
      const { tokenRegistry, mockToken1, mockToken2, mockWETH } =
        await loadFixture(deployTokenRegistryFixture)

      expect(await tokenRegistry.getAddress()).to.be.properAddress
      expect(await mockToken1.getAddress()).to.be.properAddress
      expect(await mockToken2.getAddress()).to.be.properAddress
      expect(await mockWETH.getAddress()).to.be.properAddress
    })

    it('Should correctly set owner and initial state.', async function () {
      const { tokenRegistry, owner } = await loadFixture(
        deployTokenRegistryFixture
      )

      expect(await tokenRegistry.owner()).to.equal(owner)
      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(0)
    })
  })

  describe('Adding,removing and disabling tokens', function () {
    it('Should allow owner to add ERC20 token', async function () {
      const { tokenRegistry, mockToken1, mockToken2, mockWETH } =
        await loadFixture(deployTokenRegistryFixture)

      const mockToken1Address = await mockToken1.getAddress()

      await tokenRegistry.addToken(mockToken1Address, 0)

      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(1)

      expect(await tokenRegistry.isTokenSupported(mockToken1Address)).to.be.true

      const config = await tokenRegistry.tokenConfigs(mockToken1Address)
      expect(config.isSupported).to.be.true
      expect(config.minimumContributionAmount).to.equal(0)
      expect(config.decimals).to.equal(18)
    })
    it('Should allow owner to add multiple ERC20 tokens', async function () {
      const { tokenRegistry, mockToken1, mockToken2, mockWETH } =
        await loadFixture(deployTokenRegistryFixture)

      const mockToken1Address = await mockToken1.getAddress()
      const mockToken2Address = await mockToken2.getAddress()

      await tokenRegistry.addToken(mockToken1Address, 0)

      expect(await tokenRegistry.getAllSupportedTokens()).to.have.lengthOf(1)

      expect(await tokenRegistry.isTokenSupported(mockToken1Address)).to.be.true

      const config1 = await tokenRegistry.tokenConfigs(mockToken1Address)
      expect(config1.isSupported).to.be.true
      expect(config1.minimumContributionAmount).to.equal(0)
      expect(config1.decimals).to.equal(18)

      await tokenRegistry.addToken(mockToken2Address, 0)

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
      await tokenRegistry.addToken(mockToken1Address, wholeTokenAmount)

      const config = await tokenRegistry.tokenConfigs(mockToken1Address)
      expect(config.isSupported).to.be.true

      const expectedSmallestUnit = ethers.parseUnits('5', 18)
      expect(config.minimumContributionAmount).to.equal(expectedSmallestUnit)
      expect(config.decimals).to.equal(18)
    })
  })
})
