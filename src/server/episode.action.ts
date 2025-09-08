"use server";

import { db } from "@/lib/db";
import { comics } from "@/lib/db/schema/comics";
import { episodes } from "@/lib/db/schema/episodes";
import { desc, eq } from "drizzle-orm";
import { createR2Client, getPublicR2UrlForKey, getR2Config } from "@/lib/r2";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { sendDailyComicEmail } from "./email.action";
import { generateText, type UserContent } from "ai";
import { google } from "@ai-sdk/google";
import { buildUnsubUrl } from "@/lib/unsub";

const fetchLatestEpisodeForComic = async (comicId: string) => {
  const episodeRows = await db
    .select({
      id: episodes.id,
      imageUrl: episodes.imageUrl,
      generationPrompt: episodes.generationPrompt,
      date: episodes.date,
    })
    .from(episodes)
    .where(eq(episodes.comicId, comicId))
    .orderBy(desc(episodes.date))
    .limit(1);

  return episodeRows[0];
};

const buildImagePrompt = (seriesPrompt: string, fourPanelDirection: string) => {
  return [
    "Create a single square image that is a classic 4-panel comic (2x2 grid).",
    "Maintain consistent characters, environment, props, and art style across all panels.",
    "If a reference image from a previous episode is provided, strictly replicate its visual style and character designs:",
    "- Match line weight, color palette, inking, and rendering style.",
    "- Keep the same character faces, hairstyles, proportions, outfits, and iconic details.",
    "- Keep recurring props and backgrounds consistent unless the story changes them explicitly.",
    "Do not redesign characters or shift the art style between episodes unless explicitly instructed.",
    "Readable facial expressions, clear poses, and family-friendly tone.",
    "High contrast line art, flat colors, comic inking, no watermark, professional look.",
    "Layout: equal-sized panels with thin gutters; ensure text/visuals fit each panel.",
    "Include clear speech bubbles with the exact dialog lines provided for each panel.",
    "Render legible lettering inside bubbles; do not paraphrase or invent text.",
    "Place bubbles to avoid covering key faces/hands; use standard comic tails toward the speaking character.",
    `Series premise: ${seriesPrompt}`,
    "Describe and render these panels faithfully. Each panel includes a short DIALOG line to render in a speech bubble:",
    fourPanelDirection,
  ].join("\n");
};

const generateFourPanelDirectionText = async (
  seriesPrompt: string,
  previousDirection?: string
) => {
  const startedAt = Date.now();
  console.log("[episode] directionText:start", {
    hasPrevious: Boolean(previousDirection),
    seriesPromptLen: seriesPrompt?.length,
  });
  const guidance = previousDirection
    ? `Continue the ongoing story. Keep continuity of characters, props, setting, and visual design from the previous episode. Preserve character outfits, hairstyles, proportions, and recurring props. Build a small progression today without introducing style changes.`
    : `Start the story with an opening 4-panel mini beat. Establish the main characters quickly and clearly with distinctive, memorable visual traits that can be kept consistent in future episodes.`;

  const instruction = [
    "You write a concise 4-panel plan for a daily, family-friendly comic strip.",
    "Return exactly 4 short numbered lines. For each panel, provide: VISUAL (brief action/beat) and DIALOG (one short quote to place in a speech bubble).",
    "Use this format strictly:",
    '1) Panel 1 — VISUAL: <brief description>. DIALOG: "<short line>"',
    '2) Panel 2 — VISUAL: <brief description>. DIALOG: "<short line>"',
    '3) Panel 3 — VISUAL: <brief description>. DIALOG: "<short line>"',
    '4) Panel 4 — VISUAL: <brief description>. DIALOG: "<short line>"',
    "Constraints: keep dialog family-friendly, 3–10 words per panel, natural speech, no narration, no sound effects, no emojis.",
    guidance,
    `Series premise: ${seriesPrompt}`,
    previousDirection
      ? `Previous episode directions: ${previousDirection}`
      : undefined,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const { text } = await generateText({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: instruction }],
        },
      ],
    });
    const totalMs = Date.now() - startedAt;
    console.log("[episode] directionText:ok", {
      length: text?.length,
      preview: text?.slice?.(0, 120),
      totalMs,
    });
    return text.trim();
  } catch (error) {
    console.error("[episode] directionText:error", error);
    throw error;
  }
};

