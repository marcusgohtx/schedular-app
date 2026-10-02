import type { Metadata } from "next";

import { SchedularProjectPage } from "./_components/schedular-project-page";

export const metadata: Metadata = {
  title: "schedular",
  description: "Plan event schedules locally in your browser and export them as calendar files.",
};

export default function SchedularPage() {
  return <SchedularProjectPage />;
}
