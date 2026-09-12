import * as z from "zod";

export const scanMedicineSchema = z.object({
  image: z.string().optional(),
  notes: z.string().optional()
}).refine(data => data.image || data.notes, {
  message: "Either image or notes must be provided",
  path: ["image"]
});

export const consultSchema = z.object({
  message: z.string().min(1, "Symptom description is required"),
  profile: z.object({
    name: z.string().optional(),
    age: z.string().optional(),
    weight: z.string().optional(),
    allergies: z.string().optional(),
    conditions: z.string().optional(),
    currentMeds: z.string().optional(),
  }),
  inventory: z.array(z.any()), // Can be typed more strictly with a medicine schema
  language: z.string().optional().default("Hinglish")
});
