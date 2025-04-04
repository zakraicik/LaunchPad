/**
 * Event processor for CampaignEventCollector events
 * This module processes blockchain events emitted by the CampaignEventCollector contract
 * and stores them in appropriate Firestore collections.
 * @module campaignEventProcessor
 */

import { logger } from 'firebase-functions'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import admin from 'firebase-admin'
import { ethers } from 'ethers'
import {
  AlchemyWebhookResponse,
  EnhancedEventLog,
  createEnhancedEventLog
} from './shared-types'

// Initialize Firebase
const db = admin.firestore()

/**
 * Base interface for all campaign events
 * Contains common fields shared across all campaign event types
 * @interface CampaignEventBase
 */
interface CampaignEventBase {
  /** Type of the event */
  eventType: string
  /** ID of the raw event document */
  rawEventId: string
  /** When the event was processed */
  createdAt: Date
  /** Block number where the event occurred */
  blockNumber: number | null
  /** Timestamp of the block */
  blockTimestamp: Date | null
  /** Hash of the transaction */
  transactionHash: string | null
  /** Address of the contract that emitted the event */
  contractAddress: string | null
  /** Unique identifier of the campaign */
  campaignId: string
  /** Address of the campaign contract */
  campaignAddress: string
}

/**
 * Interface for Contribution event data
 * @interface ContributionEventData
 * @extends {CampaignEventBase}
 */
interface ContributionEventData extends CampaignEventBase {
  /** Address of the contributor */
  contributor: string
  /** Amount contributed (in wei) */
  amount: string
}

/**
 * Interface for RefundIssued event data
 * @interface RefundIssuedEventData
 * @extends {CampaignEventBase}
 */
interface RefundIssuedEventData extends CampaignEventBase {
  /** Address of the contributor receiving the refund */
  contributor: string
  /** Amount refunded (in wei) */
  amount: string
}

/**
 * Interface for FundsClaimed event data
 * @interface FundsClaimedEventData
 * @extends {CampaignEventBase}
 */
interface FundsClaimedEventData extends CampaignEventBase {
  /** Address that initiated the claim */
  initiator: string
  /** Amount claimed (in wei) */
  amount: string
}

/**
 * Interface for CampaignStatusChanged event data
 * @interface CampaignStatusChangedEventData
 * @extends {CampaignEventBase}
 */
interface CampaignStatusChangedEventData extends CampaignEventBase {
  /** Previous status code */
  oldStatus: number
  /** New status code */
  newStatus: number
  /** Reason code for the status change */
  reason: number
}

/**
 * Interface for AdminOverrideSet event data
 * @interface AdminOverrideSetEventData
 * @extends {CampaignEventBase}
 */
interface AdminOverrideSetEventData extends CampaignEventBase {
  /** New override status */
  status: boolean
  /** Address of the admin who set the override */
  admin: string
}

/**
 * Interface for FundsOperation event data
 * @interface FundsOperationEventData
 * @extends {CampaignEventBase}
 */
interface FundsOperationEventData extends CampaignEventBase {
  /** Address of the token involved in the operation */
  token: string
  /** Amount involved in the operation (in wei) */
  amount: string
  /** Type of funds operation */
  opType: number
  /** Address that initiated the operation */
  initiator: string
}

/**
 * Interface for CampaignEventCollector operation event data
 * @interface EventCollectorOperationData
 */
interface EventCollectorOperationData {
  /** Type of the event */
  eventType: string
  /** ID of the raw event document */
  rawEventId: string
  /** When the event was processed */
  createdAt: Date
  /** Block number where the event occurred */
  blockNumber: number | null
  /** Timestamp of the block */
  blockTimestamp: Date | null
  /** Hash of the transaction */
  transactionHash: string | null
  /** Address of the contract that emitted the event */
  contractAddress: string | null
  /** Operation details */
  operation: {
    /** Operation code */
    code: number
    /** Human-readable operation name */
    name: string
  }
  /** Address of the sender */
  sender: string
  /** Target address of the operation */
  targetAddress: string
}

// Define event signatures
const CONTRIBUTION_SIGNATURE = 'Contribution(address,uint256,bytes32,address)'
const REFUND_ISSUED_SIGNATURE = 'RefundIssued(address,uint256,bytes32,address)'
const FUNDS_CLAIMED_SIGNATURE = 'FundsClaimed(address,uint256,bytes32,address)'
const CAMPAIGN_STATUS_CHANGED_SIGNATURE =
  'CampaignStatusChanged(uint8,uint8,uint8,bytes32,address)'
const ADMIN_OVERRIDE_SET_SIGNATURE =
  'AdminOverrideSet(bool,address,bytes32,address)'
const FUNDS_OPERATION_SIGNATURE =
  'FundsOperation(address,uint256,uint8,address,bytes32,address)'
const EVENT_COLLECTOR_OPERATION_SIGNATURE =
  'CampaignEventCollectorOperation(uint8,address,address)'

