// Event processor for FeeManager events
import { logger } from 'firebase-functions'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { getFirestore } from 'firebase-admin/firestore'
import { ethers } from 'ethers'

// Initialize Firebase
const db = getFirestore()

// Define types for event logs and operation data
interface EventLog {
  topics: string[]
  data: string
  block?: {
    number?: number
    timestamp?: number
  }
  transaction?: {
    hash?: string
  }
  account?: {
    address?: string
  }
}

interface FeeManagerEventData {
  eventType: string
  rawEventId: string
  createdAt: Date
  blockNumber: number | null
  blockTimestamp: Date | null
  transactionHash: string | null
  contractAddress: string | null
  operation: {
    code: number
    name: string
  }
  relatedAddress: string
  secondaryAddress: string
  primaryValue: string
  secondaryValue: string
}

interface FeeConfigData {
  treasuryAddress: string
  platformFeeShare: number
  lastUpdated: Date
  lastOperation: string
}

// Event signature and interface for FeeManagerOperation
const eventSignature =
  'FeeManagerOperation(uint8,address,address,uint256,uint256)'

// Event signature hash for FeeManagerOperation
const FEE_MANAGER_OP_SIGNATURE = ethers.keccak256(
  ethers.toUtf8Bytes(eventSignature)
)

// Operation types mapping
const OPERATION_TYPES: Record<number, string> = {
  1: 'TREASURY_UPDATED',
  2: 'SHARE_UPDATED'
}

/**
 * Firebase function that triggers when a new document is created in the rawEvents collection
 * Parses FeeManager events and stores them in the feeEvents collection
 */
export const processFeeManagerEvents = onDocumentCreated(
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
        if (
          !log ||
          !log.topics ||
          !Array.isArray(log.topics) ||
          log.topics.length === 0
        ) {
          logger.debug('Skipping log with no topics')
          continue
        }

        const eventSignature = log.topics[0]
        if (!eventSignature) {
          logger.debug('Skipping log with no event signature')
          continue
        }

        // Check if this is a FeeManagerOperation event
        if (eventSignature === FEE_MANAGER_OP_SIGNATURE) {
          await processFeeManagerOperation(log as EventLog, rawEventId)
        }
      }
    } catch (error) {
      logger.error('Error processing fee manager event:', error)
    }
  }
)

/**
 * Process a FeeManagerOperation event log
 * @param log The log object from the webhook
 * @param rawEventId The ID of the raw event document
 */
async function processFeeManagerOperation (log: EventLog, rawEventId: string) {
  try {
    if (!log || !log.topics || !log.data) {
      logger.error('Invalid log data for FeeManagerOperation')
      return
    }

    // Extract the indexed addresses from topics
    // The relatedAddress is in the second topic (index 1)
    // The secondaryAddress is in the third topic (index 2)
    const relatedAddress =
      log.topics.length > 1
        ? ethers.dataSlice(log.topics[1], 12) // Convert bytes32 to address
        : undefined

    const secondaryAddress =
      log.topics.length > 2
        ? ethers.dataSlice(log.topics[2], 12) // Convert bytes32 to address
        : undefined

    if (!relatedAddress) {
      logger.error('Missing relatedAddress in FeeManagerOperation')
      return
    }

    // Addresses need to be properly formatted with checksum
    const normalizedRelatedAddress = ethers
      .getAddress(relatedAddress)
      .toLowerCase()
    const normalizedSecondaryAddress = secondaryAddress
      ? ethers.getAddress(secondaryAddress).toLowerCase()
      : ethers.ZeroAddress.toLowerCase()

    // Extract data from the non-indexed parameters
    // The data field contains all non-indexed parameters packed together
    const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(
      ['uint8', 'uint256', 'uint256'], // opType, primaryValue, secondaryValue
      log.data
    )

    const opType = Number(decodedData[0])
    const primaryValue = decodedData[1]
    const secondaryValue = decodedData[2]

    // Format the data
    const feeEvent: FeeManagerEventData = {
      eventType: 'FeeManagerOperation',
      rawEventId,
      createdAt: new Date(),
      blockNumber: log.block?.number || null,
      blockTimestamp: log.block?.timestamp
        ? new Date(log.block.timestamp * 1000)
        : null,
      transactionHash: log.transaction?.hash || null,
      contractAddress: log.account?.address || null,
      operation: {
        code: opType,
        name: OPERATION_TYPES[opType] || 'UNKNOWN'
      },
      relatedAddress: normalizedRelatedAddress,
      secondaryAddress: normalizedSecondaryAddress,
      primaryValue: primaryValue.toString(),
      secondaryValue: secondaryValue.toString()
    }

    // Store the fee event
    const docRef = await db.collection('feeEvents').add(feeEvent)
    if (!docRef) {
      logger.error('Failed to create document in feeEvents collection')
      return
    }

    logger.info(`Fee event stored with ID: ${docRef.id}`)

    // Update fee configuration based on operation type
    await updateFeeConfigByOpType(
      opType,
      normalizedRelatedAddress,
      normalizedSecondaryAddress,
      primaryValue.toString(),
      secondaryValue.toString()
    )
  } catch (error) {
    logger.error(`Error processing FeeManagerOperation: ${error}`)
  }
}

/**
 * Updates the fee configuration in the feeConfig collection based on operation type
 * @param opType The operation type code
 * @param relatedAddress The primary address (e.g., old treasury)
 * @param secondaryAddress The secondary address (e.g., new treasury)
 * @param primaryValue The primary value (e.g., old fee share)
 * @param secondaryValue The secondary value (e.g., new fee share)
 */
async function updateFeeConfigByOpType (
  opType: number,
  relatedAddress: string,
  secondaryAddress: string,
  primaryValue: string,
  secondaryValue: string
) {
  try {
    // Reference to the fee configuration document
    // We use a fixed ID for the fee config since there's only one global config
    const feeConfigRef = db.collection('feeConfig').doc('current')

    // Get current fee configuration
    const feeConfigDoc = await feeConfigRef.get()
    const feeConfigExists = feeConfigDoc.exists

    // Initialize config data
    let feeConfigData: FeeConfigData = feeConfigExists
      ? (feeConfigDoc.data() as FeeConfigData)
      : {
          treasuryAddress: '',
          platformFeeShare: 0,
          lastUpdated: new Date(),
          lastOperation: ''
        }

    // Handle different operation types
    switch (opType) {
      case 1: // TREASURY_UPDATED
        // Old treasury in relatedAddress, new treasury in secondaryAddress
        feeConfigData = {
          ...feeConfigData,
          treasuryAddress: secondaryAddress,
          lastUpdated: new Date(),
          lastOperation: 'TREASURY_UPDATED'
        }

        await feeConfigRef.set(feeConfigData, { merge: true })
        logger.info(`Treasury address updated to ${secondaryAddress}`)
        break

      case 2: // SHARE_UPDATED
        // Old share in primaryValue, new share in secondaryValue
        feeConfigData = {
          ...feeConfigData,
          platformFeeShare: parseInt(secondaryValue),
          lastUpdated: new Date(),
          lastOperation: 'SHARE_UPDATED'
        }

        await feeConfigRef.set(feeConfigData, { merge: true })
        logger.info(`Platform fee share updated to ${secondaryValue}`)
        break

      default:
        logger.warn(`Unknown operation type: ${opType}`)
    }
  } catch (error) {
    logger.error(`Error updating fee configuration: ${error}`)
  }
}
