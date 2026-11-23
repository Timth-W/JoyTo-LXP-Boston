"use client";

import { useParams } from "next/navigation";
import { useI18n } from "@/i18n";
import { useStore } from "@/lib/store";
import type { User } from "@/lib/types";
import { AccessibilityPreferences } from "./AccessibilityPreferences";
import { FamilySeniorsPanel, SeniorFamilyPanel } from "./FamilyLinks";
import type { IconName } from "./Icon";
import { ProfileMenuItem } from "./MobileUI";
import { ProfileForm } from "./ProfileForm";
import { BackLink, Empty, PageHead, Person } from "./ui";

type Section = "information" | "interests" | "availability" | "family" | "accessibility";

function useProfileSections(user?: User) {
  const { t } = useI18n();
  const sections: { id: Section; icon: IconName; label: string }[] = [
    { id: "information", icon: "user", label: t.mobile.information },
    { id: "interests", icon: "leaf", label: t.profile.interests },
    { id: "availability", icon: "calendar", label: t.profile.availability },
    { id: "family", icon: "users", label: t.profile.familyTitle },
    { id: "accessibility", icon: "settings", label: t.mobile.accessibility },
  ];
  return sections.filter(({ id }) => {
    if (id === "family") return user?.role !== "companion";
    if (id === "interests" || id === "availability") return user?.role !== "family";
    return true;
  });
}

export function ProfileDashboard({ user }: { user: User }) {
  const { t } = useI18n();
  const sections = useProfileSections(user);
  return (
    <div className="mobile-ui profile-dashboard">
      <h1>{t.profile.title}</h1>
      <div className="card">
        <Person user={user} size={56} subtitle={t.roles[user.role]} />
      </div>
      <nav className="card profile-menu" aria-label={t.profile.title}>
        {sections.map(({ id, label, icon }) => (
          <ProfileMenuItem key={id} href={`/${user.role}/profile/${id}`} icon={icon}>
            {label}
          </ProfileMenuItem>
        ))}
      </nav>
    </div>
  );
}

export function ProfileSection() {
  const { section } = useParams<{ section: string }>();
  const { me } = useStore();
  const { t } = useI18n();
  const sections = useProfileSections(me);
  if (!me) return null;
  const item = sections.find(({ id }) => id === section);
  const home = `/${me.role}/profile`;
  if (!item)
    return (
      <Empty icon="alert" action={<BackLink href={home} />}>
        {t.common.notFound}
      </Empty>
    );
  return (
    <div className="profile-subpage stack">
      <BackLink href={home} />
      <PageHead title={item.label} />
      {item.id === "accessibility" ? (
        <AccessibilityPreferences />
      ) : item.id === "family" ? (
        me.role === "senior" ? (
          <SeniorFamilyPanel senior={me} />
        ) : (
          <FamilySeniorsPanel family={me} />
        )
      ) : (
        <ProfileForm key={item.id} user={me} section={item.id} />
      )}
    </div>
  );
}
