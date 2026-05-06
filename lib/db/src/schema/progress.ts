import { pgTable, text, integer, serial, timestamp, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const nodeProgressTable = pgTable("node_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  nodeCode: text("node_code").notNull(),
  opened: boolean("opened").notNull().default(false),
  read: boolean("read").notNull().default(false),
  openedAt: timestamp("opened_at", { withTimezone: true }),
  readAt: timestamp("read_at", { withTimezone: true }),
}, (table) => ({
  userNodeUnique: uniqueIndex("node_progress_user_node_unique").on(table.userId, table.nodeCode),
}));

export const achievementsTable = pgTable("achievements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  code: text("code").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull(),
  nodeCode: text("node_code"),
  earnedAt: timestamp("earned_at", { withTimezone: true }),
  earned: boolean("earned").notNull().default(false),
}, (table) => ({
  userCodeUnique: uniqueIndex("achievements_user_code_unique").on(table.userId, table.code),
}));

export const insertNodeProgressSchema = createInsertSchema(nodeProgressTable).omit({ id: true });
export const insertAchievementSchema = createInsertSchema(achievementsTable).omit({ id: true });
export type InsertNodeProgress = z.infer<typeof insertNodeProgressSchema>;
export type InsertAchievement = z.infer<typeof insertAchievementSchema>;
export type NodeProgress = typeof nodeProgressTable.$inferSelect;
export type Achievement = typeof achievementsTable.$inferSelect;
