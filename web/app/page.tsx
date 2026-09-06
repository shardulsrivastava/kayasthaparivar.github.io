import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SearchBar } from "@/components/search-bar";
import { PersonNode } from "@/components/person-node";
import { Button } from "@/components/ui/button";
import { getAllPeople, getGenerations } from "@/lib/family";

export default function Home() {
  const people = getAllPeople();
  const generations = getGenerations();
  const elders = generations[0] ?? [];
  const birthYears = people
    .map((p) => p.birthYear)
    .filter((y): y is number => !!y);
  const earliest = birthYears.length ? Math.min(...birthYears) : undefined;

  const stats = [
    { label: "Family members", value: people.length },
    { label: "Generations", value: generations.length },
    { label: "Roots since", value: earliest ?? "—" },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-6 pt-24 pb-16 text-center">
          <p className="font-mono text-xs tracking-[0.3em] text-primary uppercase">
            Barabanki, Uttar Pradesh
          </p>
          <h1 className="mt-4 font-heading text-4xl font-semibold sm:text-6xl">
            The <span className="text-gradient">Kayastha Parivar</span> Family
            Tree
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Trace the generations, discover the stories, and see the faces
            that make up our family — from Barabanki and beyond.
          </p>

          <div className="mx-auto mt-10 max-w-xl">
            <SearchBar />
          </div>

          <div className="mt-8 flex justify-center gap-4">
            <Button size="lg" render={<Link href="/tree" />}>
              Explore the family tree
            </Button>
          </div>
        </section>

        <section className="mx-auto grid max-w-3xl grid-cols-3 gap-4 px-6 pb-16">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="glass-panel rounded-2xl px-4 py-6 text-center"
            >
              <p className="font-heading text-3xl font-semibold text-gradient">
                {stat.value}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {stat.label}
              </p>
            </div>
          ))}
        </section>

        {elders.length > 0 ? (
          <section className="mx-auto max-w-5xl px-6 pb-24">
            <h2 className="mb-8 text-center font-heading text-xl text-muted-foreground">
              Where it all began
            </h2>
            <div className="flex flex-wrap justify-center gap-6">
              {elders.map((person) => (
                <PersonNode key={person.id} person={person} />
              ))}
            </div>
          </section>
        ) : null}
      </main>

      <footer className="border-t border-white/10 py-8 text-center text-xs text-muted-foreground">
        Built with care for the Kayastha Parivar, Barabanki.
      </footer>
    </div>
  );
}
