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

  // Survey questions
  getAllQuestions(): Promise<any[]>;
  
  // Polls operations
  getActivePolls(): Promise<any[]>;
  getPollWithResults(pollId: number): Promise<any>;
  getUserPollResponse(pollId: number, userId: string): Promise<any>;
  createPollResponse(response: { pollId: number; optionId: number; userId: string }): Promise<void>;
  createPoll(poll: any, options: any[]): Promise<number>;
  updatePollStatus(pollId: number, status: string): Promise<void>;
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

  async getAllQuestions(): Promise<any[]> {
    // Survey questions in the exact order specified by the user
    return [
      {
        id: "ece7a2a9-9ba0-4446-8d3e-a51debd36ce7",
        question_text: "How likely are you to discuss what you're watching, reading, or listening to?",
        question_type: "select",
        options: ["Very likely—I love sharing and discussing", "Somewhat likely—depends on the content", "Not very likely—I prefer to keep it private"]
      },
      {
        id: "1cae48c1-a5a2-40c3-b36f-87c4e3a827b8",
        question_text: "What sports do you like to follow?",
        question_type: "multi-select",
        options: ["NFL (Football)", "NCAA Football", "NBA (Basketball)", "NCAA Basketball", "MLB (Baseball)", "NHL (Hockey)", "Soccer/Football", "Tennis", "Golf", "Other"]
      },
      {
        id: "bcb1ea4f-1d93-4851-925a-bdfe3c6344f5",
        question_text: "What are your teams and favorite players?",
        question_type: "text",
        options: []
      },
      {
        id: "1c190ac9-41f9-418a-93d5-10643dbb9fba",
        question_text: "What drives your entertainment choices?",
        question_type: "multi-select",
        options: ["I want to feel something—laugh, cry, get excited", "I want to learn or be challenged intellectually", "I want to escape and be entertained", "I want to connect with others through shared experiences"]
      },
      {
        id: "140ddca4-4210-48db-93e9-9525819d5002",
        question_text: "What is your gender?",
        question_type: "select",
        options: ["Female", "Male", "Other"]
      },
      {
        id: "d353e652-66d6-45dc-9088-9ffcb067fb47",
        question_text: "Who and what do you love across entertainment?",
        question_type: "text",
        options: []
      },
      {
        id: "f7b837a4-cb42-4799-bc68-20cb111e5feb",
        question_text: "What are your favorite types of entertainment?",
        question_type: "multi-select",
        options: ["Movies", "TV Shows", "Books", "Sports", "Music", "Podcasts", "Video Games", "Live Events"]
      },
      {
        id: "67394a52-6ef8-40d0-b019-121d5f9f22d9",
        question_text: "How do you discover new content?",
        question_type: "multi-select",
        options: ["Personal recommendations from friends and family", "Social media posts and discussions", "Streaming platform recommendations", "Professional reviews and ratings", "Random browsing and exploration"]
      },
      {
        id: "e4609aa7-797a-4f02-b60e-216f0241a99a",
        question_text: "Which genres do you like best?",
        question_type: "multi-select",
        options: ["Action", "Animation", "Comedy", "Crime", "Documentary", "Drama", "Fantasy", "Horror", "Mystery", "Romance", "Sci-Fi", "Thriller"]
      },
      {
        id: "71049fe4-3945-4213-a136-43d9ec6eb582",
        question_text: "What's your go-to comfort entertainment?",
        question_type: "text",
        options: []
      },
      {
        id: "6e3289cb-b1eb-42ea-a134-a5f7997df9ca",
        question_text: "Do you participate in any fantasy sports leagues?",
        question_type: "select",
        options: ["Yes", "No", "Sometimes"]
      }
    ];
  }

  // Polls operations - Using database directly
  async getActivePolls(): Promise<any[]> {
    // This will be implemented with database connection
    throw new Error("Use database polls API instead");
  }

  async getPollWithResults(pollId: number): Promise<any> {
    throw new Error("Use database polls API instead");
  }

  async getUserPollResponse(pollId: number, userId: string): Promise<any> {
    throw new Error("Use database polls API instead");
  }

  async createPollResponse(response: { pollId: number; optionId: number; userId: string }): Promise<void> {
    throw new Error("Use database polls API instead");
  }

  async createPoll(poll: any, options: any[]): Promise<number> {
    throw new Error("Use database polls API instead");
  }

  async updatePollStatus(pollId: number, status: string): Promise<void> {
    throw new Error("Use database polls API instead");
  }

}

export const storage = new MemStorage();
