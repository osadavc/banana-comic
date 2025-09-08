import { createHmac } from "crypto";
import { getValidatedServerEnvironment } from "./env";

export const createUnsubSignature = (id: string) => {
  const { UNSUB_SECRET } = getValidatedServerEnvironment();
  return createHmac("sha256", UNSUB_SECRET).update(id).digest("hex");
};

export const buildUnsubUrl = (id: string, origin?: string) => {
  const sig = createUnsubSignature(id);
  const base = (origin && origin.replace(/\/$/, "")) || "";
  const path = `/api/unsub?id=${encodeURIComponent(id)}&sig=${encodeURIComponent(sig)}`;
  return `${base}${path}`;
};
