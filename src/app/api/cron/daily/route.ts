import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { comics } from "@/lib/db/schema/comics";
import { isNotNull } from "drizzle-orm";
import { createAndSendNextEpisode } from "@/server/episode.action";

// Episode generation logic moved to createAndSendNextEpisode

export const GET = async (request: NextRequest) => {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const subscribedComics = await db
    .select({
      id: comics.id,
      title: comics.title,
      prompt: comics.prompt,
      userEmail: comics.userEmail,
    })
    .from(comics)
    .where(isNotNull(comics.userEmail));

  let processed = 0;
  for (const comic of subscribedComics) {
    try {
      await createAndSendNextEpisode(comic.id);
      processed += 1;
    } catch (error) {
      console.error("Cron item failed", comic.id, error);
      continue;
    }
  }

  return Response.json({ success: true, processed });
};
