## Goal

Extend the audio pipeline to accept `.m4a` (AAC in MP4 container) end-to-end while leaving the existing `.mp3` path untouched.

## Pipeline audit (current state)

| Stage | Location | mp3 today | m4a today |
|---|---|---|---|
| Drag/drop + file picker accept | `src/components/UploadZone.tsx` (`accept="...audio/*..."`) | ✅ (covered by `audio/*`) | ✅ (also covered by `audio/*`, but no explicit ext fallback) |
| Frontend MIME inference | `src/lib/fileTypeUtils.ts` (`AUDIO_EXTS`) | `.mp3` listed | `.m4a` already listed → returns `audio/m4a` |
| External import MIME map | `src/components/import/ImportFilesDialog.tsx`, `src/components/import/S3Browser.tsx` | `mp3 → audio/mpeg` | missing |
| Backend extension allow-list + MIME | `backend/Services/Azure/AzureBlobStorageService.cs` `MimeTypes` | `.mp3 → audio/mpeg` | missing → upload rejected with "'.m4a' is not supported." |
| Backend upload validation | `backend/Controllers/FilesController.cs` (uses `IsSupportedExtension`) | works | blocked until backend map updated |
| Azure Blob upload | same controller — content-type comes from `ResolveMime(ext)` | `audio/mpeg` | needs `audio/mp4` |
| Routing to AudioAnnotationView | `src/pages/Annotate.tsx`, `TaskAnnotationWorkspace.tsx`, `QCWorkspace.tsx` — all gate on `effectiveType.startsWith("audio")` | works | works automatically once MIME is `audio/*` |
| Decode + waveform | `AudioAnnotationView.tsx` uses `AudioContext.decodeAudioData` on the fetched bytes; cache keyed by URL | works | works — browsers decode AAC/M4A natively (Chrome/Edge/Safari/Firefox) |
| Playback | `<audio>` element with `src=sasUrl` | works | works (same native codec support) |
| Timeline/segments | duration-driven, codec-agnostic | works | works |

No changes needed in decoder, waveform, segment, transcription, or annotation logic — they operate on decoded `AudioBuffer` / `<audio>` duration, not on container format.

## Changes

1. **Backend MIME map** — `backend/Services/Azure/AzureBlobStorageService.cs`
   - Add `[".m4a"] = "audio/mp4"` to the `MimeTypes` dictionary. (Standard IANA type for AAC-in-MP4.)
   - This single addition also flows through `IsSupportedExtension`, `SupportedExtensions`, and `ResolveMime`, so `FilesController.Upload` will accept it and stamp the correct blob content-type.

2. **Frontend file picker accept list** — `src/components/UploadZone.tsx`
   - Append `.m4a` to the explicit extension list in the `<input accept="...">` attribute (alongside `.mcap, .pcd, .npz`). `audio/*` already covers it on most browsers, but the explicit extension guarantees it on Windows/Safari where `audio/*` filtering is inconsistent for m4a.

3. **External import MIME maps** — `src/components/import/ImportFilesDialog.tsx` and `src/components/import/S3Browser.tsx`
   - Add `m4a: "audio/mp4"` to each extension→MIME map so imported references get a routable type.

4. **fileTypeUtils** — `src/lib/fileTypeUtils.ts`
   - Already returns `audio/m4a` via the generic branch. Normalize to `audio/mp4` for consistency with backend, since downstream code only checks the `audio/` prefix:
     - Add a small explicit early-return: `if (ext.endsWith(".m4a")) return "audio/mp4";`
   - mp3 path untouched.

## Non-changes (explicitly preserved)

- `AudioAnnotationView.tsx` — no edits. Decoder, IndexedDB cache key, waveform bucketing, segment overlays, playback graph all unchanged.
- mp3 mapping stays `audio/mpeg`.
- No new dependencies, no decoder shims, no transcoding.

## Verification

- Upload an `.mp3` → confirm existing behavior (waveform, playback, segments) unchanged.
- Upload an `.m4a` → backend accepts, blob content-type `audio/mp4`, file routes through `AudioAnnotationView`, waveform renders, playback works, segments behave identically.
- External import of `.m4a` from S3 → file appears with `audio/mp4` type and opens in the audio view.
