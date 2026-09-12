"use server";

import { createClient } from "@/utils/supabase/server";

export async function saveConsultation(data: any) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const safeGuidance = Array.isArray(data.safeGuidance) ? data.safeGuidance.map(String) : [];
    const avoid = Array.isArray(data.avoid) ? data.avoid.map(String) : [];
    const redFlags = Array.isArray(data.redFlags) ? data.redFlags.map(String) : [];

    const { data: consultation, error } = await supabase
      .from("Consultation")
      .insert({
        userId: user.id,
        symptoms: String(data.symptoms || "N/A"),
        triage: String(data.triage || "self-care"),
        riskLevel: String(data.riskLevel || "low"),
        summary: String(data.summary || ""),
        safeGuidance,
        avoid,
        redFlags,
      })
      .select()
      .single();

    if (error) {
      console.error("saveConsultation error:", error);
      return null;
    }

    return consultation;
  } catch (err) {
    console.error("saveConsultation exception:", err);
    return null;
  }
}
