export const TRANSACTION_TYPES = [
  "purchase",
  "sale",
  "transport",
  "expense",
  "capital",
  "receipt",
  "adjustment",
] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];
export type CapitalAction = "initial" | "additional" | "contribution" | "withdrawal";

export interface BusinessTransaction {
  id: string;
  type: TransactionType;
  date: string;
  fruit?: string;
  supplier?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  amount: number;
  category?: string;
  description?: string;
  paymentMethod?: string;
  capitalAction?: CapitalAction;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StoredTransaction extends BusinessTransaction {
  scope: string;
  synced: boolean;
}

export interface VendorAccount {
  id: string;
  name: string;
  email: string;
}

export interface InventoryRow {
  fruit: string;
  unit: string;
  bought: number;
  sold: number;
  remaining: number;
  purchaseCost: number;
  lastPurchaseDate: string;
  category: string;
}
