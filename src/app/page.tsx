import { getConfig } from "@/lib/config";
import KioskForm from "./KioskForm";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const cfg = getConfig();
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-8">
      <KioskForm
        eventName={cfg.eventName}
        boothName={cfg.boothName}
        currentDay={cfg.currentDay}
      />
    </main>
  );
}
