/**
 * Event processor for DefiIntegrationManager events
 * This module processes blockchain events
 * from the DefiIntegrationManager contract,
 * storing them in Firestore and updating related collections.
 */

import {logger} from "firebase-functions";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {getFirestore} from "firebase-admin/firestore";
import {ethers} from "ethers";

// Initialize Firebase
const db = getFirestore();

/**
 * Interface representing a blockchain event log
 * @interface EventLog
 * @property {string[]} topics - Array of event topics (indexed parameters)
 * @property {string} data - Encoded non-indexed parameters
 * @property {Object} [block] - Block information
 * @property {number} [block.number] - Block number
 * @property {number} [block.timestamp] - Block timestamp
 * @property {Object} [transaction] - Transaction information
 * @property {string} [transaction.hash] - Transaction hash
 * @property {Object} [account] - Account information
 * @property {string} [account.address] - Contract address
 */
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

/**
 * Interface for DefiOperation event data
 * @interface DefiOperationEventData
 * @property {string} eventType - Type of event ("DefiOperation")
 * @property {string} rawEventId - ID of the raw event document
 * @property {Date} createdAt - When the event was processed
 * @property {number|null} blockNumber - Block number where event occurred
 * @property {Date|null} blockTimestamp - Block timestamp
 * @property {string|null} transactionHash - Transaction hash
 * @property {string|null} contractAddress - Contract address
 * @property {Object} operation - Operation details
 * @property {number} operation.code - Operation type code
 * @property {string} operation.name - Operation type name
 * @property {string} sender - Address of the operation sender
 * @property {string} token - Token address
 * @property {string} amount - Amount of tokens
 * @property {string} campaignId - Campaign identifier
 */
interface DefiOperationEventData {
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
  token: string
  amount: string
  campaignId: string
}

/**
 * Interface for ConfigUpdated event data
 * @interface ConfigUpdateEventData
 * @property {string} eventType - Type of event ("ConfigUpdated")
 * @property {string} rawEventId - ID of the raw event document
 * @property {Date} createdAt - When the event was processed
 * @property {number|null} blockNumber - Block number where event occurred
 * @property {Date|null} blockTimestamp - Block timestamp
 * @property {string|null} transactionHash - Transaction hash
 * @property {string|null} contractAddress - Contract address
 * @property {number} configType - Type of configuration updated
 * @property {string} oldAddress - Previous address
 * @property {string} newAddress - New address
 */
interface ConfigUpdateEventData {
  eventType: string
  rawEventId: string
  createdAt: Date
  blockNumber: number | null
  blockTimestamp: Date | null
  transactionHash: string | null
  contractAddress: string | null
  configType: number
  oldAddress: string
  newAddress: string
}

/**
 * Interface for campaign yield data
 * @interface CampaignYieldData
 * @property {string} campaignId - Campaign identifier
 * @property {string} token - Token address
 * @property {boolean} deposited - Whether tokens have been deposited
 * @property {string} depositAmount - Amount of tokens deposited
 * @property {boolean} withdrawn - Whether tokens have been withdrawn
 * @property {string} withdrawAmount - Amount of tokens withdrawn
 * @property {Date} lastUpdated - Last update timestamp
 * @property {string} lastOperation - Last operation performed
 */
interface CampaignYieldData {
  campaignId: string
  token: string
  deposited: boolean
  depositAmount: string
  withdrawn: boolean
  withdrawAmount: string
  lastUpdated: Date
  lastOperation: string
}

/**
 * Interface for DeFi configuration data
 * @interface DefiConfigData
 * @property {string} aavePoolAddress - Address of Aave Pool contract
 * @property {string} tokenRegistryAddress - Address of Token Registry contract
 * @property {string} feeManagerAddress - Address of Fee Manager contract
 * @property {Date} lastUpdated - Last update timestamp
 * @property {string} lastOperation - Last operation performed
 */
interface DefiConfigData {
  aavePoolAddress: string
  tokenRegistryAddress: string
  feeManagerAddress: string
  lastUpdated: Date
  lastOperation: string
}

// Event signatures
const defiOpSignature = "DefiOperation(uint8,address,address,uint256,bytes32)";
const configUpdatedSignature = "ConfigUpdated(uint8,address,address)";

// Event signature hashes
const DEFI_OP_SIGNATURE = ethers.keccak256(ethers.toUtf8Bytes(defiOpSignature));
const CONFIG_UPDATED_SIGNATURE = ethers.keccak256(
  ethers.toUtf8Bytes(configUpdatedSignature)
);

/**
 * Mapping of operation type codes to their string representations
 * @type {Record<number, string>}
 */
const OPERATION_TYPES: Record<number, string> = {
  1: "DEPOSITED",
  2: "WITHDRAWN",
  3: "CONFIG_UPDATED",
};

/**
 * Firebase function that triggers when a new document is created in the rawEvents collection.
 * Parses DefiIntegrationManager events and stores them in the defiEvents collection.
 *
 * @function processDefiIntegrationEvents
 * @param {Object} event - The Firebase event object
 * @param {Object} event.data - The document data
 * @param {Object} event.params - The function parameters
 * @param {string} event.params.docId - The document ID
 */
