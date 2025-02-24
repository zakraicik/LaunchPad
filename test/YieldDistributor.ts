import { token } from '../typechain-types/@openzeppelin/contracts'

const { expect } = require('chai')
const { ethers } = require('hardhat')
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers')

describe('YieldDistributor', function () {
  async function deployYieldDistributorFixture () {
    const [owner, user1, user2] = await ethers.getSigners()
    const randomWallet = ethers.Wallet.createRandom()

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

    const yieldDistributor = await ethers.deployContract('YieldDistributor', [
      randomWallet.address,
      owner.address
    ])

    await mockToken1.waitForDeployment()
    await mockToken2.waitForDeployment()

    await yieldDistributor.waitForDeployment()

    return {
      yieldDistributor,
      mockToken1,
      mockToken2,
      owner,
      user1,
      user2,
      randomWallet
    }
  }

  describe('Deployment', function () {
    it('Should deploy all contracts successfully.', async function () {
      const { yieldDistributor, mockToken1, mockToken2 } = await loadFixture(
        deployYieldDistributorFixture
      )

      expect(await yieldDistributor.getAddress()).to.be.properAddress
      expect(await mockToken1.getAddress()).to.be.properAddress
      expect(await mockToken2.getAddress()).to.be.properAddress
    })

    it('Should correctly set the initial state.', async function () {
      const { yieldDistributor, owner, randomWallet } = await loadFixture(
        deployYieldDistributorFixture
      )

      expect(await yieldDistributor.owner()).to.equal(owner.address)
      expect(await yieldDistributor.getPlatformTreasury()).to.equal(
        randomWallet.address
      )
    })

    it('Should revert if zero address platform treasury passed to constructor', async function () {
      const [owner] = await ethers.getSigners()

      const YieldDistributorFactory = await ethers.getContractFactory(
        'YieldDistributor'
      )

      await expect(
        YieldDistributorFactory.deploy(ethers.ZeroAddress, owner.address)
      ).to.be.revertedWithCustomError(YieldDistributorFactory, 'InvalidAddress')
    })
  })
})
