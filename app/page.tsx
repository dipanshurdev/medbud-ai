"use client";

export const dynamic = "force-dynamic";

import {
  Activity,
  AlertTriangle,
  Archive,
  Bot,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  Download,
  FileText,
  Filter,
  Gauge,
  HelpCircle,
  Info,
  Languages,
  Loader2,
  LogOut,
  Minus,
  Package,
  PackagePlus,
  Pill,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Stethoscope,
  Trash2,
  Upload,
  UserCheck,
  UserCheck2,
  Users,
  X
} from "lucide-react";
import React, { ChangeEvent, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { getInventory, addMedicine, updateMedicineQuantity, removeMedicine } from "@/app/actions/inventory";
import { getProfile, updateProfile } from "@/app/actions/profile";
import { saveConsultation } from "@/app/actions/consult";

import type { Tone, Medicine, Profile, ConsultResult, AuditItem } from "@/types";

function monthsUntil(expiry?: string) {
  if (!expiry || expiry === "unknown") return 99;
  const [year, month] = expiry.split("-").map(Number);
  if (!year || !month) return 99;
  const now = new Date();
  return (year - now.getFullYear()) * 12 + (month - 1 - now.getMonth());
}

function statusFor(expiry?: string, quantity?: number, schedule?: string): { label: string; tone: "ok" | "warn" | "danger" } {
  const months = monthsUntil(expiry);
  if (months < 0) return { label: "Expired", tone: "danger" };
  if (months <= 2) return { label: "Expiring soon", tone: "warn" };
  if ((quantity || 0) <= 3) return { label: "Low stock", tone: "warn" };
  if (schedule?.toLowerCase().includes("rx")) return { label: "Rx Caution", tone: "warn" };
  return { label: "Safe stock", tone: "ok" };
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function nowLabel() {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short"
  }).format(new Date());
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<"scan" | "inventory" | "consult" | "profile" | "audit">("scan");
  const [inventory, setInventory] = useState<Medicine[]>([]);
  const [profile, setProfile] = useState<Profile>({
    name: "",
    age: "",
    weight: "",
    allergies: "",
    conditions: "",
    currentMeds: ""
  });
  
  const [language, setLanguage] = useState<"English" | "Hinglish">("Hinglish");
  const [scanNotes, setScanNotes] = useState("");
  const [imageData, setImageData] = useState("");
  const [preview, setPreview] = useState("");
  const [lastScannedMed, setLastScannedMed] = useState<Medicine | null>(null);
  
  const [symptoms, setSymptoms] = useState("I have fever and mild headache since morning. What from my cabinet can I use safely?");
  const [consult, setConsult] = useState<ConsultResult | null>(null);
  
  const [scanBusy, setScanBusy] = useState(false);
  const [consultBusy, setConsultBusy] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [audit, setAudit] = useState<AuditItem[]>([]);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<"all" | "risky" | "expired" | "rx" | "low">("all");

  // Medical AI Safety Confirmation State
  const [disclaimerConfirmed, setDisclaimerConfirmed] = useState(false);
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(true);
  
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const supabase = createClient();
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    setAudit([{ id: "audit-1", kind: "system", title: "Workspace initialized", time: nowLabel() }]);
  }, []);

  // Auth Session Sync
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push("/login");
      } else {
        setSession(session);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push("/login");
      } else {
        setSession(session);
      }
    });

    return () => subscription.unsubscribe();
  }, [router, supabase.auth]);

  // Fetch initial Inventory and Profile from Supabase
  useEffect(() => {
    if (session) {
      startTransition(async () => {
        try {
          const inv = await getInventory();
          if (inv && 'error' in inv && inv.error === "Unauthorized") {
            await supabase.auth.signOut();
            router.push("/login");
            return;
          }
          if (Array.isArray(inv)) setInventory(inv as Medicine[]);
          
          const prof = await getProfile();
          if (prof && !('error' in prof) && prof !== null) {
            setProfile(prof as Profile);
          }
        } catch (err: any) {
          console.error("Failed to load initial data", err);
        }
      });
    }
  }, [session, router, supabase.auth]);

  const metrics = useMemo(() => {
    const total = inventory.length;
    const risky = inventory.filter((item) => statusFor(item.expiry, item.quantity, item.schedule).tone !== "ok").length;
    const rx = inventory.filter((item) => item.schedule?.toLowerCase().includes("rx")).length;
    const lowStock = inventory.filter((item) => (item.quantity || 0) <= 3).length;
    const expired = inventory.filter((item) => monthsUntil(item.expiry) < 0).length;
    return { total, risky, rx, lowStock, expired };
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      const matchSearch = searchQuery.trim() === "" ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.activeIngredient && item.activeIngredient.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchSearch) return false;

      if (filterCategory === "risky") return statusFor(item.expiry, item.quantity, item.schedule).tone !== "ok";
      if (filterCategory === "expired") return monthsUntil(item.expiry) < 0;
      if (filterCategory === "rx") return item.schedule?.toLowerCase().includes("rx");
      if (filterCategory === "low") return (item.quantity || 0) <= 3;

      return true;
    });
  }, [inventory, searchQuery, filterCategory]);

  async function handleImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setImageData(dataUrl);
      setPreview(dataUrl);
    } catch {
      setError("Could not read uploaded image file.");
    }
  }

  function pushAudit(kind: string, title: string) {
    setAudit((items) => [{ id: `audit-${Date.now()}`, kind, title, time: nowLabel() }, ...items].slice(0, 15));
  }

  async function scanMedicine() {
    setError("");
    setSuccessMsg("");
    setScanBusy(true);

    if (!scanNotes.trim() && !imageData) {
      setScanBusy(false);
      return setError("Please provide either an image of the medicine package or text notes for scanning.");
    }
    
    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageData, notes: scanNotes })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Scan failed");
      
      const newMedResult = await addMedicine({ ...data.medicine });
      
      if (newMedResult && 'error' in newMedResult) {
        throw new Error(newMedResult.error);
      }

      setInventory((items) => [newMedResult as Medicine, ...items]);
      setLastScannedMed(newMedResult as Medicine);
      setSuccessMsg(`Successfully identified and saved ${newMedResult.name} to cabinet!`);
      pushAudit("scan", `AI Scanned ${newMedResult.name}`);
      
      setScanNotes("");
      setImageData("");
      setPreview("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanBusy(false);
    }
  }

  async function addManual() {
    setError("");
    setSuccessMsg("");
    if (!scanNotes.trim()) {
      return setError("Please enter medicine details in the notes field (e.g., Paracetamol 500mg, Expiry 2026-12, 10 tablets).");
    }

    const parts = scanNotes.split(",").map((s) => s.trim());
    const medicinePayload = {
      name: parts[0] || "Manual Medicine",
      activeIngredient: parts[0] || "Unknown",
      strength: parts[1] || "Unknown strength",
      expiry: parts[2] || "unknown",
      quantity: Number(parts[3]?.replace(/\D/g, "")) || 1,
      schedule: "OTC",
      confidence: 100,
      cautions: ["Manual entry. Verify package label and active ingredient."]
    };
    
    startTransition(async () => {
      try {
        const newMedResult = await addMedicine(medicinePayload);
        if (newMedResult && 'error' in newMedResult) {
          throw new Error(newMedResult.error);
        }
        setInventory((items) => [newMedResult as Medicine, ...items]);
        setSuccessMsg(`Added ${medicinePayload.name} to cabinet`);
        pushAudit("manual", `Added ${medicinePayload.name}`);
        setScanNotes("");
      } catch (err: any) {
        setError(err.message || "Failed to add manual medicine");
      }
    });
  }

  async function handleQtyDelta(id: string, delta: number) {
    startTransition(async () => {
      const res = await updateMedicineQuantity(id, delta);
      if (res && 'error' in res) {
        setError(res.error);
      } else {
        setInventory((items) =>
          items
            .map((item) => item.id === id ? { ...item, quantity: Math.max(0, (item.quantity || 0) + delta) } : item)
            .filter((item) => (item.quantity || 0) > 0)
        );
      }
    });
  }

  async function handleDeleteMedicine(id: string, name: string) {
    if (!confirm(`Remove ${name} from your pharmacy cabinet?`)) return;
    startTransition(async () => {
      const res = await removeMedicine(id);
      if (res && 'error' in res) {
        setError(res.error);
      } else {
        setInventory((items) => items.filter((item) => item.id !== id));
        pushAudit("delete", `Removed ${name}`);
      }
    });
  }

  async function runConsult() {
    setError("");
    setConsultBusy(true);
    try {
      const response = await fetch("/api/consult", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: symptoms, profile, inventory, language })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Consultation failed");
      
      setConsult(data.result);
      saveConsultation({ ...data.result, symptoms });
      pushAudit("consult", `Triage result: ${data.result.triage.toUpperCase()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Consultation failed");
    } finally {
      setConsultBusy(false);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setProfileBusy(true);
    try {
      const res = await updateProfile(profile);
      if (res && 'error' in res) throw new Error(res.error);
      setSuccessMsg("Patient profile saved successfully.");
      pushAudit("profile", "Updated patient medical history");
    } catch (err: any) {
      setError(err.message || "Failed to update profile");
    } finally {
      setProfileBusy(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const summaryReportText = `MedBud AI Health & Pharmacy Safety Report

Generated: ${nowLabel()}

PATIENT MEDICAL PROFILE
Name: ${profile.name || "Default Patient"}
Age: ${profile.age || "Not specified"} | Weight: ${profile.weight || "Not specified"}
Allergies: ${profile.allergies || "None"}
Pre-existing Conditions: ${profile.conditions || "None"}
Current Daily Meds: ${profile.currentMeds || "None"}

REPORTED SYMPTOMS
${symptoms}

MEDICINE CABINET AUDIT (${inventory.length} items)
${inventory.map((item) => `- ${item.name} (${item.activeIngredient || "N/A"}) | ${item.strength || ""} | Expiry: ${item.expiry || "unknown"} | Qty: ${item.quantity || 0} | ${statusFor(item.expiry, item.quantity, item.schedule).label}`).join("\n")}

AI PHARMACIST TRIAGE RESULT
${consult ? `Triage Urgency: ${consult.triage.toUpperCase()} (Risk Level: ${consult.riskLevel.toUpperCase()})\nSummary: ${consult.summary}` : "No triage run yet."}

SAFE GUIDANCE
${consult ? consult.safeGuidance.map((item) => `- ${item}`).join("\n") : "N/A"}

PRECAUTIONS / DO NOT USE
${consult ? consult.avoid.map((item) => `- ${item}`).join("\n") : "N/A"}

RED FLAGS DETECTED
${consult ? consult.redFlags.map((item) => `- ${item}`).join("\n") : "None"}

MEDICAL DISCLAIMER:
MedBud AI is an AI SaaS utility tool to assist families with medicine cabinet intake, expiry tracking, and OTC triage guidance. It is NOT a medical diagnosis and does not prescribe prescription medications. Always consult a licensed medical professional for urgent or persistent symptoms.`;

  return (
    <div className="app-shell">
      {/* Mobile Top Header */}
      <header className="mobile-header">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <img src="/logo.svg" alt="MedBud AI Logo" className="brand-logo-img" />
          <span style={{ fontWeight: 700, fontSize: "16px" }}>MedBud AI</span>
        </div>
        <button className="btn btn-secondary btn-sm" style={{ color: "#ffffff", borderColor: "#333340" }} onClick={handleSignOut}>
          <LogOut size={14} />
        </button>
      </header>

      {/* Desktop Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/logo.svg" alt="MedBud AI Logo" className="brand-logo-img" />
          <div>
            <div className="brand-title">MedBud AI</div>
            <div className="brand-subtitle">Pharma & Health SaaS</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeTab === "scan" ? "active" : ""}`}
            onClick={() => setActiveTab("scan")}
          >
            <Camera size={18} />
            <span>AI Intake & OCR</span>
          </button>

          <button
            className={`nav-item ${activeTab === "inventory" ? "active" : ""}`}
            onClick={() => setActiveTab("inventory")}
          >
            <Package size={18} />
            <span>Smart Cabinet</span>
          </button>

          <button
            className={`nav-item ${activeTab === "consult" ? "active" : ""}`}
            onClick={() => setActiveTab("consult")}
          >
            <Bot size={18} />
            <span>AI Pharmacist Agent</span>
          </button>

          <button
            className={`nav-item ${activeTab === "profile" ? "active" : ""}`}
            onClick={() => setActiveTab("profile")}
          >
            <UserCheck size={18} />
            <span>Patient Profile</span>
          </button>

          <button
            className={`nav-item ${activeTab === "audit" ? "active" : ""}`}
            onClick={() => setActiveTab("audit")}
          >
            <FileText size={18} />
            <span>Audit & Reports</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="console-badge">
            <div className="status-dot"></div>
            <div>
              <div style={{ fontSize: "12px", fontWeight: 600 }}>Gemini 2.5 Flash</div>
              <div style={{ fontSize: "10px", color: varToString("--color-muted") }}>Cohere Enterprise System</div>
            </div>
          </div>

          <button
            className="nav-item"
            style={{ color: "#ff7759" }}
            onClick={handleSignOut}
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main App Content Area */}
      <main className="main-content">
        {/* Desktop Top Header Bar */}
        <header className="top-bar">
          <div className="page-title">
            <h1>
              {activeTab === "scan" && "AI Medicine Intake & Scanner"}
              {activeTab === "inventory" && "Smart Medicine Cabinet"}
              {activeTab === "consult" && "AI Pharmacist Safety Agent"}
              {activeTab === "profile" && "Patient Medical Profile"}
              {activeTab === "audit" && "Safety Reports & Audit Trail"}
            </h1>
            <p>
              {session?.user?.email ? `Connected Workspace: ${session.user.email}` : "Enterprise Healthcare SaaS"}
            </p>
          </div>

          <div className="top-bar-actions">
            {isPending && <Loader2 className="spin" size={16} color="var(--color-primary)" />}
            <button className="btn btn-secondary" onClick={() => { navigator.clipboard.writeText(summaryReportText); setSuccessMsg("Report copied to clipboard!"); }}>
              <Clipboard size={15} /> Copy Report
            </button>
            <button className="btn btn-primary" onClick={() => window.print()}>
              <Download size={15} /> Save PDF
            </button>
          </div>
        </header>

        <div className="content-body">
          {/* Medical AI Safety Disclaimer Banner */}
          <div className="disclaimer-banner">
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <AlertTriangle size={18} color="var(--color-coral)" />
              <span>
                <strong>Medical AI Notice:</strong> MedBud AI is an intelligent pharmacy safety assistant. It does <em>NOT</em> replace a real doctor or clinician. Mind your symptoms and consult a licensed physician for urgent conditions.
              </span>
            </div>

            {!disclaimerConfirmed && (
              <button
                className="disclaimer-btn"
                onClick={() => { setDisclaimerConfirmed(true); setShowDisclaimerModal(false); }}
              >
                I Understand & Agree
              </button>
            )}
          </div>

          {/* Feedback Alerts */}
          {error && (
            <div className="cohere-card" style={{ backgroundColor: "#fee2e2", borderColor: "#fca5a5", color: "#991b1b" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <AlertTriangle size={18} />
                <span style={{ fontWeight: 500 }}>{error}</span>
              </div>
            </div>
          )}

          {successMsg && (
            <div className="cohere-card" style={{ backgroundColor: "var(--color-pale-green)", borderColor: "#bbf7d0", color: "#065f46" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <CheckCircle2 size={18} />
                <span style={{ fontWeight: 500 }}>{successMsg}</span>
              </div>
            </div>
          )}

          {/* Metrics Overview */}
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-icon blue"><Package size={20} /></div>
              <div className="metric-data">
                <div className="val">{metrics.total}</div>
                <div className="lbl">Total Stocked</div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon coral"><Activity size={20} /></div>
              <div className="metric-data">
                <div className="val">{metrics.risky}</div>
                <div className="lbl">Safety Cautions</div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon coral"><ShieldAlert size={20} /></div>
              <div className="metric-data">
                <div className="val">{metrics.rx}</div>
                <div className="lbl">Prescription Rx</div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon green"><Gauge size={20} /></div>
              <div className="metric-data">
                <div className="val">{metrics.lowStock}</div>
                <div className="lbl">Low Stock Alerts</div>
              </div>
            </div>
          </div>

          {/* TAB 1: AI INTAKE & VISION OCR */}
          {activeTab === "scan" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
              <div className="cohere-card">
                <div className="card-header">
                  <div className="card-header-title">
                    <Camera size={20} color="var(--color-primary)" />
                    <h2>Package & Label Vision OCR</h2>
                  </div>
                  <span className="badge badge-dark">Multimodal Vision</span>
                </div>

                <label className="dropzone-box">
                  {preview ? (
                    <img src={preview} alt="Medicine preview" style={{ maxHeight: "180px", borderRadius: "6px", objectFit: "contain" }} />
                  ) : (
                    <>
                      <Upload size={32} color="var(--color-primary)" />
                      <div style={{ fontWeight: 600, color: "var(--color-ink)" }}>Upload Medicine Strip, Bottle, or Bill</div>
                      <div style={{ fontSize: "12px", color: "var(--color-muted)" }}>Supports camera capture, PNG, JPG</div>
                    </>
                  )}
                  <input type="file" accept="image/*" onChange={handleImage} />
                </label>

                <div className="form-group" style={{ marginTop: "20px" }}>
                  <label>Package Text Notes / Brand & Expiry</label>
                  <textarea
                    className="form-textarea"
                    placeholder="e.g., Crocin 500 strip, expiry Dec 2026, 10 tablets"
                    value={scanNotes}
                    onChange={(e) => setScanNotes(e.target.value)}
                  />
                </div>

                <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                  <button className="btn btn-primary" onClick={scanMedicine} disabled={scanBusy}>
                    {scanBusy ? <Loader2 className="spin" size={16} /> : <Bot size={16} />}
                    {scanBusy ? "Analyzing Package..." : "Scan & Save to Cabinet"}
                  </button>

                  <button className="btn btn-secondary" onClick={addManual} disabled={scanBusy}>
                    <Plus size={16} /> Quick Add
                  </button>
                </div>
              </div>

              {/* Extraction Cohere Console Card */}
              <div className="dark-console-card">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <CheckCircle2 size={20} color="#10b981" />
                    <h2 style={{ fontSize: "18px" }}>Extracted Identity Console</h2>
                  </div>
                  {lastScannedMed && (
                    <span className="badge badge-green">
                      {lastScannedMed.confidence || 90}% AI Confidence
                    </span>
                  )}
                </div>

                {lastScannedMed ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={{ background: "#071829", padding: "16px", borderRadius: "6px", border: "1px solid #1e293b" }}>
                      <div style={{ fontSize: "20px", fontWeight: 700, color: "#ffffff" }}>
                        {lastScannedMed.name}
                      </div>
                      <div style={{ fontSize: "13px", color: "var(--color-coral)", fontWeight: "600", marginTop: "4px" }}>
                        Composition: {lastScannedMed.activeIngredient || "N/A"} ({lastScannedMed.strength || ""})
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "13px", color: "#e2e8f0" }}>
                      <div><strong>Form:</strong> {lastScannedMed.form || "Tablet"}</div>
                      <div><strong>Schedule:</strong> <span className="badge badge-coral">{lastScannedMed.schedule || "OTC"}</span></div>
                      <div><strong>Expiry:</strong> {lastScannedMed.expiry || "Unknown"}</div>
                      <div><strong>Batch:</strong> {lastScannedMed.batch || "N/A"}</div>
                      <div><strong>Quantity:</strong> {lastScannedMed.quantity || 1} units</div>
                      <div><strong>Manufacturer:</strong> {lastScannedMed.manufacturer || "General"}</div>
                    </div>

                    {lastScannedMed.cautions && lastScannedMed.cautions.length > 0 && (
                      <div style={{ marginTop: "8px", background: "#17171c", padding: "12px", borderRadius: "6px", border: "1px solid #282830" }}>
                        <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--color-coral)", textTransform: "uppercase", marginBottom: "4px" }}>
                          Safety Cautions & Precautions:
                        </div>
                        <ul style={{ paddingLeft: "18px", fontSize: "12px", color: "#cbd5e1" }}>
                          {lastScannedMed.cautions.map((c, idx) => (
                            <li key={idx}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8" }}>
                    <PackagePlus size={40} strokeWidth={1.5} style={{ marginBottom: "12px", opacity: 0.6 }} />
                    <p style={{ fontWeight: 500, color: "#ffffff" }}>No recent OCR output</p>
                    <p style={{ fontSize: "13px", marginTop: "4px" }}>Upload a picture or enter notes to let Gemini AI parse the medicine active ingredient and expiry date.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: SMART MEDICINE CABINET */}
          {activeTab === "inventory" && (
            <div className="cohere-card">
              <div className="card-header">
                <div className="card-header-title">
                  <Package size={20} color="var(--color-primary)" />
                  <h2>Home Pharmacy Cabinet ({filteredInventory.length})</h2>
                </div>
                <button className="btn btn-sm btn-primary" onClick={() => setActiveTab("scan")}>
                  <Plus size={14} /> Scan New Product
                </button>
              </div>

              {/* Search & Filter Bar */}
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "20px" }}>
                <div style={{ position: "relative", flexGrow: 1, minWidth: "240px" }}>
                  <Search size={16} style={{ position: "absolute", left: "12px", top: "12px", color: "var(--color-muted)" }} />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search brand or composition (e.g., Paracetamol, Cetirizine)..."
                    style={{ paddingLeft: "36px" }}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="filter-chips">
                  <button className={`chip ${filterCategory === "all" ? "active" : ""}`} onClick={() => setFilterCategory("all")}>All ({inventory.length})</button>
                  <button className={`chip ${filterCategory === "risky" ? "active" : ""}`} onClick={() => setFilterCategory("risky")}>Cautions ({metrics.risky})</button>
                  <button className={`chip ${filterCategory === "expired" ? "active" : ""}`} onClick={() => setFilterCategory("expired")}>Expired ({metrics.expired})</button>
                  <button className={`chip ${filterCategory === "rx" ? "active" : ""}`} onClick={() => setFilterCategory("rx")}>Prescription Rx ({metrics.rx})</button>
                  <button className={`chip ${filterCategory === "low" ? "active" : ""}`} onClick={() => setFilterCategory("low")}>Low Stock ({metrics.lowStock})</button>
                </div>
              </div>

              {/* Responsive Cabinet Table */}
              <div className="saas-table-container">
                <table className="saas-table">
                  <thead>
                    <tr>
                      <th>Medicine Name & Active Composition</th>
                      <th>Strength / Form</th>
                      <th>Expiry Date</th>
                      <th>Quantity</th>
                      <th>Safety Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInventory.length > 0 ? (
                      filteredInventory.map((item) => {
                        const status = statusFor(item.expiry, item.quantity, item.schedule);
                        return (
                          <tr key={item.id}>
                            <td>
                              <div style={{ fontWeight: 700, color: "var(--color-ink)", fontSize: "14px" }}>{item.name}</div>
                              <div style={{ fontSize: "12px", color: "var(--color-muted)" }}>{item.activeIngredient || "N/A"}</div>
                            </td>
                            <td>
                              <div>{item.strength || "N/A"}</div>
                              <div style={{ fontSize: "11px", color: "var(--color-muted)" }}>{item.form || "Tablet"}</div>
                            </td>
                            <td>
                              <div style={{ fontWeight: 500 }}>{item.expiry || "Unknown"}</div>
                              {item.batch && <div style={{ fontSize: "11px", color: "var(--color-muted)" }}>Batch: {item.batch}</div>}
                            </td>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <button className="btn btn-secondary btn-sm" style={{ padding: "2px 8px" }} onClick={() => handleQtyDelta(item.id, -1)}><Minus size={12} /></button>
                                <span style={{ fontWeight: 700, minWidth: "20px", textAlign: "center" }}>{item.quantity || 1}</span>
                                <button className="btn btn-secondary btn-sm" style={{ padding: "2px 8px" }} onClick={() => handleQtyDelta(item.id, 1)}><Plus size={12} /></button>
                              </div>
                            </td>
                            <td>
                              <span className={`badge ${status.tone === "ok" ? "badge-green" : status.tone === "warn" ? "badge-coral" : "badge-dark"}`}>
                                {status.label}
                              </span>
                            </td>
                            <td>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDeleteMedicine(item.id, item.name)}>
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", padding: "40px", color: "var(--color-muted)" }}>
                          No medicines found matching filter criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: AI PHARMACIST AGENT */}
          {activeTab === "consult" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
              <div className="cohere-card">
                <div className="card-header">
                  <div className="card-header-title">
                    <Bot size={20} color="var(--color-primary)" />
                    <h2>AI Pharmacist Triage Console</h2>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button className={`chip ${language === "Hinglish" ? "active" : ""}`} onClick={() => setLanguage("Hinglish")}>Hinglish</button>
                    <button className={`chip ${language === "English" ? "active" : ""}`} onClick={() => setLanguage("English")}>English</button>
                  </div>
                </div>

                {/* Quick Prompts */}
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--color-muted)", textTransform: "uppercase", marginBottom: "8px" }}>Symptom Suggestions:</div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button className="chip" onClick={() => setSymptoms("High fever and headache since yesterday. Can I take Paracetamol from my cabinet?")}>Fever & Bodyache</button>
                    <button className="chip" onClick={() => setSymptoms("Dust allergy, sneezing and running nose. Which antiallergic is safe?")}>Allergy & Sneezing</button>
                    <button className="chip" onClick={() => setSymptoms("Severe stomach pain and burning after eating spicy food.")}>Stomach Pain / Acidity</button>
                  </div>
                </div>

                <div className="form-group">
                  <label>Describe Patient Symptoms</label>
                  <textarea
                    className="form-textarea"
                    style={{ minHeight: "130px" }}
                    placeholder="Describe symptoms, duration, and ask if any medicine in your inventory can be used..."
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                  />
                </div>

                <button className="btn btn-primary" style={{ width: "100%" }} onClick={runConsult} disabled={consultBusy}>
                  {consultBusy ? <Loader2 className="spin" size={16} /> : <Stethoscope size={16} />}
                  {consultBusy ? "Evaluating Pharmacist AI..." : "Evaluate Safety & Cross-Check Cabinet"}
                </button>
              </div>

              {/* Dark Enterprise Triage Output */}
              <div className="dark-console-card">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <Shield size={20} color="#10b981" />
                    <h2 style={{ fontSize: "18px" }}>AI Triage & Guidance</h2>
                  </div>
                  {consult && (
                    <span className="badge badge-green">
                      {consult.triage.toUpperCase()} TRIAGE
                    </span>
                  )}
                </div>

                {consult ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div style={{ background: "#071829", padding: "16px", borderRadius: "6px", border: "1px solid #1e293b" }}>
                      <div style={{ fontWeight: 700, fontSize: "16px", color: "#ffffff", marginBottom: "6px" }}>
                        Summary: {consult.summary}
                      </div>
                      <div style={{ fontSize: "13px", color: "var(--color-coral)" }}>
                        Risk Level: <strong>{consult.riskLevel.toUpperCase()}</strong>
                      </div>
                    </div>

                    {consult.safeGuidance && consult.safeGuidance.length > 0 && (
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "13px", color: "#10b981", marginBottom: "6px" }}>Safe Guidance Steps:</div>
                        <ul style={{ paddingLeft: "18px", fontSize: "13px", color: "#e2e8f0" }}>
                          {consult.safeGuidance.map((g, i) => (
                            <li key={i}>{g}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {consult.avoid && consult.avoid.length > 0 && (
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--color-coral)", marginBottom: "6px" }}>Do NOT Take / Contraindications:</div>
                        <ul style={{ paddingLeft: "18px", fontSize: "13px", color: "#e2e8f0" }}>
                          {consult.avoid.map((a, i) => (
                            <li key={i}>{a}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {consult.redFlags && consult.redFlags.length > 0 && (
                      <div style={{ background: "#17171c", border: "1px solid #ff7759", padding: "12px", borderRadius: "6px", color: "#ffffff" }}>
                        <div style={{ fontWeight: 700, fontSize: "13px", color: "#ff7759", marginBottom: "4px" }}>Red Flags Warning:</div>
                        <ul style={{ paddingLeft: "18px", fontSize: "12px" }}>
                          {consult.redFlags.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8" }}>
                    <Bot size={40} strokeWidth={1.5} style={{ marginBottom: "12px", opacity: 0.6 }} />
                    <p style={{ fontWeight: 500, color: "#ffffff" }}>No triage evaluated yet</p>
                    <p style={{ fontSize: "13px", marginTop: "4px" }}>Enter patient symptoms on the left to evaluate risk and cross-check against your home inventory.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: PATIENT PROFILE */}
          {activeTab === "profile" && (
            <div className="cohere-card" style={{ maxWidth: "600px" }}>
              <div className="card-header">
                <div className="card-header-title">
                  <UserCheck size={20} color="var(--color-primary)" />
                  <h2>Patient Medical History</h2>
                </div>
              </div>

              <form onSubmit={handleSaveProfile}>
                <div className="form-group">
                  <label>Patient Full Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div className="form-group">
                    <label>Age</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 28 years"
                      value={profile.age}
                      onChange={(e) => setProfile({ ...profile, age: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Weight</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 70 kg"
                      value={profile.weight}
                      onChange={(e) => setProfile({ ...profile, weight: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Known Allergies (Penicillin, Sulfa, NSAIDs, etc.)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. None known, or Penicillin allergy"
                    value={profile.allergies}
                    onChange={(e) => setProfile({ ...profile, allergies: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Pre-existing Health Conditions (Asthma, BP, Diabetes)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Hypertension, Diabetes Type 2"
                    value={profile.conditions}
                    onChange={(e) => setProfile({ ...profile, conditions: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Current Daily Medications</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Metformin 500mg daily"
                    value={profile.currentMeds}
                    onChange={(e) => setProfile({ ...profile, currentMeds: e.target.value })}
                  />
                </div>

                <button type="submit" className="btn btn-primary" style={{ marginTop: "12px" }} disabled={profileBusy}>
                  {profileBusy ? <Loader2 className="spin" size={16} /> : <UserCheck2 size={16} />}
                  Save Medical Profile
                </button>
              </form>
            </div>
          )}

          {/* TAB 5: AUDIT & REPORTS */}
          {activeTab === "audit" && (
            <div className="cohere-card">
              <div className="card-header">
                <div className="card-header-title">
                  <FileText size={20} color="var(--color-primary)" />
                  <h2>Activity Audit Trail</h2>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {audit.map((item) => (
                  <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", border: "1px solid var(--color-hairline)", borderRadius: "6px", background: "#ffffff" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <Activity size={16} color="var(--color-primary)" />
                      <span style={{ fontWeight: 600, fontSize: "14px" }}>{item.title}</span>
                    </div>
                    <span style={{ fontSize: "12px", color: "var(--color-muted)" }}>{item.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Mobile App Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav">
        <button
          className={`mobile-nav-btn ${activeTab === "scan" ? "active" : ""}`}
          onClick={() => setActiveTab("scan")}
        >
          <Camera size={18} />
          <span>Intake</span>
        </button>

        <button
          className={`mobile-nav-btn ${activeTab === "inventory" ? "active" : ""}`}
          onClick={() => setActiveTab("inventory")}
        >
          <Package size={18} />
          <span>Cabinet</span>
        </button>

        <button
          className={`mobile-nav-btn ${activeTab === "consult" ? "active" : ""}`}
          onClick={() => setActiveTab("consult")}
        >
          <Bot size={18} />
          <span>Pharmacist</span>
        </button>

        <button
          className={`mobile-nav-btn ${activeTab === "profile" ? "active" : ""}`}
          onClick={() => setActiveTab("profile")}
        >
          <UserCheck size={18} />
          <span>Profile</span>
        </button>

        <button
          className={`mobile-nav-btn ${activeTab === "audit" ? "active" : ""}`}
          onClick={() => setActiveTab("audit")}
        >
          <FileText size={18} />
          <span>Reports</span>
        </button>
      </nav>
    </div>
  );
}

function varToString(variableName: string): string {
  return variableName;
}
