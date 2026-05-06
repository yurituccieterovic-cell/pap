import { pgTable, text, integer, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const nodesTable = pgTable("nodes", {
  code: text("code").primaryKey(),
  title: text("title").notNull(),
  abbreviation: text("abbreviation"),
  subtitle: text("subtitle"),
  content: text("content"),
  imageUrl: text("image_url"),
  parentCode: text("parent_code"),
  level: integer("level").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const insertNodeSchema = createInsertSchema(nodesTable).omit({});
export type InsertNode = z.infer<typeof insertNodeSchema>;
export type KnowledgeNode = typeof nodesTable.$inferSelect;
