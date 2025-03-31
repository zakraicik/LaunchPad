// Event processor for CampaignContractFactory events
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

interface FactoryOperationEventData {
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
  campaignAddress: string
  creator: string
  campaignId: string
}

interface CampaignData {
  campaignId: string
  campaignAddress: string
  creator: string
  createdAt: Date
  status: string
  blockNumber: number | null
  transactionHash: string | null
}

// Event signature for FactoryOperation
const factoryOpSignature = 'FactoryOperation(uint8,address,address,bytes32)'

// Event signature hash for FactoryOperation
const FACTORY_OP_SIGNATURE = ethers.keccak256(
  ethers.toUtf8Bytes(factoryOpSignature)
)

// Operation types mapping
const OPERATION_TYPES: Record<number, string> = {
  1: 'CAMPAIGN_CREATED'
}

/**
 * Firebase function that triggers when a new document is created in the rawEvents collection
 * Parses CampaignContractFactory events and stores them in the factoryEvents collection
 */
export const processCampaignFactoryEvents = onDocumentCreated(
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

        // Check if this is a FactoryOperation event
        if (eventSignature === FACTORY_OP_SIGNATURE) {
          await processFactoryOperation(log as EventLog, rawEventId)
        }
      }
    } catch (error) {
      logger.error('Error processing campaign factory event:', error)
    }
  }
)

/**
 * Process a FactoryOperation event log
 * @param log The log object from the webhook
 * @param rawEventId The ID of the raw event document
 */
async function processFactoryOperation (log: EventLog, rawEventId: string) {
  try {
    if (!log || !log.topics || !log.data) {
      logger.error('Invalid log data for FactoryOperation')
      return
    }

    // Extract the indexed parameters from topics
    // campaignAddress is in the second topic (index 1)
    // creator is in the third topic (index 2)
    // campaignId is in the fourth topic (index 3) as bytes32
    const campaignAddress =
      log.topics.length > 1
        ? ethers.dataSlice(log.topics[1], 12) // Convert bytes32 to address
        : undefined

    const creator =
      log.topics.length > 2
        ? ethers.dataSlice(log.topics[2], 12) // Convert bytes32 to address
        : undefined

    const campaignId =
      log.topics.length > 3
        ? log.topics[3] // bytes32 as is
        : undefined

    if (!campaignAddress || !creator || !campaignId) {
      logger.error('Missing indexed parameters in FactoryOperation')
      return
    }

    // Addresses need to be properly formatted with checksum
    const normalizedCampaignAddress = ethers
      .getAddress(campaignAddress)
      .toLowerCase()
    const normalizedCreator = ethers.getAddress(creator).toLowerCase()

    // Extract data from the non-indexed parameters
    const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(
      ['uint8'], // opType
      log.data
    )

    const opType = Number(decodedData[0])

    // Format the data
    const factoryEvent: FactoryOperationEventData = {
      eventType: 'FactoryOperation',
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
      campaignAddress: normalizedCampaignAddress,
      creator: normalizedCreator,
      campaignId
    }

    // Store the factory event
    const docRef = await db.collection('factoryEvents').add(factoryEvent)
    if (!docRef) {
      logger.error('Failed to create document in factoryEvents collection')
      return
    }

    logger.info(`Factory event stored with ID: ${docRef.id}`)

    // If this is a campaign creation event, store the campaign data
    if (opType === 1) {
      // CAMPAIGN_CREATED
      await storeCampaignData(
        campaignId,
        normalizedCampaignAddress,
        normalizedCreator,
        log.block?.number || null,
        log.transaction?.hash || null,
        log.block?.timestamp ? new Date(log.block.timestamp * 1000) : new Date()
      )
    }
  } catch (error) {
    logger.error(`Error processing FactoryOperation: ${error}`)
  }
}

/**
 * Stores new campaign data in the campaigns collection
 * @param campaignId Unique identifier of the campaign
 * @param campaignAddress Address of the campaign contract
 * @param creator Address of the campaign creator
 * @param blockNumber Block number where the campaign was created
 * @param transactionHash Transaction hash of the campaign creation
 * @param timestamp Timestamp when the campaign was created
 */
async function storeCampaignData (
  campaignId: string,
  campaignAddress: string,
  creator: string,
  blockNumber: number | null,
  transactionHash: string | null,
  timestamp: Date
) {
  try {
    // Create campaign data record
    const campaignData: CampaignData = {
      campaignId,
      campaignAddress,
      creator,
      createdAt: timestamp,
      status: 'DRAFT', // Initial status for newly created campaigns
      blockNumber,
      transactionHash
    }

    // Store in campaigns collection using campaignId as document ID
    // This makes it easy to reference and update campaign data later
    await db.collection('campaigns').doc(campaignId).set(campaignData)
    logger.info(`Campaign data stored with ID: ${campaignId}`)

    // Also create a reference by address for easier lookups
    await db.collection('campaignAddresses').doc(campaignAddress).set({
      campaignId,
      creator,
      createdAt: timestamp
    })
    logger.info(`Campaign address reference created for: ${campaignAddress}`)
  } catch (error) {
    logger.error(`Error storing campaign data: ${error}`)
  }
}
