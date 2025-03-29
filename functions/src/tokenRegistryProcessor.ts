// Event processor for TokenRegistry events
import { logger } from 'firebase-functions'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { ethers } from 'ethers'

// Initialize Firebase
initializeApp()
const db = getFirestore()

// Event signature and interface for TokenRegistryOperation
const eventFragment = [
  'event TokenRegistryOperation(uint8 opType, address indexed token, uint256 value, uint8 decimals)'
]
const eventInterface = new ethers.Interface(eventFragment)

// Event signature hash for TokenRegistryOperation
const TOKEN_REGISTRY_OP_SIGNATURE =
  '0x182d4d874fd1e70e5b453811d53b80d9193e3bd36704cef2fe5da37175b46825'

// Operation types mapping
const OPERATION_TYPES = {
  1: 'TOKEN_ADDED',
  2: 'TOKEN_REMOVED',
  3: 'TOKEN_SUPPORT_DISABLED',
  4: 'TOKEN_SUPPORT_ENABLED',
  5: 'MIN_CONTRIBUTION_UPDATED'
}

/**
 * Firebase function that triggers when a new document is created in the rawEvents collection
 * Parses TokenRegistry events and stores them in the tokenEvents collection
 */
export const processTokenRegistryEvents = onDocumentCreated(
  'rawEvents/{docId}',
  async event => {
    try {
      // Get the raw event data
      const rawEvent = event.data?.data()
      if (!rawEvent || !rawEvent.data) {
        logger.warn('No data found in raw event')
        return
      }

      const rawEventId = event.params.docId
      if (!rawEventId) {
        logger.warn('No document ID found in event params')
        return
      }

      logger.info(`Processing raw event with ID: ${rawEventId}`)

      // Extract logs from the webhook data
      const logs = rawEvent.data?.event?.data?.logs
      if (!logs || !Array.isArray(logs)) {
        logger.info('No logs found in event data')
        return
      }

      // Process each log
      for (const log of logs) {
        if (!log || !log.topics || log.topics.length === 0) {
          logger.debug('Skipping log with no topics')
          continue
        }

        const eventSignature = log.topics[0]
        if (!eventSignature) {
          logger.debug('Skipping log with no event signature')
          continue
        }

        // Check if this is a TokenRegistryOperation event
        if (eventSignature === TOKEN_REGISTRY_OP_SIGNATURE) {
          await processTokenRegistryOperation(log, rawEventId)
        }
      }
    } catch (error) {
      logger.error('Error processing token registry event:', error)
    }
  }
)

/**
 * Process a TokenRegistryOperation event log
 * @param log The log object from the webhook
 * @param rawEventId The ID of the raw event document
 */
async function processTokenRegistryOperation (log: any, rawEventId: string) {
  try {
    if (!log || !log.topics || !log.data) {
      logger.error('Invalid log data for TokenRegistryOperation')
      return
    }

    // Parse the log using ethers
    const parsedLog = eventInterface.parseLog({
      topics: log.topics,
      data: log.data
    })

    if (!parsedLog || !parsedLog.args) {
      logger.error(
        'Failed to parse TokenRegistryOperation log or missing arguments'
      )
      return
    }

    // Get operation type
    const opType = Number(parsedLog.args[0])
    if (opType === undefined || opType === null) {
      logger.error('Missing operation type in TokenRegistryOperation')
      return
    }

    // Get token address from the indexed parameter
    const tokenAddress = parsedLog.args[1]
    if (!tokenAddress) {
      logger.error('Missing token address in TokenRegistryOperation')
      return
    }
    const normalizedTokenAddress = tokenAddress.toLowerCase()

    // Get value (minimum contribution amount in smallest units)
    const value = parsedLog.args[2]
    if (value === undefined || value === null) {
      logger.error('Missing value in TokenRegistryOperation')
      return
    }

    // Get decimals
    const decimals = Number(parsedLog.args[3])
    if (decimals === undefined || decimals === null) {
      logger.error('Missing decimals in TokenRegistryOperation')
      return
    }

    // Format the data
    const tokenEvent = {
      eventType: 'TokenRegistryOperation',
      rawEventId,
      createdAt: new Date(),
      blockNumber: log.block?.number,
      blockTimestamp: log.block?.timestamp
        ? new Date(log.block.timestamp * 1000)
        : null,
      transactionHash: log.transaction?.hash,
      contractAddress: log.account?.address,
      operation: {
        code: opType,
        name:
          OPERATION_TYPES[opType as keyof typeof OPERATION_TYPES] || 'UNKNOWN'
      },
      token: normalizedTokenAddress,
      value: value.toString(),
      // Format value according to decimals for certain operations
      formattedValue:
        opType === 1 || opType === 5
          ? ethers.formatUnits(value, decimals)
          : '0',
      decimals
    }

    // Store the token event
    const docRef = await db.collection('tokenEvents').add(tokenEvent)
    if (!docRef) {
      logger.error('Failed to create document in tokenEvents collection')
      return
    }

    logger.info(`Token event stored with ID: ${docRef.id}`)

    // Update token record based on operation type
    await updateTokenRecordByOpType(
      opType,
      normalizedTokenAddress,
      value.toString(),
      decimals
    )
  } catch (error) {
    logger.error(`Error processing TokenRegistryOperation: ${error}`)
  }
}

