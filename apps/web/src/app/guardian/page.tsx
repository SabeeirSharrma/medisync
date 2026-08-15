"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { GuardianLinkWithUser, GuardianTriggerType, GuardianStatus } from "@medisync/shared";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

const TRIGGER_TYPES = ["minor", "advance_directive", "emergency_incapacity"] as const;

function formatTrigger(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatStatus(status: string): string {
  const colors: Record<string, string> = {
    pending_guardian: "bg-yellow-100 text-yellow-800",
    pending_senior: "bg-blue-100 text-blue-800",
    active_shared_control: "bg-green-100 text-green-800",
    sole_active: "bg-purple-100 text-purple-800",
    denied: "bg-red-100 text-red-800",
    revoked: "bg-gray-100 text-gray-800",
    expired: "bg-gray-100 text-gray-600",
  };
  return `<span class="rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || "bg-gray-100 text-gray-800"}">${status.replace(/_/g, " ")}</span>`;
}

export default function GuardianPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [links, setLinks] = useState<GuardianLinkWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({
    patientEmail: "",
    guardianEmail: "",
    triggerType: "minor" as GuardianTriggerType,
    authorityDocumentRef: "",
  });
  const [newError, setNewError] = useState("");
  const [newLoading, setNewLoading] = useState(false);

  useEffect(() => {
    apiFetch<{ user: User }>("/api/auth/me")
      .then((res) => {
        setUser(res.user);
        return apiFetch<{ guardianLinks: GuardianLinkWithUser[] }>("/api/guardian-links");
      })
      .then((res) => setLinks(res.guardianLinks))
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleNewSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNewError("");
    setNewLoading(true);

    try {
      await apiFetch("/api/guardian-links", {
        method: "POST",
        body: JSON.stringify(newForm),
      });
      router.refresh();
      setShowNew(false);
      setNewForm({ patientEmail: "", guardianEmail: "", triggerType: "minor", authorityDocumentRef: "" });
    } catch (err) {
      setNewError(err instanceof Error ? err.message : "Failed to create guardian link");
    } finally {
      setNewLoading(false);
    }
  }

  async function handleStatusChange(id: string, newStatus: GuardianStatus) {
    if (!confirm(`Change status to ${newStatus.replace(/_/g, " ")}?`)) return;
    setActionLoading(id);
    try {
      await apiFetch(`/api/guardian-links/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      setLinks((prev) =>
        prev.map((l) => (l.id === id ? { ...l, status: newStatus } : l)),
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

  const isPatient = user?.role === "patient";
  const pending = links.filter((l) => l.status.startsWith("pending"));
  const active = links.filter((l) => l.status === "active_shared_control" || l.status === "sole_active");
  const others = links.filter((l) => !pending.includes(l) && !active.includes(l));

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
            <Link href="/emergency-access" className="text-gray-600 hover:text-gray-900">
              Emergency Access
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-medium">Guardian Access</h2>
          {(isPatient || user?.role === "admin") && (
            <button
              onClick={() => setShowNew(true)}
              className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
            >
              Add Guardian
            </button>
          )}
        </div>

        {showNew && (
          <div className="mt-6 rounded-lg border border-purple-200 bg-purple-50 p-4">
            <h3 className="text-sm font-medium text-purple-800 mb-4">
              Add Guardian Link
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
                <label htmlFor="guardian-email" className="mb-1 block text-sm font-medium text-gray-700">
                  Guardian email
                </label>
                <input
                  id="guardian-email"
                  type="email"
                  required
                  value={newForm.guardianEmail}
                  onChange={(e) => setNewForm({ ...newForm, guardianEmail: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="trigger-type" className="mb-1 block text-sm font-medium text-gray-700">
                  Trigger type
                </label>
                <select
                  id="trigger-type"
                  value={newForm.triggerType}
                  onChange={(e) => setNewForm({ ...newForm, triggerType: e.target.value as GuardianTriggerType })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline:none focus:ring-1 focus:ring-blue-500"
                >
                  {TRIGGER_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {formatTrigger(t)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="authority-document" className="mb-1 block text-sm font-medium text-gray-700">
                  Authority document reference (optional)
                </label>
                <input
                  id="authority-document"
                  type="text"
                  value={newForm.authorityDocumentRef}
                  onChange={(e) => setNewForm({ ...newForm, authorityDocumentRef: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              {newError && <p className="text-sm text-red-600">{newError}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={newLoading}
                  className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {newLoading ? "Creating..." : "Create guardian link"}
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

        {pending.length > 0 && (
          <section className="mt-6">
            <h3 className="text-sm font-medium text-gray-700">Pending Approval</h3>
            <div className="mt-3 space-y-3">
              {pending.map((link) => (
                <div
                  key={link.id}
                  className="rounded-lg border border-yellow-200 bg-yellow-50 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {isPatient ? link.guardianName : link.patientName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {isPatient ? link.guardianEmail : link.patientEmail}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Trigger: {formatTrigger(link.triggerType)}
                      </p>
                      {link.authorityDocumentRef && (
                        <p className="mt-1 text-xs text-gray-500">
                          Document: {link.authorityDocumentRef}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {link.status === "pending_guardian" && (
                        <button
                          onClick={() => handleStatusChange(link.id, "pending_senior")}
                          disabled={actionLoading === link.id}
                          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          Approve
                        </button>
                      )}
                      <button
                        onClick={() => handleStatusChange(link.id, "denied")}
                        disabled={actionLoading === link.id}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {active.length > 0 && (
          <section className="mt-8">
            <h3 className="text-sm font-medium text-gray-700">Active Shared Control</h3>
            <div className="mt-3 space-y-3">
              {active.map((link) => (
                <div
                  key={link.id}
                  className="rounded-lg border border-green-200 bg-green-50 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {isPatient ? link.guardianName : link.patientName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {isPatient ? link.guardianEmail : link.patientEmail}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Trigger: {formatTrigger(link.triggerType)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleStatusChange(link.id, "sole_active")}
                        disabled={actionLoading === link.id}
                        className="rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                      >
                        Make Sole
                      </button>
                      <button
                        onClick={() => handleStatusChange(link.id, "revoked")}
                        disabled={actionLoading === link.id}
                        className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        Revoke
                      </button>
                    </div>
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
              {others.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
                >
                  <div>
                    <p className="text-sm">
                      {isPatient ? link.guardianName : link.patientName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatTrigger(link.triggerType)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      link.status === "revoked"
                        ? "bg-yellow-100 text-yellow-800"
                        : link.status === "denied"
                          ? "bg-red-100 text-red-800"
                          : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {link.status.replace(/_/g, " ")}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {links.length === 0 && (
          <p className="mt-8 text-center text-sm text-gray-500">
            No guardian links yet.
          </p>
        )}
      </main>
    </div>
  );
}