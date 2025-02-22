const { expect } = require('chai')
const { ethers } = require('hardhat')
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers')

describe('TokenRegistry', function () {
  async function deployTokenRegistryFixture () {
    const [owner, user1, user2] = await ethers.getSigners()

    const MockERC20 = await ethers.getContractFactory('MockERC20')
  }
})
