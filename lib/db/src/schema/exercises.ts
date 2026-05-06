import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const exercisesTable = pgTable("exercises", {
  id: serial("id").primaryKey(),
  nodeCode: text("node_code").notNull(),
  question: text("question").notNull(),
  options: jsonb("options").notNull().$type<string[]>(),
  correctOption: integer("correct_option").notNull(),
  explanation: text("explanation"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const exerciseAttemptsTable = pgTable("exercise_attempts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  exerciseId: integer("exercise_id").notNull(),
  nodeCode: text("node_code").notNull(),
  selectedOption: integer("selected_option").notNull(),
  correct: integer("correct").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertExerciseSchema = createInsertSchema(exercisesTable).omit({ id: true, createdAt: true });
export type InsertExercise = z.infer<typeof insertExerciseSchema>;
export type Exercise = typeof exercisesTable.$inferSelect;

export const insertExerciseAttemptSchema = createInsertSchema(exerciseAttemptsTable).omit({ id: true, createdAt: true });
export type InsertExerciseAttempt = z.infer<typeof insertExerciseAttemptSchema>;
export type ExerciseAttempt = typeof exerciseAttemptsTable.$inferSelect;
