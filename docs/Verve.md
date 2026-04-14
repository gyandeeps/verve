# Verve: Nervous Energy & Vitality

**Verve** is often used to describe vitality and spirit, but in a biological context, it relates to the **nervous energy** that triggers the heart. As a project focused on quantifying cognitive load through heart rate and physiological signals, the name perfectly encapsulates the intersection of biological vitality and digital performance.

# Project Report: Verve (Phase 1)

## To quantify "Cognitive Load" by correlating OS-level development activity with real-time physiological stress signals, processed entirely on-device.

## Executive Summary

Verve is a distributed, local-first health application. It consists of a **Mobile Hub** (Expo/React Native) that acts as the primary data aggregator and AI inference engine, and a **Shadow CLI** (Go 1.26+) that monitors workstation activity. Phase 1 focuses on establishing a persistent, local-network connection between these two nodes to sync **heart rate (HR/BPM)** with "Active Context" data.

## Foundational Research

The architecture of Verve is grounded in Human-Computer Interaction (HCI) and affective computing research:

- **"Designing Opportune Stress Intervention Delivery Timing using Multi-modal Data" (Microsoft Research):** Demonstrates that combining application usage, context switching, and heart rate features achieves ~80% accuracy in predicting stress and optimal intervention times.
- **"Stress Detection in Computer Users From Keyboard and Mouse Dynamics":** Highlights that interaction dynamics (mouse speed, churn rate) combined with Heart Rate Variability (HRV) or HR are high-accuracy predictors of perceived stress.
- **"Stress and multitasking in everyday college life: An empirical study of online activity" (UC Irvine):** Establishes a significant positive correlation between high "churn rates" (rapid window switching) and physiological stress signals.

## System Architecture & Components

### The Mobile Hub (Expo / React Native)

The phone serves as the "Brain." In 2026, we utilize **Expo’s Continuous Native Generation (CNG)** to bake in high-performance native modules while maintaining a TypeScript-first developer experience.

- **Networking:** `react-native-tcp-socket` (acts as a client that initiates connections to the Shadow CLI) and `react-native-zeroconf` for mDNS discovery.
- **Storage:** **Expo SQLite** for high-performance local-first data persistence.
- **Health Layer:** Direct integration with **Apple HealthKit** (iOS) and **Health Connect** (Android) using background observer queries.
- **AI Orchestration:** **AIFacade** implements a hybrid inference layer that prioritizes **Phi-4-mini-instruct** as the universal reasoning standard (via **llama.rn**), while leveraging high-performance on-device system AI (e.g., Gemini Nano via **expo-ai-core**) where available for instant state analysis.
- **Analytics:** **StatsService** provides high-performance clinical data aggregation using SQLite `json_each` functions for multi-dimensional behavioral analysis.
- **Sharing:** **Social Sharing Briefs** enable users to export their cognitive and physiological state as high-fidelity artifacts. Built using **@shopify/react-native-skia** for off-screen rendering of "Clinical Console" aesthetics and **expo-sharing** for native distribution.

### The Shadow CLI (Go / macOS)

A low-footprint background process written in Go.

- **Observability:** Uses **CGO** to hook into the CoreGraphics (macOS) or Win32 (Windows) APIs to monitor the frontmost application. To bypass macOS WindowServer caching and ensure fresh window metadata, the tracker executes itself as a short-lived subprocess (`--telemetry-helper`) during each poll. Implements **Graceful Shutdown** to ensure all pending telemetry is flushed and resources are released upon termination signals.
- **Network Server:** Advertises a dynamic service name (e.g., `Verve-Workstation-Hostname._verve._tcp`) via mDNS and listens for incoming TCP connections on port 8088. Utilizes **Physical Interface Filtering** to ensure discovery works in complex environments (e.g., VPNs, Netskope) by excluding virtual tunnels. Implements a **Secure Handshake Protocol** requiring a 6-digit PIN for device pairing and session token persistence.
- **Storage:** Local SQLite DB with an Outbox Pattern. Includes `auth_sessions` and `paired_devices` tables to manage persistent mobile connections. Telemetry data includes `machine_name` to differentiate between multiple workstations.
- **Sampling Rate:** 10-second polling intervals for high-granularity activity tracking.
- **Reporting Window:** Aggregates activity into 120-second "Session Blocks" using Run-Length Encoding (RLE) to compress context switches before transmission.

