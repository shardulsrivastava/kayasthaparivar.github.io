"use client";

import { useLayoutEffect, useMemo, useRef, useState, useCallback } from "react";
import { PersonNode } from "@/components/person-node";
import { getGenerations, type EnrichedPerson } from "@/lib/family";

interface NodeRect {
  x: number;
  top: number;
  bottom: number;
}

interface LinkPath {
  id: string;
  d: string;
}

function groupIntoUnits(generation: EnrichedPerson[]): EnrichedPerson[][] {
  const seen = new Set<string>();
  const ids = new Set(generation.map((p) => p.id));
  const units: EnrichedPerson[][] = [];

  for (const person of generation) {
    if (seen.has(person.id)) continue;
    const spouseId = person.spouses.find(
      (id) => ids.has(id) && !seen.has(id),
    );
    if (spouseId) {
      const spouse = generation.find((p) => p.id === spouseId)!;
      units.push([person, spouse]);
      seen.add(person.id);
      seen.add(spouseId);
    } else {
      units.push([person]);
      seen.add(person.id);
    }
  }
  return units;
}

export function FamilyTree() {
  const generations = useMemo(() => getGenerations(), []);
  const contentRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLDivElement>());
  const [links, setLinks] = useState<LinkPath[]>([]);

  const registerRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) nodeRefs.current.set(id, el);
    else nodeRefs.current.delete(id);
  }, []);

  const recompute = useCallback(() => {
    const container = contentRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const positions = new Map<string, NodeRect>();

    nodeRefs.current.forEach((el, id) => {
      const r = el.getBoundingClientRect();
      positions.set(id, {
        x: r.left - containerRect.left + r.width / 2,
        top: r.top - containerRect.top,
        bottom: r.top - containerRect.top + r.height,
      });
    });

    const paths: LinkPath[] = [];
    for (const gen of generations) {
      for (const person of gen) {
        const parentPositions = person.parents
          .map((id) => positions.get(id))
          .filter((p): p is NodeRect => !!p);
        const childPos = positions.get(person.id);
        if (parentPositions.length === 0 || !childPos) continue;

        const startX =
          parentPositions.reduce((sum, p) => sum + p.x, 0) /
          parentPositions.length;
        const startY = Math.max(...parentPositions.map((p) => p.bottom));
        const endX = childPos.x;
        const endY = childPos.top;
        const midY = (startY + endY) / 2;

        paths.push({
          id: `${person.parents.join("-")}->${person.id}`,
          d: `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`,
        });
      }
    }
    setLinks(paths);
  }, [generations]);

  useLayoutEffect(() => {
    recompute();
    const observer = new ResizeObserver(() => recompute());
    if (contentRef.current) observer.observe(contentRef.current);
    window.addEventListener("resize", recompute);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, [recompute]);

  return (
    <div className="w-full overflow-x-auto pb-8">
      <div ref={contentRef} className="relative inline-flex min-w-full flex-col gap-20 px-8 py-12">
        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
          <defs>
            <linearGradient id="tree-line" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#c084fc" stopOpacity="0.7" />
            </linearGradient>
          </defs>
          {links.map((link) => (
            <path
              key={link.id}
              d={link.d}
              stroke="url(#tree-line)"
              strokeWidth={1.5}
              fill="none"
            />
          ))}
        </svg>

        {generations.map((gen, gi) => (
          <div key={gi} className="relative z-10 flex justify-center gap-12">
            {groupIntoUnits(gen).map((unit) => (
              <div
                key={unit.map((p) => p.id).join("-")}
                className="flex items-center gap-3"
              >
                {unit.map((person) => (
                  <PersonNode
                    key={person.id}
                    person={person}
                    ref={(el) => registerRef(person.id, el)}
                  />
                ))}
                {unit.length === 2 ? (
                  <span className="h-px w-6 bg-gradient-to-r from-primary to-accent" />
                ) : null}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
