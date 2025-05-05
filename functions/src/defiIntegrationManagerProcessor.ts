/**
 * Event processor for DefiIntegrationManager events
 * This module processes blockchain events
 * from the DefiIntegrationManager contract,
 * storing them in Firestore and updating related collections.
 */

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
  eventType: string;
  rawEventId: string;
  createdAt: Date;
  blockNumber: number | null;
  blockTimestamp: Date | null;
  transactionHash: string | null;
  contractAddress: string | null;
  operation: {
    code: number;
    name: string;
  };
  sender: string;
  token: string;
  amount: string;
  campaignId: string;
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
 * @property {Object} operation - Operation details
 * @property {number} operation.code - Configuration type code
 * @property {string} operation.name - Configuration type name
 * @property {string} oldAddress - Previous address
 * @property {string} newAddress - New address
 */
interface ConfigUpdateEventData {
  eventType: string;
  rawEventId: string;
  createdAt: Date;
  blockNumber: number | null;
  blockTimestamp: Date | null;
  transactionHash: string | null;
  contractAddress: string | null;
  operation: {
    code: number;
    name: string;
  };
  oldAddress: string;
  newAddress: string;
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
 * @property {boolean} treasuryFeesPaid - Whether treasury fees have been paid
 * @property {string} treasuryFeeAmount - Amount of treasury fees paid
 * @property {number} networkId - Network ID of the chain where campaign yield is tracked
 */
interface CampaignYieldData {
  campaignId: string;
  token: string;
  deposited: boolean;
  depositAmount: string;
  withdrawn: boolean;
  withdrawAmount: string;
  lastUpdated: Date;
  lastOperation: string;
  treasuryFeesPaid: boolean;
  treasuryFeeAmount: string;
  networkId: number;
}

/**
 * Interface for DeFi configuration data
 * @interface DefiConfigData
 * @property {string} aavePoolAddress - Address of Aave Pool contract
 * @property {string} tokenRegistryAddress - Address of Token Registry contract
 * @property {string} feeManagerAddress - Address of Fee Manager contract
 * @property {Date} lastUpdated - Last update timestamp
 * @property {string} lastOperation - Last operation performed
 * @property {number} networkId - Network ID of the chain where defi config is deployed
 */
interface DefiConfigData {
  aavePoolAddress: string;
  tokenRegistryAddress: string;
  feeManagerAddress: string;
  lastUpdated: Date;
  lastOperation: string;
  networkId: number;
}

/**
 * Interface for withdrawal event data
 * @interface WithdrawalEventData
 * @property {string} eventType - Type of event ("Withdrawal")
 * @property {string} rawEventId - ID of the raw event document
 * @property {Date} createdAt - When the event was processed
 * @property {number|null} blockNumber - Block number where event occurred
 * @property {Date|null} blockTimestamp - Block timestamp
 * @property {string|null} transactionHash - Transaction hash
 * @property {string|null} contractAddress - Contract address
 * @property {string} campaignId - Campaign identifier
 * @property {string} token - Token address
 * @property {string} amount - Amount of tokens withdrawn
 * @property {string} recipient - Address that received the withdrawal
 * @property {string} withdrawalType - Type of withdrawal ("TREASURY" or "CREATOR")
 */
interface WithdrawalEventData {
  eventType: string;
  rawEventId: string;
  createdAt: Date;
  blockNumber: number | null;
  blockTimestamp: Date | null;
  transactionHash: string | null;
  contractAddress: string | null;
  campaignId: string;
  token: string;
  amount: string;
  recipient: string;
  withdrawalType: string;
}

// Event signatures
const defiOpSignature = "DefiOperation(uint8,address,address,uint256,bytes32)";
const configUpdatedSignature = "ConfigUpdated(uint8,address,address)";

// Event signature hashes
const DEFI_OP_SIGNATURE = ethers.keccak256(ethers.toUtf8Bytes(defiOpSignature));
const CONFIG_UPDATED_SIGNATURE = ethers.keccak256(
  ethers.toUtf8Bytes(configUpdatedSignature),
);

/**
 * Mapping of operation type codes to their string representations
 * @type {Record<number, string>}
 */
const OPERATION_TYPES: Record<number, string> = {
  1: "DEPOSITED",
  2: "WITHDRAWN_TO_CONTRACT",
  3: "TOKEN_REGISTRY_UPDATED",
  4: "FEE_MANAGER_UPDATED",
  5: "AAVE_POOL_UPDATED",
  6: "WITHDRAWN_TO_PLATFORM_TREASURY",
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

        // Use the shared utility function to create the enhanced log
        const enhancedLog = createEnhancedEventLog(
          log,
          blockNumber,
          blockTimestamp,
        );

        // Check if this is a DefiOperation event
        if (eventSignature === DEFI_OP_SIGNATURE) {
          await processDefiOperation(enhancedLog, rawEventId);
        } else if (eventSignature === CONFIG_UPDATED_SIGNATURE) {
          await processConfigUpdated(enhancedLog, rawEventId);
        }
      }
    } catch (error) {
      logger.error("Error processing defi integration event:", error);
    }
  },
);

