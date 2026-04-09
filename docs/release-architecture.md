# Verve CLI Release Architecture

## 1. Overview

The Verve CLI release system follows a **private-source, public-distribution** model. Source code lives in a private repository, while compiled binaries are published to a public repository for frictionless installation via native package managers. Mobile app builds are handled separately via **EAS Build** and are not part of this pipeline.

```mermaid
graph LR
    subgraph Private ["🔒 gyandeeps/verve (Private)"]
        direction TB
        Build["Build CLI Binaries"]
        Archive["Package Archives + SHA256"]
        Build --> Archive
    end

    subgraph Public ["🔓 gyandeeps/verve-releases (Public)"]
        Release["GitHub Release<br/>with .tar.gz / .zip assets"]
    end

    subgraph Tap ["🔓 gyandeeps/homebrew-tap"]
        Formula["verve-cli.rb"]
    end

    subgraph Bucket ["🔓 gyandeeps/scoop-verve"]
        Manifest["verve-cli.json"]
    end

    Archive -->|"Create release +<br/>upload assets"| Release
    Archive -->|"Dispatch: update formula"| Formula
    Archive -->|"Dispatch: update manifest"| Manifest

    Release -->|"brew install"| Mac["🍎 macOS User"]
    Release -->|"scoop install"| Win["🪟 Windows User<br/>(Scoop)"]
    Release -->|"Direct .exe download"| WinDirect["🪟 Windows User<br/>(Manual)"]
    Formula -.->|"points download URL to"| Release
    Manifest -.->|"points download URL to"| Release

    style Private fill:#0f172a,stroke:#f87171,stroke-width:2px,color:#f8fafc
    style Public fill:#0f172a,stroke:#34d399,stroke-width:2px,color:#f8fafc
    style Tap fill:#1e293b,stroke:#fbbf24,stroke-width:2px,color:#f8fafc
    style Bucket fill:#1e293b,stroke:#818cf8,stroke-width:2px,color:#f8fafc
```

## 2. Repository Map

| Repository                 | Visibility | Role                  | Contents                                              |
| :------------------------- | :--------- | :-------------------- | :---------------------------------------------------- |
| `gyandeeps/verve`          | 🔒 Private | Source of truth       | Go source, React Native app, CI/CD workflows, docs    |
| `gyandeeps/verve-releases` | 🔓 Public  | Binary distribution   | GitHub Releases with `.tar.gz`, `.zip`, `.exe` assets |
| `gyandeeps/homebrew-tap`   | 🔓 Public  | macOS package index   | `Formula/verve-cli.rb` + auto-update workflow         |
| `gyandeeps/scoop-verve`    | 🔓 Public  | Windows package index | `bucket/verve-cli.json` + auto-update workflow        |

## 3. Release Artifacts

Each release produces the following artifacts, all attached to a single GitHub Release on `verve-releases`:

| Artifact                        | Platform | Arch          | Format   | Distribution Channel   |
| :------------------------------ | :------- | :------------ | :------- | :--------------------- |
| `verve-cli-darwin-amd64.tar.gz` | macOS    | Intel         | tar.gz   | Homebrew               |
| `verve-cli-darwin-arm64.tar.gz` | macOS    | Apple Silicon | tar.gz   | Homebrew               |
| `verve-cli-windows-amd64.zip`   | Windows  | x64           | zip      | Scoop                  |
| `verve-cli-windows-amd64.exe`   | Windows  | x64           | exe      | Direct download        |
| `*.sha256`                      | —        | —             | checksum | Integrity verification |

## 4. Distribution Channels

### 4.1 macOS — Homebrew (Custom Tap)

```bash
brew install gyandeeps/tap/verve-cli        # Install
brew services start verve-cli                # Run as background daemon
brew upgrade verve-cli                       # Upgrade to latest
```

- **Tap repo:** `gyandeeps/homebrew-tap` → tap name `gyandeeps/tap`
- **Formula:** `Formula/verve-cli.rb` with architecture-specific `url` and `sha256`
- **Service support:** Homebrew `service` block enables `brew services start/stop` for auto-start on boot

### 4.2 Windows — Scoop (Custom Bucket)

```powershell
scoop bucket add verve https://github.com/gyandeeps/scoop-verve
scoop install verve-cli                      # Install
scoop update verve-cli                       # Upgrade to latest
```

- **Bucket repo:** `gyandeeps/scoop-verve`
- **Manifest:** `bucket/verve-cli.json` with `checkver` + `autoupdate` for self-updating

### 4.3 Windows — Direct Download

```
https://github.com/gyandeeps/verve-releases/releases/latest
```

The standalone `verve-cli-windows-amd64.exe` is attached to every release. No package manager required — download and run.

## 5. CI/CD Pipeline

### 5.1 Workflow: `Release Verve CLI`

- **Trigger:** Manual `workflow_dispatch` with optional version tag (e.g., `v1.2.0`)
- **Location:** `.github/workflows/release.yml` in `gyandeeps/verve`
- **Scope:** CLI builds only. Mobile builds are handled via EAS Build.

### 5.2 Job Dependency Graph

