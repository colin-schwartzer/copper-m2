import { ArrowLeftIcon, ArrowRightIcon, LoaderCircleIcon } from "lucide-react";
import {
  TOOL_LABELS as LABELS,
  type ToolStep,
} from "@/lib/copper/assistant/progress";
import type {
  Availability,
  CalculateCostInput,
  CheckAvailabilityInput,
  CostBreakdown,
  Prices,
  ProductList,
  Stock,
} from "@/lib/copper/assistant/tools";
import { formatUsd, getPlans, getProducts } from "@/lib/copper/catalog";
import { cn } from "@/lib/utils";

// One tool call, drawn as a work-order ticket: what Copper sent to the tool
// on top, a perforated tear line, and what came back underneath. It's always
// open, so anyone can see exactly what the model asked the app for.

const STOCK: Record<Stock, { label: string; className: string }> = {
  in_stock: { label: "In stock", className: "bg-accent/15 text-accent" },
  low_stock: { label: "Low stock", className: "bg-chart-4/30 text-foreground" },
  backordered: {
    label: "Back-ordered",
    className: "bg-chart-3/15 text-chart-3",
  },
};

const productName = (id: string) =>
  getProducts().find((p) => p.id === id)?.name ?? id;
const planName = (id: string) =>
  getPlans().find((p) => p.id === id)?.name ?? id;

/** "2026-11-14" → "Nov 14, 2026". */
const formatDate = (isoDate: string) =>
  new Date(`${isoDate}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

function Label({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-accent mb-1.5 flex items-center gap-1 text-[10px] font-bold tracking-[0.14em] uppercase">
      {children}
    </h4>
  );
}

function Sent({ call }: { call: ToolStep }) {
  let rows: [string, string][];
  if (call.name === "calculate_cost") {
    const input = call.input as CalculateCostInput;
    rows = [
      ["Products", input.products.map(productName).join(", ") || "None"],
      ["Plan", planName(input.plan)],
      ["Billing", input.billing],
      ["Years", String(input.years)],
    ];
  } else if (call.name === "check_availability") {
    const input = call.input as CheckAvailabilityInput;
    rows = [
      ["Product", productName(input.product)],
      ["Color", input.color ?? "Every color"],
    ];
  } else if (call.name === "get_prices") {
    return (
      <p className="text-muted-foreground italic">
        Nothing, it just asked for the price list.
      </p>
    );
  } else if (call.name === "get_products") {
    return (
      <p className="text-muted-foreground italic">
        Nothing, it just asked what Copper sells.
      </p>
    );
  } else {
    return <pre className="text-xs">{JSON.stringify(call.input, null, 2)}</pre>;
  }
  return (
    <dl className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-medium capitalize">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Line({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <li className="flex items-baseline justify-between gap-4">
      <span>{label}</span>
      <span className="font-medium whitespace-nowrap tabular-nums">
        {value}
      </span>
    </li>
  );
}

function CameBack({ call }: { call: ToolStep }) {
  if (call.name === "calculate_cost") {
    const output = call.output as CostBreakdown;
    return (
      <>
        <ul className="space-y-1">
          {output.lines.map((line) => (
            <Line
              key={line.item}
              label={line.item}
              value={formatUsd(line.usd)}
            />
          ))}
        </ul>
        <div className="border-foreground/80 mt-2 flex items-baseline justify-between border-t-2 pt-2">
          <span className="font-heading font-bold">Total</span>
          <span className="font-heading text-primary text-xl font-extrabold tabular-nums">
            {formatUsd(output.totalUsd)}
          </span>
        </div>
      </>
    );
  }
  if (call.name === "get_products") {
    const output = call.output as ProductList;
    return (
      <ul className="space-y-2.5">
        {output.products.map((product) => (
          <li key={product.id}>
            <Line label={product.name} value={formatUsd(product.priceUsd)} />
            <p className="text-muted-foreground text-xs">{product.type}</p>
            <ul className="mt-1 flex flex-wrap gap-1">
              {product.colors.map((color) => (
                <li
                  key={color}
                  className="bg-accent/15 text-accent rounded-full px-2 py-0.5 text-xs font-semibold"
                >
                  {color}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    );
  }
  if (call.name === "get_prices") {
    const output = call.output as Prices;
    return (
      <ul className="space-y-1">
        {output.products.map((p) => (
          <Line key={p.id} label={p.name} value={formatUsd(p.priceUsd)} />
        ))}
        {output.plans
          .filter((p) => p.monthlyUsd > 0)
          .map((p) => (
            <Line
              key={p.id}
              label={p.name}
              value={`${formatUsd(p.monthlyUsd)}/mo · ${formatUsd(p.annualUsd)}/yr`}
            />
          ))}
      </ul>
    );
  }
  if (call.name === "check_availability") {
    const output = call.output as Availability;
    if (output.status === "unavailable") {
      return <p className="text-muted-foreground italic">{output.message}</p>;
    }
    if (output.status === "not_a_color") {
      return (
        <p>
          {output.product} doesn&apos;t come in{" "}
          <strong className="text-chart-3">{output.color}</strong>. It comes in{" "}
          {output.colors.join(", ")}.
        </p>
      );
    }
    return (
      <ul className="space-y-1.5">
        {output.colors.map((c) => (
          <Line
            key={c.color}
            label={c.color}
            value={
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-semibold",
                  STOCK[c.stock].className,
                )}
              >
                {STOCK[c.stock].label}
                {c.restockDate && ` until ${formatDate(c.restockDate)}`}
              </span>
            }
          />
        ))}
      </ul>
    );
  }
  return <pre className="text-xs">{JSON.stringify(call.output, null, 2)}</pre>;
}

export function ToolCallCard({
  step,
  number,
}: {
  step: ToolStep;
  /** Which tool call this is in the answer, starting at 1. */
  number: number;
}) {
  const call = step;
  const waiting = step.state === "calling";
  return (
    <div
      data-testid="tool-call"
      data-tool={call.name}
      className="border-accent/50 bg-card animate-in fade-in slide-in-from-left-2 overflow-hidden rounded-lg border text-sm shadow-sm duration-300"
    >
      <div className="bg-accent text-background flex items-center gap-2 px-3 py-1.5">
        <code className="font-mono text-[11px] font-bold tracking-tight">
          {call.name}()
        </code>
        <span className="bg-background/20 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
          tool {number}
        </span>
        <span className="ml-auto text-[11px] opacity-90">
          {LABELS[call.name] ?? "Using a tool"}
        </span>
      </div>

      {/* Copper's side of the exchange: what it asked the app for. */}
      <div className="px-3 py-2.5">
        <Label>
          <ArrowRightIcon aria-hidden className="inline size-3" /> What Copper
          sent
        </Label>
        {call.input === undefined ? (
          <p className="text-muted-foreground animate-pulse italic">
            filling in the details…
          </p>
        ) : (
          <Sent call={call} />
        )}
      </div>

      {/* The app's side: the real numbers the code looked up. */}
      <div
        className={cn(
          "border-t px-3 py-2.5",
          waiting ? "bg-muted/40" : "bg-accent/10",
        )}
      >
        <Label>
          <ArrowLeftIcon aria-hidden className="inline size-3" /> What came back
        </Label>
        {waiting ? (
          <p className="text-muted-foreground flex items-center gap-2 italic">
            <LoaderCircleIcon aria-hidden className="size-3.5 animate-spin" />
            the app is running the code…
          </p>
        ) : step.state === "error" ? (
          <p className="text-chart-3">{String(call.output)}</p>
        ) : (
          <CameBack call={call} />
        )}
      </div>
    </div>
  );
}
