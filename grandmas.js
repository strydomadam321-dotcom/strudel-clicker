const names = [
  "Agnes",
  "Greta",
  "Elsa",
  "Martha",
  "Hilda",
  "Ruth",
  "Edith",
  "Gertrud",
  "Ida",
  "Frieda",
  "Lotte",
  "Clara",
  "Ingrid",
  "Helga",
  "Anna",
  "Rose",
  "Emma",
  "Brigitte",
  "Elisabeth",
  "Margaret",
  "Dorothea",
  "Johanna",
  "Irma",
  "Wilma",
  "Erna",
  "Beatrice",
  "Vera",
  "Alma",
  "Therese",
  "Henriette",
  "Adelheid",
  "Ottilie",
];
export function grandmaProfile(index, seed = 0) {
  let hash = (Math.floor(seed) ^ Math.imul(index + 1, 0x45d9f3b)) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b) >>> 0;
  hash = (hash ^ (hash >>> 16)) >>> 0;
  return { name: names[hash % names.length], age: 81 + ((hash >>> 8) % 40) };
}
