import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

export const createDb = () => {
  const url = process.env.DATABASE_URL!;
  const sql = neon(url);
  return drizzle(sql);
};

export const db = createDb();
