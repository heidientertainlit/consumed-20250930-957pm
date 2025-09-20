import { type User, type InsertUser, type ConsumptionLog, type InsertConsumptionLog } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPoints(id: string, points: number): Promise<User | undefined>;

  // Consumption operations
  getConsumptionLogs(userId: string): Promise<ConsumptionLog[]>;
  createConsumptionLog(log: InsertConsumptionLog): Promise<ConsumptionLog>;
  getUserConsumptionStats(userId: string): Promise<{
    totalLogged: number;
    pointsEarned: number;
    categoriesCount: { [key: string]: number };
  }>;
  getActivityFeed(): Promise<ConsumptionLog[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private consumptionLogs: Map<string, ConsumptionLog>;

  constructor() {
    this.users = new Map();
    this.consumptionLogs = new Map();
    this.initializeData();
  }

  private initializeData() {
    // Create a default user
    const defaultUser: User = {
      id: "user-1",
      username: "JohnDoe",
      email: "john@example.com",
      points: 1250,
      totalWinnings: 0,
      createdAt: new Date(),
    };
    this.users.set(defaultUser.id, defaultUser);

    // Add sample consumption logs
    const sampleLogs: ConsumptionLog[] = [
      {
        id: "log-1",
        userId: "user-1",
        title: "SmartLess",
        type: "episode",
        category: "podcasts",
        consumedAt: new Date(),
        createdAt: new Date(),
        rating: 5,
        review: "gotta listen.",
        pointsEarned: 10
      },
      {
        id: "log-2", 
        userId: "user-1",
        title: "The Bear",
        type: "season",
        category: "tv",
        consumedAt: new Date(Date.now() - 86400000),
        createdAt: new Date(Date.now() - 86400000),
        rating: 4,
        review: "Amazing character development and tension throughout the season.",
        pointsEarned: 15
      }
    ];

    sampleLogs.forEach(log => {
      this.consumptionLogs.set(log.id, log);
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      ...insertUser,
      id,
      points: 0,
      totalWinnings: 0,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUserPoints(id: string, points: number): Promise<User | undefined> {
    const user = this.users.get(id);
    if (user) {
      user.points = points;
      this.users.set(id, user);
      return user;
    }
    return undefined;
  }


  async getConsumptionLogs(userId: string): Promise<ConsumptionLog[]> {
    return Array.from(this.consumptionLogs.values())
      .filter(log => log.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createConsumptionLog(insertLog: InsertConsumptionLog): Promise<ConsumptionLog> {
    const id = randomUUID();
    const log: ConsumptionLog = {
      ...insertLog,
      id,
      pointsEarned: this.calculatePointsForLog(insertLog),
      createdAt: new Date(),
      consumedAt: insertLog.consumedAt || new Date(),
    };

    this.consumptionLogs.set(id, log);

    // Award points to user
    const user = this.users.get(insertLog.userId);
    if (user) {
      user.points += log.pointsEarned;
      this.users.set(insertLog.userId, user);
    }

    return log;
  }

  private calculatePointsForLog(log: InsertConsumptionLog): number {
    let basePoints = 10;
    
    // Bonus points for reviews
    if (log.review && log.review.length > 50) {
      basePoints += 5;
    }
    
    // Bonus points for ratings
    if (log.rating) {
      basePoints += 3;
    }

    return basePoints;
  }

  async getUserConsumptionStats(userId: string): Promise<{
    totalLogged: number;
    pointsEarned: number;
    categoriesCount: { [key: string]: number };
  }> {
    const userLogs = Array.from(this.consumptionLogs.values())
      .filter(log => log.userId === userId);

    const totalLogged = userLogs.length;
    const pointsEarned = userLogs.reduce((sum, log) => sum + log.pointsEarned, 0);
    
    const categoriesCount: { [key: string]: number } = {};
    userLogs.forEach(log => {
      categoriesCount[log.category] = (categoriesCount[log.category] || 0) + 1;
    });

    return {
      totalLogged,
      pointsEarned,
      categoriesCount,
    };
  }

  async getActivityFeed(): Promise<ConsumptionLog[]> {
    return Array.from(this.consumptionLogs.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 50); // Return last 50 activities
  }

}

export const storage = new MemStorage();
