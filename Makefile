# Makefile for Verve Project

.PHONY: build run clean format help ios android start android-preview ios-preview update-preview

# Project Settings
CLI_DIR = ./cli
BINARY_NAME = verve-cli
BUILD_OUT = $(CLI_DIR)/$(BINARY_NAME)
EXPO = EXPO_NO_TELEMETRY=1 npx expo
EAS = npx eas
MSG ?= [$(shell git rev-parse --short HEAD)] $(shell git log -1 --pretty=%s)
NODE = node

# Default target
all: help

# --- SETUP COMMANDS ---

# Setup the development environment
setup:
	@echo "🛠️  Setting up Verve development environment..."
	@npm install
	@cd $(CLI_DIR) && go mod tidy
	@echo "✅ Setup complete. Run 'make help' for next steps."

# --- CLI COMMANDS ---

# Build the Go CLI binary for current OS (macOS)
build:
	@echo "🍎 Building Verve Shadow CLI (macOS)..."
	@cd $(CLI_DIR) && CGO_ENABLED=1 go build -o $(BINARY_NAME) .
	@echo "✅ Build complete: $(BUILD_OUT)"

# Build for Windows (AMD64)
# Note: Requires a cross-compiler if running on macOS
build-win:
	@echo "🪟 Building Verve Shadow CLI (Windows)..."
	@cd $(CLI_DIR) && GOOS=windows GOARCH=amd64 CGO_ENABLED=1 go build -o $(BINARY_NAME).exe .
	@echo "✅ Build complete: $(CLI_DIR)/$(BINARY_NAME).exe"

# Run the CLI
run: build
	@echo "🚀 Starting Verve Shadow CLI..."
	@cd $(CLI_DIR) && ./$(BINARY_NAME)

# --- MOBILE HUB COMMANDS ---

# Run the iOS application (Native Build)
ios:
	@echo "📱 Launching Verve Mobile Hub (iOS)..."
	$(EXPO) run:ios

# Run the Android application (Native Build)
android:
	@echo "🤖 Launching Verve Mobile Hub (Android)..."
	$(EXPO) run:android

# Build the Android application for preview (EAS)
android-preview:
	@echo "🛰️  Capturing manifest state..."
	@cp app.json app.json.bak
	@trap 'mv app.json.bak app.json' EXIT; \
	echo "🛰️  Injecting build metadata into app.json..."; \
	node -e "const fs = require('fs'); const app = JSON.parse(fs.readFileSync('app.json', 'utf8')); app.expo.extra = { ...app.expo.extra, gitCommitSha: '$(shell git rev-parse HEAD)' }; fs.writeFileSync('app.json', JSON.stringify(app, null, 2) + '\n');"; \
	echo "🤖 Building Verve Mobile Hub for Android (Preview)..."; \
	$(EAS) build --platform android --profile preview

# Build the iOS application for preview (EAS)
ios-preview:
	@echo "🛰️  Capturing manifest state..."
	@cp app.json app.json.bak
	@trap 'mv app.json.bak app.json' EXIT; \
	echo "🛰️  Injecting build metadata into app.json..."; \
	node -e "const fs = require('fs'); const app = JSON.parse(fs.readFileSync('app.json', 'utf8')); app.expo.extra = { ...app.expo.extra, gitCommitSha: '$(shell git rev-parse HEAD)' }; fs.writeFileSync('app.json', JSON.stringify(app, null, 2) + '\n');"; \
	echo "🍎 Building Verve Mobile Hub for iOS (Preview)..."; \
	$(EAS) build --platform ios --profile preview

# Push a JS/Asset update to all testers (EAS Update)
# Usage: make update-preview MSG="Your update message"
update-preview:
	@echo "🛰️  Capturing manifest state..."
	@cp app.json app.json.bak
	@trap 'mv app.json.bak app.json' EXIT; \
	echo "🛰️  Injecting update metadata into app.bundle..."; \
	node -e "const fs = require('fs'); const app = JSON.parse(fs.readFileSync('app.json', 'utf8')); app.expo.extra = { ...app.expo.extra, gitCommitSha: '$(shell git rev-parse HEAD)' }; fs.writeFileSync('app.json', JSON.stringify(app, null, 2) + '\n');"; \
	echo "🛰️  Deploying JS update to preview branch..."; \
	$(EAS) update --branch preview --environment preview --message "$(MSG)"

# Start the Expo Dev Server
start:
	@echo "🛰️  Starting Expo Dev Server..."
	$(EXPO) start --dev-client

# --- MAINTENANCE ---
clean:
	@echo "🧹 Cleaning up binaries..."
	@rm -f $(BUILD_OUT)
	@rm -f $(CLI_DIR)/$(BINARY_NAME).exe

# Format code (Go & Prettier)
format:
	@echo "✨ Formatting React Native source..."
	@npm run format
	@echo "✨ Formatting Go source..."
	@cd $(CLI_DIR) && go fmt ./...

# Bump version (patch + versionCode)
bump-version:
	@echo "🚀 Bumping app version and versionCode..."
	@$(NODE) ./scripts/bump-version.mjs
	@echo "📦 Updating lock file..."
	@npm install
	@echo "✨ Version bump complete."

# Help menu
help:
	@echo "Verve Project - Command Interface"
	@echo "--------------------------------"
	@echo "CLI (Shadow Service):"
	@echo "  make build     - Build the Go CLI binary for macOS (requires CGO)"
	@echo "  make build-win - Build the Go CLI binary for Windows (requires MinGW)"
	@echo "  make run       - Build and launch the tracker locally"
	@echo "  make clean     - Remove compiled binaries"
	@echo "  make format    - Run 'go fmt' and 'npm run format'"
	@echo ""
	@echo "Mobile (The Brain):"
	@echo "  make ios           - Run iOS app (Native Build & Metro)"
	@echo "  make android       - Run Android app (Native Build & Metro)"
	@echo "  make start           - Start Expo development server"
	@echo "  make android-preview - Build Android preview using EAS"
	@echo "  make ios-preview     - Build iOS preview using EAS"
	@echo "  make update-preview  - Push JS/Asset update to preview channel"
	@echo "  make bump-version    - Increment version (patch) and Android versionCode"