// Event signature hashes
const CONTRIBUTION_SIGNATURE_HASH = ethers.keccak256(
  ethers.toUtf8Bytes(CONTRIBUTION_SIGNATURE)
)
const REFUND_ISSUED_SIGNATURE_HASH = ethers.keccak256(
  ethers.toUtf8Bytes(REFUND_ISSUED_SIGNATURE)
)
const FUNDS_CLAIMED_SIGNATURE_HASH = ethers.keccak256(
  ethers.toUtf8Bytes(FUNDS_CLAIMED_SIGNATURE)
)
const CAMPAIGN_STATUS_CHANGED_SIGNATURE_HASH = ethers.keccak256(
  ethers.toUtf8Bytes(CAMPAIGN_STATUS_CHANGED_SIGNATURE)
)
const ADMIN_OVERRIDE_SET_SIGNATURE_HASH = ethers.keccak256(
  ethers.toUtf8Bytes(ADMIN_OVERRIDE_SET_SIGNATURE)
)
const FUNDS_OPERATION_SIGNATURE_HASH = ethers.keccak256(
  ethers.toUtf8Bytes(FUNDS_OPERATION_SIGNATURE)
)
const EVENT_COLLECTOR_OPERATION_SIGNATURE_HASH = ethers.keccak256(
  ethers.toUtf8Bytes(EVENT_COLLECTOR_OPERATION_SIGNATURE)
)

// Operation types mapping for CampaignEventCollectorOperation
const EVENT_COLLECTOR_OPERATION_TYPES: Record<number, string> = {
  1: 'FACTORY_AUTHORIZED',
  2: 'FACTORY_DEAUTHORIZED',
  3: 'CAMPAIGN_AUTHORIZED',
  4: 'CAMPAIGN_DEAUTHORIZED'
}

// Status codes mapping
const CAMPAIGN_STATUS_TYPES: Record<number, string> = {
  0: 'DRAFT',
  1: 'ACTIVE',
  2: 'COMPLETE'
}

// Status change reason codes
const STATUS_CHANGE_REASONS: Record<number, string> = {
  0: 'CREATED',
  1: 'GOAL_REACHED',
  2: 'DEADLINE_PASSED'
}

// Funds operation types
const FUNDS_OPERATION_TYPES: Record<number, string> = {
  1: 'DEPOSIT',
  2: 'WITHDRAWAL'
}

/**
 * Firebase function that triggers when a new document is created in the rawEvents collection
 * Parses CampaignEventCollector events and stores them in appropriate collections
 * @function processCampaignEvents
 * @param {Object} event - The Firebase event object
 * @param {Object} event.data - The document data
 * @param {Object} event.params - The function parameters
 * @param {string} event.params.docId - The document ID
 */
export const processCampaignEvents = onDocumentCreated(
  'rawEvents/{docId}',
  async event => {
    try {
      // Get the raw event data
      const rawEvent = event.data?.data()
      if (!rawEvent) {
        logger.warn('No data found in raw event')
        return
      }

      const rawEventId = event.params.docId
      if (!rawEventId) {
        logger.warn('No document ID found in event params')
        return
      }

      logger.info(`Processing raw event with ID: ${rawEventId}`)

      // Parse the webhook data
      if (!rawEvent.data) {
        logger.warn('No data found in raw event')
        return
      }

      const webhookData = rawEvent.data as AlchemyWebhookResponse

      // Check for required data
      if (!webhookData?.event?.data?.block?.logs) {
        logger.warn('Invalid Alchemy webhook structure - missing logs')
        return
      }

      // Process logs from the Alchemy webhook
      const logs = webhookData.event.data.block.logs
      const blockNumber = webhookData.event.data.block.number
      const blockTimestamp = webhookData.event.data.block.timestamp

      logger.info(`Found ${logs.length} logs to process from Alchemy webhook`)

      // Process each log
      for (const log of logs) {
        if (!log?.topics?.length) {
          logger.debug('Skipping log with no topics')
          continue
        }

        const eventSignature = log.topics[0]
        if (!eventSignature) {
          logger.debug('Skipping log with no event signature')
          continue
        }

        // Use the shared utility function to create the enhanced log
        const enhancedLog = createEnhancedEventLog(
          log,
          blockNumber,
          blockTimestamp
        )

        // Check which event type this is and process accordingly
        switch (eventSignature) {
          case CONTRIBUTION_SIGNATURE_HASH:
            await processContributionEvent(enhancedLog, rawEventId)
            break
          case REFUND_ISSUED_SIGNATURE_HASH:
            await processRefundIssuedEvent(enhancedLog, rawEventId)
            break
          case FUNDS_CLAIMED_SIGNATURE_HASH:
            await processFundsClaimedEvent(enhancedLog, rawEventId)
            break
          case CAMPAIGN_STATUS_CHANGED_SIGNATURE_HASH:
            await processCampaignStatusChangedEvent(enhancedLog, rawEventId)
            break
          case ADMIN_OVERRIDE_SET_SIGNATURE_HASH:
            await processAdminOverrideSetEvent(enhancedLog, rawEventId)
            break
          case FUNDS_OPERATION_SIGNATURE_HASH:
            await processFundsOperationEvent(enhancedLog, rawEventId)
            break
          case EVENT_COLLECTOR_OPERATION_SIGNATURE_HASH:
            await processEventCollectorOperationEvent(enhancedLog, rawEventId)
            break
          default:
            logger.debug(`Unknown event signature: ${eventSignature}`)
        }
      }
    } catch (error) {
      logger.error('Error processing campaign event:', error)
    }
  }
)

