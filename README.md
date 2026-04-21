# Verve: Premium Telemetry & Cognitive Insights

<p align="center">
  <img src="assets/verve_logo_banner.png" width="400" alt="Verve Logo" />
</p>

<p align="center">
  <a href="https://reactnative.dev/"><img src="https://img.shields.io/badge/React_Native-0.83+-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React Native Status" /></a>
  <a href="https://go.dev/"><img src="https://img.shields.io/badge/Go-1.26+-00ADD8?style=for-the-badge&logo=go&logoColor=white" alt="Go Version" /></a>
  <a href="https://expo.dev/"><img src="https://img.shields.io/badge/Expo-55-000020?style=for-the-badge&logo=expo&logoColor=white" alt="Expo Version" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript Support" /></a>
</p>

---

## 🧬 Why "Verve"?

**Verve** is often used to describe vitality and spirit, but in a biological context, it relates to the **nervous energy** that triggers the heart.

As a project focused on quantifying cognitive load through heart rate and physiological signals, the name perfectly encapsulates the intersection of biological vitality and digital performance. It's concise, high-end, and reflects the premium nature of the application.

---

## ✨ Key Features

| Feature              | Description                                                     | Icon |
| :------------------- | :-------------------------------------------------------------- | :--: |
| **Secure Handshake** | 6-digit PIN pairing & session token persistence for security.   |  🔐  |
| **Clinical Stats**   | Multi-dimensional analytics using SQLite JSON processing.       |  📊  |
| **Hybrid AI**        | AIFacade orchestrates Phi-4 & System AI (Gemini/CoreML).        |  🧠  |
| **Verve Restore**    | IOKit-triggered data flush before device sleep to prevent loss. |  🛡️  |
| **mDNS Discovery**   | Dynamic CLI naming; VPN-resilient physical interface binding.   |  🛰️  |

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
        direction TB
        mDNS((mDNS/Bonjour))
        TCP((TCP Socket))
    end

    subgraph MobileHub ["📱 Mobile Hub (React Native)"]
        direction TB
        App["Verve App (Expo)"]
        App <--> HK
        App <--> AI["Hybrid AIFacade (Phi-4 + System AI)"]
        Storage[("SQLite Database")]
        UI["Clinical UI"]

        App <--> HK
        App <--> AI
        App --> Storage
        App --> UI
    end

    CLI <--->|mDNS Advertise| mDNS
    mDNS <--->|Discovery| App
    App <--->|TCP Connect| TCP
    TCP <--->|Stream| CLI

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

Verve requires specific versions of Go and Node.js for stability.

#### 🍏 macOS (Recommended)

```bash
# 1. Install Node.js 24 using nvm
nvm install 24 && nvm use 24

# 2. Install Go 1.26+
brew install go

# 3. Verify installations
node -v # Should be v24.x
go version # Should be 1.26+
```

> [!TIP]
> If you're using **nvm**, this project includes an `.nvmrc` file. Just run `nvm use` in the root directory.

#### 📦 Project Initialization

Once your environment is ready, initialize the project with a single command:

```bash
# Install all mobile dependencies and tidy Go modules
make setup
```

### 2. Launching the Stack

Verve uses a root `Makefile` to simplify orchestration. Launch each component in its own terminal tab:

| Component       | Command        | Purpose                       |
| :-------------- | :------------- | :---------------------------- |
| **Shadow CLI**  | `make run`     | Build and launch telemetry    |
| **Mobile Hub**  | `make ios`     | Launch iOS app (Native Build) |
| **Android Hub** | `make android` | Launch Android app (Native)   |
| **Metro Hub**   | `make start`   | Start Expo dev server         |
| **Help Hub**    | `make help`    | Show all available commands   |

---

## 🛠️ Technology Stack

- **CLI/Backend**: [Go](https://go.dev/) (CGO, Zeroconf, TCP Server)
- **Mobile Frontend**: [React Native](https://reactnative.dev/) with [Expo Router](https://docs.expo.dev/router/introduction/)
- **State & Storage**: [SQLite](https://www.sqlite.org/) for local-first data persistence
- **Communication:** [mDNS/Zeroconf](https://en.wikipedia.org/wiki/Zero-configuration_networking) (with VPN-resilient binding) & [Direct TCP Client](https://en.wikipedia.org/wiki/Transmission_Control_Protocol)

---

## 📜 License

This project is licensed under the **Apache License 2.0**.

See the [LICENSE](LICENSE) file for the full legal text.
