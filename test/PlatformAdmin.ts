import { token } from '../typechain-types/@openzeppelin/contracts'

import { expect } from 'chai'
import { ethers, network } from 'hardhat'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { deployPlatformFixture } from './fixture'

import { Campaign } from '../typechain-types'

describe('PlatformAdmin', function () {
  const OP_ADMIN_ADDED = 1
  const OP_ADMIN_REMOVED = 2

  // Error codes for consolidated errors
  const ERR_NOT_AUTHORIZED = 1
  const ERR_INVALID_ADDRESS = 2
  const ERR_ADMIN_NOT_EXISTS = 3
  const ERR_ADMIN_ALREADY_EXISTS = 4
  const ERR_CANT_REMOVE_OWNER = 5

  describe('Deployment', function () {
    it('Should deploy successfully', async function () {
      const { platformAdmin } = await loadFixture(deployPlatformFixture)
      expect(await platformAdmin.getAddress()).to.be.properAddress
    })

    it('Should set owner as platform admin', async function () {
      const { platformAdmin, deployer } = await loadFixture(
        deployPlatformFixture
      )
      expect(await platformAdmin.owner()).to.equal(deployer.address)
      expect(await platformAdmin.platformAdmins(deployer.address)).to.be.true
    })
  })

  describe('Admin Management', function () {
    it('Should allow adding a new platform admin', async function () {
      const { platformAdmin, otherAdmin } = await loadFixture(
        deployPlatformFixture
      )

      expect(await platformAdmin.platformAdmins(otherAdmin.address)).to.be.false

      await expect(platformAdmin.addPlatformAdmin(otherAdmin.address))
        .to.emit(platformAdmin, 'PlatformAdminOperation')
        .withArgs(OP_ADMIN_ADDED, otherAdmin.address, 0, 0)

      expect(await platformAdmin.platformAdmins(otherAdmin.address)).to.be.true
    })

    it('Should revert when adding an admin that already exists', async function () {
      const { platformAdmin, deployer } = await loadFixture(
        deployPlatformFixture
      )

      await expect(platformAdmin.addPlatformAdmin(deployer.address))
        .to.be.revertedWithCustomError(platformAdmin, 'PlatformAdminError')
        .withArgs(ERR_ADMIN_ALREADY_EXISTS, deployer.address, 0)
    })

    it('Should revert when adding zero address as admin', async function () {
      const { platformAdmin, deployer } = await loadFixture(
        deployPlatformFixture
      )

      await expect(platformAdmin.addPlatformAdmin(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(platformAdmin, 'PlatformAdminError')
        .withArgs(ERR_INVALID_ADDRESS, ethers.ZeroAddress, 0)
    })

    it('Should allow an admin to add another admin', async function () {
      const { platformAdmin, deployer, otherAdmin, contributor1 } =
        await loadFixture(deployPlatformFixture)

      // First, owner adds otherAdmin
      await platformAdmin.addPlatformAdmin(otherAdmin.address)

      // Then otherAdmin adds contributor1
      await expect(
        platformAdmin.connect(otherAdmin).addPlatformAdmin(contributor1.address)
      )
        .to.emit(platformAdmin, 'PlatformAdminOperation')
        .withArgs(OP_ADMIN_ADDED, contributor1.address, 0, 0)

      expect(await platformAdmin.platformAdmins(contributor1.address)).to.be
        .true
    })

    it('Should revert when non-admin tries to add an admin', async function () {
      const { platformAdmin, contributor1, creator2 } = await loadFixture(
        deployPlatformFixture
      )

      await expect(
        platformAdmin.connect(contributor1).addPlatformAdmin(creator2.address)
      )
        .to.be.revertedWithCustomError(platformAdmin, 'PlatformAdminError')
        .withArgs(ERR_NOT_AUTHORIZED, contributor1.address, 0)
    })

    it('Should allow removing an admin', async function () {
      const { platformAdmin, deployer, otherAdmin } = await loadFixture(
        deployPlatformFixture
      )

      // First, add an admin
      await platformAdmin.addPlatformAdmin(otherAdmin.address)
      expect(await platformAdmin.platformAdmins(otherAdmin.address)).to.be.true

      // Then remove the admin
      await expect(platformAdmin.removePlatformAdmin(otherAdmin.address))
        .to.emit(platformAdmin, 'PlatformAdminOperation')
        .withArgs(OP_ADMIN_REMOVED, otherAdmin.address, 0, 0)

      expect(await platformAdmin.platformAdmins(otherAdmin.address)).to.be.false
    })

    it('Should revert when removing an admin that does not exist', async function () {
      const { platformAdmin, contributor1 } = await loadFixture(
        deployPlatformFixture
      )

      await expect(platformAdmin.removePlatformAdmin(contributor1.address))
        .to.be.revertedWithCustomError(platformAdmin, 'PlatformAdminError')
        .withArgs(ERR_ADMIN_NOT_EXISTS, contributor1.address, 0)
    })

    it('Should revert when non-admin tries to remove an admin', async function () {
      const { platformAdmin, deployer, contributor1 } = await loadFixture(
        deployPlatformFixture
      )

      await expect(
        platformAdmin
          .connect(contributor1)
          .removePlatformAdmin(deployer.address)
      )
        .to.be.revertedWithCustomError(platformAdmin, 'PlatformAdminError')
        .withArgs(ERR_NOT_AUTHORIZED, contributor1.address, 0)
    })

    it('Should revert when trying to remove the owner', async function () {
      const { platformAdmin, deployer, otherAdmin } = await loadFixture(
        deployPlatformFixture
      )

      // Add otherAdmin first
      await platformAdmin.addPlatformAdmin(otherAdmin.address)

      // Try to remove the owner
      await expect(
        platformAdmin.connect(otherAdmin).removePlatformAdmin(deployer.address)
      )
        .to.be.revertedWithCustomError(platformAdmin, 'PlatformAdminError')
        .withArgs(ERR_CANT_REMOVE_OWNER, deployer.address, 0)
    })

    it('Should allow an admin to remove another admin', async function () {
      const { platformAdmin, deployer, otherAdmin, contributor1 } =
        await loadFixture(deployPlatformFixture)

      // Add both admins
      await platformAdmin.addPlatformAdmin(otherAdmin.address)
      await platformAdmin.addPlatformAdmin(contributor1.address)

      // otherAdmin removes contributor1
      await expect(
        platformAdmin
          .connect(otherAdmin)
          .removePlatformAdmin(contributor1.address)
      )
        .to.emit(platformAdmin, 'PlatformAdminOperation')
        .withArgs(OP_ADMIN_REMOVED, contributor1.address, 0, 0)

      expect(await platformAdmin.platformAdmins(contributor1.address)).to.be
        .false
    })

    it('Should correctly report admin status via isPlatformAdmin()', async function () {
      const { platformAdmin, deployer, contributor1, otherAdmin } =
        await loadFixture(deployPlatformFixture)

      // Test initial states
      expect(await platformAdmin.isPlatformAdmin(deployer.address)).to.be.true
      expect(await platformAdmin.isPlatformAdmin(contributor1.address)).to.be
        .false

      // Add an admin and test again
      await platformAdmin.addPlatformAdmin(otherAdmin.address)
      expect(await platformAdmin.isPlatformAdmin(otherAdmin.address)).to.be.true

      // Remove an admin and test again
      await platformAdmin.removePlatformAdmin(otherAdmin.address)
      expect(await platformAdmin.isPlatformAdmin(otherAdmin.address)).to.be
        .false
    })
  })
})
