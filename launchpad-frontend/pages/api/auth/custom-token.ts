import { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "firebase-admin/auth";
import * as admin from "firebase-admin";
import { initializeApp, getApps } from "firebase-admin/app";

// Initialize Firebase Admin if it hasn't been initialized
if (!getApps().length) {
  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT || "{}"
  );
  initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({ error: "Wallet address is required" });
    }

    // Create a custom token for the wallet address
    const auth = getAuth();
    const customToken = await auth.createCustomToken(address);

    return res.status(200).json({ token: customToken });
  } catch (error) {
    console.error("Error generating custom token:", error);
    return res.status(500).json({ error: "Failed to generate custom token" });
  }
}
