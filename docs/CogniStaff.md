# Plan

# Project Report: CogniStaff (Phase 1\)

## To quantify "Cognitive Load" by correlating OS-level development activity with real-time physiological stress signals, processed entirely on-device.

## Executive Summary

CogniStaff is a distributed, local-first health application. It consists of a **Mobile Hub** (Expo/React Native) that acts as the primary data aggregator and AI inference engine, and a **Shadow CLI** (Go) that monitors workstation activity. Phase 1 focuses on establishing a persistent, local-network connection between these two nodes to sync heart rate variability (HRV) with "Active Context" data.

## System Architecture & Components

### The Mobile Hub (Expo / React Native)

The phone serves as the "Brain." In 2026, we utilize **Expo’s Continuous Native Generation (CNG)** to bake in high-performance native modules while maintaining a TypeScript-first developer experience.

* **Networking:** react-native-tcp-socket (used for on-demand data fetch initiated by user action) and react-native-zeroconf for mDNS advertising.  
* **Storage:** **Expo SQLite** with the sqlite-vec extension for local vector storage, enabling future RAG (Retrieval-Augmented Generation) capabilities.  
* **Health Layer:** Direct integration with **Apple HealthKit** (iOS) and **Health Connect** (Android) using background observer queries.

### The Shadow CLI (Go / macOS)

A low-footprint background process written in Go.

* **Observability:** Uses **CGO** to hook into the CoreGraphics (macOS) or Win32 (Windows) APIs to monitor the frontmost application without the overhead of UI automation.  
* **Network Client:** An mDNS browser that resolves cognistaff.local and initiates a TCP connection only to upload batched data on user request.  
* **Storage:** Local SQLite DB with an Outbox Pattern to guarantee all recorded "Cognitive Signal" data is persisted before attempting upload to the Mobile Hub.  
* **Sampling Rate:** 30-second heartbeats for standard telemetry; immediate "event" triggers for context switches (e.g., switching from VS Code to Slack).

The Outbox Pattern maintains data tracking using a dedicated Outbox Table, an atomic transaction, and a separate Message Dispatcher process. This system ensures data is safely persisted and sent in the correct order:

* **Atomic Persistence (What to Send):** When the CLI records new data, it performs two writes in a single, atomic database transaction: saving the data to the main table and inserting a corresponding record into the Outbox Table, marked as "Undelivered". This guarantees that if the data is recorded, an outbox entry is also created.  
* **Sequential Ordering (What to Send Now):** The Outbox Table is an append-only log that maintains the exact order of data recording. A separate Message Dispatcher polls the table for the oldest records still marked as "Undelivered".  
* **Status Update (What Has Been Sent):** Once the Message Dispatcher receives a successful delivery confirmation from the Mobile Hub, it updates the record's state in the Outbox Table from "Undelivered" to "Delivered". This status change tracks what has been sent, ensuring at-least-once delivery.

### The Local Bridge

* **Discovery:** mDNS (Bonjour) protocol.  
* **Transport:** TCP over Wi-Fi (Phase 1).  
* **Security:** Device-level pairing using a 6-digit PIN exchanged over the local socket to prevent "cross-talk" on shared networks.

## Data Schema: The "Cognitive Signal"

We will use a strict **JSON** schema for Phase 1 to ensure the Mobile Hub can parse signals with minimal CPU cycle usage.

| Field | Type | Description |
| :---- | :---- | :---- |
| timestamp | ISO8601 | High-precision time for biometric alignment. |
| active\_app | string | The Bundle ID of the focused application (e.g., com.microsoft.VSCode). |
| idle\_timer | int | Seconds since last keyboard/mouse input. |
| churn\_rate | float | Context switches per minute (a proxy for "Mental Churn"). |
| metadata | object | Git branch name or current active Jira ticket ID. |

## Biometric Strategy

The app will monitor **Heart Rate Variability (HRV)** using the **SDNN (Standard Deviation of NN intervals)** metric.

