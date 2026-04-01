# Verve

Welcome to **Verve**! This project consists of two main components:

1. **Go CLI Backend**: An agent running on your local machine that advertises its presence via mDNS (zeroconf) and serves telemetry data over TCP.
2. **React Native Mobile App**: Built with Expo, this app automatically discovers the Go CLI on the local network and establishes a TCP heartbeat mechanism to stream and display telemetry data.

---

## 🧬 Why "Verve"?

**Verve** is often used to describe vitality and spirit, but in a biological context, it relates to the **nervous energy** that triggers the heart. 

As a project focused on quantifying cognitive load through heart rate and physiological signals, the name perfectly encapsulates the intersection of biological vitality and digital performance. It's concise, high-end, and reflects the premium nature of the application.

---

## 🚀 Quick Start

### 1. Running the Go CLI

The CLI is located in the `cli/` directory. You will need to have [Go](https://golang.org/doc/install) installed on your system.

**Installation & Execution**:

1. Navigate to the `cli` folder:
   ```bash
   cd cli
   ```
2. Resolve dependencies (if needed):
   ```bash
   go mod tidy
   ```
3. Run the CLI directly:
   ```bash
   go run main.go
   ```

The CLI will start an mDNS service (so the mobile app can find it) and begin broadcasting TCP telemetry data (typically every 5 seconds).

### 2. Running the Mobile App (Expo)

The React Native application lives at the root of the repository. You will need Node.js and an iOS/Android Simulator, or a physical device with the [Expo Go](https://expo.dev/client) app installed.

**Installation & Execution**:

1. At the root of the repository, install dependencies:
   ```bash
   npm install
   ```
2. Start the Expo development server:
   ```bash
   npm run ios
   ```
3. Press `i` to open the iOS simulator, `a` to open the Android emulator, or scan the QR code in the terminal with your phone using Expo Go (or the Camera app on iOS).

Once the app is running and your device/simulator is on the same local network as your Go CLI, the app will discover the CLI and begin receiving synchronization events.

---

## Architecture Overview

- **Networking**: Relies on TCP sockets (`react-native-tcp-socket`) for a persistent heartbeat connection, preventing duplicate logs and connections.
- **Discovery**: Utilizes `react-native-zeroconf` in the app and `grandcat/zeroconf` in Go for smooth local network discovery.
- **Frontend**: React Native with Expo Router for tab-based navigation.
