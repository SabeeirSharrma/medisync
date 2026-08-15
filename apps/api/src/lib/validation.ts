import { z } from "zod/v4";

export const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["patient", "doctor", "admin"]),
  dob: z.string().optional(),
  phone: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

export const createRecordSchema = z.object({
  type: z.enum([
    "prescription",
    "lab_result",
    "checkup",
    "surgery",
    "imaging",
    "other",
  ]),
  date: z.string().min(1, "Date is required"),
  doctorName: z.string().optional(),
  hospitalName: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});
