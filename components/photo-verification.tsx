"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Panel, primaryButton, secondaryButton, Pill } from "@/components/game-ui";

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const MIN_PHOTO_BYTES = 5 * 1024;
const ACCEPTED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

type PhotoVerificationProps = {
  questId: string;
  questTitle: string;
  verified: boolean;
  onVerified: (questId: string) => void;
};

export default function PhotoVerification({ questId, questTitle, verified, onVerified }: PhotoVerificationProps) {
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
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

    if (!ACCEPTED_PHOTO_TYPES.includes(file.type.toLowerCase())) {
      setError("Please upload a JPEG, PNG, WebP, HEIC, or HEIF photo.");
      setSelectedFile(null);
      return;
    }

    if (file.size > MAX_PHOTO_BYTES) {
      setError("Image too large. Maximum size is 10MB.");
      setSelectedFile(null);
      return;
    }

    if (file.size < MIN_PHOTO_BYTES) {
      setError("The uploaded file appears to be empty or corrupt. Please upload a real photo.");
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

  const resetSelection = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setError(null);
    setWarnings([]);
    setStatus(null);

    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (galleryInputRef.current) galleryInputRef.current.value = "";
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
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>This quest has been verified with a photo proof upload and is ready for completion.</p>
      </Panel>
    );
  }

  return (
    <Panel eyebrow="Quest verification" title={`Verify proof for: ${questTitle}`}>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Photo proof</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className={primaryButton}
            >
              Take Photo
            </button>
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className={secondaryButton}
            >
              Choose Photo
            </button>
          </div>
          <input
            ref={cameraInputRef}
            type="file"
            accept={ACCEPTED_PHOTO_TYPES.join(",")}
            capture="environment"
            onChange={handleFileChange}
            className="sr-only"
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept={ACCEPTED_PHOTO_TYPES.join(",")}
            onChange={handleFileChange}
            className="sr-only"
          />
        </div>

        {selectedFile && (
          <div className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "var(--border-default)", background: "var(--bg-panel-alt)", color: "var(--text-secondary)" }}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="min-w-[88px] rounded-2xl p-2 shadow-sm" style={{ background: "var(--bg-panel)" }}>
                {previewUrl ? (
                  <div className="relative h-20 w-20 rounded-2xl overflow-hidden">
                    <Image
                      src={previewUrl}
                      alt="Photo proof preview"
                      fill
                      sizes="80px"
                      unoptimized
                      className="rounded-2xl object-cover"
                    />
                  </div>
                ) : (
                  <div className="h-20 w-20 rounded-2xl" style={{ background: "var(--bg-panel-alt)" }} />
                )}
              </div>
              <div>
                <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{selectedFile.name}</p>
                <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>{(selectedFile.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
          </div>
        )}

        {status && <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{status}</p>}
        {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}
        {warnings.length > 0 && (
          <div className="rounded-2xl border border-amber-300/60 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
            <p className="font-bold">Verification notes:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={verifyPhoto} disabled={isSubmitting || !selectedFile} className={primaryButton}>
            {isSubmitting ? "Verifying..." : "Verify Photo"}
          </button>
          <button
            type="button"
            onClick={resetSelection}
            className={secondaryButton}
          >
            Reset
          </button>
        </div>
      </div>
    </Panel>
  );
}
