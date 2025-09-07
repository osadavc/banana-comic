import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const comics = pgTable("comics", {
  id: uuid("id").primaryKey().defaultRandom(),
  prompt: text("prompt").notNull(),
  hash: text("hash").notNull().unique(),
  userEmail: text("user_email"),
  ip: text("ip").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InsertComic = typeof comics.$inferInsert;
export type SelectComic = typeof comics.$inferSelect;
