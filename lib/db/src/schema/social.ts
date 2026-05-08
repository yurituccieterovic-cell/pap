import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const friendshipsTable = pgTable("friendships", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  friendId: integer("friend_id").notNull().references(() => usersTable.id),
  status: text("status").notNull().default("accepted"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique("friendships_pair").on(t.userId, t.friendId)]);

export const friendMessagesTable = pgTable("friend_messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull().references(() => usersTable.id),
  receiverId: integer("receiver_id").notNull().references(() => usersTable.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const socialNotesTable = pgTable("social_notes", {
  id: serial("id").primaryKey(),
  user1Id: integer("user1_id").notNull().references(() => usersTable.id),
  user2Id: integer("user2_id").notNull().references(() => usersTable.id),
  content: text("content").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique("social_notes_pair").on(t.user1Id, t.user2Id)]);

export type Friendship = typeof friendshipsTable.$inferSelect;
export type FriendMessage = typeof friendMessagesTable.$inferSelect;
export type SocialNote = typeof socialNotesTable.$inferSelect;