export const processDefiIntegrationEvents = onDocumentCreated(
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

        // Check if this is a DefiOperation event
        if (eventSignature === DEFI_OP_SIGNATURE) {
          await processDefiOperation(log as EventLog, rawEventId);
        } else if (eventSignature === CONFIG_UPDATED_SIGNATURE) {
          await processConfigUpdated(log as EventLog, rawEventId);
        }
      }
    } catch (error) {
      logger.error("Error processing defi integration event:", error);
    }
  }
);

/**
 * Process a DefiOperation event log
 * @async
 * @function processDefiOperation
 * @param {EventLog} log - The log object from the webhook
 * @param {string} rawEventId - The ID of the raw event document
 */
async function processDefiOperation(log: EventLog, rawEventId: string) {
  try {
    if (!log || !log.topics || !log.data) {
      logger.error("Invalid log data for DefiOperation");
      return;
    }

    // Extract the indexed parameters from topics
    // sender is in the second topic (index 1)
    // token is in the third topic (index 2)
    // campaignId is in the fourth topic (index 3)
    const sender =
      log.topics.length > 1 ?
        ethers.dataSlice(log.topics[1], 12) : // Convert bytes32 to address
        undefined;

    const token =
      log.topics.length > 2 ?
        ethers.dataSlice(log.topics[2], 12) : // Convert bytes32 to address
        undefined;

    const campaignId =
      log.topics.length > 3 ?
        log.topics[3] : // bytes32 as is
        undefined;

    if (!sender || !token || !campaignId) {
      logger.error("Missing indexed parameters in DefiOperation");
      return;
    }

    // Addresses need to be properly formatted with checksum
    const normalizedSender = ethers.getAddress(sender).toLowerCase();
    const normalizedToken = ethers.getAddress(token).toLowerCase();

    // Extract data from the non-indexed parameters
    // The data field contains all non-indexed parameters packed together
    const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(
      ["uint8", "uint256"], // opType, amount
      log.data
    );

    const opType = Number(decodedData[0]);
    const amount = decodedData[1];

    // Format the data
    const defiEvent: DefiOperationEventData = {
      eventType: "DefiOperation",
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
      sender: normalizedSender,
      token: normalizedToken,
      amount: amount.toString(),
      campaignId: campaignId,
    };

    // Store the defi event
    const docRef = await db.collection("defiEvents").add(defiEvent);
    if (!docRef) {
      logger.error("Failed to create document in defiEvents collection");
      return;
    }

    logger.info(`Defi event stored with ID: ${docRef.id}`);

    // Update campaign yield data based on operation type
    await updateCampaignYieldData(
      opType,
      normalizedSender,
      normalizedToken,
      campaignId,
      amount.toString()
    );
  } catch (error) {
    logger.error(`Error processing DefiOperation: ${error}`);
  }
}

/**
 * Process a ConfigUpdated event log
 * @async
 * @function processConfigUpdated
 * @param {EventLog} log - The log object from the webhook
 * @param {string} rawEventId - The ID of the raw event document
 */
async function processConfigUpdated(log: EventLog, rawEventId: string) {
  try {
    if (!log || !log.topics || !log.data) {
      logger.error("Invalid log data for ConfigUpdated");
      return;
    }

    // Extract data from the non-indexed parameters
    // The data field contains all parameters
    // since none are indexed in ConfigUpdated
    const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(
      ["uint8", "address", "address"], // configType, oldAddress, newAddress
      log.data
    );

    const configType = Number(decodedData[0]);
    const oldAddress = decodedData[1];
    const newAddress = decodedData[2];

    // Addresses need to be properly formatted with checksum
    const normalizedOldAddress = ethers.getAddress(oldAddress).toLowerCase();
    const normalizedNewAddress = ethers.getAddress(newAddress).toLowerCase();

    // Format the data
    const configEvent: ConfigUpdateEventData = {
      eventType: "ConfigUpdated",
      rawEventId,
      createdAt: new Date(),
      blockNumber: log.block?.number || null,
      blockTimestamp: log.block?.timestamp ?
        new Date(log.block.timestamp * 1000) :
        null,
      transactionHash: log.transaction?.hash || null,
      contractAddress: log.account?.address || null,
      configType,
      oldAddress: normalizedOldAddress,
      newAddress: normalizedNewAddress,
    };

    // Store the config event
    const docRef = await db.collection("defiConfigEvents").add(configEvent);
    if (!docRef) {
      logger.error("Failed to create document in defiConfigEvents collection");
      return;
    }

    logger.info(`Defi config event stored with ID: ${docRef.id}`);

    // Update defi configuration
    await updateDefiConfiguration(
      configType,
      normalizedOldAddress,
      normalizedNewAddress
    );
  } catch (error) {
    logger.error(`Error processing ConfigUpdated: ${error}`);
  }
}

