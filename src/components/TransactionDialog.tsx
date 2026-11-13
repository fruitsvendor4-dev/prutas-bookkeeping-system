"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { buildInventory, EXPENSE_CATEGORIES, FRUITS, todayLocal, TRANSPORT_CATEGORIES, UNITS } from "@/lib/bookkeeping";
import type { BusinessTransaction, CapitalAction, StoredTransaction, TransactionType } from "@/lib/types";
import { Icon } from "@/components/Icon";

interface TransactionDialogProps {
  type: TransactionType;
  record?: BusinessTransaction | null;
  records: StoredTransaction[];
  onClose: () => void;
  onSave: (record: BusinessTransaction) => Promise<void>;
}

type Draft = {
  date: string; fruit: string; supplier: string; quantity: string; unit: string; unitPrice: string;
  amount: string; category: string; description: string; paymentMethod: string;
  capitalAction: CapitalAction; note: string; adjustmentAction: "add" | "remove" | "spoiled";
};

const FRESH_CATEGORIES = ["Tropikal", "Sitrus", "Inangkat", "Iba pa"];
const TITLES: Record<TransactionType, string> = {
  purchase: "Itala ang pagbili ng prutas", sale: "Itala ang benta", transport: "Itala ang gastos sa transportasyon",
  expense: "Itala ang iba pang gastusin", capital: "Itala ang puhunan", receipt: "Itala ang iba pang kita", adjustment: "Ayusin ang imbentaryo",
};

