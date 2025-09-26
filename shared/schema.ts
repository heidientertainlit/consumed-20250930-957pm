import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, integer, timestamp, boolean, jsonb, serial } from "drizzle-orm/pg-core";
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

// Lists table to match existing Supabase schema
export const lists = pgTable("lists", {
  id: serial("id").primaryKey(), // Keep existing serial ID
  userId: varchar("user_id").references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  visibility: varchar("visibility").default("private"),
  isDefault: boolean("is_default").default(false),
  isPinned: boolean("is_pinned").default(false),
  isPrivate: boolean("is_private").default(true), // Main public/private toggle
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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

export const ednaResponses = pgTable("edna_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  questionId: text("question_id").notNull(),
  answer: text("answer").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dnaProfiles = pgTable("dna_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  profileText: text("profile_text").notNull(),
  favoriteGenres: jsonb("favorite_genres"), // Array of genre strings
  favoriteMediaTypes: jsonb("favorite_media_types"), // Array of media types
  favoriteSports: jsonb("favorite_sports"), // Array of sports
  mediaConsumptionStats: text("media_consumption_stats"), // JSON string
  isPrivate: boolean("is_private").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const socialPosts = pgTable("social_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  mediaTitle: text("media_title").notNull(),
  mediaType: text("media_type").notNull(),
  mediaCreator: text("media_creator"),
  mediaImage: text("media_image"),
  mediaExternalId: text("media_external_id"),
  mediaExternalSource: text("media_external_source"),
  mediaDescription: text("media_description"),
  rating: decimal("rating"),
  thoughts: text("thoughts"),
  audience: text("audience").default("all"), // 'all' or 'top-fans'
  likes: integer("likes").default(0),
  comments: integer("comments").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const socialPostComments = pgTable("social_post_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => socialPosts.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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

export const insertEdnaResponseSchema = createInsertSchema(ednaResponses).omit({
  id: true,
  createdAt: true,
});

export const insertDnaProfileSchema = createInsertSchema(dnaProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertListSchema = createInsertSchema(lists).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSocialPostSchema = createInsertSchema(socialPosts).omit({
  id: true,
  likes: true,
  comments: true,
  createdAt: true,
});

export const insertSocialPostCommentSchema = createInsertSchema(socialPostComments).omit({
  id: true,
  createdAt: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type List = typeof lists.$inferSelect;
export type InsertList = z.infer<typeof insertListSchema>;
export type ConsumptionLog = typeof consumptionLogs.$inferSelect;
export type InsertConsumptionLog = z.infer<typeof insertConsumptionLogSchema>;
export type EdnaResponse = typeof ednaResponses.$inferSelect;
export type InsertEdnaResponse = z.infer<typeof insertEdnaResponseSchema>;
export type DnaProfile = typeof dnaProfiles.$inferSelect;
export type InsertDnaProfile = z.infer<typeof insertDnaProfileSchema>;
export type SocialPost = typeof socialPosts.$inferSelect;
export type InsertSocialPost = z.infer<typeof insertSocialPostSchema>;
export type SocialPostComment = typeof socialPostComments.$inferSelect;
export type InsertSocialPostComment = z.infer<typeof insertSocialPostCommentSchema>;