const fetchUrlAsBase64 = async (url: string) => {
  const startedAt = Date.now();
  console.log("[episode] fetchUrlAsBase64:start", { url });
  const response = await fetch(url);
  if (!response.ok) {
    console.error("[episode] fetchUrlAsBase64:httpError", {
      status: response.status,
      statusText: response.statusText,
    });
    throw new Error(`Failed to fetch file: ${response.status}`);
  }
  const contentType = response.headers.get("content-type") || "image/png";
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const totalMs = Date.now() - startedAt;
  console.log("[episode] fetchUrlAsBase64:ok", {
    contentType,
    bytes: arrayBuffer.byteLength,
    base64Len: base64.length,
    totalMs,
  });
  return { base64, mediaType: contentType };
};

const generateImageWithGemini = async (
  prompt: string,
  previousImage?: { base64: string; mediaType: string }
) => {
  const startedAt = Date.now();
  console.log("[episode] generateImageWithGemini:start", {
    promptLen: prompt?.length,
    hasPrevious: Boolean(previousImage),
    previousMediaType: previousImage?.mediaType,
  });
  const content: UserContent = [{ type: "text", text: prompt }];

  if (previousImage) {
    content.push({
      type: "text",
      text: "Reference image attached: replicate its visual style and keep characters consistent (faces, hairstyles, proportions, outfits, colors). Do not redesign or change art style.",
    });
    content.push({
      type: "file",
      data: previousImage.base64,
      mediaType: previousImage.mediaType,
    });
  }

  let result;
  try {
    result = await generateText({
      model: google("gemini-2.5-flash-image-preview"),
      providerOptions: { google: { responseModalities: ["TEXT", "IMAGE"] } },
      messages: [
        {
          role: "user",
          content,
        },
      ],
    });
  } catch (error) {
    console.error("[episode] generateImageWithGemini:error", error);
    throw error;
  }

  const files = result.files || [];
  const imageFile = files.find((candidateFile) =>
    candidateFile.mediaType?.startsWith("image/")
  );
  if (!imageFile) {
    console.error("[episode] generateImageWithGemini:noImageFile", {
      filesCount: files.length,
      mediaTypes: files.map((f) => f.mediaType),
    });
    throw new Error("Gemini did not return an image file");
  }

  const mediaType = imageFile.mediaType || "image/png";
  const base64 =
    imageFile.base64 ||
    (imageFile.uint8Array
      ? Buffer.from(imageFile.uint8Array).toString("base64")
      : undefined);
  if (!base64) {
    console.error("[episode] generateImageWithGemini:missingImageData");
    throw new Error("Gemini image missing data");
  }

  const buffer = Buffer.from(base64, "base64");
  const totalMs = Date.now() - startedAt;
  console.log("[episode] generateImageWithGemini:ok", {
    mediaType,
    bufferBytes: buffer.byteLength,
    totalMs,
  });
  return { buffer, mediaType };
};

const uploadToR2 = async (key: string, buffer: Buffer, contentType: string) => {
  const startedAt = Date.now();
  console.log("[episode] uploadToR2:start", {
    key,
    contentType,
    bytes: buffer?.byteLength,
  });
  const r2Client = createR2Client();
  const { bucketName } = getR2Config();
  try {
    await r2Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
  } catch (error) {
    console.error("[episode] uploadToR2:error", error);
    throw error;
  }
  const url = getPublicR2UrlForKey(key);
  const totalMs = Date.now() - startedAt;
  console.log("[episode] uploadToR2:ok", { url, totalMs });
  return url;
};

