/**
 * Event processor for TokenRegistry events
 * @module tokenRegistryProcessor
 */

import {logger} from "firebase-functions";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {getFirestore} from "firebase-admin/firestore";
import {ethers} from "ethers";

// Initialize Firebase
const db = getFirestore();

/**
 * Interface representing an event log from the blockchain
 * @interface EventLog
 */
interface EventLog {
  /** Array of event topics (indexed parameters) */
  topics: string[]
  /** Raw event data (non-indexed parameters) */
  data: string
  /** Block information containing number and timestamp */
  block?: {
    number?: number
    timestamp?: number
  }
  /** Transaction information containing hash */
  transaction?: {
    hash?: string
  }
  /** Account information containing address */
  account?: {
    address?: string
  }
}

/**
 * Interface representing processed token event data
 * @interface TokenEventData
 */
interface TokenEventData {
  /** Type of the event */
  eventType: string
  /** ID of the raw event document */
  rawEventId: string
  /** Timestamp when the event was created */
  createdAt: Date
  /** Block number where the event occurred */
  blockNumber: number | null
  /** Block timestamp when the event occurred */
  blockTimestamp: Date | null
  /** Hash of the transaction containing the event */
  transactionHash: string | null
  /** Address of the contract that emitted the event */
  contractAddress: string | null
  /** Operation details including code and name */
  operation: {
    code: number
    name: string
  }
  /** Token address involved in the event */
  token: string
  /** Raw value from the event */
  value: string
  /** Human-readable formatted value */
  formattedValue: string
  /** Number of decimal places for the token */
  decimals: number
}

/**
 * Interface representing token data stored in Firestore
 * @interface TokenData
 */
interface TokenData {
  /** Token contract address */
  address: string
  /** Whether the token is currently supported */
  isSupported: boolean
  /** Minimum contribution amount in raw units */
  minimumContribution?: string

  /** Number of decimal places for the token */
  decimals?: number
  /** Last update timestamp */
  lastUpdated: Date
  /** Last operation performed on the token */
  lastOperation: string
}

// Event signature and interface for TokenRegistryOperation
const eventSignature = "TokenRegistryOperation(uint8,address,uint256,uint8)";

// Event signature hash for TokenRegistryOperation
const TOKEN_REGISTRY_OP_SIGNATURE = ethers.keccak256(
  ethers.toUtf8Bytes(eventSignature)
);

// Operation types mapping
const OPERATION_TYPES: Record<number, string> = {
  1: "TOKEN_ADDED",
  2: "TOKEN_REMOVED",
  3: "TOKEN_SUPPORT_DISABLED",
  4: "TOKEN_SUPPORT_ENABLED",
  5: "MIN_CONTRIBUTION_UPDATED",
};

/**
 * Firebase function that triggers when a new document is created in the rawEvents collection
 * Parses TokenRegistry events and stores them in the tokenEvents collection
 *
 * @function processTokenRegistryEvents
 * @param {Object} event - The Firebase event object containing the new document
 * @returns {Promise<void>} A promise that resolves when processing is complete
 */
export const processTokenRegistryEvents = onDocumentCreated(
  "rawEvents/{docId}",
  async (event) => {
    try {
      // Get the raw event data
      const rawEvent = event.data?.data();
      if (!rawEvent || !rawEvent.data) {
        logger.warn("No data found in raw event");
        return;
      }

      const rawEventId = event.params.docId;
      if (!rawEventId) {
        logger.warn("No document ID found in event params");
        return;
      }

      logger.info(`Processing raw event with ID: ${rawEventId}`);

      // Extract logs from the webhook data
      const logs = rawEvent.data?.event?.data?.logs;
      if (!logs || !Array.isArray(logs)) {
        logger.info("No logs found in event data");
        return;
      }

      // Process each log
      for (const log of logs) {
        if (
          !log ||
          !log.topics ||
          !Array.isArray(log.topics) ||
          log.topics.length === 0
        ) {
          logger.debug("Skipping log with no topics");
          continue;
        }

        const eventSignature = log.topics[0];
        if (!eventSignature) {
          logger.debug("Skipping log with no event signature");
          continue;
        }

        // Check if this is a TokenRegistryOperation event
        if (eventSignature === TOKEN_REGISTRY_OP_SIGNATURE) {
          await processTokenRegistryOperation(log as EventLog, rawEventId);
        }
      }
    } catch (error) {
      logger.error("Error processing token registry event:", error);
    }
  }
);

/**
 * Process a TokenRegistryOperation event log and store it in Firestore
 *
 * @function processTokenRegistryOperation
 * @param {EventLog} log - The log object from the webhook
 * @param {string} rawEventId - The ID of the raw event document
 * @return {Promise<void>} A promise that resolves when processing is complete
 */