The Outbox Pattern maintains data tracking using a dedicated Outbox Table, an atomic transaction, and a separate Message Dispatcher process. This system ensures data is safely persisted and sent in the correct order:

- **Atomic Persistence (What to Send):** When the CLI records new data, it performs two writes in a single, atomic database transaction: saving the data to the main table and inserting a corresponding record into the Outbox Table, marked as "Undelivered". This guarantees that if the data is recorded, an outbox entry is also created.
- **Sequential Ordering (What to Send Now):** The Outbox Table is an append-only log that maintains the exact order of data recording. A separate Message Dispatcher polls the table for the oldest records still marked as "Undelivered".
- **Status Update (What Has Been Sent):** Once the Message Dispatcher receives a successful delivery confirmation from the Mobile Hub, it updates the record's state in the Outbox Table from "Undelivered" to "Delivered". This status change tracks what has been sent, ensuring at-least-once delivery.

### The Local Bridge

- **Discovery:** mDNS (Bonjour) protocol for service advertisement and resolution.
- **Transport:** Secure TCP over Wi-Fi.
- **Security:** **PIN-Based Handshake**. Devices must exchange a 6-digit PIN visible on the CLI console. Upon successful pairing, a cryptographically secure `session_token` is generated and persisted on both nodes to enable automatic re-authentication without further user intervention.

We utilize a high-density, session-embedded JSON schema. Each record represents a 120-second activity window.

| Field           | Type   | Description                                                                 |
| :-------------- | :----- | :-------------------------------------------------------------------------- |
| start_timestamp | int64  | Epoch MS (MS) representing the START of the 120s reporting window.          |
| end_timestamp   | int64  | Epoch MS (MS) representing the END of the 120s reporting window.            |
| machine_name    | string | Human-readable name of the host workstation.                                |
| churn_rate      | float  | Context switches per minute (a proxy for "Mental Churn").                   |
| idle_timer      | int    | Maximum idle delta (ms) observed during the 120s window.                    |
| sessions_data   | array  | Collection of `[{app, title, duration_sec}]` blocks in chronological order. |
| samples         | array  | (Mobile Only) Relational collection of `[{ts, bpm}]` physiological samples. |

## Biometric Strategy

The app monitors **Heart Rate (HR)** in **BPM (beats per minute)** using Apple HealthKit and Google Health Connect.

- **Correlation Logic:** If churn_rate increases while resting HR rises over a 5-minute rolling window, the system flags a **"High Stress/Low Output"** state. HR has an inverse relationship to focus: lower resting HR = calmer, more focused state.
- **Focus Score Mapping:** `score = clamp(100 - (avgHR - 55) × 2, 0, 100)`. A resting HR of 55 BPM maps to a Focus Score of ~90; 80 BPM maps to ~40.
- **Backgrounding:** On iOS, Background Delivery is used for Heart Rate to ensure continuous sampling. Data transfer from the CLI remains user-initiated (on-demand refresh).

### Wearable Data Density Comparison

To understand the resolution of "Live" data, researchers and developers should note the varying sampling rates across major consumer wearables:

| Wearable Brand     | Background (Resting)          | Active (Workout Mode) | Raw Sensor Rate (Internal) |
| :----------------- | :---------------------------- | :-------------------- | :------------------------- |
| **Apple Watch**    | Every 5–10 minutes (variable) | 1 second              | ~100Hz+ (PPG)              |
| **Fitbit**         | Every 5 seconds               | 1 second              | Hundreds of times/sec      |
| **Garmin**         | Continuous (1–2 seconds)      | 1 second              | ~25Hz - 100Hz              |
| **Whoop**          | 1 second (24/7)               | 1 second              | 52Hz - 100Hz               |
| **Samsung Galaxy** | Every 10 mins (default)       | 1 second              | ~100Hz                     |

