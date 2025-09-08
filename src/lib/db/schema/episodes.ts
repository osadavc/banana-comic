import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { comics } from "./comics";

export const episodes = pgTable("episodes", {
  id: uuid("id").primaryKey().defaultRandom(),
  comicId: uuid("comic_id")
    .notNull()
    .references(() => comics.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
  generationPrompt: text("generation_prompt").notNull(),
  date: timestamp("date").defaultNow().notNull(),
});

export type InsertEpisode = typeof episodes.$inferInsert;
export type SelectEpisode = typeof episodes.$inferSelect;
