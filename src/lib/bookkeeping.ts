import type { BusinessTransaction, InventoryRow } from "@/lib/types";

export interface BusinessTotals {
  sales: number;
  purchases: number;
  transport: number;
  expenses: number;
  receipts: number;
  capitalIn: number;
  capitalOut: number;
  capitalBalance: number;
  operatingResult: number;
}

export function peso(value: number) {
  return new Intl.NumberFormat("fil-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(value || 0);
}

export function quantityText(value: number) {
  return new Intl.NumberFormat("fil-PH", { maximumFractionDigits: 2 }).format(value || 0);
}

export function formatStockByUnit(rows: InventoryRow[]) {
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(row.unit, (totals.get(row.unit) ?? 0) + row.remaining);
  return Array.from(totals.entries())
    .sort(([a], [b]) => a.localeCompare(b, "fil"))
    .map(([unit, amount]) => `${quantityText(amount)} ${unit}`)
    .join(" · ") || "0";
}

export function todayLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function formatDate(date: string) {
  if (!date) return "—";
  const parsed = new Date(`${date.slice(0, 10)}T12:00:00`);
  return new Intl.DateTimeFormat("fil-PH", { day: "numeric", month: "short", year: "numeric" }).format(parsed);
}

export function calculateTotals(records: BusinessTransaction[]): BusinessTotals {
  const totals: BusinessTotals = {
    sales: 0,
    purchases: 0,
    transport: 0,
    expenses: 0,
    receipts: 0,
    capitalIn: 0,
    capitalOut: 0,
    capitalBalance: 0,
    operatingResult: 0,
  };
  for (const record of records) {
    if (record.type === "sale") totals.sales += record.amount;
    if (record.type === "purchase") totals.purchases += record.amount;
    if (record.type === "transport") totals.transport += record.amount;
    if (record.type === "expense") totals.expenses += record.amount;
    if (record.type === "receipt") totals.receipts += record.amount;
    if (record.type === "capital") {
      if (record.capitalAction === "withdrawal") totals.capitalOut += record.amount;
      else totals.capitalIn += record.amount;
    }
  }
  totals.capitalBalance = totals.capitalIn - totals.capitalOut;
  totals.operatingResult = totals.sales + totals.receipts - totals.purchases - totals.transport - totals.expenses;
  return totals;
}

export function buildInventory(records: BusinessTransaction[]): InventoryRow[] {
  const rows = new Map<string, InventoryRow>();
  const get = (fruit: string, unit: string) => {
    const key = `${fruit.toLocaleLowerCase("fil-PH")}::${unit.toLocaleLowerCase("fil-PH")}`;
    let row = rows.get(key);
    if (!row) {
      row = { fruit, unit, bought: 0, sold: 0, remaining: 0, purchaseCost: 0, lastPurchaseDate: "", category: "Sariwang prutas" };
      rows.set(key, row);
    }
    return row;
  };
  for (const record of records) {
    if (!record.fruit || !record.unit) continue;
    const row = get(record.fruit, record.unit);
    if (record.type === "purchase") {
      const quantity = record.quantity ?? 0;
      row.bought += quantity;
      row.remaining += quantity;
      row.purchaseCost += record.unitPrice !== undefined ? quantity * record.unitPrice : record.amount;
      if (record.date >= row.lastPurchaseDate) row.lastPurchaseDate = record.date;
      if (record.category) row.category = record.category;
    } else if (record.type === "sale") {
      const quantity = record.quantity ?? 0;
      row.sold += quantity;
      row.remaining -= quantity;
    } else if (record.type === "adjustment") {
      row.remaining += record.quantity ?? 0;
    }
  }
  return Array.from(rows.values()).sort((a, b) => a.fruit.localeCompare(b.fruit, "fil"));
}

export function transactionLabel(record: BusinessTransaction) {
  switch (record.type) {
    case "purchase": return "Bumili ng prutas";
    case "sale": return "Benta";
    case "transport": return "Transportasyon";
    case "expense": return "Iba pang gastos";
    case "capital": return record.capitalAction === "withdrawal" ? "Pagkuha ng puhunan" : "Dagdag na puhunan";
    case "receipt": return "Iba pang kita";
    case "adjustment": return "Ayos ng imbentaryo";
  }
}

export function transactionTitle(record: BusinessTransaction) {
  return record.fruit || record.description || record.category || transactionLabel(record);
}

export const FRUITS = [
  "Saging", "Mangga", "Mansanas", "Orange", "Pakwan", "Pinya", "Papaya", "Ubas", "Melon", "Bayabas", "Atis", "Chico", "Langka", "Kalamansi", "Peras",
];

export const UNITS = ["kg", "kahon", "sako", "tali", "piraso"];

export const TRANSPORT_CATEGORIES = ["Pamasahe", "Gasolina", "Bayad sa paghahatid", "Paupa sa trak", "Sakay sa traysikel", "Iba pang transportasyon"];
export const EXPENSE_CATEGORIES = ["Bayad sa puwesto", "Supot na plastik", "Materyales sa pag-iimpake", "Bayarin sa palengke", "Kagamitan sa paglilinis", "Iba pang gastusin"];