## Core Behavioral Insights

The system aims to surface nuanced behavioral profiles beyond binary "stressed/calm" states:

- **The Context-Switching Penalty:** Correlation of "churn rate" (window switching frequency) with HR spikes to quantify the cost of multitasking.
- **App-Specific Micro-Stressors:** Identifying which specific `app_name` or `window_title` (e.g., "Jira", "Performance Review") consistently precedes physiological arousal.
- **Flow States (Deep Work):** Characterized by low churn rates, zero idle time, and stable, consistent heart rate (e.g., during VS Code or Figma sessions).
- **Recovery Efficiency:** Measuring how quickly HR returns to baseline during increased `idle_time` (a key indicator of cardiovascular fitness and regulation).
- **Anticipatory Stress:** Detecting HR spikes occurring immediately before an app switch (e.g., reacting to a notification sound before opening an email client).

## App Categorization & Taxonomy

To reduce noise, applications are grouped into a standard taxonomy for workplace analysis:

1.  **Communication & Collaboration:** Slack, Teams, Zoom, Outlook, Discord (High-churn/Micro-stress indicators).
2.  **Deep Work & Creation:** VS Code, Figma, Premiere Pro, Word (Flow state indicators).
3.  **Browsing & Research:** Chrome, Firefox (Context-dependent).
4.  **Administrative & System:** Finder, Settings, Task Manager.
5.  **Entertainment & Distraction:** Spotify, Netflix, Steam, X/Twitter.

## **Advanced Biometric Correlation Ideas**

To move beyond raw signals, the next phase of development should implement "Composite Metrics" that provide higher-order insights into cognitive health:

### 1. Recovery Efficiency Score (RES)

- **Goal:** Quantify how effectively the user's nervous system "switches off" during breaks.
- **Implementation:**
  - **Trigger:** Detect periods where `idle_timer` is monotonically increasing (user is away or thinking).
  - **Calculation:** `RES = (HR_at_start_of_idle - HR_at_60s_idle) / 60`.
  - **Benchmark:** A "Healthy" RES is typically >12 BPM drop within the first minute post-exertion (adapted for cognitive work).
- **UI Action:** A "Recovery Trace" (a decaying ghost line) on the main chart that triggers when the user goes idle.

### 2. Cognitive Divergence (CD)

- **Goal:** Identify "Thinking Stress" — periods of high internal arousal without external workstation activity.
- **Calculation:** `CD = |normalized_HR - normalized_churn|`.
- **Interpretation:**
  - **High CD (High HR / Low Churn):** Indicates intense mental processing (e.g., debugging a complex root cause) or emotional stress (e.g., a stressful meeting/notification).
  - **Low CD (High HR / High Churn):** Indicates "Reactive Panic" or "Firefighting" (rapidly switching apps in response to a crisis).
  - **Low CD (Low HR / Low Churn):** The definitive signature of **Deep Flow**.

### 3. The "Focus Friction" Index

- **Goal:** Measure how hard it is to get back into flow after a context switch.
- **Implementation:** Calculate the `HR_integral` (total area under the curve) for the 5-minute window _after_ a high `churn_rate` event.
- **Insight:** Identifying "Expensive Apps" that leave the user in a state of high arousal long after the task is finished.

### **"Cached LLM Classification" Strategy**

To handle obscure apps and browser-based tools:

- **Local Cache:** A dictionary (e.g., `slack.exe: Communication`) checked first.
- **LLM Fallback:** If unknown, a lightweight AI call categorizes the app/window and updates the local cache.
- **Browser Logic:** For browsers, the `window_title` is parsed to extract the specific service (e.g., "Jira" from a Chrome window title) for classification.

## Implementation Roadmap

### Week 1: The "Hello World" Handshake

