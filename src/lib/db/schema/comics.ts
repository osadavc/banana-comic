import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const comics = pgTable("comics", {
  id: serial("id").primaryKey(),
  prompt: text("prompt").notNull(),
  hash: text("hash").notNull().unique(),
  userEmail: text("user_email").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InsertComic = typeof comics.$inferInsert;
export type SelectComic = typeof comics.$inferSelect;
