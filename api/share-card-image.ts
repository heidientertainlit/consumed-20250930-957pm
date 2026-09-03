import { handleShareCardImageRequest } from "../server/share-card-image.js";

export default async function handler(req: any, res: any) {
  try {
    return await handleShareCardImageRequest(req, res);
  } catch (error) {
    console.error("[share card image]", error);
    return res.status(500).json({ error: "Could not create share card" });
  }
}