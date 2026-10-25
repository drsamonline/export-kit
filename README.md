# export-kit

[![live](https://img.shields.io/badge/live-online-22c55e)](https://drsamonline.github.io/export-kit/)
[![license](https://img.shields.io/badge/license-PolyForm Noncommercial-blue)](LICENSE)


**Get bytes and files off the device, in the browser.** One file, no build step,
no dependencies. Works from `file://` and from GitHub Pages.

Every single-file app was re-implementing the same thing: `Blob` →
`URL.createObjectURL` → a hidden `<a download>`; and one app hand-wrote a ZIP to
bundle several files. This is that code, once.

It is the layer *above* the codecs: `web-kit` writes CSV text, `compress-kit`
does gzip/deflate — `export-kit` turns data into a file the user actually
receives, and can bundle several into one archive.

## Use it

Drop `export-kit.js` next to your code and load it, then use the global `Export`:

```html
<script src="export-kit.js"></script>
<script>
  Export.text("notes.txt", "hello");
  Export.json("data.json", { hello: "world" });
  Export.csv("rows.csv", Loom.csv.toCSV(rows));   // build the CSV with web-kit
  Export.blob("photo.png", someUint8Array, "image/png");

  // bundle several files into one archive (store-only, no compression)
  Export.saveZip("bundle.zip", [
    { name: "notes.txt", data: "hello" },
    { name: "data.json", data: JSON.stringify(obj) },
    { name: "raw.bin", data: bytes }
  ]);
</script>
```

For a truly single-file app, inline the contents of `export-kit.js` in a
`<script>` block. Nothing else is required.

## API

| | |
|---|---|
| `Export.save(name, data, mime)` | Generic: string → text, `Uint8Array`/`ArrayBuffer`/`Blob` → binary. |
| `Export.text(name, str, mime?)` | Save a text file. |
| `Export.json(name, obj, pretty?)` | Save pretty JSON (pass `false` to minify). |
| `Export.csv(name, csvText)` | Save CSV text (build it with `Loom.csv.toCSV`). |
| `Export.blob(name, data, mime?)` | Save binary data. |
| `Export.zip(files)` | Build a **store-only ZIP** → `Uint8Array`. `files = [{ name, data, date? }]`. |
| `Export.saveZip(name, files)` | Build and download a ZIP. |
| `Export.crc32(data)` | CRC-32 (IEEE 802.3), as the ZIP format requires. |
| `Export.toBytes(data)` | Normalise string / `Uint8Array` / `ArrayBuffer` to bytes. |
| `Export.blobUrl(blob)` / `Export.revoke(url)` | Object-URL helpers. |

## Notes

- **Store-only ZIP** (method 0): fast, dependency-free, and readable by every
  unzip tool. If you need compression, gzip each entry with `compress-kit`
  first.
- **Zero dependencies.** No `TextEncoder` needed (a UTF-8 fallback is built in);
  no CDN; no telemetry.
- `Export.zip` is pure and runs in Node too — which is how it is tested.

## Verified

`test-node.js` proves byte normalisation, the CRC-32 vectors, and a full ZIP
round-trip (build → read back → check names, bytes and CRCs):

```
node test-node.js
...
22 passed, 0 failed
```

The generated archive is also verified with the system `unzip -t` in CI-style
checks.

## Licence

MIT. (c) 2026 Dr Sohil Momin.

Part of the Forge system. Kits are open; the orchestrator is licensed.
