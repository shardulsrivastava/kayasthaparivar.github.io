import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  getAllPeople,
  getPersonById,
  getRelatives,
  lifespan,
} from "@/lib/family";

export function generateStaticParams() {
  return getAllPeople().map((person) => ({ id: person.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const person = getPersonById(id);
  return {
    title: person
      ? `${person.name} | Kayastha Parivar`
      : "Not found | Kayastha Parivar",
  };
}

function RelativeList({
  title,
  people,
}: {
  title: string;
  people: { id: string; name: string }[];
}) {
  if (people.length === 0) return null;
  return (
    <div>
      <p className="text-xs tracking-wide text-muted-foreground uppercase">
        {title}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {people.map((p) => (
          <Link key={p.id} href={`/person/${p.id}`}>
            <Badge
              variant="secondary"
              className="cursor-pointer transition-colors hover:bg-primary/20"
            >
              {p.name}
            </Badge>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default async function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const person = getPersonById(id);
  if (!person) notFound();

  const relatives = getRelatives(person);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <div className="glass-panel rounded-3xl p-8">
            <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
              <div
                className={`relative h-28 w-28 shrink-0 overflow-hidden rounded-full ring-4 ${
                  person.gender === "male"
                    ? "ring-primary/60"
                    : "ring-accent/60"
                }`}
              >
                <Image
                  src={person.photo || "/photos/placeholder-male.svg"}
                  alt={person.name}
                  fill
                  sizes="112px"
                  className="object-cover"
                />
              </div>
              <div>
                <h1 className="font-heading text-3xl font-semibold">
                  {person.name}
                </h1>
                <p className="mt-1 font-mono text-sm text-muted-foreground">
                  {lifespan(person)}
                </p>
                {person.location ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {person.location}
                  </p>
                ) : null}
                {person.occupation ? (
                  <Badge variant="outline" className="mt-3">
                    {person.occupation}
                  </Badge>
                ) : null}
              </div>
            </div>

            {person.bio ? (
              <p className="mt-8 leading-relaxed text-muted-foreground">
                {person.bio}
              </p>
            ) : null}

            <Separator className="my-8" />

            <div className="grid gap-6 sm:grid-cols-2">
              <RelativeList title="Parents" people={relatives.parents} />
              <RelativeList title="Spouse" people={relatives.spouses} />
              <RelativeList title="Children" people={relatives.children} />
              <RelativeList title="Siblings" people={relatives.siblings} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
