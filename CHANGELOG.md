# Changelog

## 2.0.0 — 2026-11-12

**The compressor moved in, so the ZIP compresses.**

- **Added** `zipCompressed(files)` and `saveZipCompressed(name, files)` — a ZIP written with
  method 8 (deflate-raw) per entry, keeping whichever of stored/deflated is smaller so a tiny
  file never grows. Async, because deflate is; `zip()` stays synchronous and store-only.
- **Added** every name `compress-kit` exported: `gzip`, `gunzip`, `deflate`, `inflate`,
  `deflateRaw`, `inflateRaw`, `compressString`, `decompressString`, `compressionAvailable`,
  `compressionRatio`, `human`, `toBase64`, `fromBase64`.
- **Why**: this kit wrote an archive with no compression in it, in a kit whose job is getting
  files off the device, because the compressor lived in a second repository that nothing here
  depended on.
- **Unchanged** `save`, `text`, `json`, `csv`, `blob`, `zip`, `saveZip`, `crc32`, `toBytes`,
  `blobUrl`, `revoke`.


## 1.0.0 — 2026-10-25

- **Licence: PolyForm Noncommercial 1.0.0.** Every repository now carries the canonical text
  from polyformproject.org with the Required Notice line, and the four places a repo states
  its licence agree: LICENSE, the SPDX headers, the README and package.json.
- **The public demo is the app.** A build now fails if `docs/play/index.html` is not the app,
  because a demo running older code is two code paths for one program.
