import { SiteHeader } from "@/components/site-header";
import { FamilyTree } from "@/components/family-tree";

export const metadata = {
  title: "Family Tree | Kayastha Parivar",
};

export default function TreePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-6 pt-12 pb-4 text-center">
          <h1 className="font-heading text-3xl font-semibold sm:text-4xl">
            The Family Tree
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Scroll horizontally to explore. Click on anyone to see their
            story.
          </p>
        </div>
        <FamilyTree />
      </main>
    </div>
  );
}
