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

  describe('Deployment', async function () {
    const { tokenRegistry, mockToken1, mockToken2, mockWETH, owner } =
      await loadFixture(deployTokenRegistryFixture)

    it('Should deploy all contracts successfully.', async function () {
      expect(await tokenRegistry.getAddress()).to.be.properAddress
      expect(await mockToken1.getAddress()).to.be.properAddress
      expect(await mockToken2.getAddress()).to.be.properAddress
      expect(await mockWETH.getAddress()).to.be.properAddress
    }),
      it('Should correctly set owner and initial state.', async function () {})
  })
})
