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

  const { text } = await generateText({
    model: "google/gemini-2.5-flash-lite",
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: instruction }],
      },
    ],
  });

  return text.trim();
};

const fetchUrlAsBase64 = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch file: ${response.status}`);
  const contentType = response.headers.get("content-type") || "image/png";
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return { base64, mediaType: contentType };
};

const generateImageWithGemini = async (
  prompt: string,
  previousImage?: { base64: string; mediaType: string }
) => {
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

  const result = await generateText({
    model: google("gemini-2.5-flash-image-preview"),
    providerOptions: { google: { responseModalities: ["TEXT", "IMAGE"] } },
    messages: [
      {
        role: "user",
        content,
      },
    ],
  });

  const files = result.files || [];
  const imageFile = files.find((candidateFile) =>
    candidateFile.mediaType?.startsWith("image/")
  );
  if (!imageFile) {
    throw new Error("Gemini did not return an image file");
  }

  const mediaType = imageFile.mediaType || "image/png";
  const base64 =
    imageFile.base64 ||
    (imageFile.uint8Array
      ? Buffer.from(imageFile.uint8Array).toString("base64")
      : undefined);
  if (!base64) {
    throw new Error("Gemini image missing data");
  }

  const buffer = Buffer.from(base64, "base64");
  return { buffer, mediaType };
};

const uploadToR2 = async (key: string, buffer: Buffer, contentType: string) => {
  const r2Client = createR2Client();
  const { bucketName } = getR2Config();
  await r2Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
  return getPublicR2UrlForKey(key);
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
  if (!comic || !comic.userEmail) {
    throw new Error("Comic or user email not found");
  }

  const latestEpisode = await fetchLatestEpisodeForComic(comicId);
  const previousDirectionText = latestEpisode?.generationPrompt ?? "";
  const directionText = await generateFourPanelDirectionText(
    comic.prompt,
    previousDirectionText || undefined
  );
  const fullPrompt = buildImagePrompt(comic.prompt, directionText);

  const previousImage = latestEpisode?.imageUrl
    ? await fetchUrlAsBase64(latestEpisode.imageUrl)
    : undefined;
  const { buffer, mediaType } = await generateImageWithGemini(
    fullPrompt,
    previousImage
  );

  const fileExtension = mediaType.includes("png")
    ? "png"
    : mediaType.includes("jpeg")
      ? "jpg"
      : "png";
  const objectKey = `comics/${comicId}/${Date.now()}.${fileExtension}`;
  const imageUrl = await uploadToR2(objectKey, buffer, mediaType);

  await db.insert(episodes).values({
    comicId,
    imageUrl,
    generationPrompt: directionText,
  });

  const episodeCountRows = await db
    .select({ id: episodes.id })
    .from(episodes)
    .where(eq(episodes.comicId, comicId));
  const issueNumber = episodeCountRows.length;

  const unsubUrl = buildUnsubUrl(comicId, getAppOrigin());
  await sendDailyComicEmail({
    to: comic.userEmail as string,
    title: comic.title || "",
    issueNumber,
    imageUrl,
    unsubUrl,
    date: new Date().toISOString(),
  });

  return { imageUrl, issueNumber };
};
