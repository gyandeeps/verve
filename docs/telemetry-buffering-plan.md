# Telemetry Buffering Plan

## Overview

To optimize data synchronization and reduce excessive payloads, the telemetry data pipeline is being upgraded from a raw "20-second snapshot" mechanism to a "Block-Session" architecture. This plan changes the strategy from sending granular single-event rows to sending intelligent, aggregated timelines.

## Core Architecture Modifications

### 1. The Shadow CLI (Go)

The CLI polling engine will transition from a slow sleeper (`time.Sleep(20s)`) to an active compression engine.

- **High-Frequency Polling (10 seconds):** The CLI checks the active application every 10 seconds.
- **Run-Length Encoding Compression:** If the active app and window title exactly match the previous poll, the CLI increments the duration of the current "Session Block" instead of creating a new one.
- **Reporting Window (60 seconds):** Every 60 seconds (or 6 polls), the CLI finalizes the active blocks into a single JSON array and records exactly one row to the database.

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
  ],
  "hr_samples": [
    { "ts": 1712401005, "bpm": 62 },
    { "ts": 1712401015, "bpm": 64 },
    { "ts": 1712401025, "bpm": 68 },
    { "ts": 1712401045, "bpm": 72 },
    { "ts": 1712401058, "bpm": 69 }
  ]
}
```

- **Biometric Multi-Sampling:** Instead of linking to a single "closest sample," each telemetry entry now captures the full array of physiological signals within the 60s window. This high-density data enables the **Intra-Card HR Sparkline** and provides Phi-4 with actual trend data rather than a snapshot.
- **Churn Rate fix:** Calculated locally exactly over the 60s period (e.g., 2 context switches in 60s = 2.0). This replaces the legacy elapsed "uptime" metric.
- **Duration tracking:** Yields absolute time spent in an application during the minute, avoiding assumptions about gaps.

### 3. Split Database Schema (CLI & Mobile Hub)

To support the transition to the sessions model, we will **delete all existing incremental migrations** and rewrite `1-initial-schema` for both codebases. This ensures a clean, unified starting point while maintaining specialized tables for each node.

- **Destructive Init (`1-initial-schema`):** The very first statement in the migration will be `DROP TABLE IF EXISTS telemetry; DROP TABLE IF EXISTS biometrics;` to forcefully wipe the legacy incompatible schemas.
- **100% Session-Embedded Architecture**: We have **removed the flat `biometrics` table**. All physiological data is now persisted exclusively within the `hr_samples` JSONB blob inside the `telemetry` table.

#### A. Shadow CLI Schema (Go / macOS)

The CLI focuses on the **Outbox Pattern**, ensuring no data is lost during network partitions.

```sql
CREATE TABLE telemetry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,          -- Unix Epoch (ms)
    machine_name TEXT NOT NULL,          -- Hostname
    churn_rate REAL NOT NULL,            -- Context switches in 60s
    idle_timer INTEGER NOT NULL,         -- Max idle time in 60s
    sessions_data JSONB NOT NULL,        -- Optimized Binary JSON: [{app, title, duration_sec}]
    status TEXT DEFAULT 'PENDING'        -- 'PENDING', 'SYNCED' (Outbox State)
);
```

#### B. Mobile Hub Schema (React Native / Expo)

The phone hydrates the incoming telemetry with biometrics and runs AI inference.

```sql
CREATE TABLE telemetry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,          -- Unix Epoch (ms)
    machine_name TEXT NOT NULL,          -- Origin workstation
    churn_rate REAL NOT NULL,            -- Context switches in 60s
    idle_timer INTEGER NOT NULL,         -- Max idle time in 60s
    sessions_data JSONB NOT NULL,        -- Optimized Binary JSON: [{app, title, duration_sec}]
    ai_state TEXT,                       -- AI-classified state (e.g., "Deep Work")
    ai_summary TEXT,                     -- LLM-generated semantic summary
    UNIQUE(timestamp, machine_name)      -- Prevent duplicate syncs across workstations
);

CREATE TABLE hr_samples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telemetry_id INTEGER NOT NULL,       -- Foreign key to telemetry.id
    ts INTEGER NOT NULL,                 -- Unix Epoch (ms) of the sample
    bpm REAL NOT NULL,                   -- Heart Rate (BPM)
    FOREIGN KEY(telemetry_id) REFERENCES telemetry(id) ON DELETE CASCADE
);
```

#### Common & Supporting Tables (Mobile Hub Only)

```sql
-- For device pairing and sync watermark tracking
CREATE TABLE metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

