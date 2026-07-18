# MediGuard AI

Safety-first home pharmacy agent for Indian families.

MediGuard AI scans medicine labels, builds a home inventory, tracks expiry and low stock, and uses Gemini 2.5 Flash to run a conservative symptom-safety workflow against the medicines already at home.

## Hackathon Pitch

Indian homes often keep old strips, half-used bottles, and duplicate medicines. People then self-medicate from memory or Google. MediGuard AI turns that messy cabinet into a safer, searchable inventory and helps users identify expiry risks, red flags, and when to contact a real doctor.

## Features

- Gemini 2.5 Flash medicine image extraction
- Manual fallback entry for labels that are hard to scan
- Persistent browser inventory using local storage
- Expiry, low-stock, Rx/caution metrics
- Family risk profile with age, weight, allergies, conditions, and current medicines
- Hinglish / English safety agent
- Structured triage: self-care, doctor, urgent
- Inventory-aware medicine relevance checks
- Avoid list, red flags, restock suggestions
- Audit trail for scans, consultations, and removals
- Printable / PDF safety report
- Precision-minimal SaaS UI inspired by Vercel, Linear, Raycast, and Resend

## Safety Model

MediGuard AI is not a doctor and does not diagnose. It avoids exact prescription dosage, checks expiry and risk context, warns for red-flag symptoms, and recommends licensed medical care for risky situations.

## Setup

```bash
npm install
npm run dev
```

Create `.env.local`:

```bash
GEMINI_API_KEY=your_gemini_key_here
```

## Deploy

1. Push this folder to GitHub.
2. Import the repo in Vercel.
3. Add `GEMINI_API_KEY` in Vercel Project Settings > Environment Variables.
4. Deploy.

## Judge Walkthrough

1. Upload a medicine strip or bottle image.
2. Click `Gemini scan` and add it to inventory.
3. Show the dashboard metrics: expiry risks, Rx/caution, low stock.
4. Ask: "I have fever and headache since morning. Can I use anything from home?"
5. Show triage, follow-up questions, inventory matches, avoid list, red flags, and restock queue.
6. Click `Save PDF` for a report.

## Tech

- Next.js 14 App Router
- TypeScript
- Gemini 2.5 Flash REST API
- Local browser storage
- Vercel-ready deployment
