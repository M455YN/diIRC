# Build and Release Instructions

This document describes the procedures for building the **Luna IRC** application locally and releasing new versions via GitHub Actions.

---

## 1. Local Development and Building

### Development Mode (Live Reload):
```bash
npm run tauri dev
```

### Local Build (Installers):
```bash
npm run tauri build
```
The compiled installers (e.g., Linux `.AppImage`/`.deb`/`.rpm` or Windows `.exe`/`.msi`) will be located in:
`src-tauri/target/release/bundle/`

---

## 2. Releasing a New Version

Application version numbers are kept in sync across three files:
- `package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`

### Standard Release Workflow:

1. **Run the release script:**
   ```bash
   npm run release
   ```
2. **Select the release type in the interactive prompt:**
   - `patch` (e.g., `0.1.2` -> `0.1.3`) – Bug fixes
   - `minor` (e.g., `0.1.2` -> `0.2.0`) – New features
   - `major` (e.g., `0.1.2` -> `1.0.0`) – Breaking changes

3. **Confirm and publish:**
   - `bumpp` updates version numbers in all 3 files, creates a version commit (e.g., `v0.1.3`), tags it, and prompts to push to GitHub.

---

## 3. Tagging Without a Version Commit (`--no-commit`)

By default, `bumpp` creates a new commit containing the updated version files before tagging. 

If you want to tag the **current commit** without creating a separate version bump commit:

- Run `bumpp` with the `--no-commit` (or `-c false`) flag:
  ```bash
  npx bumpp package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml --no-commit
  ```
- Alternatively, you can include custom flags in your `package.json` or pass custom commit messages:
  ```bash
  npx bumpp package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml -c "chore(release): %s"
  ```

> **Note:** When using `--no-commit`, version changes in `package.json`, `tauri.conf.json`, and `Cargo.toml` will remain as uncommitted changes in your working directory, while the Git tag will point directly to your existing commit.

---

## 4. GitHub Actions Automated Build

Pushing any tag matching `v*` (e.g., `v0.1.3`) triggers the [.github/workflows/release.yml](.github/workflows/release.yml) workflow:

1. GitHub Actions automatically builds installers for Windows and Linux.
2. A **Draft Release** with all installers attached will be generated under the **Releases** tab on GitHub.
3. When signing is configured (see Section 5), `tauri-action` creates `.sig` files and publishes `latest.json` to GitHub Releases for automatic in-app updates.

---

## 5. Automatic Updates Configuration (Tauri Signer)

Tauri v2 requires binary signature verification for security before installing updates.

### Setting up Signing Keys:

1. **Generate a signing keypair:**
   ```bash
   npx tauri signer generate
   ```
   Save the output public key and private key securely.

2. **Add Public Key to `tauri.conf.json`:**
   In `src-tauri/tauri.conf.json`:
   ```json
   "plugins": {
     "updater": {
       "pubkey": "YOUR_PUBLIC_KEY_HERE",
       "endpoints": [
         "https://github.com/TheStami/diIRC/releases/latest/download/latest.json"
       ]
     }
   }
   ```

3. **Add Secrets to GitHub Repository:**
   In your GitHub repository settings under **Settings > Secrets and variables > Actions**, add:
   - `TAURI_SIGNING_PRIVATE_KEY`: Content of your generated private key file (`.key`).
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: (Optional) Your private key password if you created one.

---

## 6. Fork Workflow: `skipahead` Channel (M455YN/diIRC)

### Branches
- `main` — mirror of `TheStami/main`. Never commit to it directly.
- `feature/*` — branched from `main`, so they can be sent upstream as PRs.
- `skipahead` — `main` + merged features. All fork releases are tagged here.

### Syncing with upstream
```bash
git fetch TheStami
git push origin TheStami/main:main
git checkout skipahead && git merge main   # merge, never rebase (published branch)
```

### Versioning
Skipahead versions are numeric prereleases of the **next** official version: `0.3.5-1`, `0.3.5-2`, …
In semver `0.3.5-N < 0.3.5`, so once the official `0.3.5` ships, users on the official channel get it as a normal update.
The prerelease part must be numeric (MSI requirement), so `0.3.5-skipahead.1` is not allowed.

```bash
powershell -File scripts/release-skipahead.ps1 0.3.5-2   # or VS Code task "Release: skipahead"
```

The script stashes local changes, switches to `skipahead`, pulls, validates that the version is newer,
bumps the 3 files, commits, tags `v0.3.5-2`, pushes, returns to the original branch and restores the
stash. It then waits until `latest.json` serves the new version. Leave the version empty to use the
next prerelease number. To rebuild an existing tag, run the VS Code task "Release: re-push tag".

The fork's workflow publishes the release immediately (no draft/prerelease) so that
`https://github.com/M455YN/diIRC/releases/latest/download/latest.json` points to it.

### Signing
Fork releases are signed with the fork's own key (public key in `UPDATE_CHANNELS.skipahead` in
`src/lib/update-service.ts`). Add the private key to **M455YN/diIRC → Settings → Secrets → Actions**
as `TAURI_SIGNING_PRIVATE_KEY` (password secret empty or unset).

### Update channels in the app
Settings → Updates → **Update channel**: `Official`, `Skipahead` or `Custom URL`. Each channel carries its own
endpoint and public key. After switching, the next check offers that channel's latest build even if it is
not newer (e.g. `0.3.5-2` → `0.3.4`); a backup is created before installing.

### How Updates Work Across Platforms:
- **AppImage (Linux) & EXE (Windows):** Fully automated in-app download, signature verification, installation, and application restart.
- **`.deb` Packages (Linux):** Since `.deb` packages are installed in root-owned system directories (`/usr/bin`), non-root applications cannot write to them directly. If an update is detected for a `.deb` installation, the app provides a convenient button to download the latest `.deb` package directly from GitHub Releases.

