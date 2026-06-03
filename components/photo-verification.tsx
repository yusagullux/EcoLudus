"use client";

import { useState } from "react";
import { Panel, primaryButton, secondaryButton, Pill } from "@/components/game-ui";

type PhotoVerificationProps = {
  questId: string;
  questTitle: string;
  verified: boolean;
  onVerified: (questId: string) => void;
};

export default function PhotoVerification({ questId, questTitle, verified, onVerified }: PhotoVerificationProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setError(null);
    setWarnings([]);
    setStatus(null);
    setPreviewUrl(null);

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please upload a valid image file.");
      setSelectedFile(null);
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setError("Image too large. Maximum size is 15MB.");
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setPreviewUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const verifyPhoto = async () => {
    if (!selectedFile) {
      setError("Select a photo before verification.");
      return;
    }

    setError(null);
    setWarnings([]);
    setStatus("Uploading photo for verification...");
    setIsSubmitting(true);

    try {
      const body = new FormData();
      body.append("photo", selectedFile);
      body.append("questId", questId);
      body.append("questTitle", questTitle);

      const response = await fetch("/api/photo-verification", {
        method: "POST",
        body
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error?.message || "Photo verification failed.");
      }

      setStatus("Photo verified successfully.");
      setWarnings(Array.isArray(payload.warnings) ? payload.warnings.map(String) : []);
      onVerified(questId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (verified) {
    return (
      <Panel eyebrow="Proof submitted" title={`"${questTitle}" photo verified`} action={<Pill active>Verified</Pill>}>
        <p className="text-sm text-forest-700">This quest has been verified with a photo proof upload and is ready for completion.</p>
      </Panel>
    );
  }

  return (
    <Panel eyebrow="Quest verification" title={`Verify proof for: ${questTitle}`}>
      <div className="grid gap-4">
        <label className="block text-sm font-semibold text-forest-900">
          Upload photo proof
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="mt-2 w-full rounded-2xl border border-[#d8e1d2] bg-[#fbfcf7] px-4 py-3 text-sm text-forest-950 outline-none"
          />
        </label>

        {selectedFile && (
          <div className="rounded-2xl border border-[#e0e7db] bg-[#f4f7ef] px-4 py-3 text-sm text-forest-700">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="min-w-[88px] rounded-2xl bg-white p-2 shadow-sm">
                {previewUrl ? (
                  <img src={previewUrl} alt="Photo proof preview" className="h-20 w-full rounded-2xl object-cover" />
                ) : (
                  <div className="h-20 w-full rounded-2xl bg-[#e7f1de]" />
                )}
              </div>
              <div>
                <p className="font-semibold text-forest-900">{selectedFile.name}</p>
                <p className="text-[13px] text-forest-700">{(selectedFile.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
          </div>
        )}

        {status && <p className="text-sm text-forest-700">{status}</p>}
        {error && <p className="text-sm font-semibold text-rose-700">{error}</p>}
        {warnings.length > 0 && (
          <div className="rounded-2xl border border-[#f2e5bb] bg-[#fff9e6] px-4 py-3 text-sm text-amber-900">
            <p className="font-bold">Verification notes:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button onClick={verifyPhoto} disabled={isSubmitting || !selectedFile} className={primaryButton}>
            {isSubmitting ? "Verifying…" : "Verify Photo"}
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedFile(null);
              setError(null);
              setWarnings([]);
              setStatus(null);
            }}
            className={secondaryButton}
          >
            Reset
          </button>
        </div>
      </div>
    </Panel>
  );
}
