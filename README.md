# MedBud AI

Safety-first home pharmacy agent for Indian families.

MedBud AI scans medicine labels, builds a home inventory, tracks expiry and low stock, and uses Gemini 2.5 Flash to run a conservative symptom-safety workflow against the medicines already at home.

## Problem

Indian homes often keep old strips, half-used bottles, and duplicate medicines. People then self-medicate from memory or Google, leading to expired medicine use, unsafe self-medication, and delayed doctor consultation.

## Solution

MedBud AI turns every Indian home medicine box into a safety-aware AI assistant that prevents expired medicine use, unsafe self-medication, and delayed doctor consultation.

## Hackathon Pitch

MedBud AI turns that messy cabinet into a safer, searchable inventory and helps users identify expiry risks, red flags, and when to contact a real doctor.

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

## Tech Stack

- Next.js 14 App Router
- TypeScript
- Gemini 2.5 Flash REST API
- Local browser storage
- Vercel-ready deployment

## AI Workflow

1. Vision AI reads medicine labels
2. Agent asks follow-up questions
3. Agent checks inventory
4. Agent performs safety triage
5. Agent generates a structured report

## Safety Guardrails

MedBud AI does not prescribe. It helps detect risk, expiry, duplication, and when to consult a doctor. It avoids exact prescription dosage, checks expiry and risk context, warns for red-flag symptoms, and recommends licensed medical care for risky situations.

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

## Demo Steps

1. Click "Load Sample Family Cabinet" to populate demo data
2. Scan medicine → Build inventory → Ask symptom → Get safety report
3. Upload a medicine strip or bottle image (or use sample data)
4. Click "Gemini scan" and add it to inventory
5. Show the dashboard metrics: expiry risks, Rx/caution, low stock
6. Ask: "I have fever and headache since morning. Can I use anything from home?"
7. Show triage, follow-up questions, inventory matches, avoid list, red flags, and restock queue
8. Click "Save PDF" for a report

## Future Scope

- WhatsApp reminders for expiry and restock
- Pharmacy refill links integration
- Family profiles for multiple members
- Doctor-shareable PDF reports
- Drug interaction database
- Voice input for elderly users
