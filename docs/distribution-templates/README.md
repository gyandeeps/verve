# External Repository Templates

This directory contains template files for the three public repositories needed for the Verve CLI distribution pipeline. Copy these into the respective repos when you create them on GitHub.

## Repository Setup

### 1. `gyandeeps/verve-releases` (Public)

- Copy `verve-releases-README.md` as the repo's `README.md`
- No other files needed — releases are created by CI

### 2. `gyandeeps/homebrew-tap` (Public)

- Copy `homebrew-tap/Formula/verve-cli.rb`
- Copy `homebrew-tap/.github/workflows/update.yml`

### 3. `gyandeeps/scoop-verve` (Public)

- Copy `scoop-verve/bucket/verve-cli.json`
- Copy `scoop-verve/.github/workflows/update.yml`
