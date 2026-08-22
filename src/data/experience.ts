import { GraphNodeDef } from "@/lib/graph";

function info(id: string, label: string, meta?: string): GraphNodeDef {
  return { id, label, kind: "grand", meta: meta ? [meta] : undefined };
}

/**
 * Restructured so each experience entry exposes a small set of concise
 * semantic branches (ROLE / PERIOD / ...) instead of one paragraph.
 * These are all terminal leaves — no invented achievements, just the
 * existing description/meta broken into scannable pieces.
 */
export const experience: GraphNodeDef[] = [
  {
    id: "exp-krish-plast",
    label: "FACTORY INTERN — KRISH PLAST",
    kind: "child",
    meta: ["MAY — JUN 2025", "MUMBAI"],
    description:
      "Supported manufacturing and production operations, analyzed workflows to identify inefficiencies, assisted in quality control and process optimization, and collaborated with teams to improve operational performance.",
    children: [
      info("exp-krish-role", "ROLE", "Factory Intern"),
      info("exp-krish-period", "PERIOD", "May – Jun 2025"),
      info("exp-krish-location", "LOCATION", "Mumbai"),
      info("exp-krish-work", "WORK", "Workflow analysis · Quality control"),
      info("exp-krish-impact", "IMPACT", "Operational process optimization"),
    ],
  },
  {
    id: "exp-parshwa-plast",
    label: "DATA ANALYST INTERN — PARSHWA PLAST",
    kind: "child",
    meta: ["MAY — JUN 2024"],
    description:
      "Built a regression-based market expansion model on 100K+ sales records across 10 Indian states, identifying underserved product-color segments driving 11% higher conversion and informing Q3 distribution planning. Analyzed regional sales trends to identify color-driven consumer behavior patterns and improve targeted product placement.",
    children: [
      info("exp-parshwa-role", "ROLE", "Data Analyst Intern"),
      info("exp-parshwa-period", "PERIOD", "May – Jun 2024"),
      info("exp-parshwa-data", "DATA", "100K+ records · 10 states"),
      info("exp-parshwa-model", "MODEL", "Regression-based expansion model"),
      info("exp-parshwa-impact", "IMPACT", "11% higher conversion"),
      info("exp-parshwa-planning", "PLANNING", "Q3 distribution planning"),
      info("exp-parshwa-trends", "TRENDS", "Regional sales · Color patterns"),
    ],
  },
];