# ADR 0003: Large Audio Preprocessing Boundary

## Status

Accepted

## Context

The recorder queue used to run silence filtering and audio enhancement in the browser before every upload. That is useful for short recordings, but it requires decoding and rendering the whole blob on the UI side. Long or large recordings can therefore make the interface feel stuck before the backend pipeline even starts.

The backend already owns durable media persistence, chunked upload handling, transcription chunking, and production observability. The browser should only do lightweight preparation when it is likely to stay responsive.

## Decision

Keep client-side VAD and enhancement for recordings that are within both limits:

- duration is at most 15 minutes
- blob size is at most 24 MB

For recordings above either limit, skip local VAD/enhancement and upload the original blob. The queue shows a status that local enhancement is being skipped so the UI remains responsive while server-side processing takes over.

## Consequences

- Long recordings avoid expensive browser-side decode/render work before upload.
- The user sees an explicit status instead of a silent pause.
- Short recordings still benefit from existing local cleanup.
- Server-side transcription/chunking remains the canonical path for large recordings.
- Future worker-based enhancement can be added behind the same preprocessing policy without changing queue semantics.
