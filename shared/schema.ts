// Pure TypeScript types for Supabase (no Drizzle)
import { z } from "zod";

// User types
export interface User {
  id: string;
  username: string;
  email: string;
  points: number;
  totalWinnings: number;
  createdAt: string;
}

export const insertUserSchema = z.object({
  username: z.string().min(1),
  email: z.string().email(),
  points: z.number().default(0),
  totalWinnings: z.number().default(0),
});

export type InsertUser = z.infer<typeof insertUserSchema>;

// Consumption Log types
export interface ConsumptionLog {
  id: string;
  userId: string;
  title: string;
  category: string; // movies, tv, books, music, games
  type: string; // movie, episode, book, album, game
  rating?: number; // 1-5 stars
  review?: string;
  pointsEarned: number;
  consumedAt: string;
  createdAt: string;
}

export const insertConsumptionLogSchema = z.object({
  userId: z.string(),
  title: z.string().min(1),
  category: z.string(),
  type: z.string(),
  rating: z.number().min(1).max(5).optional(),
  review: z.string().optional(),
  consumedAt: z.string().optional(),
});

export type InsertConsumptionLog = z.infer<typeof insertConsumptionLogSchema>;

// DNA Profile types
export interface DnaProfile {
  id: string;
  userId: string;
  profileText: string;
  favoriteGenres?: string[];
  favoriteMediaTypes?: string[];
  favoriteSports?: string[];
  mediaConsumptionStats?: string;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
}

export const insertDnaProfileSchema = z.object({
  userId: z.string(),
  profileText: z.string(),
  favoriteGenres: z.array(z.string()).optional(),
  favoriteMediaTypes: z.array(z.string()).optional(),
  favoriteSports: z.array(z.string()).optional(),
  mediaConsumptionStats: z.string().optional(),
  isPrivate: z.boolean().default(false),
});

export type InsertDnaProfile = z.infer<typeof insertDnaProfileSchema>;

// EDNA Response types
export interface EdnaResponse {
  id: string;
  userId: string;
  questionId: string;
  answer: string;
  createdAt: string;
}

export const insertEdnaResponseSchema = z.object({
  userId: z.string(),
  questionId: z.string(),
  answer: z.string(),
});

export type InsertEdnaResponse = z.infer<typeof insertEdnaResponseSchema>;

// List types for sharing functionality
export interface List {
  id: string;
  userId: string;
  title: string;
  description?: string;
  visibility: 'public' | 'private';
  isDefault: boolean;
  isPinned: boolean;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ListItem {
  id: string;
  listId: string;
  userId: string;
  title: string;
  description?: string;
  externalId?: string;
  externalSource?: string;
  mediaType?: string;
  imageUrl?: string;
  rating?: number;
  createdAt: string;
  updatedAt: string;
}

export const insertListSchema = z.object({
  userId: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  visibility: z.enum(['public', 'private']).default('private'),
  isDefault: z.boolean().default(false),
  isPinned: z.boolean().default(false),
  isPrivate: z.boolean().default(true),
});

export const insertListItemSchema = z.object({
  listId: z.string(),
  userId: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  externalId: z.string().optional(),
  externalSource: z.string().optional(),
  mediaType: z.string().optional(),
  imageUrl: z.string().optional(),
  rating: z.number().min(1).max(5).optional(),
});

export type InsertList = z.infer<typeof insertListSchema>;
export type InsertListItem = z.infer<typeof insertListItemSchema>;