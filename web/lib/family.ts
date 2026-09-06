import familyData from "@/data/family.generated.json";

export interface Person {
  id: string;
  name: string;
  gender: "male" | "female";
  birthYear?: number | null;
  deathYear?: number | null;
  location?: string;
  occupation?: string;
  bio?: string;
  photo?: string;
  parents: string[];
  spouses: string[];
}

export interface EnrichedPerson extends Person {
  children: string[];
  generation: number;
}

const rawPeople = familyData.people as Person[];

function buildGraph(): Map<string, EnrichedPerson> {
  const byId = new Map<string, EnrichedPerson>();

  for (const person of rawPeople) {
    byId.set(person.id, { ...person, children: [], generation: 0 });
  }

  for (const person of byId.values()) {
    for (const parentId of person.parents) {
      const parent = byId.get(parentId);
      if (parent && !parent.children.includes(person.id)) {
        parent.children.push(person.id);
      }
    }
  }

  // Generation is derived from blood ancestry only (longest path from a
  // person with no recorded parents). Married-in spouses have no parents
  // of their own, so they must not be treated as generation-0 roots —
  // their generation is reconciled with their partner's afterwards.
  const memo = new Map<string, number>();
  const resolving = new Set<string>();

  function resolveGeneration(id: string): number {
    if (memo.has(id)) return memo.get(id)!;
    const person = byId.get(id);
    if (!person || person.parents.length === 0 || resolving.has(id)) {
      memo.set(id, 0);
      return 0;
    }
    resolving.add(id);
    const generation =
      1 + Math.max(...person.parents.map((pid) => resolveGeneration(pid)));
    resolving.delete(id);
    memo.set(id, generation);
    return generation;
  }

  for (const person of byId.values()) {
    person.generation = resolveGeneration(person.id);
  }

  for (const person of byId.values()) {
    for (const spouseId of person.spouses) {
      const spouse = byId.get(spouseId);
      if (!spouse) continue;
      const generation = Math.max(person.generation, spouse.generation);
      person.generation = generation;
      spouse.generation = generation;
    }
  }

  return byId;
}

const graph = buildGraph();

export function getAllPeople(): EnrichedPerson[] {
  return [...graph.values()].sort((a, b) => {
    if (a.generation !== b.generation) return a.generation - b.generation;
    return (a.birthYear ?? 0) - (b.birthYear ?? 0);
  });
}

export function getPersonById(id: string): EnrichedPerson | undefined {
  return graph.get(id);
}

export function getTreeRoots(): EnrichedPerson[] {
  // A "root" is a blood-line founder: no recorded parents, and not merely
  // someone who married into the family (those are attached as a spouse
  // of their partner instead of appearing as their own top-level tree).
  const spouseIds = new Set<string>();
  for (const person of graph.values()) {
    for (const spouseId of person.spouses) spouseIds.add(spouseId);
  }
  return [...graph.values()]
    .filter((p) => p.parents.length === 0 && !spouseIds.has(p.id))
    .sort((a, b) => (a.birthYear ?? 0) - (b.birthYear ?? 0));
}

export function getGenerations(): EnrichedPerson[][] {
  const maxGen = Math.max(...[...graph.values()].map((p) => p.generation));
  const generations: EnrichedPerson[][] = Array.from(
    { length: maxGen + 1 },
    () => [],
  );
  for (const person of graph.values()) {
    generations[person.generation].push(person);
  }
  for (const gen of generations) {
    gen.sort((a, b) => (a.birthYear ?? 0) - (b.birthYear ?? 0));
  }
  return generations;
}

export function getRelatives(person: EnrichedPerson) {
  return {
    parents: person.parents
      .map((id) => graph.get(id))
      .filter((p): p is EnrichedPerson => !!p),
    spouses: person.spouses
      .map((id) => graph.get(id))
      .filter((p): p is EnrichedPerson => !!p),
    children: person.children
      .map((id) => graph.get(id))
      .filter((p): p is EnrichedPerson => !!p),
    siblings: [...graph.values()].filter(
      (p) =>
        p.id !== person.id &&
        p.parents.length > 0 &&
        p.parents.some((id) => person.parents.includes(id)),
    ),
  };
}

export function lifespan(person: Person): string {
  if (!person.birthYear) return "";
  if (person.deathYear) return `${person.birthYear} – ${person.deathYear}`;
  return `b. ${person.birthYear}`;
}