- **Mobile:** Initialize Expo project with zeroconf and tcp-socket. Set up the NWListener.
- **CLI:** Build the Go mDNS advertiser. Successfully accept a TCP connection from the phone and stream a "Hello from Laptop" string.

### Week 2: The Observability Layer

- **CLI:** Implement the CoreGraphics hooks to pull the windowName and ownerName.
- **Mobile:** Build the **HealthKit Permission Handler**. Create a simple UI to toggle "Work Monitoring."

### Week 3: The SQLite Engine

- **Mobile:** Set up the SQLite schema. Implement a foreign key relationship (`heart_rate_id`) from telemetry to biometrics, automatically syncing missing health data during a catch-up job based on timestamp proximity.
- **AI Integration:** Implement the **Contextual Occupational Analysis** engine using local **Phi-4-mini-instruct** via **llama.rn**.

### Week 4: The Correlation UI

- **Mobile:** Build a "Flow State" graph using victory-native.
- **Testing:** Run the system during a 4-hour coding session. Verify the "Verve Restore" trigger (detecting laptop closure and suggesting a 120-second transition).

## Definition of Done (DoD) for Phase 1

1. The Shadow CLI starts automatically on laptop boot.
2. The Mobile App displays a **Live Connection Status** indicator (Green \= Connected to Laptop).

## Phase 2 Focus

1. Investigate restoring a real-time 'Live Update' mode as an optional feature, based on persistent connection improvements.
2. A user can view a chart showing their **Heart Rate vs. Active Application** for the last 60 minutes.
3. No data has touched a public cloud (confirmed via network proxy logs).

## Automated Release Pipeline (CI/CD)

Verve uses a split release strategy: **GitHub Actions** for CLI builds and **EAS Build** for mobile apps. See [release-architecture.md](./release-architecture.md) for the full architectural reference.

### CLI Release (`Release Verve CLI` workflow)

- **Trigger:** Manual `workflow_dispatch` with an optional version tag (e.g., `v0.0.1`).
- **Distribution Model:** Private-source, public-distribution. Binaries are published to the public `gyandeeps/verve-releases` repository.
- **CLI Artifacts:**
  - **macOS:** Produces Intel (`amd64`) and Apple Silicon (`arm64`) binaries packaged as `.tar.gz` archives with SHA256 checksums.
  - **Windows:** Cross-compiles `amd64` binary using `mingw-w64`, packaged as `.zip` archive and standalone `.exe`.
- **Package Manager Updates:** Automatically dispatches updates to Homebrew tap (`gyandeeps/homebrew-tap`) and Scoop bucket (`gyandeeps/scoop-verve`).
- **Version Injection:** Build-time version injection via Go `-ldflags` enables `verve-cli --version`.

### Mobile Release (EAS Build)

- **Android:** `make android-preview` triggers an EAS cloud build for the preview profile.
- **iOS:** `make ios-preview` triggers an EAS cloud build for the preview profile.
- **OTA Updates:** `make update-preview` pushes JS/asset updates to the preview branch via EAS Update.

# **technical plan**

# **Technical Design & Implementation Report: Verve (Phase 1)**

## **1\. Executive Summary**

Verve is a local-first distributed application engineered to quantify developer "Cognitive Load" by correlating OS-level workstation activity with real-time physiological stress signals. Phase 1 focuses exclusively on establishing a secure, persistent, local-network synchronization between a workstation and a mobile device, gathering **Heart Rate (HR/BPM)** and application focus data without any data leaving the local network.

Drawing on rigorous data isolation and security standards typical of enterprise healthcare IT environments, the system guarantees 0% cloud transmission. All biometrics, application telemetry, and AI inference run strictly on-device.

## **2\. System Architecture**

The system operates across two primary nodes on a dynamically assigned local subnet:
The system operates across two primary nodes on a dynamically assigned local subnet.

## **2.1 The Mobile Hub (The Aggregator & AI Engine)**

