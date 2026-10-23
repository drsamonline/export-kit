/* Node test for export-kit: byte normalisation, CRC-32, and the store-only ZIP
 * writer. The download path needs a browser, so here we prove the *pure* parts —
 * the ZIP is built and then read back byte-for-byte, which is what a receiver
 * does. (save() is asserted to fail cleanly with no DOM.)
 *
 *   node test-node.js
 */
const path = require("path");
const Export = require(path.join(__dirname, "export-kit.js"));

let pass = 0, fail = 0;
function ok(cond, label, extra) {
  if (cond) { pass++; console.log("PASS  " + label); }
  else { fail++; console.log("FAIL  " + label + (extra ? "  " + JSON.stringify(extra) : "")); }
}
function throws(fn, re, label) {
  try { fn(); fail++; console.log("FAIL  " + label + "  (did not throw)"); }
  catch (e) {
    if (re.test(e.message)) { pass++; console.log("PASS  " + label); }
    else { fail++; console.log("FAIL  " + label + "  threw: " + e.message); }
  }
}

/* ---- toBytes ---- */
ok(Export.toBytes("hi").length === 2, "toBytes(string) -> utf-8 bytes");
ok(Export.toBytes(new Uint8Array([1, 2, 3]))[2] === 3, "toBytes(Uint8Array) passthrough");
ok(Export.toBytes(new Uint8Array([9, 8]).buffer).length === 2, "toBytes(ArrayBuffer)");
ok(Export.toBytes("é").length === 2, "toBytes multi-byte utf-8");
throws(() => Export.toBytes(42), /cannot convert/, "toBytes(number) throws");

/* ---- crc32 (known vectors) ---- */
ok(Export.crc32("") === 0, "crc32('') == 0", Export.crc32(""));
ok(Export.crc32("123456789") === 0xcbf43926, "crc32('123456789') == 0xCBF43926", Export.crc32("123456789"));
ok(Export.crc32("The quick brown fox jumps over the lazy dog") === 0x414fa339,
   "crc32(fox) == 0x414FA339", Export.crc32("The quick brown fox jumps over the lazy dog"));

/* ---- minimal store-only ZIP reader (what a receiver does) ---- */
function readZip(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const u16 = (o) => dv.getUint16(o, true);
  const u32 = (o) => dv.getUint32(o, true);
  // find EOCD by scanning from the end
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) { if (u32(i) === 0x06054b50) { eocd = i; break; } }
  if (eocd < 0) throw new Error("no EOCD");
  const count = u16(eocd + 10), cdOff = u32(eocd + 16);
  const files = [];
  let p = cdOff;
  for (let n = 0; n < count; n++) {
    if (u32(p) !== 0x02014b50) throw new Error("bad central header at " + p);
    const crc = u32(p + 16), csize = u32(p + 20), usize = u32(p + 24);
    const nameLen = u16(p + 28), extraLen = u16(p + 30), cmtLen = u16(p + 32);
    const localOff = u32(p + 42);
    const name = Buffer.from(buf.subarray(p + 46, p + 46 + nameLen)).toString("utf8");
    // read the local header to find the data start
    if (u32(localOff) !== 0x04034b50) throw new Error("bad local header");
    const lNameLen = u16(localOff + 26), lExtraLen = u16(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const data = buf.subarray(dataStart, dataStart + csize);
    files.push({ name, crc, csize, usize, data });
    p += 46 + nameLen + extraLen + cmtLen;
  }
  return files;
}

/* ---- build a ZIP and read it back ---- */
const payload = { hello: "world", n: 42 };
const entries = [
  { name: "notes.txt", data: "a,b,c\n1,2,3\n" },
  { name: "data.json", data: JSON.stringify(payload) },
  { name: "raw.bin", data: new Uint8Array([0, 1, 2, 253, 254, 255]) },
];
const z = Export.zip(entries);
ok(z instanceof Uint8Array && z.length > 0, "zip() returns a Uint8Array");
ok(new DataView(z.buffer, z.byteOffset).getUint32(0, true) === 0x04034b50, "starts with local file signature");

const back = readZip(z);
ok(back.length === 3, "zip has 3 entries", back.length);
ok(back.map((f) => f.name).join(",") === "notes.txt,data.json,raw.bin", "entry names preserved");
ok(Buffer.from(back[0].data).toString("utf8") === entries[0].data, "entry 0 bytes round-trip");
ok(JSON.parse(Buffer.from(back[1].data).toString("utf8")).n === 42, "entry 1 (json) round-trip");
ok(back[2].data.length === 6 && back[2].data[3] === 253 && back[2].data[5] === 255, "entry 2 (binary) round-trip");
ok(back[0].crc === Export.crc32(entries[0].data), "entry 0 CRC matches");
ok(back[1].crc === Export.crc32(entries[1].data), "entry 1 CRC matches");
ok(back[2].crc === Export.crc32(entries[2].data), "entry 2 CRC matches");
ok(back.every((f) => f.usize === f.csize), "stored (no compression): sizes equal");

/* ---- empty zip is still a valid archive ---- */
const empty = Export.zip([]);
const emptyBack = readZip(empty);
ok(emptyBack.length === 0, "empty zip reads back with 0 entries");
ok(empty.length === 22, "empty zip is just the EOCD (22 bytes)", empty.length);

/* ---- save() needs a browser ---- */
throws(() => Export.save("x.txt", "hi"), /needs a browser/, "save() fails cleanly with no DOM");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
