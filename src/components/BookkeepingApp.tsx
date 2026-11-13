"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AuthDialog } from "@/components/AuthDialog";
import { Icon, type IconName } from "@/components/Icon";
import { TransactionDialog } from "@/components/TransactionDialog";
import { buildInventory, calculateTotals, formatDate, formatStockByUnit, peso, quantityText, todayLocal, transactionLabel, transactionTitle } from "@/lib/bookkeeping";
import { countUnsynced, getLocalRecords, getPendingDeletes, markRecordsSynced, mergeServerRecords, removeLocalRecord, removeSentDeletes, saveLocalRecord } from "@/lib/offline-store";
import type { BusinessTransaction, StoredTransaction, TransactionType, VendorAccount } from "@/lib/types";

type Section = "overview" | "purchases" | "sales" | "inventory" | "expenses" | "capital" | "reports" | "history";
type ReportRange = "daily" | "weekly" | "monthly";

const NAV_ITEMS: { id: Section; label: string; icon: IconName; group: "record" | "review" }[] = [
  { id: "overview", label: "Buod ng negosyo", icon: "home", group: "record" },
  { id: "purchases", label: "Bili ng prutas", icon: "basket", group: "record" },
  { id: "sales", label: "Talaan ng benta", icon: "cart", group: "record" },
  { id: "inventory", label: "Imbentaryo", icon: "box", group: "record" },
  { id: "expenses", label: "Mga gastusin", icon: "receipt", group: "record" },
  { id: "capital", label: "Puhunan at kita", icon: "wallet", group: "record" },
  { id: "reports", label: "Mga ulat", icon: "chart", group: "review" },
  { id: "history", label: "Kasaysayan ng tala", icon: "clock", group: "review" },
];

const SECTION_COPY: Record<Section, { title: string; description: string; addType?: TransactionType }> = {
  overview: { title: "Buod ng negosyo", description: "Kumusta ang iyong tindahan ng prutas? Heto ang kabuuan ng iyong mga tala." },
  purchases: { title: "Bili ng prutas", description: "Itala ang dumating na prutas at dagdagan ang stock mo.", addType: "purchase" },
  sales: { title: "Talaan ng benta", description: "Bawat benta ay awtomatikong ibabawas sa iyong stock.", addType: "sale" },
  inventory: { title: "Imbentaryo ng prutas", description: "Tingnan ang natitirang dami at ayusin ang stock kung kinakailangan.", addType: "adjustment" },
  expenses: { title: "Mga gastusin", description: "Subaybayan ang pamasahe, delivery at iba pang gastos." },
  capital: { title: "Puhunan at iba pang kita", description: "Ihiwalay ang galaw ng puhunan sa kita ng benta." },
  reports: { title: "Mga ulat", description: "Piliin ang panahon at i-print o i-download ang buod." },
  history: { title: "Kasaysayan ng tala", description: "Hanapin, ayusin o burahin ang mga naitalang transaksiyon." },
};

async function synchronizeAccount(scope: string): Promise<StoredTransaction[]> {
  const pendingDeletes = await getPendingDeletes(scope);
  if (pendingDeletes.length) {
    const response = await fetch("/api/transactions", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: pendingDeletes.map((item) => item.id) }),
    });
    if (!response.ok) throw new Error("Hindi naisabay ang pagbura.");
    const result = (await response.json()) as { deleted?: string[] };
    await removeSentDeletes(scope, result.deleted ?? []);
  }

  const local = await getLocalRecords(scope);
  const unsynced = local.filter((record) => !record.synced);
  for (let start = 0; start < unsynced.length; start += 200) {
    const batch = unsynced.slice(start, start + 200).map(({ scope: _scope, synced: _synced, ...record }) => record);
    const response = await fetch("/api/transactions", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ records: batch }),
    });
    if (!response.ok) throw new Error("Hindi naisabay ang mga bagong tala.");
    const result = (await response.json()) as { saved?: string[] };
    const savedIds = new Set(result.saved ?? []);
    await markRecordsSynced(scope, batch.filter((record) => savedIds.has(record.id)));
  }

  const response = await fetch("/api/transactions", { cache: "no-store" });
  if (!response.ok) throw new Error("Hindi makuha ang mga naka-sync na tala.");
  const result = (await response.json()) as { records?: BusinessTransaction[] };
  await mergeServerRecords(scope, result.records ?? []);
  return getLocalRecords(scope);
}

function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function weekBounds(dateText: string) {
  const date = new Date(`${dateText}T12:00:00`);
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: localDate(monday), to: localDate(sunday) };
}

function monthBounds(dateText: string) {
  const date = new Date(`${dateText}T12:00:00`);
  const from = new Date(date.getFullYear(), date.getMonth(), 1);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { from: localDate(from), to: localDate(last) };
}

function GreetingDate() {
  return <>{new Intl.DateTimeFormat("fil-PH", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date())}</>;
}

