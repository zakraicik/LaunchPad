// Event processor for CampaignEventCollector events
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

// Base interface for all campaign events
interface CampaignEventBase {
  eventType: string
  rawEventId: string
  createdAt: Date
  blockNumber: number | null
  blockTimestamp: Date | null
  transactionHash: string | null
  contractAddress: string | null
  campaignId: string
  campaignAddress: string
}

// Contribution event data
interface ContributionEventData extends CampaignEventBase {
  contributor: string
  amount: string
  formattedAmount: string // For human-readable display (depends on token decimals)
}

// Refund issued event data
interface RefundIssuedEventData extends CampaignEventBase {
  contributor: string
  amount: string
  formattedAmount: string
}

// Funds claimed event data
interface FundsClaimedEventData extends CampaignEventBase {
  initiator: string
  amount: string
  formattedAmount: string
}

// Campaign status changed event data
interface CampaignStatusChangedEventData extends CampaignEventBase {
  oldStatus: number
  newStatus: number
  reason: number
}

// Admin override set event data
interface AdminOverrideSetEventData extends CampaignEventBase {
  status: boolean
  admin: string
}

// Funds operation event data
interface FundsOperationEventData extends CampaignEventBase {
  token: string
  amount: string
  formattedAmount: string
  opType: number
  initiator: string
}

// Campaign event collector operation event data
interface EventCollectorOperationData {
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
  sender: string
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

// Status codes mapping (assuming these values, replace with actual ones from your contract)
const CAMPAIGN_STATUS_TYPES: Record<number, string> = {
  0: 'DRAFT',
  1: 'PENDING_APPROVAL',
  2: 'ACTIVE',
  3: 'COMPLETED',
  4: 'FAILED',
  5: 'CANCELLED'
}

// Status change reason codes (assuming these values, replace with actual ones from your contract)
const STATUS_CHANGE_REASONS: Record<number, string> = {
  0: 'NONE',
  1: 'GOAL_REACHED',
  2: 'DEADLINE_PASSED',
  3: 'MANUAL_CANCEL',
  4: 'ADMIN_DECISION'
}

// Funds operation types (assuming these values, replace with actual ones from your contract)
const FUNDS_OPERATION_TYPES: Record<number, string> = {
  1: 'DEPOSIT',
  2: 'WITHDRAWAL',
  3: 'REFUND',
  4: 'CLAIM'
}

// Default token decimals (used when specific token info isn't available)
const DEFAULT_TOKEN_DECIMALS = 18

/**
 * Firebase function that triggers when a new document is created in the rawEvents collection
 * Parses CampaignEventCollector events and stores them in appropriate collections
 */
export const processCampaignEvents = onDocumentCreated(
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

        // Check which event type this is and process accordingly
        switch (eventSignature) {
          case CONTRIBUTION_SIGNATURE_HASH:
            await processContributionEvent(log as EventLog, rawEventId)
            break
          case REFUND_ISSUED_SIGNATURE_HASH:
            await processRefundIssuedEvent(log as EventLog, rawEventId)
            break
          case FUNDS_CLAIMED_SIGNATURE_HASH:
            await processFundsClaimedEvent(log as EventLog, rawEventId)
            break
          case CAMPAIGN_STATUS_CHANGED_SIGNATURE_HASH:
            await processCampaignStatusChangedEvent(log as EventLog, rawEventId)
            break
          case ADMIN_OVERRIDE_SET_SIGNATURE_HASH:
            await processAdminOverrideSetEvent(log as EventLog, rawEventId)
            break
          case FUNDS_OPERATION_SIGNATURE_HASH:
            await processFundsOperationEvent(log as EventLog, rawEventId)
            break
          case EVENT_COLLECTOR_OPERATION_SIGNATURE_HASH:
            await processEventCollectorOperationEvent(
              log as EventLog,
              rawEventId
            )
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
 * @param log The log object from the webhook
 * @param rawEventId The ID of the raw event document
 */
async function processContributionEvent (log: EventLog, rawEventId: string) {
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

    // Format the amount (assumes default token decimals for now)
    // In a production environment, you would look up the token's decimals
    const formattedAmount = ethers.formatUnits(amount, DEFAULT_TOKEN_DECIMALS)

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
      formattedAmount,
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
 * @param log The log object from the webhook
 * @param rawEventId The ID of the raw event document
 */
async function processRefundIssuedEvent (log: EventLog, rawEventId: string) {
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

    // Format the amount (assumes default token decimals for now)
    const formattedAmount = ethers.formatUnits(amount, DEFAULT_TOKEN_DECIMALS)

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
      formattedAmount,
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
 * @param log The log object from the webhook
 * @param rawEventId The ID of the raw event document
 */
async function processFundsClaimedEvent (log: EventLog, rawEventId: string) {
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

    // Format the amount (assumes default token decimals for now)
    const formattedAmount = ethers.formatUnits(amount, DEFAULT_TOKEN_DECIMALS)

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
      formattedAmount,
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
 * @param log The log object from the webhook
 * @param rawEventId The ID of the raw event document
 */
async function processCampaignStatusChangedEvent (
  log: EventLog,
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
 * @param log The log object from the webhook
 * @param rawEventId The ID of the raw event document
 */
async function processAdminOverrideSetEvent (log: EventLog, rawEventId: string) {
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
        ? log.topics[1].endsWith('1') // Check if the last digit is 1
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
 * @param log The log object from the webhook
 * @param rawEventId The ID of the raw event document
 */
async function processFundsOperationEvent (log: EventLog, rawEventId: string) {
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

    // Try to get token decimals from the tokens collection or use default
    let decimals = DEFAULT_TOKEN_DECIMALS
    const tokenDoc = await db.collection('tokens').doc(token).get()
    if (tokenDoc.exists && tokenDoc.data()?.decimals) {
      decimals = tokenDoc.data()?.decimals
    }

    // Format the amount with the correct decimals
    const formattedAmount = ethers.formatUnits(amount, decimals)

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
      formattedAmount,
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
 * @param log The log object from the webhook
 * @param rawEventId The ID of the raw event document
 */
async function processEventCollectorOperationEvent (
  log: EventLog,
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
 * @param campaignId The campaign ID
 * @param campaignAddress The campaign contract address
 * @param amount The contribution amount (string)
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
 * @param campaignId The campaign ID
 * @param campaignAddress The campaign contract address
 * @param amount The refund amount (string)
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
 * @param campaignId The campaign ID
 * @param campaignAddress The campaign contract address
 * @param amount The claimed amount (string)
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
 * @param campaignId The campaign ID
 * @param campaignAddress The campaign contract address
 * @param status The new status code
 * @param reason The reason code for status change
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
 * @param campaignId The campaign ID
 * @param campaignAddress The campaign contract address
 * @param status The admin override status
 * @param admin The admin address who set the override
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
 * @param campaignId The campaign ID
 * @param campaignAddress The campaign contract address
 * @param token The token address
 * @param amount The amount (string)
 * @param opType The operation type
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
 * @param factoryAddress The factory contract address
 * @param isAuthorized Whether the factory is authorized
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
 * @param campaignAddress The campaign contract address
 * @param isAuthorized Whether the campaign is authorized
 * @param factoryAddress The factory that authorized the campaign (if applicable)
 */
async function updateCampaignAuthorization (
  campaignAddress: string,
  isAuthorized: boolean,
  factoryAddress: string = ''
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
