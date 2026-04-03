# Verve: Premium Telemetry & Cognitive Insights

<p align="center">
  <img src="assets/verve_logo_banner.png" width="300" alt="Verve Logo" />
</p>

<p align="center">
  <a href="https://reactnative.dev/"><img src="https://img.shields.io/badge/React_Native-0.83+-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React Native Status" /></a>
  <a href="https://go.dev/"><img src="https://img.shields.io/badge/Go-1.22+-00ADD8?style=for-the-badge&logo=go&logoColor=white" alt="Go Version" /></a>
  <a href="https://expo.dev/"><img src="https://img.shields.io/badge/Expo-55-000020?style=for-the-badge&logo=expo&logoColor=white" alt="Expo Version" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript Support" /></a>
</p>

---

## 🧬 Why "Verve"?

**Verve** is often used to describe vitality and spirit, but in a biological context, it relates to the **nervous energy** that triggers the heart.

As a project focused on quantifying cognitive load through heart rate and physiological signals, the name perfectly encapsulates the intersection of biological vitality and digital performance. It's concise, high-end, and reflects the premium nature of the application.

---

## ✨ Key Features

| Feature            | Description                                                         | Icon |
| :----------------- | :------------------------------------------------------------------ | :--: |
| **mDNS Discovery** | Seamless local network auto-discovery between CLI & App.            |  🛰️  |
| **TCP Stream**     | High-speed telemetry streaming with persistent heartbeat.           |  💓  |
| **Shadow CLI**     | Go agent using CGO & SQLite Outbox Pattern for guaranteed delivery. |  🖥️  |
| **Verve Restore**  | IOKit-triggered data flush before device sleep to prevent loss.     |  🛡️  |
| **On-Device AI**   | Phi-4-mini inference via `llama.rn` for private cognitive analysis. |  🧠  |
| **Vector Storage** | `sqlite-vec` integration for localized biometric memory/RAG.        |  💾  |

---

## 🏗️ Architecture

```mermaid
graph TD
    subgraph Workstation ["💻 Workstation (Shadow CLI)"]
        direction TB
        CLI["Go Agent (CGO)"]
        Outbox[("SQLite Outbox")]
        Restore["Verve Restore (IOKit)"]

        CLI -->|Buffer| Outbox
        CLI -->|Sleep Listener| Restore
    end

    subgraph Transport ["🌐 Local Transport"]
        direction LR
        mDNS((mDNS/Bonjour))
        TCP((TCP Socket))
    end

    subgraph MobileHub ["📱 Mobile Hub (React Native)"]
        direction TB
        App["Verve App (Expo)"]
        HK(("HealthKit / Health Connect"))
        AI["Phi-4-mini AI Engine"]
        Storage[("SQLite + sqlite-vec")]
        UI["Clinical UI"]

        App <--> HK
        App <--> AI
        App --> Storage
        App --> UI
    end

    CLI <-->|Advertise| mDNS
    App <-->|Discover| mDNS
    CLI <-->|Telemetry Stream| TCP
    App <-->|High-Speed Sync| TCP

    %% Standard Mermaid styling
    classDef workstation fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#f8fafc;
    classDef mobile fill:#0f172a,stroke:#818cf8,stroke-width:2px,color:#f8fafc;
    classDef network fill:#020617,stroke:#475569,stroke-width:2px,color:#94a3b8,stroke-dasharray: 5 5;
    classDef node fill:#1e293b,stroke:#334155,color:#f8fafc;
    classDef database fill:#1e293b,stroke:#fbbf24,color:#f8fafc;
    classDef ai fill:#1e293b,stroke:#c084fc,color:#f8fafc;

    class Workstation workstation;
    class MobileHub mobile;
    class Transport network;
    class CLI,Restore,App,UI node;
    class Outbox,Storage database;
    class AI ai;
```

---

## 🚀 Quick Start

### 1. Environment Setup

Ensure you have **Go** (~1.22) and **Node.js** (LTS) installed.

```bash
# Install mobile dependencies
npm install
```

### 2. Launching the Stack

Verve uses a root `Makefile` to simplify orchestration.

| Component      | Command      | Purpose                      |
| :------------- | :----------- | :--------------------------- |
| **Project**    | `make help`  | Show all available commands  |
| **Shadow CLI** | `make run`   | Launch the telemetry service |
| **Mobile Hub** | `make ios`   | Launch the iOS client        |
| **Metro Hub**  | `make start` | Start the Expo dev server    |

---

## 🛠️ Technology Stack

- **CLI/Backend**: [Go](https://go.dev/) (CGO, Zeroconf, TCP)
- **Mobile Frontend**: [React Native](https://reactnative.dev/) with [Expo Router](https://docs.expo.dev/router/introduction/)
- **State & Storage**: [SQLite](https://www.sqlite.org/) for local-first data persistence
- **Communication**: [mDNS/Zeroconf](https://en.wikipedia.org/wiki/Zero-configuration_networking) & [TCP Sockets](https://en.wikipedia.org/wiki/Transmission_Control_Protocol)

---
