'use client';

import React, { useState, useEffect } from 'react';
import { Printer, Settings } from 'lucide-react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import QRCodeCanvas from '@/components/QRCodeCanvas';
import { CATEGORIES } from '@/data/inventory';
import {
  getEnabledForSheets,
  getBubbleConfig,
  saveBubbleConfig,
  getTodayStr,
  getLocationName,
} from '@/lib/storage';
import { InventoryItem, BubbleConfig, WASTE_REASONS } from '@/types';

export default function PrintPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [config, setConfig] = useState<BubbleConfig>({ increment: 1, maxQuantity: 30 });
  const [formType, setFormType] = useState<'production' | 'waste'>('production');
  const [showConfig, setShowConfig] = useState(false);
  const [employeeName, setEmployeeName] = useState('');
  const [shift, setShift] = useState<'AM' | 'PM' | 'Night'>('AM');
  const [locationName, setLocationName] = useState('');

  useEffect(() => {
    setItems(getEnabledForSheets());
    setConfig(getBubbleConfig());
    setLocationName(getLocationName());
  }, []);

  const handleConfigChange = (field: keyof BubbleConfig, value: number) => {
    const updated = { ...config, [field]: Math.max(1, value) };
    setConfig(updated);
    saveBubbleConfig(updated);
  };

  const handleDownloadPDF = async () => {
  const element = document.querySelector('.print-only') as HTMLElement;
  if (!element) return;

  const html2pdf = (await import('html2pdf.js')).default;

  const opt = {
    margin: 0.25,
    filename: `${formType}-${getTodayStr()}.pdf`,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'in' as const, format: 'letter' as const, orientation: 'portrait' as const },
  };

  await html2pdf().set(opt).from(element).save();
};
const handlePrint = () => {
    window.print();
  };

  const categories = CATEGORIES.filter((cat) =>
    items.some((item) => item.category === cat)
  );

  const bubbleCount = Math.ceil(config.maxQuantity / config.increment);
  const bubbleValues = Array.from({ length: bubbleCount }, (_, i) => (i + 1) * config.increment);

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <Header />
      <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
        <h2 className="text-lg font-bold">Print Forms</h2>

        {/* Form Type Selector */}
        <div className="flex gap-2">
          <button
            onClick={() => setFormType('production')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
              formType === 'production'
                ? 'bg-green-600 text-white border-green-600'
                : 'bg-white text-gray-700 border-gray-200'
            }`}
          >
            Production Form
          </button>
          <button
            onClick={() => setFormType('waste')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
              formType === 'waste'
                ? 'bg-red-600 text-white border-red-600'
                : 'bg-white text-gray-700 border-gray-200'
            }`}
          >
            Waste Form
          </button>
        </div>

        {/* Employee Info */}
        <Card className="border-2 border-blue-200">
          <CardContent className="p-3 space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Employee Name</label>
            <Input
              type="text"
              placeholder="Enter employee name"
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
            />
            <label className="text-xs font-medium text-muted-foreground">Shift</label>
            <div className="flex gap-2">
              <button
                onClick={() => setShift('AM')}
                className={`flex-1 py-2 rounded text-sm font-medium border transition-colors ${
                  shift === 'AM'
                    ? 'bg-keiths-red text-white border-keiths-red'
                    : 'bg-white text-gray-700 border-gray-200'
                }`}
              >
                AM
              </button>
              <button
                onClick={() => setShift('PM')}
                className={`flex-1 py-2 rounded text-sm font-medium border transition-colors ${
                  shift === 'PM'
                    ? 'bg-keiths-red text-white border-keiths-red'
                    : 'bg-white text-gray-700 border-gray-200'
                }`}
              >
                PM
              </button>
              <button
                onClick={() => setShift('Night')}
                className={`flex-1 py-2 rounded text-sm font-medium border transition-colors ${
                  shift === 'Night'
                    ? 'bg-keiths-red text-white border-keiths-red'
                    : 'bg-white text-gray-700 border-gray-200'
                }`}
              >
                Night
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Config */}
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setShowConfig(!showConfig)}
        >
          <Settings className="h-4 w-4 mr-2" />
          Bubble Settings
        </Button>

        {showConfig && (
          <Card className="border-2 border-blue-200">
            <CardContent className="p-3 space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Bubble Increment</label>
                <Input
                  type="number"
                  value={config.increment}
                  onChange={(e) => handleConfigChange('increment', parseInt(e.target.value) || 1)}
                  min={1}
                  className="mt-1"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Each bubble represents this many units (e.g., 1, 5, 10)
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Max Quantity</label>
                <Input
                  type="number"
                  value={config.maxQuantity}
                  onChange={(e) => handleConfigChange('maxQuantity', parseInt(e.target.value) || 10)}
                  min={1}
                  className="mt-1"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Maximum quantity shown on each row
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Preview: {bubbleCount} bubbles per row ({bubbleValues.slice(0, 5).join(', ')}
                {bubbleCount > 5 ? `, ...${bubbleValues[bubbleCount - 1]}` : ''})
              </p>
            </CardContent>
          </Card>
        )}

        {/* Preview */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Preview</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <p>{items.length} enabled items across {categories.length} categories</p>
            <p>{bubbleCount} bubbles per row, increment of {config.increment}</p>
            {formType === 'waste' && <p>Includes REASON column with code legend</p>}
            {locationName && <p className="font-semibold text-purple-700 mt-1">Location: {locationName}</p>}
          </CardContent>
        </Card>

        {items.length === 0 && (
          <Card className="border-2 border-yellow-200 bg-yellow-50">
            <CardContent className="p-3">
              <p className="text-sm font-medium text-yellow-900">No Items Enabled!</p>
              <p className="text-xs text-yellow-700 mt-1">
                Go to Store Items to enable the items available at your location. Only enabled items will appear on your sheets.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Print Button */}
        <Button
  onClick={handleDownloadPDF}
  className="w-full bg-keiths-red hover:bg-keiths-darkRed h-12 text-base"
>
          <Printer className="h-5 w-5 mr-2" />
          Print {formType === 'production' ? 'Production' : 'Waste'} Form
        </Button>
      </main>

      {/* ====== PRINTABLE BUBBLE SHEET ====== */}
      <div className="print-only">
        <div className="text-center mb-3 border-b pb-2">
          <div className="flex justify-between items-start">
            <div className="flex-1" />
            <div className="text-center flex-1">
              <h1 className="text-lg font-bold">Keith&apos;s Superstores</h1>
              <p className="text-xs text-gray-500 italic">&ldquo;The Fastest And Friendliest&rdquo;</p>
              {locationName && (
                <p className="text-sm font-semibold text-purple-700">{locationName}</p>
              )}
              <h2 className="text-base font-semibold mt-1">
                {formType === 'production' ? 'PRODUCTION SHEET' : 'WASTE SHEET'}
              </h2>
              <p className="text-sm">{todayFormatted}</p>
            </div>
            <div className="flex-1 flex justify-end">
              <QRCodeCanvas
                data={JSON.stringify({
                  type: formType,
                  employeeName: employeeName,
                  shift: shift,
                  date: getTodayStr(),
                  items: items.length,
                  increment: config.increment,
                  maxQty: config.maxQuantity,
                })}
                size={64}
              />
            </div>
          </div>
          <div className="flex gap-8 mt-2 text-sm">
            <div className="flex-1 border-b border-black pb-1 text-left">
              <strong>Employee:</strong> {employeeName || '_________________________'}
            </div>
            <div className="border-b border-black pb-1">
              <strong>Shift:</strong> {shift || 'AM / PM / ON'}
            </div>
          </div>
        </div>

        {/* Waste Reason Legend */}
        {formType === 'waste' && (
          <div className="mb-2 text-[9px] border rounded p-1.5">
            <strong>REASON CODES:</strong>{' '}
            {WASTE_REASONS.map((r) => (
              <span key={r.code} className="mr-2">
                <strong>{r.short}</strong>={r.label}
              </span>
            ))}
          </div>
        )}

        {/* Bubble Sheet Tables */}
        {categories.map((cat) => {
          const catItems = items.filter((i) => i.category === cat);
          if (catItems.length === 0) return null;

          return (
            <div key={cat} className="mb-3">
              <h3 className="text-xs font-bold bg-gray-100 px-1 py-0.5 border-b">{cat}</h3>
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr>
                    <th className="text-left py-0.5 px-1 border-b w-[140px]">Item</th>
                    {bubbleValues.map((v) => (
                      <th key={v} className="text-center py-0.5 px-0 border-b w-[18px]">
                        {v}
                      </th>
                    ))}
                    {formType === 'waste' && (
                      <th className="text-center py-0.5 px-1 border-b w-[40px]">REASON</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {catItems.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100">
                      <td className="py-1 px-1 text-[10px]">{item.name}</td>
                      {bubbleValues.map((v) => (
                        <td key={v} className="text-center py-1 px-0">
                          <span className="inline-block w-3.5 h-3.5 rounded-full border border-gray-400" />
                        </td>
                      ))}
                      {formType === 'waste' && (
                        <td className="text-center py-1 px-1">
                          <span className="inline-block w-full border-b border-gray-400 text-[9px]">&nbsp;</span>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}

        <div className="mt-4 text-[9px] text-gray-500 text-center">
          Fill in bubbles to indicate quantity. {formType === 'waste' && 'Write reason code in REASON column.'}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