/**
 * Process a Contribution event log
 * @async
 * @function processContributionEvent
 * @param {EnhancedEventLog} log - The enhanced log object
 * @param {string} rawEventId - The ID of the raw event document
 */
async function processContributionEvent (
  log: EnhancedEventLog,
  rawEventId: string
) {
  try {
    if (!log || !log.topics || !log.data) {
      logger.error('Invalid log data for Contribution event')
      return
    }

    // For Contribution(address indexed contributor, uint256 amount, bytes32 indexed campaignId, address indexed campaignAddress)
    // topics[0] = event signature
    // topics[1] = contributor (indexed)
    // topics[2] = campaignId (indexed)
    // topics[3] = campaignAddress (indexed)
    // data = amount (not indexed)

    // Extract indexed parameters from topics
    const contributor =
      log.topics.length > 1
        ? ethers.getAddress(ethers.dataSlice(log.topics[1], 12)).toLowerCase()
        : ''

    const campaignId =
      log.topics.length > 2 ? `0x${log.topics[2].slice(2)}` : ''

    const campaignAddress =
      log.topics.length > 3
        ? ethers.getAddress(ethers.dataSlice(log.topics[3], 12)).toLowerCase()
        : ''

    // Extract non-indexed parameters from data
    const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(
      ['uint256'], // amount
      log.data
    )

    const amount = decodedData[0]

    // Create the event data object
    const contributionEvent: ContributionEventData = {
      eventType: 'Contribution',
      rawEventId,
      createdAt: new Date(),
      blockNumber: log.block?.number || null,
      blockTimestamp: log.block?.timestamp
        ? new Date(log.block.timestamp * 1000)
        : null,
      transactionHash: log.transaction?.hash || null,
      contractAddress: log.account?.address || null,
      contributor,
      amount: amount.toString(),
      campaignId,
      campaignAddress
    }

    // Store the contribution event
    const docRef = await db
      .collection('contributionEvents')
      .add(contributionEvent)
    logger.info(`Contribution event stored with ID: ${docRef.id}`)

    // Update campaign contributions summary
    await updateCampaignContributions(
      campaignId,
      campaignAddress,
      amount.toString()
    )
  } catch (error) {
    logger.error(`Error processing Contribution event: ${error}`)
  }
}

/**
 * Process a RefundIssued event log
 * @async
 * @function processRefundIssuedEvent
 * @param {EnhancedEventLog} log - The enhanced log object
 * @param {string} rawEventId - The ID of the raw event document
 */
async function processRefundIssuedEvent (
  log: EnhancedEventLog,
  rawEventId: string
) {
  try {
    if (!log || !log.topics || !log.data) {
      logger.error('Invalid log data for RefundIssued event')
      return
    }

    // For RefundIssued(address indexed contributor, uint256 amount, bytes32 indexed campaignId, address indexed campaignAddress)
    // topics[0] = event signature
    // topics[1] = contributor (indexed)
    // topics[2] = campaignId (indexed)
    // topics[3] = campaignAddress (indexed)
    // data = amount (not indexed)

    // Extract indexed parameters from topics
    const contributor =
      log.topics.length > 1
        ? ethers.getAddress(ethers.dataSlice(log.topics[1], 12)).toLowerCase()
        : ''

    const campaignId =
      log.topics.length > 2 ? `0x${log.topics[2].slice(2)}` : ''

    const campaignAddress =
      log.topics.length > 3
        ? ethers.getAddress(ethers.dataSlice(log.topics[3], 12)).toLowerCase()
        : ''

    // Extract non-indexed parameters from data
    const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(
      ['uint256'], // amount
      log.data
    )

    const amount = decodedData[0]

    // Create the event data object
    const refundEvent: RefundIssuedEventData = {
      eventType: 'RefundIssued',
      rawEventId,
      createdAt: new Date(),
      blockNumber: log.block?.number || null,
      blockTimestamp: log.block?.timestamp
        ? new Date(log.block.timestamp * 1000)
        : null,
      transactionHash: log.transaction?.hash || null,
      contractAddress: log.account?.address || null,
      contributor,
      amount: amount.toString(),
      campaignId,
      campaignAddress
    }

    // Store the refund event
    const docRef = await db.collection('refundEvents').add(refundEvent)
    logger.info(`Refund event stored with ID: ${docRef.id}`)

    // Update campaign refunds summary
    await updateCampaignRefunds(campaignId, campaignAddress, amount.toString())
  } catch (error) {
    logger.error(`Error processing RefundIssued event: ${error}`)
  }
}