/**
 * Updates the campaign yield data in
 * the campaignYield collection based on operation type
 * @async
 * @function updateCampaignYieldData
 * @param {number} opType - The operation type code
 * @param {string} sender - Address of the sender
 * @param {string} token - Address of the token
 * @param {string} campaignId - ID of the campaign
 * @param {string} amount - Amount of tokens
 */
async function updateCampaignYieldData(
  opType: number,
  sender: string,
  token: string,
  campaignId: string,
  amount: string
) {
  try {
    // Create a composite ID for the campaign yield record
    const yieldId = `${campaignId}_${token}`;

    // Reference to the campaign yield document
    const yieldRef = db.collection("campaignYield").doc(yieldId);

    // Get current yield data
    const yieldDoc = await yieldRef.get();
    const yieldExists = yieldDoc.exists;

    // Initialize yield data
    let yieldData: CampaignYieldData = yieldExists ?
      (yieldDoc.data() as CampaignYieldData) :
      {
        campaignId,
        token,
        deposited: false,
        depositAmount: "0",
        withdrawn: false,
        withdrawAmount: "0",
        lastUpdated: new Date(),
        lastOperation: "",
      };

    // Handle different operation types
    switch (opType) {
    case 1: // DEPOSITED
      yieldData = {
        ...yieldData,
        deposited: true,
        depositAmount: amount,
        lastUpdated: new Date(),
        lastOperation: "DEPOSITED",
      };

      await yieldRef.set(yieldData, {merge: true});
      logger.info(`Campaign yield record updated for deposit: ${yieldId}`);
      break;

    case 2: // WITHDRAWN
      yieldData = {
        ...yieldData,
        withdrawn: true,
        withdrawAmount: amount,
        lastUpdated: new Date(),
        lastOperation: "WITHDRAWN",
      };

      await yieldRef.set(yieldData, {merge: true});
      logger.info(`Campaign yield record updated for withdrawal: ${yieldId}`);
      break;

    default:
      logger.warn(`Unknown operation type for campaign yield: ${opType}`);
    }
  } catch (error) {
    logger.error(`Error updating campaign yield data: ${error}`);
  }
}

/**
 * Updates the DeFi configuration in the defiConfig collection
 * @async
 * @function updateDefiConfiguration
 * @param {number} configType - The type of configuration being updated
 * @param {string} oldAddress - The previous address
 * @param {string} newAddress - The new address
 */
async function updateDefiConfiguration(
  configType: number,
  oldAddress: string,
  newAddress: string
) {
  try {
    // Reference to the defi configuration document
    // We use a fixed ID for the defi
    // config since there's only one global config
    const configRef = db.collection("defiConfig").doc("current");

    // Get current defi configuration
    const configDoc = await configRef.get();
    const configExists = configDoc.exists;

    // Initialize config data
    const configData: DefiConfigData = configExists ?
      (configDoc.data() as DefiConfigData) :
      {
        aavePoolAddress: "",
        tokenRegistryAddress: "",
        feeManagerAddress: "",
        lastUpdated: new Date(),
        lastOperation: "",
      };

    // Update based on config type (3 is OP_CONFIG_UPDATED)
    if (configType === 3) {
      // Determine which contract address was updated based on old address
      if (
        configData.aavePoolAddress.toLowerCase() === oldAddress.toLowerCase()
      ) {
        configData.aavePoolAddress = newAddress;
        configData.lastOperation = "AAVE_POOL_UPDATED";
      } else if (
        configData.tokenRegistryAddress.toLowerCase() ===
        oldAddress.toLowerCase()
      ) {
        configData.tokenRegistryAddress = newAddress;
        configData.lastOperation = "TOKEN_REGISTRY_UPDATED";
      } else if (
        configData.feeManagerAddress.toLowerCase() === oldAddress.toLowerCase()
      ) {
        configData.feeManagerAddress = newAddress;
        configData.lastOperation = "FEE_MANAGER_UPDATED";
      } else {
        // If we can't determine which field to update, set all if they're empty
        if (!configData.aavePoolAddress) {
          configData.aavePoolAddress = newAddress;
          configData.lastOperation = "AAVE_POOL_SET";
        } else if (!configData.tokenRegistryAddress) {
          configData.tokenRegistryAddress = newAddress;
          configData.lastOperation = "TOKEN_REGISTRY_SET";
        } else if (!configData.feeManagerAddress) {
          configData.feeManagerAddress = newAddress;
          configData.lastOperation = "FEE_MANAGER_SET";
        } else {
          configData.lastOperation = "UNKNOWN_CONFIG_UPDATED";
          logger.warn(
            "Could not determine which" +
              `config was updated: old=${oldAddress}, ` +
              `new=${newAddress}`
          );
        }
      }

      configData.lastUpdated = new Date();

      await configRef.set(configData, {merge: true});
      logger.info(`DeFi configuration updated: ${configData.lastOperation}`);
    } else {
      logger.warn(`Unexpected configType: ${configType}`);
    }
  } catch (error) {
    logger.error(`Error updating defi configuration: ${error}`);
  }
}