- **Relational Biometric Storage**: We have moved away from embedding high-density heart rate data directly in the `telemetry` table. Instead, a dedicated `hr_samples` table handles physiological data, linked via `telemetry_id`. This allows for more performant time-series analysis and easier indexing of heart rate trends independent of workstation sessions.
- **Sync Hydration Strategy**: The ingestion process is now purely **Telemetry-Triggered**. Upon receiving a 60s block from the CLI, the Mobile Hub initiates a HealthKit/Health Connect query for that specific timestamp range and writes the resulting BPM samples into the `hr_samples` table while associating them with the newly created telemetry record.
- **30-Day Rolling Cleanup (All Nodes)**: To manage the disk footprint across the distributed system, **data pruning occurs during DB initialization and on a daily schedule**. Both the Mobile Hub (via `InitDB`) and the Go CLI (via a scheduled job) execute a `DELETE` command to remove successfully synced telemetry records older than 30 days. Cascading deletes ensure `hr_samples` are also pruned.
- **Hybrid Optimization**: While workstation sessions remain in SQLite's binary JSONB format for flexibility, biometric samples are stored in a flat relational structure to support high-frequency querying and visualization without parsing heavy JSON blobs.
- **Outbox Logic**: The CLI uses the `status` column to track its internal delivery state. Successfully acknowledged payloads are updated to `SYNCED` in the CLI's local database.
- **Model Refactoring**: TypeScript types and Go structs reflect this lean, session-centric model, ensuring a lightweight disk footprint for 24/7 workstation monitoring.

### 4. Sessions Tab (app/(tabs)/sessions.tsx)

To streamline the interface, the separate "Workstation" and "Biometric" views are consolidated into a single **"Sessions"** tab. This unified timeline correlates workstation activity with physiological stress signals in real-time.

- **Main Timeline Cards (High-Level):**
  - **HR Face-Up:** Each 60s session card displays the average **Heart Rate (BPM)** prominently, allowing users to see physiological spikes alongside app usage at a glance.
  - **Intra-Card HR Sparkline:** A subtle, integrated sparkline shows the BPM trend _specifically within that 60s block_, visualizing focus vs. stress instantly on the main timeline.
  - **Primary Context:** The UI calculates the application with the highest `duration_sec` in the `sessions_data` array and displays it as the "Dominant App" for that minute.
  - **Aggregated Stats:** The card also surfaces the Churn Rate (context switches), Max Idle time, and total session duration.
  - **Focus Friction Badging:** Cards are badged (e.g., "High Friction") if a high Churn Rate correlates with poor Heart Rate Recovery (RES), identifying moments where multitasking was physiologically "expensive."

- **Deep-Dive Detail Modal:**
  - Tapping a session card triggers a high-fidelity **Modal** overlay.
  - **Chronological Breakdown:** Displays every individual block in `sessions_data` sequentially with precise window titles and durations.
  - **Enhanced Biometrics:** Includes a detailed view of heart rate samples mapped to the timeline of app switches within that minute.
  - **Behavioral Brief:** Displays the local AI’s interpreted state (e.g., "Deep Flow" or "High-Friction Debugging") for that specific session block.

### 5. AI Prompt Engineering (`AIService.ts`)

The Local LLM interface (`Phi-4-mini`) receives a much denser context window. Because we are shipping fewer total records (1 per minute instead of 3), the prompt must explicitly understand the internal array structure.

- **Payload Packaging:** `buildAIPayload` will stringify the `sessions_data` seamlessly.
- **Draft Prompt Enhancements (`HCI_SYSTEM_PROMPT`):**
  We will adjust the system prompt instructions to handle nested time allocations:

  ```text
  Input Data Schema:
  You will receive chronological telemetry events formatted as:
  {
    timestamp,
    churn_rate,
    idle_timer,
    sessions_data: [{app, title, duration_sec}],
    hr_samples: [{ts, bpm}]
  }

  Analysis Rules:
  1. Evaluate 'duration_sec' within 'sessions_data' to distinguish between primary work areas (high duration) and brief distractions (low duration).
  2. Analyze the 'hr_samples' collection for physiological trends within each 60s block.
  3. Correlate 'hr_samples' heart rate spikes directly against specific 'sessions_data' entries to detect application-specific micro-stressors.
  4. Use the ratio of 'churn_rate' to the stability of 'hr_samples' to distinguish between Flow State and Fractured Focus.
  ```

  This guarantees the LLM doesn't merely count the array length but understands the actual weight of the user's allocated time and the physiological cost of context switching.

## Phased Execution Roadmap

**Phase 1:** Go CLI Engine Rewrite (Tracker state machine, SQLite compression).
**Phase 2:** TS Migration (Drop/rebuild Mobile schema, rewrite DatabaseService queries).
**Phase 3:** Wiring UI/AI Services (Update payload serialization, rewrite the AI prompt to handle the new data volumes, and implement the **Sessions** tab with detail modals).

## Future Enhancement: The Decompression Dashboard

Following the rollout of the high-density session architecture, the project will implement a daily **"Decompression Report"**:

- **Semantic Summarization:** Use Phi-4-mini to generate a single-sentence "Daily Focus Theme" based on the accumulated sessions.
- **Automatic Trigger:** Detects the "End of Workday" (via CLI sleep event or 10+ minutes of idle duration) to surface the report.
- **Physiological Recovery:** Analyzes the total "Cardiac/Work correlation" to identify the day's most high-arousal tasks and provides actionable recovery advice (e.g., "Your baseline HR remained elevated during Jira sessions; plan a 10m walk before family engagement").
- **Visual Climax:** A high-fidelity summary screen utilizing the full depth of the "Clinical Console" design system to close the cognitive loop for the day.
