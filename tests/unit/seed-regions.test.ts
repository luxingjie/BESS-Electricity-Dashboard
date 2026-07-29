import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const CHINA_ID = "00000000-0000-4000-8000-000000000002";
const GLOBAL_ID = "00000000-0000-4000-8000-000000000001";

const EXPECTED_GLOBAL_DIRECTORY = [
  {
    id: "00000000-0000-4000-8000-000000000101",
    nameZh: "亚洲",
    slug: "asia",
    code: "CONT-AS",
    countries: [
      ["中国", "china", "CN"],
      ["日本", "japan", "JP"],
      ["韩国", "south-korea", "KR"],
      ["印度", "india", "IN"],
      ["新加坡", "singapore", "SG"],
      ["马来西亚", "malaysia", "MY"],
      ["印度尼西亚", "indonesia", "ID"],
    ],
  },
  {
    id: "00000000-0000-4000-8000-000000000102",
    nameZh: "欧洲",
    slug: "europe",
    code: "CONT-EU",
    countries: [
      ["德国", "germany", "DE"],
      ["英国", "united-kingdom", "GB"],
      ["法国", "france", "FR"],
      ["西班牙", "spain", "ES"],
      ["意大利", "italy", "IT"],
      ["荷兰", "netherlands", "NL"],
    ],
  },
  {
    id: "00000000-0000-4000-8000-000000000103",
    nameZh: "北美洲",
    slug: "north-america",
    code: "CONT-NA",
    countries: [
      ["美国", "usa", "US"],
      ["加拿大", "canada", "CA"],
      ["墨西哥", "mexico", "MX"],
    ],
  },
  {
    id: "00000000-0000-4000-8000-000000000104",
    nameZh: "南美洲",
    slug: "south-america",
    code: "CONT-SA",
    countries: [
      ["智利", "chile", "CL"],
      ["巴西", "brazil", "BR"],
      ["阿根廷", "argentina", "AR"],
      ["哥伦比亚", "colombia", "CO"],
    ],
  },
  {
    id: "00000000-0000-4000-8000-000000000105",
    nameZh: "大洋洲",
    slug: "oceania",
    code: "CONT-OC",
    countries: [
      ["澳大利亚", "australia", "AU"],
      ["新西兰", "new-zealand", "NZ"],
    ],
  },
  {
    id: "00000000-0000-4000-8000-000000000106",
    nameZh: "非洲",
    slug: "africa",
    code: "CONT-AF",
    countries: [
      ["南非", "south-africa", "ZA"],
      ["埃及", "egypt", "EG"],
      ["摩洛哥", "morocco", "MA"],
      ["肯尼亚", "kenya", "KE"],
    ],
  },
] as const;

const EXPECTED_MAINLAND_PROVINCES = [
  ["北京", "beijing"],
  ["天津", "tianjin"],
  ["河北", "hebei"],
  ["山西", "shanxi"],
  ["内蒙古", "inner-mongolia"],
  ["辽宁", "liaoning"],
  ["吉林", "jilin"],
  ["黑龙江", "heilongjiang"],
  ["上海", "shanghai"],
  ["江苏", "jiangsu"],
  ["浙江", "zhejiang"],
  ["安徽", "anhui"],
  ["福建", "fujian"],
  ["江西", "jiangxi"],
  ["山东", "shandong"],
  ["河南", "henan"],
  ["湖北", "hubei"],
  ["湖南", "hunan"],
  ["广东", "guangdong"],
  ["广西", "guangxi"],
  ["海南", "hainan"],
  ["重庆", "chongqing"],
  ["四川", "sichuan"],
  ["贵州", "guizhou"],
  ["云南", "yunnan"],
  ["西藏", "xizang"],
  ["陕西", "shaanxi"],
  ["甘肃", "gansu"],
  ["青海", "qinghai"],
  ["宁夏", "ningxia"],
  ["新疆", "xinjiang"],
] as const;

type SeedRegion = {
  id: string;
  slug: string;
  code: string;
  nameZh: string;
  regionType: string;
  parentId: string | null;
  isDemo: boolean;
};

function seededRegions(): SeedRegion[] {
  const seedPath = fileURLToPath(
    new URL("../../supabase/seed.sql", import.meta.url),
  );
  const sql = readFileSync(seedPath, "utf8");
  const values = sql.match(
    /insert into public\.regions[\s\S]*?values([\s\S]*?)on conflict \(id\) do nothing;/i,
  )?.[1];

  if (!values) throw new Error("regions seed insert was not found");

  const rowPattern =
    /\('([^']+)', '([^']+)', '([^']+)', '([^']+)', '[^']+', '(global|continent|country|province)', (null|'[^']+'), (true|false)\)/g;

  return [...values.matchAll(rowPattern)].map((match) => ({
    id: match[1],
    slug: match[2],
    code: match[3],
    nameZh: match[4],
    regionType: match[5],
    parentId: match[6] === "null" ? null : match[6].slice(1, -1),
    isDemo: match[7] === "true",
  }));
}

