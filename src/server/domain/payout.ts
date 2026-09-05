export function computeEarningsCents(
  views: number,
  payoutPerKViewsCents: number,
): number {
  return Math.floor(views / 1000) * payoutPerKViewsCents;
}