/**
 * Process a FundsClaimed event log
 * @async
 * @function processFundsClaimedEvent
 * @param {EnhancedEventLog} log - The enhanced log object
 * @param {string} rawEventId - The ID of the raw event document
 */
async function processFundsClaimedEvent (
  log: EnhancedEventLog,
  rawEventId: string
) {
  try {
    if (!log || !log.topics || !log.data) {
      logger.error('Invalid log data for FundsClaimed event')
      return
    }

    // For FundsClaimed(address indexed initiator, uint256 amount, bytes32 indexed campaignId, address indexed campaignAddress)
    // topics[0] = event signature
    // topics[1] = initiator (indexed)
    // topics[2] = campaignId (indexed)
    // topics[3] = campaignAddress (indexed)
    // data = amount (not indexed)

    // Extract indexed parameters from topics
    const initiator =
      log.topics.length > 1
        ? ethers.getAddress(ethers.dataSlice(log.topics[1], 12)).toLowerCase()
        : ''

    const campaignId =
      log.topics.length > 2 ? `0x${log.topics[2].slice(2)}` : ''

    const campaignAddress =
      log.topics.length > 3
        ? ethers.getAddress(ethers.dataSlice(log.topics[3], 12)).toLowerCase()
        : ''

    // Extract non-indexed parameters from data
    const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(
      ['uint256'], // amount
      log.data
    )

    const amount = decodedData[0]

    // Create the event data object
    const claimEvent: FundsClaimedEventData = {
      eventType: 'FundsClaimed',
      rawEventId,
      createdAt: new Date(),
      blockNumber: log.block?.number || null,
      blockTimestamp: log.block?.timestamp
        ? new Date(log.block.timestamp * 1000)
        : null,
      transactionHash: log.transaction?.hash || null,
      contractAddress: log.account?.address || null,
      initiator,
      amount: amount.toString(),
      campaignId,
      campaignAddress
    }

    // Store the claim event
    const docRef = await db.collection('claimEvents').add(claimEvent)
    logger.info(`Claim event stored with ID: ${docRef.id}`)

    // Update campaign claims summary
    await updateCampaignClaims(campaignId, campaignAddress, amount.toString())
  } catch (error) {
    logger.error(`Error processing FundsClaimed event: ${error}`)
  }
}

/**
 * Process a CampaignStatusChanged event log
 * @async
 * @function processCampaignStatusChangedEvent
 * @param {EnhancedEventLog} log - The enhanced log object
 * @param {string} rawEventId - The ID of the raw event document
 */
async function processCampaignStatusChangedEvent (
  log: EnhancedEventLog,
  rawEventId: string
) {
  try {
    if (!log || !log.topics || !log.data) {
      logger.error('Invalid log data for CampaignStatusChanged event')
      return
    }

    // For CampaignStatusChanged(uint8 oldStatus, uint8 newStatus, uint8 reason, bytes32 indexed campaignId, address indexed campaignAddress)
    // topics[0] = event signature
    // topics[1] = campaignId (indexed)
    // topics[2] = campaignAddress (indexed)
    // data = oldStatus, newStatus, reason (not indexed)

    // Extract indexed parameters from topics
    const campaignId =
      log.topics.length > 1 ? `0x${log.topics[1].slice(2)}` : ''

    const campaignAddress =
      log.topics.length > 2
        ? ethers.getAddress(ethers.dataSlice(log.topics[2], 12)).toLowerCase()
        : ''

    // Extract non-indexed parameters from data
    const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(
      ['uint8', 'uint8', 'uint8'], // oldStatus, newStatus, reason
      log.data
    )

    const oldStatus = Number(decodedData[0])
    const newStatus = Number(decodedData[1])
    const reason = Number(decodedData[2])

    // Create the event data object
    const statusEvent: CampaignStatusChangedEventData = {
      eventType: 'CampaignStatusChanged',
      rawEventId,
      createdAt: new Date(),
      blockNumber: log.block?.number || null,
      blockTimestamp: log.block?.timestamp
        ? new Date(log.block.timestamp * 1000)
        : null,
      transactionHash: log.transaction?.hash || null,
      contractAddress: log.account?.address || null,
      oldStatus,
      newStatus,
      reason,
      campaignId,
      campaignAddress
    }

    // Store the status change event
    const docRef = await db.collection('campaignStatusEvents').add(statusEvent)
    logger.info(`Campaign status change event stored with ID: ${docRef.id}`)

    // Update campaign status in campaigns collection
    await updateCampaignStatus(campaignId, campaignAddress, newStatus, reason)
  } catch (error) {
    logger.error(`Error processing CampaignStatusChanged event: ${error}`)
  }
}