export function TransactionDialog({ type, record, records, onClose, onSave }: TransactionDialogProps) {
  const [draft, setDraft] = useState<Draft>({
    date: record?.date ?? todayLocal(), fruit: record?.fruit ?? "", supplier: record?.supplier ?? "",
    quantity: record?.quantity !== undefined ? String(Math.abs(record.quantity)) : "", unit: record?.unit ?? "kg",
    unitPrice: record?.unitPrice !== undefined ? String(record.unitPrice) : "", amount: String(record?.amount ?? ""),
    category: record?.category ?? (type === "transport" ? TRANSPORT_CATEGORIES[0] : type === "expense" ? EXPENSE_CATEGORIES[0] : type === "capital" ? "initial" : type === "adjustment" ? "Manual adjustment" : type === "receipt" ? "Iba pang kita" : "Tropikal"),
    description: record?.description ?? "", paymentMethod: record?.paymentMethod ?? "Cash",
    capitalAction: record?.capitalAction ?? "initial", note: record?.note ?? "",
    adjustmentAction: record?.category === "Sirâ o damaged" ? "spoiled" : (record?.quantity ?? 1) < 0 ? "remove" : "add",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const change = (key: keyof Draft, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const fruitTransaction = type === "purchase" || type === "sale" || type === "adjustment";
  const quantity = Number(draft.quantity) || 0;
  const unitPrice = Number(draft.unitPrice) || 0;
  const computedAmount = type === "purchase" || type === "sale" ? quantity * unitPrice : Number(draft.amount) || 0;
  const available = useMemo(() => {
    if (type !== "sale" || !draft.fruit) return null;
    const inventory = buildInventory(records.filter((item) => item.id !== record?.id));
    const row = inventory.find((item) => item.fruit.toLocaleLowerCase("fil-PH") === draft.fruit.toLocaleLowerCase("fil-PH") && item.unit === draft.unit);
    return row?.remaining ?? 0;
  }, [type, draft.fruit, draft.unit, records, record?.id]);

  const title = record ? `I-edit ang ${TITLES[type].toLocaleLowerCase("fil-PH")}` : TITLES[type];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (fruitTransaction && !draft.fruit.trim()) return setError("Ilagay ang pangalan ng prutas.");
    if ((type === "purchase" || type === "sale") && (quantity <= 0 || unitPrice <= 0 || computedAmount <= 0)) {
      return setError("Ilagay ang dami at presyong mas mataas sa zero.");
    }
    if (type === "adjustment" && quantity <= 0) return setError("Ilagay ang dami ng ia-adjust.");
    if (!fruitTransaction && Number(draft.amount) <= 0) return setError("Ilagay ang halagang mas mataas sa zero.");
    const signedQuantity = type === "adjustment" && draft.adjustmentAction !== "add" ? -quantity : quantity;
    const result: BusinessTransaction = {
      id: record?.id ?? crypto.randomUUID(), type, date: draft.date,
      amount: type === "purchase" || type === "sale" ? computedAmount : type === "adjustment" ? 0 : Number(draft.amount),
      ...(fruitTransaction ? { fruit: draft.fruit.trim(), quantity: signedQuantity, unit: draft.unit } : {}),
      ...(type === "purchase" ? { supplier: draft.supplier.trim(), unitPrice, category: draft.category } : {}),
      ...(type === "sale" ? { unitPrice, paymentMethod: draft.paymentMethod } : {}),
      ...(type === "adjustment" ? { category: draft.adjustmentAction === "spoiled" ? "Sirâ o damaged" : draft.adjustmentAction === "remove" ? "Manual na bawas" : "Manual na dagdag", description: draft.description.trim() } : {}),
      ...(type === "transport" || type === "expense" ? { category: draft.category, description: draft.description.trim() } : {}),
      ...(type === "capital" ? { capitalAction: draft.capitalAction, category: draft.capitalAction, description: draft.description.trim() } : {}),
      ...(type === "receipt" ? { category: draft.category, description: draft.description.trim() } : {}),
      ...(type === "capital" && !draft.description.trim() ? { description: draft.capitalAction === "initial" ? "Panimulang puhunan" : draft.capitalAction === "withdrawal" ? "Pagkuha ng puhunan" : "Karagdagang puhunan" } : {}),
      ...(draft.note.trim() ? { note: draft.note.trim() } : {}),
    };
    setSaving(true);
    try {
      await onSave(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Hindi na-save ang tala. Subukan muli.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <section aria-labelledby="transaction-title" aria-modal="true" className="transaction-dialog" role="dialog">
        <div className="dialog-heading">
          <div><div className="eyebrow">BAGONG TALA · PRIBADONG IMBENTARYO</div><h2 id="transaction-title">{title}</h2><p>Awtomatikong mase-save ang tala sa device na ito.</p></div>
          <button aria-label="Isara" className="icon-button" disabled={saving} onClick={onClose} type="button"><Icon name="close" size={19} /></button>
        </div>
        <form className="form-stack" onSubmit={submit}>
          <label className="field-label">Petsa<input onChange={(event) => change("date", event.target.value)} required type="date" value={draft.date} /></label>

          {fruitTransaction && <>
            <label className="field-label">Pangalan ng prutas<input autoComplete="off" list="fruit-varieties" onChange={(event) => change("fruit", event.target.value)} placeholder="Pumili o magdagdag ng prutas" required value={draft.fruit} /><datalist id="fruit-varieties">{FRUITS.map((fruit) => <option key={fruit} value={fruit} />)}</datalist></label>
            <div className="form-grid">
              <label className="field-label">Dami{type === "sale" ? " ng nabenta" : type === "purchase" ? " ng binili" : " na ia-adjust"}<input min="0.01" onChange={(event) => change("quantity", event.target.value)} placeholder="0" required step="0.01" type="number" value={draft.quantity} /></label>
              <label className="field-label">Yunit<select onChange={(event) => change("unit", event.target.value)} value={draft.unit}>{UNITS.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
            </div>
          </>}

          {type === "purchase" && <>
            <label className="field-label">Pangalan ng supplier<input onChange={(event) => change("supplier", event.target.value)} placeholder="Hal. Pamilihang bayan" value={draft.supplier} /></label>
            <label className="field-label">Kategorya ng prutas<select onChange={(event) => change("category", event.target.value)} value={draft.category}>{FRESH_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label>
            <div className="form-grid">
              <label className="field-label">Presyo bawat {draft.unit}<div className="peso-input"><span>₱</span><input min="0.01" onChange={(event) => change("unitPrice", event.target.value)} placeholder="0.00" required step="0.01" type="number" value={draft.unitPrice} /></div></label>
              <div className="field-label">Kabuuang halaga<div className="calculated-total">₱{computedAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</div></div>
            </div>
          </>}

          {type === "sale" && <>
            {available !== null && <div className={available < quantity ? "stock-warning" : "stock-available"}><Icon name={available < quantity ? "bell" : "box"} size={16} /> Nakatala sa stock: <strong>{available.toLocaleString("fil-PH")} {draft.unit}</strong>{available < quantity ? " · Kulang ang naka-record na stock; maaari itong maging negatibo." : ""}</div>}
            <div className="form-grid">
              <label className="field-label">Presyo bawat {draft.unit}<div className="peso-input"><span>₱</span><input min="0.01" onChange={(event) => change("unitPrice", event.target.value)} placeholder="0.00" required step="0.01" type="number" value={draft.unitPrice} /></div></label>
              <div className="field-label">Kabuuang benta<div className="calculated-total">₱{computedAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</div></div>
            </div>
            <label className="field-label">Paraan ng pagbabayad<select onChange={(event) => change("paymentMethod", event.target.value)} value={draft.paymentMethod}><option>Cash</option><option>GCash</option><option>Iba pa</option></select></label>
          </>}

          {type === "adjustment" && <>
            <label className="field-label">Uri ng pag-aayos<select onChange={(event) => change("adjustmentAction", event.target.value)} value={draft.adjustmentAction}><option value="add">Dagdag na stock</option><option value="remove">Bawas na stock</option><option value="spoiled">Sirâ o damaged na prutas</option></select></label>
            <label className="field-label">Paglalarawan<input onChange={(event) => change("description", event.target.value)} placeholder="Hal. Manual na bilang o dahilan" value={draft.description} /></label>
          </>}

          {(type === "transport" || type === "expense") && <>
            <label className="field-label">Uri ng gastos<select onChange={(event) => change("category", event.target.value)} value={draft.category}>{(type === "transport" ? TRANSPORT_CATEGORIES : EXPENSE_CATEGORIES).map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="field-label">Paglalarawan<input onChange={(event) => change("description", event.target.value)} placeholder="Dagdag na detalye" value={draft.description} /></label>
            <label className="field-label">Halaga<div className="peso-input"><span>₱</span><input min="0.01" onChange={(event) => change("amount", event.target.value)} placeholder="0.00" required step="0.01" type="number" value={draft.amount} /></div></label>
          </>}

          {type === "capital" && <>
            <label className="field-label">Uri ng galaw ng puhunan<select onChange={(event) => { change("capitalAction", event.target.value); change("category", event.target.value); }} value={draft.capitalAction}><option value="initial">Panimulang puhunan</option><option value="additional">Karagdagang puhunan</option><option value="contribution">Dagdag na kontribusyon</option><option value="withdrawal">Pagkuha ng puhunan</option></select></label>
            <label className="field-label">Paglalarawan<input onChange={(event) => change("description", event.target.value)} placeholder="Hal. Puhunan sa pagbubukas" value={draft.description} /></label>
            <label className="field-label">Halaga<div className="peso-input"><span>₱</span><input min="0.01" onChange={(event) => change("amount", event.target.value)} placeholder="0.00" required step="0.01" type="number" value={draft.amount} /></div></label>
            {draft.capitalAction === "withdrawal" && <p className="form-hint">Ang pagkuha ng puhunan ay ibabawas sa balanse. Hindi ito benta o gastusin sa operasyon.</p>}
          </>}

          {type === "receipt" && <>
            <label className="field-label">Pinagmulan<input onChange={(event) => change("category", event.target.value)} placeholder="Hal. Kita sa serbisyo" required value={draft.category} /></label>
            <label className="field-label">Paglalarawan<input onChange={(event) => change("description", event.target.value)} placeholder="Detalye ng natanggap" value={draft.description} /></label>
            <label className="field-label">Halaga<div className="peso-input"><span>₱</span><input min="0.01" onChange={(event) => change("amount", event.target.value)} placeholder="0.00" required step="0.01" type="number" value={draft.amount} /></div></label>
          </>}

          {type !== "receipt" && <label className="field-label">Tala <span className="optional-label">(opsyonal)</span><textarea onChange={(event) => change("note", event.target.value)} placeholder="Munting dagdag na detalye" rows={2} value={draft.note} /></label>}
          {type === "receipt" && <label className="field-label">Tala <span className="optional-label">(opsyonal)</span><textarea onChange={(event) => change("note", event.target.value)} placeholder="Munting dagdag na detalye" rows={2} value={draft.note} /></label>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="dialog-actions"><button className="button button-quiet" disabled={saving} onClick={onClose} type="button">Kanselahin</button><button className="button button-primary" disabled={saving} type="submit">{saving ? "Sine-save…" : record ? "I-save ang pagbabago" : "I-save ang tala"}<Icon name="check" size={17} /></button></div>
        </form>
      </section>
    </div>
  );
}
