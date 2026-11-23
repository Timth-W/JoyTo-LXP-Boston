"use client";

import { FamilySeniorsPanel } from "@/components/FamilyLinks";
import { ProfileDashboard } from "@/components/ProfileSections";
import { ProfileForm } from "@/components/ProfileForm";
import { PageHead } from "@/components/ui";
import { useI18n } from "@/i18n";
import { useStore } from "@/lib/store";

export default function FamilyProfilePage() {
  const { me } = useStore();
  const { t } = useI18n();
  if (!me) return null;
  return (
    <>
      <ProfileDashboard user={me} />
      <div className="desktop-ui stack-lg">
        <PageHead title={t.profile.title} />
        <div className="split">
          <ProfileForm user={me} />
          <div className="stack-lg">
            <FamilySeniorsPanel family={me} />
          </div>
        </div>
      </div>
    </>
  );
}
