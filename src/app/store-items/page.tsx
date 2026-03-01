'use client';

import React, { useState, useEffect } from 'react';
import { Search, Plus, Trash2, Check, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { CATEGORIES } from '@/data/inventory';
import {
  getInventory,
  getEnabledForSheetsIds,
  setEnabledForSheetsIds,
  toggleItemEnabledForSheets,
  getEnabledForInventoryIds,
  setEnabledForInventoryIds,
  toggleItemEnabledForInventory,
  addCustomItem,
  deleteCustomItem,
  generateId,
  getLocationName,
  saveLocationName,
  saveInventory,
} from '@/lib/storage';
import { InventoryItem } from '@/types';

export default function StoreItemsPage() {
  const [allItems, setAllItems] = useState<InventoryItem[]>([]);
  const [enabledForSheets, setLocalEnabledForSheets] = useState<string[]>([]);
  const [enabledForInventory, setLocalEnabledForInventory] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState(CATEGORIES[0]);
  const [newUnit, setNewUnit] = useState('units');
  const [locationName, setLocationName] = useState('');
  const [trainingOpen, setTrainingOpen] = useState<string | null>(null);
  const [trainingDraft, setTrainingDraft] = useState<Partial<import('@/types').InventoryItem>>({});

  const reload = () => {
    setAllItems(getInventory());
    setLocalEnabledForSheets(getEnabledForSheetsIds());
    setLocalEnabledForInventory(getEnabledForInventoryIds());
    setLocationName(getLocationName());
  };

  useEffect(() => {
    reload();
  }, []);

  const handleLocationNameChange = (name: string) => {
    setLocationName(name);
    saveLocationName(name);
  };

  const filteredItems = allItems.filter((item) => {
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === 'All' || item.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const categoriesWithItems = CATEGORIES.filter((cat) =>
    allItems.some((item) => item.category === cat)
  );

  const sheetsEnabledCount = enabledForSheets.length;
  const inventoryEnabledCount = enabledForInventory.length;
  const totalCount = allItems.length;

  const handleToggleSheets = (itemId: string) => {
    toggleItemEnabledForSheets(itemId);
    setLocalEnabledForSheets(getEnabledForSheetsIds());
  };

  const handleToggleInventory = (itemId: string) => {
    toggleItemEnabledForInventory(itemId);
    setLocalEnabledForInventory(getEnabledForInventoryIds());
  };

  const handleToggleCategorySheets = (category: string) => {
    const categoryItems = allItems.filter((item) => item.category === category);
    const categoryItemIds = categoryItems.map((item) => item.id);
    const allEnabled = categoryItemIds.every((id) => enabledForSheets.includes(id));

    let newEnabledIds: string[];
    if (allEnabled) {
      // Disable all items in this category
      newEnabledIds = enabledForSheets.filter((id) => !categoryItemIds.includes(id));
    } else {
      // Enable all items in this category
      newEnabledIds = [...new Set([...enabledForSheets, ...categoryItemIds])];
    }
    setEnabledForSheetsIds(newEnabledIds);
    setLocalEnabledForSheets(newEnabledIds);
  };

  const handleToggleCategoryInventory = (category: string) => {
    const categoryItems = allItems.filter((item) => item.category === category);
    const categoryItemIds = categoryItems.map((item) => item.id);
    const allEnabled = categoryItemIds.every((id) => enabledForInventory.includes(id));

    let newEnabledIds: string[];
    if (allEnabled) {
      // Disable all items in this category
      newEnabledIds = enabledForInventory.filter((id) => !categoryItemIds.includes(id));
    } else {
      // Enable all items in this category
      newEnabledIds = [...new Set([...enabledForInventory, ...categoryItemIds])];
    }
    setEnabledForInventoryIds(newEnabledIds);
    setLocalEnabledForInventory(newEnabledIds);
  };

  const handleAddCustom = () => {
    if (!newName.trim()) return;
    const item: InventoryItem = {
      id: `custom-${generateId()}`,
      name: newName.trim(),
      category: newCategory,
      parLevel: 10,
      unit: newUnit,
      custom: true,
    };
    addCustomItem(item);
    // Auto-enable for both sheets and inventory
    const newSheetsIds = [...getEnabledForSheetsIds(), item.id];
    setEnabledForSheetsIds(newSheetsIds);
    const newInventoryIds = [...getEnabledForInventoryIds(), item.id];
    setEnabledForInventoryIds(newInventoryIds);
    reload();
    setNewName('');
    setShowAdd(false);
  };

  const openTraining = (item: import('@/types').InventoryItem) => {
    setTrainingOpen(item.id);
    setTrainingDraft({
      trainingNote: item.trainingNote || '',
      targetQtyAM: item.targetQtyAM,
      targetQtyPM: item.targetQtyPM,
      targetQtyNight: item.targetQtyNight,
      shelfLifeHours: item.shelfLifeHours,
    });
  };

  const saveTraining = (itemId: string) => {
    const inv = getInventory();
    const updated = inv.map((i) => i.id === itemId ? { ...i, ...trainingDraft } : i);
    saveInventory(updated);
    setTrainingOpen(null);
    reload();
  };

  const handleDeleteCustom = (id: string) => {
    deleteCustomItem(id);
    reload();
  };

  // Group by category for display
  const displayCategories = categoryFilter === 'All'
    ? categoriesWithItems
    : [categoryFilter];

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <Header />
      <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Store Items</h2>
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground">Sheets: {sheetsEnabledCount}</div>
            <div className="text-[10px] text-muted-foreground">Inventory: {inventoryEnabledCount}</div>
          </div>
        </div>

        {/* Location Name */}
        <Card className="border-2 border-purple-200 bg-purple-50">
          <CardContent className="p-3 space-y-2">
            <label className="text-xs font-semibold text-purple-900">
              Location/Store Name
            </label>
            <Input
              type="text"
              placeholder="Enter your store name or number..."
              value={locationName}
              onChange={(e) => handleLocationNameChange(e.target.value)}
              className="bg-white"
            />
            <p className="text-[10px] text-purple-700">
              <strong>Sheets:</strong> Items that appear on production/waste sheets (items you cook/prepare).<br/>
              <strong>Inventory:</strong> All items you track/order (includes supplies, ingredients, etc).
            </p>
          </CardContent>
        </Card>

        {/* Search & Filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-36"
          >
            <option value="All">All</option>
            {categoriesWithItems.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </div>

        {/* Add Custom Item */}
        <Button
          onClick={() => setShowAdd(!showAdd)}
          variant="outline"
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Custom Item
        </Button>

        {showAdd && (
          <Card className="border-2 border-keiths-red">
            <CardContent className="p-3 space-y-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Item name"
                autoFocus
              />
              <div className="flex gap-2">
                <Select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="flex-1"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
                <Input
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                  placeholder="Unit"
                  className="w-24"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setShowAdd(false)} variant="outline" className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleAddCustom}
                  className="flex-1 bg-keiths-red hover:bg-keiths-darkRed"
                  disabled={!newName.trim()}
                >
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Items by Category */}
        {displayCategories.map((cat) => {
          const catItems = filteredItems.filter((i) => i.category === cat);
          if (catItems.length === 0) return null;

          const categoryItemIds = catItems.map((i) => i.id);
          const allSheetsEnabled = categoryItemIds.every((id) => enabledForSheets.includes(id));
          const allInventoryEnabled = categoryItemIds.every((id) => enabledForInventory.includes(id));

          return (
            <Card key={cat}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{cat} ({catItems.length})</CardTitle>
                  <div className="flex items-center gap-2">
                    {/* Category Sheets Toggle */}
                    <button
                      onClick={() => handleToggleCategorySheets(cat)}
                      className={`relative w-10 h-5 rounded-full transition-colors ${
                        allSheetsEnabled ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                      title={`Toggle all ${cat} items for Sheets`}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                          allSheetsEnabled ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                    {/* Category Inventory Toggle */}
                    <button
                      onClick={() => handleToggleCategoryInventory(cat)}
                      className={`relative w-10 h-5 rounded-full transition-colors ${
                        allInventoryEnabled ? 'bg-blue-500' : 'bg-gray-300'
                      }`}
                      title={`Toggle all ${cat} items for Inventory`}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                          allInventoryEnabled ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-0.5">
                {/* Column Headers */}
                <div className="flex items-center justify-between py-1 border-b mb-2">
                  <span className="text-[10px] font-semibold text-gray-600 flex-1">Item Name</span>
                  <div className="flex items-center gap-2 text-[10px] font-semibold text-gray-600">
                    <span className="w-20 text-center">Supplier</span>
                    <span className="w-10 text-center">Sheets</span>
                    <span className="w-10 text-center">Inventory</span>
                  </div>
                </div>

                {catItems.map((item) => {
                  const forSheets = enabledForSheets.includes(item.id);
                  const forInventory = enabledForInventory.includes(item.id);

                  const handleSupplierChange = (itemId: string, newSupplier: string) => {
                    const inv = getInventory();
                    const updated = inv.map((i) => i.id === itemId ? { ...i, supplier: newSupplier } : i);
                    saveInventory(updated);
                    reload();
                  };

                  return (
                    <React.Fragment key={item.id}>
                    <div
                      className="flex items-center justify-between py-1.5"
                    >
                      <span className="text-sm flex-1 truncate pr-2">
                        {item.name}
                        {item.custom && (
                          <span className="text-[10px] ml-1 text-purple-500">(custom)</span>
                        )}
                      </span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {item.custom && (
                          <button
                            onClick={() => handleDeleteCustom(item.id)}
                            className="text-red-400 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {/* Supplier Dropdown */}
                        <select
                          value={item.supplier || 'Merchants'}
                          onChange={(e) => handleSupplierChange(item.id, e.target.value)}
                          className="w-20 text-[10px] border rounded px-1 py-0.5"
                          title="Select supplier"
                        >
                          <option value="Merchants">Merchants</option>
                          <option value="Schneider's">Schneider&apos;s</option>
                          <option value="Other">Other</option>
                        </select>
                        {/* Sheets Toggle */}
                        <button
                          onClick={() => handleToggleSheets(item.id)}
                          className={`relative w-10 h-5 rounded-full transition-colors ${
                            forSheets ? 'bg-green-500' : 'bg-gray-300'
                          }`}
                          title="Enable for Production/Waste Sheets"
                        >
                          <span
                            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                              forSheets ? 'translate-x-5' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                        {/* Inventory Toggle */}
                        <button
                          onClick={() => handleToggleInventory(item.id)}
                          className={`relative w-10 h-5 rounded-full transition-colors ${
                            forInventory ? 'bg-blue-500' : 'bg-gray-300'
                          }`}
                          title="Enable for Inventory/Ordering"
                        >
                          <span
                            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                              forInventory ? 'translate-x-5' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                        {/* Training button */}
                        <button
                          onClick={() => trainingOpen === item.id ? setTrainingOpen(null) : openTraining(item)}
                          className={`p-1 rounded ${trainingOpen === item.id ? 'text-purple-600' : 'text-gray-300 hover:text-purple-400'}`}
                          title="Training mode"
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Training Panel */}
                    {trainingOpen === item.id && (
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mt-1 mb-2 space-y-2">
                        <p className="text-xs font-bold text-purple-800 flex items-center gap-1">
                          <BookOpen className="h-3 w-3" /> Training Mode — {item.name}
                        </p>
                        <div>
                          <label className="text-[10px] font-semibold text-purple-700">Training Note / SOP</label>
                          <textarea
                            value={trainingDraft.trainingNote || ''}
                            onChange={(e) => setTrainingDraft({ ...trainingDraft, trainingNote: e.target.value })}
                            placeholder="Tips, shelf life reminders, common mistakes, SOP steps..."
                            className="w-full border rounded p-1.5 text-xs mt-0.5 min-h-[60px]"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {(['AM', 'PM', 'Night'] as const).map((shift) => {
                            const key = `targetQty${shift}` as 'targetQtyAM' | 'targetQtyPM' | 'targetQtyNight';
                            return (
                              <div key={shift}>
                                <label className="text-[10px] font-semibold text-purple-700">{shift} Target</label>
                                <input
                                  type="number"
                                  value={trainingDraft[key] || ''}
                                  onChange={(e) => setTrainingDraft({ ...trainingDraft, [key]: parseInt(e.target.value) || undefined })}
                                  className="w-full border rounded px-2 py-1 text-xs mt-0.5"
                                  placeholder="qty"
                                  min={0}
                                />
                              </div>
                            );
                          })}
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-purple-700">Shelf Life (hours)</label>
                          <input
                            type="number"
                            value={trainingDraft.shelfLifeHours || ''}
                            onChange={(e) => setTrainingDraft({ ...trainingDraft, shelfLifeHours: parseInt(e.target.value) || undefined })}
                            className="w-full border rounded px-2 py-1 text-xs mt-0.5"
                            placeholder="e.g. 4"
                            min={1}
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveTraining(item.id)}
                            className="flex-1 bg-purple-600 text-white py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1"
                          >
                            <Check className="h-3 w-3" /> Save
                          </button>
                          <button
                            onClick={() => setTrainingOpen(null)}
                            className="flex-1 border py-1.5 rounded text-xs text-gray-600"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    </React.Fragment>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </main>
      <BottomNav />
    </div>
  );
}
