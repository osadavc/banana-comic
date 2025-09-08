import { createHash } from "crypto";

export const normalizePrompt = (input: string) =>
  input.trim().replace(/\s+/g, " ");

export const hashPrompt = (input: string) =>
  createHash("sha256").update(normalizePrompt(input)).digest("hex");
