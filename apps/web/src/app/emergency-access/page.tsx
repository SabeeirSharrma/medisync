"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { EmergencyAccessWithUser, EmergencyAccessReasonCode } from "@medisync/shared";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

const REASON_CODES = [
  "cardiac_arrest",
  "stroke",
  "trauma",
  "unconscious",
  "severe_bleeding",
  "respiratory_failure",
  "sepsis",
  "other",
] as const;

function formatReason(code: string): string {
  return code.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function EmergencyAccessPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [accesses, setAccesses] = useState<EmergencyAccessWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({
    patientEmail: "",
    reasonCode: "cardiac_arrest" as EmergencyAccessReasonCode,
    reasonText: "",
  });
  const [newError, setNewError] = useState("");
  const [newLoading, setNewLoading] = useState(false);

  useEffect(() => {
    apiFetch<{ user: User }>("/api/auth/me")
      .then((res) => {
        setUser(res.user);
        return apiFetch<{ emergencyAccesses: EmergencyAccessWithUser[] }>(
          "/api/emergency-access",
        );
      })
      .then((res) => setAccesses(res.emergencyAccesses))
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleNewSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNewError("");
    setNewLoading(true);

    try {
      await apiFetch("/api/emergency-access", {
        method: "POST",
        body: JSON.stringify(newForm),
      });
      router.refresh();
      setShowNew(false);
      setNewForm({ patientEmail: "", reasonCode: "cardiac_arrest", reasonText: "" });
    } catch (err) {
      setNewError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setNewLoading(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm("Revoke this emergency access?")) return;
    setActionLoading(id);
    try {
      await apiFetch(`/api/emergency-access/${id}/revoke`, { method: "PATCH" });
      setAccesses((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "revoked" as const } : a)),
      );
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    );
  }

  const isDoctor = user?.role === "doctor";
  const active = accesses.filter((a) => a.status === "active");
  const others = accesses.filter((a) => a.status !== "active");

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-semibold">MediSync</h1>
          <div className="flex gap-4 text-sm">
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
              Dashboard
            </Link>
            <Link href="/records" className="text-gray-600 hover:text-gray-900">
              Records
            </Link>
            <Link href="/access-requests" className="text-gray-600 hover:text-gray-900">
              Access Requests
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-medium">Emergency Access (Break-Glass)</h2>
          {isDoctor && (
            <button
              onClick={() => setShowNew(true)}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Invoke Break-Glass
            </button>
          )}
        </div>

        {showNew && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <h3 className="text-sm font-medium text-red-800 mb-4">
              Invoke Emergency Access (Break-Glass)
            </h3>
            <form onSubmit={handleNewSubmit} className="space-y-4 max-w-md">
              <div>
                <label htmlFor="patient-email" className="mb-1 block text-sm font-medium text-gray-700">
                  Patient email
                </label>
                <input
                  id="patient-email"
                  type="email"
                  required
                  value={newForm.patientEmail}
                  onChange={(e) => setNewForm({ ...newForm, patientEmail: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="reason-code" className="mb-1 block text-sm font-medium text-gray-700">
                  Reason code
                </label>
                <select
                  id="reason-code"
                  value={newForm.reasonCode}
                  onChange={(e) => setNewForm({ ...newForm, reasonCode: e.target.value as EmergencyAccessReasonCode })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {REASON_CODES.map((code) => (
                    <option key={code} value={code}>
                      {formatReason(code)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="reason-text" className="mb-1 block text-sm font-medium text-gray-700">
                  Reason description (min 10 chars)
                </label>
                <textarea
                  id="reason-text"
                  required
                  minLength={10}
                  rows={3}
                  value={newForm.reasonText}
                  onChange={(e) => setNewForm({ ...newForm, reasonText: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              {newError && <p className="text-sm text-red-600">{newError}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={newLoading}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {newLoading ? "Invoking..." : "Invoke emergency access"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNew(false)}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {active.length > 0 && (
          <section className="mt-6">
            <h3 className="text-sm font-medium text-gray-700">Active Emergency Access</h3>
            <div className="mt-3 space-y-3">
              {active.map((req) => (
                <div
                  key={req.id}
                  className="rounded-lg border border-red-200 bg-red-50 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {isDoctor ? req.patientName : req.doctorName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {isDoctor ? req.patientEmail : req.doctorEmail}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Reason: {formatReason(req.reasonCode)} — {req.reasonText}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Granted: {new Date(req.grantedAt).toLocaleString()} | Expires: {new Date(req.expiresAt).toLocaleString()}
                      </p>
                    </div>
                    {!isDoctor && (
                      <button
                        onClick={() => handleRevoke(req.id)}
                        disabled={actionLoading === req.id}
                        className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {others.length > 0 && (
          <section className="mt-8">
            <h3 className="text-sm font-medium text-gray-700">History</h3>
            <div className="mt-3 space-y-2">
              {others.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
                >
                  <div>
                    <p className="text-sm">
                      {isDoctor ? req.patientName : req.doctorName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatReason(req.reasonCode)} — {new Date(req.grantedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      req.status === "revoked"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {req.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {accesses.length === 0 && (
          <p className="mt-8 text-center text-sm text-gray-500">
            No emergency access events yet.
          </p>
        )}
      </main>
    </div>
  );
}