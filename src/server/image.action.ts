"use server";

import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { db } from "@/lib/db";
import { comics } from "@/lib/db/schema/comics";
import { and, eq, gte } from "drizzle-orm";
import { normalizePrompt, hashPrompt, deriveTitle } from "@/lib/prompt";
import { getClientIp } from "@/lib/request/ip";

const promptValidationSchema = z.object({
  isValid: z.boolean(),
  reason: z.string().optional().nullable(),
});

const emailSchema = z.email("Invalid email");

const titleSchema = z.object({
  title: z.string().min(3).max(80),
});

const generateTitleFromLLM = async (cleanedPrompt: string) => {
  try {
    const { object } = await generateObject({
      model: openai("gpt-5-nano"),
      system:
        "You create a very short, catchy, family-friendly comic strip title in 3-8 words. Do not include quotes or punctuation at the ends.",
      prompt: `Prompt: ${cleanedPrompt}\nReturn JSON with { title } only.`,
      schema: titleSchema,
    });
    return object.title;
  } catch {
    // Fallback to heuristic if LLM is unavailable
    return deriveTitle(cleanedPrompt);
  }
};

export type VerifyResult = {
  ok: boolean;
  reason?: string;
  hash: string;
  id?: string;
};

// DB-backed per-IP daily limiter using `comics.createdAt`
const isRateLimitedByDb = async (ip: string) => {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ id: comics.id })
    .from(comics)
    .where(and(eq(comics.ip, ip), gte(comics.createdAt, oneDayAgo)))
    .limit(1);
  return rows.length > 0;
};

// Verify a prompt -> persist a pending comic row (hash+prompt+ip) and return id+hash
export const verifyPrompt = async (prompt: string): Promise<VerifyResult> => {
  const cleaned = normalizePrompt(prompt);
  const hash = hashPrompt(cleaned);

  try {
    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      system:
        "You validate if a short story prompt can be illustrated as a daily, family-friendly comic. Reject illegal, explicit, hateful, or private data requests.",
      prompt: `Prompt: ${cleaned}\nDecide if it can be illustrated daily as a never-ending story arc.`,
      schema: promptValidationSchema,
    });

    const result: VerifyResult = { ok: object.isValid, hash };
    if (object.isValid) {
      const ip = await getClientIp();
      // Upsert-like: If same hash exists, reuse id; else insert
      const existing = await db
        .select({ id: comics.id, title: comics.title })
        .from(comics)
        .where(eq(comics.hash, hash))
        .limit(1);
      if (existing.length > 0) {
        result.id = existing[0].id as string;
        if (!existing[0].title) {
          const title = await generateTitleFromLLM(cleaned);
          await db
            .update(comics)
            .set({ title })
            .where(eq(comics.id, result.id));
        }
      } else {
        const title = await generateTitleFromLLM(cleaned);
        const inserted = await db
          .insert(comics)
          .values({ prompt: cleaned, hash, ip, title })
          .returning({ id: comics.id });
        result.id = inserted[0].id as string;
      }
    } else if (object.reason) {
      result.reason = object.reason;
    }
    return result;
  } catch {
    // Fallback: basic heuristic if AI call fails
    const ok = cleaned.length >= 8;
    const result: VerifyResult = { ok, hash };
    if (ok) {
      const ip = await getClientIp();
      const existing = await db
        .select({ id: comics.id, title: comics.title })
        .from(comics)
        .where(eq(comics.hash, hash))
        .limit(1);
      if (existing.length > 0) {
        result.id = existing[0].id as string;
        if (!existing[0].title) {
          const title = await generateTitleFromLLM(cleaned);
          await db
            .update(comics)
            .set({ title })
            .where(eq(comics.id, result.id));
        }
      } else {
        const title = await generateTitleFromLLM(cleaned);
        const inserted = await db
          .insert(comics)
          .values({ prompt: cleaned, hash, ip, title })
          .returning({ id: comics.id });
        result.id = inserted[0].id as string;
      }
    } else {
      result.reason = "Prompt too short";
    }
    return result;
  }
};

// Register should receive the verified id and hash; recompute hash and ensure it matches stored row; then update email.
export const registerUser = async (args: {
  id: string;
  prompt: string;
  hash: string;
  email: string;
}): Promise<{ ok: true } | { ok: false; error: string }> => {
  const ip = await getClientIp();
  if (await isRateLimitedByDb(ip)) {
    return { ok: false, error: "Rate limit reached. Try again tomorrow." };
  }

  const cleanedPrompt = normalizePrompt(args.prompt);
  const computedHash = hashPrompt(cleanedPrompt);
  if (computedHash !== args.hash) {
    return { ok: false, error: "Hash mismatch for submitted prompt." };
  }

  const emailParse = emailSchema.safeParse(args.email);
  if (!emailParse.success) {
    return {
      ok: false,
      error: emailParse.error.issues[0]?.message ?? "Invalid email",
    };
  }

  // Ensure the stored row id exists and matches the hash
  const existing = await db
    .select({ id: comics.id, hash: comics.hash })
    .from(comics)
    .where(eq(comics.id, args.id))
    .limit(1);
  if (existing.length === 0) {
    return { ok: false, error: "Verification record not found." };
  }
  if (existing[0].hash !== computedHash) {
    return { ok: false, error: "Stored hash mismatch; prompt was modified." };
  }

  try {
    // Update the verified comic entry with email
    await db
      .update(comics)
      .set({ userEmail: emailParse.data })
      .where(eq(comics.id, args.id));
    return { ok: true };
  } catch {
    return { ok: false, error: "Database error while registering." };
  }
};
