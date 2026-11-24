import { buildings } from "./buildings.js";
export const achievements = [
  ...[1, 100, 1000, 100000, 1000000, 1000000000, 1000000000000].map(
    (at, i) => ({
      id: `baked${i}`,
      name: [
        "A flaky beginning",
        "A small gathering",
        "Local legend",
        "A serious hobby",
        "Apple empire",
        "Dough billionaire",
        "Beyond reasonable portions",
      ][i],
      description: `Bake ${at.toLocaleString("en-US")} strudels in total.`,
      test: (s) => s.total >= at,
    }),
  ),
  ...[10, 100, 1000, 10000].map((at, i) => ({
    id: `clicks${i}`,
    name: [
      "Getting the hang of it",
      "Knead for speed",
      "Carpal pastry",
      "Unstoppable fingers",
    ][i],
    description: `Click ${at.toLocaleString("en-US")} times.`,
    test: (s) => s.clicks >= at,
  })),
  ...buildings.map((b) => ({
    id: `own${b.id}`,
    name: `A taste of ${b.name}`,
    description: `Own your first ${b.name}.`,
    test: (s) => s.owned[b.id] > 0,
  })),
  {
    id: "lucky",
    name: "Beginner’s luck",
    description: "Catch a lucky strudel.",
    test: (s) => s.goldenClicks > 0,
  },
  {
    id: "ascend",
    name: "Back to the dough",
    description: "Ascend at least once.",
    test: (s) => s.ascensions > 0,
  },
];
