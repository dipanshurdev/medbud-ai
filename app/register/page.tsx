"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          }
        }
      });

      if (authError) {
        throw new Error(authError.message);
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-canvas)", padding: "20px" }}>
      <div className="cohere-card" style={{ width: "100%", maxWidth: "420px", padding: "40px 32px" }}>
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <img src="/logo.svg" alt="MedBud AI Logo" style={{ width: "48px", height: "48px", marginBottom: "16px", display: "inline-block" }} />
          <h1 style={{ fontSize: "26px", fontWeight: 700, color: "var(--color-ink)", letterSpacing: "-0.5px" }}>Create MedBud AI Workspace</h1>
          <p style={{ fontSize: "13px", color: "var(--color-muted)", marginTop: "4px" }}>Start tracking and triaging your family pharmacy</p>
        </div>

        {error && (
          <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", color: "var(--color-error)", padding: "12px", borderRadius: "6px", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="Dipanshu Dev"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              className="form-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: "100%", padding: "12px", marginTop: "8px" }}>
            {loading ? <Loader2 className="spin" size={16} /> : "Create Free Account"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: "24px", fontSize: "13px", color: "var(--color-muted)" }}>
          Already have an account? <Link href="/register" style={{ color: "var(--color-primary)", fontWeight: "600", textDecoration: "none" }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
