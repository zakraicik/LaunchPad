/**
 * Event processor for
 * PlatformAdmin events
 * @module platformAdminProcessor
 */

import {logger} from "firebase-functions";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {getFirestore} from "firebase-admin/firestore";
import {ethers} from "ethers";

// Initialize Firebase
const db = getFirestore();

/**
 * Represents a raw event log from the blockchain
 * @interface EventLog
 */
interface EventLog {
  /** Array of event topics, where the first topic is the event signature */
  topics: string[]
  /** Packed event data containing non-indexed parameters */
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
  /** Account information containing contract address */
  account?: {
    address?: string
  }
}

/**
 * Represents processed platform admin event data
 * @interface PlatformAdminEventData
 */
interface PlatformAdminEventData {
  /** Type of the event */
  eventType: string
  /** ID of the raw event document */
  rawEventId: string
  /** Timestamp when the event was processed */
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
  /** Address of the admin involved in the operation */
  admin: string
  /** Previous value before the operation */
  oldValue: string
  /** New value after the operation */
  newValue: string
}

/**
 * Represents admin data stored in Firestore
 * @interface AdminData
 */
interface AdminData {
  /** Admin's Ethereum address */
  address: string
  /** Whether the admin is currently active */
  isActive: boolean
  /** Timestamp of the last update */
  lastUpdated: Date
  /** Name of the last operation performed */
  lastOperation: string
}

// Event signature and interface for PlatformAdminOperation
const eventSignature = "PlatformAdminOperation(uint8,address,uint256,uint256)";

// Event signature hash for PlatformAdminOperation
const PLATFORM_ADMIN_OP_SIGNATURE = ethers.keccak256(
  ethers.toUtf8Bytes(eventSignature)
);

/**
 * Mapping of operation codes to their human-readable names
 * @constant {Record<number, string>}
 */
const OPERATION_TYPES: Record<number, string> = {
  1: "ADMIN_ADDED",
  2: "ADMIN_REMOVED",
};

/**
 * Firebase function that triggers when a new document is created in the rawEvents collection.
 * Parses PlatformAdmin events and stores them in the adminEvents collection.
 * @function processPlatformAdminEvents
 * @param {Object} event - The Firebase event object containing the new document
 * @returns {Promise<void>}
 */
export const processPlatformAdminEvents = onDocumentCreated(
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

        // Check if this is a PlatformAdminOperation event
        if (eventSignature === PLATFORM_ADMIN_OP_SIGNATURE) {
          await processPlatformAdminOperation(log as EventLog, rawEventId);
        }
      }
    } catch (error) {
      logger.error("Error processing platform admin event:", error);
    }
  }
);

/**
 * Process a PlatformAdminOperation event log and store it in Firestore
 *
 * @function processPlatformAdminOperation
 * @param {EventLog} log - The log object from the webhook
 * @param {string} rawEventId - The ID of the raw event document
 * @return {Promise<void>}
 */
async function processPlatformAdminOperation(
  log: EventLog,
  rawEventId: string
) {
  try {
    if (!log || !log.topics || !log.data) {
      logger.error("Invalid log data for PlatformAdminOperation");
      return;
    }

    // Extract the admin address from topics since it's indexed
    // The admin address is in the second topic (index 1)
    const adminAddress =
      log.topics.length > 1 ?
        ethers.dataSlice(log.topics[1], 12) : // Convert bytes32 to address
        undefined;

    if (!adminAddress) {
      logger.error("Missing admin address in PlatformAdminOperation");
      return;
    }

    // Admin address needs to be properly formatted with checksum
    const normalizedAdminAddress = ethers.getAddress(adminAddress).toLowerCase();
    // Extract data from the non-indexed parameters
    // The data field contains all non-indexed parameters packed together
    const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(
      ["uint8", "uint256", "uint256"], // opType, oldValue, newValue
      log.data
    );

    const opType = Number(decodedData[0]);
    const oldValue = decodedData[1];
    const newValue = decodedData[2];

    // Format the data
    const adminEvent: PlatformAdminEventData = {
      eventType: "PlatformAdminOperation",
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
      admin: normalizedAdminAddress,
      oldValue: oldValue.toString(),
      newValue: newValue.toString(),
    };

    // Store the admin event
    const docRef = await db.collection("adminEvents").add(adminEvent);
    if (!docRef) {
      logger.error("Failed to create document in adminEvents collection");
      return;
    }

    logger.info(`Admin event stored with ID: ${docRef.id}`);

    // Update admin record based on operation type
    await updateAdminRecordByOpType(opType, normalizedAdminAddress);
  } catch (error) {
    logger.error(`Error processing PlatformAdminOperation: ${error}`);
  }
}

/**
 * Updates or creates an admin record in the admins collection based on operation type
 * @function updateAdminRecordByOpType
 * @param {number} opType - The operation type code (1 for ADD, 2 for REMOVE)
 * @param {string} adminAddress - The admin's Ethereum address
 * @return {Promise<void>}
 */
async function updateAdminRecordByOpType(opType: number, adminAddress: string) {
  try {
    if (!adminAddress) {
      logger.error("Invalid admin address for updateAdminRecordByOpType");
      return;
    }

    // Reference to the admin document
    const adminRef = db.collection("admins").doc(adminAddress);
    if (!adminRef) {
      logger.error("Failed to create reference to admin document");
      return;
    }

    // Check if the admin document exists
    const adminDoc = await adminRef.get();
    const adminExists = adminDoc.exists;

    // Handle different operation types
    let adminAddedData: AdminData;
    let adminRemovedData: Partial<AdminData>;

    switch (opType) {
    case 1: // ADMIN_ADDED
      // Create or update admin record
      adminAddedData = {
        address: adminAddress,
        isActive: true,
        lastUpdated: new Date(),
        lastOperation: "ADMIN_ADDED",
      };

      await adminRef.set(adminAddedData, {merge: true});
      logger.info(`Admin record created/updated for ${adminAddress}`);
      break;

    case 2: // ADMIN_REMOVED
      if (adminExists) {
        // Update the admin record to mark as inactive
        adminRemovedData = {
          isActive: false,
          lastUpdated: new Date(),
          lastOperation: "ADMIN_REMOVED",
        };

        await adminRef.update(adminRemovedData);
        logger.info(`Admin marked as inactive for ${adminAddress}`);
      } else {
        logger.warn(`Attempted to remove non-existent admin: ${adminAddress}`);
      }
      break;

    default:
      logger.warn(
        `Unknown operation type: ${opType} for admin ${adminAddress}`
      );
    }
  } catch (error) {
    logger.error(`Error updating admin record by operation type: ${error}`);
  }
}
