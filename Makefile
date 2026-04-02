# Makefile for Verve Project

.PHONY: build run clean format help

# Project Settings
CLI_DIR = ./cli
BINARY_NAME = verve-cli
BUILD_OUT = $(CLI_DIR)/$(BINARY_NAME)
EXPO = npx expo

# Default target
all: help

# --- CLI COMMANDS ---

# Build the Go CLI binary with CGO enabled (required for macOS Frameworks)
build:
	@echo "🔨 Building Verve Shadow CLI..."
	@cd $(CLI_DIR) && CGO_ENABLED=1 go build -o $(BINARY_NAME) .
	@echo "✅ Build complete: $(BUILD_OUT)"

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

# Start the Expo Dev Server
start:
	@echo "🛰️  Starting Expo Dev Server..."
	$(EXPO) start --dev-client

# --- MAINTENANCE ---
clean:
	@echo "🧹 Cleaning up binary..."
	@rm -f $(BUILD_OUT)

# Format Go code
format:
	@echo "✨ Formatting Go source..."
	@cd $(CLI_DIR) && go fmt ./...

# Help menu
help:
	@echo "Verve Project - Command Interface"
	@echo "--------------------------------"
	@echo "CLI (Shadow Service):"
	@echo "  make build   - Build the Go CLI binary (requires CGO)"
	@echo "  make run     - Build and launch the tracker locally"
	@echo "  make clean   - Remove the compiled binary"
	@echo "  make format  - Run 'go fmt' on CLI source"
	@echo ""
	@echo "Mobile (The Brain):"
	@echo "  make ios     - Run iOS app (Native Build & Metro)"
	@echo "  make android - Run Android app (Native Build & Metro)"
	@echo "  make start   - Start Expo development server"
