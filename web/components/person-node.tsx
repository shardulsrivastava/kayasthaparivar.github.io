"use client";

import Link from "next/link";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { lifespan, type EnrichedPerson } from "@/lib/family";
import { cn } from "@/lib/utils";

export function PersonNode({
  person,
  ref,
  compact = false,
}: {
  person: EnrichedPerson;
  ref?: React.Ref<HTMLDivElement>;
  compact?: boolean;
}) {
  const isLiving = person.birthYear && !person.deathYear;

  return (
    <Link href={`/person/${person.id}`} className="block">
      <Card
        ref={ref}
        size="sm"
        className={cn(
          "glass-panel w-40 items-center gap-2 border-0 py-3 text-center transition-all duration-300 hover:-translate-y-1 hover:glow-primary",
          compact && "w-32",
        )}
      >
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
          {isLiving ? (
            <span className="absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-background bg-emerald-400" />
          ) : null}
        </div>
        <div className="px-2">
          <p className="font-heading text-sm leading-tight font-medium text-balance">
            {person.name}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
            {lifespan(person)}
          </p>
        </div>
      </Card>
    </Link>
  );
}
