"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BookingForm } from "@/components/BookingForm";
import { SeniorSwitcher } from "@/components/SeniorSwitcher";
import { BackLink, Empty, Loading, PageHead } from "@/components/ui";
import { useI18n } from "@/i18n";
import { useActiveSenior } from "@/lib/useActiveSenior";
import { useStore } from "@/lib/store";

export default function FamilyBookPage() {
  return (
    <Suspense fallback={<Loading />}>
      <FamilyBooking />
    </Suspense>
  );
}

function FamilyBooking() {
  const { me } = useStore();
  const { t } = useI18n();
  const router = useRouter();
  const requestedSeniorId = useSearchParams().get("senior");
  const { seniors, senior, choose } = useActiveSenior(requestedSeniorId);
  if (!me) return null;

  return (
    <div className="stack-lg">
      <BackLink href="/family" />
      <PageHead title={senior ? t.family.bookFor(senior.firstName) : t.family.book} lead={t.family.bookLead} />
      {senior ? (
        <>
          <SeniorSwitcher seniors={seniors} value={senior.id} onChange={choose} />
          <BookingForm
            key={senior.id}
            senior={senior}
            booker={me}
            payers={[me]}
            via="manual"
            onBooked={(id) => router.push(`/family/outings/${id}`)}
          />
        </>
      ) : (
        <Empty
          icon="link"
          action={
            <Link href="/family" className="btn btn-sm">
              {t.family.connect}
            </Link>
          }
        >
          {t.family.noLinked}
        </Empty>
      )}
    </div>
  );
}
