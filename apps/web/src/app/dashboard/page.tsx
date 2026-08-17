"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { MedicalRecord } from "@medisync/shared";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  dob: string | null;
}

interface MeResponse {
  user: User;
}

interface PaginatedRecords {
  records: MedicalRecord[];
  total: number;
  page: number;
  totalPages: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    apiFetch<MeResponse>("/api/auth/me")
      .then((res) => {
        setUser(res.user);
        return apiFetch<PaginatedRecords>("/api/records?limit=5");
      })
      .then((res) => {
        setRecords(res.records);
        setTotalRecords(res.total);
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-semibold">MediSync</h1>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/records" className="text-gray-600 hover:text-gray-900">
              Records
            </Link>
            <Link href="/access-requests" className="text-gray-600 hover:text-gray-900">
              Access Requests
            </Link>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              {loggingOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <h2 className="text-xl font-medium">Welcome, {user?.name}</h2>
        <p className="mt-1 text-sm text-gray-500">
          {user?.email} &middot; {user?.role}
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <p className="text-sm font-medium text-gray-500">Total Records</p>
            <p className="mt-1 text-3xl font-semibold">{totalRecords}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <p className="text-sm font-medium text-gray-500">Account Role</p>
            <p className="mt-1 text-3xl font-semibold capitalize">{user?.role}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <p className="text-sm font-medium text-gray-500">Recent Activity</p>
            <p className="mt-1 text-3xl font-semibold">{records.length}</p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Link
            href="/records/new"
            className="flex items-center justify-center rounded-lg border border-gray-200 bg-white p-6 text-sm font-medium text-blue-600 hover:bg-gray-50"
          >
            + Add Record
          </Link>
          <Link
            href="/records"
            className="flex items-center justify-center rounded-lg border border-gray-200 bg-white p-6 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            View All Records
          </Link>
        </div>

        <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-medium text-gray-700">Recent Records</h3>
          {records.length > 0 ? (
            <ul className="mt-4 divide-y divide-gray-100">
              {records.map((record) => (
                <li
                  key={record.id}
                  className="cursor-pointer py-3 hover:bg-gray-50 -mx-6 px-6"
                  onClick={() => router.push(`/records/${record.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                        {record.type.replace("_", " ")}
                      </span>
                      <span className="text-sm text-gray-600">{record.date}</span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {record.doctorName ?? "—"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-gray-500">No records yet.</p>
          )}
        </div>
      </main>
    </div>
  );
}