/**
 * Process a DefiOperation event log
 * @async
 * @function processDefiOperation
 * @param {EnhancedEventLog} log - The log object from the webhook
 * @param {string} rawEventId - The ID of the raw event document
 */
async function processDefiOperation(log: EnhancedEventLog, rawEventId: string) {
  try {
    if (!log || !log.topics || !log.data) {
      logger.error("Invalid log data for DefiOperation");
      return;
    }

    // Get the raw event data to access network information
    const rawEventDoc = await db.collection("rawEvents").doc(rawEventId).get();
    const rawEvent = rawEventDoc.data();
    if (!rawEvent?.data?.event?.network) {
      logger.error("Missing network information in raw event");
      return;
    }

    // Get network ID based on network name
    const networkName = rawEvent.data.event.network;
    const networkId =
      networkName === "BASE_MAINNET" ?
        8453 :
        networkName === "BASE_SEPOLIA" ?
          84532 :
          null;

    if (!networkId) {
      logger.error(`Unsupported network: ${networkName}`);
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
      log.data,
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
      amount.toString(),
      networkId,
      log,
    );
  } catch (error) {
    logger.error(`Error processing DefiOperation: ${error}`);
  }
}

/**
 * Process a ConfigUpdated event log
 * @async
 * @function processConfigUpdated
 * @param {EnhancedEventLog} log - The log object from the webhook
 * @param {string} rawEventId - The ID of the raw event document
 */
