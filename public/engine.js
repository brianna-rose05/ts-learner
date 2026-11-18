// Engine: runs the real TypeScript compiler on the session, and turns types into a visual model.
(function (root) {
  "use strict";
  const LIB_NAMES = [
    "lib.es5.d.ts", "lib.decorators.d.ts", "lib.decorators.legacy.d.ts",
    "lib.es2015.core.d.ts", "lib.es2015.collection.d.ts", "lib.es2015.iterable.d.ts", "lib.es2015.generator.d.ts",
    "lib.es2015.promise.d.ts", "lib.es2015.proxy.d.ts", "lib.es2015.reflect.d.ts", "lib.es2015.symbol.d.ts",
    "lib.es2015.symbol.wellknown.d.ts", "lib.es2016.array.include.d.ts", "lib.es2017.object.d.ts", "lib.es2017.string.d.ts",
    "lib.es2019.array.d.ts", "lib.es2019.object.d.ts", "lib.es2019.string.d.ts", "console.d.ts"
  ];
  let T, libs = null, options, lastProgram;

  function init() {
    T = root.ts;
    const src = root.TS_LIBS;
    libs = {};
    for (const n of LIB_NAMES) libs[n] = T.createSourceFile(n, src[n] || "", T.ScriptTarget.ES2020, true);
    options = {
      strict: true, target: T.ScriptTarget.ES2020, module: T.ModuleKind.CommonJS, noLib: true, noEmit: true,
      moduleDetection: T.ModuleDetectionKind ? T.ModuleDetectionKind.Force : 3, skipLibCheck: true, types: []
    };
  }

  // ── Compile the session (committed lines + the line being typed)
  function compile(lines, current) {
    if (!libs) init();
    const committed = lines.join("\n");
    const text = committed + (committed ? "\n" : "") + current;
    const curStart = text.length - current.length;
    const sf = T.createSourceFile("session.ts", text, T.ScriptTarget.ES2020, true);
    const host = {
      getSourceFile: (f) => (f === "session.ts" ? sf : libs[f]),
      getDefaultLibFileName: () => "lib.es5.d.ts",
      writeFile() {}, getCurrentDirectory: () => "/", getDirectories: () => [],
      fileExists: (f) => f === "session.ts" || !!libs[f], readFile: () => "",
      getCanonicalFileName: (f) => f, useCaseSensitiveFileNames: () => true, getNewLine: () => "\n"
    };
    const program = T.createProgram({ rootNames: [...LIB_NAMES, "session.ts"], options, host, oldProgram: lastProgram });
    lastProgram = program;
    const checker = program.getTypeChecker();
    const ctx = { sf, checker, curStart };
    const mk = (syntax) => (d) => ({
      start: d.start || 0, length: d.length || 0, code: d.code,
      message: T.flattenDiagnosticMessageText(d.messageText, " "), chain: d.messageText,
      syntax, inCurrent: (d.start || 0) >= curStart
    });
    const diags = [...program.getSyntacticDiagnostics(sf).map(mk(true)), ...program.getSemanticDiagnostics(sf).map(mk(false))];
    const entities = [];
    sf.statements.forEach((st) => {
      for (const e of entitiesFor(st, ctx)) { e.current = st.getStart(sf) >= curStart; e.pos = st.getStart(sf); entities.push(e); }
    });
    // Overloads: keep one card per function name
    const seen = new Set();
    for (let i = entities.length - 1; i >= 0; i--) {
      const x = entities[i];
      if (x.kind !== "fn") continue;
      if (seen.has(x.name)) entities.splice(i, 1); else seen.add(x.name);
    }
    return { sf, checker, diags, entities, curStart, text, ctx };
  }

  // ── Statements → entities
  function entitiesFor(st, ctx) {
    const { checker, sf } = ctx;
    const K = T.SyntaxKind;
    const out = [];
    const typeStr = (t) => checker.typeToString(t, undefined, T.TypeFormatFlags.NoTruncation);
    try {
      if (st.kind === K.VariableStatement) {
        const isConst = !!(st.declarationList.flags & T.NodeFlags.Const);
        for (const d of st.declarationList.declarations) {
          if (!T.isIdentifier(d.name)) continue;
          const t = checker.getTypeAtLocation(d.name);
          out.push({ kind: "var", keyword: isConst ? "const" : "let", name: d.name.text, annotated: !!d.type,
            model: toModel(t, ctx), typeStr: typeStr(t), init: d.initializer ? d.initializer.getText(sf) : "", initValue: staticValue(d.initializer) });
        }
      } else if (st.kind === K.FunctionDeclaration && st.name) {
        const t = checker.getTypeAtLocation(st.name);
        out.push({ kind: "fn", name: st.name.text, model: toModel(t, ctx), typeStr: typeStr(t) });
      } else if (st.kind === K.TypeAliasDeclaration) {
        const tps = (st.typeParameters || []).map((p) => p.name.text);
        const t = checker.getTypeAtLocation(st.name);
        const full = checker.typeToString(t, st, T.TypeFormatFlags.NoTruncation | T.TypeFormatFlags.InTypeAlias);
        out.push({ kind: "alias", name: st.name.text, tps, typeText: st.type.getText(sf), typeNode: K[st.type.kind],
          model: toModel(t, ctx, 0, true), typeStr: tps.length ? st.type.getText(sf) : full, full });
      } else if (st.kind === K.InterfaceDeclaration) {
        const sym = checker.getSymbolAtLocation(st.name);
        const t = checker.getDeclaredTypeOfSymbol(sym);
        out.push({ kind: "interface", name: st.name.text, model: toModel(t, ctx, 0, true), typeStr: "interface " + st.name.text });
      } else if (st.kind === K.EnumDeclaration) {
        const sym = checker.getSymbolAtLocation(st.name);
        const t = checker.getDeclaredTypeOfSymbol(sym);
        out.push({ kind: "enum", name: st.name.text, members: st.members.map((m) => m.name.getText(sf)), model: toModel(t, ctx, 0, true), typeStr: "enum " + st.name.text });
      } else if (st.kind === K.ClassDeclaration && st.name) {
        const sym = checker.getSymbolAtLocation(st.name);
        const inst = checker.getDeclaredTypeOfSymbol(sym);
        const stat = checker.getTypeOfSymbolAtLocation(sym, st.name);
        const ctor = checker.getSignaturesOfType(stat, T.SignatureKind.Construct)[0];
        out.push({ kind: "class", name: st.name.text, model: toModel(inst, ctx, 0, true),
          ctor: ctor ? ctor.parameters.map((p) => ({ name: p.name, m: toModel(checker.getTypeOfSymbolAtLocation(p, st), ctx, 1) })) : [],
          typeStr: "class " + st.name.text });
      } else if (st.kind === K.ExpressionStatement) {
        const e = st.expression;
        const isAssign = T.isBinaryExpression(e) && e.operatorToken.kind === K.EqualsToken;
        const t = checker.getTypeAtLocation(isAssign ? e.left : e);
        out.push({ kind: "expr", name: isAssign ? e.left.getText(sf) : "", text: e.getText(sf), isCall: T.isCallExpression(e), isAssign,
          isNew: T.isNewExpression(e), model: toModel(t, ctx), typeStr: typeStr(t) });
      } else {
        out.push({ kind: "stmt", text: st.getText(sf), model: null, typeStr: "" });
      }
    } catch (err) {
      out.push({ kind: "stmt", text: st.getText(sf), model: null, typeStr: "" });
    }
    return out;
  }

  // Literal initializers can be shown before the code runs (so shapes fill in while typing)
  function staticValue(n, depth = 0) {
    if (!n || depth > 3) return undefined;
    const K = T.SyntaxKind;
    switch (n.kind) {
      case K.StringLiteral: case K.NoSubstitutionTemplateLiteral: return n.text;
      case K.NumericLiteral: return Number(n.text);
      case K.TrueKeyword: return true;
      case K.FalseKeyword: return false;
      case K.NullKeyword: return null;
      case K.ParenthesizedExpression: case K.AsExpression: case K.SatisfiesExpression: return staticValue(n.expression, depth);
      case K.PrefixUnaryExpression: { const v = staticValue(n.operand, depth); return n.operator === K.MinusToken && typeof v === "number" ? -v : undefined; }
      case K.ArrayLiteralExpression: { const out = []; for (const el of n.elements) { const v = staticValue(el, depth + 1); if (v === undefined) return undefined; out.push(v); } return { $arr: out }; }
      case K.ObjectLiteralExpression: {
        const o = {};
        for (const p of n.properties) {
          if (!T.isPropertyAssignment(p) || !(T.isIdentifier(p.name) || T.isStringLiteral(p.name))) return undefined;
          const v = staticValue(p.initializer, depth + 1); if (v === undefined) return undefined; o[p.name.text] = v;
        }
        return { $obj: o };
      }
    }
    return undefined;
  }

  // ── Types → visual model
  function isReadonly(p) {
    const cf = (p.links && p.links.checkFlags) || p.checkFlags || 0;
    if (cf & 262144) return !!(cf & 8); // mapped property: its own modifier decides
    if (cf & 8) return true;
    return (p.declarations || []).some((d) => (T.getCombinedModifierFlags(d) & T.ModifierFlags.Readonly) !== 0);
  }
  function isPrivate(p) {
    if (p.name && p.name.startsWith("#")) return true;
    return (p.declarations || []).some((d) => (T.getCombinedModifierFlags(d) & T.ModifierFlags.Private) !== 0);
  }
  function nameOf(t) {
    if (t.aliasSymbol) return t.aliasSymbol.name + (t.aliasTypeArguments && t.aliasTypeArguments.length ? "<…>" : "");
    const s = t.symbol;
    if (s && !/^__/.test(s.name) && (t.objectFlags & (T.ObjectFlags.Interface | T.ObjectFlags.Class | T.ObjectFlags.Reference))) return s.name;
    return null;
  }

  function toModel(t, ctx, d = 0, expand = false) {
    const { checker, sf } = ctx;
    const F = T.TypeFlags;
    const text = checker.typeToString(t, undefined, T.TypeFormatFlags.NoTruncation);
    if (d > 4) return { k: "ref", name: text };
    if (t.flags & F.Any) return { k: "any" };
    if (t.flags & F.Unknown) return { k: "unknown" };
    if (t.flags & F.Never) return { k: "never" };
    if (t.flags & F.Void) return { k: "void" };
    if (t.flags & F.Undefined) return { k: "undef" };
    if (t.flags & F.Null) return { k: "null" };
    if (t.flags & F.BooleanLiteral) return { k: "lit", base: "bool", v: t.intrinsicName === "true" };
    if (t.flags & F.StringLiteral) return { k: "lit", base: "str", v: t.value };
    if (t.flags & F.NumberLiteral) return { k: "lit", base: "num", v: t.value };
    if (t.flags & F.Boolean) return { k: "bool" };
    if (t.flags & F.String) return { k: "str" };
    if (t.flags & F.Number) return { k: "num" };
    if (t.flags & F.BigInt) return { k: "other", text };
    if (t.flags & F.TypeParameter) return { k: "param", name: (t.symbol && t.symbol.name) || text };
    if (t.flags & F.Union) {
      let types = t.types.slice();
      const hasT = types.some((x) => x.flags & F.BooleanLiteral && x.intrinsicName === "true");
      const hasF = types.some((x) => x.flags & F.BooleanLiteral && x.intrinsicName === "false");
      const items = [];
      let boolDone = false;
      for (const x of types) {
        if (hasT && hasF && x.flags & F.BooleanLiteral) { if (!boolDone) { items.push({ k: "bool" }); boolDone = true; } continue; }
        items.push(toModel(x, ctx, d + 1));
      }
      return { k: "union", items: items.slice(0, 8), name: t.aliasSymbol && d > 0 ? t.aliasSymbol.name : null, text };
    }
    if (t.flags & (F.Object | F.Intersection)) {
      if (checker.isArrayType(t)) return { k: "arr", el: toModel(checker.getTypeArguments(t)[0], ctx, d + 1), text };
      if (checker.isTupleType(t)) return { k: "tup", els: checker.getTypeArguments(t).map((x) => toModel(x, ctx, d + 1)), text };
      const name = nameOf(t);
      const sym = t.symbol;
      const isClass = !!(sym && sym.flags & T.SymbolFlags.Class);
      if (name && name.startsWith("Promise")) {
        const args = checker.getTypeArguments ? checker.getTypeArguments(t) : [];
        return { k: "box", name: "Promise", inner: args[0] ? toModel(args[0], ctx, d + 1) : { k: "unknown" } };
      }
      if (name && d >= 2 && !expand) return { k: "ref", name };
      const calls = checker.getSignaturesOfType(t, T.SignatureKind.Call);
      const props = checker.getPropertiesOfType(t);
      if (calls.length && !props.length) return fnModel(calls[0], ctx, d);
      const idx = checker.getIndexInfosOfType(t);
      const typeOf = (p) => checker.getTypeOfSymbolAtLocation(p, sf);
      return {
        k: "obj", name: d > 0 || expand ? name : name, cls: isClass ? sym.name : null, inter: !!(t.flags & F.Intersection),
        props: props.slice(0, 10).map((p) => ({
          name: p.name, opt: !!(p.flags & T.SymbolFlags.Optional), ro: isReadonly(p), priv: isPrivate(p),
          method: !!(p.flags & T.SymbolFlags.Method), m: optModel(p, toModel(typeOf(p), ctx, d + 1))
        })),
        more: Math.max(0, props.length - 10),
        index: idx.map((i) => ({ key: checker.typeToString(i.keyType), m: toModel(i.type, ctx, d + 1) })),
        text
      };
    }
    if (t.flags & F.Conditional) return { k: "other", text };
    return { k: "other", text };
  }

  // Optional fields are drawn dashed, so "| undefined" would be noise
  function optModel(p, m) {
    if (!(p.flags & T.SymbolFlags.Optional) || m.k !== "union") return m;
    const items = m.items.filter((i) => i.k !== "undef");
    return items.length === 1 ? items[0] : { ...m, items };
  }

  function fnModel(sig, ctx, d) {
    const { checker, sf } = ctx;
    return {
      k: "fn",
      tps: (sig.typeParameters || []).map((tp) => tp.symbol.name),
      params: sig.parameters.map((p) => {
        const decl = p.valueDeclaration;
        return { name: p.name, opt: !!(decl && (decl.questionToken || decl.initializer)), m: toModel(checker.getTypeOfSymbolAtLocation(p, decl || sf), ctx, d + 1) };
      }),
      ret: toModel(checker.getReturnTypeOfSignature(sig), ctx, d + 1)
    };
  }

  // ── Error translation: plain English + optional "doesn't fit" visual
  function nodeAt(sf, pos) {
    let found = sf;
    (function visit(n) {
      if (pos >= n.getStart(sf) && pos < n.end) { found = n; T.forEachChild(n, visit); }
    })(sf);
    return found;
  }

  function mismatch(c, diag) {
    const { sf, checker } = c.ctx;
    let n = nodeAt(sf, diag.start);
    const K = T.SyntaxKind;
    for (let i = 0; n && i < 8; i++, n = n.parent) {
      if (n.kind === K.VariableDeclaration && n.initializer && n.type) return [checker.getTypeAtLocation(n.initializer), checker.getTypeAtLocation(n.name)];
      if (n.kind === K.BinaryExpression && n.operatorToken.kind === K.EqualsToken) return [checker.getTypeAtLocation(n.right), checker.getTypeAtLocation(n.left)];
      if (n.parent && T.isCallExpression(n.parent) && n.parent.arguments.includes(n)) {
        const ctxT = checker.getContextualType(n);
        if (ctxT) return [checker.getTypeAtLocation(n), ctxT];
      }
    }
    return null;
  }

  function translate(diag, c) {
    const q = [...diag.message.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    const code = diag.code;
    let title = "TypeScript has a problem with this line", body = diag.message, visual = null;
    const vis = () => {
      const pair = mismatch(c, diag);
      if (pair) visual = { from: toModel(pair[0], c.ctx), to: toModel(pair[1], c.ctx) };
    };
    switch (code) {
      case 2322: title = "That doesn't fit"; body = `This value is ${q[0]}, but the slot only accepts ${q[1]}.`; vis(); break;
      case 2345: title = "Wrong kind of argument"; body = `You passed ${q[0]}, but that parameter wants ${q[1]}.`; vis(); break;
      case 7006: case 7031: title = "TypeScript won't guess"; body = `'${q[0]}' has no type. In strict mode every parameter needs one, like (${q[0]}: string).`; break;
      case 18047: case 2531: title = "Might be null"; body = `'${q[0] || "this"}' could be null here. Check it first: if (x !== null) or x?.prop.`; break;
      case 18048: case 2532: title = "Might be undefined"; body = `'${q[0] || "this"}' could be undefined here. Check it first, or use ?. and ??.`; break;
      case 18049: case 2533: title = "Might be null or undefined"; body = `'${q[0] || "this"}' could be missing. Check it before using it.`; break;
      case 2540: title = "Read-only"; body = `'${q[0]}' is readonly. You can look at it, but you can't change it.`; break;
      case 2341: title = "Private"; body = `'${q[0]}' is private: only code inside ${q[1] || "the class"} can touch it.`; break;
      case 2445: title = "Protected"; body = `'${q[0]}' is protected: only the class and its subclasses can use it.`; break;
      case 2588: title = "It's a const"; body = `'${q[0]}' is a constant, so it can't be reassigned. Declare it with let if it needs to change.`; break;
      case 2304: title = "Never heard of it"; body = `Nothing called '${q[0]}' exists yet. Declare it first, or check the spelling.`; break;
      case 2552: title = "Typo?"; body = `There's no '${q[0]}'. Did you mean '${q[1]}'?`; break;
      case 2339: title = "No such property"; body = `${q[1]} doesn't have a property called '${q[0]}'.`; break;
      case 2551: title = "Typo?"; body = `There's no '${q[0]}' on ${q[1]}. Did you mean '${q[2]}'?`; break;
      case 2554: { const m = diag.message.match(/Expected (\d+) arguments?, but got (\d+)/); title = "Wrong number of arguments"; body = m ? `This function takes ${m[1]}, and you gave it ${m[2]}.` : diag.message; break; }
      case 2555: title = "Not enough arguments"; body = diag.message.replace(/\.$/, "") + "."; break;
      case 2451: case 2300: case 2393: title = "Name already taken"; body = `You already declared '${q[0]}'. Pick a new name, or type /clear to start fresh.`; break;
      case 2349: title = "Not a function"; body = "This value isn't callable, so it can't be used with ( )."; break;
      case 2741: title = "Missing a field"; body = `'${q[0]}' is required by ${q[2] || "the type"}, but it's missing.`; break;
      case 2739: title = "Missing fields"; body = `${q[0]} is missing fields that ${q[1]} requires.`; break;
      case 2353: title = "Unknown field"; body = `'${q[0]}' isn't part of ${q[1]}. Object literals can only have the fields the type lists.`; break;
      case 2367: title = "Can never be equal"; body = `${q[0]} and ${q[1]} have nothing in common, so this comparison is always false.`; break;
      case 2362: case 2363: case 2365: title = "Can't do math with that"; body = "Arithmetic only works on numbers (and bigint)."; break;
      case 2493: title = "Out of bounds"; body = diag.message.replace(/^Tuple type '([^']+)' of length '(\d+)' has no element at index '(\d+)'\.?$/, "This tuple has $2 slots, so index $3 doesn't exist."); break;
      case 2511: title = "Abstract"; body = "An abstract class can't be created directly. Extend it first."; break;
      case 2420: title = "Contract not met"; body = `${q[0]} doesn't have everything ${q[1]} requires.`; break;
      case 1360: title = "Doesn't satisfy"; body = `This value doesn't satisfy ${q[1] || "the type"}.`; break;
      case 2348: title = "Needs new"; body = "Classes are created with new, like new Dog()."; break;
      default:
        if (diag.syntax) { title = "Looks unfinished"; body = diag.message.replace(/\.$/, "") + "."; }
    }
    let path = mismatchPath(diag.chain);
    if (!path && (code === 2322 || code === 2345) && q.length >= 2) {
      const p = propPath(c.ctx.sf, diag.start);
      if (p) path = { path: p, from: q[0], to: q[1] };
    }
    return { code, title, body, raw: diag.message, visual, path };
  }

  // For errors reported on a nested property: the property names from the variable down to it
  function propPath(sf, pos) {
    let n = nodeAt(sf, pos);
    const parts = [];
    for (let i = 0; n && i < 20; i++, n = n.parent) {
      if (T.isPropertyAssignment(n) || T.isShorthandPropertyAssignment(n)) parts.unshift(n.name.getText(sf));
      if (T.isVariableDeclaration(n) || T.isCallExpression(n) || T.isBinaryExpression(n) || T.isReturnStatement(n)) break;
    }
    return parts.length > 1 ? parts.join(".") : null;
  }

  // Walk the diagnostic chain to find where, inside a nested value, the mismatch happens
  function mismatchPath(chain) {
    if (!chain || typeof chain === "string") return null;
    const path = [];
    let leaf = null, node = chain, r;
    while (node && typeof node !== "string") {
      const m = node.messageText;
      if ((r = m.match(/^Types of property '([^']+)' are incompatible/))) path.push(r[1]);
      else if ((r = m.match(/^The types of '([^']+)' are incompatible/))) path.push(...r[1].split("."));
      else if ((r = m.match(/^Property '([^']+)' is missing in type/))) { path.push(r[1]); leaf = { missing: true }; }
      else if ((r = m.match(/^Type '(.+)' is not assignable to type '(.+)'\.$/)) && !(leaf && leaf.missing)) leaf = { from: r[1], to: r[2] };
      node = node.next && node.next[0];
    }
    return path.length && leaf ? { path: path.join("."), ...leaf } : null;
  }

  // ── Inline hints: what the compiler knows that the code doesn't say
  function hints(c) {
    const { sf, checker } = c;
    const K = T.SyntaxKind, F = T.TypeFormatFlags.NoTruncation;
    const str = (t) => checker.typeToString(t, undefined, F);
    const line = (pos) => sf.getLineAndCharacterOfPosition(pos).line;
    const H = [];
    const seen = new Set();
    const tidy = (s) => s.replace(/\?: ([^;{}]+?) \| undefined;/g, "?: $1;");
    const add = (node, kind, text, extra) => {
      const l = line(node.getStart ? node.getStart(sf) : node);
      const key = l + kind + text;
      if (seen.has(key)) return;
      seen.add(key);
      H.push({ line: l, kind, text: tidy(text), ...extra });
    };
    const isLiteralInit = (n) => n && [K.StringLiteral, K.NumericLiteral, K.TrueKeyword, K.FalseKeyword, K.NoSubstitutionTemplateLiteral].includes(n.kind);

    for (const st of sf.statements) {
      try {
        if (T.isVariableStatement(st)) {
          const isConst = !!(st.declarationList.flags & T.NodeFlags.Const);
          for (const d of st.declarationList.declarations) {
            if (!T.isIdentifier(d.name) || d.type) continue;
            const t = checker.getTypeAtLocation(d.name);
            let note = "";
            if (isLiteralInit(d.initializer)) note = isConst ? "literal" : "widened";
            add(d.name, "decl", `${d.name.text}: ${str(t)}`, { note });
          }
        } else if (T.isFunctionDeclaration(st) && st.name && !st.type && st.body) {
          const sig = checker.getSignatureFromDeclaration(st);
          if (sig) add(st.name, "ret", `returns ${str(checker.getReturnTypeOfSignature(sig))}`);
        } else if (T.isClassDeclaration(st)) {
          for (const m of st.members) {
            if (T.isMethodDeclaration(m) && !m.type && m.body) {
              const sig = checker.getSignatureFromDeclaration(m);
              if (sig) add(m.name, "ret", `returns ${str(checker.getReturnTypeOfSignature(sig))}`);
            }
          }
        } else if (T.isTypeAliasDeclaration(st) && !(st.typeParameters && st.typeParameters.length)) {
          const t = checker.getTypeAtLocation(st.name);
          const full = checker.typeToString(t, st, F | T.TypeFormatFlags.InTypeAlias);
          const norm = (s) => s.replace(/[\s;|,]/g, "");
          if (norm(full) !== norm(st.type.getText(sf))) add(st.name, "expand", "= " + full);
          const steps = distribution(c, st);
          if (steps) H.push({ line: line(st.getStart(sf)), kind: "steps", steps });
        } else if (T.isEnumDeclaration(st)) {
          add(st.name, "expand", st.members.map((m) => `${m.name.getText(sf)} = ${checker.getConstantValue(m)}`).join(" · "));
        } else if (T.isExpressionStatement(st)) {
          const e = st.expression;
          const isAssign = T.isBinaryExpression(e) && e.operatorToken.kind === K.EqualsToken;
          if (!isAssign) add(e, "type", str(checker.getTypeAtLocation(e)), { stmtStart: st.getStart(sf) });
        }
      } catch (err) { /* hints are best effort */ }
    }

    // Narrowing and generic inference, anywhere in the file
    (function walk(n) {
      try {
        if (T.isIdentifier(n) && n.parent && !isDeclName(n) && !(T.isPropertyAccessExpression(n.parent) && n.parent.name === n) && !T.isPartOfTypeNode(n)) {
          const sym = checker.getSymbolAtLocation(n);
          if (sym && sym.flags & (T.SymbolFlags.FunctionScopedVariable | T.SymbolFlags.BlockScopedVariable) && sym.valueDeclaration) {
            const declared = str(checker.getTypeOfSymbolAtLocation(sym, sym.valueDeclaration));
            const here = str(checker.getTypeAtLocation(n));
            if (declared !== here) add(n, "narrow", `${n.text}: ${here}`);
          }
        }
        if ((T.isCallExpression(n) || T.isNewExpression(n)) && !n.typeArguments) {
          const sig = checker.getResolvedSignature(n);
          const target = sig && sig.target;
          const own = target && target.declaration && target.declaration.getSourceFile && target.declaration.getSourceFile().fileName === "session.ts";
          if (own && target.typeParameters && sig.mapper) {
            const parts = target.typeParameters.map((tp) => {
              const v = mapType(sig.mapper, tp);
              return v ? `${tp.symbol.name} = ${str(v)}` : null;
            }).filter(Boolean);
            if (parts.length) add(n, "infer", parts.join(", "));
          }
        }
      } catch (err) {}
      T.forEachChild(n, walk);
    })(sf);
    return H;
  }

  function isDeclName(n) {
    const p = n.parent;
    return (p.name === n && (T.isVariableDeclaration(p) || T.isParameter(p) || T.isFunctionDeclaration(p) || T.isPropertyAssignment(p) ||
      T.isPropertyDeclaration(p) || T.isMethodDeclaration(p) || T.isClassDeclaration(p) || T.isBindingElement(p) || T.isPropertySignature(p)));
  }

  function mapType(mapper, tp) {
    switch (mapper.kind) {
      case 0: return mapper.source === tp ? mapper.target : null;
      case 1: { const i = mapper.sources.indexOf(tp); return i >= 0 && mapper.targets ? mapper.targets[i] : null; }
      case 2: { const i = mapper.sources.indexOf(tp); return i >= 0 ? mapper.targets[i]() : null; }
      default: return null;
    }
  }

  // A distributive conditional type applied to a union: evaluate each member separately
  const distCache = new Map();
  function distribution(c, st) {
    const { sf, checker } = c;
    const ref = st.type;
    if (!T.isTypeReferenceNode(ref) || !ref.typeArguments || ref.typeArguments.length !== 1) return null;
    const sym = checker.getSymbolAtLocation(ref.typeName);
    const decl = sym && sym.declarations && sym.declarations[0];
    if (!decl || !T.isTypeAliasDeclaration(decl) || !decl.typeParameters || !T.isConditionalTypeNode(decl.type)) return null;
    const ct = decl.type.checkType;
    if (!T.isTypeReferenceNode(ct) || ct.typeName.getText(sf) !== decl.typeParameters[0].name.text) return null;
    const arg = checker.getTypeFromTypeNode(ref.typeArguments[0]);
    if (!arg.isUnion()) return null;
    const members = arg.types.map((m) => checker.typeToString(m));
    const alias = decl.name.text;
    const key = c.text + "|" + alias + "|" + members.join(",");
    if (distCache.has(key)) return distCache.get(key);
    const probe = members.map((m, i) => `type __d${i} = ${alias}<${m}>`).join("\n");
    const sf2 = T.createSourceFile("session.ts", c.text + "\n" + probe, T.ScriptTarget.ES2020, true);
    const host = { getSourceFile: (f) => (f === "session.ts" ? sf2 : libs[f]), getDefaultLibFileName: () => "lib.es5.d.ts", writeFile() {}, getCurrentDirectory: () => "/",
      getDirectories: () => [], fileExists: (f) => f === "session.ts" || !!libs[f], readFile: () => "", getCanonicalFileName: (f) => f, useCaseSensitiveFileNames: () => true, getNewLine: () => "\n" };
    const prog = T.createProgram({ rootNames: [...LIB_NAMES, "session.ts"], options, host });
    const ch = prog.getTypeChecker();
    const tail = sf2.statements.slice(-members.length);
    const steps = tail.map((s, i) => ({ from: `${alias}<${members[i]}>`, to: ch.typeToString(ch.getTypeAtLocation(s.name), s, T.TypeFormatFlags.NoTruncation | T.TypeFormatFlags.InTypeAlias) }));
    distCache.set(key, steps);
    return steps;
  }

  // ── Build runnable JS: last expression captured as __last, variables captured by name
  function runnable(c) {
    const { sf, curStart } = c;
    let text = c.text;
    const stmts = sf.statements.filter((s) => s.getStart(sf) >= curStart);
    const last = stmts[stmts.length - 1];
    if (last && T.isExpressionStatement(last)) {
      const s = last.getStart(sf), e = last.end;
      text = text.slice(0, s) + "__last = (" + last.expression.getText(sf) + ");" + text.slice(e);
    }
    const names = c.entities.filter((e) => e.kind === "var").map((e) => e.name);
    text += "\n;__vars({" + names.map((n) => `${JSON.stringify(n)}: __try(() => ${n})`).join(", ") + "});";
    return T.transpileModule(text, { compilerOptions: { target: T.ScriptTarget.ES2020, module: T.ModuleKind.CommonJS } }).outputText;
  }

  // ── Syntax highlighting tokens for the prompt and history
  function highlight(src) {
    if (!T) return [[src, ""]];
    const scanner = T.createScanner(T.ScriptTarget.ES2020, false, T.LanguageVariant.Standard, src);
    const out = [];
    let tok, prev = 0;
    const K = T.SyntaxKind;
    while ((tok = scanner.scan()) !== K.EndOfFileToken) {
      const start = scanner.getTokenPos ? scanner.getTokenPos() : scanner.getTokenStart();
      if (start > prev) out.push([src.slice(prev, start), ""]);
      const s = src.slice(start, scanner.getTextPos());
      let cls = "";
      if (tok >= K.FirstKeyword && tok <= K.LastKeyword) cls = "kw";
      else if (tok === K.StringLiteral || tok === K.NoSubstitutionTemplateLiteral || (tok >= K.TemplateHead && tok <= K.TemplateTail)) cls = "st";
      else if (tok === K.NumericLiteral) cls = "nu";
      else if (tok === K.Identifier) cls = /^[A-Z]/.test(s) ? "ty" : "id";
      else if (tok === K.SingleLineCommentTrivia || tok === K.MultiLineCommentTrivia) cls = "cm";
      else cls = "pu";
      out.push([s, cls]);
      prev = scanner.getTextPos();
    }
    if (prev < src.length) out.push([src.slice(prev), ""]);
    return out;
  }

  root.Engine = { compile, translate, runnable, highlight, hints, version: () => (T ? T.version : "") };
})(typeof window !== "undefined" ? window : globalThis);
