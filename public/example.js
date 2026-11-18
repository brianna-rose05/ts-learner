// A ready-made plan, used for the example project (no Claude call needed).
window.EXAMPLE_PLAN = {
 "name": "Habit tracker",
 "summary": "Tracks habits and streaks, with typed events, levels, routes and validation.",
 "steps": [
  {
   "unit": "Values",
   "t": "App name",
   "d": "Store the app's name.",
   "code": "const appName = \"Streaks\"",
   "expectError": false
  },
  {
   "unit": "Values",
   "t": "Daily goal",
   "d": "Annotate how many habits per day.",
   "code": "let dailyGoal: number = 3",
   "expectError": false
  },
  {
   "unit": "Values",
   "t": "Wrong type",
   "d": "Try storing text in the goal.",
   "code": "dailyGoal = \"three\"",
   "expectError": true
  },
  {
   "unit": "Arrays & tuples",
   "t": "Weekdays",
   "d": "A list of day names.",
   "code": "const weekdays: string[] = [\"Mon\", \"Tue\", \"Wed\", \"Thu\", \"Fri\", \"Sat\", \"Sun\"]",
   "expectError": false
  },
  {
   "unit": "Arrays & tuples",
   "t": "Reminder time",
   "d": "Hour and minute as a tuple.",
   "code": "const reminder: [hour: number, minute: number] = [8, 30]",
   "expectError": false
  },
  {
   "unit": "Objects",
   "t": "Habit shape",
   "d": "Describe a habit.",
   "code": "interface Habit {\n  readonly id: number\n  name: string\n  streak: number\n  note?: string\n}",
   "expectError": false
  },
  {
   "unit": "Objects",
   "t": "First habit",
   "d": "Create one.",
   "code": "const water: Habit = { id: 1, name: \"Drink water\", streak: 0 }",
   "expectError": false
  },
  {
   "unit": "Objects",
   "t": "Locked id",
   "d": "Try changing its id.",
   "code": "water.id = 2",
   "expectError": true
  },
  {
   "unit": "Functions",
   "t": "Increment",
   "d": "Return a habit with streak + 1.",
   "code": "function increment(habit: Habit): Habit {\n  return { ...habit, streak: habit.streak + 1 }\n}",
   "expectError": false
  },
  {
   "unit": "Functions",
   "t": "Try it",
   "d": "Increment the first habit.",
   "code": "increment(water).streak",
   "expectError": false
  },
  {
   "unit": "Unions",
   "t": "Frequency",
   "d": "Daily or weekly.",
   "code": "type Frequency = \"daily\" | \"weekly\"",
   "expectError": false
  },
  {
   "unit": "Unions",
   "t": "Label",
   "d": "Format a streak for a frequency.",
   "code": "function label(f: Frequency, n: number) {\n  return f === \"daily\" ? `${n} days` : `${n} weeks`\n}",
   "expectError": false
  },
  {
   "unit": "Unions",
   "t": "Unknown frequency",
   "d": "Pass a frequency that doesn't exist.",
   "code": "label(\"monthly\", 2)",
   "expectError": true
  },
  {
   "unit": "Narrowing",
   "t": "Habit events",
   "d": "Each event carries a kind.",
   "code": "type HabitEvent =\n  | { kind: \"done\"; habitId: number }\n  | { kind: \"skipped\"; habitId: number; reason: string }",
   "expectError": false
  },
  {
   "unit": "Narrowing",
   "t": "Describe",
   "d": "Switch on the event kind.",
   "code": "function describe(e: HabitEvent): string {\n  switch (e.kind) {\n    case \"done\": return `Habit ${e.habitId} done`\n    case \"skipped\": return `Skipped: ${e.reason}`\n  }\n}",
   "expectError": false
  },
  {
   "unit": "Generics",
   "t": "Last item",
   "d": "Works for any list.",
   "code": "function lastOf<T>(items: T[]): T | undefined {\n  return items[items.length - 1]\n}",
   "expectError": false
  },
  {
   "unit": "Generics",
   "t": "Last day",
   "d": "T becomes string.",
   "code": "lastOf(weekdays)",
   "expectError": false
  },
  {
   "unit": "Classes",
   "t": "Store",
   "d": "A generic store with private items.",
   "code": "class Store<T extends { id: number }> {\n  private items: T[] = []\n  add(item: T) {\n    this.items.push(item)\n    return item\n  }\n  find(id: number): T | undefined {\n    return this.items.find((i) => i.id === id)\n  }\n}",
   "expectError": false
  },
  {
   "unit": "Classes",
   "t": "Habit store",
   "d": "Create a store for habits.",
   "code": "const habits = new Store<Habit>()",
   "expectError": false
  },
  {
   "unit": "Classes",
   "t": "Add a habit",
   "d": "Save the first habit.",
   "code": "habits.add(water)",
   "expectError": false
  },
  {
   "unit": "Classes",
   "t": "Private items",
   "d": "Read the items from outside.",
   "code": "habits.items",
   "expectError": true
  },
  {
   "unit": "Async",
   "t": "Remote habits",
   "d": "Pretend to load from a server.",
   "code": "function fetchHabits(): Promise<Habit[]> {\n  return Promise.resolve([{ id: 2, name: \"Read\", streak: 4 }])\n}",
   "expectError": false
  },
  {
   "unit": "Async",
   "t": "Sync",
   "d": "Await the data, then store it.",
   "code": "async function sync() {\n  const remote = await fetchHabits()\n  remote.forEach((h) => habits.add(h))\n  return remote.length\n}",
   "expectError": false
  },
  {
   "unit": "Enums & const",
   "t": "Levels",
   "d": "Freeze the level names.",
   "code": "const LEVELS = [\"bronze\", \"silver\", \"gold\"] as const",
   "expectError": false
  },
  {
   "unit": "Enums & const",
   "t": "Level type",
   "d": "A union from the array.",
   "code": "type Level = (typeof LEVELS)[number]",
   "expectError": false
  },
  {
   "unit": "Enums & const",
   "t": "Level for streak",
   "d": "Pick a level from a streak.",
   "code": "function levelFor(streak: number): Level {\n  return streak >= 30 ? \"gold\" : streak >= 7 ? \"silver\" : \"bronze\"\n}",
   "expectError": false
  },
  {
   "unit": "Type operators",
   "t": "Habit keys",
   "d": "The keys of Habit.",
   "code": "type HabitKey = keyof Habit",
   "expectError": false
  },
  {
   "unit": "Type operators",
   "t": "Pluck",
   "d": "The key decides the return type.",
   "code": "function pluck<K extends HabitKey>(h: Habit, key: K): Habit[K] {\n  return h[key]\n}",
   "expectError": false
  },
  {
   "unit": "Utility types",
   "t": "Update type",
   "d": "Any field except id.",
   "code": "type HabitUpdate = Partial<Omit<Habit, \"id\">>",
   "expectError": false
  },
  {
   "unit": "Utility types",
   "t": "Update",
   "d": "Apply changes to a habit.",
   "code": "function update(h: Habit, changes: HabitUpdate): Habit {\n  return { ...h, ...changes }\n}",
   "expectError": false
  },
  {
   "unit": "Utility types",
   "t": "Change the id",
   "d": "Try updating the id.",
   "code": "update(water, { id: 5 })",
   "expectError": true
  },
  {
   "unit": "Conditional types",
   "t": "Unwrap",
   "d": "The value inside a promise.",
   "code": "type Unwrap<T> = T extends Promise<infer U> ? U : T",
   "expectError": false
  },
  {
   "unit": "Conditional types",
   "t": "Sync result",
   "d": "What sync resolves to.",
   "code": "type Synced = Unwrap<ReturnType<typeof sync>>",
   "expectError": false
  },
  {
   "unit": "Mapped types",
   "t": "Flags",
   "d": "A boolean per field.",
   "code": "type Flags<T> = { [K in keyof T]?: boolean }",
   "expectError": false
  },
  {
   "unit": "Mapped types",
   "t": "Visible columns",
   "d": "Choose which fields to show.",
   "code": "const visible: Flags<Habit> = { name: true, streak: true }",
   "expectError": false
  },
  {
   "unit": "Recursive types",
   "t": "Deep readonly",
   "d": "Lock nested settings.",
   "code": "type DeepReadonly<T> = {\n  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K]\n}",
   "expectError": false
  },
  {
   "unit": "Recursive types",
   "t": "Settings",
   "d": "Nested and locked.",
   "code": "const settings: DeepReadonly<{ theme: { dark: boolean } }> = { theme: { dark: true } }",
   "expectError": false
  },
  {
   "unit": "Recursive types",
   "t": "Change a setting",
   "d": "Try changing a nested value.",
   "code": "settings.theme.dark = false",
   "expectError": true
  },
  {
   "unit": "Tuple & string types",
   "t": "Route type",
   "d": "Habit pages by id.",
   "code": "type Route = `/habits/${number}`",
   "expectError": false
  },
  {
   "unit": "Tuple & string types",
   "t": "A route",
   "d": "Build one from a habit.",
   "code": "const route: Route = `/habits/${water.id}`",
   "expectError": false
  },
  {
   "unit": "Patterns",
   "t": "Branded id",
   "d": "An id that isn't just a number.",
   "code": "type HabitId = number & { readonly __brand: \"HabitId\" }\nconst habitId = (n: number) => n as HabitId",
   "expectError": false
  },
  {
   "unit": "Patterns",
   "t": "Parse goal",
   "d": "Errors as values.",
   "code": "type Result<T> = { ok: true; value: T } | { ok: false; error: string }\nfunction parseGoal(input: string): Result<number> {\n  const n = Number(input)\n  return Number.isInteger(n) && n > 0 ? { ok: true, value: n } : { ok: false, error: \"Goal must be a positive whole number\" }\n}",
   "expectError": false
  },
  {
   "unit": "Patterns",
   "t": "Main",
   "d": "Use everything together.",
   "code": "function main() {\n  habits.add(increment({ id: 3, name: \"Stretch\", streak: 6 }))\n  const h = habits.find(3)\n  if (h) console.log(h.name, levelFor(h.streak), label(\"daily\", h.streak))\n  console.log(describe({ kind: \"done\", habitId: 1 }))\n  const goal = parseGoal(\"5\")\n  console.log(goal.ok ? `Goal: ${goal.value}` : goal.error)\n}",
   "expectError": false
  },
  {
   "unit": "Patterns",
   "t": "Run it",
   "d": "Run the app.",
   "code": "main()",
   "expectError": false
  }
 ]
};
