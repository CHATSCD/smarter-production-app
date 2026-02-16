'use client';

import React, { useState, useEffect } from 'react';
import { ClipboardCheck, Search, Printer, Save, Package, Plus, Minus, RotateCcw } from 'lucide-react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { CATEGORIES } from '@/data/inventory';
import {
  getEnabledForInventory,
  getLocationName,
  getInventory,
  saveInventory,
  getInventoryCounts,
  saveInventoryCounts,
  clearInventoryCounts,
} from '@/lib/storage';
import { InventoryItem } from '@/types';

export default function CountPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [locationName, setLocationName] = useState('');
  const [countDate, setCountDate] = useState('');

  useEffect(() => {
    setItems(getEnabledForInventory());
    setLocationName(getLocationName());
    setCountDate(new Date().toISOString().split('T')[0]);
    setCounts(getInventoryCounts());
  }, []);

  const handleCountChange = (itemId: string, value: number) => {
    const updated = { ...counts, [itemId]: Math.max(0, value) };
    setCounts(updated);
    saveInventoryCounts(updated);
  };

  const handleClearCounts = () => {
    setCounts({});
    clearInventoryCounts();
  };

  const updateParLevel = (itemId: string, newParLevel: number) => {
    // Update local state
    const updatedItems = items.map((item) =>
      item.id === itemId ? { ...item, parLevel: Math.max(0, newParLevel) } : item
    );
    setItems(updatedItems);

    // Update global inventory
    const allInventory = getInventory();
    const updatedInventory = allInventory.map((item) =>
      item.id === itemId ? { ...item, parLevel: Math.max(0, newParLevel) } : item
    );
    saveInventory(updatedInventory);
  };

  const filteredItems = items.filter((item) => {
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === 'All' || item.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const categories = CATEGORIES.filter((cat) =>
    items.some((item) => item.category === cat)
  );

  const displayCategories = categoryFilter === 'All'
    ? categories
    : [categoryFilter];

  const handlePrint = () => {
    window.print();
  };

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Calculate totals
  const totalItems = filteredItems.length;
  const countedItems = filteredItems.filter((item) => counts[item.id] !== undefined && counts[item.id] >= 0).length;
  const needToOrder = filteredItems.filter((item) => {
    const current = counts[item.id] || 0;
    return current < item.parLevel;
  }).length;

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <Header />
      <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Inventory Count</h2>
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground">
              {countedItems} of {totalItems} counted
            </div>
            {needToOrder > 0 && (
              <div className="text-[10px] text-orange-600 font-medium">
                {needToOrder} below par
              </div>
            )}
          </div>
        </div>

        {/* Summary Card */}
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-900">Count Date</span>
              <span className="text-sm font-medium text-blue-900">{todayFormatted}</span>
            </div>
            {locationName && (
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-900">Location</span>
                <span className="text-sm font-medium text-blue-900">{locationName}</span>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="bg-white rounded p-2 text-center">
                <div className="text-lg font-bold text-blue-900">{totalItems}</div>
                <div className="text-[10px] text-blue-700">Total Items</div>
              </div>
              <div className="bg-white rounded p-2 text-center">
                <div className="text-lg font-bold text-green-900">{countedItems}</div>
                <div className="text-[10px] text-green-700">Counted</div>
              </div>
              <div className="bg-white rounded p-2 text-center">
                <div className="text-lg font-bold text-orange-900">{needToOrder}</div>
                <div className="text-[10px] text-orange-700">Need Order</div>
              </div>
            </div>
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
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </div>

        {items.length === 0 && (
          <Card className="border-2 border-yellow-200 bg-yellow-50">
            <CardContent className="p-3">
              <p className="text-sm font-medium text-yellow-900">No Items Enabled for Inventory!</p>
              <p className="text-xs text-yellow-700 mt-1">
                Go to Store Items to enable items for inventory tracking.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Print / Clear Buttons */}
        {items.length > 0 && (
          <div className="flex gap-2">
            <Button
              onClick={handlePrint}
              className="flex-1 bg-keiths-red hover:bg-keiths-darkRed h-12 text-base"
            >
              <Printer className="h-5 w-5 mr-2" />
              Print Order Sheet
            </Button>
            <Button
              onClick={handleClearCounts}
              variant="outline"
              className="h-12 px-4 text-gray-600 border-gray-300"
              title="Clear all counts"
            >
              <RotateCcw className="h-5 w-5" />
            </Button>
          </div>
        )}

        {/* Items by Category */}
        {displayCategories.map((cat) => {
          const catItems = filteredItems.filter((i) => i.category === cat);
          if (catItems.length === 0) return null;

          return (
            <Card key={cat}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{cat} ({catItems.length})</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-0.5">
                {/* Column Headers */}
                <div className="grid grid-cols-[1fr,50px,80px,60px,60px] gap-2 py-1 border-b mb-2">
                  <span className="text-[10px] font-semibold text-gray-600">Item Name</span>
                  <span className="text-[10px] font-semibold text-gray-600 text-center">Unit</span>
                  <span className="text-[10px] font-semibold text-gray-600 text-center">Par Level</span>
                  <span className="text-[10px] font-semibold text-gray-600 text-center">Count</span>
                  <span className="text-[10px] font-semibold text-gray-600 text-center">Order</span>
                </div>

                {catItems.map((item) => {
                  const currentCount = counts[item.id] || 0;
                  const orderAmount = Math.max(0, item.parLevel - currentCount);
                  const belowPar = currentCount < item.parLevel;

                  return (
                    <div
                      key={item.id}
                      className={`grid grid-cols-[1fr,50px,80px,60px,60px] gap-2 py-1.5 items-center ${
                        belowPar && counts[item.id] !== undefined ? 'bg-orange-50 rounded px-1' : ''
                      }`}
                    >
                      <span className="text-sm truncate pr-2">
                        {item.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground text-center truncate">
                        {item.unit !== 'units' ? item.unit : ''}
                      </span>
                      <div className="flex items-center gap-0.5 justify-center">
                        <button
                          onClick={() => updateParLevel(item.id, item.parLevel - 1)}
                          className="w-5 h-5 rounded border flex items-center justify-center hover:bg-gray-100 no-print"
                        >
                          <Minus className="h-2.5 w-2.5" />
                        </button>
                        <Input
                          type="number"
                          value={item.parLevel}
                          onChange={(e) => updateParLevel(item.id, parseInt(e.target.value) || 0)}
                          className="h-6 w-10 text-center text-xs p-0"
                          min={0}
                        />
                        <button
                          onClick={() => updateParLevel(item.id, item.parLevel + 1)}
                          className="w-5 h-5 rounded border flex items-center justify-center hover:bg-gray-100 no-print"
                        >
                          <Plus className="h-2.5 w-2.5" />
                        </button>
                      </div>
                      <Input
                        type="number"
                        value={counts[item.id] === undefined ? '' : counts[item.id]}
                        onChange={(e) => handleCountChange(item.id, parseInt(e.target.value) || 0)}
                        className="h-7 text-center text-sm"
                        min={0}
                        placeholder="0"
                      />
                      <span
                        className={`text-sm text-center font-medium ${
                          orderAmount > 0 ? 'text-orange-700' : 'text-green-600'
                        }`}
                      >
                        {counts[item.id] !== undefined ? orderAmount : '-'}
                      </span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </main>

      {/* ====== PRINTABLE ORDER SHEET ====== */}
      <div className="print-only">
        <div className="text-center mb-3 border-b pb-2">
          <h1 className="text-lg font-bold">Keith&apos;s Superstores</h1>
          <p className="text-xs text-gray-500 italic">&ldquo;The Fastest And Friendliest&rdquo;</p>
          {locationName && (
            <p className="text-sm font-semibold text-purple-700">{locationName}</p>
          )}
          <h2 className="text-base font-semibold mt-1">INVENTORY COUNT & ORDER SHEET</h2>
          <p className="text-sm">{todayFormatted}</p>
        </div>

        {/* Order Sheet Tables */}
        {displayCategories.map((cat) => {
          const catItems = filteredItems.filter((i) => i.category === cat);
          if (catItems.length === 0) return null;

          return (
            <div key={cat} className="mb-3">
              <h3 className="text-xs font-bold bg-gray-100 px-1 py-0.5 border-b">{cat}</h3>
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr>
                    <th className="text-left py-0.5 px-1 border-b">Item</th>
                    <th className="text-center py-0.5 px-1 border-b w-[40px]">Unit</th>
                    <th className="text-center py-0.5 px-1 border-b w-[40px]">Par</th>
                    <th className="text-center py-0.5 px-1 border-b w-[50px]">Count</th>
                    <th className="text-center py-0.5 px-1 border-b w-[50px]">Order</th>
                  </tr>
                </thead>
                <tbody>
                  {catItems.map((item) => {
                    const currentCount = counts[item.id] || 0;
                    const orderAmount = counts[item.id] !== undefined ? Math.max(0, item.parLevel - currentCount) : 0;
                    const belowPar = currentCount < item.parLevel;

                    return (
                      <tr key={item.id} className={`border-b border-gray-100 ${belowPar && counts[item.id] !== undefined ? 'bg-orange-50' : ''}`}>
                        <td className="py-1 px-1 text-[10px]">{item.name}</td>
                        <td className="text-center py-1 px-1 text-gray-500">{item.unit !== 'units' ? item.unit : ''}</td>
                        <td className="text-center py-1 px-1">{item.parLevel}</td>
                        <td className="text-center py-1 px-1 font-medium">
                          {counts[item.id] !== undefined ? counts[item.id] : '___'}
                        </td>
                        <td className="text-center py-1 px-1 font-bold">
                          {counts[item.id] !== undefined && orderAmount > 0 ? orderAmount : ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}

        <div className="mt-4 text-[9px] text-gray-500 text-center">
          Par = Target inventory level | Count = Current inventory | Order = Suggested order amount | Unit = Order unit of measure
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
