import { GraphNodeDef } from "@/lib/graph";

function techNode(id: string, label: string): GraphNodeDef {
  return { id, label, kind: "tech" };
}

function archNode(id: string, label: string, meta: string): GraphNodeDef {
  return { id, label, kind: "grand", meta: [meta] };
}

export const projects: GraphNodeDef[] = [
  {
    id: "traderai",
    label: "TRADEAI",
    kind: "child",
    description:
      "An AI-native trading operating system for Indian markets combining multi-model forecasting, retrieval-augmented reasoning, a multi-agent LangGraph decision layer, and a deterministic risk engine.",
    meta: ["AI TRADING OPERATING SYSTEM"],
    children: [
      {
        id: "traderai-arch",
        label: "ARCHITECTURE",
        kind: "child",
        children: [
          archNode("traderai-data", "DATA", "NSE / BSE · Upstox · Zerodha"),
          archNode("traderai-ml", "ML", "Forecasting · Signals"),
          archNode("traderai-rag", "RAG", "Qdrant · Retrieval"),
          archNode("traderai-agents", "AGENTS", "LangGraph decision layer"),
          archNode("traderai-risk", "RISK", "Deterministic risk engine"),
        ],
      },
      {
        id: "traderai-tech",
        label: "TECHNOLOGY",
        kind: "child",
        children: [
          techNode("traderai-t1", "FastAPI"),
          techNode("traderai-t2", "PostgreSQL"),
          techNode("traderai-t3", "Redis"),
          techNode("traderai-t4", "Qdrant"),
          techNode("traderai-t5", "LangGraph"),
          techNode("traderai-t6", "Next.js"),
          techNode("traderai-t7", "Celery"),
        ],
      },
      {
        id: "traderai-github",
        label: "GITHUB",
        kind: "action",
        action: {
          kind: "external",
          href: "https://github.com/MeetJain0170/TradeAI",
        },
      },
    ],
  },

  {
    id: "jaldrishti",
    label: "JALDRISHTI",
    kind: "child",
    description:
      "An underwater intelligence and marine detection system combining image enhancement, 17-class marine object detection, depth estimation, and water-quality analysis across 10K+ images.",
    meta: ["UNDERWATER COMPUTER VISION"],
    children: [
      {
        id: "jaldrishti-arch",
        label: "ARCHITECTURE",
        kind: "child",
        children: [
          archNode("jaldrishti-enhance", "ENHANCEMENT", "Low-light · Turbidity"),
          archNode("jaldrishti-detection", "DETECTION", "17-class marine taxonomy"),
          archNode("jaldrishti-depth", "DEPTH", "MiDaS estimation"),
          archNode("jaldrishti-water", "WATER", "Water-quality analysis"),
        ],
      },
      {
        id: "jaldrishti-tech",
        label: "TECHNOLOGY",
        kind: "child",
        children: [
          techNode("jaldrishti-t1", "PyTorch"),
          techNode("jaldrishti-t2", "YOLOv8"),
          techNode("jaldrishti-t3", "OpenCV"),
          techNode("jaldrishti-t4", "MiDaS"),
          techNode("jaldrishti-t5", "CUDA"),
          techNode("jaldrishti-t6", "Flask"),
        ],
      },
      {
        id: "jaldrishti-github",
        label: "GITHUB",
        kind: "action",
        action: {
          kind: "external",
          href: "https://github.com/MeetJain0170/Jal",
        },
      },
    ],
  },

  {
    id: "llm-lawyer",
    label: "LLM LAWYER",
    kind: "child",
    description:
      "A legal language model built from scratch for Indian legal text, using a 150M-parameter decoder-only transformer pretrained on a 2B-token corpus covering IPC, case law, and hearings.",
    meta: ["LLM / NLP / FROM SCRATCH"],
    children: [
      {
        id: "llm-lawyer-arch",
        label: "ARCHITECTURE",
        kind: "child",
        children: [
          archNode("llm-lawyer-data", "CORPUS", "2B tokens · Indian law"),
          archNode("llm-lawyer-tokenizer", "TOKENIZER", "Custom BPE"),
          archNode("llm-lawyer-model", "MODEL", "150M decoder-only Transformer"),
          archNode("llm-lawyer-training", "TRAINING", "FP16 · Gradient checkpointing"),
        ],
      },
      {
        id: "llm-lawyer-tech",
        label: "TECHNOLOGY",
        kind: "child",
        children: [
          techNode("llm-lawyer-t1", "PyTorch"),
          techNode("llm-lawyer-t2", "Transformers"),
          techNode("llm-lawyer-t3", "BPE Tokenizer"),
          techNode("llm-lawyer-t4", "CUDA"),
          techNode("llm-lawyer-t5", "FP16"),
          techNode("llm-lawyer-t6", "NumPy"),
          techNode("llm-lawyer-t7", "Pandas"),
        ],
      },
      {
        id: "llm-lawyer-github",
        label: "GITHUB",
        kind: "action",
        action: {
          kind: "external",
          href: "https://github.com/MeetJain0170/LLM_Lawyer",
        },
      },
    ],
  },

  {
    id: "wifi-congestion",
    label: "WIFI CONGESTION",
    kind: "child",
    description:
      "A real-time multi-floor WiFi congestion simulator with RF modeling, dynamic user mobility, multi-band coverage, and intelligent load balancing using greedy redistribution, MCMF optimization, and band steering.",
    meta: ["NETWORKING / OPTIMIZATION"],
    children: [
      {
        id: "wifi-congestion-arch",
        label: "ARCHITECTURE",
        kind: "child",
        children: [
          archNode("wifi-congestion-rf", "RF MODEL", "RSSI · Path loss · Interference"),
          archNode("wifi-congestion-mobility", "MOBILITY", "Dynamic user movement"),
          archNode("wifi-congestion-balance", "BALANCING", "Greedy · MCMF · Band steering"),
          archNode("wifi-congestion-viz", "VISUALIZATION", "Live AP loads · Handovers"),
        ],
      },
      {
        id: "wifi-congestion-tech",
        label: "TECHNOLOGY",
        kind: "child",
        children: [
          techNode("wifi-congestion-t1", "Java"),
          techNode("wifi-congestion-t2", "Spring Boot"),
          techNode("wifi-congestion-t3", "Maven"),
          techNode("wifi-congestion-t4", "D3.js"),
          techNode("wifi-congestion-t5", "Chart.js"),
          techNode("wifi-congestion-t6", "Vite"),
          techNode("wifi-congestion-t7", "Tailwind CSS"),
        ],
      },
      {
        id: "wifi-congestion-github",
        label: "GITHUB",
        kind: "action",
        action: {
          kind: "external",
          href: "https://github.com/MeetJain0170/Wifi_Congestion_Optimizer",
        },
      },
    ],
  },
];