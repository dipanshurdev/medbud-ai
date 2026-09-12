"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

async function getOrCreateFamilyMember(supabase: any, userId: string, userName?: string) {
  const { data: familyMember } = await supabase
    .from("FamilyMember")
    .select("*")
    .eq("userId", userId)
    .maybeSingle();

  if (familyMember) return familyMember;

  // Auto-create Family & FamilyMember
  const { data: family } = await supabase
    .from("Family")
    .insert({ name: `${userName || "My"}'s Family` })
    .select("id")
    .single();

  if (!family) throw new Error("Could not create family");

  const { data: newMember } = await supabase
    .from("FamilyMember")
    .insert({ userId, familyId: family.id, role: "owner" })
    .select("*")
    .single();

  return newMember;
}

export async function getProfile() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const familyMember = await getOrCreateFamilyMember(supabase, user.id, user.user_metadata?.name);

    if (!familyMember) return null;

    return {
      name: user.user_metadata?.name || "Patient Profile",
      age: familyMember.age || "",
      weight: familyMember.weight || "",
      allergies: familyMember.allergies || "",
      conditions: familyMember.conditions || "",
      currentMeds: familyMember.currentMeds || "",
    };
  } catch (err: any) {
    console.error("getProfile exception:", err);
    return null;
  }
}

export async function updateProfile(data: any) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const familyMember = await getOrCreateFamilyMember(supabase, user.id, user.user_metadata?.name);

    if (!familyMember) return { error: "No family member record found" };

    const { error } = await supabase
      .from("FamilyMember")
      .update({
        age: String(data.age || ""),
        weight: String(data.weight || ""),
        allergies: String(data.allergies || ""),
        conditions: String(data.conditions || ""),
        currentMeds: String(data.currentMeds || ""),
      })
      .eq("id", familyMember.id);

    if (error) return { error: error.message };

    if (data.name && data.name !== user.user_metadata?.name) {
      await supabase.auth.updateUser({
        data: { name: data.name }
      });
    }

    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to update profile" };
  }
}
