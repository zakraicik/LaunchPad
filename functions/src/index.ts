// To emulate -> npm run serve
// to Deploy -> npm run deploy

// The Cloud Functions for Firebase SDK to create Cloud Functions and triggers.
import {logger} from "firebase-functions";
import {onRequest} from "firebase-functions/v2/https";

// The Firebase Admin SDK to access Firestore.
import {initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";

initializeApp();
const db = getFirestore();

/**
 * Webhook handler for Alchemy events
 * @param {Request} req - HTTP request object
 * @param {Response} res - HTTP response object
 * @returns {Promise<void>}
 */
export const alchemyWebhook = onRequest(async (req, res) => {
  try {
    // Log the incoming webhook data
    logger.info("Received webhook payload:", JSON.stringify(req.body));

    const webhookData = req.body;

    // Store raw event data for debugging
    const writeResult = await db.collection("rawEvents").add({
      timestamp: new Date(),
      data: webhookData,
    });

    logger.info(`Event stored with ID: ${writeResult.id}`);

    // Process the event data based on type
    if (webhookData.event && webhookData.event.activity) {
      await processEventActivity(webhookData.event.activity);
    }

    // Respond with success
    res.status(200).send("Webhook received successfully");
  } catch (error) {
    logger.error("Error processing webhook:", error);
    res.status(500).send("Error processing webhook");
  }
});

/**
 * Process blockchain activity events from Alchemy
 * @param {Activity[]} activity - Array of blockchain activities to process
 * @return {Promise<void>}
 */
async function processEventActivity(activity: any[]): Promise<void> {
  logger.info("Processing activity:", activity);
}

export * from "./tokenRegistryProcessor";
export * from "./platformAdminProcessor";
export * from "./feeManagerProcessor";
export * from "./defiIntegrationManagerProcessor";
export * from "./CampaignFactoryProcessor";
export * from "./CampaignEventProcessor";
