import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  points: integer("points").notNull().default(0),
  totalWinnings: integer("total_winnings").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});


export const consumptionLogs = pgTable("consumption_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  category: text("category").notNull(), // movies, tv, books, music, games
  type: text("type").notNull(), // movie, episode, book, album, game
  rating: integer("rating"), // 1-5 stars
  review: text("review"),
  pointsEarned: integer("points_earned").notNull().default(10),
  consumedAt: timestamp("consumed_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dnaSurveyResponses = pgTable("dna_survey_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  questionId: text("question_id").notNull(),
  answer: text("answer").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dnaProfiles = pgTable("dna_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  superpowers: jsonb("superpowers").notNull(), // Array of superpower strings
  meaning: text("meaning").notNull(),
  topGenres: jsonb("top_genres").notNull(), // Array of genre strings
  viewingStyle: text("viewing_style"),
  discoverMethod: text("discover_method"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});


export const insertConsumptionLogSchema = createInsertSchema(consumptionLogs).omit({
  id: true,
  pointsEarned: true,
  createdAt: true,
});

export const insertDnaSurveyResponseSchema = createInsertSchema(dnaSurveyResponses).omit({
  id: true,
  createdAt: true,
});

export const insertDnaProfileSchema = createInsertSchema(dnaProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type ConsumptionLog = typeof consumptionLogs.$inferSelect;
export type InsertConsumptionLog = z.infer<typeof insertConsumptionLogSchema>;
export type DnaSurveyResponse = typeof dnaSurveyResponses.$inferSelect;
export type InsertDnaSurveyResponse = z.infer<typeof insertDnaSurveyResponseSchema>;
export type DnaProfile = typeof dnaProfiles.$inferSelect;
export type InsertDnaProfile = z.infer<typeof insertDnaProfileSchema>;