/**
 * Updates or creates a token record in the tokens collection based on operation type
 * @param opType The operation type code
 * @param tokenAddress The token address
 * @param value The value (e.g., minimum contribution amount)
 * @param decimals The token decimals
 */
async function updateTokenRecordByOpType (
  opType: number,
  tokenAddress: string,
  value: string,
  decimals: number
) {
  try {
    if (!tokenAddress) {
      logger.error('Invalid token address for updateTokenRecordByOpType')
      return
    }

    // Reference to the token document
    const tokenRef = db.collection('tokens').doc(tokenAddress)
    if (!tokenRef) {
      logger.error('Failed to create reference to token document')
      return
    }

    // Check if the token document exists
    const tokenDoc = await tokenRef.get()
    const tokenExists = tokenDoc.exists

    // Handle different operation types
    switch (opType) {
      case 1: // TOKEN_ADDED
        // Create or update token record
        await tokenRef.set(
          {
            address: tokenAddress,
            minimumContribution: value,
            formattedMinimumContribution: ethers.formatUnits(value, decimals),
            decimals,
            isSupported: true,
            lastUpdated: new Date(),
            lastOperation: 'TOKEN_ADDED'
          },
          { merge: true }
        )
        logger.info(`Token record created/updated for ${tokenAddress}`)
        break

      case 2: // TOKEN_REMOVED
        if (tokenExists) {
          // Delete the token record
          await tokenRef.delete()
          logger.info(`Token record removed for ${tokenAddress}`)
        } else {
          logger.warn(`Attempted to remove non-existent token: ${tokenAddress}`)
        }
        break

      case 3: // TOKEN_SUPPORT_DISABLED
        if (tokenExists) {
          await tokenRef.update({
            isSupported: false,
            lastUpdated: new Date(),
            lastOperation: 'TOKEN_SUPPORT_DISABLED'
          })
          logger.info(`Token support disabled for ${tokenAddress}`)
        } else {
          logger.warn(
            `Attempted to disable support for non-existent token: ${tokenAddress}`
          )
        }
        break

      case 4: // TOKEN_SUPPORT_ENABLED
        if (tokenExists) {
          await tokenRef.update({
            isSupported: true,
            lastUpdated: new Date(),
            lastOperation: 'TOKEN_SUPPORT_ENABLED'
          })
          logger.info(`Token support enabled for ${tokenAddress}`)
        } else {
          // Create a new token record if it doesn't exist
          await tokenRef.set({
            address: tokenAddress,
            isSupported: true,
            minimumContribution: value,
            formattedMinimumContribution: ethers.formatUnits(value, decimals),
            decimals,
            lastUpdated: new Date(),
            lastOperation: 'TOKEN_SUPPORT_ENABLED'
          })
          logger.info(
            `New token record created with support enabled for ${tokenAddress}`
          )
        }
        break

      case 5: // MIN_CONTRIBUTION_UPDATED
        if (tokenExists) {
          await tokenRef.update({
            minimumContribution: value,
            formattedMinimumContribution: ethers.formatUnits(value, decimals),
            lastUpdated: new Date(),
            lastOperation: 'MIN_CONTRIBUTION_UPDATED'
          })
          logger.info(`Minimum contribution updated for ${tokenAddress}`)
        } else {
          logger.warn(
            `Attempted to update minimum contribution for non-existent token: ${tokenAddress}`
          )
        }
        break

      default:
        logger.warn(
          `Unknown operation type: ${opType} for token ${tokenAddress}`
        )
    }
  } catch (error) {
    logger.error(`Error updating token record by operation type: ${error}`)
  }
}
