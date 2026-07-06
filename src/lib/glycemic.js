// Estimated glycemic load. True GI needs lab data we don't have, so this is an
// explicit heuristic — always labeled "estimated" in the UI:
//   GI_est = 40 + 40·(sugar/carbs) − 60·(fiber/carbs), clamped to 25–75
//   GL_est = net carbs × GI_est / 100
export function estimatedGL({ carbs = 0, sugar = 0, fiber = 0 }) {
  if (carbs <= 0.5) return 0;
  const sugarRatio = Math.min(1, sugar / carbs);
  const fiberRatio = Math.min(1, fiber / carbs);
  const gi = Math.max(25, Math.min(75, 40 + 40 * sugarRatio - 60 * fiberRatio));
  const netCarbs = Math.max(0, carbs - fiber);
  return (netCarbs * gi) / 100;
}
