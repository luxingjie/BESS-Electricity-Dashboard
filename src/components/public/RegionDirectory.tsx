"use client";

import { useEffect, useState } from "react";

import { compareCountries } from "@/lib/region-order";
import { descendantRegionIds } from "@/lib/regions/descendant-ids";
import {
  POLICY_DRILLDOWN_BLOCS,
  countriesInPolicyBloc,
  policyBlocForCountrySlug,
  resolvePolicyBlocScopeIds,
  type PolicyRegionBlocKey,
} from "@/lib/regions/policy-blocs";
import type { Region, Signal } from "@/lib/types";

type DemoAware = { is_demo?: boolean };

export interface RegionSelectorProps {
  regions: Region[];
  signals?: Signal[];
  activeRegionId?: string | null;
  allHref?: string;
}

function isDemo(record: unknown): boolean {
  return Boolean((record as DemoAware | null)?.is_demo);
}

function regionHref(region: Region): string {
  return region.region_type === "global" ? "/" : `/regions/${region.slug}`;
}

function regionName(region: Region | undefined): string {
  return region?.name_zh || region?.name_en || region?.code || "未命名地区";
}

function regionCode(region: Region): string {
  return region.code || region.name_en || region.region_type;
}

function isPublishedSignal(signal: Signal): boolean {
  return (
    signal.review_status === "published" &&
    Boolean(signal.published_at) &&
    Boolean(signal.region_id?.trim())
  );
}

type DeskKey = Exclude<PolicyRegionBlocKey, "">;

export function RegionSelector({
  regions,
  signals = [],
  activeRegionId,
  allHref = "/",
}: RegionSelectorProps) {
  const globalRegion = regions.find((region) => region.region_type === "global");
  const countries = regions
    .filter((region) => region.region_type === "country")
    .sort(compareCountries);
  const published = signals.filter(isPublishedSignal);
  const realPublished = published.filter((signal) => !isDemo(signal));
  const demoPublished = published.filter(isDemo);
  const activeRegion = regions.find((region) => region.id === activeRegionId);
  const activeCountry =
    activeRegion?.region_type === "country"
      ? activeRegion
      : activeRegion?.region_type === "province"
        ? countries.find((country) => country.id === activeRegion.parent_id)
        : undefined;
  const activeBlocKey = activeCountry
    ? policyBlocForCountrySlug(activeCountry.slug)
    : null;

  const [expandedBlocKey, setExpandedBlocKey] = useState<DeskKey | null>(
    activeBlocKey,
  );

  useEffect(() => {
    if (activeBlocKey) setExpandedBlocKey(activeBlocKey);
  }, [activeBlocKey]);

  const countForRegion = (region: Region) => {
    const ids = descendantRegionIds(regions, region.id);
    return {
      real: realPublished.filter(
        (signal) => signal.region_id != null && ids.has(signal.region_id),
      ).length,
      demo: demoPublished.filter(
        (signal) => signal.region_id != null && ids.has(signal.region_id),
      ).length,
    };
  };
  const countForBloc = (blocKey: DeskKey) => {
    const ids = resolvePolicyBlocScopeIds(regions, blocKey) ?? new Set();
    return {
      real: realPublished.filter(
        (signal) => signal.region_id != null && ids.has(signal.region_id),
      ).length,
      demo: demoPublished.filter(
        (signal) => signal.region_id != null && ids.has(signal.region_id),
      ).length,
    };
  };
  const isGlobalScope =
    !activeRegionId || activeRegionId === globalRegion?.id;
  const assignedCountryIds = new Set(
    POLICY_DRILLDOWN_BLOCS.flatMap((bloc) =>
      countriesInPolicyBloc(regions, bloc.key).map((country) => country.id),
    ),
  );
  const unassignedCountries = countries.filter(
    (country) => !assignedCountryIds.has(country.id),
  );

  function toggleBloc(blocKey: DeskKey) {
    setExpandedBlocKey((current) => (current === blocKey ? null : blocKey));
  }

  return (
    <nav className="gl-region-directory" aria-label="地区下钻">
      <div className="gl-directory-label">
        <span>Region drill-down</span>
        <i aria-hidden="true" />
      </div>
      <p className="gl-directory-hint">
        {isGlobalScope
          ? "点击片区展开国家；省份详情在右侧省级专题中查看"
          : "当前为地区详情；可切换片区或返回全球总览"}
      </p>

      {isGlobalScope ? null : (
        <a
          className="gl-region-back"
          href={globalRegion ? regionHref(globalRegion) : allHref}
          aria-label="返回全球总览"
        >
          ← 返回全球总览
        </a>
      )}

      <div className="gl-region-group">Desk / 片区</div>
      {POLICY_DRILLDOWN_BLOCS.map((bloc) => {
        const blocCountries = countriesInPolicyBloc(regions, bloc.key);
        const blocCounts = countForBloc(bloc.key);
        const expanded = expandedBlocKey === bloc.key;
        return (
          <div className="gl-continent-cluster" key={bloc.key}>
            <button
              type="button"
              className={`gl-region-button is-continent is-desk ${
                activeBlocKey === bloc.key ? "is-active" : ""
              } ${expanded ? "is-expanded" : ""}`}
              aria-expanded={expanded}
              aria-controls={`desk-countries-${bloc.key}`}
              aria-label={`${bloc.label}，真实 ${blocCounts.real} 条，Demo ${blocCounts.demo} 条`}
              title={`${bloc.label} · Demo ${blocCounts.demo}`}
              onClick={() => toggleBloc(bloc.key)}
            >
              <span className="gl-region-dot" />
              <span>{bloc.label}</span>
              <span className="gl-region-count">
                {String(blocCounts.real).padStart(2, "0")}
              </span>
            </button>
            {expanded ? (
              <div
                className="gl-country-stack"
                id={`desk-countries-${bloc.key}`}
              >
                {blocCountries.map((country) => {
                  const countryCounts = countForRegion(country);
                  const isActiveCountry =
                    activeRegionId === country.id ||
                    activeCountry?.id === country.id;
                  return (
                    <a
                      key={country.id}
                      className={`gl-region-button is-country ${
                        isActiveCountry ? "is-active" : ""
                      }`}
                      href={regionHref(country)}
                      aria-current={isActiveCountry ? "page" : undefined}
                      aria-label={`${regionName(country)}，真实 ${countryCounts.real} 条，Demo ${countryCounts.demo} 条`}
                      title={`${regionName(country)} · Demo ${countryCounts.demo}`}
                    >
                      <span className="gl-region-dot" />
                      <span>
                        {regionName(country)}{" "}
                        <small>· {regionCode(country)}</small>
                      </span>
                      <span className="gl-region-count">
                        {String(countryCounts.real).padStart(2, "0")}
                      </span>
                    </a>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}

      {unassignedCountries.length ? (
        <>
          <div className="gl-region-group">Other / 未归片区</div>
          {unassignedCountries.map((country) => (
            <a
              className={`gl-region-button is-country ${
                activeRegionId === country.id ? "is-active" : ""
              }`}
              href={regionHref(country)}
              aria-current={activeRegionId === country.id ? "page" : undefined}
              aria-label={regionName(country)}
              key={country.id}
            >
              <span className="gl-region-dot" />
              <span>{regionName(country)}</span>
              <span className="gl-region-count">
                {String(countForRegion(country).real).padStart(2, "0")}
              </span>
            </a>
          ))}
        </>
      ) : null}
    </nav>
  );
}
