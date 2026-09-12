export type Tone = "ok" | "warn" | "danger";

export type Medicine = {
  id: string;
  name: string;
  activeIngredient?: string;
  strength?: string;
  form?: string;
  manufacturer?: string;
  expiry?: string;
  batch?: string;
  quantity?: number;
  schedule?: string;
  confidence?: number;
  storage?: string;
  cautions?: string[];
  redFlags?: string[];
};

export type Profile = {
  name: string;
  age: string;
  weight: string;
  allergies: string;
  conditions: string;
  currentMeds: string;
};

export type ConsultResult = {
  disclaimer: string;
  triage: "self-care" | "doctor" | "urgent";
  riskLevel: "low" | "medium" | "high";
  followUpQuestions: string[];
  inventoryMatches: { name: string; status: string; reason: string }[];
  safeGuidance: string[];
  avoid: string[];
  redFlags: string[];
  restockSuggestions: string[];
  summary: string;
};

export type AuditItem = {
  id: string;
  kind: string;
  title: string;
  time: string;
};