describe("mainland China province seed coverage", () => {
  it("contains the complete, unique 31-province directory under China", () => {
    const allRegions = seededRegions();
    const provinces = allRegions.filter(
      (region) =>
        region.regionType === "province" && region.parentId === CHINA_ID,
    );
    const actualPairs = provinces
      .map(({ nameZh, slug }) => `${nameZh}:${slug}`)
      .sort();
    const expectedPairs = EXPECTED_MAINLAND_PROVINCES.map(
      ([nameZh, slug]) => `${nameZh}:${slug}`,
    ).sort();

    expect(provinces).toHaveLength(31);
    expect(actualPairs).toEqual(expectedPairs);
    expect(new Set(provinces.map((region) => region.nameZh)).size).toBe(31);
    expect(new Set(provinces.map((region) => region.slug)).size).toBe(31);
    expect(new Set(provinces.map((region) => region.code)).size).toBe(31);
    expect(provinces.every((region) => region.code.startsWith("CN-"))).toBe(true);
    expect(provinces.find((region) => region.slug === "xizang")?.code).toBe(
      "CN-XZ",
    );
    expect(provinces.map((region) => region.slug)).not.toEqual(
      expect.arrayContaining(["hong-kong", "macao", "taiwan", "xpcc"]),
    );
    expect(new Set(allRegions.map((region) => region.id)).size).toBe(
      allRegions.length,
    );
    expect(provinces.every((region) => region.isDemo)).toBe(true);
  });
});

describe("global region seed hierarchy", () => {
  it("contains global, six continents, and the representative countries", () => {
    const allRegions = seededRegions();
    const global = allRegions.find((region) => region.id === GLOBAL_ID);
    const continents = allRegions.filter(
      (region) =>
        region.regionType === "continent" && region.parentId === GLOBAL_ID,
    );

    expect(allRegions).toHaveLength(64);
    expect(global).toMatchObject({
      slug: "global",
      regionType: "global",
      parentId: null,
      isDemo: true,
    });
    expect(continents).toHaveLength(6);

    for (const expected of EXPECTED_GLOBAL_DIRECTORY) {
      const continent = continents.find((region) => region.id === expected.id);
      const countries = allRegions
        .filter(
          (region) =>
            region.regionType === "country" && region.parentId === expected.id,
        )
        .map(({ nameZh, slug, code }) => `${nameZh}:${slug}:${code}`)
        .sort();
      const expectedCountries = expected.countries
        .map(([nameZh, slug, code]) => `${nameZh}:${slug}:${code}`)
        .sort();

      expect(continent).toMatchObject({
        nameZh: expected.nameZh,
        slug: expected.slug,
        code: expected.code,
        isDemo: true,
      });
      expect(countries).toEqual(expectedCountries);
    }

    const representativeCountries = allRegions.filter(
      (region) => region.regionType === "country",
    );
    expect(representativeCountries).toHaveLength(26);
    expect(representativeCountries.every((region) => region.isDemo)).toBe(true);
    expect(allRegions.find((region) => region.id === CHINA_ID)?.parentId).toBe(
      "00000000-0000-4000-8000-000000000101",
    );
    expect(new Set(allRegions.map((region) => region.slug)).size).toBe(
      allRegions.length,
    );
    expect(new Set(allRegions.map((region) => region.code)).size).toBe(
      allRegions.length,
    );
  });

  it("keeps the enum change and continent data in separate migrations", () => {
    const enumMigration = readFileSync(
      fileURLToPath(
        new URL(
          "../../supabase/migrations/202607220003_add_continent_region_type.sql",
          import.meta.url,
        ),
      ),
      "utf8",
    );
    const dataMigration = readFileSync(
      fileURLToPath(
        new URL(
          "../../supabase/migrations/202607220004_global_region_directory.sql",
          import.meta.url,
        ),
      ),
      "utf8",
    );

    expect(enumMigration).toMatch(
      /alter type public\.region_type add value if not exists 'continent'/i,
    );
    expect(enumMigration).not.toMatch(/insert into public\.regions/i);
    expect(dataMigration).toMatch(/'continent'/i);
    expect(dataMigration).not.toMatch(/alter type public\.region_type/i);
  });
});
