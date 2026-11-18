// Build mode: Claude plans a project along the path; the compiler checks every step before the learner sees it.
(function (root) {
  "use strict";

  function curriculum() {
    return root.UNITS.map((u) => {
      const concepts = root.MISSIONS.slice(u.start, u.start + u.count).filter((m) => !m.expect.err).map((m) => m.t);
      return `- ${u.level} / ${u.name}: ${concepts.join(", ")}`;
    }).join("\n");
  }

  const RULES = `Rules for the code:
- TypeScript in strict mode. Only the ES2019 standard library plus console.log. There is NO DOM, NO fetch, NO setTimeout/setInterval, NO Node APIs, NO imports or exports, NO "declare".
- The steps are typed one after another into the same file. Every name must be unique in the whole file: never declare a name twice.
- Each step is small: 1 to 8 lines. Later steps may use anything declared in earlier steps.
- Simulate async work with Promise.resolve(...) or new Promise((resolve) => resolve(...)).
- A step with "expectError": true is a single line that deliberately breaks the rule just taught (wrong type, missing property, private access, readonly write, ...). It must be a TYPE error, not a syntax error, and must only use names that already exist. It is rejected and never added to the file. Use about one per unit, at most 10 in total.
- Steps follow the unit order below exactly, and every unit gets 1 to 4 steps that use its concepts in a way that is natural for this project.
- The second-to-last step declares function main() that uses the project's pieces and prints results with console.log. The last step is the line: main()
- The whole file must run without throwing.`;

  function planPrompt(idea) {
    return `You are designing a hands-on TypeScript course. The learner wants to build: "${idea}".

Write a plan that builds this project step by step while teaching every unit of this curriculum, in this order:
${curriculum()}

${RULES}

Text rules: "t" is 2-4 words. "d" is at most 10 words, says what to do in terms of the project, and does not repeat the code.

Reply with only JSON in this shape:
{"name": "short project name", "summary": "one sentence describing the finished project", "steps": [
  {"unit": "Values", "t": "App name", "d": "Store the app's name.", "code": "const appName = \\"Streaks\\"", "expectError": false},
  {"unit": "Values", "t": "Wrong type", "d": "Try storing text in the goal.", "code": "dailyGoal = \\"three\\"", "expectError": true}
]}
Use "\\n" for line breaks inside "code". Aim for 32 to 45 steps.`;
  }

  function repairPrompt(idea, plan, problems) {
    return `You wrote this plan for a TypeScript course where the learner builds "${idea}". A compiler checked every step and found problems.

Plan:
${JSON.stringify({ name: plan.name, summary: plan.summary, steps: plan.steps.map((s, i) => ({ i, ...s })) })}

Problems (by step index "i"):
${problems.map((p) => `- step ${p.i}: ${p.msg}`).join("\n")}

${RULES}

Fix the problems, changing as little as possible. Keep the same order of units. Reply with only the corrected plan as JSON, same shape as before: {"name", "summary", "steps": [{"unit", "t", "d", "code", "expectError"}]}. Do not include "i".`;
  }

  // Coerce whatever came back into a clean plan
  function normalize(raw) {
    if (!raw || !Array.isArray(raw.steps)) throw new Error("The plan had no steps.");
    const names = root.UNITS.map((u) => u.name.toLowerCase());
    let lastUnit = 0;
    const steps = raw.steps.filter((s) => s && typeof s.code === "string" && s.code.trim()).map((s) => {
      let u = names.indexOf(String(s.unit || "").toLowerCase().trim());
      if (u < lastUnit) u = lastUnit;
      lastUnit = u;
      return {
        unit: root.UNITS[u].name, t: String(s.t || "Step").slice(0, 40), d: String(s.d || "").slice(0, 120),
        code: s.code.replace(/\r/g, "").replace(/\s+$/, ""), expectError: !!s.expectError
      };
    });
    return { name: String(raw.name || "My project").slice(0, 40), summary: String(raw.summary || "").slice(0, 200), steps };
  }

  // Compile every step in order. Accepted steps become missions with checks derived from what the compiler saw.
  async function verify(plan, exec) {
    const E = root.Engine;
    const lines = [], problems = [], missions = [], sheet = {}, units = [];
    plan.steps.forEach((s, i) => {
      const c = E.compile(lines, s.code);
      const cur = c.diags.filter((d) => d.inCurrent);
      let unitIdx = units.findIndex((u) => u.name === s.unit);
      if (unitIdx < 0) {
        const base = root.UNITS.find((u) => u.name === s.unit);
        units.push({ name: s.unit, level: base.level, li: base.li, start: missions.length, count: 0 });
        unitIdx = units.length - 1;
      }
      const push = (expect, info) => {
        const u = units[unitIdx];
        sheet[missions.length] = info;
        missions.push({ t: s.t, d: s.d, code: s.code, expect, unit: unitIdx, k: u.count++ });
      };
      if (s.expectError) {
        if (!cur.length) problems.push({ i, msg: "Marked expectError, but it compiles without errors." });
        else if (cur.some((d) => d.syntax)) problems.push({ i, msg: "Marked expectError, but it is a syntax error: " + cur[0].message });
        else if (cur.some((d) => [2304, 2552, 2448, 2454].includes(d.code))) problems.push({ i, msg: "Marked expectError, but it fails only because it uses a name that doesn't exist: " + cur[0].message });
        else push({ auto: { err: [...new Set(cur.map((d) => d.code))] } }, { why: E.translate(cur.find((d) => !d.syntax), c).body });
      } else if (cur.length) {
        problems.push({ i, msg: cur.slice(0, 3).map((d) => `TS${d.code}: ${d.message}`).join(" | ") });
      } else {
        const ents = c.entities.filter((e) => e.current);
        const named = ents.filter((e) => e.name && e.kind !== "expr");
        const last = named[named.length - 1] || ents[ents.length - 1];
        let gives = last && last.typeStr && !["class", "interface", "enum"].includes(last.kind) ? last.typeStr : "";
        if (gives.length > 90) gives = "";
        push({ auto: { names: named.map((e) => ({ name: e.name, kind: e.kind, canon: root.canonModel(e.model) })), expr: !named.length } }, { gives });
        lines.push(s.code);
      }
    });
    if (!problems.length && exec) {
      const r = await exec(E.runnable(E.compile(lines, "")));
      if (!r.ok) problems.push({ i: plan.steps.length - 1, msg: "Running the whole file throws: " + r.error });
    }
    if (!problems.length && missions.length < 12) problems.push({ i: missions.length - 1, msg: "The plan is too short. Cover every unit." });
    units.forEach((u) => (u.count = missions.filter((m) => m.unit === units.indexOf(u)).length));
    return { problems, missions, units, sheet, code: lines.join("\n") };
  }

  // The full loop: plan → verify → repair (twice at most).
  // planner = { plan(idea, opts), repair(idea, plan, problems, opts) }, each resolving to parsed JSON.
  async function create(idea, { planner, exec, onStatus, signal }) {
    onStatus({ phase: "planning", steps: 0 });
    const raw = await planner.plan(idea, {
      signal,
      onText: ({ text }) => onStatus({ phase: "planning", steps: (text.match(/"code"\s*:/g) || []).length })
    });
    let plan = normalize(raw);
    for (let round = 0; ; round++) {
      onStatus({ phase: "checking", total: plan.steps.length });
      const v = await verify(plan, exec);
      if (!v.problems.length) return { idea, name: plan.name, summary: plan.summary, ...v };
      if (round >= 2) throw new Error(`${v.problems.length} step${v.problems.length > 1 ? "s" : ""} still didn't compile after two repairs.`);
      onStatus({ phase: "fixing", count: v.problems.length, round: round + 1 });
      const fixed = await planner.repair(idea, { name: plan.name, summary: plan.summary, steps: plan.steps }, v.problems, {
        signal,
        onText: ({ text }) => onStatus({ phase: "fixing", count: v.problems.length, round: round + 1, steps: (text.match(/"code"\s*:/g) || []).length })
      });
      plan = normalize(fixed);
    }
  }

  // A value's exact literal is the learner's choice: "streaks" counts the same as "Streaks"
  const widen = (c) => (/^".*"$/.test(c) ? "string" : /^-?\d/.test(c) ? "number" : c === "true" || c === "false" ? "boolean" : c);
  function sameShape(n, e) {
    if (["class", "interface", "enum"].includes(n.kind)) return true;
    const got = root.canonModel(e.model);
    return n.kind === "var" ? widen(got) === widen(n.canon) : got === n.canon;
  }
  function passes(m, ctx) {
    return !explain(m, ctx);
  }
  // Why an accepted line doesn't complete the step (null when it does)
  function explain(m, ctx) {
    const a = m.expect.auto;
    if (a.err) return ctx.on === "error" && ctx.errorCodes.some((c) => a.err.includes(c)) ? null : "This step expects a type error.";
    if (ctx.on !== "commit") return "Not accepted yet.";
    if (a.expr) return ctx.newEnts.length ? null : "This step expects an expression.";
    for (const n of a.names) {
      const e = ctx.newEnts.filter((x) => x.name === n.name).pop();
      if (!e) return `This step declares ${n.name}.`;
      if (e.kind !== n.kind) return `${n.name} should be a ${n.kind === "var" ? "variable" : n.kind === "fn" ? "function" : n.kind === "alias" ? "type" : n.kind}.`;
      if (!sameShape(n, e)) return `${n.name} has a different type than this step expects (${n.kind === "var" ? widen(n.canon) : n.canon}).`;
    }
    return null;
  }

  // Project files for the download
  function files(project) {
    const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
    const units = project.units.map((u) => `- ${u.level} · ${u.name}`).join("\n");
    return {
      slug,
      files: {
        "src/index.ts": `// ${project.name}\n// ${project.summary}\n// Built step by step in Typed.\n\n${project.code}\n`,
        "package.json": JSON.stringify({ name: slug, version: "1.0.0", private: true, type: "module",
          scripts: { start: "tsx src/index.ts", typecheck: "tsc --noEmit" },
          devDependencies: { tsx: "^4.19.0", typescript: "^5.4.5" } }, null, 2) + "\n",
        "tsconfig.json": JSON.stringify({ compilerOptions: { target: "ES2020", module: "ESNext", moduleResolution: "Bundler", strict: true,
          moduleDetection: "force", lib: ["ES2020", "DOM"], types: [], noEmit: true, skipLibCheck: true }, include: ["src"] }, null, 2) + "\n",
        "README.md": `# ${project.name}\n\n${project.summary}\n\n## Run\n\n\`\`\`sh\nnpm install\nnpm start        # runs main()\nnpm run typecheck\n\`\`\`\n\n## What it covers\n\n${units}\n`
      }
    };
  }

  // Planner that asks Claude from inside a claude.ai artifact (the viewer's own account)
  function artifactPlanner(sample) {
    return {
      plan: (idea, o) => sample.json(planPrompt(idea), { ...o, cache: false }),
      repair: (idea, plan, problems, o) => sample.json(repairPrompt(idea, plan, problems), { ...o, cache: false })
    };
  }

  root.Build = { create, verify, normalize, passes, explain, files, planPrompt, repairPrompt, artifactPlanner };
})(typeof window !== "undefined" ? window : globalThis);
