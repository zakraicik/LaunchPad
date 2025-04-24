// Event processor for CampaignContractFactory events
import {logger} from "firebase-functions";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import admin from "firebase-admin";
import {ethers} from "ethers";
import {
  AlchemyWebhookResponse,
  EnhancedEventLog,
  createEnhancedEventLog,
} from "./shared-types";

// Initialize Firebase
const db = admin.firestore();

/**
 * Interface representing processed factory operation event data
 * @interface FactoryOperationEventData
 * @property {string} eventType - Type of event (FactoryOperation)
 * @property {string} rawEventId - ID of the raw event document
 * @property {Date} createdAt - When the event was processed
 * @property {number|null} blockNumber - Block number where event occurred
 * @property {Date|null} blockTimestamp - Block timestamp
 * @property {string|null} transactionHash - Transaction hash
 * @property {string|null} contractAddress - Contract address that emitted the event
 * @property {Object} operation - Operation details
 * @property {number} operation.code - Operation code
 * @property {string} operation.name - Human-readable operation name
 * @property {string} campaignAddress - Address of the campaign contract
 * @property {string} creator - Address of the campaign creator
 * @property {string} campaignId - Unique identifier of the campaign
 */
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

/**
 * Interface representing campaign data stored in Firestore
 * @interface CampaignData
 * @property {string} campaignId - Unique identifier of the campaign
 * @property {string} campaignAddress - Address of the campaign contract
 * @property {string} creator - Address of the campaign creator
 * @property {Date} createdAt - When the campaign was created
 * @property {string} status - Current status of the campaign
 * @property {number|null} blockNumber - Block number where campaign was created
 * @property {string|null} transactionHash - Transaction hash of campaign creation
 */
interface CampaignData {
  campaignId: string
  campaignAddress: string
  creator: string
  createdAt: Date
  status: number
  blockNumber: number | null
  transactionHash: string | null
}

/**
 * Event signature for FactoryOperation event
 * Based on the solidity event definition:
 * event FactoryOperation(uint8 opType, address indexed campaignAddress, address indexed creator, bytes32 campaignId);
 */
const factoryOpSignature = "FactoryOperation(uint8,address,address,bytes32)";

/** Event signature hash for FactoryOperation event */
const FACTORY_OP_SIGNATURE = ethers.keccak256(
  ethers.toUtf8Bytes(factoryOpSignature),
);

/**
 * Mapping of operation codes to human-readable names
 * @constant {Record<number, string>}
 */
const OPERATION_TYPES: Record<number, string> = {
  1: "CAMPAIGN_CREATED",
};

/**
 * Firebase function that triggers when a new document is created in the rawEvents collection.
 * Parses CampaignContractFactory events and stores them in the factoryEvents collection.
 *
 * @function processCampaignFactoryEvents
 * @param {Object} event - The Firebase event object
 * @param {Object} event.data - The document data
 * @param {Object} event.params - The function parameters
 * @param {string} event.params.docId - The document ID
 */
export const processCampaignFactoryEvents = onDocumentCreated(
  "rawEvents/{docId}",
  async (event) => {
    try {
      // Get the raw event data
      const rawEvent = event.data?.data();
      if (!rawEvent) {
        logger.warn("No data found in raw event");
        return;
      }

      const rawEventId = event.params.docId;
      if (!rawEventId) {
        logger.warn("No document ID found in event params");
        return;
      }

      logger.info(`Processing raw event with ID: ${rawEventId}`);

      // Parse the webhook data
      if (!rawEvent.data) {
        logger.warn("No data found in raw event");
        return;
      }

      const webhookData = rawEvent.data as AlchemyWebhookResponse;

      // Check for required data
      if (!webhookData?.event?.data?.block?.logs) {
        logger.warn("Invalid Alchemy webhook structure - missing logs");
        return;
      }

      // Process logs from the Alchemy webhook
      const networkName = webhookData.event.network;
      const logs = webhookData.event.data.block.logs;
      const blockNumber = webhookData.event.data.block.number;
      const blockTimestamp = webhookData.event.data.block.timestamp;

      logger.info(`Found ${logs.length} logs to process from Alchemy webhook`);

      // Process each log
      for (const log of logs) {
        if (!log?.topics?.length) {
          logger.debug("Skipping log with no topics");
          continue;
        }

        const eventSignature = log.topics[0];
        if (!eventSignature) {
          logger.debug("Skipping log with no event signature");
          continue;
        }

        // Debug logging to help with troubleshooting
        logger.debug(`Event signature from log: ${eventSignature}`);
        logger.debug(
          `Expected FactoryOperation signature: ${FACTORY_OP_SIGNATURE}`,
        );
        logger.debug(
          `Signature match: ${eventSignature === FACTORY_OP_SIGNATURE}`,
        );

        // Check if this is a FactoryOperation event
        if (eventSignature === FACTORY_OP_SIGNATURE) {
          // Use the shared utility function to create the enhanced log
          const enhancedLog = createEnhancedEventLog(
            log,
            blockNumber,
            blockTimestamp,
          );

          await processFactoryOperation(enhancedLog, rawEventId);
        }
      }
    } catch (error) {
      logger.error("Error processing campaign factory event:", error);
    }
  },
);

