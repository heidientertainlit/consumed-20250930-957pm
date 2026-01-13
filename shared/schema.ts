import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, integer, timestamp, boolean, jsonb, serial, real, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("user_name").notNull().unique(),
  email: text("email").notNull().unique(),
  points: integer("points").notNull().default(0),
  totalWinnings: integer("total_winnings").notNull().default(0),
  referredBy: varchar("referred_by"),
  referralRewarded: boolean("referral_rewarded").default(false),
  isPersona: boolean("is_persona").default(false),
  personaConfig: jsonb("persona_config"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User sessions for tracking time spent and engagement
export const userSessions = pgTable("user_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sessionId: text("session_id").notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  lastHeartbeat: timestamp("last_heartbeat"),
  clientMetadata: jsonb("client_metadata"),
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
  listId: varchar("list_id"),
  rankId: text("rank_id"), // For rank_share posts
  content: text("content"),
  postType: text("post_type").default("update"), // 'update', 'prediction', 'poll', 'hot_take', 'rate_review', 'rank_share'
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
  containsSpoilers: boolean("contains_spoilers").default(false),
  likesCount: integer("likes_count").default(0),
  commentsCount: integer("comments_count").default(0),
  predictionPoolId: text("prediction_pool_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const socialPostComments = pgTable("social_post_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => socialPosts.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  likesCount: integer("likes_count").notNull().default(0),
  parentCommentId: varchar("parent_comment_id").references((): any => socialPostComments.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Comment likes table (many-to-many relationship)
export const socialCommentLikes = pgTable("social_comment_likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  commentId: varchar("comment_id").notNull().references(() => socialPostComments.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Existing prediction system tables (align with production)
export const predictionPools = pgTable("prediction_pools", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull(), // "vote", "weekly", "awards", "bracket", "trivia", "predict"
  pointsReward: integer("points_reward").notNull(),
  deadline: text("deadline"), // Optional - null for open-ended predictions
  status: text("status").notNull().default('open'), // "open", "locked", "completed"
  category: text("category").notNull(),
  icon: text("icon"),
  featuredDate: text("featured_date"), // Date when this is the Daily Challenge (YYYY-MM-DD)
  publishAt: text("publish_at"), // When to make available (ISO timestamp)
  options: jsonb("options"), // Array of options
  correctAnswer: text("correct_answer"), // For trivia: stores the correct answer
  inline: boolean("inline"),
  participants: integer("participants").default(0),
  sponsorName: text("sponsor_name"), // Sponsor branding
  sponsorLogoUrl: text("sponsor_logo_url"), // Sponsor logo URL
  sponsorCtaUrl: text("sponsor_cta_url"), // Sponsor call-to-action URL
  likesCount: integer("likes_count").default(0),
  commentsCount: integer("comments_count").default(0),
  originType: text("origin_type"), // 'consumed' or 'user' - who created it
  originUserId: varchar("origin_user_id"), // user ID if user-created
  invitedUserId: varchar("invited_user_id"), // Invited friend for collaborative predictions
  mediaExternalId: text("media_external_id"), // Link to specific media
  mediaExternalSource: varchar("media_external_source"), // Media source (tmdb, spotify, etc)
  resolvedAt: timestamp("resolved_at"), // when prediction was resolved
  resolvedBy: text("resolved_by"), // 'creator', 'crowd', or 'system'
  tags: text("tags").array(), // Genre/topic tags like "True Crime", "Comedy", "Documentary"
  rotationType: text("rotation_type"), // 'evergreen', 'trending', 'seasonal'
  difficulty: text("difficulty"), // 'easy', 'medium', 'chaotic' (for trivia)
  socialPrompt: text("social_prompt"), // Shown after vote/answer, e.g. "Tag the friend who'd argue this"
  publishAt: timestamp("publish_at"), // When the item should go live (null = immediately)
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

// Prediction likes table
export const predictionLikes = pgTable("prediction_likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  poolId: text("pool_id").notNull().references(() => predictionPools.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Prediction comments table
export const predictionComments = pgTable("prediction_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  poolId: text("pool_id").notNull().references(() => predictionPools.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  likesCount: integer("likes_count").notNull().default(0),
  parentCommentId: varchar("parent_comment_id").references((): any => predictionComments.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Prediction comment likes table
export const predictionCommentLikes = pgTable("prediction_comment_likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  commentId: varchar("comment_id").notNull().references(() => predictionComments.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Bets table - for betting on friends' reactions to media
export const bets = pgTable("bets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  targetUserId: varchar("target_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  postId: varchar("post_id").notNull().references(() => socialPosts.id, { onDelete: "cascade" }),
  mediaTitle: text("media_title").notNull(),
  mediaType: text("media_type"),
  externalId: text("external_id"),
  externalSource: text("external_source"),
  prediction: text("prediction").notNull(), // 'will_like' or 'will_dislike'
  status: text("status").notNull().default("pending"), // 'pending', 'won', 'lost'
  pointsWon: integer("points_won"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
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

export const followedCreators = pgTable("followed_creators", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  creatorName: text("creator_name").notNull(),
  creatorRole: text("creator_role").notNull(), // 'Director', 'Actor', 'Musician', 'Author', 'Writer', 'Producer'
  creatorImage: text("creator_image"),
  externalId: text("external_id").notNull(),
  externalSource: text("external_source").notNull(), // 'tmdb', 'spotify', 'googlebooks'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Ranks table - for ranked lists like "Top 10 90s Movies"
export const ranks = pgTable("ranks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  visibility: text("visibility").default("public"), // 'public', 'private', 'friends'
  isCollaborative: boolean("is_collaborative").default(false),
  maxItems: integer("max_items").default(10), // Default to Top 10
  category: text("category"), // 'movies', 'tv', 'books', 'music', 'mixed'
  coverImageUrl: text("cover_image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Rank items - media items within a rank with position for ordering
export const rankItems = pgTable("rank_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  rankId: uuid("rank_id").notNull().references(() => ranks.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  position: integer("position").notNull(), // 1-based position for ordering
  title: text("title").notNull(),
  mediaType: text("media_type"), // 'movie', 'tv', 'book', 'music', 'podcast', 'game'
  creator: text("creator"), // Director, author, artist
  imageUrl: text("image_url"),
  externalId: text("external_id"),
  externalSource: text("external_source"), // 'tmdb', 'spotify', 'openlibrary', 'youtube'
  notes: text("notes"), // Personal notes about why it's ranked here
  upVoteCount: integer("up_vote_count").default(0), // Cached count of up votes
  downVoteCount: integer("down_vote_count").default(0), // Cached count of down votes
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Rank item votes - for community voting on rank item positions
// Note: unique constraint on (rank_item_id, user_id) should be added in Supabase
export const rankItemVotes = pgTable("rank_item_votes", {
  id: uuid("id").primaryKey().defaultRandom(),
  rankItemId: uuid("rank_item_id").notNull().references(() => rankItems.id, { onDelete: "cascade" }),
  voterId: varchar("voter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  direction: text("direction").notNull(), // 'up' or 'down'
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

export const insertBetSchema = createInsertSchema(bets).omit({
  id: true,
  createdAt: true,
  resolvedAt: true,
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

export const insertFollowedCreatorSchema = createInsertSchema(followedCreators).omit({
  id: true,
  createdAt: true,
});

export const insertRankSchema = createInsertSchema(ranks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRankItemSchema = createInsertSchema(rankItems).omit({
  id: true,
  upVoteCount: true,
  downVoteCount: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRankItemVoteSchema = createInsertSchema(rankItemVotes).omit({
  id: true,
  createdAt: true,
});

// Conversation topics (media or curated themes)
export const conversationTopics = pgTable("conversation_topics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: varchar("type").notNull(), // 'media' or 'theme'
  slug: text("slug").notNull().unique(), // 'selling-sunset', 'reality-tv-drama'
  displayName: text("display_name").notNull(), // 'Selling Sunset', 'Reality TV Drama'
  posterUrl: text("poster_url"), // For media topics
  icon: text("icon"), // For theme topics (emoji)
  metadata: jsonb("metadata"), // Media type, external IDs, etc.
  isCurated: boolean("is_curated").notNull().default(false), // Pre-seeded themes vs auto-created
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Conversations (threads about topics)
export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  topicId: varchar("topic_id").notNull().references(() => conversationTopics.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  containsSpoilers: boolean("contains_spoilers").notNull().default(false),
  // Activity metrics for trending/hot/active filters
  replyCount: integer("reply_count").notNull().default(0),
  participantsCount: integer("participants_count").notNull().default(1),
  lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertConversationTopicSchema = createInsertSchema(conversationTopics).omit({
  id: true,
  createdAt: true,
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  replyCount: true,
  participantsCount: true,
  lastActivityAt: true,
  createdAt: true,
});

// Did Not Finish reasons - tracks why users didn't finish media
export const dnfReasons = pgTable("dnf_reasons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  listItemId: integer("list_item_id"), // References list_items.id
  mediaExternalId: text("media_external_id"),
  mediaExternalSource: text("media_external_source"),
  mediaTitle: text("media_title"),
  mediaType: text("media_type"),
  reason: text("reason").notNull(), // 'got_bored', 'didnt_love_it', 'too_long', 'confusing', 'lost_interest', 'not_my_taste', 'other'
  otherReason: text("other_reason"), // Free text if reason is 'other'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDnfReasonSchema = createInsertSchema(dnfReasons).omit({
  id: true,
  createdAt: true,
});

// Scheduled Persona Posts - staging table for pre-generated bot content
// This table is completely isolated from social_posts until content is published
export const scheduledPersonaPosts = pgTable("scheduled_persona_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  personaUserId: varchar("persona_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  postType: text("post_type").notNull().default("update"), // 'update', 'rate_review', 'hot_take'
  content: text("content").notNull(),
  rating: real("rating"),
  mediaTitle: text("media_title"),
  mediaType: text("media_type"),
  mediaCreator: text("media_creator"),
  imageUrl: text("image_url"),
  mediaExternalId: text("media_external_id"),
  mediaExternalSource: text("media_external_source"),
  mediaDescription: text("media_description"),
  containsSpoilers: boolean("contains_spoilers").default(false),
  scheduledFor: timestamp("scheduled_for").notNull(),
  posted: boolean("posted").notNull().default(false),
  postedAt: timestamp("posted_at"),
  resultingPostId: varchar("resulting_post_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertScheduledPersonaPostSchema = createInsertSchema(scheduledPersonaPosts).omit({
  id: true,
  posted: true,
  postedAt: true,
  resultingPostId: true,
  createdAt: true,
});

// User notification settings and nudge tracking
export const userNotificationSettings = pgTable("user_notification_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  emailNotificationsEnabled: boolean("email_notifications_enabled").default(true),
  pushNotificationsEnabled: boolean("push_notifications_enabled").default(true),
  engagementNudgesEnabled: boolean("engagement_nudges_enabled").default(true),
  nudgesSentSinceActive: integer("nudges_sent_since_active").default(0),
  lastNudgeAt: timestamp("last_nudge_at"),
  lastActiveAt: timestamp("last_active_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserNotificationSettingsSchema = createInsertSchema(userNotificationSettings).omit({
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
export type UserRecommendations = typeof userRecommendations.$inferSelect;
export type InsertUserRecommendations = z.infer<typeof insertUserRecommendationsSchema>;
export type MediaRating = typeof mediaRatings.$inferSelect;
export type InsertMediaRating = z.infer<typeof insertMediaRatingSchema>;
export type FollowedCreator = typeof followedCreators.$inferSelect;
export type InsertFollowedCreator = z.infer<typeof insertFollowedCreatorSchema>;
export type Rank = typeof ranks.$inferSelect;
export type InsertRank = z.infer<typeof insertRankSchema>;
export type RankItem = typeof rankItems.$inferSelect;
export type InsertRankItem = z.infer<typeof insertRankItemSchema>;
export type RankItemVote = typeof rankItemVotes.$inferSelect;
export type InsertRankItemVote = z.infer<typeof insertRankItemVoteSchema>;
export type ConversationTopic = typeof conversationTopics.$inferSelect;
export type InsertConversationTopic = z.infer<typeof insertConversationTopicSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type DnfReason = typeof dnfReasons.$inferSelect;
export type InsertDnfReason = z.infer<typeof insertDnfReasonSchema>;
export type Bet = typeof bets.$inferSelect;
export type InsertBet = z.infer<typeof insertBetSchema>;
export type ScheduledPersonaPost = typeof scheduledPersonaPosts.$inferSelect;
export type InsertScheduledPersonaPost = z.infer<typeof insertScheduledPersonaPostSchema>;
