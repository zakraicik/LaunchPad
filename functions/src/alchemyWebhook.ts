import {logger} from "firebase-functions";
import {onRequest} from "firebase-functions/v2/https";

// The Firebase Admin SDK to access Firestore.
import admin from "firebase-admin";
const db = admin.firestore();

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

    // Respond with success
    res.status(200).send("Webhook received successfully");
  } catch (error) {
    logger.error("Error processing webhook:", error);
    res.status(500).send("Error processing webhook");
  }
});
