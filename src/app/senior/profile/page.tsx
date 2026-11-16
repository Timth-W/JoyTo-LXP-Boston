"use client";

import { SeniorFamilyPanel } from "@/components/FamilyLinks";
import { ProfileForm } from "@/components/ProfileForm";
import { PageHead } from "@/components/ui";
import { useI18n } from "@/i18n";
import { useStore } from "@/lib/store";

export default function SeniorProfilePage() {
  const { me } = useStore();
  const { t } = useI18n();
  if (!me) return null;
  return (
    <div className="profile-page">
      <PageHead title={t.profile.title} eyebrow={t.profileEditor.eyebrow} lead={t.profileEditor.lead} />
      <div className="profile-page-layout">
        <ProfileForm user={me} />
        <SeniorFamilyPanel senior={me} />
      </div>
    </div>
  );
}