/**
 * Process an AdminOverrideSet event log
 * @async
 * @function processAdminOverrideSetEvent
 * @param {EnhancedEventLog} log - The enhanced log object
 * @param {string} rawEventId - The ID of the raw event document
 */
async function processAdminOverrideSetEvent (
  log: EnhancedEventLog,
  rawEventId: string
) {
  try {
    if (!log || !log.topics || !log.data) {
      logger.error('Invalid log data for AdminOverrideSet event')
      return
    }

    // For AdminOverrideSet(bool indexed status, address indexed admin, bytes32 indexed campaignId, address campaignAddress)
    // topics[0] = event signature
    // topics[1] = status (indexed boolean)
    // topics[2] = admin (indexed)
    // topics[3] = campaignId (indexed)
    // data = campaignAddress (not indexed)

    // Extract indexed parameters from topics
    // For boolean indexed param, it's padded to 32 bytes with either 0s (false) or 1 at the end (true)
    const status =
      log.topics.length > 1
        ? ethers.dataSlice(log.topics[1], 31, 32) === '0x01'
        : false

    const admin =
      log.topics.length > 2
        ? ethers.getAddress(ethers.dataSlice(log.topics[2], 12)).toLowerCase()
        : ''

    const campaignId =
      log.topics.length > 3 ? `0x${log.topics[3].slice(2)}` : ''

    // Extract non-indexed parameters from data
    const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(
      ['address'], // campaignAddress
      log.data
    )

    const campaignAddress = ethers.getAddress(decodedData[0]).toLowerCase()

    // Create the event data object
    const overrideEvent: AdminOverrideSetEventData = {
      eventType: 'AdminOverrideSet',
      rawEventId,
      createdAt: new Date(),
      blockNumber: log.block?.number || null,
      blockTimestamp: log.block?.timestamp
        ? new Date(log.block.timestamp * 1000)
        : null,
      transactionHash: log.transaction?.hash || null,
      contractAddress: log.account?.address || null,
      status,
      admin,
      campaignId,
      campaignAddress
    }

    // Store the admin override event
    const docRef = await db.collection('adminOverrideEvents').add(overrideEvent)
    logger.info(`Admin override event stored with ID: ${docRef.id}`)

    // Update campaign admin override status
    await updateCampaignAdminOverride(
      campaignId,
      campaignAddress,
      status,
      admin
    )
  } catch (error) {
    logger.error(`Error processing AdminOverrideSet event: ${error}`)
  }
}

/**
 * Process a FundsOperation event log
 * @async
 * @function processFundsOperationEvent
 * @param {EnhancedEventLog} log - The enhanced log object
 * @param {string} rawEventId - The ID of the raw event document
 */
async function processFundsOperationEvent (
  log: EnhancedEventLog,
  rawEventId: string
) {
  try {
    if (!log || !log.topics || !log.data) {
      logger.error('Invalid log data for FundsOperation event')
      return
    }

    // For FundsOperation(address indexed token, uint256 amount, uint8 opType, address initiator, bytes32 indexed campaignId, address indexed campaignAddress)
    // topics[0] = event signature
    // topics[1] = token (indexed)
    // topics[2] = campaignId (indexed)
    // topics[3] = campaignAddress (indexed)
    // data = amount, opType, initiator (not indexed)

    // Extract indexed parameters from topics
    const token =
      log.topics.length > 1
        ? ethers.getAddress(ethers.dataSlice(log.topics[1], 12)).toLowerCase()
        : ''

    const campaignId =
      log.topics.length > 2 ? `0x${log.topics[2].slice(2)}` : ''

    const campaignAddress =
      log.topics.length > 3
        ? ethers.getAddress(ethers.dataSlice(log.topics[3], 12)).toLowerCase()
        : ''

    // Extract non-indexed parameters from data
    const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(
      ['uint256', 'uint8', 'address'], // amount, opType, initiator
      log.data
    )

    const amount = decodedData[0]
    const opType = Number(decodedData[1])
    const initiator = ethers.getAddress(decodedData[2]).toLowerCase()

    // Create the event data object
    const fundsOpEvent: FundsOperationEventData = {
      eventType: 'FundsOperation',
      rawEventId,
      createdAt: new Date(),
      blockNumber: log.block?.number || null,
      blockTimestamp: log.block?.timestamp
        ? new Date(log.block.timestamp * 1000)
        : null,
      transactionHash: log.transaction?.hash || null,
      contractAddress: log.account?.address || null,
      token,
      amount: amount.toString(),
      opType,
      initiator,
      campaignId,
      campaignAddress
    }

    // Store the funds operation event
    const docRef = await db.collection('fundsOperationEvents').add(fundsOpEvent)
    logger.info(`Funds operation event stored with ID: ${docRef.id}`)

    // Update campaign funds based on operation type
    await updateCampaignFunds(
      campaignId,
      campaignAddress,
      token,
      amount.toString(),
      opType
    )
  } catch (error) {
    logger.error(`Error processing FundsOperation event: ${error}`)
  }
}

