"use client";

import { useState, type FormEvent } from "react";
import type { VendorAccount } from "@/lib/types";
import { Icon } from "@/components/Icon";

export function AuthDialog({ onClose, onAuthenticated }: { onClose: () => void; onAuthenticated: (vendor: VendorAccount) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch(`/api/auth/${mode === "register" ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = (await response.json()) as { vendor?: VendorAccount; error?: string };
      if (!response.ok || !data.vendor) throw new Error(data.error || "Hindi makapasok sa account.");
      onAuthenticated(data.vendor);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Tingnan ang koneksiyon at subukan muli.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section aria-labelledby="auth-title" aria-modal="true" className="auth-dialog" role="dialog">
        <button aria-label="Isara" className="icon-button dialog-close" onClick={onClose} type="button"><Icon name="close" size={19} /></button>
        <div className="auth-mark"><Icon name="leaf" size={24} /></div>
        <div className="eyebrow">BUNGA BOOKS · LIGTAS NA PAG-SYNC</div>
        <h2 id="auth-title">{mode === "login" ? "I-sync ang iyong tala" : "Gumawa ng account"}</h2>
        <p className="dialog-intro">{mode === "login" ? "Mag-login para ma-access ang iyong tala sa iba’t ibang device." : "I-save nang ligtas ang mga tala ng iyong negosyo."}</p>
        <div aria-label="Uri ng account" className="auth-tabs">
          <button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }} type="button">Mag-login</button>
          <button className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }} type="button">Mag-sign up</button>
        </div>
        <form className="form-stack" onSubmit={submit}>
          {mode === "register" && <label className="field-label">Pangalan ng tindahan o may-ari<input autoComplete="name" onChange={(event) => setName(event.target.value)} placeholder="Hal. Aling Nena" required value={name} /></label>}
          <label className="field-label">Email<input autoComplete="email" onChange={(event) => setEmail(event.target.value)} placeholder="ikaw@email.com" required type="email" value={email} /></label>
          <label className="field-label">Password<input autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} onChange={(event) => setPassword(event.target.value)} placeholder="Hindi bababa sa 8 character" required type="password" value={password} /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary button-wide" disabled={loading} type="submit">{loading ? "Sandali…" : mode === "login" ? "Mag-login at mag-sync" : "Gumawa ng ligtas na account"}<Icon name="chevron" size={18} /></button>
        </form>
        <p className="privacy-note"><Icon name="shield" size={15} /> Sariling tala mo lang ang makikita sa account na ito.</p>
      </section>
    </div>
  );
}
