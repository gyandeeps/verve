/**
 * AI Prompts for Verve Insights
 *
 * Keep prompts as compact as possible — every token in the system prompt
 * is a token taken from the input data budget on a 3B mobile model.
 */

/**
 * Compact HCI analysis prompt.
 *
 * Design notes:
 * - Stripped to ~120 tokens (was ~400). The extra context from verbose
 *   descriptions doesn't meaningfully improve a 3B instruct model's output
 *   but does consume tokens that the input data needs.
 * - JSON schema is inlined as a single compact line so the model sees the
 *   exact key names without wasting tokens on formatting whitespace.
 * - "healthy worker" and "no medical diagnosis" framing is preserved — this
 *   is the critical HCI safety instruction.
 */
export const HCI_SYSTEM_PROMPT = `You are an HCI and occupational health analyst. Analyze workstation telemetry (app usage, churn_rate, idle_time_sec) correlated with hr_points (heart rate BPM). The subject is a healthy worker — interpret HR changes as cognitive load or workplace stress, NOT medical conditions.

Return ONLY a valid JSON object with exactly these keys:
{"overall_state":"High Stress|Calm|Deep Work|Distracted","stress_triggers":["apps/titles with HR spikes"],"calm_periods":["apps with low HR + high idle"],"churn_impact":"one sentence","actionable_feedback":"one recommendation","app_categories":{"app_name":"Communication|Deep Work|Browsing|Admin|Entertainment"}}`;

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