const getAppOrigin = () => {
  const explicit =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.APP_ORIGIN;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;
  return "http://localhost:3000";
};

export const createAndSendNextEpisode = async (comicId: string) => {
  const startedAt = Date.now();
  console.log("[episode] start createAndSendNextEpisode", { comicId });
  const comicRows = await db
    .select({
      id: comics.id,
      title: comics.title,
      prompt: comics.prompt,
      userEmail: comics.userEmail,
    })
    .from(comics)
    .where(eq(comics.id, comicId))
    .limit(1);
  const comic = comicRows[0];
  console.log("[episode] fetched comic", {
    found: Boolean(comic),
    hasEmail: Boolean(comic?.userEmail),
  });
  if (!comic || !comic.userEmail) {
    console.error("[episode] missing comic or userEmail", {
      comicExists: Boolean(comic),
    });
    throw new Error("Comic or user email not found");
  }

  const latestEpisode = await fetchLatestEpisodeForComic(comicId);
  console.log("[episode] latestEpisode", {
    exists: Boolean(latestEpisode),
    hasImage: Boolean(latestEpisode?.imageUrl),
  });
  const previousDirectionText = latestEpisode?.generationPrompt ?? "";
  console.log("[episode] generating directionText");
  const directionText = await generateFourPanelDirectionText(
    comic.prompt,
    previousDirectionText || undefined
  );
  console.log("[episode] generated directionText", {
    length: directionText?.length,
    preview: directionText?.slice?.(0, 120),
  });
  const fullPrompt = buildImagePrompt(comic.prompt, directionText);
  console.log("[episode] built full image prompt", {
    length: fullPrompt.length,
    preview: fullPrompt.slice(0, 120),
  });

  const previousImage = latestEpisode?.imageUrl
    ? await fetchUrlAsBase64(latestEpisode.imageUrl)
    : undefined;
  console.log("[episode] previousImage prepared", {
    included: Boolean(previousImage),
    mediaType: previousImage?.mediaType,
    base64Len: previousImage?.base64?.length,
  });
  console.log("[episode] calling generateImageWithGemini");
  const { buffer, mediaType } = await generateImageWithGemini(
    fullPrompt,
    previousImage
  );
  console.log("[episode] image generated", {
    mediaType,
    bufferBytes: buffer?.byteLength,
  });

  const fileExtension = mediaType.includes("png")
    ? "png"
    : mediaType.includes("jpeg")
      ? "jpg"
      : "png";
  const objectKey = `comics/${comicId}/${Date.now()}.${fileExtension}`;
  console.log("[episode] uploading to R2", {
    objectKey,
    contentType: mediaType,
  });
  const imageUrl = await uploadToR2(objectKey, buffer, mediaType);
  console.log("[episode] uploaded to R2", { imageUrl });

  console.log("[episode] inserting episode row");
  await db.insert(episodes).values({
    comicId,
    imageUrl,
    generationPrompt: directionText,
  });
  console.log("[episode] episode row inserted");

  const episodeCountRows = await db
    .select({ id: episodes.id })
    .from(episodes)
    .where(eq(episodes.comicId, comicId));
  const issueNumber = episodeCountRows.length;
  console.log("[episode] computed issueNumber", { issueNumber });

  const unsubUrl = buildUnsubUrl(comicId, getAppOrigin());
  console.log("[episode] sending email", {
    to: comic.userEmail,
    title: comic.title,
    issueNumber,
    imageUrl,
    unsubUrl,
  });
  await sendDailyComicEmail({
    to: comic.userEmail as string,
    title: comic.title || "",
    issueNumber,
    imageUrl,
    unsubUrl,
    date: new Date().toISOString(),
  });
  console.log("[episode] email sent");

  const totalMs = Date.now() - startedAt;
  console.log("[episode] done createAndSendNextEpisode", {
    comicId,
    issueNumber,
    totalMs,
  });
  return { imageUrl, issueNumber };
};
