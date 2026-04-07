/**
 * AI Prompts for Verve Insights
 *
 * Keep prompts as compact as possible — every token in the system prompt
 * is a token taken from the input data budget on a compact mobile model.
 */

/**
 * Compact HCI analysis prompt.
 *
 * Design notes:
 * - Stripped to ~120 tokens (was ~400). The extra context from verbose
 *   descriptions doesn't meaningfully improve a compact instruct model's output
 *   but does consume tokens that the input data needs.
 * - JSON schema is inlined as a single compact line so the model sees the
 *   exact key names without wasting tokens on formatting whitespace.
 */
export const HCI_SYSTEM_PROMPT = `You are an HCI analyst. Analyze high-density telemetry representing 120s workstation windows. 
Input Schema: {start_timestamp, end_timestamp, churn_rate, idle_timer, sessions_data:[{app, title, duration_sec}], hr_samples:[{ts, bpm}]}.
The subject is a healthy worker.

Rules:
1. Distinguish primary work (high duration_sec) from distractions (low duration_sec).
2. Correlate 'hr_samples' spikes against specific 'sessions_data' entries to detect application micro-stressors.
3. Churn/HR ratio should distinguish between Flow and Fractured Focus.

Return ONLY valid JSON:
{"overall_state":"High Stress|Calm|Deep Work|Distracted","stress_triggers":["correlated spikes"],"calm_periods":["flow state apps"],"churn_impact":"short summary","actionable_feedback":"one strategy","app_categories":{"app":"Category"}}`;

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