/**
 * Process a FactoryOperation event log and store it in Firestore
 *
 * @async
 * @function processFactoryOperation
 * @param {EnhancedEventLog} log - The log object from the webhook
 * @param {string} rawEventId - The ID of the raw event document
 */
async function processFactoryOperation(
  log: EnhancedEventLog,
  rawEventId: string,
) {
  try {
    if (!log || !log.topics || !log.data) {
      logger.error("Invalid log data for FactoryOperation");
      return;
    }

    logger.debug(
      `Processing FactoryOperation event. Topics: ${JSON.stringify(log.topics)}`,
    );
    logger.debug(`Data: ${log.data}`);

    // Based on the event definition:
    // event FactoryOperation(uint8 opType, address indexed campaignAddress, address indexed creator, bytes32 campaignId);

    // Extract the indexed parameters from topics
    // campaignAddress is in the second topic (index 1)
    // creator is in the third topic (index 2)
    const campaignAddressBytes =
      log.topics.length > 1 ? log.topics[1] : undefined;
    const creatorBytes = log.topics.length > 2 ? log.topics[2] : undefined;

    if (!campaignAddressBytes || !creatorBytes) {
      logger.error("Missing indexed parameters in FactoryOperation", {
        topics: log.topics,
      });
      return;
    }

    // Convert bytes32 to address (addresses are 20 bytes, but topics are 32 bytes with padding)
    const campaignAddress = ethers.dataSlice(campaignAddressBytes, 12);
    const creator = ethers.dataSlice(creatorBytes, 12);

    // Addresses need to be properly formatted with checksum
    const normalizedCampaignAddress = ethers
      .getAddress(campaignAddress)
      .toLowerCase();
    const normalizedCreator = ethers.getAddress(creator).toLowerCase();

    // Extract data from the non-indexed parameters
    // The data field contains opType and campaignId
    const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(
      ["uint8", "bytes32"], // opType, campaignId
      log.data,
    );

    const opType = Number(decodedData[0]);
    const campaignId = decodedData[1];

    logger.debug(`Decoded data - opType: ${opType}, campaignId: ${campaignId}`);

    // Format the data
    const factoryEvent: FactoryOperationEventData = {
      eventType: "FactoryOperation",
      rawEventId,
      createdAt: new Date(),
      blockNumber: log.block?.number || null,
      blockTimestamp: log.block?.timestamp ?
        new Date(log.block.timestamp * 1000) :
        null,
      transactionHash: log.transaction?.hash || null,
      contractAddress: log.account?.address || null,
      operation: {
        code: opType,
        name: OPERATION_TYPES[opType] || "UNKNOWN",
      },
      campaignAddress: normalizedCampaignAddress,
      creator: normalizedCreator,
      campaignId,
    };

    // Store the factory event
    const docRef = await db.collection("factoryEvents").add(factoryEvent);
    if (!docRef) {
      logger.error("Failed to create document in factoryEvents collection");
      return;
    }

    logger.info(`Factory event stored with ID: ${docRef.id}`);

    // If this is a campaign creation event, store the campaign data
    if (opType === 1) {
      // CAMPAIGN_CREATED
      await storeCampaignData(
        campaignId,
        normalizedCampaignAddress,
        normalizedCreator,
        log.block?.number || null,
        log.transaction?.hash || null,
        log.block?.timestamp ? new Date(log.block.timestamp * 1000) : new Date(),
      );
    }
  } catch (error) {
    logger.error(`Error processing FactoryOperation: ${error}`);
  }
}

/**
 * Stores new campaign data in the campaigns collection
 *
 * @async
 * @function storeCampaignData
 * @param {string} campaignId - Unique identifier of the campaign
 * @param {string} campaignAddress - Address of the campaign contract
 * @param {string} creator - Address of the campaign creator
 * @param {number|null} blockNumber - Block number where the campaign was created
 * @param {string|null} transactionHash - Transaction hash of the campaign creation
 * @param {Date} timestamp - Timestamp when the campaign was created
 */
async function storeCampaignData(
  campaignId: string,
  campaignAddress: string,
  creator: string,
  blockNumber: number | null,
  transactionHash: string | null,
  timestamp: Date,
) {
  try {
    // Create campaign data record
    const campaignData: CampaignData = {
      campaignId,
      campaignAddress,
      creator,
      createdAt: timestamp,
      status: 1, // Initial status (STATUS_ACTIVE = 1) matching the contract state; don't want to risk async operations with the event collector
      blockNumber,
      transactionHash,
    };

    // Log the campaign data we're about to store
    logger.debug(`Storing campaign data: ${JSON.stringify(campaignData)}`);

    // Store in campaigns collection using campaignId as document ID
    // Use merge: true to preserve any existing data
    await db
      .collection("campaigns")
      .doc(campaignId)
      .set(campaignData, {merge: true});
    logger.info(`Campaign data stored with ID: ${campaignId}`);
  } catch (error) {
    logger.error(`Error storing campaign data: ${error}`, {
      campaignId,
      campaignAddress,
    });
  }
}
