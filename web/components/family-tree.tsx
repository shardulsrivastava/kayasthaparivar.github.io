"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getTreeRoots, getPersonById, lifespan, type EnrichedPerson } from "@/lib/family";
import { cn } from "@/lib/utils";

interface NodeRect {
  x: number;
  top: number;
  bottom: number;
}

interface LinkPath {
  id: string;
  d: string;
}

function unitChildren(person: EnrichedPerson): string[] {
  const spouse = person.spouses[0] ? getPersonById(person.spouses[0]) : undefined;
  return Array.from(new Set([...person.children, ...(spouse?.children ?? [])]));
}

function collectVisibleEdges(
  person: EnrichedPerson,
  expanded: Set<string>,
  edges: { parent: string; child: string }[],
) {
  if (!expanded.has(person.id)) return;
  for (const childId of unitChildren(person)) {
    edges.push({ parent: person.id, child: childId });
    const child = getPersonById(childId);
    if (child) collectVisibleEdges(child, expanded, edges);
  }
}

function unitAnchor(
  id: string,
  positions: Map<string, NodeRect>,
): NodeRect | undefined {
  const person = getPersonById(id);
  const p1 = positions.get(id);
  const spouseId = person?.spouses[0];
  if (!spouseId) return p1;
  const p2 = positions.get(spouseId);
  if (!p1) return p2;
  if (!p2) return p1;
  return {
    x: (p1.x + p2.x) / 2,
    top: Math.min(p1.top, p2.top),
    bottom: Math.max(p1.bottom, p2.bottom),
  };
}

function collectAncestorIds(personId: string): Set<string> {
  const ids = new Set<string>();
  function walk(id: string) {
    const person = getPersonById(id);
    if (!person) return;
    for (const parentId of person.parents) {
      if (!ids.has(parentId)) {
        ids.add(parentId);
        walk(parentId);
      }
    }
  }
  walk(personId);
  return ids;
}

function TreeCard({
  person,
  ref,
  expanded,
  hasChildren,
  onToggle,
}: {
  person: EnrichedPerson;
  ref?: React.Ref<HTMLDivElement>;
  expanded: boolean;
  hasChildren: boolean;
  onToggle: () => void;
}) {
  return (
    <Card
      ref={ref}
      size="sm"
      role={hasChildren ? "button" : undefined}
      tabIndex={hasChildren ? 0 : undefined}
      onClick={hasChildren ? onToggle : undefined}
      onKeyDown={
        hasChildren
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onToggle();
              }
            }
          : undefined
      }
      className={cn(
        "glass-panel relative w-40 items-center gap-2 border-0 py-3 text-center transition-all duration-300",
        hasChildren && "cursor-pointer hover:-translate-y-1 hover:glow-primary",
      )}
    >
      <Link
        href={`/person/${person.id}`}
        onClick={(e) => e.stopPropagation()}
        aria-label={`View ${person.name}'s profile`}
        className="absolute top-1.5 right-1.5 rounded-full p-1 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
      >
        <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
      <div className="relative">
        <div
          className={cn(
            "relative h-16 w-16 overflow-hidden rounded-full ring-2",
            person.gender === "male" ? "ring-primary/60" : "ring-accent/60",
          )}
        >
          <Image
            src={person.photo || "/photos/placeholder-male.svg"}
            alt={person.name}
            fill
            sizes="64px"
            className="object-cover"
          />
        </div>
      </div>
      <div className="px-2">
        <p className="font-heading text-sm leading-tight font-medium text-balance">
          {person.name}
        </p>
        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
          {lifespan(person)}
        </p>
      </div>
      <ChevronDown
        aria-hidden="true"
        className={cn(
          "h-4 w-4 text-muted-foreground transition-transform duration-300",
          hasChildren && expanded && "rotate-180",
          !hasChildren && "invisible pointer-events-none",
        )}
      />
    </Card>
  );
}

function TreeUnit({
  person,
  expanded,
  toggle,
  registerRef,
}: {
  person: EnrichedPerson;
  expanded: Set<string>;
  toggle: (id: string) => void;
  registerRef: (id: string, el: HTMLDivElement | null) => void;
}) {
  const spouse = person.spouses[0] ? getPersonById(person.spouses[0]) : undefined;
  const childIds = unitChildren(person);
  const hasChildren = childIds.length > 0;
  const isExpanded = expanded.has(person.id);

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-3">
        <TreeCard
          person={person}
          ref={(el) => registerRef(person.id, el)}
          expanded={isExpanded}
          hasChildren={hasChildren}
          onToggle={() => toggle(person.id)}
        />
        {spouse ? (
          <>
            <span className="h-px w-6 bg-gradient-to-r from-primary to-accent" />
            <TreeCard
              person={spouse}
              ref={(el) => registerRef(spouse.id, el)}
              expanded={isExpanded}
              hasChildren={hasChildren}
              onToggle={() => toggle(person.id)}
            />
          </>
        ) : null}
      </div>
      {isExpanded && hasChildren ? (
        <div className="flex gap-10 pt-16">
          {childIds.map((id) => {
            const child = getPersonById(id);
            return child ? (
              <TreeUnit
                key={id}
                person={child}
                expanded={expanded}
                toggle={toggle}
                registerRef={registerRef}
              />
            ) : null;
          })}
        </div>
      ) : null}
    </div>
  );
}

