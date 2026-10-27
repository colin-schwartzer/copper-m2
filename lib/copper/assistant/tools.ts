// Module 2: the four tools Ask Copper can use. Products and prices come from
// lib/copper/catalog.ts and stock from lib/copper/inventory.ts, so the
// chatbot never has to make them up.
// The contract for each tool is in specs/module-2/spec.md.
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import {
  getPlans,
  getProducts,
  type Plan,
  type ProductId,
} from "@/lib/copper/catalog";
import { readInventory } from "@/lib/copper/inventory";

export type ProductList = {
  products: {
    id: ProductId;
    name: string;
    type: string;
    priceUsd: number;
    colors: string[];
  }[];
};

export type Prices = {
  products: { id: ProductId; name: string; priceUsd: number }[];
  plans: {
    id: Plan["id"];
    name: string;
    monthlyUsd: number;
    annualUsd: number;
  }[];
};

export type CalculateCostInput = {
  products: ProductId[];
  plan: Plan["id"];
  billing: "monthly" | "annual";
  years: number;
};

export type CostBreakdown = {
  lines: { item: string; usd: number }[];
  totalUsd: number;
};

export type CheckAvailabilityInput = { product: ProductId; color?: string };

export type Stock = "in_stock" | "low_stock" | "backordered";

export type Availability =
  | {
      status: "ok";
      product: string;
      colors: { color: string; stock: Stock; restockDate: string | null }[];
    }
  | { status: "not_a_color"; product: string; color: string; colors: string[] }
  | { status: "unavailable"; message: string };

const productId = z.enum(["copper-home", "copper-notes"]);

/** Fewer units than this counts as low stock. */
const LOW_STOCK = 10;

const cents = (usd: number) => Math.round(usd * 100) / 100;

/** get_products: what Copper sells and which colors each one comes in. */
export function listProducts(): ProductList {
  return {
    products: getProducts().map(({ id, name, type, priceUsd, colors }) => ({
      id,
      name,
      type,
      priceUsd,
      colors,
    })),
  };
}

/** get_prices: every product and plan price, read from the catalog. */
export function getPrices(): Prices {
  return {
    products: getProducts().map(({ id, name, priceUsd }) => ({
      id,
      name,
      priceUsd,
    })),
    plans: getPlans().map(({ id, name, monthlyUsd, annualUsd }) => ({
      id,
      name,
      monthlyUsd,
      annualUsd,
    })),
  };
}

export const calculateCostInput = z.object({
  products: z.array(productId).max(5),
  plan: z.enum(["free", "copper-plus"]),
  billing: z.enum(["monthly", "annual"]),
  years: z.number().int().min(1).max(5),
});

/** calculate_cost: the total cost of devices plus a plan over some years. */
export function calculateCost(input: CalculateCostInput): CostBreakdown {
  const products = getProducts();
  const lines = input.products.map((id) => {
    const product = products.find((p) => p.id === id)!;
    return { item: product.name, usd: product.priceUsd };
  });
  const plan = getPlans().find((p) => p.id === input.plan)!;
  const yearly =
    input.billing === "annual" ? plan.annualUsd : plan.monthlyUsd * 12;
  if (yearly > 0) {
    const years = input.years === 1 ? "1 year" : `${input.years} years`;
    lines.push({
      item: `${plan.name}, ${input.billing}, ${years}`,
      usd: cents(yearly * input.years),
    });
  }
  return {
    lines,
    totalUsd: cents(lines.reduce((sum, line) => sum + line.usd, 0)),
  };
}

export const checkAvailabilityInput = z.object({
  product: productId,
  color: z.string().trim().min(1).optional(),
});

/** check_availability: stock for one product (or one of its colors), read fresh each time. */
export async function checkAvailability(
  input: CheckAvailabilityInput,
): Promise<Availability> {
  const product = getProducts().find((p) => p.id === input.product)!;
  let colors = product.colors;
  if (input.color) {
    const match = colors.find(
      (c) => c.toLowerCase() === input.color!.trim().toLowerCase(),
    );
    if (!match) {
      return {
        status: "not_a_color",
        product: product.name,
        color: input.color,
        colors: product.colors,
      };
    }
    colors = [match];
  }

  const unavailable = {
    status: "unavailable",
    message: "Stock can't be checked right now.",
  } as const;
  const stock = await readInventory();
  if (!stock) return unavailable;
  const rows = stock.filter((row) => row.product === product.name);
  return {
    status: "ok",
    product: product.name,
    colors: colors.flatMap((color) => {
      const row = rows.find((r) => r.color === color);
      if (!row) return [];
      const units = row.units_in_stock;
      const stock: Stock =
        units === 0
          ? "backordered"
          : units < LOW_STOCK
            ? "low_stock"
            : "in_stock";
      return [
        {
          color,
          stock,
          restockDate: stock === "backordered" ? row.next_shipment : null,
        },
      ];
    }),
  };
}

export const copperTools = {
  get_products: tool({
    description:
      "List the Copper products, what each one is, what it costs and the colors it comes in. Says nothing about stock.",
    inputSchema: z.object({}),
    execute: async () => listProducts(),
  }),
  get_prices: tool({
    description:
      "Look up the current price of every Copper product and Copper Plus plan.",
    inputSchema: z.object({}),
    execute: async () => getPrices(),
  }),
  calculate_cost: tool({
    description:
      "Work out the total cost of Copper devices plus a plan (Free or Copper Plus, monthly or annual) over 1 to 5 years.",
    inputSchema: calculateCostInput,
    execute: async (input) => calculateCost(input),
  }),
  check_availability: tool({
    description:
      "Check whether a Copper product is in stock, for every color or one color, and when back-ordered colors arrive.",
    inputSchema: checkAvailabilityInput,
    execute: async (input) => checkAvailability(input),
  }),
} satisfies ToolSet;
