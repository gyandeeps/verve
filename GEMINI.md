# CogniStaff

This repository contains the **CogniStaff** application, which consists of two primary components:

1. **React Native Mobile App**: Built with **Expo** and **React Native**, utilizing **Expo Router** for navigation. The app discovers the CLI over the local network using `react-native-zeroconf` (mDNS) and communicates with it using `react-native-tcp-socket`.
2. **Go CLI**: A command-line interface located in the `cli/` directory. It advertises its presence on the network via `zeroconf`, accepts TCP socket connections, and streams telemetry data to the mobile app.

## Tech Stack

- **Mobile Frontend**: React Native (v0.83+), Expo (~v55), TypeScript
- **Networking**: TCP Sockets, mDNS (Zeroconf) for local network discovery and telemetry transmission
- **CLI / Backend**: Go

## Architecture Overview

- The **Go CLI** runs on a machine and exposes a TCP service, advertising itself over mDNS. It regularly sends telemetry data (e.g., every 5 seconds).
- The **React Native App** acts as the client. It uses `SyncService` and `DiscoveryService` to search for the mDNS service on the local network, connect via TCP, handle heartbeats, and receive telemetry from the CLI.

## Rules & Guidelines

- **Source of Truth**: Always reference [docs/CogniStaff.md](file:///Users/gyandeeps/code/CogniStaff/docs/CogniStaff.md) for architectural plans, data schemas, and implementation details when planning or executing a task.
- Whenever updating the Go CLI (`cli/main.go`), remember to ensure `go.mod` and `go.sum` are synchronized.
- TCP heartbeat mechanisms are used to determine connection liveness and handle automatic reconnections without duplicating logs or connections.
- Ensure that you use Expo-compatible networking modules and follow best practices for React Native lifecycle management when creating new components in the `app/` and `src/services/` directories.

## Interaction Style

- **Detailed Reasoning**: Always explain the "why" and "how" behind your logic and code changes in your final response.
- **Thoughtful Actions**: Provide a detailed summary of your thinking and the steps you intend to take before executing them.
- **Verbose Output**: Prefer thorough, educational explanations over concise ones.
- **Plan Alignment**: Ensure every implementation plan explicitly refers to the roadmap and "Definition of Done" found in [docs/CogniStaff.md](file:///Users/gyandeeps/code/CogniStaff/docs/CogniStaff.md).