export function FamilyTree() {
  const roots = useMemo(() => getTreeRoots(), []);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(roots.map((r) => r.id)),
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLDivElement>());
  const [links, setLinks] = useState<LinkPath[]>([]);

  // Search hand-off: `?focus=<personId>` expands every ancestor of
  // that person so their card is mounted, then scrolls to and briefly
  // highlights it. Unknown/absent `focus` leaves everything as-is.
  const searchParams = useSearchParams();
  const focusId = searchParams.get("focus");
  const focusHandledRef = useRef<string | null>(null);
  const activeHighlightRef = useRef<{ el: HTMLDivElement; timer: ReturnType<typeof setTimeout> } | null>(null);

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

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

    const edges: { parent: string; child: string }[] = [];
    for (const root of roots) collectVisibleEdges(root, expanded, edges);

    const paths: LinkPath[] = [];
    for (const edge of edges) {
      const start = unitAnchor(edge.parent, positions);
      const end = unitAnchor(edge.child, positions);
      if (!start || !end) continue;
      const midY = (start.bottom + end.top) / 2;
      paths.push({
        id: `${edge.parent}->${edge.child}`,
        d: `M ${start.x} ${start.bottom} L ${start.x} ${midY} L ${end.x} ${midY} L ${end.x} ${end.top}`,
      });
    }
    setLinks(paths);
  }, [roots, expanded]);

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

  // Expand the entire ancestor chain of the focused person so they render.
  // All ancestors must be in expanded for any descendant to mount in the tree.
  // Users can collapse any ancestor by clicking its chevron to reduce clutter.
  useEffect(() => {
    if (!focusId) return;
    if (!getPersonById(focusId)) return;
    const ancestorIds = collectAncestorIds(focusId);
    if (ancestorIds.size === 0) return;
    setExpanded((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const id of ancestorIds) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [focusId]);

  // Once the focused person's card is mounted (its ref registered by the
  // expand above), scroll it into view and briefly highlight it. The
  // highlight is applied imperatively (not via state) so that a large
  // expansion doesn't force a full tree re-render in the same tick as
  // scrollIntoView - that re-render was racing the smooth-scroll animation
  // and silently cancelling it for deep expansions with many mounted cards.
  useEffect(() => {
    if (!focusId || focusHandledRef.current === focusId) return;
    const el = nodeRefs.current.get(focusId);
    if (!el) return;
    focusHandledRef.current = focusId;
    el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });

    if (activeHighlightRef.current) {
      clearTimeout(activeHighlightRef.current.timer);
      activeHighlightRef.current.el.classList.remove("glow-accent", "ring-2", "ring-accent", "highlight-pulse");
    }
    el.classList.add("glow-accent", "ring-2", "ring-accent", "highlight-pulse");
    const timer = setTimeout(() => {
      el.classList.remove("glow-accent", "ring-2", "ring-accent", "highlight-pulse");
      activeHighlightRef.current = null;
    }, 4000);
    activeHighlightRef.current = { el, timer };
  }, [focusId, expanded]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Smoothly animate scrollLeft toward a target instead of jumping on
    // every wheel tick.
    let target = el.scrollLeft;
    let raf: number | null = null;
    function animate() {
      const current = el!.scrollLeft;
      const diff = target - current;
      if (Math.abs(diff) < 0.5) {
        el!.scrollLeft = target;
        raf = null;
        return;
      }
      el!.scrollLeft = current + diff * 0.25;
      raf = requestAnimationFrame(animate);
    }

    function onWheel(e: WheelEvent) {
      if (el!.scrollWidth <= el!.clientWidth) return;
      // Only hijack the wheel for explicit horizontal intent (shift+wheel,
      // or a trackpad's native horizontal swipe). Plain vertical wheel
      // input is left alone so it scrolls the page as usual.
      const trackpadHorizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      if (!e.shiftKey && !trackpadHorizontal) return;
      const delta = e.shiftKey
        ? Math.abs(e.deltaX) > Math.abs(e.deltaY)
          ? e.deltaX
          : e.deltaY
        : e.deltaX;
      target = Math.max(
        0,
        Math.min(el!.scrollWidth - el!.clientWidth, target + delta),
      );
      if (raf === null) raf = requestAnimationFrame(animate);
      e.preventDefault();
    }

    // Click-and-drag panning on empty tree background (not on cards/links).
    let isDragging = false;
    let dragStartX = 0;
    let dragStartScrollLeft = 0;

    function onPointerDown(e: PointerEvent) {
      if (e.button !== 0) return;
      const targetEl = e.target as HTMLElement;
      if (targetEl.closest("a, button, [role='button']")) return;
      isDragging = true;
      if (raf !== null) {
        cancelAnimationFrame(raf);
        raf = null;
      }
      dragStartX = e.clientX;
      dragStartScrollLeft = el!.scrollLeft;
      el!.style.userSelect = "none";
      el!.classList.add("cursor-grabbing");
      el!.setPointerCapture(e.pointerId);
    }

    function onPointerMove(e: PointerEvent) {
      if (!isDragging) return;
      el!.scrollLeft = dragStartScrollLeft - (e.clientX - dragStartX);
      target = el!.scrollLeft;
    }

    function endDrag(e: PointerEvent) {
      if (!isDragging) return;
      isDragging = false;
      el!.style.userSelect = "";
      el!.classList.remove("cursor-grabbing");
      if (el!.hasPointerCapture(e.pointerId)) {
        el!.releasePointerCapture(e.pointerId);
      }
    }

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointercancel", endDrag);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", endDrag);
      el.removeEventListener("pointercancel", endDrag);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={scrollRef}
      className="w-full cursor-grab overflow-x-auto pb-8"
    >
      <div
        ref={contentRef}
        className="relative inline-flex min-w-full justify-center gap-16 px-8 py-12"
      >
        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
          <defs>
            <linearGradient
              id="tree-line"
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="0"
              x2="0"
              y2="100%"
            >
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

        {roots.map((root) => (
          <TreeUnit
            key={root.id}
            person={root}
            expanded={expanded}
            toggle={toggle}
            registerRef={registerRef}
          />
        ))}
      </div>
    </div>
  );
}