function StatCard({ label, value, icon, tint, footnote, positive }: { label: string; value: string; icon: IconName; tint: string; footnote: string; positive?: boolean }) {
  return (
    <article className="stat-card">
      <div className={`stat-icon ${tint}`}><Icon name={icon} size={19} /></div>
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${positive === false ? "negative-value" : ""}`}>{value}</div>
      <div className="stat-footnote">{footnote}</div>
    </article>
  );
}

function TransactionRows({ records, onEdit, onDelete, limit }: { records: StoredTransaction[]; onEdit: (record: BusinessTransaction) => void; onDelete: (record: BusinessTransaction) => void; limit?: number }) {
  const shown = limit ? records.slice(0, limit) : records;
  if (!shown.length) return <div className="empty-state compact-empty"><div className="empty-illustration"><Icon name="receipt" size={22} /></div><strong>Wala pang naitalang transaksiyon</strong><span>Magsimula sa pagdagdag ng bagong tala.</span></div>;
  return (
    <>
      <div className="table-scroll desktop-table">
        <table className="transaction-table">
          <thead><tr><th>Uri ng tala</th><th>Petsa</th><th>Detalye</th><th>Halaga</th><th>Estado</th><th><span className="sr-only">Mga aksiyon</span></th></tr></thead>
          <tbody>{shown.map((record) => <tr key={record.id}>
            <td><span className={`type-pill type-${record.type}`}>{transactionLabel(record)}</span></td>
            <td className="muted-cell">{formatDate(record.date)}</td>
            <td><span className="table-main">{transactionTitle(record)}</span><span className="table-sub">{record.type === "purchase" ? record.supplier || record.unit || "Bili ng prutas" : record.type === "sale" ? `${quantityText(record.quantity ?? 0)} ${record.unit ?? ""}${record.paymentMethod ? ` · ${record.paymentMethod}` : ""}` : record.description || record.category || record.note || "—"}</span></td>
            <td className={`amount-cell ${record.type === "sale" || record.type === "receipt" ? "amount-in" : record.type === "purchase" || record.type === "expense" || record.type === "transport" ? "amount-out" : ""}`}>{record.type === "adjustment" ? `${record.quantity && record.quantity > 0 ? "+" : ""}${quantityText(record.quantity ?? 0)} ${record.unit ?? ""}` : peso(record.amount)}</td>
            <td><span aria-label={record.synced ? "Naka-sync" : "Naka-save sa device"} className={`sync-dot ${record.synced ? "synced" : "waiting"}`}><span />{record.synced ? "Naka-sync" : "Naka-save"}</span></td>
            <td><div className="row-actions"><button aria-label={`I-edit ${transactionTitle(record)}`} className="icon-button small-icon" onClick={() => onEdit(record)} type="button"><Icon name="edit" size={16} /></button><button aria-label={`Burahin ${transactionTitle(record)}`} className="icon-button small-icon delete-action" onClick={() => onDelete(record)} type="button"><Icon name="trash" size={16} /></button></div></td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="mobile-transactions">{shown.map((record) => <article className="mobile-transaction" key={record.id}>
        <div className={`mobile-record-icon type-bg-${record.type}`}><Icon name={record.type === "sale" ? "cart" : record.type === "purchase" ? "basket" : record.type === "transport" ? "truck" : record.type === "capital" ? "wallet" : record.type === "adjustment" ? "box" : "receipt"} size={17} /></div>
        <div className="mobile-record-body"><div className="mobile-record-title">{transactionTitle(record)}</div><div className="mobile-record-meta">{formatDate(record.date)} · {transactionLabel(record)}</div></div>
        <div className="mobile-record-right"><strong>{record.type === "adjustment" ? `${quantityText(record.quantity ?? 0)} ${record.unit ?? ""}` : peso(record.amount)}</strong><div className="row-actions"><button aria-label="I-edit" className="icon-button small-icon" onClick={() => onEdit(record)} type="button"><Icon name="edit" size={15} /></button><button aria-label="Burahin" className="icon-button small-icon delete-action" onClick={() => onDelete(record)} type="button"><Icon name="trash" size={15} /></button></div></div>
      </article>)}</div>
    </>
  );
}

export function BookkeepingApp() {
  const [section, setSection] = useState<Section>("overview");
  const [records, setRecords] = useState<StoredTransaction[]>([]);
  const [vendor, setVendor] = useState<VendorAccount | null>(null);
  const [scope, setScope] = useState("guest");
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [dialogType, setDialogType] = useState<TransactionType | null>(null);
  const [editing, setEditing] = useState<BusinessTransaction | null>(null);
  const [toast, setToast] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyType, setHistoryType] = useState("all");
  const [historyDate, setHistoryDate] = useState("");
  const [reportRange, setReportRange] = useState<ReportRange>("daily");
  const [reportDate, setReportDate] = useState(todayLocal());
  const syncLock = useRef(false);
  const accountRef = useRef<VendorAccount | null>(null);
  const scopeRef = useRef("guest");

  const [pendingDeleteCount, setPendingDeleteCount] = useState(0);
  const updateLocalView = useCallback(async (targetScope: string) => {
    const [localRecords, pendingDeletes] = await Promise.all([getLocalRecords(targetScope), getPendingDeletes(targetScope)]);
    setRecords(localRecords);
    setScope(targetScope);
    scopeRef.current = targetScope;
    setPendingDeleteCount(pendingDeletes.length);
  }, []);

  const runSync = useCallback(async (targetScope: string) => {
    if (!navigator.onLine || targetScope === "guest" || syncLock.current) return;
    syncLock.current = true;
    setSyncing(true);
    setSyncError("");
    try {
      const updated = await synchronizeAccount(targetScope);
      if (scopeRef.current === targetScope) {
        setRecords(updated);
        setPendingDeleteCount((await getPendingDeletes(targetScope)).length);
      }
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Hindi nakapag-sync; ligtas ang mga tala sa device.");
    } finally {
      syncLock.current = false;
      setSyncing(false);
    }
  }, [setPendingDeleteCount, setRecords, setSyncError, setSyncing]);

  useEffect(() => {
    let mounted = true;
    const networkCheck = window.setTimeout(() => { if (mounted) setOnline(navigator.onLine); }, 0);
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(() => undefined);

    async function start() {
      let account: VendorAccount | null = null;
      try {
        const saved = localStorage.getItem("fruit-books-profile");
        if (saved) account = JSON.parse(saved) as VendorAccount;
      } catch { localStorage.removeItem("fruit-books-profile"); }
      let serverChecked = false;
      if (navigator.onLine) {
        try {
          const response = await fetch("/api/auth/me", { cache: "no-store" });
          if (response.ok) {
            const data = (await response.json()) as { vendor: VendorAccount | null };
            account = data.vendor;
            serverChecked = true;
          }
        } catch { /* Panatilihin ang naka-save na account habang offline. */ }
      }
      if (!mounted) return;
      if (serverChecked && !account) localStorage.removeItem("fruit-books-profile");
      if (account) localStorage.setItem("fruit-books-profile", JSON.stringify(account));
      accountRef.current = account;
      setVendor(account);
      const activeScope = account?.id ?? "guest";
      scopeRef.current = activeScope;
      setScope(activeScope);
      try {
        const [localRecords, pendingDeletes] = await Promise.all([getLocalRecords(activeScope), getPendingDeletes(activeScope)]);
        if (!mounted) return;
        setRecords(localRecords);
        setPendingDeleteCount(pendingDeletes.length);
        setReady(true);
        if (account && navigator.onLine) void runSync(activeScope);
      } catch {
        if (!mounted) return;
        setReady(true);
        setSyncError("Hindi mabuksan ang lokal na imbakan sa device na ito.");
      }
    }
    void start();

    const onOnline = () => {
      setOnline(true);
      if (accountRef.current) void runSync(scopeRef.current);
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      mounted = false;
      window.clearTimeout(networkCheck);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [runSync]);

  useEffect(() => {
    if (!vendor || !online) return;
    const timer = window.setInterval(() => { void runSync(vendor.id); }, 30000);
    return () => window.clearInterval(timer);
  }, [vendor, online, runSync]);

  const plainRecords = useMemo<BusinessTransaction[]>(() => records.map(({ scope: _scope, synced: _synced, ...record }) => record), [records]);
  const totals = useMemo(() => calculateTotals(plainRecords), [plainRecords]);
  const inventory = useMemo(() => buildInventory(plainRecords), [plainRecords]);
  const todayRecords = useMemo(() => records.filter((record) => record.date === todayLocal()), [records]);
  const todayTotals = useMemo(() => calculateTotals(todayRecords), [todayRecords]);
  const pendingCount = countUnsynced(records) + pendingDeleteCount;
  const sortedRecords = useMemo(() => [...records].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? "").localeCompare(a.createdAt ?? "")), [records]);
  const copy = SECTION_COPY[section];

  function openForm(type: TransactionType, record?: BusinessTransaction) {
    setEditing(record ?? null);
    setDialogType(type);
  }

  async function saveRecord(record: BusinessTransaction) {
    await saveLocalRecord(scopeRef.current, record, false);
    const updated = await getLocalRecords(scopeRef.current);
    setRecords(updated);
    setDialogType(null);
    setEditing(null);
    setToast("Na-save ang tala sa device mo.");
    if (accountRef.current && navigator.onLine) {
      try {
        await runSync(scopeRef.current);
        setToast("Na-save at naka-sync na ang tala.");
      } catch { /* Ang tala ay nananatili sa lokal na imbakan. */ }
    }
    window.setTimeout(() => setToast(""), 3200);
  }

  async function deleteRecord(record: BusinessTransaction) {
    const label = transactionTitle(record);
    if (!window.confirm(`Burahin ang tala na “${label}”? Hindi na ito maibabalik.`)) return;
    await removeLocalRecord(scopeRef.current, record.id);
    await updateLocalView(scopeRef.current);
    setToast("Nabura ang tala.");
    if (accountRef.current && navigator.onLine) void runSync(scopeRef.current);
    window.setTimeout(() => setToast(""), 3000);
  }

  async function activateAccount(account: VendorAccount) {
    try {
      const guestRecords = await getLocalRecords("guest");
      if (guestRecords.length && window.confirm(`May ${guestRecords.length} lokal na tala sa device na ito. Kopyahin ang mga ito sa account na ${account.email} upang maisabay? Mananatili pa rin ang orihinal na lokal na kopya.`)) {
        for (const { scope: _scope, synced: _synced, ...record } of guestRecords) {
          await saveLocalRecord(account.id, record, false);
        }
      }
    } catch { /* Panatilihin ang account flow kahit hindi mabuksan ang lokal na kopya. */ }
    accountRef.current = account;
    scopeRef.current = account.id;
    setVendor(account);
    localStorage.setItem("fruit-books-profile", JSON.stringify(account));
    setAuthOpen(false);
    try { await updateLocalView(account.id); } catch { setRecords([]); }
    if (navigator.onLine) await runSync(account.id);
    setToast("Handa na ang ligtas na pag-sync ng iyong tala.");
    window.setTimeout(() => setToast(""), 3500);
  }

  async function logout() {
    if (pendingCount > 0 && !window.confirm(`May ${pendingCount} tala pang hindi naka-sync. Naka-save ang mga ito sa device, pero mag-login ulit bago ito maipagpatuloy. Mag-log out pa rin?`)) return;
    if (!navigator.onLine) {
      window.alert("Kailangan ng internet upang ligtas na mag-log out. Nananatiling naka-save ang mga tala mo.");
      return;
    }
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (!response.ok) { window.alert("Hindi nakapag-log out. Subukan muli kapag may koneksiyon."); return; }
    localStorage.removeItem("fruit-books-profile");
    accountRef.current = null;
    scopeRef.current = "guest";
    setVendor(null);
    await updateLocalView("guest");
    setToast("Nag-log out ka. Nananatiling ligtas sa device ang mga lokal na tala.");
    window.setTimeout(() => setToast(""), 3500);
  }

  function changeSection(id: Section) {
    setSection(id);
    setMobileOpen(false);
  }

  const filteredRecords = useMemo(() => sortedRecords.filter((record) => {
    const matchesType = historyType === "all" || record.type === historyType;
    const matchesDate = !historyDate || record.date === historyDate;
    const term = historySearch.trim().toLocaleLowerCase("fil-PH");
    const matchesText = !term || [record.fruit, record.supplier, record.category, record.description, record.note, transactionLabel(record)].some((field) => field?.toLocaleLowerCase("fil-PH").includes(term));
    return matchesType && matchesDate && matchesText;
  }), [sortedRecords, historyType, historyDate, historySearch]);

  const reportBounds = reportRange === "daily" ? { from: reportDate, to: reportDate } : reportRange === "weekly" ? weekBounds(reportDate) : monthBounds(reportDate);
  const reportRecords = useMemo(() => plainRecords.filter((record) => record.date >= reportBounds.from && record.date <= reportBounds.to), [plainRecords, reportBounds.from, reportBounds.to]);
  const reportTotals = useMemo(() => calculateTotals(reportRecords), [reportRecords]);

  async function exportExcel() {
    const XLSX = await import("xlsx");
    const reportTotalsForExport = calculateTotals(reportRecords);
    const summaryRows = [
      { Pamagat: "Panahon", Halaga: `${formatDate(reportBounds.from)} – ${formatDate(reportBounds.to)}` },
      { Pamagat: "Kabuuang pagbili ng prutas (PHP)", Halaga: reportTotalsForExport.purchases },
      { Pamagat: "Kabuuang benta ng prutas (PHP)", Halaga: reportTotalsForExport.sales },
      { Pamagat: "Gastos sa transportasyon (PHP)", Halaga: reportTotalsForExport.transport },
      { Pamagat: "Iba pang gastusin (PHP)", Halaga: reportTotalsForExport.expenses },
      { Pamagat: "Iba pang kita (PHP)", Halaga: reportTotalsForExport.receipts },
      { Pamagat: "Dagdag na puhunan (PHP)", Halaga: reportTotalsForExport.capitalIn },
      { Pamagat: "Pagkuha ng puhunan (PHP)", Halaga: reportTotalsForExport.capitalOut },
      { Pamagat: "Tinatayang resulta ng operasyon (PHP)", Halaga: reportTotalsForExport.operatingResult },
      { Pamagat: "Natitirang stock, ayon sa yunit", Halaga: formatStockByUnit(inventory) },
    ];
    const detailRows = reportRecords.map((record) => ({
      Petsa: record.date, "Uri ng tala": transactionLabel(record), Prutas: record.fruit ?? "",
      Dami: record.quantity ?? "", Yunit: record.unit ?? "", Supplier: record.supplier ?? "",
      Kategorya: record.category ?? "", Paglalarawan: record.description ?? "",
      "Paraan ng pagbabayad": record.paymentMethod ?? "", "Halaga (PHP)": record.amount,
      Tala: record.note ?? "",
    }));
    const inventoryRows = inventory.map((row) => ({
      "Pangalan ng prutas": row.fruit, Kategorya: row.category, "Dami ng binili": row.bought,
      "Dami ng nabenta": row.sold, "Natitirang stock": row.remaining, Yunit: row.unit,
      "Karaniwang presyo ng bili": row.bought ? row.purchaseCost / row.bought : 0, "Petsa ng huling bili": row.lastPurchaseDate,
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), "Buod ng ulat");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(detailRows), "Mga transaksiyon");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(inventoryRows), "Imbentaryo ng prutas");
    XLSX.writeFile(workbook, `ulat-prutas-${reportBounds.from}.xlsx`);
  }

  function downloadBackup() {
    const backup = {
      application: "Fruit Vendor Digital Bookkeeping System",
      exportedAt: new Date().toISOString(),
      vendor: vendor ? { name: vendor.name, email: vendor.email } : null,
      totals: calculateTotals(plainRecords),
      inventory,
      transactions: plainRecords,
    };
    const file = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `backup-talaan-prutas-${todayLocal()}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const chartDays = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const key = localDate(date);
    const dayRecords = plainRecords.filter((record) => record.date === key);
    return {
      date: key,
      label: new Intl.DateTimeFormat("fil-PH", { weekday: "short" }).format(date).replace(".", ""),
      sales: dayRecords.filter((record) => record.type === "sale").reduce((sum, record) => sum + record.amount, 0),
      purchases: dayRecords.filter((record) => record.type === "purchase").reduce((sum, record) => sum + record.amount, 0),
    };
  }), [plainRecords]);
  const chartMaximum = Math.max(...chartDays.flatMap((day) => [day.sales, day.purchases]), 100);
  const lowStock = inventory.filter((row) => row.remaining > 0 && row.remaining <= 5);
  const outOfStock = inventory.filter((row) => row.remaining <= 0);

  return (
    <div className="app-shell">
      {mobileOpen && <button aria-label="Isara ang menu" className="mobile-scrim" onClick={() => setMobileOpen(false)} type="button" />}
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand-lockup"><div className="brand-mark"><Icon name="leaf" size={23} /></div><div><strong>Bunga<span>Books</span></strong><small>Negosyong prutas</small></div></div>
        <div className="side-rule" />
        <div className="side-nav-group"><div className="side-label">PANG-ARAW-ARAW</div>{NAV_ITEMS.filter((item) => item.group === "record").map((item) => <button className={`nav-link ${section === item.id ? "nav-active" : ""}`} key={item.id} onClick={() => changeSection(item.id)} type="button"><Icon name={item.icon} size={19} /><span>{item.label}</span>{item.id === "inventory" && outOfStock.length > 0 && <b className="nav-count">{outOfStock.length}</b>}</button>)}</div>
        <div className="side-nav-group review-group"><div className="side-label">PAGSUSURI</div>{NAV_ITEMS.filter((item) => item.group === "review").map((item) => <button className={`nav-link ${section === item.id ? "nav-active" : ""}`} key={item.id} onClick={() => changeSection(item.id)} type="button"><Icon name={item.icon} size={19} /><span>{item.label}</span></button>)}</div>
        <div className="sidebar-bottom">
          <div className={`sidebar-sync-card ${pendingCount ? "has-pending" : ""}`}><div className="sidebar-sync-heading"><span className={`sync-status-dot ${online ? "online-dot" : "offline-dot"}`} />{online ? vendor ? syncing ? "Nagsi-sync…" : "Online" : "Lokal na mode" : "Offline"}</div><p>{vendor ? pendingCount ? `${pendingCount} tala ang naghihintay i-sync` : "Ligtas ang mga tala mo" : "Naka-save sa device na ito"}</p>{vendor && pendingCount > 0 && online && <button className="sync-link" onClick={() => void runSync(scope)} type="button"><Icon name="refresh" size={14} /> I-sync ngayon</button>}</div>
          <button className="account-card" onClick={() => vendor ? void logout() : setAuthOpen(true)} type="button"><div className="avatar-circle">{vendor ? vendor.name.slice(0, 1).toLocaleUpperCase("fil-PH") : <Icon name="user" size={18} />}</div><div className="account-card-copy"><strong>{vendor?.name ?? "Lokal na tala"}</strong><span>{vendor ? "Mag-log out" : "Ikonekta ang account"}</span></div><Icon name={vendor ? "logout" : "chevron"} size={16} /></button>
          <div className="side-footer"><Icon name="shield" size={14} /> Mga tala mo, ikaw ang may kontrol.</div>
        </div>
      </aside>

      <main className="main-column">
        <header className="topbar">
          <button aria-label="Buksan ang menu" className="icon-button mobile-menu-button" onClick={() => setMobileOpen(true)} type="button"><Icon name="menu" size={21} /></button>
          <div className="topbar-context"><span>ANG IYONG NEGOSYO</span><strong>{copy.title}</strong></div>
          <div className="topbar-actions">
            <div className={`connection-pill ${!online ? "connection-offline" : ""}`}><span className="connection-dot" /><span>{!online ? "Offline" : syncing ? "Nagsi-sync" : vendor ? pendingCount ? "May nakabinbin" : "Naka-sync" : "Lokal"}</span><Icon name={syncing ? "refresh" : online ? "cloud" : "wifi"} size={15} /></div>
            {vendor && pendingCount > 0 && <button aria-label="I-sync ang mga tala" className="icon-button header-sync-button" onClick={() => void runSync(scope)} title="I-sync ngayon" type="button"><Icon name="refresh" size={18} /></button>}
            {vendor ? <button className="profile-button" onClick={() => void logout()} title="Mag-log out" type="button"><span className="avatar-circle top-avatar">{vendor.name.slice(0, 1).toLocaleUpperCase("fil-PH")}</span><span className="profile-name">{vendor.name}</span><Icon name="logout" size={15} /></button> : <button className="button button-outline sign-in-button" onClick={() => setAuthOpen(true)} type="button">Mag-login <Icon name="chevron" size={16} /></button>}
          </div>
        </header>

        <div className="page-content">
          <section className="page-heading"><div><div className="eyebrow mobile-eyebrow">{section === "overview" ? "KUMUSTA, MAGBIBIYAHE NG BUNGA" : "TALAAN NG NEGOSYO"}</div><h1>{copy.title}</h1><p>{copy.description}</p></div><div className="page-heading-actions"><span className="today-date"><Icon name="calendar" size={16} /><GreetingDate /></span>{copy.addType && <button className="button button-primary" onClick={() => openForm(copy.addType!)} type="button"><Icon name="plus" size={18} /> Bagong tala</button>}{section === "expenses" && <><button className="button button-outline" onClick={() => openForm("transport")} type="button"><Icon name="truck" size={17} /> Transportasyon</button><button className="button button-primary" onClick={() => openForm("expense")} type="button"><Icon name="plus" size={17} /> Iba pang gastos</button></>}{section === "capital" && <><button className="button button-outline" onClick={() => openForm("receipt")} type="button"><Icon name="plus" size={17} /> Iba pang kita</button><button className="button button-primary" onClick={() => openForm("capital")} type="button"><Icon name="wallet" size={17} /> Puhunan</button></>}</div></section>

          {!online && <div className="offline-banner"><span className="offline-banner-icon"><Icon name="wifi" size={17} /></span><span><strong>Offline ka ngayon.</strong> Naka-save muna sa device ang mga tala mo at magsi-sync kapag may internet na.</span></div>}
          {syncError && vendor && <div className="sync-warning"><Icon name="cloud" size={17} /><span>{syncError} Nananatili ang mga pagbabago sa device.</span><button onClick={() => void runSync(scope)} type="button">Subukan muli</button></div>}
          {!vendor && online && pendingCount > 0 && <div className="local-mode-notice"><Icon name="shield" size={17} /><span><strong>Lokal na mode.</strong> Naka-save sa browser na ito ang tala; gumawa ng account para ligtas na i-sync at i-backup.</span><button onClick={() => setAuthOpen(true)} type="button">Ikonekta ang account</button></div>}

          {!ready ? <div className="loading-panel"><div className="loading-spinner" /><p>Inihahanda ang talaan mo…</p></div> : <>
            {section === "overview" && <>
              <section className="welcome-strip"><div className="welcome-copy"><div className="welcome-badge"><Icon name="sparkle" size={14} /> MAGANDANG ARAW!</div><h2>Ayos ang tindahan mo, {vendor?.name?.split(" ")[0] ?? "Kaibigan"}.</h2><p>Isang simpleng tingin sa kita, gastos at mga prutas mong paninda.</p><div className="welcome-actions"><button className="button button-white" onClick={() => openForm("sale")} type="button"><Icon name="plus" size={17} /> Magtala ng benta</button><button className="welcome-text-link" onClick={() => changeSection("reports")} type="button">Tingnan ang ulat <Icon name="chevron" size={16} /></button></div></div><div aria-hidden="true" className="welcome-art"><div className="sun-orbit orbit-one" /><div className="sun-orbit orbit-two" /><div className="fruit-orb fruit-orb-one">m</div><div className="fruit-orb fruit-orb-two">b</div><div className="fruit-orb fruit-orb-three">o</div><div className="fruit-leaf"><Icon name="leaf" size={42} /></div><div className="welcome-art-label">Ani ng pagsisikap mo.</div></div><div className="welcome-date"><Icon name="calendar" size={14} /><GreetingDate /></div></section>

              <section aria-label="Mga kabuuan ng negosyo" className="stats-grid"><StatCard label="Kabuuang benta" value={peso(totals.sales)} icon="cart" tint="icon-green" footnote={`${todayTotals.sales ? `${peso(todayTotals.sales)} ngayong araw` : "Lahat ng naitalang benta"}`} /><StatCard label="Pagbili ng prutas" value={peso(totals.purchases)} icon="basket" tint="icon-amber" footnote="Kabuuang bili sa supplier" /><StatCard label="Gastos sa transportasyon" value={peso(totals.transport)} icon="truck" tint="icon-lilac" footnote="Pamasahe, gasolina at delivery" /><StatCard label="Iba pang gastusin" value={peso(totals.expenses)} icon="receipt" tint="icon-amber" footnote="Puwesto, pag-iimpake at iba pa" /><StatCard label="Resulta ng operasyon" value={peso(totals.operatingResult)} icon="chart" tint={totals.operatingResult >= 0 ? "icon-mint" : "icon-rose"} footnote="Benta + iba pang kita − gastos" positive={totals.operatingResult >= 0} /></section>

              <section className="mini-summary-grid"><button className="mini-summary-card" onClick={() => changeSection("capital")} type="button"><span className="mini-summary-icon"><Icon name="wallet" size={18} /></span><span><small>Puhunan</small><strong>{peso(totals.capitalBalance)}</strong><em>{peso(totals.capitalIn)} dagdag · {peso(totals.capitalOut)} kuha</em></span><Icon className="mini-chevron" name="chevron" size={16} /></button><button className="mini-summary-card" onClick={() => openForm("receipt")} type="button"><span className="mini-summary-icon income-mini"><Icon name="coins" size={18} /></span><span><small>Iba pang kita</small><strong>{peso(totals.receipts)}</strong><em>Hindi kasama sa benta ng prutas</em></span><Icon className="mini-chevron" name="chevron" size={16} /></button><button className="mini-summary-card" onClick={() => changeSection("inventory")} type="button"><span className="mini-summary-icon stock-mini"><Icon name="box" size={18} /></span><span><small>Natitirang stock</small><strong className="stock-summary-value">{formatStockByUnit(inventory)}</strong><em>{inventory.length} uri ng prutas sa talaan</em></span><Icon className="mini-chevron" name="chevron" size={16} /></button></section>

              {(outOfStock.length > 0 || lowStock.length > 0) && <button className="inventory-alert" onClick={() => changeSection("inventory")} type="button"><span className="alert-round"><Icon name="bell" size={17} /></span><span><strong>{outOfStock.length ? `${outOfStock.length} prutas ang ubos na` : `${lowStock.length} prutas ang paubos na`}</strong><small>{outOfStock.length ? `${outOfStock.slice(0, 3).map((row) => row.fruit).join(", ")}${outOfStock.length > 3 ? " at iba pa" : ""}` : "Suriin ang natitirang stock sa iyong imbentaryo."}</small></span><span className="alert-action">Tingnan <Icon name="chevron" size={15} /></span></button>}

              <section className="dashboard-grid"><article className="panel chart-panel"><div className="panel-heading"><div><h2>Benta at bili</h2><p>Sa nakalipas na pitong araw</p></div><button aria-label="Tingnan ang ulat" className="icon-button" onClick={() => changeSection("reports")} type="button"><Icon name="chevron" size={18} /></button></div><div className="chart-legend"><span><i className="legend-dot sales-legend" /> Benta</span><span><i className="legend-dot purchase-legend" /> Bili ng prutas</span></div><div aria-label="Bar chart ng benta at bili sa nakalipas na pitong araw" className="bar-chart">{chartDays.map((day) => <div className="chart-day" key={day.date}><div className="chart-bars"><div className="chart-bar bar-purchase" style={{ height: `${Math.max(3, day.purchases / chartMaximum * 100)}%` }} title={`Bili: ${peso(day.purchases)}`} /><div className="chart-bar bar-sales" style={{ height: `${Math.max(3, day.sales / chartMaximum * 100)}%` }} title={`Benta: ${peso(day.sales)}`} /></div><span>{day.label}</span></div>)}</div><div className="chart-footnote">{chartDays.every((day) => !day.sales && !day.purchases) ? "Magsimula sa pagtatala ng bili at benta para makita ang takbo dito." : `Kabuuang benta nitong linggo: ${peso(chartDays.reduce((sum, day) => sum + day.sales, 0))}`}</div></article>
                <article className="panel today-panel"><div className="panel-heading"><div><h2>Ngayon sa tindahan</h2><p>Mga tala ngayong araw</p></div><span className="today-tag">NGAYON</span></div><div className="today-number-row"><span>Kabuuang benta</span><strong className="today-green">{peso(todayTotals.sales)}</strong></div><div className="today-number-row"><span>Pagbili ng prutas</span><strong>{peso(todayTotals.purchases)}</strong></div><div className="today-number-row"><span>Gastos</span><strong>{peso(todayTotals.transport + todayTotals.expenses)}</strong></div><div className="today-number-row today-result"><span>Resulta ngayong araw</span><strong className={todayTotals.operatingResult < 0 ? "negative-value" : ""}>{peso(todayTotals.operatingResult)}</strong></div><div className="today-panel-footer"><span><Icon name="receipt" size={15} /> {todayRecords.length} tala ngayon</span><button onClick={() => { setReportRange("daily"); setReportDate(todayLocal()); changeSection("reports"); }} type="button">Buod ngayon <Icon name="chevron" size={14} /></button></div></article></section>

              <section className="panel recent-panel"><div className="panel-heading recent-heading"><div><h2>Mga pinakahuling tala</h2><p>Mga bagong idinagdag sa iyong libro</p></div><button className="text-button" onClick={() => changeSection("history")} type="button">Lahat ng tala <Icon name="chevron" size={16} /></button></div><TransactionRows records={sortedRecords} limit={5} onDelete={(record) => void deleteRecord(record)} onEdit={(record) => openForm(record.type, record)} /></section>
              {records.length === 0 && <section className="getting-started"><div className="getting-started-icon"><Icon name="leaf" size={22} /></div><div><strong>Simulan ang unang tala</strong><p>Magdagdag ng biniling prutas o unang benta para awtomatikong mabuo ang buod at imbentaryo.</p></div><button className="button button-primary" onClick={() => openForm("purchase")} type="button"><Icon name="plus" size={17} /> Itala ang unang bili</button></section>}
            </>}

            {section === "purchases" && <section className="panel section-panel"><div className="section-summary-row"><div className="section-summary-icon icon-amber"><Icon name="basket" size={21} /></div><div><span>Kabuuang bili ng prutas</span><strong>{peso(totals.purchases)}</strong></div><div className="section-summary-note">{records.filter((record) => record.type === "purchase").length} tala ng bili</div></div><div className="panel-heading list-heading"><div><h2>Mga biniling prutas</h2><p>Awtomatikong idinadagdag sa imbentaryo ang mga bili.</p></div><button className="button button-primary" onClick={() => openForm("purchase")} type="button"><Icon name="plus" size={17} /> Itala ang bili</button></div><TransactionRows records={sortedRecords.filter((record) => record.type === "purchase")} onDelete={(record) => void deleteRecord(record)} onEdit={(record) => openForm(record.type, record)} /></section>}

            {section === "sales" && <section className="panel section-panel"><div className="section-summary-row sale-summary"><div className="section-summary-icon icon-green"><Icon name="cart" size={21} /></div><div><span>Kabuuang benta</span><strong>{peso(totals.sales)}</strong></div><div className="section-summary-note">{records.filter((record) => record.type === "sale").length} tala ng benta</div></div><div className="panel-heading list-heading"><div><h2>Mga naitalang benta</h2><p>Ibinabawas sa stock ang dami sa bawat benta.</p></div><button className="button button-primary" onClick={() => openForm("sale")} type="button"><Icon name="plus" size={17} /> Itala ang benta</button></div><TransactionRows records={sortedRecords.filter((record) => record.type === "sale")} onDelete={(record) => void deleteRecord(record)} onEdit={(record) => openForm(record.type, record)} /></section>}

            {section === "inventory" && <>
              {outOfStock.length > 0 && <div className="inventory-status-banner empty-stock"><Icon name="bell" size={18} /><span><strong>Ubos na:</strong> {outOfStock.map((row) => row.fruit).join(", ")}. Magtala ng bagong bili upang madagdagan ang stock.</span></div>}
              {lowStock.length > 0 && <div className="inventory-status-banner low-stock"><Icon name="bell" size={18} /><span><strong>Paubos na ang stock:</strong> {lowStock.map((row) => `${row.fruit} (${quantityText(row.remaining)} ${row.unit})`).join(", ")}.</span></div>}
              <section className="panel inventory-panel"><div className="inventory-heading"><div><div className="inventory-total"><span>Natitirang stock</span><strong>{formatStockByUnit(inventory)}</strong></div><p>Batay sa bili, benta at mga ginawang pag-aayos.</p></div><button className="button button-outline" onClick={() => openForm("adjustment")} type="button"><Icon name="plus" size={17} /> Ayusin ang stock</button></div>
                {!inventory.length ? <div className="empty-state inventory-empty"><div className="empty-illustration"><Icon name="box" size={25} /></div><strong>Wala pang laman ang imbentaryo</strong><span>Kapag nagtala ka ng bili ng prutas, lalabas dito ang stock.</span><button className="button button-primary" onClick={() => openForm("purchase")} type="button"><Icon name="plus" size={16} /> Itala ang unang bili</button></div> : <div className="table-scroll"><table className="inventory-table"><thead><tr><th>Pangalan ng prutas</th><th>Kategorya</th><th>Dami ng binili</th><th>Dami ng nabenta</th><th>Natitirang stock</th><th>Yunit</th><th>Presyo ng bili / yunit</th><th>Petsa ng huling bili</th><th>Kalagayan</th></tr></thead><tbody>{inventory.map((row) => <tr key={`${row.fruit}:${row.unit}`}><td><div className="fruit-cell"><span className="fruit-badge"><Icon name="leaf" size={16} /></span><strong>{row.fruit}</strong></div></td><td className="muted-cell">{row.category}</td><td>{quantityText(row.bought)}</td><td>{quantityText(row.sold)}</td><td className="stock-quantity">{quantityText(row.remaining)}</td><td>{row.unit}</td><td>{row.bought ? peso(row.purchaseCost / row.bought) : "—"}</td><td>{row.lastPurchaseDate ? formatDate(row.lastPurchaseDate) : "—"}</td><td>{row.remaining <= 0 ? <span className="stock-status status-out">Ubos na</span> : row.remaining <= 5 ? <span className="stock-status status-low">Paubos na</span> : <span className="stock-status status-ok">May stock</span>}</td></tr>)}</tbody></table></div>}
                <div className="inventory-legend"><span><i className="status-dot dot-ok" /> Sapat ang stock</span><span><i className="status-dot dot-low" /> Paubos na · 5 o mas mababa</span><span><i className="status-dot dot-out" /> Ubos o negatibo</span></div>
              </section>
              <section className="panel inventory-note"><div className="privacy-icon"><Icon name="shield" size={18} /></div><div><strong>Isang talaan, iisang galaw ng stock</strong><p>Ang bili at benta ay kusang nag-a-update ng imbentaryo. Ang sirâ at manu-manong pag-aayos ay inilalagay sa kasaysayan upang maiwasan ang dobleng bilang.</p></div></section>
            </>}

            {section === "expenses" && <>
              <div className="expense-totals"><article className="expense-total-card"><div className="stat-icon icon-lilac"><Icon name="truck" size={19} /></div><span>Transportasyon</span><strong>{peso(totals.transport)}</strong><small>{records.filter((record) => record.type === "transport").length} tala</small><button onClick={() => openForm("transport")} type="button">+ Magdagdag</button></article><article className="expense-total-card"><div className="stat-icon icon-amber"><Icon name="receipt" size={19} /></div><span>Iba pang gastusin</span><strong>{peso(totals.expenses)}</strong><small>{records.filter((record) => record.type === "expense").length} tala</small><button onClick={() => openForm("expense")} type="button">+ Magdagdag</button></article><article className="expense-total-card expense-total-combined"><div className="stat-icon icon-rose"><Icon name="coins" size={19} /></div><span>Kabuuang gastos</span><strong>{peso(totals.transport + totals.expenses)}</strong><small>Transportasyon + iba pang gastusin</small></article></div>
              <section className="panel section-panel"><div className="panel-heading list-heading"><div><h2>Lahat ng gastusin</h2><p>Mga pamasahe, delivery at operasyon ng tindahan.</p></div><button className="button button-outline" onClick={() => openForm("transport")} type="button"><Icon name="truck" size={16} /> Transportasyon</button></div><TransactionRows records={sortedRecords.filter((record) => record.type === "transport" || record.type === "expense")} onDelete={(record) => void deleteRecord(record)} onEdit={(record) => openForm(record.type, record)} /></section>
            </>}

            {section === "capital" && <>
              <div className="capital-banner"><div className="capital-banner-icon"><Icon name="wallet" size={24} /></div><div><span>Kasalukuyang balanse ng puhunan</span><strong>{peso(totals.capitalBalance)}</strong><small>{peso(totals.capitalIn)} idinagdag · {peso(totals.capitalOut)} kinuha</small></div><Icon className="capital-watermark" name="coins" size={78} /></div>
              <div className="expense-totals capital-totals"><article className="expense-total-card"><div className="stat-icon icon-green"><Icon name="arrowUp" size={19} /></div><span>Dagdag na puhunan</span><strong>{peso(totals.capitalIn)}</strong><small>Panimula at mga kontribusyon</small></article><article className="expense-total-card"><div className="stat-icon icon-amber"><Icon name="arrowDown" size={19} /></div><span>Pagkuha ng puhunan</span><strong>{peso(totals.capitalOut)}</strong><small>Ibinawas sa puhunan</small></article><article className="expense-total-card"><div className="stat-icon icon-mint"><Icon name="coins" size={19} /></div><span>Iba pang kita</span><strong>{peso(totals.receipts)}</strong><small>Hindi kasama sa benta ng prutas</small><button onClick={() => openForm("receipt")} type="button">+ Magdagdag</button></article></div>
              <div className="accounting-note"><Icon name="shield" size={17} /><span><strong>Magkahiwalay ang puhunan, benta at kita.</strong> Ang benta ng prutas ay hindi idinadagdag sa puhunan. Ang kita sa operasyon ay hiwalay na kinukuwenta.</span></div>
              <section className="panel section-panel"><div className="panel-heading list-heading"><div><h2>Galaw ng puhunan at iba pang kita</h2><p>Mga kontribusyon, pagkuha at natanggap na kita.</p></div></div><TransactionRows records={sortedRecords.filter((record) => record.type === "capital" || record.type === "receipt")} onDelete={(record) => void deleteRecord(record)} onEdit={(record) => openForm(record.type, record)} /></section>
            </>}

            {section === "reports" && <>
              <section className="panel report-controls"><div className="report-range-tabs">{([ ["daily", "Araw-araw"], ["weekly", "Lingguhan"], ["monthly", "Buwanan"] ] as [ReportRange, string][]).map(([range, label]) => <button className={reportRange === range ? "active" : ""} key={range} onClick={() => setReportRange(range)} type="button">{label}</button>)}</div><label className="report-date-label">{reportRange === "monthly" ? "Piliin ang buwan" : reportRange === "weekly" ? "Pumili ng petsa sa linggo" : "Piliin ang petsa"}<input onChange={(event) => setReportDate(reportRange === "monthly" ? `${event.target.value}-01` : event.target.value)} type={reportRange === "monthly" ? "month" : "date"} value={reportRange === "monthly" ? reportDate.slice(0, 7) : reportDate} /></label><div className="report-export-actions"><button className="button button-outline" onClick={exportExcel} type="button"><Icon name="download" size={17} /> Excel</button><button className="button button-outline backup-button" onClick={downloadBackup} type="button"><Icon name="shield" size={16} /> Backup</button><button className="button button-primary" onClick={() => window.print()} type="button"><Icon name="print" size={17} /> I-print / PDF</button></div></section>
              <section className="panel report-panel"><div className="report-title-row"><div className="report-emblem"><Icon name="leaf" size={23} /></div><div><div className="eyebrow">BUNGA BOOKS · ULAT NG NEGOSYO</div><h2>{reportRange === "daily" ? "Ulat araw-araw" : reportRange === "weekly" ? "Ulat lingguhan" : "Ulat buwanan"}</h2><p>{formatDate(reportBounds.from)}{reportBounds.to !== reportBounds.from ? ` hanggang ${formatDate(reportBounds.to)}` : ""}</p></div><div className="report-company">{vendor?.name ?? "Tindahan ng prutas"}<small>Naka-save ang tala sa {vendor ? "account" : "device"} na ito</small></div></div>
                <div className="report-metrics-grid"><div className="report-metric"><span>Kabuuang pagbili</span><strong>{peso(reportTotals.purchases)}</strong></div><div className="report-metric"><span>Kabuuang benta</span><strong className="today-green">{peso(reportTotals.sales)}</strong></div><div className="report-metric"><span>Transportasyon</span><strong>{peso(reportTotals.transport)}</strong></div><div className="report-metric"><span>Iba pang gastusin</span><strong>{peso(reportTotals.expenses)}</strong></div><div className="report-metric"><span>Iba pang kita</span><strong>{peso(reportTotals.receipts)}</strong></div><div className="report-metric"><span>Galaw ng puhunan</span><strong>{peso(reportTotals.capitalIn - reportTotals.capitalOut)}</strong><small>{peso(reportTotals.capitalIn)} dagdag · {peso(reportTotals.capitalOut)} kuha</small></div><div className="report-metric result-metric"><span>Tinatayang resulta ng operasyon</span><strong className={reportTotals.operatingResult < 0 ? "negative-value" : ""}>{peso(reportTotals.operatingResult)}</strong><small>Benta + iba pang kita − bili − mga gastusin</small></div><div className="report-metric"><span>Natitirang imbentaryo</span><strong>{formatStockByUnit(inventory)}</strong><small>{inventory.length} uri ng prutas</small></div></div>
                <div className="report-detail-heading"><h3>Detalye ng tala</h3><span>{reportRecords.length} transaksiyon sa panahong ito</span></div><TransactionRows records={records.filter((record) => record.date >= reportBounds.from && record.date <= reportBounds.to).sort((a, b) => b.date.localeCompare(a.date))} onDelete={(record) => void deleteRecord(record)} onEdit={(record) => openForm(record.type, record)} />
                <div className="report-capital-note"><Icon name="shield" size={15} /> Hindi ibinibilang sa resulta ng operasyon ang galaw ng puhunan.</div>
              </section>
            </>}

            {section === "history" && <section className="panel section-panel history-panel"><div className="history-toolbar"><label className="history-search"><Icon name="search" size={18} /><input aria-label="Maghanap ng prutas o detalye" onChange={(event) => setHistorySearch(event.target.value)} placeholder="Maghanap ng prutas, supplier…" value={historySearch} />{historySearch && <button aria-label="Burahin ang paghahanap" onClick={() => setHistorySearch("")} type="button"><Icon name="close" size={15} /></button>}</label><label className="history-select"><Icon name="filter" size={16} /><select aria-label="Salain ayon sa uri" onChange={(event) => setHistoryType(event.target.value)} value={historyType}><option value="all">Lahat ng uri</option><option value="purchase">Bili ng prutas</option><option value="sale">Benta</option><option value="transport">Transportasyon</option><option value="expense">Iba pang gastos</option><option value="receipt">Iba pang kita</option><option value="capital">Puhunan</option><option value="adjustment">Ayos ng imbentaryo</option></select></label><label className="history-date"><Icon name="calendar" size={16} /><input aria-label="Salain ayon sa petsa" onChange={(event) => setHistoryDate(event.target.value)} type="date" value={historyDate} /></label><span className="history-count">{filteredRecords.length} tala</span></div><TransactionRows records={filteredRecords} onDelete={(record) => void deleteRecord(record)} onEdit={(record) => openForm(record.type, record)} /></section>}
          </>}
        </div>
      </main>

      {dialogType && <TransactionDialog key={`${dialogType}-${editing?.id ?? "new"}`} onClose={() => { setDialogType(null); setEditing(null); }} onSave={saveRecord} record={editing} records={records} type={dialogType} />}
      {authOpen && <AuthDialog onAuthenticated={(account) => void activateAccount(account)} onClose={() => setAuthOpen(false)} />}
      {toast && <div aria-live="polite" className="toast"><span><Icon name="check" size={17} /></span>{toast}</div>}
    </div>
  );
}