- **Framework:** React Native with Expo (Continuous Native Generation).
- **Language:** TypeScript.
- **Database:** `expo-sqlite` utilized for local-first data persistence and high-speed session queries.
- **AI Inference:** Powered by a hybrid **AIFacade**. It prioritizes **on-device system AI** (e.g., Gemini Nano on Android, CoreML on iOS) via the custom `expo-ai-core` native module. If system-level AI is unavailable, it falls back to **Phi-4-mini-instruct** executed via **llama.rn**. This ensures high-speed JSON state analysis and cognitive synthesis across all device tiers.

- **Core Responsibilities:** Central data aggregation, biometric polling, AI summarization, and rendering the UI ("Flow State" graphs).

## **2.2 The Shadow CLI (The Sensor)**

- **Language:** Go 1.26+ (compiled with CGO enabled).
- **Target OS:** macOS (Primary Phase 1), Windows (Secondary).
- **Core Responsibilities:** Low-footprint (\<1% CPU) background observability, tracking the frontmost application, monitoring input idle time, and buffering data for local transmission.

## **3\. Component Implementation Details**

## **3.1 Biometric Data Acquisition (Unified Health Service)**

Instead of custom native modules, the system uses a Unified Health Service architecture leveraging community-standard libraries and Expo Config Plugins for seamless native entitlement injection.

- **iOS (Apple HealthKit):** Uses `@kingstinct/react-native-healthkit` (Nitro/JSI-based) to query Heart Rate samples via `queryQuantitySamples(HKQuantityTypeIdentifierHeartRate, ...)`. HealthKit returns HR in `count/s`; the service multiplies by 60 to normalize to BPM. Background Delivery is enabled via the config plugin.
- **Android (Google Health Connect):** Uses `react-native-health-connect` to read `HeartRate` records. Each record contains an array of `samples` with `beatsPerMinute`; the service averages these per record.
- **Configuration:** ```json
  "plugins": [
  ["@kingstinct/react-native-healthkit", { "NSHealthShareUsageDescription": "Verve needs access to Heart Rate data to measure your focus level." }],
  ["react-native-health-connect", { "permissions": ["READ_HEART_RATE"] }]
  ]

## **3.2 Workstation Telemetry & The Outbox Pattern**

To guarantee data integrity during network partitions, the Shadow CLI implements an asynchronous **Outbox Pattern** backed by a local SQLite database (github.com/mattn/go-sqlite3).

- **OS Hooks:** Utilizes CGO to interface with CoreGraphics (macOS) CGWindowListCopyWindowInfo to capture the active window bundle ID, and IOKit for precise idle timer deltas.
- **Persistence:** Telemetry is written to a telemetry_outbox table with a PENDING status.
- **Dispatcher:** A dedicated goroutine polls the outbox and transmits ordered payloads to the Mobile Hub. Rows are only deleted upon receiving a COMMIT_SUCCESS acknowledgment.

## **3.3 The Local Synchronization Protocol**

Devices discover and communicate entirely offline via local network protocols.

- **Discovery:** The CLI broadcasts a dynamic service name (e.g., `Verve-Workstation-MyLaptop`) under the `_verve._tcp` service type on port 8088 using `github.com/grandcat/zeroconf`.
- **VPN Compatibility:** The system automatically identifies and binds to **Primary Physical Interfaces** (en0, en1, eth0, etc.), explicitly excluding virtual tunnels (utun, tun, tap) and security adapters (Netskope). This ensures the Mobile Hub can always resolve the workstation even when a corporate VPN is active. The Mobile Hub resolves this via `react-native-zeroconf`.
- **Authentication Handshake:**
  1. **Identify:** Mobile app connects to the resolved IP and sends a `CMD_IDENTIFY`.
  2. **Pairing:** If the device is unknown, the CLI generates a 6-digit random PIN.
  3. **Verification:** The user enters the PIN on the mobile device.
  4. **Persistence:** Upon success, a `session_token` is returned and stored in SQLite. Subsequent connections use `CMD_AUTH` with this token.
- **Transport:** Data transfer is strictly limited to direct local TCP sockets. The Mobile Hub initiates the connection to the CLI's resolved IP/Port.
- **Data Schema:** ```json  
  {  
  "timestamp": 1711234567000,  
  "active_app": "com.microsoft.VSCode",  
  "idle_timer": 12,  
  "churn_rate": 2.5,
  "machine_name": "Workstation-A"
  }

