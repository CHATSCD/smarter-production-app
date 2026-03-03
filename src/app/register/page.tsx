'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, Mail, Building2, User, Store } from 'lucide-react';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    companyName: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    storeName: '',
  });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function updateField(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    // Validation
    if (formData.adminPassword.length < 8) {
      setError('Password must be at least 8 characters');
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed');
        setSubmitting(false);
        return;
      }

      // Success! Redirect to login with success message
      router.push('/login?registered=true&email=' + encodeURIComponent(formData.adminEmail));
    } catch (err) {
      setError('Network error. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-600 via-red-700 to-red-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-white text-3xl">🔥</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Run DAT Kitchen</h1>
          <p className="text-sm text-gray-500 mt-1">Start your 14-day free trial</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Company Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Restaurant/Company Name
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => updateField('companyName', e.target.value)}
                required
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Café Beignet"
              />
            </div>
          </div>

          {/* Admin Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={formData.adminName}
                onChange={(e) => updateField('adminName', e.target.value)}
                required
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Jacques Leblanc"
              />
            </div>
          </div>

          {/* Admin Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="email"
                value={formData.adminEmail}
                onChange={(e) => updateField('adminEmail', e.target.value)}
                required
                autoComplete="email"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="you@yourrestaurant.com"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type={showPw ? 'text' : 'password'}
                value={formData.adminPassword}
                onChange={(e) => updateField('adminPassword', e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Minimum 8 characters</p>
          </div>

          {/* Store Name (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Location Name <span className="text-gray-400">(optional)</span>
            </label>
            <div className="relative">
              <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={formData.storeName}
                onChange={(e) => updateField('storeName', e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Downtown Location"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white py-2.5 rounded-lg font-semibold text-sm hover:from-orange-600 hover:to-red-700 transition-all disabled:opacity-60 shadow-lg"
          >
            {submitting ? 'Creating your account…' : 'Start Free Trial'}
          </button>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <p className="text-xs text-orange-900">
              ✨ <strong>Free 14-day trial</strong> — No credit card required
            </p>
            <p className="text-xs text-orange-700 mt-1">
              Then $0/month for up to 5 employees
            </p>
          </div>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <Link href="/login" className="text-orange-600 font-semibold hover:text-orange-700">
              Sign in
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          🌶️ Let dat data cook! Built with Cajun spice.
        </p>
      </div>
    </div>
  );
}
