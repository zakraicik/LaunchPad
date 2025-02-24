import { token } from '../typechain-types/@openzeppelin/contracts'

const { expect } = require('chai')
const { ethers } = require('hardhat')
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers')

describe('YieldDistributor', function () {
  async function deployYieldDistributorFixture () {
    const [owner, user1, user2] = await ethers.getSigners()
    const randomWallet = ethers.Wallet.createRandom()
    const randomWallet2 = ethers.Wallet.createRandom()

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
      randomWallet,
      randomWallet2
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

  describe('Updating platform treasury', function () {
    it('Should allow owner to update the platform treasury', async function () {
      const { yieldDistributor, randomWallet, randomWallet2 } =
        await loadFixture(deployYieldDistributorFixture)

      expect(await yieldDistributor.getPlatformTreasury()).to.equal(
        randomWallet.address
      )

      await expect(yieldDistributor.updatePlatformTreasury(randomWallet2))
        .to.emit(yieldDistributor, 'PlatformTreasuryUpdated')
        .withArgs(randomWallet.address, randomWallet2.address)

      expect(await yieldDistributor.getPlatformTreasury()).to.equal(
        randomWallet2.address
      )
    })

    it('Should revert if non-owner attempts to update the platform treasury', async function () {
      const { yieldDistributor, user1, randomWallet, randomWallet2 } =
        await loadFixture(deployYieldDistributorFixture)

      expect(await yieldDistributor.getPlatformTreasury()).to.equal(
        randomWallet.address
      )

      await expect(
        yieldDistributor
          .connect(user1)
          .updatePlatformTreasury(randomWallet2.address)
      )
        .to.be.revertedWithCustomError(
          yieldDistributor,
          'OwnableUnauthorizedAccount'
        )
        .withArgs(user1.address)

      expect(await yieldDistributor.getPlatformTreasury()).to.equal(
        randomWallet.address
      )
    })

    it('Should revert if zero address is pass to updatePlatformTreasury()', async function () {
      const { yieldDistributor, randomWallet } = await loadFixture(
        deployYieldDistributorFixture
      )
      expect(await yieldDistributor.getPlatformTreasury()).to.equal(
        randomWallet.address
      )

      await expect(
        yieldDistributor.updatePlatformTreasury(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(yieldDistributor, 'InvalidAddress')

      expect(await yieldDistributor.getPlatformTreasury()).to.equal(
        randomWallet.address
      )
    })
  })

  describe('Updating platform yield share', function () {
    it('Should allow owner to update platform yield share', async function () {
      const { yieldDistributor } = await loadFixture(
        deployYieldDistributorFixture
      )

      const currentYieldShare = await yieldDistributor.getPlatformYieldShare()
      const newYieldShare = 3000

      await expect(yieldDistributor.updatePlatformYieldShare(newYieldShare))
        .to.emit(yieldDistributor, 'PlatformYieldShareUpdated')
        .withArgs(currentYieldShare, newYieldShare)

      expect(await yieldDistributor.getPlatformYieldShare()).to.equal(
        newYieldShare
      )
    })

    it('Should revert if new yield share is greater than the maximum', async function () {
      const { yieldDistributor } = await loadFixture(
        deployYieldDistributorFixture
      )

      const currentYieldShare = await yieldDistributor.getPlatformYieldShare()
      const newYieldShare = 7000

      await expect(yieldDistributor.updatePlatformYieldShare(newYieldShare))
        .to.be.revertedWithCustomError(yieldDistributor, 'ShareExceedsMaximum')
        .withArgs(newYieldShare)

      expect(await yieldDistributor.getPlatformYieldShare()).to.equal(
        currentYieldShare
      )
    })

    it('Should revert when non-owner tries to update platform yield share', async function () {
      const { yieldDistributor, user1 } = await loadFixture(
        deployYieldDistributorFixture
      )

      const currentYieldShare = await yieldDistributor.getPlatformYieldShare()
      const newYieldShare = 3000

      await expect(
        yieldDistributor.connect(user1).updatePlatformYieldShare(newYieldShare)
      )
        .to.be.revertedWithCustomError(
          yieldDistributor,
          'OwnableUnauthorizedAccount'
        )
        .withArgs(user1.address)

      expect(await yieldDistributor.getPlatformYieldShare()).to.equal(
        currentYieldShare
      )
    })
  })
})
