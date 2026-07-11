// Recipe ingredients are written at kitchen granularity (grams, millilitres,
// pieces) while inventory products are stocked/counted at a coarser unit
// (kg, liter, piece, box) — this converts a recipe quantity into the
// product's own stocking unit so reserve/consume operate on the right scale.
// Unrecognized unit pairs pass through unconverted rather than silently
// zeroing out — a wrong-but-visible number is safer than one that vanishes.

const G_PER_KG = 1000;
const ML_PER_LITER = 1000;

export function convertToStockUnit(
  quantity: number,
  fromUnit: string,
  toUnit: string,
): number {
  const from = fromUnit.trim().toLowerCase();
  const to = toUnit.trim().toLowerCase();
  if (from === to) return quantity;

  if (to === 'kg' && ['g', 'gram', 'grams'].includes(from)) return quantity / G_PER_KG;
  if (to === 'liter' && ['ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres'].includes(from)) return quantity / ML_PER_LITER;
  if (to === 'piece' && ['pc', 'pcs', 'piece', 'pieces', 'slice', 'slices'].includes(from)) return quantity;
  if (to === 'g' && ['kg', 'kilogram', 'kilograms'].includes(from)) return quantity * G_PER_KG;
  if (to === 'ml' && ['l', 'liter', 'liters', 'litre', 'litres'].includes(from)) return quantity * ML_PER_LITER;

  return quantity;
}
