import { headers } from "next/headers";

export const getClientIp = async (): Promise<string> => {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? "unknown";
  const realIp = h.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
};