## **3.4 Data Storage & Concurrency**

- **Storage Engine:** The Mobile Hub utilizes Expo SQLite with an asynchronous transaction queue.
- **Schema Design:** Tables utilize strictly typed integer timestamps (Unix Epoch milliseconds). The `telemetry` table stores workstation sessions as serialized JSONB. The `hr_samples` table maintains a Many-to-One relationship to `telemetry` via a `telemetry_id` foreign key (`ON DELETE CASCADE`), linking physiological trends directly to the specific 2-minute activity blocks.
- **Retention:** A strict 30-day rolling deletion constraint is executed during every database initialization on both the CLI and Mobile Hub.

## **3.5 App Health Data Sync Details**

Yes, this is a standard and highly recommended architectural pattern for health-tracking applications. Relying solely on real-time background updates can be unreliable due to OS-level battery optimizations or device reboots. Implementing a **Sync Anchor** (or Watermark) strategy ensures data integrity by "catching up" on any missed data since the last successful sync.

### **1\. The Sync Anchor Pattern**

The core concept involves persisting a "last successful sync" timestamp in your local database. Every time the app returns to the foreground or is launched, it performs a query starting from that timestamp.

- **Storage:** Store a single value, such as last_health_sync_timestamp, in a local metadata table (e.g., in SQLite).
- **The Query:** When the app becomes active, it fetches all health samples where endDate \> last_health_sync_timestamp.
- **Update:** Once the new samples are successfully written to your local database, update the last_health_sync_timestamp to the current time.

### **2\. Implementation in React Native/Expo**

Since mobile operating systems suspend or "pause" apps to save power, you can use the AppState API to trigger the sync logic the moment the user interacts with the app again.

#### **iOS (HealthKit) Implementation**

HealthKit is designed for this specific scenario. You can use an HKSampleQuery with a predicate:

- **Predicate:** Create a predicate where the startDate is your stored anchor.
- **Execution:** Run the query in the AppState 'active' listener.
- **Deduplication:** HealthKit samples have unique UUIDs. When inserting into your local SQLite database, use INSERT OR IGNORE to ensure that any samples already captured via background processes aren't duplicated.

#### **Android (Health Connect) Implementation**

Health Connect utilizes a 'Changes Token' or a simple time-range filter:

- **TimeRangeFilter:** Use readRecords with a TimeRangeFilter that starts at your stored timestamp and ends at the current system time.
- **Permissions:** Ensure the sync logic handles cases where permissions might have been revoked while the app was in the background.

### **3\. Handling the 'Paused' State**

When the phone is locked or the app is in the background, the OS might terminate the app's process to reclaim memory. This catch-up mechanism is the primary fail-safe for:

- **Device Reboots:** Background observers often stop running after a reboot until the user unlocks the phone and launches the app.
- **Extended Backgrounding:** If the user hasn't opened the app for several days, the foreground sync can pull the historical data in a single batch.
- **Manual Deletion:** If a user manually adds or deletes health data in the system Health app, the catch-up logic can reconcile those changes.

### **4\. Technical Best Practices**

