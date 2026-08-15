"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { MedicalRecord } from "@medisync/shared";

export default function RecordDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [record, setRecord] = useState<MedicalRecord | null>(null);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    apiFetch<{ record: MedicalRecord }>(`/api/records/${id}`)
      .then((res) => {
        setRecord(res.record);
        if (res.record.attachmentKey) {
          return apiFetch<{ url: string; contentType: string }>(
            `/api/records/${id}/attachment`,
          );
        }
      })
      .then((res) => {
        if (res) setAttachmentUrl(res.url);
      })
      .catch(() => router.push("/records"))
      .finally(() => setLoading(false));
  }, [id, router]);

  async function handleDelete() {
    if (!confirm("Delete this record? This can be undone by contacting support.")) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/records/${id}`, { method: "DELETE" });
      router.push("/records");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!record) return null;

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
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-medium capitalize">
              {record.type.replace("_", " ")}
            </h2>
            <p className="mt-1 text-sm text-gray-500">{record.date}</p>
          </div>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="text-xs font-medium uppercase text-gray-500">Details</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-gray-500">Doctor</dt>
                <dd className="font-medium">{record.doctorName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Hospital</dt>
                <dd className="font-medium">{record.hospitalName ?? "—"}</dd>
              </div>
              {record.versionOf && (
                <div>
                  <dt className="text-gray-500">Version</dt>
                  <dd className="font-medium">Edited (version of {record.versionOf.slice(0, 8)}...)</dd>
                </div>
              )}
            </dl>
          </div>

          {attachmentUrl && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="text-xs font-medium uppercase text-gray-500">Attachment</h3>
              <div className="mt-3">
                <a
                  href={attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                >
                  Download attachment
                  <span className="text-xs text-gray-400">
                    ({record.fileSize ? `${(record.fileSize / 1024).toFixed(1)} KB` : "unknown size"})
                  </span>
                </a>
              </div>
            </div>
          )}
        </div>

        {record.details && Object.keys(record.details).length > 0 && (
          <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="text-xs font-medium uppercase text-gray-500">Additional info</h3>
            <pre className="mt-3 whitespace-pre-wrap text-sm text-gray-700">
              {JSON.stringify(record.details, null, 2)}
            </pre>
          </div>
        )}
      </main>
    </div>
  );
}
