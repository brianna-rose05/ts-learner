// Runs every Path mission and the example project through the real TypeScript compiler.
// A suggested line must pass its own check, and "break it" lines must fail with the expected error.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const pub = (f) => path.join(__dirname, "..", "public", f);
global.window = global;
global.ts = require("typescript");
vm.runInThisContext(fs.readFileSync(pub("libs.js"), "utf8"));
for (const f of ["engine.js", "missions.js", "build.js", "example.js"]) vm.runInThisContext(fs.readFileSync(pub(f), "utf8"), { filename: f });

const exec = async (js) => {
  const ctx = { exports: {}, console: { log() {} }, __vars() {}, __try: (f) => { try { return f(); } catch {} }, Math, Number, isNaN, Promise, Error };
  try { vm.runInNewContext("var __last;" + js + ";this.__res = __last;", ctx); return { ok: true, last: ctx.__res }; }
  catch (e) { return { ok: false, error: e.message }; }
};
const ser = (v) => v === undefined ? undefined : v === null || typeof v !== "object" ? v
  : Array.isArray(v) ? { $arr: v.map(ser) } : typeof v.then === "function" ? { $obj: {}, $promise: 1 }
  : { $obj: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, ser(x)])), $cls: null };

async function runTrack(name, missions, sameFile) {
  let lines = [], unit = -1, failed = 0;
  for (const m of missions) {
    if (!sameFile && m.unit !== unit) { unit = m.unit; lines = []; }
    const c = Engine.compile(lines, m.code);
    const cur = c.diags.filter((d) => d.inCurrent);
    const newEnts = c.entities.filter((e) => e.current);
    const isErr = m.expect.err || (m.expect.auto && m.expect.auto.err);
    let ok;
    if (isErr) ok = cur.length > 0 && missionPasses(m, { on: "error", newEnts, errorCodes: cur.map((d) => d.code) });
    else if (cur.length) ok = false;
    else {
      const r = await exec(Engine.runnable(c));
      ok = r.ok && missionPasses(m, { on: "commit", newEnts, errorCodes: [], result: ser(r.last) });
      if (ok) lines.push(m.code);
    }
    if (!ok) { failed++; console.log(`  ✗ ${name}: ${m.t}`, cur.map((d) => d.message).join(" | ")); }
  }
  console.log(`${failed ? "✗" : "✓"} ${name}: ${missions.length - failed}/${missions.length}`);
  return failed;
}

(async () => {
  let failed = await runTrack("Path missions", MISSIONS, false);
  const v = await Build.verify(Build.normalize(EXAMPLE_PLAN), exec);
  if (v.problems.length) { console.log("✗ Example plan:", v.problems); failed += v.problems.length; }
  else failed += await runTrack("Example project", v.missions, true);
  process.exit(failed ? 1 : 0);
})();
