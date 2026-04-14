# Contributing to Verve

Thank you for your interest in contributing to **Verve**! We’re building a premium, clinical-grade telemetry system, and we welcome contributions from the community to help make it more robust, secure, and insightful.

This guide will help you get started with our development environment and contribution workflows.

---

## 🏛️ Project Architecture

Verve consists of two main components:

1.  **Workstation (Shadow CLI)**: A Go-based agent that runs on your machine, captures telemetry, and buffers it in a local SQLite outbox.
2.  **Mobile Hub**: A React Native (Expo) app that discovers the CLI over the local network and synchronizes telemetry into a unified health database.

---

## 🚀 Setting Up Your Environment

### Prerequisites

- **Node.js**: v24 (LTS recommended). Use `.nvmrc` with `nvm use`.
- **Go**: v1.26 or higher.
- **Expo CLI**: Installed via `npm install`.
- **Make**: Used for orchestrating the build system.

### Initial Setup

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/gyandeeps/verve.git
    cd verve
    ```
2.  **Run the Setup Command**:
    ```bash
    # This installs mobile dependencies and tidies Go modules
    make setup
    ```

---

## 🛠️ Development Workflow

We use a root `Makefile` to simplify common tasks. Always run commands from the project root.

### Common Commands

- `make run`: Launch the Go Shadow CLI in development mode.
- `make start`: Start the Expo Metro bundler.
- `make ios`: Build and run the iOS application (requires macOS/Xcode).
- `make android`: Build and run the Android application (requires Android Studio).

### Branching Strategy

- **`main`**: The stable branch. Do not push directly to `main`.
- **Feature Branches**: Create a branch for your work: `git checkout -b feature/your-feature-name`.

---

## 🎨 Coding Standards

### TypeScript / React Native

- **Styling**: Follow the "Clinical Console" guidelines in `docs/design-system.md`. Use premium, monospaced aesthetics.
- **Formatting**: Run `npm run format` (Prettier) before committing.
- **Type Safety**: Ensure your changes pass type checking:
  ```bash
  npx tsc --noEmit
  ```

### Go (CLI)

- **Formatting**: Use `go fmt ./...` for consistent styling.
- **Safety**: Ensure all database transactions utilize the outbox pattern to prevent telemetry loss during network partitions.

---

## 📝 Commit Guidelines

We prefer descriptive, imperative commit messages. If possible, follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

- `feat: add recovery efficiency calculation`
- `fix: resolve mDNS binding on VPN interfaces`
- `docs: update biometric correlation roadmap`

---

## 📥 Submitting a Pull Request

1.  **Fork the repo** and create your branch from `main`.
2.  **Verify your changes**: Ensure the app builds and the CLI runs without errors.
3.  **Update Documentation**: If you add a new metric or feature, update the relevant files in `/docs`.
4.  **Open the PR**: Provide a clear description of the changes and any testing performed.
5.  **Review**: At least one maintainer must review and approve your PR before merging.

---

## 🛡️ Security

If you discover a security vulnerability, please do **not** open a public issue. Instead, refer to our [SECURITY.md](SECURITY.md) (coming soon) or contact the maintainers directly.

---

## 📜 License

By contributing to Verve, you agree that your contributions will be licensed under the project's [LICENSE](LICENSE).