/**
 * Process a CampaignEventCollectorOperation event log
 * @async
 * @function processEventCollectorOperationEvent
 * @param {EnhancedEventLog} log - The enhanced log object
 * @param {string} rawEventId - The ID of the raw event document
 */
async function processEventCollectorOperationEvent (
  log: EnhancedEventLog,
  rawEventId: string
) {
  try {
    if (!log || !log.topics || !log.data) {
      logger.error('Invalid log data for CampaignEventCollectorOperation event')
      return
    }

    // For CampaignEventCollectorOperation(uint8 opType, address indexed sender, address indexed targetAddress)
    // topics[0] = event signature
    // topics[1] = sender (indexed)
    // topics[2] = targetAddress (indexed)
    // data = opType (not indexed)

    // Extract indexed parameters from topics
    const sender =
      log.topics.length > 1
        ? ethers.getAddress(ethers.dataSlice(log.topics[1], 12)).toLowerCase()
        : ''

    const targetAddress =
      log.topics.length > 2
        ? ethers.getAddress(ethers.dataSlice(log.topics[2], 12)).toLowerCase()
        : ''

    // Extract non-indexed parameters from data
    const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(
      ['uint8'], // opType
      log.data
    )

    const opType = Number(decodedData[0])

    // Create the event data object
    const collectorOpEvent: EventCollectorOperationData = {
      eventType: 'CampaignEventCollectorOperation',
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
        name: EVENT_COLLECTOR_OPERATION_TYPES[opType] || 'UNKNOWN'
      },
      sender,
      targetAddress
    }

    // Store the event collector operation event
    const docRef = await db
      .collection('eventCollectorOperations')
      .add(collectorOpEvent)
    logger.info(`Event collector operation stored with ID: ${docRef.id}`)

    // Update relevant collections based on operation type
    switch (opType) {
      case 1: // FACTORY_AUTHORIZED
        await updateFactoryAuthorization(targetAddress, true)
        break
      case 2: // FACTORY_DEAUTHORIZED
        await updateFactoryAuthorization(targetAddress, false)
        break
      case 3: // CAMPAIGN_AUTHORIZED
        await updateCampaignAuthorization(targetAddress, true, sender)
        break
      case 4: // CAMPAIGN_DEAUTHORIZED
        await updateCampaignAuthorization(targetAddress, false, sender)
        break
      default:
        logger.warn(`Unknown operation type: ${opType}`)
    }
  } catch (error) {
    logger.error(
      `Error processing CampaignEventCollectorOperation event: ${error}`
    )
  }
}

/**
 * Update campaign contributions summary
 * @async
 * @function updateCampaignContributions
 * @param {string} campaignId - The campaign ID
 * @param {string} campaignAddress - The campaign contract address
 * @param {string} amount - The contribution amount (string)
 */
async function updateCampaignContributions (
  campaignId: string,
  campaignAddress: string,
  amount: string
) {
  try {
    const campaignRef = db.collection('campaigns').doc(campaignId)

    // Check if campaign exists
    const campaignDoc = await campaignRef.get()

    if (campaignDoc.exists) {
      // Update existing campaign
      await campaignRef.update({
        totalContributions: (
          ethers.toBigInt(campaignDoc.data()?.totalContributions || '0') +
          ethers.toBigInt(amount)
        ).toString(),
        lastContributionAt: new Date(),
        lastUpdated: new Date()
      })
    } else {
      // Create new campaign record
      await campaignRef.set({
        campaignId,
        campaignAddress,
        totalContributions: amount,
        totalRefunds: '0',
        totalClaims: '0',
        status: 0, // Default status
        createdAt: new Date(),
        lastContributionAt: new Date(),
        lastUpdated: new Date()
      })
    }

    logger.info(`Updated contributions for campaign ${campaignId}`)
  } catch (error) {
    logger.error(`Error updating campaign contributions: ${error}`)
  }
}

/**
 * Update campaign refunds summary
 * @async
 * @function updateCampaignRefunds
 * @param {string} campaignId - The campaign ID
 * @param {string} campaignAddress - The campaign contract address
 * @param {string} amount - The refund amount (string)
 */
async function updateCampaignRefunds (
  campaignId: string,
  campaignAddress: string,
  amount: string
) {
  try {
    const campaignRef = db.collection('campaigns').doc(campaignId)

    // Check if campaign exists
    const campaignDoc = await campaignRef.get()

    if (campaignDoc.exists) {
      // Update existing campaign
      await campaignRef.update({
        totalRefunds: (
          ethers.toBigInt(campaignDoc.data()?.totalRefunds || '0') +
          ethers.toBigInt(amount)
        ).toString(),
        lastRefundAt: new Date(),
        lastUpdated: new Date()
      })
    } else {
      // Create new campaign record
      await campaignRef.set({
        campaignId,
        campaignAddress,
        totalContributions: '0',
        totalRefunds: amount,
        totalClaims: '0',
        status: 0, // Default status
        createdAt: new Date(),
        lastRefundAt: new Date(),
        lastUpdated: new Date()
      })
    }

    logger.info(`Updated refunds for campaign ${campaignId}`)
  } catch (error) {
    logger.error(`Error updating campaign refunds: ${error}`)
  }
}