- **Batching:** If the 'last sync' was a long time ago (e.g., several days), fetch the data in smaller chunks (e.g., 24-hour windows) to avoid high memory pressure during the local database write.
- **Background Tasks:** In addition to the foreground sync, you can use expo-background-fetch or BackgroundFetch (iOS/Android) to occasionally perform this catch-up logic even when the user hasn't opened the app, keeping the local data 'warm.'
- **Atomic Transactions:** Ensure the data write and the timestamp update happen within a single SQLite transaction. This prevents a scenario where the data is saved, but the app crashes before updating the timestamp, which would cause duplicate data processing on the next launch.
- **Proactive Catch-up Sync:** To mitigate OS-level delays in health data availability (which can span 15-30+ minutes), the system implements a `syncHealthData()` mechanism. It scans recent workstation telemetry (using `getTelemetryWithoutBiometricsInRange`) and attempts to re-correlate heart rate data that may have arrived in the OS store after the initial connection event. This is exposed via pull-to-refresh on core dashboards and manual sync buttons in the biometrics monitor.
- **Centralized Metadata:** The system uses a centralized `last_health_sync_timestamp` anchor stored in the local SQLite `metadata` table, ensuring a consistent starting point for all synchronization workflows.

## **3.6 Mobile Hub Sync Orchestration**

The Mobile Hub acts as the central coordinator, orchestrating data ingestion from two distinct local sources to construct a unified view of cognitive load. For physiological data, it implements the **Sync Anchor Pattern**, persisting a watermark timestamp to incrementally fetch new samples from Apple HealthKit or Google Health Connect. Simultaneously, it manages CLI telemetry via the **Local Synchronization Protocol**, resolving the workstation on the local network to ingest buffered events processed through the CLI's **Outbox Pattern**. This dual-source approach ensures high data integrity and consistency even during intermittent network partitions or application backgrounding.

## **3.7 AI Strategy: Specialized Prompting**

Verve leverages a unified local AI strategy to ensure maximum privacy and consistent performance across all hardware.

### 1. Unified Model Selection

- **Unified Standard:** **Phi-4-mini-instruct**. Selected as the universal engine for its exceptional balance of reasoning and efficiency. Supports multiple quantization levels (Q2, Q3, Q4) to handle different hardware constraints; default is ~1.90GB (Q3_K_S) for improved mobile compatibility.
- **Privacy First:** The model is executed locally via **llama.rn**, ensuring 0% cloud leakage of sensitive workspace telemetry and biometric data.

### 2. System Prompt (High-Density Session Analysis)

```text
You are an HCI analyst. Analyze high-density telemetry representing 120s workstation windows.
Input Schema: {start_timestamp, end_timestamp, churn_rate, idle_timer, sessions_data:[{app, title, duration_sec}], hr_samples:[{ts, bpm}]}.

Rules:
1. Distinguish primary work (high duration_sec) from distractions (low duration_sec).
2. Correlate 'hr_samples' spikes against specific 'sessions_data' entries to detect application micro-stressors.
3. Churn/HR ratio should distinguish between Flow and Fractured Focus.

Return strictly as JSON:
{
  "overall_state": "High Stress" | "Calm" | "Deep Work" | "Distracted",
  "stress_triggers": ["correlated spikes"],
  "calm_periods": ["flow state apps"],
  "churn_impact": "Text analysis of churn vs HR",
  "actionable_feedback": "One sentence strategy",
  "app_categories": { "AppName": "Category" }
}
```

## **4\. Contextual Interrupts (Verve Restore)**

The system is designed to handle hard cognitive boundaries, smoothly transitioning the user from deep technical work to an active home environment (e.g., engaging with a 6-year-old and a 1-year-old).

- **Hardware Trigger:** The CLI listens for OS-level sleep events (e.g., kIOMessageSystemWillSleep on macOS when the laptop lid is closed).
- **Implementation (CGO):** Uses `IORegisterForSystemPower` to catch the `kIOMessageSystemWillSleep` signal in a dedicated background run-loop.
- **Instant Flush:** Upon detection, the CLI dispatcher halts its normal polling cycle and executes an immediate, synchronous `FlushNow()` to push all pending workstation events plus a final `SLEEP_EVENT` to the Mobile Hub.
- **Notification Acknowledgement:** The CLI calls `IOAllowPowerChange` only _after_ the socket write is acknowledged or a 5-second timeout is reached, ensuring data persistence before hardware suspension.
- **Mobile Response:** The Mobile Hub receives the `SLEEP_EVENT`, triggers a final 5-minute rolling "Contextual Health Sync," calculates the closing "Session Stress Index," and renders a **120-second "Cognitive Cooldown" screen** to enforce the mental boundary.

