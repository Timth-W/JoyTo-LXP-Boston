"use client";

import { useState } from "react";
import { ActivityCard } from "@/components/ActivityCard";
import { ActivityMap } from "@/components/ActivityMap";
import { CATEGORY_ICON, Icon } from "@/components/Icon";
import { SegmentedControl } from "@/components/MobileUI";
import { Empty, PageHead } from "@/components/ui";
import { useI18n } from "@/i18n";
import { CATEGORY_IDS } from "@/lib/constants";
import { catalogueActivities, type ActivityPriceFilter } from "@/lib/selectors";
import { useStore } from "@/lib/store";
import type { Category } from "@/lib/types";

export default function ActivitiesPage() {
  const { state, me } = useStore();
  const { t, locale } = useI18n();
  const [category, setCategory] = useState<Category | "all">("all");
  const [price, setPrice] = useState<ActivityPriceFilter>("all");
  const [view, setView] = useState<"list" | "map">("list");
  const [query, setQuery] = useState("");
  if (!me) return null;

  const list = catalogueActivities(state, category, query, locale, price);
  const filtered = category !== "all" || price !== "all" || Boolean(query.trim());
  function resetFilters() {
    setCategory("all");
    setPrice("all");
    setQuery("");
  }

  return (
    <div className="activities-page">
      <PageHead
        title={t.senior.activitiesTitle}
        eyebrow={t.catalogue.eyebrow}
        lead={t.catalogue.lead}
        action={
          <SegmentedControl
            label={t.senior.activitiesTitle}
            value={view}
            onChange={setView}
            options={[
              { value: "list", label: t.senior.list, icon: "list" },
              { value: "map", label: t.senior.map, icon: "map" },
            ]}
          />
        }
      />

      <section className="catalogue-filters" aria-labelledby="catalogue-filter-title">
        <div className="catalogue-filter-head">
          <h2 id="catalogue-filter-title">{t.catalogue.filterTitle}</h2>
          <div className="catalogue-search">
            <label htmlFor="activity-search" className="sr-only">
              {t.catalogue.searchLabel}
            </label>
            <Icon name="search" size={22} />
            <input
              id="activity-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.catalogue.searchPlaceholder}
              autoComplete="off"
            />
            {query ? (
              <button type="button" className="icon-btn" onClick={() => setQuery("")} aria-label={t.catalogue.clearSearch}>
                <Icon name="close" size={20} />
              </button>
            ) : null}
          </div>
        </div>
        <div className="toggle-chips catalogue-categories" role="group" aria-labelledby="catalogue-filter-title">
          <label className="toggle-chip">
            <input type="radio" name="category" checked={category === "all"} onChange={() => setCategory("all")} />
            {t.senior.all}
          </label>
          {CATEGORY_IDS.map((c) => (
            <label key={c} className="toggle-chip">
              <input type="radio" name="category" checked={category === c} onChange={() => setCategory(c)} />
              <Icon name={CATEGORY_ICON[c]} size={18} />
              {t.categories[c]}
            </label>
          ))}
        </div>
        <div className="toggle-chips" role="group" aria-label={t.activity.price}>
          {(["all", "free", "paid"] as const).map((value) => (
            <label key={value} className="toggle-chip">
              <input type="radio" name="price" checked={price === value} onChange={() => setPrice(value)} />
              {value === "all" ? t.catalogue.allPrices : t.catalogue[value]}
            </label>
          ))}
        </div>
      </section>

      <section className="catalogue-results" aria-labelledby="catalogue-results-title">
        <div className="catalogue-results-head">
          <div className="stack-sm">
            <h2 id="catalogue-results-title" aria-live="polite" aria-atomic="true">
              {t.catalogue.resultCount(list.length)}
            </h2>
            <p className={view === "map" ? "catalogue-map-hint" : undefined}>
              {view === "map" ? t.catalogue.mapHint : t.catalogue.dateOrder}
            </p>
          </div>
          {filtered ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={resetFilters}>
              <Icon name="refresh" size={18} />
              {t.catalogue.reset}
            </button>
          ) : null}
        </div>
        {list.length === 0 ? (
          <Empty
            icon="leaf"
            action={
              filtered ? (
                <button type="button" className="btn btn-secondary" onClick={resetFilters}>
                  {t.catalogue.showAll}
                </button>
              ) : undefined
            }
          >
            {query.trim() ? t.catalogue.noSearchResults : price !== "all" ? t.catalogue.noMatchingActivities : t.senior.noActivity}
          </Empty>
        ) : view === "map" ? (
          <ActivityMap key={`${category}:${query}:${price}`} activities={list} viewer={me} featured />
        ) : (
          <div className="catalogue-grid">
            {list.map((a) => (
              <ActivityCard key={a.id} activity={a} viewer={me} featured headingLevel={3} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
