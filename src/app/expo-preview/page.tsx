import { notFound } from "next/navigation";
import { ExpoDemoProfiles } from "@/components/ExpoDemoProfiles";

export default function ExpoPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <ExpoDemoProfiles />;
}
