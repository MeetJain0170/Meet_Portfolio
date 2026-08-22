import { GraphNodeDef } from "@/lib/graph";

function tech(
  id: string,
  label: string,
  meta?: string
): GraphNodeDef {
  return {
    id,
    label,
    kind: "tech",
    meta: meta ? [meta] : undefined,
  };
}

export const skills: GraphNodeDef[] = [
  // ─────────────────────────────────────────────────────────────
  // AI / LLM
  // ─────────────────────────────────────────────────────────────
  {
    id: "skills-ai",
    label: "AI / LLM",
    kind: "child",
    children: [
      tech("s-python", "Python", "Primary AI / ML language"),
      tech("s-pytorch", "PyTorch", "Deep learning"),
      tech("s-llm", "LLMs", "Transformer-based systems"),
      tech("s-transformers", "Transformers", "Model training · Fine-tuning"),
      tech("s-rag", "RAG", "Retrieval-augmented generation"),
      tech("s-langgraph", "LangGraph", "Agent orchestration"),
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // MACHINE LEARNING
  // ─────────────────────────────────────────────────────────────
  {
    id: "skills-ml",
    label: "Machine Learning",
    kind: "child",
    children: [
      tech("s-xgb", "XGBoost", "Gradient boosting"),
      tech("s-sklearn", "Scikit-learn", "Classical ML"),
      tech(
        "s-computer-vision",
        "Computer Vision",
        "Detection · Image analysis"
      ),
      tech(
        "s-features",
        "Feature Engineering",
        "Signal construction"
      ),
      tech(
        "s-timeseries",
        "Time Series",
        "Forecasting · Market signals"
      ),
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // DATA
  // ─────────────────────────────────────────────────────────────
  {
    id: "skills-data",
    label: "DATA",
    kind: "child",
    children: [
      tech("s-sql", "SQL", "Relational data"),
      tech("s-postgres", "PostgreSQL", "Production database"),
      tech("s-pandas", "Pandas", "Data analysis"),
      tech("s-numpy", "NumPy", "Numerical computing"),
      tech("s-qdrant", "Qdrant", "Vector retrieval"),
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // SYSTEMS
  // ─────────────────────────────────────────────────────────────
  {
    id: "skills-systems",
    label: "SYSTEMS",
    kind: "child",
    children: [
      tech("s-fastapi", "FastAPI", "Python APIs"),
      tech("s-nextjs", "Next.js", "React framework"),
      tech("s-typescript", "TypeScript", "Typed application systems"),
      tech("s-docker", "Docker", "Containerization"),
      tech("s-cuda", "CUDA", "GPU acceleration"),
    ],
  },
];