## **5\. Definition of Done (Phase 1\)**

- [x] Shadow CLI starts silently on OS boot and uses <1% CPU.
- [x] Mobile app successfully reads **Heart Rate** data via HealthKit/Health Connect.
- [x] CLI and Mobile Hub establish a secure **PIN-Based Handshake** and sync data reliably.
- [x] SQLite schema successfully joins biometrics and telemetry using timestamp proximity.
- [x] **Clinical Stats Tab** implemented with performant SQLite JSON analysis for long-term trends.
- [x] **Hybrid AI Facade** operational, orchestrating native System AI and `llama.rn` fallbacks.
- [x] Multi-platform Support: Windows telemetry implementation (active app, window title, idle measurement).
- [x] Android Stability: Custom Expo Config Plugin for `MainActivity` lifecycle and `activity-alias` (fixed Health Connect crashes and permission visibility).
- [x] "Verve Restore" CGO listener is active and correctly traps `kIOMessageSystemWillSleep`.
- [x] CLI executes a high-priority synchronous `FlushNow()` on sleep detection.
- [x] Mobile Hub initiates a 120s "Cognitive Cooldown" animation on receipt of `SLEEP_NOTIFICATION`.
- [x] A 60-minute **"Cardiac/Work Correlation"** chart successfully renders Heart Rate (BPM) and Workstation Intensity on the mobile device (via **Sessions Tab**).
- [x] Network proxy logs confirm zero outbound HTTP requests to external servers.

# Future Enhancements (Post-Plan Ideas)

To move beyond raw telemetry gathering and into active focus optimization, the following architectural improvements are proposed for subsequent development phases:

### 1. The Decompression Report

- **Goal:** Surface the architectural efficiency of the RLE compression layer.
- **Implementation:** A dashboard metric in the "Developer" settings showing the real-time compression ratio (e.g., "12:1 Data Efficiency: 720 polls compressed to 60 session blocks").
- **Benefit:** Validates the resource-efficiency of the local-first distributed model.

### 2. Autonomous AI State Classification

- **Goal:** Transform raw AI inferences into persistent database categories.
- **Implementation:** Introduce a background job that batches the local Phi-4-mini inferences and applies high-level labels (e.g., "Deep Flow", "Reactive Panic") back to the `telemetry` table's `ai_state` column.
- **Benefit:** Enables long-term trend analysis and "Stress Heatmaps" without requiring real-time LLM interaction.

### 3. Focus Friction Correlation

- **Goal:** Quantify the exact physiological cost of context switching.
- **Implementation:** A specialized chart overlaying the `churn_rate` (switches/min) against standardized Heart Rate Variability (HRV) deltas to calculate a "Friction Coefficient" for every application.
- **Benefit:** Identifies "Toxic Workflows" that cause high arousal with low output.

### 4. Active Focus Shield (The "Cognitive Firewall")

- **Goal:** Transition from passive monitoring to active intervention.
- **Implementation:** When the Mobile Hub detects a "High Stress/High Churn" trigger, it sends a high-priority TCP command back to the Shadow CLI to temporarily block distracting apps (e.g., Slack, Chrome) for 15 minutes.
- **Benefit:** Uses bio-feedback as a hardware-level gate for protecting deep work.

# Known Issues

### iOS Build Failure (Swift 6 Concurrency)

- **Status:** Investigating / Waiting for Upstream Fix
- **Description:** The iOS build currently fails in GitHub Actions due to strict concurrency checking introduced in Xcode 16 / Swift 6.
- **Tracking PR:** [Expo PR #44141: Swift 6 / Xcode 16 strict concurrency compliance](https://github.com/expo/expo/pull/44141).
- **Update:** Once this PR is merged and a new version of `expo-modules-core` is released, we should update our dependencies to resolve this build failure.
