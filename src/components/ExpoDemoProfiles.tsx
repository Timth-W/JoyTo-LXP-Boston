"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/i18n";
import { HOME_BY_ROLE } from "@/lib/constants";
import { useStore } from "@/lib/store";
import { AuthFrame } from "./AuthFrame";
import { Icon } from "./Icon";

const profiles = [
  { id: "u-marie", name: "Marie", role: "senior", icon: "user" },
  { id: "u-karim", name: "Karim", role: "companion", icon: "heart" },
  { id: "u-sophie", name: "Sophie", role: "family", icon: "users" },
] as const;

export function ExpoDemoProfiles() {
  const { t } = useI18n();
  const { hydrated, mutate } = useStore();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function openProfile(profile: (typeof profiles)[number]) {
    if (pending) return;
    setPending(true);
    try {
      await mutate("login-as-demo", { userId: profile.id });
      router.push(HOME_BY_ROLE[profile.role]);
    } catch {
      // The shared backend notice explains failed requests.
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFrame>
      <section className="card stack" aria-busy={!hydrated || pending}>
        <h1>{t.expoPreview.title}</h1>
        <p className="muted">{t.expoPreview.lead}</p>
        {profiles.map((profile) => (
          <button
            key={profile.id}
            type="button"
            className="btn btn-secondary btn-block"
            disabled={!hydrated || pending}
            onClick={() => void openProfile(profile)}
          >
            <Icon name={profile.icon} /> {profile.name} · {t.roles[profile.role]}
          </button>
        ))}
      </section>
    </AuthFrame>
  );
}