* **Correlation Logic:** If churn\_rate increases while SDNN decreases over a 5-minute rolling window, the system flags a **"High Stress/Low Output"** state.  
* **Backgrounding:** On iOS, we will utilize "HealthKit Background Delivery" to ensure HRV data is continuously collected. Data transfer from the CLI will be user-initiated (on-demand refresh).

## Implementation Roadmap

### Week 1: The "Hello World" Handshake

* **Mobile:** Initialize Expo project with zeroconf and tcp-socket. Set up the NWListener.  
* **CLI:** Build the Go mDNS resolver. Successfully send a "Hello from Laptop" string to the phone screen.

### Week 2: The Observability Layer

* **CLI:** Implement the CoreGraphics hooks to pull the windowName and ownerName.  
* **Mobile:** Build the **HealthKit Permission Handler**. Create a simple UI to toggle "Work Monitoring."

### Week 3: The SQLite Engine

* **Mobile:** Set up the SQLite schema. Implement a "Join" view that aligns work\_signal rows with biometric\_data rows based on timestamp proximity.  
* **AI Pre-work:** Integrate a local **Gemma 2 2B** model via react-native-executorch for basic "Daily Summary" generation.

### Week 4: The Correlation UI

* **Mobile:** Build a "Flow State" graph using victory-native.  
* **Testing:** Run the system during a 4-hour coding session. Verify the "Dad-Mode" trigger (detecting laptop closure and suggesting a 2-minute transition).

## Definition of Done (DoD) for Phase 1

1. The Shadow CLI starts automatically on laptop boot.  
2. The Mobile App displays a **Live Connection Status** indicator (Green \= Connected to Laptop).

## Phase 2 Focus

1. Investigate restoring a real-time 'Live Update' mode as an optional feature, based on persistent connection improvements.  
2. A user can view a chart showing their **Heart Rate vs. Active Application** for the last 60 minutes.  
3. No data has touched a public cloud (confirmed via network proxy logs).

# **technical plan**

# **Technical Design & Implementation Report: CogniStaff (Phase 1\)**

## **1\. Executive Summary**

CogniStaff is a local-first distributed application engineered to quantify developer "Cognitive Load" by correlating OS-level workstation activity with real-time physiological stress signals. Phase 1 focuses exclusively on establishing a secure, persistent, local-network synchronization between a workstation and a mobile device, gathering Heart Rate Variability (HRV) and application focus data without any data leaving the local network.

Drawing on rigorous data isolation and security standards typical of enterprise healthcare IT environments, the system guarantees 0% cloud transmission. All biometrics, application telemetry, and AI inference run strictly on-device.

## **2\. System Architecture**

The system operates across two primary nodes on a dynamically assigned local subnet:

## **2.1 The Mobile Hub (The Aggregator & AI Engine)**

* **Framework:** React Native with Expo (Continuous Native Generation).  
* **Language:** TypeScript.  
* **Database:** expo-sqlite utilizing the sqlite-vec extension for local vector storage and future Retrieval-Augmented Generation (RAG).  
* **AI Inference:** Local **Gemma 2 2B** model integrated via react-native-executorch to avoid React Native bridge bottlenecks.  
* **Core Responsibilities:** Central data aggregation, biometric polling, AI summarization, and rendering the UI ("Flow State" graphs).

## **2.2 The Shadow CLI (The Sensor)**

* **Language:** Go 1.21+ (compiled with CGO enabled).  
* **Target OS:** macOS (Primary Phase 1), Windows (Secondary).  
* **Core Responsibilities:** Low-footprint (\<1% CPU) background observability, tracking the frontmost application, monitoring input idle time, and buffering data for local transmission.

## **3\. Component Implementation Details**

## **3.1 Biometric Data Acquisition (Unified Health Service)**

Instead of custom native modules, the system uses a Unified Health Service architecture leveraging community-standard libraries and Expo Config Plugins for seamless native entitlement injection.

