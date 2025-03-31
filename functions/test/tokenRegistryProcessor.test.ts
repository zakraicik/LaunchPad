import {
  describe,
  beforeAll,
  afterAll,
  test,
  expect,
  jest
} from '@jest/globals'
import * as admin from 'firebase-admin'
import * as sinon from 'sinon'
import firebaseFunctionsTest from 'firebase-functions-test'
import { logger } from 'firebase-functions'

// Create a mock environment
const testEnv = firebaseFunctionsTest()

interface MockDocumentReference {
  id: string
}

describe('Alchemy Webhook', () => {
  let adminInitStub: sinon.SinonStub
  let firestoreStub: sinon.SinonStubbedInstance<FirebaseFirestore.Firestore>
  let collectionStub: sinon.SinonStubbedInstance<FirebaseFirestore.CollectionReference>
  let addStub: sinon.SinonStub
  let loggerInfoStub: sinon.SinonStub
  let loggerErrorStub: sinon.SinonStub

  beforeAll(() => {
    // Completely mock firebase-admin/app initialization
    jest.mock('firebase-admin/app', () => ({
      initializeApp: jest.fn()
    }))

    // Mock firebase-admin/firestore
    jest.mock('firebase-admin/firestore', () => ({
      getFirestore: jest.fn(() => ({
        collection: jest.fn().mockReturnValue({
          add: jest.fn().mockResolvedValue({ id: 'mock-doc-id' })
        })
      }))
    }))

    // Stub logger to prevent actual logging
    loggerInfoStub = sinon.stub(logger, 'info')
    loggerErrorStub = sinon.stub(logger, 'error')
  })

  afterAll(() => {
    // Restore all stubs
    sinon.restore()
    jest.restoreAllMocks()
  })

  test('alchemyWebhook handles empty payload', async () => {
    // Re-import function after mocking
    const { alchemyWebhook } = require('../src/index')

    // Create mock request and response
    const req: any = {
      body: {}
    }
    const res: any = {
      status: sinon.stub().returnsThis(),
      send: sinon.stub().returnsThis()
    }

    // Call the webhook
    await alchemyWebhook(req, res)

    // Verify interactions
    expect(res.status.calledWith(200)).toBe(true)
    expect(res.send.calledWith('Webhook received successfully')).toBe(true)
  })

  test('alchemyWebhook handles event with activity', async () => {
    // Re-import function after mocking
    const { alchemyWebhook } = require('../src/index')

    // Create mock request with sample event data
    const req: any = {
      body: {
        event: {
          activity: [{ type: 'test-activity' }]
        }
      }
    }
    const res: any = {
      status: sinon.stub().returnsThis(),
      send: sinon.stub().returnsThis()
    }

    // Call the webhook
    await alchemyWebhook(req, res)

    // Verify interactions
    expect(res.status.calledWith(200)).toBe(true)
    expect(res.send.calledWith('Webhook received successfully')).toBe(true)
  })
})
