import type { Column, Row } from "@/lib/charts/types";

export interface SampleDataset {
  id: string;
  name: string;
  description: string;
  emoji: string;
  tags: string[];
  columns: Column[];
  rows: Row[];
}

// Deterministic pseudo-random so samples look the same for everyone.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const pick = <T,>(r: () => number, arr: T[]) => arr[Math.floor(r() * arr.length)];
const weighted = <T,>(r: () => number, items: [T, number][]) => {
  const total = items.reduce((a, [, w]) => a + w, 0);
  let x = r() * total;
  for (const [item, w] of items) {
    if ((x -= w) <= 0) return item;
  }
  return items[items.length - 1][0];
};
const round = (n: number, d = 0) => Math.round(n * 10 ** d) / 10 ** d;
const iso = (d: Date) => d.toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// 1. E-commerce orders (Jan–Sep 2025) – 420 orders
// ---------------------------------------------------------------------------
function ecommerce(): Row[] {
  const r = rng(42);
  const rows: Row[] = [];
  const categories: [string, number][] = [["Electronics", 30], ["Home & Kitchen", 22], ["Fashion", 25], ["Beauty", 13], ["Sports", 10]];
  const regions: [string, number][] = [["North America", 42], ["Europe", 30], ["Asia Pacific", 20], ["Latin America", 8]];
  const channels: [string, number][] = [["Organic search", 30], ["Paid social", 24], ["Email", 18], ["Direct", 16], ["Referral", 12]];
  const payments: [string, number][] = [["Card", 62], ["PayPal", 20], ["UPI", 10], ["Bank transfer", 8]];
  const priceByCat: Record<string, [number, number]> = { Electronics: [120, 900], "Home & Kitchen": [25, 260], Fashion: [20, 180], Beauty: [12, 90], Sports: [30, 320] };
  const start = new Date("2025-01-01");
  for (let i = 0; i < 420; i++) {
    const day = Math.floor(i * (272 / 420) + r() * 3);
    const d = new Date(start.getTime() + day * 86400000);
    const category = weighted(r, categories);
    const [lo, hi] = priceByCat[category];
    const units = weighted(r, [[1, 55], [2, 25], [3, 12], [4, 5], [5, 3]]);
    const price = round(lo + r() * (hi - lo), 2);
    const discount = weighted(r, [[0, 55], [5, 15], [10, 15], [15, 10], [25, 5]]);
    // seasonal lift: month effect + weekend effect
    const month = d.getMonth();
    const lift = 1 + (month >= 6 ? 0.18 : month >= 3 ? 0.08 : 0) + (d.getDay() === 0 || d.getDay() === 6 ? 0.1 : 0);
    const revenue = round(units * price * (1 - discount / 100) * lift, 2);
    rows.push({
      "Order date": iso(d),
      Category: category,
      Region: weighted(r, regions),
      Channel: weighted(r, channels),
      Payment: weighted(r, payments),
      Units: units,
      "Discount %": discount,
      Revenue: revenue,
      Status: weighted(r, [["Delivered", 82], ["Shipped", 9], ["Returned", 5], ["Cancelled", 4]]),
      "Customer type": weighted(r, [["Returning", 58], ["New", 42]]),
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// 2. SaaS metrics – 18 months
// ---------------------------------------------------------------------------
function saas(): Row[] {
  const r = rng(7);
  const rows: Row[] = [];
  let mrr = 38000;
  let customers = 410;
  const start = new Date("2024-04-01");
  for (let i = 0; i < 18; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const newCustomers = Math.round(28 + i * 2.4 + r() * 14);
    const churned = Math.round(customers * (0.032 - i * 0.0006) + r() * 4);
    customers += newCustomers - churned;
    const arpa = 92 + i * 1.3 + r() * 6;
    mrr = round(customers * arpa);
    rows.push({
      Month: d.toLocaleString("en-US", { month: "short", year: "numeric" }),
      MRR: mrr,
      Customers: customers,
      "New customers": newCustomers,
      "Churned customers": churned,
      "Churn rate %": round((churned / (customers + churned)) * 100, 2),
      "Marketing spend": round(9000 + i * 620 + r() * 1500),
      "Support tickets": Math.round(customers * 0.19 + r() * 20),
      "NPS": Math.round(38 + i * 1.1 + r() * 8),
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// 3. Marketing campaigns – 48 campaigns
// ---------------------------------------------------------------------------
function marketing(): Row[] {
  const r = rng(99);
  const rows: Row[] = [];
  const platforms: [string, number][] = [["Google Ads", 30], ["Meta", 28], ["LinkedIn", 14], ["TikTok", 12], ["YouTube", 10], ["Newsletter", 6]];
  const objectives = ["Awareness", "Leads", "Sales", "Retargeting"];
  const names = ["Spring launch", "Summer sale", "Back to school", "Product hunt", "Webinar series", "Case study push", "Free trial", "Brand video", "Referral drive", "Holiday promo", "Feature spotlight", "Comparison ads"];
  for (let i = 0; i < 48; i++) {
    const platform = weighted(r, platforms);
    const objective = pick(r, objectives);
    const spend = round(800 + r() * 9200);
    const cpm = platform === "LinkedIn" ? 38 : platform === "TikTok" ? 9 : platform === "Newsletter" ? 2 : 14;
    const impressions = Math.round((spend / cpm) * 1000 * (0.8 + r() * 0.5));
    const ctr = (platform === "Google Ads" ? 3.2 : platform === "Newsletter" ? 4.5 : 1.1) * (0.7 + r() * 0.7);
    const clicks = Math.round((impressions * ctr) / 100);
    const cvr = (objective === "Sales" ? 2.4 : objective === "Leads" ? 4.8 : objective === "Retargeting" ? 5.5 : 0.9) * (0.7 + r() * 0.7);
    const conversions = Math.round((clicks * cvr) / 100);
    const revenue = objective === "Awareness" ? round(conversions * 40) : round(conversions * (60 + r() * 140));
    rows.push({
      Campaign: `${pick(r, names)} ${String.fromCharCode(65 + (i % 26))}`,
      Platform: platform,
      Objective: objective,
      Quarter: `Q${Math.floor(i / 12) + 1} 2025`,
      Spend: spend,
      Impressions: impressions,
      Clicks: clicks,
      "CTR %": round(ctr, 2),
      Conversions: conversions,
      "Cost per conversion": conversions ? round(spend / conversions, 2) : null,
      Revenue: revenue,
      ROAS: round(revenue / spend, 2),
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// 4. Support tickets – 260 tickets (text-heavy, good for count charts)
// ---------------------------------------------------------------------------
function support(): Row[] {
  const r = rng(2024);
  const rows: Row[] = [];
  const agents = ["Priya", "Daniel", "Aisha", "Marco", "Chen", "Sofia"];
  const categories: [string, number][] = [["Billing", 24], ["Login & access", 20], ["Bug report", 22], ["Feature request", 14], ["Onboarding", 12], ["Integrations", 8]];
  const channels: [string, number][] = [["Email", 40], ["Chat", 35], ["Phone", 10], ["In-app", 15]];
  const start = new Date("2025-07-01");
  // Daily volume varies: a mid-August incident spike, quieter weekends, gentle growth.
  let day = 0;
  let left = 0;
  const volumeFor = (dayIdx: number) => {
    const date = new Date(start.getTime() + dayIdx * 86400000);
    const dow = date.getDay();
    const weekend = dow === 0 || dow === 6 ? 0.45 : 1;
    const spike = dayIdx >= 44 && dayIdx <= 48 ? 2.4 : 1;
    const growth = 1 + dayIdx / 200;
    return Math.max(1, Math.round((2.2 + r() * 1.6) * weekend * spike * growth));
  };
  for (let i = 0; i < 260; i++) {
    while (left <= 0) {
      left = volumeFor(day);
      day += 1;
    }
    left -= 1;
    const d = new Date(start.getTime() + (day - 1) * 86400000);
    const priority = weighted(r, [["Low", 35], ["Medium", 40], ["High", 20], ["Urgent", 5]]);
    const base = priority === "Urgent" ? 2 : priority === "High" ? 6 : priority === "Medium" ? 14 : 30;
    const status = weighted(r, [["Resolved", 72], ["Open", 14], ["Pending customer", 9], ["Escalated", 5]]);
    rows.push({
      "Ticket ID": `T-${(10400 + i).toString()}`,
      Created: iso(d),
      Category: weighted(r, categories),
      Channel: weighted(r, channels),
      Priority: priority,
      Status: status,
      Agent: pick(r, agents),
      Plan: weighted(r, [["Free", 30], ["Starter", 35], ["Pro", 25], ["Enterprise", 10]]),
      "Resolution hours": status === "Resolved" ? round(base * (0.4 + r() * 1.6), 1) : null,
      "CSAT (1-5)": status === "Resolved" ? weighted(r, [[5, 45], [4, 30], [3, 14], [2, 7], [1, 4]]) : null,
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// 5. Website traffic – 120 days
// ---------------------------------------------------------------------------
function traffic(): Row[] {
  const r = rng(11);
  const rows: Row[] = [];
  const start = new Date("2025-06-01");
  for (let i = 0; i < 120; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    const trend = 1 + i * 0.006;
    const spike = i === 45 || i === 88 ? 2.4 : 1;
    const sessions = Math.round(3200 * trend * (weekend ? 0.7 : 1) * spike * (0.85 + r() * 0.3));
    const users = Math.round(sessions * (0.78 + r() * 0.08));
    const signups = Math.round(sessions * (0.021 + r() * 0.008) * (spike > 1 ? 1.4 : 1));
    rows.push({
      Date: iso(d),
      Sessions: sessions,
      Users: users,
      "Page views": Math.round(sessions * (2.4 + r() * 1.2)),
      "Bounce rate %": round(38 + r() * 14 - (spike > 1 ? 6 : 0), 1),
      "Avg. session (s)": Math.round(95 + r() * 80),
      Signups: signups,
      "Top source": weighted(r, [["Organic", 45], ["Direct", 20], ["Social", 18], ["Referral", 10], ["Paid", 7]]),
      Device: weighted(r, [["Mobile", 58], ["Desktop", 36], ["Tablet", 6]]),
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// 6. Expense breakdown – small, simple
// ---------------------------------------------------------------------------
const expenseRows: Row[] = [
  { Department: "Engineering", Category: "Headcount", Amount: 412000, "Share %": 41 },
  { Department: "Sales", Category: "Headcount", Amount: 188000, "Share %": 19 },
  { Department: "Marketing", Category: "Campaigns", Amount: 96000, "Share %": 10 },
  { Department: "Operations", Category: "Office", Amount: 88000, "Share %": 9 },
  { Department: "Engineering", Category: "Tools & cloud", Amount: 74000, "Share %": 7 },
  { Department: "People", Category: "Recruiting", Amount: 52000, "Share %": 5 },
  { Department: "Finance", Category: "Legal & accounting", Amount: 41000, "Share %": 4 },
  { Department: "Marketing", Category: "Events", Amount: 29000, "Share %": 3 },
  { Department: "Sales", Category: "Travel", Amount: 20000, "Share %": 2 },
];

export const SAMPLE_DATASETS: SampleDataset[] = [
  {
    id: "ecommerce-orders",
    name: "E-commerce orders 2025",
    description: "420 orders with date, category, region, channel, units, discount and revenue.",
    emoji: "🛒",
    tags: ["dates", "revenue", "categories"],
    columns: [
      { name: "Order date", type: "date" },
      { name: "Category", type: "string" },
      { name: "Region", type: "string" },
      { name: "Channel", type: "string" },
      { name: "Payment", type: "string" },
      { name: "Units", type: "number" },
      { name: "Discount %", type: "number" },
      { name: "Revenue", type: "number" },
      { name: "Status", type: "string" },
      { name: "Customer type", type: "string" },
    ],
    rows: ecommerce(),
  },
  {
    id: "saas-metrics",
    name: "SaaS metrics",
    description: "18 months of MRR, customers, churn, marketing spend and NPS.",
    emoji: "📈",
    tags: ["monthly", "growth"],
    columns: [
      { name: "Month", type: "date" },
      { name: "MRR", type: "number" },
      { name: "Customers", type: "number" },
      { name: "New customers", type: "number" },
      { name: "Churned customers", type: "number" },
      { name: "Churn rate %", type: "number" },
      { name: "Marketing spend", type: "number" },
      { name: "Support tickets", type: "number" },
      { name: "NPS", type: "number" },
    ],
    rows: saas(),
  },
  {
    id: "marketing-campaigns",
    name: "Marketing campaigns",
    description: "48 campaigns across platforms with spend, clicks, conversions and ROAS.",
    emoji: "📣",
    tags: ["ads", "ROAS"],
    columns: [
      { name: "Campaign", type: "string" },
      { name: "Platform", type: "string" },
      { name: "Objective", type: "string" },
      { name: "Quarter", type: "string" },
      { name: "Spend", type: "number" },
      { name: "Impressions", type: "number" },
      { name: "Clicks", type: "number" },
      { name: "CTR %", type: "number" },
      { name: "Conversions", type: "number" },
      { name: "Cost per conversion", type: "number" },
      { name: "Revenue", type: "number" },
      { name: "ROAS", type: "number" },
    ],
    rows: marketing(),
  },
  {
    id: "support-tickets",
    name: "Support tickets",
    description: "260 tickets: category, channel, priority, agent, resolution time and CSAT.",
    emoji: "🎧",
    tags: ["text-heavy", "counts"],
    columns: [
      { name: "Ticket ID", type: "string" },
      { name: "Created", type: "date" },
      { name: "Category", type: "string" },
      { name: "Channel", type: "string" },
      { name: "Priority", type: "string" },
      { name: "Status", type: "string" },
      { name: "Agent", type: "string" },
      { name: "Plan", type: "string" },
      { name: "Resolution hours", type: "number" },
      { name: "CSAT (1-5)", type: "number" },
    ],
    rows: support(),
  },
  {
    id: "website-traffic",
    name: "Website traffic",
    description: "120 days of sessions, users, page views, bounce rate and signups.",
    emoji: "🌐",
    tags: ["daily", "trend"],
    columns: [
      { name: "Date", type: "date" },
      { name: "Sessions", type: "number" },
      { name: "Users", type: "number" },
      { name: "Page views", type: "number" },
      { name: "Bounce rate %", type: "number" },
      { name: "Avg. session (s)", type: "number" },
      { name: "Signups", type: "number" },
      { name: "Top source", type: "string" },
      { name: "Device", type: "string" },
    ],
    rows: traffic(),
  },
  {
    id: "expenses",
    name: "Expense breakdown",
    description: "Annual spend by department and category — small and simple.",
    emoji: "💸",
    tags: ["simple"],
    columns: [
      { name: "Department", type: "string" },
      { name: "Category", type: "string" },
      { name: "Amount", type: "number" },
      { name: "Share %", type: "number" },
    ],
    rows: expenseRows,
  },
];

export function getSample(id: string): SampleDataset | undefined {
  return SAMPLE_DATASETS.find((s) => s.id === id);
}
