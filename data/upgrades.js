import { buildings } from "./buildings.js";
export const upgrades = buildings
  .flatMap((b) =>
    [1, 5, 25, 50, 100].map((at, tier) => ({
      id: `b${b.id}-${at}`,
      name: [
        `Seasoned ${b.name}`,
        `Better butter: ${b.name}`,
        `Masterful ${b.name}`,
        `Heirloom ${b.name}`,
        `Perfect ${b.name}`,
      ][tier],
      cost: b.cost * [10, 50, 500, 5000, 50000][tier],
      building: b.id,
      at,
      multiplier: 2,
      kind: "building",
      description: `${b.name} produce twice as many strudels.`,
      art: b.art,
    })),
  )
  .concat(
    [50, 500, 5000, 50000, 500000, 5000000].map((cost, i) => ({
      id: `click${i}`,
      name: [
        "Floured fingers",
        "A firmer handshake",
        "Ambidextrous baking",
        "Tenacious kneading",
        "The golden touch",
        "Hands of destiny",
      ][i],
      cost,
      at: [10, 50, 100, 250, 500, 1000][i],
      kind: "click",
      multiplier: 2,
      description: "Double strudels per click.",
      art: "cinnamon",
    })),
    [10000, 1000000, 100000000, 10000000000].map((cost, i) => ({
      id: `global${i}`,
      name: [
        "Real butter",
        "The family recipe",
        "A pinch of obsession",
        "European excellence",
      ][i],
      cost,
      at: cost / 2,
      kind: "global",
      multiplier: 1.25,
      description: "All production and clicks gain 25%.",
      art: "medal",
    })),
  );
export const legacyUpgrades = [
  {
    id: "recipe",
    name: "Eternal recipe",
    cost: 1,
    description: "Permanent +10% production per Vienna Point earned.",
  },
  {
    id: "starter",
    name: "Grandma’s care package",
    cost: 2,
    description: "Begin each run with 100 strudels and a rolling pin.",
  },
  {
    id: "luck",
    name: "Austrian luck",
    cost: 3,
    description: "Lucky strudels appear twice as often.",
  },
  {
    id: "butter",
    name: "Cultured butter",
    cost: 5,
    description: "Achievement Butter is twice as effective.",
  },
];
