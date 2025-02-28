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
      const { defiManager } = await loadFixture(deployDefiManagerFixture)

      expect(await defiManager.getAddress()).to.be.properAddress
    })
  })
})
