# Verve

This repository contains the **Verve** application, which consists of two primary components:

1. **React Native Mobile App**: Built with **Expo** and **React Native**, utilizing **Expo Router** for navigation. The app discovers the CLI over the local network using `react-native-zeroconf` (mDNS) and communicates with it using `react-native-tcp-socket`.
2. **Go CLI**: A command-line interface located in the `cli/` directory. It advertises its presence on the network via dynamic mDNS names (e.g., `Verve-Hostname`), accepts TCP socket connections, and streams telemetry data (including `machine_name`) to the mobile app.

## Tech Stack

- **Mobile Frontend**: React Native (v0.83+), Expo (~v55), TypeScript
- **Networking**: TCP Sockets, mDNS (Zeroconf) for local network discovery and telemetry transmission
- **Local AI**: **Phi-4-mini-instruct** executed via **llama.rn** for private on-device behavioral synthesis.
- **CLI / Backend**: Go

## Documentation & Design

- **Architecture & Roadmap**: [docs/Verve.md](file:///Users/gyandeeps/code/CogniStaff/docs/Verve.md) (Primary Source of Truth)
- **Design System**: [docs/design-system.md](file:///Users/gyandeeps/code/CogniStaff/docs/design-system.md) (The "Clinical Console" specification)

## Architecture Overview

- The **Go CLI** runs on a machine and exposes a TCP service, advertising itself over mDNS. It regularly sends telemetry data (e.g., every 20 seconds).
- The **React Native App** acts as the client. It uses `SyncService` and `DiscoveryService` to search for the mDNS service on the local network, connect via TCP, handle heartbeats, and receive telemetry from the CLI.

## Rules & Guidelines

- **Source of Truth**: Always reference [docs/Verve.md](file:///Users/gyandeeps/code/CogniStaff/docs/Verve.md) for architectural plans, data schemas, and implementation details when planning or executing a task.
- **Design Fidelity**: Follow the "Clinical Console" guidelines in [docs/design-system.md](file:///Users/gyandeeps/code/CogniStaff/docs/design-system.md). Avoid standard rounded "consumer" aesthetics; prioritize high-fidelity, monospaced typography for technical data.
- **Biometric Intelligence**: We are currently implementing advanced metrics like **Recovery Efficiency (RES)** and **Cognitive Divergence (CD)**. Refer to the "Advanced Biometric Correlation Ideas" section in `docs/Verve.md` for logic details.
- Whenever updating the Go CLI (`cli/main.go`), remember to ensure `go.mod` and `go.sum` are synchronized.
- TCP heartbeat mechanisms are used to determine connection liveness and handle automatic reconnections without duplicating logs or connections.
- Ensure that you use Expo-compatible networking modules and follow best practices for React Native lifecycle management when creating new components in the `app/` and `src/services/` directories.

## Interaction Style

- **Detailed Reasoning**: Always explain the "why" and "how" behind your logic and code changes in your final response.
- **Thoughtful Actions**: Provide a detailed summary of your thinking and the steps you intend to take before executing them.
- **Verbose Output**: Prefer thorough, educational explanations over concise ones.
- **Plan Alignment**: Ensure every implementation plan explicitly refers to the roadmap and "Definition of Done" found in [docs/Verve.md](file:///Users/gyandeeps/code/CogniStaff/docs/Verve.md).
