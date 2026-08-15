"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { AccessRequestWithUser } from "@medisync/shared";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Scope {
  categories?: string[] | null;
  dateFrom?: string | null;
  dateTo?: string | null;
}

function formatScope(scope: Scope): string {
  const parts: string[] = [];
  if (scope.categories && scope.categories.length > 0) {
    parts.push(scope.categories.join(", "));
  } else {
    parts.push("All types");
  }
  if (scope.dateFrom || scope.dateTo) {
    const from = scope.dateFrom ?? "start";
    const to = scope.dateTo ?? "now";
    parts.push(`${from} to ${to}`);
  }
  return parts.join(" | ");
}

export default function AccessRequestsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [requests, setRequests] = useState<AccessRequestWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ user: User }>("/api/auth/me")
      .then((res) => {
        setUser(res.user);
        return apiFetch<{ accessRequests: AccessRequestWithUser[] }>(
          "/api/access-requests",
        );
      })
      .then((res) => setRequests(res.accessRequests))
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleApprove(id: string, scope: Scope) {
    setActionLoading(id);
    try {
      await apiFetch(`/api/access-requests/${id}/approve`, {
        method: "PATCH",
        body: JSON.stringify({ scope }),
      });
      setRequests((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, status: "approved" as const, scope } : r,
        ),
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeny(id: string) {
    setActionLoading(id);
    try {
      await apiFetch(`/api/access-requests/${id}/deny`, { method: "PATCH" });
      setRequests((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, status: "denied" as const } : r,
        ),
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRevoke(id: string) {
    setActionLoading(id);
    try {
      await apiFetch(`/api/access-requests/${id}/revoke`, { method: "PATCH" });
      setRequests((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, status: "revoked" as const } : r,
        ),
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
  const pending = requests.filter((r) => r.status === "pending");
  const others = requests.filter((r) => r.status !== "pending");

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
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-medium">Access Requests</h2>
          {isDoctor && (
            <Link
              href="/access-requests/new"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Request Access
            </Link>
          )}
        </div>

        {pending.length > 0 && (
          <section className="mt-6">
            <h3 className="text-sm font-medium text-gray-700">Pending</h3>
            <div className="mt-3 space-y-3">
              {pending.map((req) => (
                <div
                  key={req.id}
                  className="rounded-lg border border-gray-200 bg-white p-4"
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
                        Scope: {formatScope(req.scope)}
                      </p>
                    </div>
                    {!isDoctor && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(req.id, req.scope)}
                          disabled={actionLoading === req.id}
                          className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleDeny(req.id)}
                          disabled={actionLoading === req.id}
                          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Deny
                        </button>
                      </div>
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
                      {formatScope(req.scope)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        req.status === "approved"
                          ? "bg-green-100 text-green-800"
                          : req.status === "denied"
                            ? "bg-red-100 text-red-800"
                            : req.status === "revoked"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {req.status}
                    </span>
                    {isDoctor && req.status === "approved" && (
                      <button
                        onClick={() => handleRevoke(req.id)}
                        disabled={actionLoading === req.id}
                        className="text-xs text-red-600 hover:underline disabled:opacity-50"
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

        {requests.length === 0 && (
          <p className="mt-8 text-center text-sm text-gray-500">
            No access requests yet.
          </p>
        )}
      </main>
    </div>
  );
}
