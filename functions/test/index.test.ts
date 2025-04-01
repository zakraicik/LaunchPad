import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest
} from '@jest/globals'
import * as sinon from 'sinon'
import { logger } from 'firebase-functions'
import { Request, Response } from 'express'

// Import types from your existing test file
interface AlchemyActivity {
  type: string
  [key: string]: any
}

interface AlchemyEvent {
  activity?: AlchemyActivity[]
  [key: string]: any
}

interface AlchemyWebhookPayload {
  event?: AlchemyEvent
  [key: string]: any
}

interface MockRequest extends Partial<Request> {
  body: AlchemyWebhookPayload
}

interface MockResponse extends Partial<Response> {
  status: sinon.SinonStub
  send: sinon.SinonStub
}

describe('alchemyWebhook()', () => {
  let mockFirestore: {
    collection: sinon.SinonStub
  }
  let mockCollection: sinon.SinonStub
  let mockAdd: sinon.SinonStub
  let res: MockResponse

  // Mock functions module for consistent imports
  const mockFunctions = {
    logger: {
      info: jest.fn(),
      error: jest.fn()
    }
  }

  beforeEach(() => {
    // Reset modules before each test
    jest.resetModules()

    // Stub the Firestore calls
    mockAdd = sinon.stub().resolves({ id: 'mock-doc-id' })
    mockCollection = sinon.stub().returns({ add: mockAdd })
    mockFirestore = { collection: mockCollection }

    // Setup logger spies instead of stubs
    // This is important because the function is imported before we can stub it
    jest.spyOn(logger, 'info').mockImplementation((...args) => {
      mockFunctions.logger.info(...args)
      return null as any
    })

    // Mock response
    res = {
      status: sinon.stub().returnsThis(),
      send: sinon.stub().returnsThis()
    }

    // Setup mocks before importing the function
    jest.mock('firebase-admin/app', () => ({
      initializeApp: jest.fn()
    }))

    jest.mock('firebase-admin/firestore', () => ({
      getFirestore: jest.fn(() => mockFirestore)
    }))

    // Mock firebase-functions logger
    jest.mock('firebase-functions', () => ({
      logger: mockFunctions.logger
    }))
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('alchemyWebhook stores event data in Firestore', async () => {
    // Re-import function after mocking
    const { alchemyWebhook } = require('../src/index')

    // Create a timestamp for testing
    const now = new Date()
    // Stub Date constructor to return a fixed date
    const dateStub = sinon.stub(global, 'Date' as any).returns(now)

    const req: MockRequest = {
      body: { event: { someField: 'test-value' } }
    }

    await alchemyWebhook(req, res)

    // Verify Firestore collection was called with correct collection name
    expect(mockCollection.calledWith('rawEvents')).toBe(true)

    // Verify add was called with correct data
    expect(
      mockAdd.calledWith(
        sinon.match({
          timestamp: now,
          data: req.body
        })
      )
    ).toBe(true)

    // Verify logging - using the mock function
    expect(mockFunctions.logger.info).toHaveBeenCalledWith(
      `Event stored with ID: mock-doc-id`
    )

    dateStub.restore()
  })

  test('alchemyWebhook calls processEventActivity when activity is present', async () => {
    const activity = [{ type: 'TEST_ACTIVITY', data: 'test-data' }]
    const req: MockRequest = {
      body: {
        event: {
          activity: activity
        }
      }
    }

    // Re-import function after mocking
    const { alchemyWebhook } = require('../src/index')

    // Call the webhook function
    await alchemyWebhook(req, res)

    // Verify processEventActivity was called by checking the logging
    expect(mockFunctions.logger.info).toHaveBeenCalledWith(
      'Processing activity:',
      expect.anything()
    )
  })

  test('alchemyWebhook handles Firestore write errors', async () => {
    // Make Firestore add throw an error
    const testError = new Error('Firestore write error')
    mockAdd.rejects(testError)

    // Re-import function after mocking
    const { alchemyWebhook } = require('../src/index')

    const req: MockRequest = {
      body: { event: { someField: 'test-value' } }
    }

    await alchemyWebhook(req, res)

    // Verify error was logged using the mock function
    expect(mockFunctions.logger.error).toHaveBeenCalledWith(
      'Error processing webhook:',
      testError
    )

    // Verify error response was sent
    expect(res.status.calledWith(500)).toBe(true)
    expect(res.send.calledWith('Error processing webhook')).toBe(true)
  })

  test('alchemyWebhook logs complete payload', async () => {
    // Re-import function after mocking
    const { alchemyWebhook } = require('../src/index')

    const complexPayload: AlchemyWebhookPayload = {
      id: '12345',
      createdAt: '2023-01-01T00:00:00Z',
      event: {
        network: 'ethereum',
        activity: [
          { type: 'TOKEN_TRANSFER', amount: '100', token: '0x123' },
          { type: 'NFT_MINT', tokenId: '42', contract: '0x456' }
        ]
      }
    }

    const req: MockRequest = {
      body: complexPayload
    }

    await alchemyWebhook(req, res)

    // Verify payload was logged using Jest's toHaveBeenCalledWith
    expect(mockFunctions.logger.info).toHaveBeenCalledWith(
      'Received webhook payload:',
      JSON.stringify(complexPayload)
    )
  })

  test('alchemyWebhook handles missing event and activity', async () => {
    // Clear mock call history
    jest.clearAllMocks()

    const req: MockRequest = {
      body: {
        id: '12345'
        // no event field
      }
    }

    // Re-import function after mocking
    const { alchemyWebhook } = require('../src/index')

    await alchemyWebhook(req, res)

    // Verify that the "Processing activity:" log was NOT called
    const processingCalls = (
      mockFunctions.logger.info as jest.Mock
    ).mock.calls.filter(call => call[0] === 'Processing activity:')
    expect(processingCalls.length).toBe(0)

    // Verify successful response
    expect(res.status.calledWith(200)).toBe(true)
  })
})
