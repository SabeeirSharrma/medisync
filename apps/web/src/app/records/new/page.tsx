"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { MedicalRecord } from "@medisync/shared";

const RECORD_TYPES = [
  "prescription",
  "lab_result",
  "checkup",
  "surgery",
  "imaging",
  "other",
] as const;

export default function NewRecordPage() {
  const router = useRouter();
  const [type, setType] = useState<string>("prescription");
  const [date, setDate] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [hospitalName, setHospitalName] = useState("");
  const [details, setDetails] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const detailsObj = details.trim() ? { notes: details.trim() } : undefined;

      if (file) {
        const formData = new FormData();
        formData.append("type", type);
        formData.append("date", date);
        if (doctorName) formData.append("doctorName", doctorName);
        if (hospitalName) formData.append("hospitalName", hospitalName);
        if (detailsObj) formData.append("details", JSON.stringify(detailsObj));
        formData.append("file", file);

        const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
        const res = await fetch(`${API_URL}/api/records`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Upload failed" }));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
      } else {
        await apiFetch<{ record: MedicalRecord }>("/api/records", {
          method: "POST",
          body: JSON.stringify({ type, date, doctorName, hospitalName, details: detailsObj }),
        });
      }

      router.push("/records");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create record");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-semibold">MediSync</h1>
          <Link href="/records" className="text-sm text-gray-600 hover:text-gray-900">
            Back to records
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <h2 className="text-xl font-medium">Add Record</h2>

        <form onSubmit={handleSubmit} className="mt-6 max-w-md space-y-6">
          <div>
            <label htmlFor="record-type" className="mb-1 block text-sm font-medium text-gray-700">
              Record type
            </label>
            <select
              id="record-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {RECORD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="record-date" className="mb-1 block text-sm font-medium text-gray-700">
              Date
            </label>
            <input
              id="record-date"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="doctor-name" className="mb-1 block text-sm font-medium text-gray-700">
              Doctor name <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              id="doctor-name"
              type="text"
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="hospital-name" className="mb-1 block text-sm font-medium text-gray-700">
              Hospital / clinic <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              id="hospital-name"
              type="text"
              value={hospitalName}
              onChange={(e) => setHospitalName(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="details" className="mb-1 block text-sm font-medium text-gray-700">
              Details / Notes <span className="font-normal text-gray-400"></span>
            </label>
            <textarea
              id="details"
              rows={6}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Add any additional information about this record..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="attachment" className="mb-1 block text-sm font-medium text-gray-700">
              Attachment <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              id="attachment"
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-gray-600 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
            />
            <p className="mt-1 text-xs text-gray-400">Images, X-rays, scanned PDFs (max 50MB)</p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create record"}
          </button>
        </form>
      </main>
    </div>
  );
}
