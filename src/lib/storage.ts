'use client';

import { Employee, InventoryItem, ProductionEntry, WasteEntry, WeeklyCount, BubbleConfig } from '@/types';
import { DEFAULT_INVENTORY } from '@/data/inventory';

// ─── Store selection (global, not namespaced) ────────────────────────────────
const CURRENT_STORE_KEY = 'keiths-current-store';

export function getCurrentStoreId(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(CURRENT_STORE_KEY) || '';
}

export function setCurrentStoreId(storeId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CURRENT_STORE_KEY, storeId);
}

// Prefix a key with the active store so each store has isolated data
function k(suffix: string): string {
  const storeId = getCurrentStoreId();
  const prefix = storeId ? `keiths-${storeId}` : 'keiths';
  return `${prefix}-${suffix}`;
}

// ─── Low-level helpers ───────────────────────────────────────────────────────
function getItem<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setItem<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

// ─── Employees ───────────────────────────────────────────────────────────────
export function getEmployees(): Employee[] {
  return getItem<Employee[]>(k('employees'), []);
}

export function saveEmployees(employees: Employee[]): void {
  setItem(k('employees'), employees);
}

export function addEmployee(employee: Employee): void {
  const employees = getEmployees();
  employees.push(employee);
  saveEmployees(employees);
}

export function removeEmployee(id: string): void {
  const employees = getEmployees().filter((e) => e.id !== id);
  saveEmployees(employees);
}

// ─── Inventory ───────────────────────────────────────────────────────────────
export function getInventory(): InventoryItem[] {
  const items = getItem<InventoryItem[]>(k('inventory-items'), []);
  if (items.length === 0) {
    setItem(k('inventory-items'), DEFAULT_INVENTORY);
    return DEFAULT_INVENTORY;
  }
  return items;
}

export function saveInventory(items: InventoryItem[]): void {
  setItem(k('inventory-items'), items);
}

export function updateInventoryItem(item: InventoryItem): void {
  const items = getInventory();
  const idx = items.findIndex((i) => i.id === item.id);
  if (idx >= 0) {
    items[idx] = item;
    saveInventory(items);
  }
}

export function addCustomItem(item: InventoryItem): void {
  const items = getInventory();
  items.push(item);
  saveInventory(items);
}

export function deleteCustomItem(id: string): void {
  const items = getInventory().filter((i) => i.id !== id);
  saveInventory(items);
  const enabled = getEnabledItemIds();
  setItem(k('enabled-items'), enabled.filter((eid) => eid !== id));
}

// ─── Enabled Items (legacy) ──────────────────────────────────────────────────
export function getEnabledItemIds(): string[] {
  const stored = getItem<string[] | null>(k('enabled-items'), null);
  if (stored === null) {
    const allIds = getInventory().map((i) => i.id);
    setItem(k('enabled-items'), allIds);
    return allIds;
  }
  return stored;
}

export function setEnabledItemIds(ids: string[]): void {
  setItem(k('enabled-items'), ids);
}

export function toggleItemEnabled(itemId: string): void {
  const enabled = getEnabledItemIds();
  if (enabled.includes(itemId)) {
    setItem(k('enabled-items'), enabled.filter((id) => id !== itemId));
  } else {
    setItem(k('enabled-items'), [...enabled, itemId]);
  }
}

export function getEnabledItems(): InventoryItem[] {
  const all = getInventory();
  const enabledIds = getEnabledItemIds();
  return all.filter((item) => enabledIds.includes(item.id));
}

// ─── Dual Enable: Sheets ─────────────────────────────────────────────────────
export function getEnabledForSheetsIds(): string[] {
  const stored = getItem<string[] | null>(k('enabled-for-sheets'), null);
  if (stored === null) {
    const allIds = getInventory().map((i) => i.id);
    setItem(k('enabled-for-sheets'), allIds);
    return allIds;
  }
  return stored;
}

export function setEnabledForSheetsIds(ids: string[]): void {
  setItem(k('enabled-for-sheets'), ids);
}

export function toggleItemEnabledForSheets(itemId: string): void {
  const enabled = getEnabledForSheetsIds();
  if (enabled.includes(itemId)) {
    setItem(k('enabled-for-sheets'), enabled.filter((id) => id !== itemId));
  } else {
    setItem(k('enabled-for-sheets'), [...enabled, itemId]);
  }
}

export function getEnabledForSheets(): InventoryItem[] {
  const all = getInventory();
  const enabledIds = getEnabledForSheetsIds();
  return all.filter((item) => enabledIds.includes(item.id));
}

// ─── Dual Enable: Inventory ──────────────────────────────────────────────────
export function getEnabledForInventoryIds(): string[] {
  const stored = getItem<string[] | null>(k('enabled-for-inventory'), null);
  if (stored === null) {
    const allIds = getInventory().map((i) => i.id);
    setItem(k('enabled-for-inventory'), allIds);
    return allIds;
  }
  return stored;
}

export function setEnabledForInventoryIds(ids: string[]): void {
  setItem(k('enabled-for-inventory'), ids);
}

export function toggleItemEnabledForInventory(itemId: string): void {
  const enabled = getEnabledForInventoryIds();
  if (enabled.includes(itemId)) {
    setItem(k('enabled-for-inventory'), enabled.filter((id) => id !== itemId));
  } else {
    setItem(k('enabled-for-inventory'), [...enabled, itemId]);
  }
}

export function getEnabledForInventory(): InventoryItem[] {
  const all = getInventory();
  const enabledIds = getEnabledForInventoryIds();
  return all.filter((item) => enabledIds.includes(item.id));
}

