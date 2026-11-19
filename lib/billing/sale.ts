import type { Plan, PlanKind } from "@/lib/billing/plans";
import { LIFETIME_PLAN, formatPrice } from "@/lib/billing/plans";

// A time-limited discount code, shown in a strip under the navbar on every
// page, and on the pricing page (a coupon under the heading, and the sale
// price in the plan's card). The code itself
// lives in the Dodo dashboard (Sales → Discounts), which limits it to the
// plan's product. /api/checkout puts it on every checkout of that plan
// while the sale runs, so Dodo opens at the sale price; if Dodo refuses the
// code, the checkout opens at full price. Keep code, percentOff and endsAt
// in step with the dashboard.
//
// To end a sale early, set SALE to null. To run the next one, fill it in
// again. Once endsAt passes the pricing page drops the sale within its
// revalidate window, and the strip and coupon hide themselves in the
// browser (their countdowns). Set SALE to null and deploy after a sale so
// statically built pages stop sending it at all.

export interface Sale {
  // The Dodo discount code, applied to the plan's checkouts for you.
  code: string;
  // Short name for the badge, e.g. "Black Friday".
  name: string;
  percentOff: number;
  // The only plan the code works on (restricted in the Dodo dashboard).
  plan: Plan;
  // When the code stops working, as an ISO date with its offset.
  endsAt: string;
  // The same moment for people, e.g. "Nov 30".
  endsLabel: string;
}

export const SALE: Sale | null = {
  code: "BLKFRI60",
  endsAt: "2026-11-30T23:59:59-08:00",
  endsLabel: "Nov 30",
  name: "Black Friday",
  percentOff: 60,
  plan: LIFETIME_PLAN,
};

// The sale, if it's still running at `now`.
export const getActiveSale = (now = Date.now()): Sale | null =>
  SALE && now < Date.parse(SALE.endsAt) ? SALE : null;

export const salePriceCents = (sale: Sale) =>
  Math.round((sale.plan.priceCents * (100 - sale.percentOff)) / 100);

// What the client components need of a sale (components/pricing-sale.tsx),
// as plain data: the plan's Dodo product ID stays on the server.
export interface SaleInfo {
  code: string;
  endsAt: string;
  endsLabel: string;
  name: string;
  percentOff: number;
  plan: PlanKind;
  planName: string;
  priceLabel: string;
  salePriceLabel: string;
}

export const toSaleInfo = (sale: Sale): SaleInfo => ({
  code: sale.code,
  endsAt: sale.endsAt,
  endsLabel: sale.endsLabel,
  name: sale.name,
  percentOff: sale.percentOff,
  plan: sale.plan.kind,
  planName: sale.plan.name,
  priceLabel: formatPrice(sale.plan.priceCents),
  salePriceLabel: formatPrice(salePriceCents(sale)),
});
