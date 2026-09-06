"use client";

import { useRouter } from "next/navigation";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { getAllPeople, lifespan } from "@/lib/family";

export function SearchBar() {
  const router = useRouter();
  const people = getAllPeople();

  return (
    <Command className="glass-panel rounded-2xl border-0">
      <CommandInput placeholder="Search a family member by name..." />
      <CommandList>
        <CommandEmpty>No one found by that name.</CommandEmpty>
        <CommandGroup heading="Family members">
          {people.map((person) => (
            <CommandItem
              key={person.id}
              value={person.name}
              onSelect={() => router.push(`/person/${person.id}`)}
              className="cursor-pointer"
            >
              <span>{person.name}</span>
              <span className="ml-auto font-mono text-xs text-muted-foreground">
                {lifespan(person)}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