// ─── Bubble Config ───────────────────────────────────────────────────────────
export function getBubbleConfig(): BubbleConfig {
  return getItem<BubbleConfig>(k('bubble-config'), { increment: 1, maxQuantity: 30 });
}

export function saveBubbleConfig(config: BubbleConfig): void {
  setItem(k('bubble-config'), config);
}

// ─── Production Entries ──────────────────────────────────────────────────────
export function getProductionEntries(): ProductionEntry[] {
  return getItem<ProductionEntry[]>(k('production-entries'), []);
}

export function saveProductionEntry(entry: ProductionEntry): void {
  const entries = getProductionEntries();
  entries.push(entry);
  setItem(k('production-entries'), entries);
}

export function getProductionEntriesByDate(date: string): ProductionEntry[] {
  return getProductionEntries().filter((e) => e.date === date);
}

export function deleteProductionEntry(id: string): void {
  const entries = getProductionEntries().filter((e) => e.id !== id);
  setItem(k('production-entries'), entries);
}

export function updateProductionEntry(updated: ProductionEntry): void {
  const entries = getProductionEntries();
  const idx = entries.findIndex((e) => e.id === updated.id);
  if (idx >= 0) {
    entries[idx] = updated;
    setItem(k('production-entries'), entries);
  }
}

// ─── Waste Entries ───────────────────────────────────────────────────────────
export function getWasteEntries(): WasteEntry[] {
  return getItem<WasteEntry[]>(k('waste-entries'), []);
}

export function saveWasteEntry(entry: WasteEntry): void {
  const entries = getWasteEntries();
  entries.push(entry);
  setItem(k('waste-entries'), entries);
}

export function getWasteEntriesByDate(date: string): WasteEntry[] {
  return getWasteEntries().filter((e) => e.date === date);
}

export function deleteWasteEntry(id: string): void {
  const entries = getWasteEntries().filter((e) => e.id !== id);
  setItem(k('waste-entries'), entries);
}

export function updateWasteEntry(updated: WasteEntry): void {
  const entries = getWasteEntries();
  const idx = entries.findIndex((e) => e.id === updated.id);
  if (idx >= 0) {
    entries[idx] = updated;
    setItem(k('waste-entries'), entries);
  }
}

// ─── Weekly Counts ───────────────────────────────────────────────────────────
export function getWeeklyCounts(): WeeklyCount[] {
  return getItem<WeeklyCount[]>(k('weekly-counts'), []);
}

export function saveWeeklyCount(count: WeeklyCount): void {
  const counts = getWeeklyCounts();
  const idx = counts.findIndex((c) => c.id === count.id);
  if (idx >= 0) {
    counts[idx] = count;
  } else {
    counts.push(count);
  }
  setItem(k('weekly-counts'), counts);
}

// ─── Location Name (legacy, now derived from store) ──────────────────────────
export function getLocationName(): string {
  return getItem<string>(k('location-name'), '');
}

export function saveLocationName(name: string): void {
  setItem(k('location-name'), name);
}

// ─── Export / Import ─────────────────────────────────────────────────────────
export interface BackupData {
  version: 1;
  storeId?: string;
  exportedAt: string;
  employees: Employee[];
  inventory: InventoryItem[];
  production: ProductionEntry[];
  waste: WasteEntry[];
  weeklyCounts: WeeklyCount[];
  enabledItems?: string[];
  enabledForSheets?: string[];
  enabledForInventory?: string[];
  bubbleConfig?: BubbleConfig;
  locationName?: string;
}

export function exportAllData(): BackupData {
  return {
    version: 1,
    storeId: getCurrentStoreId(),
    exportedAt: new Date().toISOString(),
    employees: getEmployees(),
    inventory: getInventory(),
    production: getProductionEntries(),
    waste: getWasteEntries(),
    weeklyCounts: getWeeklyCounts(),
    enabledItems: getEnabledItemIds(),
    enabledForSheets: getEnabledForSheetsIds(),
    enabledForInventory: getEnabledForInventoryIds(),
    bubbleConfig: getBubbleConfig(),
    locationName: getLocationName(),
  };
}

export function importAllData(data: BackupData): { success: boolean; error?: string } {
  try {
    if (!data || data.version !== 1) {
      return { success: false, error: 'Invalid backup file format' };
    }
    if (data.employees) saveEmployees(data.employees);
    if (data.inventory) saveInventory(data.inventory);
    if (data.production) setItem(k('production-entries'), data.production);
    if (data.waste) setItem(k('waste-entries'), data.waste);
    if (data.weeklyCounts) setItem(k('weekly-counts'), data.weeklyCounts);
    if (data.enabledItems) setItem(k('enabled-items'), data.enabledItems);
    if (data.enabledForSheets) setItem(k('enabled-for-sheets'), data.enabledForSheets);
    if (data.enabledForInventory) setItem(k('enabled-for-inventory'), data.enabledForInventory);
    if (data.bubbleConfig) setItem(k('bubble-config'), data.bubbleConfig);
    if (data.locationName !== undefined) saveLocationName(data.locationName);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Import failed' };
  }
}

export function clearAllData(): void {
  if (typeof window === 'undefined') return;
  const storeId = getCurrentStoreId();
  const prefix = storeId ? `keiths-${storeId}-` : 'keiths-';
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) keysToRemove.push(key);
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

// ─── Inventory Count Session ─────────────────────────────────────────────────
export function getInventoryCounts(): Record<string, number> {
  return getItem<Record<string, number>>(k('inventory-counts'), {});
}

export function saveInventoryCounts(counts: Record<string, number>): void {
  setItem(k('inventory-counts'), counts);
}

export function clearInventoryCounts(): void {
  setItem(k('inventory-counts'), {});
}

// ─── Utilities ───────────────────────────────────────────────────────────────
export function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