```mermaid
graph TD
    Trigger["workflow_dispatch<br/>(version: v1.2.0)"]

    MacBuild["build-cli-macos<br/>(macos-latest)"]
    WinBuild["build-cli-windows<br/>(ubuntu-latest)"]
    Release["create-release<br/>(ubuntu-latest)"]
    PkgMgr["update-package-managers<br/>(ubuntu-latest)"]

    Trigger --> MacBuild
    Trigger --> WinBuild
    MacBuild --> Release
    WinBuild --> Release
    Release --> PkgMgr

    PkgMgr -->|"repository_dispatch"| Tap["homebrew-tap<br/>update.yml"]
    PkgMgr -->|"repository_dispatch"| Bucket["scoop-verve<br/>update.yml"]

    style Trigger fill:#1e293b,stroke:#fbbf24,color:#f8fafc
    style MacBuild fill:#1e293b,stroke:#38bdf8,color:#f8fafc
    style WinBuild fill:#1e293b,stroke:#38bdf8,color:#f8fafc
    style Release fill:#1e293b,stroke:#34d399,color:#f8fafc
    style PkgMgr fill:#1e293b,stroke:#c084fc,color:#f8fafc
    style Tap fill:#0f172a,stroke:#fbbf24,color:#f8fafc
    style Bucket fill:#0f172a,stroke:#818cf8,color:#f8fafc
```

### 5.3 Pipeline Steps

| Step | Job                       | Action                                                                |
| :--- | :------------------------ | :-------------------------------------------------------------------- |
| 1    | `build-cli-macos`         | Compile Go binaries (amd64 + arm64) with `-ldflags` version injection |
| 2    | `build-cli-macos`         | Package `.tar.gz` archives + compute SHA256 checksums                 |
| 3    | `build-cli-windows`       | Cross-compile Go binary (amd64) via MinGW                             |
| 4    | `build-cli-windows`       | Package `.zip` archive + compute SHA256 checksum                      |
| 5    | `create-release`          | Download all artifacts, create GitHub Release on `verve-releases`     |
| 6    | `update-package-managers` | Extract checksums, dispatch updates to tap + bucket repos             |
| 7    | _(homebrew-tap)_          | Receive dispatch, update formula version/URLs/hashes, commit          |
| 8    | _(scoop-verve)_           | Receive dispatch, update manifest version/URL/hash, commit            |

### 5.4 End-to-End Release Flow

```mermaid
sequenceDiagram
    actor Dev as Developer
    participant Verve as 🔒 gyandeeps/verve<br/>(Private)
    participant Releases as 🔓 gyandeeps/verve-releases<br/>(Public)
    participant Tap as 🔓 gyandeeps/homebrew-tap
    participant Bucket as 🔓 gyandeeps/scoop-verve

    Dev->>Verve: Trigger workflow_dispatch (v1.2.0)
    activate Verve
    Verve->>Verve: Build macOS CLI (amd64 + arm64)
    Verve->>Verve: Build Windows CLI (amd64)
    Verve->>Verve: Package archives + SHA256 + raw .exe
    Verve->>Releases: Create Release v1.2.0 + upload assets
    Verve->>Tap: repository_dispatch (version, checksums)
    Verve->>Bucket: repository_dispatch (version, checksum)
    deactivate Verve

    activate Tap
    Tap->>Tap: Update verve-cli.rb (version, URLs, hashes)
    Tap->>Tap: git commit + push
    deactivate Tap

    activate Bucket
    Bucket->>Bucket: Update verve-cli.json (version, URL, hash)
    Bucket->>Bucket: git commit + push
    deactivate Bucket

    Note over Releases,Bucket: Users can now install/upgrade immediately
```

## 6. Security Model

| Concern                   | Solution                                                                             |
| :------------------------ | :----------------------------------------------------------------------------------- |
| Source code exposure      | Source stays in private `verve` repo. Only compiled binaries are published.          |
| Cross-repo authentication | Fine-Grained PAT (`RELEASE_GITHUB_TOKEN`) scoped to 3 public repos only.             |
| Binary integrity          | SHA256 checksums generated at build time, verified by Homebrew and Scoop on install. |
| Token scope               | PAT has no access to the private `verve` repo. CI uses implicit `GITHUB_TOKEN`.      |

## 7. Separation of Concerns

| Domain                     | Tool                                 | Trigger                              |
| :------------------------- | :----------------------------------- | :----------------------------------- |
| **CLI Release**            | GitHub Actions (`Release Verve CLI`) | Manual `workflow_dispatch`           |
| **Mobile Build (Android)** | EAS Build                            | `make android-preview` / `eas build` |
| **Mobile Build (iOS)**     | EAS Build                            | `make ios-preview` / `eas build`     |
| **Mobile OTA Update**      | EAS Update                           | `make update-preview` / `eas update` |

## 8. Rolling Back / Taking Down a Release

Since the release pipeline is optimized for forward distribution, "taking down" a release requires manual intervention across the public repositories.

### 8.1 Manual Teardown Procedure

1. **Homebrew Tap (`gyandeeps/homebrew-tap`):**
   - Edit `Formula/verve-cli.rb`.
   - Revert the `version`, `url`, and `sha256` hashes to the previous stable state.
   - Commit the change to ensure users are "downgraded" on their next `brew upgrade`.
2. **Scoop Bucket (`gyandeeps/scoop-verve`):**
   - Edit `bucket/verve-cli.json`.
   - Revert the `version` and `hash`.
3. **Release Assets (`gyandeeps/verve-releases`):**
   - Delete the offending GitHub Release and its associated Git Tag.
4. **Local/Private Cleanup (`gyandeeps/verve`):**
   - Delete the tag locally and on remote to prevent future conflicts:
     ```bash
     git tag -d vX.Y.Z
     git push origin :refs/tags/vX.Y.Z
     ```

### 8.2 "Fix Forward" vs. Rollback

In standard scenarios, it is **strongly recommended to fix forward** (releasing a new version, e.g., `v1.2.1` to fix `v1.2.0`) rather than rolling back. This ensures:

- Users' package managers automatically detect the update.
- Immutable history is maintained.
- Checksum mismatch errors are avoided for users who already have the "bad" version cached.
