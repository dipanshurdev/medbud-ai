"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

async function getOrCreateFamilyId(supabase: any, userId: string, userName?: string) {
  const { data: familyMember } = await supabase
    .from("FamilyMember")
    .select("familyId")
    .eq("userId", userId)
    .maybeSingle();

  if (familyMember?.familyId) return familyMember.familyId;

  // Auto-create Family and FamilyMember if not existing
  const { data: family, error: famErr } = await supabase
    .from("Family")
    .insert({ name: `${userName || "My"}'s Family` })
    .select("id")
    .single();

  if (famErr || !family) {
    throw new Error("Could not create family workspace");
  }

  await supabase
    .from("FamilyMember")
    .insert({ userId, familyId: family.id, role: "owner" });

  return family.id;
}

function sanitizeMedicineData(data: any, familyId: string) {
  return {
    familyId,
    name: String(data.name || "Unknown Medicine").trim(),
    activeIngredient: data.activeIngredient ? String(data.activeIngredient) : "Unknown",
    strength: data.strength ? String(data.strength) : "N/A",
    form: data.form ? String(data.form) : "Tablet/Capsule",
    manufacturer: data.manufacturer ? String(data.manufacturer) : "General",
    expiry: data.expiry ? String(data.expiry) : "unknown",
    batch: data.batch ? String(data.batch) : "N/A",
    quantity: typeof data.quantity === "number" ? Math.max(1, data.quantity) : 1,
    schedule: data.schedule ? String(data.schedule) : "OTC",
    confidence: typeof data.confidence === "number" ? data.confidence : 80,
    storage: data.storage ? String(data.storage) : "Room temperature",
    cautions: Array.isArray(data.cautions) ? data.cautions.map(String) : [],
  };
}

export async function getInventory() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const familyId = await getOrCreateFamilyId(supabase, user.id, user.user_metadata?.name);

    const { data: inventory, error } = await supabase
      .from("Medicine")
      .select("*")
      .eq("familyId", familyId)
      .order("createdAt", { ascending: false });

    if (error) {
      console.error("getInventory Supabase error:", error);
      return [];
    }

    return inventory || [];
  } catch (err: any) {
    console.error("getInventory exception:", err);
    return [];
  }
}

export async function addMedicine(raw: any) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const familyId = await getOrCreateFamilyId(supabase, user.id, user.user_metadata?.name);
    const cleanData = sanitizeMedicineData(raw, familyId);

    const { data: medicine, error } = await supabase
      .from("Medicine")
      .insert(cleanData)
      .select()
      .single();

    if (error) {
      console.error("addMedicine Supabase error:", error);
      return { error: error.message || "Failed to save medicine to Supabase" };
    }

    revalidatePath("/");
    return medicine;
  } catch (err: any) {
    console.error("addMedicine exception:", err);
    return { error: err.message || "Failed to add medicine" };
  }
}

export async function updateMedicineQuantity(id: string, delta: number) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { data: current } = await supabase
      .from("Medicine")
      .select("quantity")
      .eq("id", id)
      .single();

    if (!current) return { error: "Medicine not found" };

    const newQty = Math.max(0, (current.quantity || 0) + delta);

    if (newQty === 0) {
      await supabase.from("Medicine").delete().eq("id", id);
    } else {
      await supabase.from("Medicine").update({ quantity: newQty }).eq("id", id);
    }

    revalidatePath("/");
    return { success: true, newQty };
  } catch (err: any) {
    return { error: err.message || "Failed to update quantity" };
  }
}

export async function removeMedicine(id: string) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { error } = await supabase
      .from("Medicine")
      .delete()
      .eq("id", id);

    if (error) return { error: error.message };

    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to remove medicine" };
  }
}
