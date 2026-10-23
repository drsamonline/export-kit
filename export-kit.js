/* export-kit — get bytes and files off the device, in the browser.
 * One file. No build step. No CDN. No dependencies. Works from file:// and Pages.
 * MIT License. (c) 2026 Dr Sohil Momin.
 *
 * Exposes window.Export with: save, text, json, csv, blob, zip, saveZip,
 * crc32, toBytes, blobUrl, revoke.
 *
 * The gap it fills: web-kit's `csv.download` writes CSV text only, and
 * `compress-kit` is gzip/deflate (not an archive writer). Every app was
 * re-implementing Blob -> createObjectURL -> <a download>, and one hand-wrote a
 * ZIP. This is that code, once.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.Export = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var VERSION = "1.0.0";

  /* ---------- normalise anything to a Uint8Array ---------- */
  function toBytes(data) {
    if (data == null) return new Uint8Array(0);
    if (data instanceof Uint8Array) return data;
    if (typeof ArrayBuffer !== "undefined" && data instanceof ArrayBuffer) return new Uint8Array(data);
    if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView && ArrayBuffer.isView(data))
      return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    if (typeof data === "string") return utf8Encode(data);
    throw new TypeError("export-kit: cannot convert " + (typeof data) + " to bytes");
  }

  /* ---------- UTF-8 (no TextEncoder dependency) ---------- */
  function utf8Encode(str) {
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(str);
    var out = [], i, c;
    for (i = 0; i < str.length; i++) {
      c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) { out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f)); }
      else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
        var c2 = str.charCodeAt(++i);
        c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
        out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      } else { out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f)); }
    }
    return new Uint8Array(out);
  }

  /* ---------- CRC-32 (IEEE 802.3) — required by the ZIP writer ---------- */
  var CRC_TABLE = (function () {
    var t = new Uint32Array(256), c, n, k;
    for (n = 0; n < 256; n++) {
      c = n;
      for (k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(data) {
    var bytes = toBytes(data), c = 0xffffffff, i;
    for (i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  /* ---------- byte writer ---------- */
  function ByteWriter() { this.chunks = []; this.len = 0; }
  ByteWriter.prototype.u16 = function (v) { this.chunks.push([v & 0xff, (v >>> 8) & 0xff]); this.len += 2; return this; };
  ByteWriter.prototype.u32 = function (v) {
    this.chunks.push([v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]); this.len += 4; return this;
  };
  ByteWriter.prototype.bytes = function (b) { this.chunks.push(b); this.len += b.length; return this; };
  ByteWriter.prototype.done = function () {
    var out = new Uint8Array(this.len), off = 0, i, j, ch;
    for (i = 0; i < this.chunks.length; i++) {
      ch = this.chunks[i];
      if (ch instanceof Uint8Array) { out.set(ch, off); off += ch.length; }
      else for (j = 0; j < ch.length; j++) out[off++] = ch[j];
    }
    return out;
  };

  /* ---------- DOS date/time ---------- */
  function dosTime(d) {
    return ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((d.getSeconds() / 2) & 0x1f);
  }
  function dosDate(d) {
    return (((d.getFullYear() - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0x0f) << 5) | (d.getDate() & 0x1f);
  }

  /* ---------- store-only (method 0) ZIP writer ---------- */
  /* files: [{ name, data (string|Uint8Array|ArrayBuffer), date? }] -> Uint8Array */
  function zip(files) {
    files = files || [];
    var w = new ByteWriter(), central = [], offset = 0, now = new Date(), i;

    for (i = 0; i < files.length; i++) {
      var f = files[i];
      var name = utf8Encode(f.name || ("file" + i));
      var data = toBytes(f.data);
      var crc = crc32(data);
      var when = f.date || now;
      var t = dosTime(when), dt = dosDate(when);

      var local = new ByteWriter();
      local.u32(0x04034b50).u16(20).u16(0x0800).u16(0)   // sig, version, UTF-8 flag, method=store
        .u16(t).u16(dt).u32(crc).u32(data.length).u32(data.length)
        .u16(name.length).u16(0).bytes(name).bytes(data);
      var lh = local.done();
      w.bytes(lh);
      central.push({ name: name, crc: crc, size: data.length, t: t, dt: dt, offset: offset });
      offset += lh.length;
    }

    var cdStart = offset, cdSize = 0;
    for (i = 0; i < central.length; i++) {
      var e = central[i];
      var c = new ByteWriter();
      c.u32(0x02014b50).u16(20).u16(20).u16(0x0800).u16(0)
        .u16(e.t).u16(e.dt).u32(e.crc).u32(e.size).u32(e.size)
        .u16(e.name.length).u16(0).u16(0).u16(0).u16(0).u32(0).u32(e.offset).bytes(e.name);
      var ch = c.done();
      w.bytes(ch); cdSize += ch.length;
    }

    var eocd = new ByteWriter();
    eocd.u32(0x06054b50).u16(0).u16(0).u16(central.length).u16(central.length)
      .u32(cdSize).u32(cdStart).u16(0);
    w.bytes(eocd.done());
    return w.done();
  }

  /* ---------- browser save (Blob -> object URL -> <a download>) ---------- */
  function isBrowser() {
    return typeof document !== "undefined" && typeof Blob !== "undefined";
  }
  function blobUrl(blob) {
    if (typeof URL === "undefined" || !URL.createObjectURL) throw new Error("export-kit: URL.createObjectURL unavailable");
    return URL.createObjectURL(blob);
  }
  function revoke(url) {
    try { if (typeof URL !== "undefined" && URL.revokeObjectURL) URL.revokeObjectURL(url); } catch (e) {}
  }
  function toBlob(data, mime) {
    if (typeof Blob === "undefined") throw new Error("export-kit: Blob unavailable in this environment");
    if (data instanceof Blob) return data;
    return new Blob([toBytes(data)], { type: mime || "application/octet-stream" });
  }
  function save(filename, data, mime) {
    if (!isBrowser()) throw new Error("export-kit: save() needs a browser (no document/Blob here)");
    var blob = toBlob(data, mime);
    var url = blobUrl(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename || "download";
    a.rel = "noopener";
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(function () { revoke(url); }, 1000);
    return blob;
  }

  /* ---------- typed convenience ---------- */
  function text(name, str, mime) { return save(name, str, mime || "text/plain;charset=utf-8"); }
  function json(name, obj, pretty) { return save(name, JSON.stringify(obj, null, pretty === false ? 0 : 2), "application/json"); }
  function csv(name, csvText) { return save(name, csvText, "text/csv;charset=utf-8"); }
  function blob(name, data, mime) { return save(name, data, mime || "application/octet-stream"); }
  function saveZip(name, files) { return save(name, zip(files), "application/zip"); }

  return {
    version: VERSION,
    save: save, text: text, json: json, csv: csv, blob: blob,
    zip: zip, saveZip: saveZip,
    crc32: crc32, toBytes: toBytes, utf8Encode: utf8Encode,
    blobUrl: blobUrl, revoke: revoke
  };
});
