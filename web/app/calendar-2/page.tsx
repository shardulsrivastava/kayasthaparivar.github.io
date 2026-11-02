import { SiteHeader } from "@/components/site-header";
import { HinduCalendar2 } from "@/components/hindu-calendar-2";

export const metadata = {
  title: "Hindu Calendar 2 | Kayastha Parivar",
};

export default function Calendar2Page() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <HinduCalendar2 />
      </main>
    </div>
  );
}
