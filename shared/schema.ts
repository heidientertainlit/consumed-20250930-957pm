import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, integer, timestamp, boolean, jsonb, serial, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("user_name").notNull().unique(),
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
  label: text("label"), // Archetype label (e.g., "Cozy Completionist")
  tagline: text("tagline"), // One-line tag
  profileText: text("profile_text").notNull(),
  flavorNotes: jsonb("flavor_notes"), // Array of 3 flavor notes
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
  content: text("content"),
  postType: text("post_type").default("update"),
  rating: real("rating"),
  progress: integer("progress"),
  mediaTitle: text("media_title"),
  mediaType: text("media_type"),
  mediaCreator: text("media_creator"),
  imageUrl: text("image_url"),
  mediaExternalId: text("media_external_id"),
  mediaExternalSource: text("media_external_source"),
  mediaDescription: text("media_description"),
  visibility: text("visibility").default("public"),
  likesCount: integer("likes_count").default(0),
  commentsCount: integer("comments_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const socialPostComments = pgTable("social_post_comments", {
  id: serial("id").primaryKey(), // Match production: INTEGER serial, not UUID
  postId: varchar("post_id").notNull().references(() => socialPosts.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  likesCount: integer("likes_count").notNull().default(0),
  parentCommentId: integer("parent_comment_id").references((): any => socialPostComments.id, { onDelete: "cascade" }), // For nested replies (Phase 2)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Comment likes table (many-to-many relationship)
export const socialCommentLikes = pgTable("social_comment_likes", {
  id: serial("id").primaryKey(), // Match production: INTEGER serial
  commentId: integer("comment_id").notNull().references(() => socialPostComments.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Existing prediction system tables (align with production)
export const predictionPools = pgTable("prediction_pools", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull(), // "vote", "weekly", "awards", "bracket"
  pointsReward: integer("points_reward").notNull(),
  deadline: text("deadline").notNull(),
  status: text("status").notNull(), // "open", "locked", "completed"
  category: text("category").notNull(),
  icon: text("icon").notNull(),
  options: jsonb("options"), // Array of options
  correctAnswer: text("correct_answer"), // For trivia: stores the correct answer
  inline: boolean("inline"),
  participants: integer("participants"),
  createdAt: timestamp("created_at"),
});

export const predictionResults = pgTable("prediction_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  poolId: text("pool_id").notNull().references(() => predictionPools.id),
  winningOption: text("winning_option").notNull(),
  completedAt: timestamp("completed_at"),
});

export const userPredictions = pgTable("user_predictions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  poolId: text("pool_id").notNull().references(() => predictionPools.id),
  prediction: text("prediction").notNull(),
  pointsEarned: integer("points_earned"),
  isWinner: boolean("is_winner"),
  createdAt: timestamp("created_at"),
});

// Polls system tables (aligned with prediction_pools pattern)
export const polls = pgTable("polls", {
  id: serial("id").primaryKey(),
  question: text("question").notNull(),
  type: text("type").notNull(), // 'consumed', 'entertainlit', 'sponsored'
  sponsorName: text("sponsor_name"),
  sponsorLogoUrl: text("sponsor_logo_url"),
  sponsorCtaUrl: text("sponsor_cta_url"),
  status: text("status").notNull().default("draft"), // 'draft', 'active', 'archived'
  pointsReward: integer("points_reward").notNull().default(5),
  options: jsonb("options"), // Array of {id, label, description, imageUrl}
  expiresAt: timestamp("expires_at"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const pollResponses = pgTable("poll_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pollId: integer("poll_id").notNull().references(() => polls.id, { onDelete: "cascade" }),
  optionId: integer("option_id").notNull(), // Now just stores ID, no FK to poll_options
  userId: varchar("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userRecommendations = pgTable("user_recommendations", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  recommendations: jsonb("recommendations").notNull(),
  dataSourcesUsed: jsonb("data_sources_used"), // Track which data sources were available
  sourceModel: text("source_model").notNull().default("gpt-4o"), // AI model used
  status: text("status").notNull().default("ready"), // 'ready', 'generating', 'failed'
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  staleAfter: timestamp("stale_after").notNull(), // When to show "refreshing" badge
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const mediaRatings = pgTable("media_ratings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  mediaExternalId: text("media_external_id").notNull(),
  mediaExternalSource: text("media_external_source").notNull(), // 'tmdb', 'spotify', 'openlibrary', 'youtube'
  mediaTitle: text("media_title").notNull(),
  mediaType: text("media_type").notNull(), // 'movie', 'tv', 'book', 'podcast', 'music'
  rating: integer("rating").notNull(), // 1-5 stars
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
  likesCount: true,
  commentsCount: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSocialPostCommentSchema = createInsertSchema(socialPostComments).omit({
  id: true,
  likesCount: true,
  createdAt: true,
});

export const insertSocialCommentLikeSchema = createInsertSchema(socialCommentLikes).omit({
  id: true,
  createdAt: true,
});

export const insertPredictionPoolSchema = createInsertSchema(predictionPools).omit({
  id: true,
  createdAt: true,
});

export const insertPredictionResultSchema = createInsertSchema(predictionResults).omit({
  id: true,
  completedAt: true,
});

export const insertUserPredictionSchema = createInsertSchema(userPredictions).omit({
  id: true,
  createdAt: true,
});

export const insertPollSchema = createInsertSchema(polls).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPollResponseSchema = createInsertSchema(pollResponses).omit({
  id: true,
  createdAt: true,
});

export const insertUserRecommendationsSchema = createInsertSchema(userRecommendations).omit({
  id: true,
  generatedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMediaRatingSchema = createInsertSchema(mediaRatings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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
export type SocialCommentLike = typeof socialCommentLikes.$inferSelect;
export type InsertSocialCommentLike = z.infer<typeof insertSocialCommentLikeSchema>;
export type PredictionPool = typeof predictionPools.$inferSelect;
export type InsertPredictionPool = z.infer<typeof insertPredictionPoolSchema>;
export type PredictionResult = typeof predictionResults.$inferSelect;
export type InsertPredictionResult = z.infer<typeof insertPredictionResultSchema>;
export type UserPrediction = typeof userPredictions.$inferSelect;
export type InsertUserPrediction = z.infer<typeof insertUserPredictionSchema>;
export type Poll = typeof polls.$inferSelect;
export type InsertPoll = z.infer<typeof insertPollSchema>;
export type PollResponse = typeof pollResponses.$inferSelect;
export type InsertPollResponse = z.infer<typeof insertPollResponseSchema>;
export type UserRecommendations = typeof userRecommendations.$inferSelect;
export type InsertUserRecommendations = z.infer<typeof insertUserRecommendationsSchema>;
export type MediaRating = typeof mediaRatings.$inferSelect;
export type InsertMediaRating = z.infer<typeof insertMediaRatingSchema>;
