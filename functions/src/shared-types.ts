/**
 * @fileoverview Shared type definitions for event processors
 * @module shared-types
 */

/**
 * Interface representing an event log from the blockchain
 * @interface EventLog
 */
export interface EventLog {
  /** Raw event data (non-indexed parameters) */
  data: string
  /** Array of event topics (indexed parameters) */
  topics: string[]
  /** Log index in the block */
  index?: number
  /** Account information containing address */
  account?: {
    address?: string
  }
  /** Transaction information containing hash and other details */
  transaction?: {
    hash?: string
    // Other transaction fields omitted for brevity
  }
}

/**
 * Interface representing Alchemy webhook response structure
 * @interface AlchemyWebhookResponse
 */
export interface AlchemyWebhookResponse {
  webhookId: string
  id: string
  createdAt: string
  type: string
  event: {
    data: {
      block: {
        hash: string
        number: number
        timestamp: number
        logs: EventLog[]
      }
    }
    sequenceNumber: string
    network: string
  }
}

/**
 * Enhanced EventLog interface with block information
 * @interface EnhancedEventLog
 */
export interface EnhancedEventLog extends EventLog {
  block?: {
    number?: number
    timestamp?: number
  }
}

/**
 * Function to create an enhanced event log from a raw event log and block information
 * @function createEnhancedEventLog
 * @param {EventLog} log - The raw event log
 * @param {number} blockNumber - The block number
 * @param {number} blockTimestamp - The block timestamp
 * @return {EnhancedEventLog} The enhanced event log
 */
export function createEnhancedEventLog(
  log: EventLog,
  blockNumber: number,
  blockTimestamp: number,
): EnhancedEventLog {
  return {
    ...log,
    block: {
      number: blockNumber,
      timestamp: blockTimestamp,
    },
  };
}
