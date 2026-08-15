"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

const RECORD_TYPES = [
  "prescription",
  "lab_result",
  "checkup",
  "surgery",
  "imaging",
  "other",
] as const;

export default function NewAccessRequestPage() {
  const router = useRouter();
  const [patientEmail, setPatientEmail] = useState("");
  const [scopeType, setScopeType] = useState<"full" | "category" | "date" | "category_date">("full");
  const [categories, setCategories] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function toggleCategory(cat: string) {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const scope: Record<string, unknown> = {};

      if (scopeType === "category" || scopeType === "category_date") {
        scope.categories = categories.length > 0 ? categories : null;
      }
      if (scopeType === "date" || scopeType === "category_date") {
        scope.dateFrom = dateFrom || null;
        scope.dateTo = dateTo || null;
      }

      await apiFetch("/api/access-requests", {
        method: "POST",
        body: JSON.stringify({ patientEmail, scope }),
      });

      router.push("/access-requests");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-semibold">MediSync</h1>
          <Link href="/access-requests" className="text-sm text-gray-600 hover:text-gray-900">
            Back to requests
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <h2 className="text-xl font-medium">Request Patient Access</h2>
        <p className="mt-1 text-sm text-gray-500">
          Enter the patient&apos;s email to request access to their medical records.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 max-w-md space-y-6">
          <div>
            <label htmlFor="patient-email" className="mb-1 block text-sm font-medium text-gray-700">
              Patient email
            </label>
            <input
              id="patient-email"
              type="email"
              required
              value={patientEmail}
              onChange={(e) => setPatientEmail(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Access scope
            </label>
            <div className="grid grid-cols-2 gap-2">
              {([
                ["full", "Full access"],
                ["category", "Specific types"],
                ["date", "Date range"],
                ["category_date", "Types + dates"],
              ] as const).map(([value, label]) => (
                <label
                  key={value}
                  className={`cursor-pointer rounded-md border px-3 py-2 text-center text-sm font-medium transition ${
                    scopeType === value
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-gray-300 text-gray-600 hover:border-gray-400"
                  }`}
                >
                  <input
                    type="radio"
                    name="scopeType"
                    value={value}
                    checked={scopeType === value}
                    onChange={() => setScopeType(value)}
                    className="sr-only"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {(scopeType === "category" || scopeType === "category_date") && (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Record types
              </label>
              <div className="flex flex-wrap gap-2">
                {RECORD_TYPES.map((cat) => (
                  <label
                    key={cat}
                    className={`cursor-pointer rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                      categories.includes(cat)
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-gray-300 text-gray-600 hover:border-gray-400"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={categories.includes(cat)}
                      onChange={() => toggleCategory(cat)}
                      className="sr-only"
                    />
                    {cat.replace("_", " ")}
                  </label>
                ))}
              </div>
            </div>
          )}

          {(scopeType === "date" || scopeType === "category_date") && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="date-from" className="mb-1 block text-sm font-medium text-gray-700">
                  From
                </label>
                <input
                  id="date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="date-to" className="mb-1 block text-sm font-medium text-gray-700">
                  To
                </label>
                <input
                  id="date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? "Sending request..." : "Request access"}
          </button>
        </form>
      </main>
    </div>
  );
}
