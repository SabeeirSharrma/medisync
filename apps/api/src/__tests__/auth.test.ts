import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

// Mock database
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([]),
  delete: vi.fn().mockReturnThis(),
};

vi.mock("../db/index.js", () => ({
  db: mockDb,
}));

vi.mock("../db/schema.js", () => ({
  users: {},
  sessions: {},
  doctorProfile: {},
}));

vi.mock("../lib/auth.js", () => ({
  hashToken: vi.fn((token: string) => `hashed_${token}`),
  generateToken: vi.fn(() => "test-token-123"),
  hashPassword: vi.fn(async (password: string) => `hashed_${password}`),
  verifyPassword: vi.fn(async (hash: string, password: string) => hash === `hashed_${password}`),
}));

vi.mock("../lib/audit.js", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/s3.js", () => ({
  uploadFile: vi.fn().mockResolvedValue(undefined),
  getPresignedUrl: vi.fn().mockResolvedValue("https://example.com/file"),
  deleteFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../config.js", () => ({
  config: {
    databaseUrl: "postgresql://test:test@localhost:5432/test",
    sessionSecret: "test-secret",
    cookieSecure: false,
    corsOrigin: "http://localhost:3000",
    port: 3001,
    nodeEnv: "test",
    s3Endpoint: "http://localhost:9000",
    s3AccessKey: "test",
    s3SecretKey: "test",
    s3Bucket: "test",
    s3Region: "us-east-1",
    openaiApiKey: undefined,
    openaiModel: "gpt-4o-mini",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col: unknown, val: unknown) => ({ col, val, type: "eq" })),
  and: vi.fn((...conditions: unknown[]) => ({ conditions, type: "and" })),
  or: vi.fn((...conditions: unknown[]) => ({ conditions, type: "or" })),
  gt: vi.fn((col: unknown, val: unknown) => ({ col, val, type: "gt" })),
  count: vi.fn(() => ({ type: "count" })),
  desc: vi.fn((col: unknown) => ({ col, type: "desc" })),
  inArray: vi.fn((col: unknown, values: unknown[]) => ({ col, values, type: "inArray" })),
  gte: vi.fn((col: unknown, val: unknown) => ({ col, val, type: "gte" })),
  lte: vi.fn((col: unknown, val: unknown) => ({ col, val, type: "lte" })),
}));

// Import after mocks
import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import request from "supertest";
import authRoutes from "../routes/auth.js";

describe("Auth Routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(cookie);
    await app.register(cors, { origin: "http://localhost:3000", credentials: true });
    await app.register(sensible);
    await app.register(authRoutes, { prefix: "/api/auth" });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/auth/register", () => {
    it("should register a new user successfully", async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: "user-123",
              name: "John Doe",
              email: "john@example.com",
              role: "patient",
              dob: null,
            },
          ]),
        }),
      });

      const response = await request(app.server)
        .post("/api/auth/register")
        .send({
          name: "John Doe",
          email: "john@example.com",
          password: "password123",
          role: "patient",
        });

      expect(response.status).toBe(201);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe("john@example.com");
      expect(response.body.user.name).toBe("John Doe");
      expect(response.headers["set-cookie"]).toBeDefined();
    });

    it("should return 400 for invalid email", async () => {
      const response = await request(app.server)
        .post("/api/auth/register")
        .send({
          name: "John Doe",
          email: "invalid-email",
          password: "password123",
          role: "patient",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("should return 400 for short password", async () => {
      const response = await request(app.server)
        .post("/api/auth/register")
        .send({
          name: "John Doe",
          email: "john@example.com",
          password: "123",
          role: "patient",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it("should return 400 for missing required fields", async () => {
      const response = await request(app.server)
        .post("/api/auth/register")
        .send({
          email: "john@example.com",
        });

      expect(response.status).toBe(400);
    });

    it("should return 409 if email already exists", async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: "existing-user" }]),
          }),
        }),
      });

      const response = await request(app.server)
        .post("/api/auth/register")
        .send({
          name: "John Doe",
          email: "existing@example.com",
          password: "password123",
          role: "patient",
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe("Email already registered");
    });
  });

  describe("POST /api/auth/login", () => {
    it("should login successfully with valid credentials", async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "user-123",
                name: "John Doe",
                email: "john@example.com",
                passwordHash: "hashed_password123",
                role: "patient",
                dob: null,
              },
            ]),
          }),
        }),
      });

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      const response = await request(app.server)
        .post("/api/auth/login")
        .send({
          email: "john@example.com",
          password: "password123",
        });

      expect(response.status).toBe(200);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe("john@example.com");
      expect(response.headers["set-cookie"]).toBeDefined();
    });

    it("should return 401 for invalid email", async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const response = await request(app.server)
        .post("/api/auth/login")
        .send({
          email: "nonexistent@example.com",
          password: "password123",
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Invalid email or password");
    });

    it("should return 401 for invalid password", async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "user-123",
                name: "John Doe",
                email: "john@example.com",
                passwordHash: "hashed_different_password",
                role: "patient",
                dob: null,
              },
            ]),
          }),
        }),
      });

      const response = await request(app.server)
        .post("/api/auth/login")
        .send({
          email: "john@example.com",
          password: "wrongpassword",
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Invalid email or password");
    });

    it("should return 400 for missing email", async () => {
      const response = await request(app.server)
        .post("/api/auth/login")
        .send({
          password: "password123",
        });

      expect(response.status).toBe(400);
    });

    it("should return 400 for missing password", async () => {
      const response = await request(app.server)
        .post("/api/auth/login")
        .send({
          email: "john@example.com",
        });

      expect(response.status).toBe(400);
    });
  });

  describe("POST /api/auth/logout", () => {
    it("should logout successfully with valid session", async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              { id: "session-123", userId: "user-123", tokenHash: "hashed_test-token-123" },
            ]),
          }),
        }),
      });

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              { id: "user-123", name: "John Doe", email: "john@example.com", role: "patient" },
            ]),
          }),
        }),
      });

      mockDb.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const response = await request(app.server)
        .post("/api/auth/logout")
        .set("Cookie", "session=test-token-123");

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Logged out");
    });

    it("should return 401 without session cookie", async () => {
      const response = await request(app.server).post("/api/auth/logout");

      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/auth/me", () => {
    it("should return user data with valid session", async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              { id: "session-123", userId: "user-123", tokenHash: "hashed_test-token-123" },
            ]),
          }),
        }),
      });

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              { id: "user-123", name: "John Doe", email: "john@example.com", role: "patient", dob: null },
            ]),
          }),
        }),
      });

      const response = await request(app.server)
        .get("/api/auth/me")
        .set("Cookie", "session=test-token-123");

      expect(response.status).toBe(200);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe("john@example.com");
    });

    it("should return 401 without session cookie", async () => {
      const response = await request(app.server).get("/api/auth/me");

      expect(response.status).toBe(401);
    });
  });
});
