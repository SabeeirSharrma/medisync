"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { MedicalRecord } from "@medisync/shared";

interface User {
  id: string;
  name: string;
  role: string;
}

interface PaginatedRecords {
  records: MedicalRecord[];
  total: number;
  page: number;
  totalPages: number;
}

export default function RecordsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<PaginatedRecords | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  function downloadExport(format: "csv" | "pdf") {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const url = `${API_URL}/api/records/export/${format}`;
    window.open(url, "_blank");
  }

  useEffect(() => {
    apiFetch<{ user: User }>("/api/auth/me")
      .then((res) => {
        setUser(res.user);
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (user) {
      setLoading(true);
      apiFetch<PaginatedRecords>(`/api/records?page=${page}&limit=10`)
        .then((res) => setData(res))
        .finally(() => setLoading(false));
    }
  }, [page, user]);

  if (loading && !data) {
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
          <div className="flex gap-4 text-sm">
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
              Dashboard
            </Link>
            <Link href="/access-requests" className="text-gray-600 hover:text-gray-900">
              Access Requests
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-medium">Medical Records</h2>
          <div className="flex gap-2">
            <Link
              href="/records/new"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Add Record
            </Link>
            <button
              onClick={() => downloadExport("csv")}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Export CSV
            </button>
            <button
              onClick={() => downloadExport("pdf")}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Export PDF
            </button>
          </div>
        </div>

        {data && data.records.length > 0 ? (
          <>
            <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 font-medium text-gray-700">Type</th>
                    <th className="px-4 py-3 font-medium text-gray-700">Date</th>
                    <th className="px-4 py-3 font-medium text-gray-700">Doctor</th>
                    <th className="px-4 py-3 font-medium text-gray-700">Hospital</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.records.map((record) => (
                    <tr
                      key={record.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => router.push(`/records/${record.id}`)}
                    >
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                          {record.type.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{record.date}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {record.doctorName ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {record.hospitalName ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
              <span>
                Page {data.page} of {data.totalPages} ({data.total} records)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                  disabled={page >= data.totalPages}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        ) : (
          <p className="mt-8 text-center text-sm text-gray-500">
            No records found.
          </p>
        )}
      </main>
    </div>
  );
}
