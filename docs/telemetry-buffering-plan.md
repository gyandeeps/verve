# Telemetry Buffering Plan

## Overview

To optimize data synchronization and reduce excessive payloads, the telemetry data pipeline is being upgraded from a raw "20-second snapshot" mechanism to a "Block-Session" architecture. This plan changes the strategy from sending granular single-event rows to sending intelligent, aggregated timelines.

## Core Architecture Modifications

### 1. The Shadow CLI (Go)

The CLI polling engine will transition from a slow sleeper (`time.Sleep(20s)`) to an active compression engine.

- **High-Frequency Polling (2 seconds):** The CLI checks the active application every 2 seconds.
- **Run-Length Encoding Compression:** If the active app and window title exactly match the previous poll, the CLI increments the duration of the current "Session Block" instead of creating a new one.
- **Reporting Window (60 seconds):** Every 60 seconds (or 30 polls), the CLI finalizes the active blocks into a single JSON array and records exactly one row to the database.

### 2. The Revised Telemetry Payload (JSON)

The single-string columns (`active_app`, `window_title`) are completely removed in favor of a cohesive session timeline. A single 60s telemetry data entry will look like:

```json
{
  "timestamp": 1712401000,
  "machine_name": "Developer-Workstation",
  "churn_rate": 2.0,
  "idle_timer": 0,
  "sessions_data": [
    { "app": "VS Code", "title": "main.go - Verve-CLI", "duration_sec": 42 },
    {
      "app": "Google Chrome",
      "title": "React Native Docs",
      "duration_sec": 12
    },
    { "app": "VS Code", "title": "main.go - Verve-CLI", "duration_sec": 6 }
  ]
}
```

- **Churn Rate fix:** Calculated locally exactly over the 60s period (e.g., 3 context switches in 60s = 3.0). This replaces the legacy elapsed "uptime" metric.
- **Duration tracking:** Yields absolute time spent in an application during the minute, avoiding assumptions about gaps.

### 3. Database Schema Changes (Go CLI & React Native)

Because this is an intentional breaking change to optimize data structure over backward compatibility, we will **delete all existing incremental migrations** and rewrite `1-initial-schema` for both codebases.

- **Destructive Init (`1-initial-schema`):** The very first statement in the migration will be `DROP TABLE IF EXISTS telemetry; DROP TABLE IF EXISTS biometrics;` (and other tables) to forcefully wipe out the incompatible old schema on any user devices.
- **Schema Rebuild:** The new `telemetry` table will be recreated to rely on `sessions_data` (JSON TEXT) instead of the scalar variables.
- TypeScript models (`DatabaseService.ts`) and Go struct models (`Telemetry`) will be rewritten to parse and utilize the new Session Blocks natively.

### 4. Workstation Logs UI (`app/(tabs)/workstation.tsx`)

Because a single entry now contains an array of usages rather than a flat `active_app`, the UI will transition to a hierarchical drill-down approach.

- **Top-Level FlatList Card:**
  - **Dominant App Logic:** When parsing the incoming `sessions_data`, the UI will calculate the app with the highest `duration_sec` and display it as the "Primary Context" (e.g., `primary_app = argmax(duration)`).
  - The top level will also display aggregated stats: Total Churn per minute, Max Idle time, and a dynamic badge indicating "X distinct apps used".
- **Deep-Dive Modal Component:**
  - Tapping the card will open a React Native Modal over `workstation.tsx`.
  - The modal contains a vertically scrolling timeline.
  - Each block in `sessions_data` is rendered sequentially.
  - Visually, UI elements will use a left-border timeline connector to indicate sequence.
  - _Data displayed per item:_ Full application path/name, complete window title, and the precise `duration_sec` formatted cleanly (e.g., "14s").

### 5. AI Prompt Engineering (`AIService.ts`)

The Local LLM interface (`Phi-4-mini`) receives a much denser context window. Because we are shipping fewer total records (1 per minute instead of 3), the prompt must explicitly understand the internal array structure.

- **Payload Packaging:** `buildAIPayload` will stringify the `sessions_data` seamlessly.
- **Draft Prompt Enhancements (`HCI_SYSTEM_PROMPT`):**
  We will adjust the system prompt instructions to handle nested time allocations:

  ```text
  Input Data Schema:
  You will receive chronological telemetry events formatted as:
  { timestamp, churn_rate, idle_time_sec, hr_points, sessions_data: [{app, title, duration_sec}] }

  Analysis Rules:
  1. Evaluate 'duration_sec' within 'sessions_data' to distinguish between primary work areas (high duration) and brief distractions (low duration).
  2. Correlate 'hr_points' directly against periods of high context switching ('churn_rate' > 3.0) or brief jumps into unrelated apps.
  ```

  This guarantees the LLM doesn't merely count the array length but understands the actual weight of the user's allocated time.

## Phased Execution Roadmap

**Phase 1:** Go CLI Engine Rewrite (Tracker state machine, SQLite compression).
**Phase 2:** TS Migration (Drop/rebuild Mobile schema, rewrite DatabaseService queries).
**Phase 3:** Wiring UI/AI Services (Update payload serialization, rewrite the AI prompt to handle the new data volumes, and implement the Workstation screen modal).
