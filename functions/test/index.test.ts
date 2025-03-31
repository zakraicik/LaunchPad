/**
 * Tests for the Alchemy webhook handler
 * This file tests the HTTP function that receives webhook events from Alchemy
 * and processes them into our Firestore database.
 */

// Import the webhook handler function from our source
import { alchemyWebhook } from '../src/index'

// Mock Firebase Functions to isolate testing of our function
// This replaces the real firebase-functions implementation with mock functions
jest.mock('firebase-functions', () => {
  return {
    // Mock the logging functionality
    logger: {
      info: jest.fn(), // Mock info logging
      error: jest.fn() // Mock error logging
    },
    // Mock the onRequest function that registers our HTTP handler
    // We make it pass through the handler function unchanged
    onRequest: jest.fn(handler => handler)
  }
})

/**
 * Test suite for the Alchemy webhook handler
 */
describe('Alchemy Webhook', () => {
  // Define request and response objects to simulate HTTP interaction
  let req: any
  let res: any

  // Import Firebase Admin Firestore using require
  // This approach allows us to mock it after import
  const adminFirestore = require('firebase-admin/firestore')

  /**
   * Setup before each test
   * - Resets all mocks
   * - Creates fresh request and response objects
   * - Sets up Firestore mocks
   */
  beforeEach(() => {
    // Reset all mock counters and implementations before each test
    jest.clearAllMocks()

    // Mock Firestore's collection and add methods
    // This simulates successful database operations without hitting a real database
    adminFirestore.getFirestore().collection = jest.fn().mockReturnValue({
      add: jest.fn().mockResolvedValue({ id: 'test-doc-id' }) // Simulate successful document creation
    })

    // Set up a mock HTTP request with sample webhook data
    req = {
      body: {
        event: {
          activity: [{ type: 'test-activity' }], // Sample blockchain activity
          data: {
            logs: [] // Empty logs for basic test case
          }
        }
      }
    }

    // Set up a mock HTTP response with chainable methods
    res = {
      status: jest.fn(() => res), // Returns itself for chaining
      send: jest.fn() // Mock send method to verify responses
    }
  })

  /**
   * Test the success path
   * Verifies that the webhook handler:
   * - Stores the event in Firestore
   * - Returns a 200 status with success message
   */
  test('should process webhook and return 200 status', async () => {
    // Call the webhook handler with our mock request and response
    await alchemyWebhook(req, res)

    // Verify Firestore was called to store the raw event
    expect(adminFirestore.getFirestore().collection).toHaveBeenCalledWith(
      'rawEvents' // Check that it tried to add to the correct collection
    )

    // Verify HTTP response was sent with success status
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.send).toHaveBeenCalledWith('Webhook received successfully')
  })

  /**
   * Test the error handling path
   * Verifies that the webhook handler:
   * - Handles database errors gracefully
   * - Returns a 500 status with error message
   */
  test('should handle errors and return 500 status', async () => {
    // Mock Firestore to throw an error when add is called
    adminFirestore.getFirestore().collection = jest.fn().mockReturnValue({
      add: jest.fn().mockImplementation(() => {
        throw new Error('Test error') // Simulate database failure
      })
    })

    // Call the webhook handler with our mock request and response
    await alchemyWebhook(req, res)

    // Verify HTTP response was sent with error status
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.send).toHaveBeenCalledWith('Error processing webhook')
  })

  /**
   * Test activity processing
   * Verifies that the webhook handler correctly processes
   * different types of blockchain activity
   */
  test('should correctly process event activity', async () => {
    // Set up request with specific activity type
    const testActivity = [{ type: 'test-contract-interaction' }]
    req.body.event.activity = testActivity

    // Call the webhook handler with our mock request and response
    await alchemyWebhook(req, res)

    // Verify Firestore was called to store the raw event
    expect(adminFirestore.getFirestore().collection).toHaveBeenCalledWith(
      'rawEvents'
    )
    // Additional assertions could be added here to verify
    // specific processing of different activity types
  })
})