async function processConfigUpdated(log: EnhancedEventLog, rawEventId: string) {
  try {
    if (!log || !log.topics || !log.data) {
      logger.error("Invalid log data for ConfigUpdated");
      return;
    }

    // Get the raw event data to access network information
    const rawEventDoc = await db.collection("rawEvents").doc(rawEventId).get();
    const rawEvent = rawEventDoc.data();
    if (!rawEvent?.data?.event?.network) {
      logger.error("Missing network information in raw event");
      return;
    }

    // Get network ID based on network name
    const networkName = rawEvent.data.event.network;
    const networkId =
      networkName === "BASE_MAINNET" ?
        8453 :
        networkName === "BASE_SEPOLIA" ?
          84532 :
          null;

    if (!networkId) {
      logger.error(`Unsupported network: ${networkName}`);
      return;
    }

    // Extract data from the non-indexed parameters
    // The data field contains all parameters
    // since none are indexed in ConfigUpdated
    const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(
      ["uint8", "address", "address"], // configType, oldAddress, newAddress
      log.data,
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
      operation: {
        code: configType,
        name: OPERATION_TYPES[configType] || "UNKNOWN",
      },
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
      normalizedNewAddress,
      networkId,
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
 * @param {number} networkId - Network ID of the chain where campaign yield is tracked
 * @param {EnhancedEventLog} log - The original event log containing blockchain metadata
 */
async function updateCampaignYieldData(
  opType: number,
  sender: string,
  token: string,
  campaignId: string,
  amount: string,
  networkId: number,
  log: EnhancedEventLog,
) {
  try {
    // Use campaignId as the yield ID since one campaign can only have one token
    const yieldId = campaignId;

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
        treasuryFeesPaid: false,
        treasuryFeeAmount: "0",
        networkId,
      };

    // Declare withdrawal events outside switch
    let withdrawalEvent: WithdrawalEventData | null = null;

    // Handle different operation types
    switch (opType) {
    case 1: // DEPOSITED
      yieldData = {
        ...yieldData,
        deposited: true,
        depositAmount: amount,
        lastUpdated: new Date(),
        lastOperation: "DEPOSITED",
        networkId,
      };

      await yieldRef.set(yieldData, {merge: true});
      logger.info(`Campaign yield record updated for deposit: ${yieldId}`);
      break;

    case 2: // WITHDRAWN_TO_CONTRACT
      yieldData = {
        ...yieldData,
        withdrawn: true,
        withdrawAmount: amount,
        lastUpdated: new Date(),
        lastOperation: "WITHDRAWN_TO_CONTRACT",
        networkId,
      };

      await yieldRef.set(yieldData, {merge: true});
      logger.info(
        `Campaign yield record updated for withdrawal to contract: ${yieldId}`,
      );

      // Create withdrawal event
      withdrawalEvent = {
        eventType: "Withdrawal",
        rawEventId: yieldId,
        createdAt: new Date(),
        blockNumber: log.block?.number || null,
        blockTimestamp: log.block?.timestamp ?
          new Date(log.block.timestamp * 1000) :
          null,
        transactionHash: log.transaction?.hash || null,
        contractAddress: log.account?.address || null,
        campaignId,
        token,
        amount,
        recipient: sender,
        withdrawalType: "CREATOR",
      };
      break;

    case 6: // WITHDRAWN_TO_PLATFORM_TREASURY
      yieldData = {
        ...yieldData,
        treasuryFeesPaid: true,
        treasuryFeeAmount: amount,
        lastUpdated: new Date(),
        lastOperation: "WITHDRAWN_TO_PLATFORM_TREASURY",
        networkId,
      };

      await yieldRef.set(yieldData, {merge: true});
      logger.info(
        `Campaign yield record updated for treasury fees: ${yieldId}`,
      );

      // Create treasury withdrawal event
      withdrawalEvent = {
        eventType: "Withdrawal",
        rawEventId: yieldId,
        createdAt: new Date(),
        blockNumber: log.block?.number || null,
        blockTimestamp: log.block?.timestamp ?
          new Date(log.block.timestamp * 1000) :
          null,
        transactionHash: log.transaction?.hash || null,
        contractAddress: log.account?.address || null,
        campaignId,
        token,
        amount,
        recipient: sender,
        withdrawalType: "TREASURY",
      };
      break;

    default:
      logger.warn(`Unknown operation type for campaign yield: ${opType}`);
    }

    // Store withdrawal event if one was created
    if (withdrawalEvent) {
      await db.collection("withdrawalEvents").add(withdrawalEvent);
      logger.info(`Withdrawal event stored for campaign ${yieldId}`);
    }
  } catch (error) {
    logger.error(`Error updating campaign yield data: ${error}`);
  }
}

/**
 * Updates the DeFi configuration in the defiConfig collection
 * @async
 * @function updateDefiConfiguration
 * @param {number} configType - The operation type code
 * @param {string} oldAddress - The previous address
 * @param {string} newAddress - The new address
 * @param {number} networkId - Network ID of the chain where defi config is deployed
 */
async function updateDefiConfiguration(
  configType: number,
  oldAddress: string,
  newAddress: string,
  networkId: number,
) {
  try {
    // Reference to the defi configuration document
    // We use network ID for the config document ID since there's one config per network
    const configRef = db.collection("defiConfig").doc(`${networkId}`);

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
        networkId,
      };

    // Update based on the operation code
    switch (configType) {
    case 3: // OP_TOKEN_REGISTRY_UPDATED
      configData.tokenRegistryAddress = newAddress;
      configData.lastOperation = "TOKEN_REGISTRY_UPDATED";
      break;

    case 4: // OP_FEE_MANAGER_UPDATED
      configData.feeManagerAddress = newAddress;
      configData.lastOperation = "FEE_MANAGER_UPDATED";
      break;

    case 5: // OP_AAVE_POOL_UPDATED
      configData.aavePoolAddress = newAddress;
      configData.lastOperation = "AAVE_POOL_UPDATED";
      break;

    default:
      logger.warn(`Unknown operation type: ${configType}`);
      configData.lastOperation = "UNKNOWN_CONFIG_UPDATED";
      return;
    }

    configData.lastUpdated = new Date();
    configData.networkId = networkId;

    await configRef.set(configData, {merge: true});
    logger.info(`DeFi configuration updated: ${configData.lastOperation}`);
  } catch (error) {
    logger.error(`Error updating defi configuration: ${error}`);
  }
}
