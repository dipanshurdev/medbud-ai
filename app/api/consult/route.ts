import { NextResponse } from "next/server";

import { z } from "zod";
import { consultSchema } from "@/lib/validations/medicine";
import { CONSULT_PROMPT_TEMPLATE } from "@/lib/prompts/v1/consult";

type ConsultRequest = z.infer<typeof consultSchema>;

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const FALLBACK_MODELS = ["gemini-2.0-flash", "gemini-1.5-flash"].filter((model) => model !== DEFAULT_MODEL);

function jsonFromText(text: string) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] || text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Gemini did not return JSON");
  return JSON.parse(raw.slice(start, end + 1));
}

export async function POST(request: Request) {
  const rawBody = await request.json();
  const parsed = consultSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.format() }, { status: 400 });
  }
  const body = parsed.data;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing GEMINI_API_KEY. Add it in .env.local or Vercel environment variables." },
      { status: 401 }
    );
  }

  const models = [DEFAULT_MODEL, ...FALLBACK_MODELS];
  let lastDetails = "";

  for (const model of models) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: CONSULT_PROMPT_TEMPLATE
                  .replace("{{LANGUAGE}}", body.language)
                  .replace("{{PAYLOAD}}", JSON.stringify({
                    message: body.message,
                    profile: body.profile,
                    inventory: body.inventory
                  }))
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json"
        }
      })
    });

    if (response.ok) {
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("") || "{}";

      try {
        return NextResponse.json({ result: jsonFromText(text), source: model });
      } catch {
        return NextResponse.json({ error: "Could not parse Gemini consultation output", raw: text }, { status: 502 });
      }
    }

    lastDetails = await response.text();
    if (response.status !== 404 && response.status !== 400) {
      break;
    }
  }

  let details = lastDetails;
  try {
    const parsed = JSON.parse(lastDetails);
    const message = parsed?.error?.message || "Gemini API request failed";
    const status = parsed?.error?.status || "unknown";
    if (status === "RESOURCE_EXHAUSTED" || message.toLowerCase().includes("quota") || message.toLowerCase().includes("rate limit")) {
      return NextResponse.json(
        { error: "Gemini consultation is temporarily unavailable because the API quota was exceeded. Please wait a moment and try again, or switch to a paid plan.", details: message },
        { status: 429 }
      );
    }
    details = message;
  } catch {
    details = lastDetails;
  }

  return NextResponse.json({ error: "Gemini consultation failed", details }, { status: 502 });
}