/**
 * Update campaign claims summary
 * @async
 * @function updateCampaignClaims
 * @param {string} campaignId - The campaign ID
 * @param {string} campaignAddress - The campaign contract address
 * @param {string} amount - The claimed amount (string)
 */
async function updateCampaignClaims (
  campaignId: string,
  campaignAddress: string,
  amount: string
) {
  try {
    const campaignRef = db.collection('campaigns').doc(campaignId)

    // Check if campaign exists
    const campaignDoc = await campaignRef.get()

    if (campaignDoc.exists) {
      // Update existing campaign
      await campaignRef.update({
        totalClaims: (
          ethers.toBigInt(campaignDoc.data()?.totalClaims || '0') +
          ethers.toBigInt(amount)
        ).toString(),
        lastClaimAt: new Date(),
        lastUpdated: new Date()
      })
    } else {
      // Create new campaign record
      await campaignRef.set({
        campaignId,
        campaignAddress,
        totalContributions: '0',
        totalRefunds: '0',
        totalClaims: amount,
        status: 0, // Default status
        createdAt: new Date(),
        lastClaimAt: new Date(),
        lastUpdated: new Date()
      })
    }

    logger.info(`Updated claims for campaign ${campaignId}`)
  } catch (error) {
    logger.error(`Error updating campaign claims: ${error}`)
  }
}

/**
 * Update campaign status
 * @async
 * @function updateCampaignStatus
 * @param {string} campaignId - The campaign ID
 * @param {string} campaignAddress - The campaign contract address
 * @param {number} status - The new status code
 * @param {number} reason - The reason code for status change
 */
async function updateCampaignStatus (
  campaignId: string,
  campaignAddress: string,
  status: number,
  reason: number
) {
  try {
    const campaignRef = db.collection('campaigns').doc(campaignId)

    // Check if campaign exists
    const campaignDoc = await campaignRef.get()

    if (campaignDoc.exists) {
      // Update existing campaign
      await campaignRef.update({
        status,
        statusReason: reason,
        statusText: CAMPAIGN_STATUS_TYPES[status] || 'UNKNOWN',
        statusReasonText: STATUS_CHANGE_REASONS[reason] || 'UNKNOWN',
        lastStatusChangeAt: new Date(),
        lastUpdated: new Date()
      })
    } else {
      // Create new campaign record
      await campaignRef.set({
        campaignId,
        campaignAddress,
        totalContributions: '0',
        totalRefunds: '0',
        totalClaims: '0',
        status,
        statusReason: reason,
        statusText: CAMPAIGN_STATUS_TYPES[status] || 'UNKNOWN',
        statusReasonText: STATUS_CHANGE_REASONS[reason] || 'UNKNOWN',
        createdAt: new Date(),
        lastStatusChangeAt: new Date(),
        lastUpdated: new Date()
      })
    }

    logger.info(
      `Updated status for campaign ${campaignId} to ${
        CAMPAIGN_STATUS_TYPES[status] || status
      }`
    )
  } catch (error) {
    logger.error(`Error updating campaign status: ${error}`)
  }
}

/**
 * Update campaign admin override status
 * @async
 * @function updateCampaignAdminOverride
 * @param {string} campaignId - The campaign ID
 * @param {string} campaignAddress - The campaign contract address
 * @param {boolean} status - The admin override status
 * @param {string} admin - The admin address who set the override
 */
async function updateCampaignAdminOverride (
  campaignId: string,
  campaignAddress: string,
  status: boolean,
  admin: string
) {
  try {
    const campaignRef = db.collection('campaigns').doc(campaignId)

    // Check if campaign exists
    const campaignDoc = await campaignRef.get()

    if (campaignDoc.exists) {
      // Update existing campaign
      await campaignRef.update({
        adminOverride: status,
        lastAdminOverrideBy: admin,
        lastAdminOverrideAt: new Date(),
        lastUpdated: new Date()
      })
    } else {
      // Create new campaign record
      await campaignRef.set({
        campaignId,
        campaignAddress,
        totalContributions: '0',
        totalRefunds: '0',
        totalClaims: '0',
        status: 0, // Default status
        adminOverride: status,
        lastAdminOverrideBy: admin,
        createdAt: new Date(),
        lastAdminOverrideAt: new Date(),
        lastUpdated: new Date()
      })
    }

    logger.info(
      `Updated admin override for campaign ${campaignId} to ${status}`
    )
  } catch (error) {
    logger.error(`Error updating campaign admin override: ${error}`)
  }
}

