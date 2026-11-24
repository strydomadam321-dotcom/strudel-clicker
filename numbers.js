// Integer displays never round up. Fractional production is accumulated in the game.
export function formatNumber(
  value,
  { language = "en", format = "short" } = {},
) {
  if (!Number.isFinite(value)) return "∞";
  const n = Math.max(0, Math.floor(value));
  const locale = language === "de" ? "de-DE" : "en-US";
  if (format === "full" || n < 1e6)
    return n.toLocaleString(locale, { maximumFractionDigits: 0 });
  const exponent = Math.floor(Math.log10(n));
  if (format === "scientific" || exponent >= 36)
    return `${Math.floor(n / 10 ** exponent)}e${exponent}`;
  const group = Math.floor(exponent / 3);
  const units =
    language === "de"
      ? [
          "",
          "",
          "Millionen",
          "Milliarden",
          "Billionen",
          "Billiarden",
          "Trillionen",
          "Trilliarden",
          "Quadrillionen",
          "Quadrilliarden",
          "Quintillionen",
          "Quintilliarden",
        ]
      : [
          "",
          "",
          "million",
          "billion",
          "trillion",
          "quadrillion",
          "quintillion",
          "sextillion",
          "septillion",
          "octillion",
          "nonillion",
          "decillion",
        ];
  const quantity = Math.floor(n / 1000 ** group);
  const singular = [
    "",
    "",
    "Million",
    "Milliarde",
    "Billion",
    "Billiarde",
    "Trillion",
    "Trilliarde",
    "Quadrillion",
    "Quadrilliarde",
    "Quintillion",
    "Quintilliarde",
  ];
  return `${quantity.toLocaleString(locale)} ${language === "de" && quantity === 1 ? singular[group] : units[group]}`;
}
