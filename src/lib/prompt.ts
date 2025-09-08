import { createHash } from "crypto";

export const normalizePrompt = (input: string) =>
  input.trim().replace(/\s+/g, " ");

export const hashPrompt = (input: string) =>
  createHash("sha256").update(normalizePrompt(input)).digest("hex");

export const deriveTitle = (input: string) => {
  const cleaned = normalizePrompt(input);
  // Take first sentence or up to 8 words
  const sentence = cleaned.split(/[.!?]/)[0] || cleaned;
  const words = sentence.split(" ").slice(0, 8);
  const base = words.join(" ").trim();
  if (base.length === 0) return "Daily Comic";
  const titled = base
    .split(" ")
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
  return titled;
};
