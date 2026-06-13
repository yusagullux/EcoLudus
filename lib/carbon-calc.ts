// @ts-nocheck
import { readFile } from "fs/promises";
import path from "path";
import { sql } from "@/lib/db";

type QuestDefinition = {
  id: string;
  title: string;
  categoryId: string;
  categoryName: string;
  xp: number;
  eco: number;
  catalogCarbonKg: number;
};

type CarbonResult = {
  kg: number;
  source: "climatiq" | "climatiq-cache" | "quest_catalog";
  sourcePayload: Record<string, unknown>;
};

const CLIMATIQ_ENDPOINT = "https://api.climatiq.io/data/v1/estimate";

const CATEGORY_ESTIMATES: Record<string, { activityId: string; parameters: Record<string, unknown> }> = {
  recycling: {
    activityId: "waste-type_plastic-disposal_method_recycled",
    parameters: { weight: 1, weight_unit: "kg" }
  },
  energy_saving: {
    activityId: "electricity-energy_source_grid_mix",
    parameters: { energy: 2, energy_unit: "kWh" }
  },
  transportation: {
    activityId: "passenger_vehicle-vehicle_type_car-fuel_source_petrol-engine_size_na-vehicle_age_na-vehicle_weight_na",
    parameters: { distance: 5, distance_unit: "km" }
  },
  water_saving: {
    activityId: "water-supply",
    parameters: { volume: 0.05, volume_unit: "m3" }
  },
  cleanup_missions: {
    activityId: "waste-type_plastic-disposal_method_recycled",
    parameters: { weight: 1, weight_unit: "kg" }
  },
  gardening: {
    activityId: "consumer_goods-type_garden_equipment",
    parameters: { money: 1, money_unit: "usd" }
  },
  sustainable_living: {
    activityId: "consumer_goods-type_groceries",
    parameters: { money: 1, money_unit: "usd" }
  }
};

let questCatalogPromise: Promise<Map<string, QuestDefinition>> | null = null;

function roundCarbon(value: number) {
  return Math.max(0, Math.round(value * 100) / 100);
}

async function loadQuestCatalog() {
  if (!questCatalogPromise) {
    questCatalogPromise = (async () => {
      const raw = await readFile(path.join(process.cwd(), "public", "quests.json"), "utf8");
      const parsed = JSON.parse(raw);
      const quests = new Map<string, QuestDefinition>();

      for (const category of parsed.categories || []) {
        for (const quest of category.quests || []) {
          quests.set(quest.id, {
            id: quest.id,
            title: quest.shortName || quest.description || quest.id,
            categoryId: category.id,
            categoryName: category.name,
            xp: Number(quest.xp ?? 35),
            eco: Number(quest.ecoCoins ?? 25),
            catalogCarbonKg: Number(quest.carbonFootprintReduction ?? 0)
          });
        }
      }

      return quests;
    })();
  }

  return questCatalogPromise;
}

export async function getQuestDefinition(questId: string) {
  const catalog = await loadQuestCatalog();
  return catalog.get(questId) ?? null;
}

export async function getQuestCarbonReduction(quest: QuestDefinition): Promise<CarbonResult> {
  const apiKey = process.env.CLIMATIQ_API_KEY?.trim();
  const cached = await sql<{
    quest_id: string;
    carbon_value: string | number;
    source: string;
    source_payload: Record<string, unknown>;
    cached_at: string;
  }>(
    "select quest_id, carbon_value, source, source_payload, cached_at from carbon_cache where quest_id = $1 and cached_at > now() - interval '30 days' limit 1",
    [quest.id]
  );

  if (cached.rowCount) {
    const row = cached.rows[0];
    const hasVerifiedValue = row.source === "climatiq";

    if (hasVerifiedValue || !apiKey) {
      return {
        kg: roundCarbon(Number(row.carbon_value ?? 0)),
        source: hasVerifiedValue ? "climatiq-cache" : "quest_catalog",
        sourcePayload: {
          ...(row.source_payload || {}),
          cachedAt: row.cached_at
        }
      };
    }
  }

  const estimate = CATEGORY_ESTIMATES[quest.categoryId];

  if (apiKey && estimate) {
    try {
      const response = await fetch(CLIMATIQ_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          emission_factor: {
            activity_id: estimate.activityId,
            data_version: "^3"
          },
          parameters: estimate.parameters
        })
      });

      if (!response.ok) {
        throw new Error(`Climatiq returned ${response.status}`);
      }

      const data = await response.json();
      const kg = roundCarbon(Number(data.co2e ?? 0));
      const sourcePayload = {
        provider: "climatiq",
        endpoint: CLIMATIQ_ENDPOINT,
        activityId: estimate.activityId,
        parameters: estimate.parameters,
        co2eUnit: data.co2e_unit,
        factor: data.emission_factor
          ? {
              id: data.emission_factor.id,
              name: data.emission_factor.name,
              source: data.emission_factor.source,
              region: data.emission_factor.region,
              year: data.emission_factor.year
            }
          : null
      };

      await cacheCarbonValue(quest.id, kg, "climatiq", sourcePayload);
      return { kg, source: "climatiq", sourcePayload };
    } catch (error) {
      console.error("Climatiq carbon calculation failed:", error);
    }
  }

  const fallbackKg = roundCarbon(quest.catalogCarbonKg);
  const fallbackPayload = {
    provider: "quest_catalog",
    reason: apiKey ? "climatiq_unavailable" : "missing_climatiq_api_key",
    categoryId: quest.categoryId,
    catalogCarbonKg: fallbackKg
  };

  if (!apiKey) {
    await cacheCarbonValue(quest.id, fallbackKg, "quest_catalog", fallbackPayload);
  }

  return {
    kg: fallbackKg,
    source: "quest_catalog",
    sourcePayload: fallbackPayload
  };
}

async function cacheCarbonValue(
  questId: string,
  carbonValue: number,
  source: string,
  sourcePayload: Record<string, unknown>
) {
  await sql(
    `insert into carbon_cache (quest_id, carbon_value, source, source_payload, cached_at)
     values ($1, $2, $3, $4::jsonb, now())
     on conflict (quest_id) do update
     set carbon_value = excluded.carbon_value,
         source = excluded.source,
         source_payload = excluded.source_payload,
         cached_at = now()`,
    [questId, carbonValue, source, JSON.stringify(sourcePayload)]
  );
}
