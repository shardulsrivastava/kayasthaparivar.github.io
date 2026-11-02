import { SiteHeader } from "@/components/site-header";
import { HinduCalendar } from "@/components/hindu-calendar";

export const metadata = {
  title: "Hindu Calendar | Kayastha Parivar",
};

export default function CalendarPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <HinduCalendar />
      </main>
    </div>
  );
}