/**
 * Update campaign funds based on operation type
 * @async
 * @function updateCampaignFunds
 * @param {string} campaignId - The campaign ID
 * @param {string} campaignAddress - The campaign contract address
 * @param {string} token - The token address
 * @param {string} amount - The amount (string)
 * @param {number} opType - The operation type
 */
async function updateCampaignFunds (
  campaignId: string,
  campaignAddress: string,
  token: string,
  amount: string,
  opType: number
) {
  try {
    const campaignRef = db.collection('campaigns').doc(campaignId)

    // Check if campaign exists
    const campaignDoc = await campaignRef.get()

    // Create a funds update object based on operation type
    const fundsUpdate: any = {
      lastFundsOperationAt: new Date(),
      lastFundsOperationType: opType,
      lastFundsOperationTypeText: FUNDS_OPERATION_TYPES[opType] || 'UNKNOWN',
      lastUpdated: new Date()
    }

    // Update token-specific balances
    if (opType === 1) {
      // DEPOSIT
      fundsUpdate[`tokenBalances.${token}`] = (
        ethers.toBigInt(
          (campaignDoc.exists && campaignDoc.data()?.tokenBalances?.[token]) ||
            '0'
        ) + ethers.toBigInt(amount)
      ).toString()
    } else if (opType === 2 || opType === 3 || opType === 4) {
      // WITHDRAWAL, REFUND, CLAIM
      fundsUpdate[`tokenBalances.${token}`] = (
        ethers.toBigInt(
          (campaignDoc.exists && campaignDoc.data()?.tokenBalances?.[token]) ||
            '0'
        ) - ethers.toBigInt(amount)
      ).toString()
    }

    if (campaignDoc.exists) {
      // Update existing campaign
      await campaignRef.update(fundsUpdate)
    } else {
      // Create new campaign record
      const newCampaign = {
        campaignId,
        campaignAddress,
        totalContributions: '0',
        totalRefunds: '0',
        totalClaims: '0',
        status: 0, // Default status
        tokenBalances: {
          [token]: opType === 1 ? amount : '0' // Only set positive balance for deposits
        },
        createdAt: new Date(),
        lastFundsOperationAt: new Date(),
        lastFundsOperationType: opType,
        lastFundsOperationTypeText: FUNDS_OPERATION_TYPES[opType] || 'UNKNOWN',
        lastUpdated: new Date()
      }

      await campaignRef.set(newCampaign)
    }

    logger.info(
      `Updated funds for campaign ${campaignId}, token ${token}, operation ${
        FUNDS_OPERATION_TYPES[opType] || opType
      }`
    )
  } catch (error) {
    logger.error(`Error updating campaign funds: ${error}`)
  }
}

/**
 * Update factory authorization status
 * @async
 * @function updateFactoryAuthorization
 * @param {string} factoryAddress - The factory contract address
 * @param {boolean} isAuthorized - Whether the factory is authorized
 */
async function updateFactoryAuthorization (
  factoryAddress: string,
  isAuthorized: boolean
) {
  try {
    const factoryRef = db.collection('authorizedFactories').doc(factoryAddress)

    if (isAuthorized) {
      // Add or update factory
      await factoryRef.set(
        {
          address: factoryAddress,
          isAuthorized: true,
          lastUpdated: new Date()
        },
        { merge: true }
      )

      logger.info(`Factory ${factoryAddress} authorized`)
    } else {
      // Update factory to deauthorized
      await factoryRef.update({
        isAuthorized: false,
        lastUpdated: new Date()
      })

      logger.info(`Factory ${factoryAddress} deauthorized`)
    }
  } catch (error) {
    logger.error(`Error updating factory authorization: ${error}`)
  }
}

/**
 * Update campaign authorization status
 * @async
 * @function updateCampaignAuthorization
 * @param {string} campaignAddress - The campaign contract address
 * @param {boolean} isAuthorized - Whether the campaign is authorized
 * @param {string} [factoryAddress=""] - The factory that authorized the campaign
 */
async function updateCampaignAuthorization (
  campaignAddress: string,
  isAuthorized: boolean,
  factoryAddress = ''
) {
  try {
    const authCampaignRef = db
      .collection('authorizedCampaigns')
      .doc(campaignAddress)

    if (isAuthorized) {
      // Add or update authorized campaign
      await authCampaignRef.set(
        {
          address: campaignAddress,
          isAuthorized: true,
          authorizedBy: factoryAddress,
          lastUpdated: new Date()
        },
        { merge: true }
      )

      logger.info(`Campaign ${campaignAddress} authorized by ${factoryAddress}`)
    } else {
      // Update campaign to deauthorized
      await authCampaignRef.update({
        isAuthorized: false,
        lastUpdated: new Date()
      })

      logger.info(`Campaign ${campaignAddress} deauthorized`)
    }
  } catch (error) {
    logger.error(`Error updating campaign authorization: ${error}`)
  }
}
