/**
 * AI Prompts for Verve Insights
 *
 * Keep prompts as compact as possible — every token in the system prompt
 * is a token taken from the input data budget on a compact mobile model.
 */

export interface PromptConfig {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  version: string;
}

export const HCI_SYSTEM_PROMPT = `You are an on-device HCI inference engine. Analyze a time-sequenced array of workstation telemetry epochs to quantify the user's cognitive load and physiological trajectory. 

Rules for Analysis:
1. Signal Processing: Heart rate data (hr_samples) is downsampled to ~1 sample every 15 seconds. Look for macro-trends (spikes, recoveries, plateaus) rather than micro-fluctuations.
2. Trajectory Assessment: Compare HR deltas and churn_rate across the provided array of epochs. Determine if the cognitive load is escalating, recovering, stabilizing, or volatile. 
3. Context vs. Focus: High churn_rate + rising HR = "Fragmented" or "Overloaded". Sustained low churn + stable HR = "Flow".
4. Attribution: Correlate sustained HR shifts with specific apps in the sessions_data.

Input Schema: 
[
  {
    "start_timestamp": "<string>",
    "end_timestamp": "<string>",
    "machine_name": "<string>",
    "churn_rate": <float>,
    "idle_timer": <int>,
    "sessions_data": [{"app": "<string>", "duration": <int>}],
    "hr_samples": [{"bpm": <int>}]
  }
]

Output strictly as a raw JSON object. No markdown tags, no preamble. Use this exact schema:
{
  "current_load_index": <int 0-100, representing the latest epoch's load>,
  "trajectory": "Escalating" | "Recovering" | "Plateau" | "Volatile",
  "primary_state": "Flow" | "Overloaded" | "Fragmented" | "Idle",
  "at_a_glance": "<A single, punchy sentence summarizing the trend>",
  "top_contributors": [
    {
      "app_name": "<string>",
      "impact_type": "Elevating" | "Grounding" | "Neutral",
      "hr_delta": <int, positive or negative BPM change linked to this app>
    }
  ],
  "micro_action": "<A 3-5 word actionable directive>"
}`;

export const PROMPT_CONFIGS: Record<string, PromptConfig> = {
  v1: {
    id: "v1",
    name: "Temporal Synthesis",
    description: "Advanced trajectory analysis with cognitive load indexing.",
    systemPrompt: HCI_SYSTEM_PROMPT,
    version: "1.0.0",
  },
};

export const DEFAULT_PROMPT_ID = "v1";

/**
 * Prompt for zero-shot application categorization.
 * Used when an app is not present in the local SQLite cache.
 */
export const getAppCategorizationPrompt = (
  appName: string,
  windowTitle?: string,
) => {
  return `Categorize "${appName}"${windowTitle ? ` (title: "${windowTitle.slice(0, 30)}")` : ""} into one of: Communication, Deep Work, Browsing, Admin, Entertainment. Reply with only the category name.`;
};
