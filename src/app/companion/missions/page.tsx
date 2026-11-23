import { CompanionMissionsScreen } from "@/components/CompanionMissions";

export default async function MissionsPage({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
  const { view } = await searchParams;
  return <CompanionMissionsScreen initialTab={view === "mine" ? "mine" : "reco"} />;
}
