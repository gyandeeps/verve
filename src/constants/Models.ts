export type AIModel = {
  id: string;
  name: string;
  filename: string;
  sizeBytes: number;
  url: string;
  description: string;
};

export const AVAILABLE_MODELS: AIModel[] = [
  {
    id: "phi-4-mini-q4km",
    name: "Phi-4 Mini (Q4_K_M)",
    filename: "Phi-4-mini-instruct.Q4_K_M.gguf",
    sizeBytes: 2491874624,
    url: "https://huggingface.co/MaziyarPanahi/Phi-4-mini-instruct-GGUF/resolve/main/Phi-4-mini-instruct.Q4_K_M.gguf",
    description: "Balanced performance and quality (4-bit quantization).",
  },
  {
    id: "phi-4-mini-q3ks",
    name: "Phi-4 Mini (Q3_K_S)",
    filename: "Phi-4-mini-instruct.Q3_K_S.gguf",
    sizeBytes: 1897332032,
    url: "https://huggingface.co/MaziyarPanahi/Phi-4-mini-instruct-GGUF/resolve/main/Phi-4-mini-instruct.Q3_K_S.gguf",
    description:
      "Lower memory footprint (< 2GB) with decent quality (3-bit quantization).",
  },
  {
    id: "phi-4-mini-q2k",
    name: "Phi-4 Mini (Q2_K)",
    filename: "Phi-4-mini-instruct.Q2_K.gguf",
    sizeBytes: 1682636096,
    url: "https://huggingface.co/MaziyarPanahi/Phi-4-mini-instruct-GGUF/resolve/main/Phi-4-mini-instruct.Q2_K.gguf",
    description:
      "Fastest and smallest model, but with some quality trade-offs (2-bit quantization).",
  },
];

export const DEFAULT_MODEL_ID = "phi-4-mini-q3ks";
