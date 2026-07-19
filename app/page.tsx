"use client";

import {
  Activity,
  AlertTriangle,
  Archive,
  Bot,
  Camera,
  Check,
  Clipboard,
  Download,
  FileText,
  Gauge,
  Languages,
  Loader2,
  PackagePlus,
  Plus,
  RotateCcw,
  Shield,
  Trash2,
  Upload
} from "lucide-react";
import type { ReactNode } from "react";
import { ChangeEvent, useEffect, useMemo, useState } from "react";

type Tone = "ok" | "warn" | "danger";

type Medicine = {
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

type Profile = {
  name: string;
  age: string;
  weight: string;
  allergies: string;
  conditions: string;
  currentMeds: string;
};

type ConsultResult = {
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

type AuditItem = {
  id: string;
  kind: string;
  title: string;
  time: string;
};

const STORAGE_KEY = "medbud-ai-state-v1";

const initialInventory: Medicine[] = [
  {
    id: "med-1",
    name: "Paracetamol",
    activeIngredient: "Paracetamol",
    strength: "500 mg",
    form: "Tablet",
    manufacturer: "Home stock",
    expiry: "2026-11",
    batch: "A1",
    quantity: 10,
    schedule: "OTC",
    confidence: 92,
    storage: "Cool dry place",
    cautions: ["Avoid duplicate paracetamol products.", "Check liver risk and alcohol use before taking."]
  },
  {
    id: "med-2",
    name: "Cetirizine",
    activeIngredient: "Cetirizine",
    strength: "10 mg",
    form: "Tablet",
    manufacturer: "Home stock",
    expiry: "2025-06",
    batch: "B4",
    quantity: 4,
    schedule: "OTC",
    confidence: 88,
    storage: "Cool dry place",
    cautions: ["May cause drowsiness.", "Avoid driving if sleepy."]
  }
];

const initialProfile: Profile = {
  name: "Dipanshu",
  age: "24",
  weight: "68 kg",
  allergies: "None known",
  conditions: "None known",
  currentMeds: "None"
};

function monthsUntil(expiry?: string) {
  if (!expiry || expiry === "unknown") return 99;
  const [year, month] = expiry.split("-").map(Number);
  if (!year || !month) return 99;
  const now = new Date();
  return (year - now.getFullYear()) * 12 + (month - 1 - now.getMonth());
}

function statusFor(expiry?: string, quantity?: number, schedule?: string): { label: string; tone: Tone } {
  const months = monthsUntil(expiry);
  if (months < 0) return { label: "Expired", tone: "danger" };
  if (months <= 2) return { label: "Expiring soon", tone: "warn" };
  if ((quantity || 0) <= 3) return { label: "Low stock", tone: "warn" };
  if (schedule?.toLowerCase().includes("rx")) return { label: "Prescription caution", tone: "warn" };
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
  const [inventory, setInventory] = useState<Medicine[]>(initialInventory);
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [language, setLanguage] = useState<"English" | "Hinglish">("Hinglish");
  const [scanNotes, setScanNotes] = useState("");
  const [imageData, setImageData] = useState("");
  const [preview, setPreview] = useState("");
  const [symptoms, setSymptoms] = useState("I have fever and headache since morning. Can I use anything from home?");
  const [consult, setConsult] = useState<ConsultResult | null>(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [consultBusy, setConsultBusy] = useState(false);
  const [error, setError] = useState("");
  const [audit, setAudit] = useState<AuditItem[]>([
    { id: "audit-1", kind: "system", title: "Workspace initialized", time: nowLabel() }
  ]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      setInventory(parsed.inventory || initialInventory);
      setProfile(parsed.profile || initialProfile);
      setAudit(parsed.audit || []);
      setLanguage(parsed.language || "Hinglish");
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ inventory, profile, audit, language }));
  }, [inventory, profile, audit, language]);

  const metrics = useMemo(() => {
    const risky = inventory.filter((item) => statusFor(item.expiry, item.quantity, item.schedule).tone !== "ok").length;
    const rx = inventory.filter((item) => item.schedule?.toLowerCase().includes("rx")).length;
    const lowStock = inventory.filter((item) => (item.quantity || 0) <= 3).length;
    return { risky, rx, lowStock };
  }, [inventory]);

  async function handleImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setImageData(dataUrl);
    setPreview(dataUrl);
  }

  function pushAudit(kind: string, title: string) {
    setAudit((items) => [{ id: `audit-${Date.now()}`, kind, title, time: nowLabel() }, ...items].slice(0, 12));
  }

  async function scanMedicine() {
    setError("");
    setScanBusy(true);

    if(!scanNotes.length && !imageData) {
return setError("Please provide either an image or notes for scanning.");
    }
    
    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageData, notes: scanNotes })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Scan failed");
      const medicine: Medicine = { ...data.medicine, id: `med-${Date.now()}` };
      setInventory((items) => [medicine, ...items]);
      pushAudit("scan", `Scanned ${medicine.name || "medicine"} with Gemini 2.5 Flash`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanBusy(false);
    }
  }

  function addManual() {
    const [name, strength, expiry, quantity] = scanNotes.split(",").map((item) => item.trim());
    const medicine: Medicine = {
      id: `med-${Date.now()}`,
      name: name || "Manual medicine",
      activeIngredient: name || "Unknown",
      strength: strength || "Unknown strength",
      expiry: expiry || "unknown",
      quantity: Number(quantity?.replace(/\D/g, "")) || 1,
      schedule: "Unknown",
      confidence: 60,
      cautions: ["Manual entry. Verify package label, expiry, and active ingredient."]
    };
    setInventory((items) => [medicine, ...items]);
    pushAudit("manual", `Added ${medicine.name}`);
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
      pushAudit("consult", `${data.result.triage} triage generated`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Consultation failed");
    } finally {
      setConsultBusy(false);
    }
  }

  function resetWorkspace() {
    setInventory(initialInventory);
    setProfile(initialProfile);
    setConsult(null);
    setImageData("")
    setPreview("")
    setAudit([{ id: `audit-${Date.now()}`, kind: "system", title: "Workspace reset", time: nowLabel() }]);
    localStorage.removeItem(STORAGE_KEY);
  }

  function loadSampleData() {
    const sampleInventory: Medicine[] = [
      {
        id: "med-sample-1",
        name: "Paracetamol",
        activeIngredient: "Paracetamol",
        strength: "500 mg",
        form: "Tablet",
        manufacturer: "Home stock",
        expiry: "2026-11",
        batch: "A1",
        quantity: 10,
        schedule: "OTC",
        confidence: 92,
        storage: "Cool dry place",
        cautions: ["Avoid duplicate paracetamol products.", "Check liver risk and alcohol use before taking."]
      },
      {
        id: "med-sample-2",
        name: "Cetirizine",
        activeIngredient: "Cetirizine",
        strength: "10 mg",
        form: "Tablet",
        manufacturer: "Home stock",
        expiry: "2025-06",
        batch: "B4",
        quantity: 4,
        schedule: "OTC",
        confidence: 88,
        storage: "Cool dry place",
        cautions: ["May cause drowsiness.", "Avoid driving if sleepy."]
      },
      {
        id: "med-sample-3",
        name: "Amoxicillin",
        activeIngredient: "Amoxicillin",
        strength: "250 mg",
        form: "Capsule",
        manufacturer: "Home stock",
        expiry: "2024-12",
        batch: "C2",
        quantity: 6,
        schedule: "Rx",
        confidence: 85,
        storage: "Cool dry place",
        cautions: ["Complete full course as prescribed.", "Do not share antibiotics."]
      },
      {
        id: "med-sample-4",
        name: "Omeprazole",
        activeIngredient: "Omeprazole",
        strength: "20 mg",
        form: "Capsule",
        manufacturer: "Home stock",
        expiry: "2027-03",
        batch: "D1",
        quantity: 2,
        schedule: "OTC",
        confidence: 90,
        storage: "Cool dry place",
        cautions: ["Take before meals.", "Long-term use requires doctor supervision."]
      }
    ];
    setInventory(sampleInventory);
    pushAudit("sample", "Loaded sample family cabinet data");
  }

  const summary = `MedBud AI Safety Report

Generated: ${nowLabel()}

PATIENT PROFILE
Name: ${profile.name}
Age: ${profile.age}
Weight: ${profile.weight}
Allergies: ${profile.allergies}
Conditions: ${profile.conditions}
Current medicines: ${profile.currentMeds}

SYMPTOMS
${symptoms}

INVENTORY CHECKED
${inventory.map((item) => `- ${item.name} ${item.strength || ""} | ${statusFor(item.expiry, item.quantity, item.schedule).label} | Expiry ${item.expiry || "unknown"} | Qty ${item.quantity || 0}`).join("\n")}

TRIAGE
${consult ? `${consult.triage.toUpperCase()} / ${consult.riskLevel.toUpperCase()}` : "Not generated yet"}
${consult ? consult.summary : ""}

RISKS FOUND
${consult ? consult.avoid.map((item) => `- ${item}`).join("\n") : "Run the safety agent."}

RED FLAGS
${consult ? consult.redFlags.map((item) => `- ${item}`).join("\n") : "Run the safety agent."}

SUGGESTED NEXT STEP
${consult ? consult.safeGuidance.map((item) => `- ${item}`).join("\n") : "Run the safety agent."}

DOCTOR CONSULTATION WARNING
${consult?.triage === "urgent" ? "URGENT: Consult a doctor immediately." : consult?.triage === "doctor" ? "RECOMMENDED: Consult a doctor for proper diagnosis." : "Monitor symptoms. Consult doctor if condition worsens."}

DISCLAIMER
MedBud AI does not prescribe. It helps detect risk, expiry, duplication, and when to consult a doctor. This is AI-generated information for reference only. It is not medical advice. Always consult a licensed doctor.`;

  return (
    <main className="appShell">
      <aside className="sidebar">
        <div className="mark"><Shield size={18} /> MedBud AI</div>
        <nav>
          <a href="#scan">Scan</a>
          <a href="#inventory">Inventory</a>
          <a href="#agent">Agent</a>
          <a href="#report">Report</a>
        </nav>
        <div className="sidebarMeta">
          <span>Model</span>
          <strong>Gemini 2.5 Flash</strong>
          <span className="metaLabel">Built for Indian homes</span>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">India&apos;s family medicine box safety assistant</p>
            <h1>MedBud AI</h1>
          </div>
          <div className="topActions">
            <button className="ghost" onClick={loadSampleData}><PackagePlus size={15} /> Load Sample Family Cabinet</button>
            <button className="ghost" onClick={resetWorkspace}><RotateCcw size={15} /> Reset</button>
            <button className="ghost" onClick={() => navigator.clipboard.writeText(summary)}><Clipboard size={15} /> Copy report</button>
            <button onClick={() => window.print()}><Download size={15} /> Save PDF</button>
          </div>
        </header>

        <section className="disclaimer">
          <AlertTriangle size={16} />
          <span>MedBud AI does not prescribe. It helps detect risk, expiry, duplication, and when to consult a doctor.</span>
        </section>

        <section className="demoFlow">
          <span className="flowStep">1. Scan medicine</span>
          <span className="flowArrow">→</span>
          <span className="flowStep">2. Build inventory</span>
          <span className="flowArrow">→</span>
          <span className="flowStep">3. Ask symptom</span>
          <span className="flowArrow">→</span>
          <span className="flowStep">4. Get safety report</span>
        </section>

        {error ? <section className="error"><AlertTriangle size={16} /> {error}</section> : null}

        <section className="metricGrid">
          <Metric label="Tracked stock" value={inventory.length} icon={<Archive size={16} />} />
          <Metric label="Expiry risks" value={metrics.risky} icon={<Activity size={16} />} tone={metrics.risky ? "warn" : "ok"} />
          <Metric label="Rx / caution" value={metrics.rx} icon={<Shield size={16} />} tone={metrics.rx ? "warn" : "ok"} />
          <Metric label="Low stock" value={metrics.lowStock} icon={<Gauge size={16} />} tone={metrics.lowStock ? "warn" : "ok"} />
        </section>

        <section className="mainGrid">
          <div className="stack">
            <Panel id="scan" title="Inventory intake" icon={<Camera size={17} />}>
              <label className="dropzone">
                {preview ? <img src={preview} alt="Uploaded medicine" style={{ maxHeight: "100%", width: "100%", objectFit: "cover" }} /> : <Upload size={24} />}
                <span>{preview ? "Ready for Gemini OCR" : "Upload strip, bottle, bill, or label"}</span>
                <input type="file" accept="image/*" onChange={handleImage} />
              </label>
              <label className="field">
                <span>Notes</span>
                <textarea placeholder="Crocin 500 strip, expiry Nov 2026, 10 tablets" value={scanNotes} onChange={(event) => setScanNotes(event.target.value)} />
              </label>
              <div className="buttonRow">
                <button onClick={scanMedicine} disabled={scanBusy || scanNotes.length === 0 && !imageData}>
                  {scanBusy ? <Loader2 className="spin" size={15} /> : <Bot size={15} />}
                  Gemini scan
                </button>
                <button className="ghost" onClick={addManual}><Plus size={15} /> Manual add</button>
              </div>
            </Panel>

            <Panel title="Family profile" icon={<Shield size={17} />}>
              <div className="profileGrid">
                {Object.entries(profile).map(([key, value]) => (
                  <label className="field" key={key}>
                    <span>{key}</span>
                    <input
                      value={value}
                      onChange={(event) => setProfile((current) => ({ ...current, [key]: event.target.value }))}
                    />
                  </label>
                ))}
              </div>
              <button className="language" onClick={() => setLanguage((value) => (value === "English" ? "Hinglish" : "English"))}>
                <Languages size={15} /> {language}
              </button>
            </Panel>
          </div>

          <Panel id="inventory" title="Live inventory" icon={<Archive size={17} />} className="inventoryPanel">
            <div className="inventoryList">
              {inventory.map((item) => {
                const status = statusFor(item.expiry, item.quantity, item.schedule);
                return (
                  <article className="medRow" key={item.id}>
                    <div className="medMain">
                      <h3>{item.name}</h3>
                      <p>{[item.activeIngredient, item.strength, item.form].filter(Boolean).join(" / ")}</p>
                    </div>
                    <span className={`badge ${status.tone}`}>{status.label}</span>
                    <div className="medMeta">
                      <span>EXP {item.expiry || "unknown"}</span>
                      <span>QTY {item.quantity || 0}</span>
                      <span>{item.schedule || "Unknown"}</span>
                      <span className="confidenceScore">Gemini extraction confidence: {item.confidence || 0}%</span>
                    </div>
                    <p className="medCaution">{item.cautions?.[0] || "Verify label before use."}</p>
                    <button
                      className="iconOnly"
                      aria-label={`Remove ${item.name}`}
                      onClick={() => {
                        setInventory((items) => items.filter((med) => med.id !== item.id));
                        pushAudit("remove", `Removed ${item.name}`);
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </article>
                );
              })}
            </div>
          </Panel>

          <Panel id="agent" title="Safety agent" icon={<Bot size={17} />} className="agentPanel">
            <label className="field">
              <span>Patient question</span>
              <textarea className="symptomBox" value={symptoms} onChange={(event) => setSymptoms(event.target.value)} />
            </label>
            <button onClick={runConsult} disabled={consultBusy}>
              {consultBusy ? <Loader2 className="spin" size={15} /> : <Bot size={15} />}
              Run safety check
            </button>

            {consult ? (
              <div className="consultGrid">
                <div className={`triage ${consult.riskLevel}`}>
                  <span>Triage</span>
                  <strong>{consult.triage}</strong>
                  <p>{consult.summary}</p>
                </div>
                <ResultBlock title="Red flags" items={consult.redFlags} />
                <ResultBlock title="Follow-up questions" items={consult.followUpQuestions} />
                <ResultBlock title="Inventory matches" items={consult.inventoryMatches.map((item) => `${item.name}: ${item.status} - ${item.reason}`)} />
                <ResultBlock title="Safe guidance" items={consult.safeGuidance} />
                <ResultBlock title="Avoid" items={consult.avoid} />
                <ResultBlock title="Restock queue" items={consult.restockSuggestions} />
                <div className="aiReasoning">
                  <h3>AI Safety Reasoning</h3>
                  <ul>
                    <li>✓ Checked expiry dates against current date</li>
                    <li>✓ Checked allergy profile against active ingredients</li>
                    <li>✓ Checked for duplicate ingredient conflicts</li>
                    <li>✓ Checked red flag symptoms (chest pain, breathing issues, pregnancy, severe allergy, high fever, overdose)</li>
                    <li>✓ Evaluated doctor referral need based on risk level</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="emptyState">
                <Bot size={20} />
                <p>Run a safety check to get triage, inventory checks, red flags, and restock suggestions from Gemini. Supports Hinglish for natural conversations.</p>
              </div>
            )}
          </Panel>

          <Panel title="Audit trail" icon={<Activity size={17} />}>
            <div className="auditList">
              {audit.map((item) => (
                <div className="auditItem" key={item.id}>
                  <Check size={14} />
                  <span>{item.title}</span>
                  <time>{item.time}</time>
                </div>
              ))}
            </div>
          </Panel>

          <Panel id="report" title="Submission-ready report" icon={<FileText size={17} />} className="reportPanel">
            <pre>{summary}</pre>
          </Panel>
        </section>
      </section>
    </main>
  );
}

function Metric({
  label,
  value,
  icon,
  tone = "ok"
}: {
  label: string;
  value: number;
  icon: ReactNode;
  tone?: Tone;
}) {
  return (
    <article className={`metric ${tone}`}>
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function Panel({
  id,
  title,
  icon,
  className = "",
  children
}: {
  id?: string;
  title: string;
  icon: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={`panel ${className}`}>
      <div className="panelHead">
        <div>{icon}<h2>{title}</h2></div>
      </div>
      {children}
    </section>
  );
}

function ResultBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="resultBlock">
      <h3>{title}</h3>
      <ul>
        {(items?.length ? items : ["No item returned."]).map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
