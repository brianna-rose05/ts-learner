// The path: 4 levels, each made of units. Each unit runs in a fresh session.
// expect: { err: [codes] } passes when the line is rejected with one of those codes.
//         { name, kind, type, shape, result, check } passes when the line is accepted and matches.
(function (root) {
  const PATH = [
    { level: "Beginner", units: [
      { name: "Values", missions: [
        { t: "Inferred type", d: "Declare a variable. TypeScript infers its type.", code: 'let greeting = "hello"', expect: { name: "greeting", type: "string" } },
        { t: "Type mismatch", d: "Assign a number to greeting.", code: "greeting = 42", expect: { err: [2322] } },
        { t: "Annotation", d: "State the type yourself.", code: "let age: number = 30", expect: { name: "age", type: "number" } },
        { t: "Boolean", d: "Two possible values.", code: "const isAdmin: boolean = false", expect: { name: "isAdmin", type: "boolean" } },
        { t: "Literal type", d: "An unannotated const gets its exact value as its type.", code: "const pi = 3.14", expect: { name: "pi", type: "3.14" } }
      ]},
      { name: "Arrays & tuples", missions: [
        { t: "Array", d: "Every element has the same type.", code: "let scores: number[] = [90, 85, 77]", expect: { name: "scores", type: "number[]" } },
        { t: "Wrong element", d: "Push a string into it.", code: 'scores.push("100")', expect: { err: [2345] } },
        { t: "Tuple", d: "Fixed length, a type per position.", code: 'const pair: [string, number] = ["apples", 3]', expect: { name: "pair", type: "[string, number]" } },
        { t: "Out of bounds", d: "Read a position that doesn't exist.", code: "pair[2]", expect: { err: [2493] } },
        { t: "Readonly array", d: "An array that can't be changed.", code: 'const names: readonly string[] = ["Ada", "Grace"]', expect: { name: "names", type: "readonly string[]" } },
        { t: "No mutation", d: "Try to change it.", code: 'names.push("Linus")', expect: { err: [2339] } }
      ]},
      { name: "Objects", missions: [
        { t: "Object", d: "TypeScript infers each property.", code: 'const user = { name: "Ada", age: 36 }', expect: { name: "user", shape: "{age:number;name:string}" } },
        { t: "Unknown property", d: "Read a property that isn't there.", code: "user.email", expect: { err: [2339] } },
        { t: "Type alias", d: "Name an object shape.", code: "type Point = { x: number; y: number }", expect: { name: "Point", kind: "alias", shape: "{x:number;y:number}" } },
        { t: "Missing property", d: "Leave a required property out.", code: "const p: Point = { x: 1 }", expect: { err: [2741] } },
        { t: "Optional property", d: "A ? makes a property optional.", code: "type Pet = { name: string; age?: number }", expect: { name: "Pet", shape: "{age?:number;name:string}" } },
        { t: "Interface", d: "Shift+Enter starts a new line.", code: "interface Account {\n  readonly id: number\n  name: string\n}", expect: { name: "Account", kind: "interface", shape: "{readonly id:number;name:string}" } },
        { t: "Use the interface", d: "Create a value of that type.", code: 'const acct: Account = { id: 1, name: "Ada" }', expect: { name: "acct" } },
        { t: "Readonly property", d: "Try to change the id.", code: "acct.id = 2", expect: { err: [2540] } }
      ]},
      { name: "Functions", missions: [
        { t: "Parameters", d: "Type the inputs. The return type is inferred.", code: "function add(a: number, b: number) {\n  return a + b\n}", expect: { name: "add", shape: "(number,number)=>number" } },
        { t: "Call", d: "Run it.", code: "add(2, 3)", expect: { result: 5 } },
        { t: "Wrong argument", d: "Pass a string.", code: 'add("2", 3)', expect: { err: [2345] } },
        { t: "Arity", d: "Pass too few arguments.", code: "add(1)", expect: { err: [2554] } },
        { t: "Default parameter", d: "A default value also sets the type.", code: 'function greet(name: string, greeting = "Hello") {\n  return `${greeting}, ${name}`\n}', expect: { name: "greet", shape: "(string,string)=>string" } },
        { t: "Arrow function", d: "Annotate the return type explicitly.", code: "const double = (n: number): number => n * 2", expect: { name: "double", shape: "(number)=>number" } },
        { t: "void", d: "A function that returns nothing.", code: "function log(message: string): void {\n  console.log(message)\n}", expect: { name: "log", shape: "(string)=>void" } },
        { t: "Implicit any", d: "Leave a parameter untyped.", code: "function echo(x) {\n  return x\n}", expect: { err: [7006] } }
      ]},
      { name: "Unions", missions: [
        { t: "Union", d: "One of several types.", code: "let id: string | number = 7", expect: { name: "id", shape: "number|string" } },
        { t: "Literal union", d: "A fixed set of values.", code: 'type Size = "S" | "M" | "L"', expect: { name: "Size", shape: '"L"|"M"|"S"' } },
        { t: "Outside the set", d: "Use a value that isn't in the set.", code: 'const size: Size = "XL"', expect: { err: [2322] } },
        { t: "Nullable", d: "null must be allowed explicitly.", code: "let nickname: string | null = null", expect: { name: "nickname", shape: "null|string" } },
        { t: "Possibly null", d: "Use it without checking.", code: "nickname.length", expect: { err: [18047] } },
        { t: "typeof", d: "Check the type, then use it.", code: 'function format(id: string | number) {\n  return typeof id === "string" ? id.toUpperCase() : id.toFixed(2)\n}', expect: { name: "format", shape: "(number|string)=>string" } }
      ]}
    ]},
    { level: "Intermediate", units: [
      { name: "Narrowing", missions: [
        { t: "if / else", d: "Each branch knows which type it has.", code: 'function padLeft(padding: number | string, input: string) {\n  if (typeof padding === "number") {\n    return " ".repeat(padding) + input\n  }\n  return padding + input\n}', expect: { name: "padLeft", shape: "(number|string,string)=>string" } },
        { t: "Two shapes", d: "Declare two object types.", code: "type Fish = { swim: () => string }\ntype Bird = { fly: () => string }", expect: { name: "Bird", kind: "alias" } },
        { t: "in", d: "Check for a property only one of them has.", code: 'function move(a: Fish | Bird) {\n  if ("swim" in a) return a.swim()\n  return a.fly()\n}', expect: { name: "move", shape: "(Bird|Fish)=>string" } },
        { t: "Discriminated union", d: "Every member carries a kind tag.", code: 'type Shape =\n  | { kind: "circle"; r: number }\n  | { kind: "square"; side: number }', expect: { name: "Shape", kind: "alias" } },
        { t: "switch", d: "Switch on the tag.", code: 'function area(s: Shape): number {\n  switch (s.kind) {\n    case "circle": return Math.PI * s.r ** 2\n    case "square": return s.side ** 2\n  }\n}', expect: { name: "area", shape: "(Shape)=>number" } },
        { t: "Exhaustiveness", d: "Leftover cases can't be assigned to never.", code: 'function check(s: Shape) {\n  if (s.kind === "circle") return\n  const rest: never = s\n}', expect: { err: [2322] } },
        { t: "Type predicate", d: "A function that narrows its argument.", code: 'function isString(x: unknown): x is string {\n  return typeof x === "string"\n}', expect: { name: "isString", kind: "fn" } },
        { t: "Filter", d: "filter understands predicates.", code: '[1, "a", 2, "b"].filter(isString)', expect: { type: "string[]" } }
      ]},
      { name: "Generics", missions: [
        { t: "Type parameter", d: "T is filled in on every call.", code: "function first<T>(arr: T[]): T | undefined {\n  return arr[0]\n}", expect: { name: "first", kind: "fn", check: (c) => c.ent.model.tps.length === 1 } },
        { t: "Inference", d: "T becomes string.", code: 'first(["a", "b"])', expect: { type: "string | undefined", result: "a" } },
        { t: "Constraint", d: "Require a length property.", code: "function longest<T extends { length: number }>(a: T, b: T) {\n  return a.length >= b.length ? a : b\n}", expect: { name: "longest", kind: "fn" } },
        { t: "Constraint violated", d: "Pass numbers.", code: "longest(10, 20)", expect: { err: [2345] } },
        { t: "Generic type", d: "Types can take parameters too.", code: "type Box<T> = { value: T }", expect: { name: "Box", kind: "alias" } },
        { t: "Wrong contents", d: "Put a string in a number box.", code: 'const box: Box<number> = { value: "1" }', expect: { err: [2322] } },
        { t: "Two parameters", d: "Generics can relate several types.", code: "function pair<A, B>(a: A, b: B): [A, B] {\n  return [a, b]\n}", expect: { name: "pair", check: (c) => c.ent.model.tps.length === 2 } },
        { t: "Default type", d: "A type parameter can have a default.", code: 'type Res<T = string> = { data: T }\nconst res: Res = { data: "ok" }', expect: { name: "res", shape: "{data:string}" } }
      ]},
      { name: "Classes", missions: [
        { t: "Class", d: "Parameter properties declare and assign in one step.", code: "class Point {\n  constructor(public x: number, public y: number) {}\n  distance() {\n    return Math.hypot(this.x, this.y)\n  }\n}", expect: { name: "Point", kind: "class" } },
        { t: "Instance", d: "Create one and call a method.", code: "new Point(3, 4).distance()", expect: { result: 5 } },
        { t: "private", d: "Only the class can see it.", code: "class Wallet {\n  private balance = 0\n  deposit(n: number) {\n    this.balance += n\n  }\n}", expect: { name: "Wallet", kind: "class" } },
        { t: "Access denied", d: "Read it from outside.", code: "new Wallet().balance", expect: { err: [2341] } },
        { t: "implements", d: "Promise to satisfy an interface.", code: 'interface Named {\n  name: string\n}\nclass Cat implements Named {\n  name = "Tom"\n}', expect: { name: "Cat", kind: "class" } },
        { t: "Broken promise", d: "Implement it without the property.", code: "class Dog implements Named {}", expect: { err: [2420] } },
        { t: "abstract", d: "Subclasses must fill in abstract members.", code: 'abstract class Animal {\n  abstract sound(): string\n  speak() {\n    return this.sound() + "!"\n  }\n}', expect: { name: "Animal", kind: "class" } },
        { t: "Can't instantiate", d: "Create one directly.", code: "new Animal()", expect: { err: [2511] } }
      ]},
      { name: "Async", missions: [
        { t: "async", d: "An async function returns a Promise.", code: 'async function getUser() {\n  return { id: 1, name: "Ada" }\n}', expect: { name: "getUser", shape: "()=>Promise" } },
        { t: "Awaited", d: "Unwrap the promised type.", code: "type User = Awaited<ReturnType<typeof getUser>>", expect: { name: "User", shape: "{id:number;name:string}" } },
        { t: "Forgot await", d: "Treat the promise as the value.", code: "const u: User = getUser()", expect: { err: [2322, 2739, 2741] } },
        { t: "Promise.all", d: "Each position keeps its own type.", code: 'Promise.all([Promise.resolve(1), Promise.resolve("a")])', expect: { type: "Promise<[number, string]>" } },
        { t: "async arrow", d: "Same rule for arrow functions.", code: "const total = async (xs: number[]) => xs.reduce((a, b) => a + b, 0)", expect: { name: "total", shape: "(number[])=>Promise" } }
      ]},
      { name: "Enums & const", missions: [
        { t: "enum", d: "Named numeric constants.", code: "enum Direction {\n  Up,\n  Down\n}", expect: { name: "Direction", kind: "enum" } },
        { t: "Enum value", d: "Use a member.", code: "const dir: Direction = Direction.Up", expect: { name: "dir", type: "Direction" } },
        { t: "as const", d: "Freeze the exact values.", code: 'const ROLES = ["admin", "editor"] as const', expect: { name: "ROLES", type: 'readonly ["admin", "editor"]' } },
        { t: "Union from data", d: "Index the tuple with number.", code: "type Role = (typeof ROLES)[number]", expect: { name: "Role", shape: '"admin"|"editor"' } },
        { t: "satisfies", d: "Check the type, keep the inferred one.", code: "const ports = { http: 80, https: 443 } satisfies Record<string, number>", expect: { name: "ports", shape: "{http:number;https:number}" } },
        { t: "Not satisfied", d: "Break the constraint.", code: 'const bad = { http: "80" } satisfies Record<string, number>', expect: { err: [2322, 1360] } }
      ]}
    ]},
    { level: "Advanced", units: [
      { name: "Type operators", missions: [
        { t: "keyof", d: "The keys of a type, as a union.", code: "type Keys = keyof { name: string; age: number }", expect: { name: "Keys", shape: '"age"|"name"' } },
        { t: "typeof", d: "Copy the type of a value.", code: 'const settings = { theme: "dark", size: 14 }\ntype Settings = typeof settings', expect: { name: "Settings", shape: "{size:number;theme:string}" } },
        { t: "keyof typeof", d: "Keys of a value.", code: "type SettingKey = keyof typeof settings", expect: { name: "SettingKey", shape: '"size"|"theme"' } },
        { t: "Indexed access", d: "Look up one property's type.", code: 'type Theme = Settings["theme"]', expect: { name: "Theme", type: "string" } },
        { t: "Invalid key", d: "Look up a key that doesn't exist.", code: 'type Color = Settings["color"]', expect: { err: [2339] } },
        { t: "Typed getter", d: "The key decides the return type.", code: "function get<T, K extends keyof T>(obj: T, key: K): T[K] {\n  return obj[key]\n}", expect: { name: "get", kind: "fn" } },
        { t: "Use it", d: "size is a number.", code: 'get(settings, "size")', expect: { type: "number", result: 14 } }
      ]},
      { name: "Utility types", missions: [
        { t: "Base type", d: "Start with a plain object type.", code: "type Todo = { id: number; title: string; done: boolean }", expect: { name: "Todo", kind: "alias" } },
        { t: "Partial", d: "Every property optional.", code: "type Draft = Partial<Todo>", expect: { name: "Draft", shape: "{done?:boolean;id?:number;title?:string}" } },
        { t: "Required", d: "Every property required.", code: "type Full = Required<Draft>", expect: { name: "Full", shape: "{done:boolean;id:number;title:string}" } },
        { t: "Pick", d: "Keep some properties.", code: 'type Preview = Pick<Todo, "id" | "title">', expect: { name: "Preview", shape: "{id:number;title:string}" } },
        { t: "Omit", d: "Drop some properties.", code: 'type NewTodo = Omit<Todo, "id">', expect: { name: "NewTodo", shape: "{done:boolean;title:string}" } },
        { t: "Record", d: "A lookup table type.", code: "type ById = Record<number, Todo>", expect: { name: "ById", shape: "{[number]:Todo}" } },
        { t: "ReturnType", d: "Derive a type from a function.", code: "function make() {\n  return { ok: true, at: 0 }\n}\ntype Made = ReturnType<typeof make>", expect: { name: "Made", shape: "{at:number;ok:boolean}" } }
      ]},
      { name: "Conditional types", missions: [
        { t: "Condition", d: "A ternary for types.", code: "type IsString<T> = T extends string ? true : false", expect: { name: "IsString", kind: "alias" } },
        { t: "Evaluate", d: "Feed it a type.", code: 'type A = IsString<"hi">', expect: { name: "A", type: "true" } },
        { t: "infer", d: "Capture part of the matched type.", code: "type ElementOf<T> = T extends (infer U)[] ? U : never", expect: { name: "ElementOf", kind: "alias" } },
        { t: "Extract", d: "Get the element type.", code: "type E = ElementOf<boolean[]>", expect: { name: "E", type: "boolean" } },
        { t: "Distribution", d: "A union is processed member by member.", code: "type ToArray<T> = T extends unknown ? T[] : never\ntype Arrs = ToArray<string | number>", expect: { name: "Arrs", shape: "number[]|string[]" } },
        { t: "Filter a union", d: "never removes a member.", code: "type NoNull<T> = T extends null | undefined ? never : T\ntype Clean = NoNull<string | null | undefined>", expect: { name: "Clean", type: "string" } }
      ]},
      { name: "Mapped types", missions: [
        { t: "Map keys", d: "Transform every property.", code: "type Flags<T> = { [K in keyof T]: boolean }\ntype F = Flags<{ dark: string; beta: number }>", expect: { name: "F", shape: "{beta:boolean;dark:boolean}" } },
        { t: "Remove readonly", d: "-readonly strips the modifier.", code: "type Mutable<T> = { -readonly [K in keyof T]: T[K] }\ntype M = Mutable<{ readonly id: number }>", expect: { name: "M", shape: "{id:number}" } },
        { t: "Rename keys", d: "as remaps each key.", code: "type Getters<T> = {\n  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K]\n}\ntype G = Getters<{ name: string }>", expect: { name: "G", shape: "{getName:()=>string}" } },
        { t: "Template literal", d: "Build string types from parts.", code: 'type Handler = `on${Capitalize<"click" | "focus">}`', expect: { name: "Handler", shape: '"onClick"|"onFocus"' } },
        { t: "Pattern", d: "Only strings that match.", code: 'type Px = `${number}px`\nconst w: Px = "12em"', expect: { err: [2322] } },
        { t: "Match", d: "A value that fits the pattern.", code: 'type Route = `/${string}`\nconst home: Route = "/home"', expect: { name: "home" } }
      ]}
    ]},
    { level: "Mastery", units: [
      { name: "Recursive types", missions: [
        { t: "Self-reference", d: "A type that contains itself.", code: "type Json =\n  | string | number | boolean | null\n  | Json[]\n  | { [key: string]: Json }", expect: { name: "Json", kind: "alias" } },
        { t: "Valid JSON", d: "Nest it.", code: 'const data: Json = { tags: ["a", 1, { deep: true }] }', expect: { name: "data" } },
        { t: "Invalid JSON", d: "Functions aren't JSON.", code: "const fn: Json = { run: () => 1 }", expect: { err: [2322] } },
        { t: "Deep readonly", d: "Recurse into nested objects.", code: "type DeepReadonly<T> = {\n  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K]\n}", expect: { name: "DeepReadonly", kind: "alias" } },
        { t: "Apply it", d: "A nested config.", code: 'const cfg: DeepReadonly<{ db: { host: string } }> = { db: { host: "x" } }', expect: { name: "cfg" } },
        { t: "Locked all the way down", d: "Change a nested field.", code: 'cfg.db.host = "y"', expect: { err: [2540] } }
      ]},
      { name: "Tuple & string types", missions: [
        { t: "Length", d: "A tuple's length is a literal type.", code: "type Length<T extends readonly unknown[]> = T[\"length\"]\ntype Three = Length<[1, 2, 3]>", expect: { name: "Three", type: "3" } },
        { t: "Head", d: "infer the first element.", code: "type Head<T> = T extends [infer H, ...unknown[]] ? H : never\ntype H = Head<[string, number]>", expect: { name: "H", type: "string" } },
        { t: "Reverse", d: "Recursion over a tuple.", code: "type Reverse<T extends unknown[]> =\n  T extends [infer F, ...infer R] ? [...Reverse<R>, F] : []\ntype Rev = Reverse<[1, 2, 3]>", expect: { name: "Rev", shape: "[3,2,1]" } },
        { t: "Trim", d: "Recursion over a string.", code: 'type Trim<S extends string> = S extends ` ${infer R}` ? Trim<R> : S\ntype T1 = Trim<"   hi">', expect: { name: "T1", type: '"hi"' } },
        { t: "Split", d: "Parse a string into a tuple.", code: 'type Split<S extends string> =\n  S extends `${infer A},${infer B}` ? [A, ...Split<B>] : [S]\ntype Parts = Split<"a,b,c">', expect: { name: "Parts", shape: '["a","b","c"]' } }
      ]},
      { name: "Patterns", missions: [
        { t: "Branded type", d: "Same runtime value, different type.", code: 'type USD = number & { readonly __brand: "USD" }\nconst usd = (n: number) => n as USD', expect: { name: "usd", kind: "var" } },
        { t: "Unbranded", d: "A plain number isn't USD.", code: "const price: USD = 5", expect: { err: [2322] } },
        { t: "Result type", d: "Errors as values.", code: 'type Result<T> = { ok: true; value: T } | { ok: false; error: string }\nfunction parse(s: string): Result<number> {\n  const n = Number(s)\n  return isNaN(n) ? { ok: false, error: "NaN" } : { ok: true, value: n }\n}', expect: { name: "parse", kind: "fn" } },
        { t: "Use it", d: "Parse a number.", code: 'parse("42")', expect: { check: (c) => !!(c.result && c.result.$obj && c.result.$obj.value === 42) } },
        { t: "Assertion function", d: "Narrows everything after the call.", code: 'function assertString(x: unknown): asserts x is string {\n  if (typeof x !== "string") throw new Error("not a string")\n}', expect: { name: "assertString", kind: "fn" } },
        { t: "Overloads", d: "Several signatures, one implementation.", code: "function len(x: string): number\nfunction len(x: unknown[]): number\nfunction len(x: string | unknown[]) {\n  return x.length\n}", expect: { name: "len", kind: "fn" } },
        { t: "Typed emitter", d: "Event names and payloads, checked together.", code: "class Emitter<E extends Record<string, unknown>> {\n  private fns: { [K in keyof E]?: ((p: E[K]) => void)[] } = {}\n  on<K extends keyof E>(k: K, f: (p: E[K]) => void) {\n    (this.fns[k] ??= []).push(f)\n  }\n  emit<K extends keyof E>(k: K, p: E[K]) {\n    this.fns[k]?.forEach((f) => f(p))\n  }\n}", expect: { name: "Emitter", kind: "class" } },
        { t: "Wrong payload", d: "Emit the wrong shape.", code: 'new Emitter<{ login: { id: number } }>().emit("login", { id: "1" })', expect: { err: [2322] } }
      ]}
    ]}
  ];

  // Flatten
  const MISSIONS = [], UNITS = [];
  PATH.forEach((lv, li) => lv.units.forEach((u) => {
    const ui = UNITS.length;
    UNITS.push({ level: lv.level, li, name: u.name, start: MISSIONS.length, count: u.missions.length });
    u.missions.forEach((m, k) => MISSIONS.push({ ...m, unit: ui, k }));
  }));

  // Canonical, whitespace-free description of a visual model
  function canon(m, d = 0) {
    if (!m) return "";
    if (d > 0 && m.name && (m.k === "obj" || m.k === "union")) return m.name.replace(/<…>$/, "");
    switch (m.k) {
      case "str": return "string"; case "num": return "number"; case "bool": return "boolean";
      case "lit": return m.base === "str" ? JSON.stringify(m.v) : String(m.v);
      case "null": return "null"; case "undef": return "undefined"; case "void": return "void";
      case "any": return "any"; case "unknown": return "unknown"; case "never": return "never";
      case "union": return m.items.map((x) => canon(x, d + 1)).sort().join("|");
      case "arr": return canon(m.el, d + 1) + "[]";
      case "tup": return "[" + m.els.map((x) => canon(x, d + 1)).join(",") + "]";
      case "obj": return "{" + [...m.props.slice().sort((a, b) => (a.name < b.name ? -1 : 1)).map((p) => (p.ro ? "readonly " : "") + p.name + (p.opt ? "?" : "") + ":" + canon(p.m, d + 1)),
        ...m.index.map((i) => "[" + i.key + "]:" + canon(i.m, d + 1))].join(";") + "}";
      case "fn": return "(" + m.params.map((p) => canon(p.m, d + 1)).join(",") + ")=>" + canon(m.ret, d + 1);
      case "box": return m.name;
      case "ref": case "param": return m.name;
      default: return (m.text || m.k).replace(/\s+/g, "");
    }
  }
  const norm = (s) => String(s || "").replace(/;\s*}/g, "}").replace(/\s+/g, "");

  function passes(m, ctx) {
    const x = m.expect;
    if (x.auto) return root.Build.passes(m, ctx);
    if (x.err) return ctx.on === "error" && ctx.errorCodes.some((c) => x.err.includes(c));
    if (ctx.on !== "commit") return false;
    const ents = ctx.newEnts;
    const ent = x.name ? ents.filter((e) => e.name === x.name).pop() : ents[ents.length - 1];
    if (!ent) return false;
    if (x.kind && ent.kind !== x.kind) return false;
    if (x.type && ![ent.typeStr, ent.full].map(norm).includes(norm(x.type))) return false;
    if (x.shape) { const s = canon(ent.model); if (!(s === x.shape || s.startsWith(x.shape))) return false; }
    if ("result" in x && JSON.stringify(ctx.result) !== JSON.stringify(x.result)) return false;
    if (x.check && !x.check({ ...ctx, ent })) return false;
    return true;
  }

  root.PATH = PATH; root.MISSIONS = MISSIONS; root.UNITS = UNITS; root.missionPasses = passes; root.canonModel = canon;
})(typeof window !== "undefined" ? window : globalThis);