* **iOS (Apple HealthKit):** Uses `@kingstinct/react-native-healthkit` (Nitro/JSI-based) to query SDNN HRV samples via `queryQuantitySamples(HKQuantityTypeIdentifier.heartRateVariabilitySDNN, ...)`. Background Delivery capabilities are enabled via the config plugin.  
* **Android (Google Health Connect):** Uses `react-native-health-connect` to read `HeartRateVariabilityRmssd`. The internal service normalizes RMSSD to align with the SDNN-based stress correlation schema.  
* **Configuration:** ```json
  "plugins": [
  ["@kingstinct/react-native-healthkit", { "NSHealthShareUsageDescription": "CogniStaff needs access to HRV data." }],
  ["react-native-health-connect", { "permissions": ["READ_HEART_RATE", "READ_HEART_RATE_VARIABILITY"] }]
  ]

*   
* 

## **3.2 Workstation Telemetry & The Outbox Pattern**

To guarantee data integrity during network partitions, the Shadow CLI implements an asynchronous **Outbox Pattern** backed by a local SQLite database (github.com/mattn/go-sqlite3).

* **OS Hooks:** Utilizes CGO to interface with CoreGraphics (macOS) CGWindowListCopyWindowInfo to capture the active window bundle ID, and IOKit for precise idle timer deltas.  
* **Persistence:** Telemetry is written to a telemetry\_outbox table with a PENDING status.  
* **Dispatcher:** A dedicated goroutine polls the outbox and transmits ordered payloads to the Mobile Hub. Rows are only deleted upon receiving a COMMIT\_SUCCESS acknowledgment.

## **3.3 The Local Synchronization Protocol**

Devices discover and communicate entirely offline via local network protocols.

* **Discovery:** The CLI broadcasts a \_cognistaff.\_tcp service on port 8081 using github.com/grandcat/zeroconf. The Mobile Hub resolves this via react-native-zeroconf.  
* **Transport:** Data transfer is strictly limited to local TCP sockets using react-native-tcp-socket.  
* **Data Schema:** \`\`\`json  
  {  
  "timestamp": 1711234567000,  
  "active\_app": "com.microsoft.VSCode",  
  "idle\_timer": 12,  
  "churn\_rate": 2.5  
  }

*   
* 

## **3.4 Data Storage & Concurrency**

* **Storage Engine:** The Mobile Hub utilizes Expo SQLite with an asynchronous transaction queue.  
* **Schema Design:** Tables utilize strictly typed integer timestamps (Unix Epoch milliseconds) to facilitate high-speed JOIN operations between high-frequency biometric rows and workstation telemetry rows without blocking the UI thread.  
* **Retention:** A nightly expo-background-fetch cron-job executes a strict 30-day rolling deletion constraint.

## **3.5 App Health Data Sync Details**

Yes, this is a standard and highly recommended architectural pattern for health-tracking applications. Relying solely on real-time background updates can be unreliable due to OS-level battery optimizations or device reboots. Implementing a **Sync Anchor** (or Watermark) strategy ensures data integrity by "catching up" on any missed data since the last successful sync.

### **1\. The Sync Anchor Pattern**

The core concept involves persisting a "last successful sync" timestamp in your local database. Every time the app returns to the foreground or is launched, it performs a query starting from that timestamp.

* **Storage:** Store a single value, such as last\_health\_sync\_timestamp, in a local metadata table (e.g., in SQLite).  
* **The Query:** When the app becomes active, it fetches all health samples where endDate \> last\_health\_sync\_timestamp.  
* **Update:** Once the new samples are successfully written to your local database, update the last\_health\_sync\_timestamp to the current time.

### **2\. Implementation in React Native/Expo**

Since mobile operating systems suspend or "pause" apps to save power, you can use the AppState API to trigger the sync logic the moment the user interacts with the app again.

#### **iOS (HealthKit) Implementation**

HealthKit is designed for this specific scenario. You can use an HKSampleQuery with a predicate:

* **Predicate:** Create a predicate where the startDate is your stored anchor.  
* **Execution:** Run the query in the AppState 'active' listener.  
* **Deduplication:** HealthKit samples have unique UUIDs. When inserting into your local SQLite database, use INSERT OR IGNORE to ensure that any samples already captured via background processes aren't duplicated.

#### **Android (Health Connect) Implementation**

Health Connect utilizes a 'Changes Token' or a simple time-range filter:

* **TimeRangeFilter:** Use readRecords with a TimeRangeFilter that starts at your stored timestamp and ends at the current system time.  
* **Permissions:** Ensure the sync logic handles cases where permissions might have been revoked while the app was in the background.

### **3\. Handling the 'Paused' State**

When the phone is locked or the app is in the background, the OS might terminate the app's process to reclaim memory. This catch-up mechanism is the primary fail-safe for:

* **Device Reboots:** Background observers often stop running after a reboot until the user unlocks the phone and launches the app.  
* **Extended Backgrounding:** If the user hasn't opened the app for several days, the foreground sync can pull the historical data in a single batch.  
* **Manual Deletion:** If a user manually adds or deletes health data in the system Health app, the catch-up logic can reconcile those changes.

### **4\. Technical Best Practices**

* **Batching:** If the 'last sync' was a long time ago (e.g., several days), fetch the data in smaller chunks (e.g., 24-hour windows) to avoid high memory pressure during the local database write.  
* **Background Tasks:** In addition to the foreground sync, you can use expo-background-fetch or BackgroundFetch (iOS/Android) to occasionally perform this catch-up logic even when the user hasn't opened the app, keeping the local data 'warm.'  
* **Atomic Transactions:** Ensure the data write and the timestamp update happen within a single SQLite transaction. This prevents a scenario where the data is saved, but the app crashes before updating the timestamp, which would cause duplicate data processing on the next launch.

## **3.6 Mobile Hub Sync Orchestration**

The Mobile Hub acts as the central coordinator, orchestrating data ingestion from two distinct local sources to construct a unified view of cognitive load. For physiological data, it implements the **Sync Anchor Pattern**, persisting a watermark timestamp to incrementally fetch new samples from Apple HealthKit or Google Health Connect. Simultaneously, it manages CLI telemetry via the **Local Synchronization Protocol**, resolving the workstation on the local network to ingest buffered events processed through the CLI's **Outbox Pattern**. This dual-source approach ensures high data integrity and consistency even during intermittent network partitions or application backgrounding.

## **4\. Contextual Interrupts ("Dad-Mode")**

The system is designed to handle hard cognitive boundaries, smoothly transitioning the user from deep technical work to an active home environment (e.g., engaging with a 6-year-old and a 1-year-old).

* **Hardware Trigger:** The CLI listens for OS-level sleep events (e.g., kIOMessageSystemWillSleep on macOS when the laptop lid is closed).  
* **Instant Flush:** Upon detection, the CLI has a \~20-second execution window to instantly flush the current window state to the SQLite outbox and force a high-priority synchronous TCP push to the Mobile Hub.  
* **Mobile Response:** The Mobile Hub receives the flush, triggers a final HealthKit snapshot to calculate a closing "Stress Score," and initiates a 2-minute visual cooldown sequence on the phone UI to enforce the cognitive boundary.

## **5\. Definition of Done (Phase 1\)**

* \[ \] Shadow CLI starts silently on OS boot and uses \<1% CPU.  
* \[ \] Mobile app successfully reads HRV data via HealthKit/Health Connect.  
* \[ \] CLI and Mobile Hub establish an mDNS/TCP handshake and sync data reliably.  
* \[ \] SQLite schema successfully joins biometrics and telemetry using timestamp proximity.  
* \[ \] "Dad-Mode" correctly triggers on laptop lid closure and flushes final telemetry payload.  
* \[ \] A 60-minute "Flow State" chart successfully renders on the mobile device.  
* \[ \] Network proxy logs confirm zero outbound HTTP requests to external servers.