async function processTokenRegistryOperation(
  log: EventLog,
  rawEventId: string
) {
  try {
    if (!log || !log.topics || !log.data) {
      logger.error("Invalid log data for TokenRegistryOperation");
      return;
    }

    const tokenAddress =
      log.topics.length > 1 ?
        ethers.dataSlice(log.topics[1], 12) : // Convert bytes32 to address
        undefined;

    if (!tokenAddress) {
      logger.error("Missing token address in TokenRegistryOperation");
      return;
    }

    // Token address needs to be properly formatted with checksum
    const normalizedTokenAddress = ethers.getAddress(tokenAddress).toLowerCase();

    // Extract data from the non-indexed parameters
    // The data field contains all non-indexed parameters packed together
    const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(
      ["uint8", "uint256", "uint8"], // opType, value, decimals
      log.data
    );

    const opType = Number(decodedData[0]);
    const value = decodedData[1];
    const decimals = Number(decodedData[2]);

    // Format the data
    const tokenEvent: TokenEventData = {
      eventType: "TokenRegistryOperation",
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
      token: normalizedTokenAddress,
      value: value.toString(),
      formattedValue: value.toString(), // Store raw value, formatting will be done on frontend
      decimals,
    };

    // Store the token event
    const docRef = await db.collection("tokenEvents").add(tokenEvent);
    if (!docRef) {
      logger.error("Failed to create document in tokenEvents collection");
      return;
    }

    logger.info(`Token event stored with ID: ${docRef.id}`);

    // Update token record based on operation type
    await updateTokenRecordByOpType(
      opType,
      normalizedTokenAddress,
      value.toString(),
      decimals
    );
  } catch (error) {
    logger.error(`Error processing TokenRegistryOperation: ${error}`);
  }
}

/**
 * Updates or creates a token record in the tokens collection based on operation type
 *
 * @function updateTokenRecordByOpType
 * @param {number} opType - The operation type code (1-5)
 * @param {string} tokenAddress - The token contract address
 * @param {string} value - The value (e.g., minimum contribution amount)
 * @param {number} decimals - The token decimals
 * @return {Promise<void>} A promise that resolves when the update is complete
 */
async function updateTokenRecordByOpType(
  opType: number,
  tokenAddress: string,
  value: string,
  decimals: number
) {
  try {
    if (!tokenAddress) {
      logger.error("Invalid token address for updateTokenRecordByOpType");
      return;
    }

    // Reference to the token document
    const tokenRef = db.collection("tokens").doc(tokenAddress);
    if (!tokenRef) {
      logger.error("Failed to create reference to token document");
      return;
    }

    // Check if the token document exists
    const tokenDoc = await tokenRef.get();
    const tokenExists = tokenDoc.exists;

    // Handle different operation types
    switch (opType) {
    case 1: // TOKEN_ADDED
      // Create or update token record
      const tokenAddedData: TokenData = {
        address: tokenAddress,
        minimumContribution: value,
        decimals,
        isSupported: true,
        lastUpdated: new Date(),
        lastOperation: "TOKEN_ADDED",
      };

      await tokenRef.set(tokenAddedData, {merge: true});
      logger.info(`Token record created/updated for ${tokenAddress}`);
      break;

    case 2: // TOKEN_REMOVED
      if (tokenExists) {
        // Delete the token record
        await tokenRef.delete();
        logger.info(`Token record removed for ${tokenAddress}`);
      } else {
        logger.warn(`Attempted to remove non-existent token: ${tokenAddress}`);
      }
      break;

    case 3: // TOKEN_SUPPORT_DISABLED
      if (tokenExists) {
        const disableData: Partial<TokenData> = {
          isSupported: false,
          lastUpdated: new Date(),
          lastOperation: "TOKEN_SUPPORT_DISABLED",
        };

        await tokenRef.update(disableData);
        logger.info(`Token support disabled for ${tokenAddress}`);
      } else {
        logger.warn(
          `Attempted to disable support for non-existent token: ${tokenAddress}`
        );
      }
      break;

    case 4: // TOKEN_SUPPORT_ENABLED
      if (tokenExists) {
        const enableData: Partial<TokenData> = {
          isSupported: true,
          lastUpdated: new Date(),
          lastOperation: "TOKEN_SUPPORT_ENABLED",
        };

        await tokenRef.update(enableData);
        logger.info(`Token support enabled for ${tokenAddress}`);
      } else {
        // This case should not happen due to on-chain verification,
        // but we handle it defensively
        logger.warn(
          `Attempted to enable support for non-existent token: ${tokenAddress}`
        );
      }
      break;

    case 5: // MIN_CONTRIBUTION_UPDATED
      if (tokenExists) {
        const updateData: Partial<TokenData> = {
          minimumContribution: value,
          lastUpdated: new Date(),
          lastOperation: "MIN_CONTRIBUTION_UPDATED",
        };

        await tokenRef.update(updateData);
        logger.info(`Minimum contribution updated for ${tokenAddress}`);
      } else {
        logger.warn(
          `Attempted to update minimum contribution for non-existent token: ${tokenAddress}`
        );
      }
      break;

    default:
      logger.warn(
        `Unknown operation type: ${opType} for token ${tokenAddress}`
      );
    }
  } catch (error) {
    logger.error(`Error updating token record by operation type: ${error}`);
  }
}
