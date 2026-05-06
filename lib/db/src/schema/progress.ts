import { pgTable, text, integer, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const nodeProgressTable = pgTable("node_progress", {
  id: serial("id").primaryKey(),
  nodeCode: text("node_code").notNull().unique(),
  opened: boolean("opened").notNull().default(false),
  read: boolean("read").notNull().default(false),
  openedAt: timestamp("opened_at", { withTimezone: true }),
  readAt: timestamp("read_at", { withTimezone: true }),
});

export const achievementsTable = pgTable("achievements", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull(), // explored, read, exercise, approved
  nodeCode: text("node_code"),
  earnedAt: timestamp("earned_at", { withTimezone: true }),
  earned: boolean("earned").notNull().default(false),
});

export const insertNodeProgressSchema = createInsertSchema(nodeProgressTable).omit({ id: true });
export const insertAchievementSchema = createInsertSchema(achievementsTable).omit({ id: true });
export type InsertNodeProgress = z.infer<typeof insertNodeProgressSchema>;
export type InsertAchievement = z.infer<typeof insertAchievementSchema>;
export type NodeProgress = typeof nodeProgressTable.$inferSelect;
export type Achievement = typeof achievementsTable.$inferSelect;
