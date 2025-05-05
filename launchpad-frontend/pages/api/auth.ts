import type { NextApiRequest, NextApiResponse } from "next";

// Get the password from environment variable
const SITE_PASSWORD = process.env.SITE_PASSWORD;

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { password } = req.body;

  if (password === SITE_PASSWORD) {
    // Set a cookie to remember the authentication
    res.setHeader(
      "Set-Cookie",
      "site-auth=true; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000"
    ); // 30 days
    return res.status(200).json({ success: true });
  }

  return res.status(401).json({ message: "Invalid password" });
}
