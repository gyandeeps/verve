# Verve

This repository contains the **Verve** application, which consists of two primary components:

1. **React Native Mobile App**: Built with **Expo** and **React Native**, utilizing **Expo Router** for navigation. The app discovers the CLI over the local network using `react-native-zeroconf` (mDNS) and communicates with it using `react-native-tcp-socket`.
2. **Go CLI**: A command-line interface located in the `cli/` directory. It advertises its presence on the network via dynamic mDNS names (e.g., `Verve-Hostname`), accepts TCP socket connections, and buffers workstation telemetry using an **Outbox Pattern** to ensure reliable transmission to the mobile app.

## Tech Stack

- **Mobile Frontend**: React Native (v0.83+), Expo (~v55), TypeScript
- **Networking**: TCP Sockets, mDNS (Zeroconf) for local network discovery and telemetry transmission
- **Local AI**: **Phi-4-mini-instruct** executed via **llama.rn** for private on-device behavioral synthesis.
- **CLI / Backend**: Go

## Documentation & Design

- **Architecture & Roadmap**: [docs/Verve.md](file:///Users/gyandeeps/code/CogniStaff/docs/Verve.md) (Primary Source of Truth)
- **Design System**: [docs/design-system.md](file:///Users/gyandeeps/code/CogniStaff/docs/design-system.md) (The "Clinical Console" specification)

## Architecture Overview

- The **Go CLI** runs on a machine and exposes a TCP service, advertising itself over mDNS. It implements a local SQLite outbox to buffer telemetry events, preventing data loss during network partitions.
- The **React Native App** acts as the client. It uses `DiscoveryService` to locate workstations and `SyncService` to ingest buffered telemetry via TCP and coordinate physiological data synchronization using the **Unified Health Service** (`syncHealthData`).

## Rules & Guidelines

- **Source of Truth**: Always reference [docs/Verve.md](file:///Users/gyandeeps/code/CogniStaff/docs/Verve.md) for architectural plans, data schemas, and implementation details when planning or executing a task.
- **Design Fidelity**: Follow the "Clinical Console" guidelines in [docs/design-system.md](file:///Users/gyandeeps/code/CogniStaff/docs/design-system.md). Avoid standard rounded "consumer" aesthetics; prioritize high-fidelity, monospaced typography for technical data.
- **Biometric Intelligence**: We are currently implementing advanced metrics like **Recovery Efficiency (RES)** and **Cognitive Divergence (CD)**. Refer to the "Advanced Biometric Correlation Ideas" section in `docs/Verve.md` for logic details.
- Whenever updating the Go CLI (`cli/main.go`), remember to ensure `go.mod` and `go.sum` are synchronized.
- TCP heartbeat mechanisms are used to determine connection liveness and handle automatic reconnections without duplicating logs or connections.
- **No Telemetry for Local Runs**: Always ensure `EXPO_NO_TELEMETRY=1` is applied to local iOS and Android runs (both in the `Makefile` and `package.json`). This rule should **not** apply to preview or production (EAS) builds.
- Ensure that you use Expo-compatible networking modules and follow best practices for React Native lifecycle management when creating new components in the `app/` and `src/services/` directories.
- **Pushing Changes**: Always specify the branch name when pushing (e.g., `git push origin <branch-name>`). Never use `git push` without the destination.
- For app changes, always run `npx tsc --noEmit` after making any code changes.

## Interaction Style

- **Detailed Reasoning**: Always explain the "why" and "how" behind your logic and code changes in your final response.
- **Thoughtful Actions**: Provide a detailed summary of your thinking and the steps you intend to take before executing them.
- **Verbose Output**: Prefer thorough, educational explanations over concise ones.
- **Plan Alignment**: Ensure every implementation plan explicitly refers to the roadmap and "Definition of Done" found in [docs/Verve.md](file:///Users/gyandeeps/code/CogniStaff/docs/Verve.md).
