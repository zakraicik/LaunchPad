import { token } from '../typechain-types/@openzeppelin/contracts'

const { expect } = require('chai')
const { ethers } = require('hardhat')
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers')

describe('CampaignContractFactory', function () {
  async function deployCampaignContractFactoryFixture () {
    const [owner, defiManager, user1] = await ethers.getSigners()

    const defiManagerAddress = await defiManager.getAddress()

    const campaignContractFactory = await ethers.deployContract(
      'CampaignFactory',
      [defiManagerAddress]
    )

    await campaignContractFactory.waitForDeployment()

    return {
      campaignContractFactory,
      owner,
      defiManager,
      user1
    }
  }

  describe('Deployment', function () {
    it('Should deploy all contracts succesfully', async function () {
      const { campaignContractFactory } = await loadFixture(
        deployCampaignContractFactoryFixture
      )

      expect(await campaignContractFactory.getAddress()).to.be.properAddress
    })

    it('Should correctly set the initial state', async function () {
      const { campaignContractFactory, defiManager } = await loadFixture(
        deployCampaignContractFactoryFixture
      )

      expect(await campaignContractFactory.defiManager()).to.equal(
        defiManager.address
      )
    })
  })

  describe('Deploying new campaigns', function () {})
})
