# Classic Mafia Draft App - Tournament Edition

A professional-grade, multi-table draft management system for Classic Mafia.

### 📦 Installation & Deployment
* **Windows (Recommended):** [Download Setup Installer](https://github.com/Neptunov/Classic-Mafia-Draft/releases/download/Installer/ClassicMafiaDraft_Setup.exe)
* **macOS (Apple Silicon):** [Download .dmg](https://github.com/Neptunov/Classic-Mafia-Draft/releases/latest/download/ClassicMafiaDraft-macOS-arm64.dmg)
* **macOS (Intel):** [Download .dmg](https://github.com/Neptunov/Classic-Mafia-Draft/releases/latest/download/ClassicMafiaDraft-macOS-x64.dmg)

## 🗺️ Development Roadmap (WIP, will be updated)

- [x] v0.1.0 - v0.1.3: Core draft logic, synchronized state, basic admin controls.
- [x] v0.2.0 - v0.2.4: Cryptographic logins, Streamer Mode (OBS), Single-Device Mode.
- [x] v0.3.0: The Storage Vault (WASM Reed-Solomon Erasure Coding, AES-GCM Encryption).
- [x] v0.3.1 - v0.3.3: Internationalization (Context Providers, RTL Support, RU/UK/HE Dictionaries).
- [x] v0.3.4: Hybrid HTTP Bridge & WebP Image Optimization Pipeline.
- [x] v0.3.5: The `.mafpack` Engine (`adm-zip` archiving, Pack import/export).
- [x] v0.3.6: Dynamic Pack Manager UI (Instant texture swapping via Admin Panel).
- [x] v0.4.0: The Cropping Studio (In-browser image editor, final compilation).
- [x] v0.4.1 - v0.5.0: Streamlined installation and update procedures for end-users, alongside a dedicated macOS port for native Apple Silicon execution.
- [ ] v1.0.0: Official Release (Post-beta testing and QA validation).

## 🏗️ Room Management
- **Admins** create tables (e.g., "Table 1", "Finals") via the Dashboard.
- **Players** select the table from a dropdown in the Lobby.
- **Streams** connect via `/stream` and appear in the "Stream Overlays" tab for assignment.

## 🃏 The Draft Experience
1. **The Tray:** Players are presented with a 2x5 grid of hidden cards.
2. **The Pick:** A player taps a card for an instant, tactile selection.
3. **The Reveal:** The card physically flips on the screen to reveal their role in secret.
4. **The Judge:** The Judge's control panel instantly updates with the player's seat, card number, and color-coded role.
5. **Tournament Integrity:** The underlying deck is never sent over the network. State payloads are strictly sanitized to prevent inspection cheating.

## 📝 Changelog

**v0.5.0: The Auto-Updater & Final Deployment Polish**
- Integrated a dynamic notification banner into the React Admin Dashboard. The system securely polls the GitHub Releases API on boot and alerts the tournament organizer when a newer version of the server is available.
- Engineered a frictionless update pipeline for Windows users via the `/api/system/apply-update` endpoint. With a single click, the server silently downloads the lightweight Inno Setup bootstrapper, gracefully shuts itself down, applies the update, and automatically reboots—all while rigorously protecting the user's `/storage` and custom `.mafpack` assets.
- Built OS-aware routing into the updater interface. Because macOS application bundles (`.app`) require manual drag-and-drop replacement, the UI smartly detects the host operating system and routes Mac organizers directly to the latest `.dmg` download page.
- Implemented a strict environment detection protocol (`isCompiled` flag). The auto-updater is completely disabled when running the application in local development mode (e.g., `npm run dev`), ensuring the live Git repository and working source code can never be accidentally overwritten by the production bootstrapper.

**v0.4.3: The macOS Native Build & Cross-Platform Architecture**
- Upgraded the GitHub Actions matrix to concurrently build and package the server for both `macOS x64` (Intel) and `macOS arm64` (Apple Silicon).
- Engineered a cloud-native shell pipeline that constructs strict Apple Application Bundles (`Classic Mafia Draft.app`). It automatically generates the required `Info.plist`, downloads the OS-specific Node engine, obfuscates the backend, and wraps everything into a distributable, mountable `.dmg` disk image.
- Completely rewrote the core pathing engine (`paths.js`). The server now detects its host operating system. On macOS, tournament state and `.mafpack` custom assets are securely saved to the system's `~/Library/Application Support/ClassicMafiaDraft` directory. This ensures organizers never lose their saved data when dragging a new `.app` version into their Applications folder.
- Built a custom bash launcher inside the `.app/Contents/MacOS` directory that seamlessly intercepts the user's double-click, silently booting the hidden, portable Node backend in the background.
- Established the distribution architecture for the Windows lightweight installer. The setup `.exe` now acts as a permanent bootstrapper that dynamically resolves and extracts the latest release directly from the GitHub API.

**v0.4.2: The Portable Deployment Engine & Smart Installer**
- Completely removed third-party bundlers in favor of downloading and wrapping official Node.js binaries. This guarantees 100% compatibility with native C++ modules (like `sharp`) and perfectly supports both 64-bit and 32-bit (x86) Windows systems.
- Engineered a GitHub Actions pipeline that automatically builds the React client, downloads the OS-specific Node engines, obfuscates the proprietary backend logic, and zips the releases natively in the cloud upon tagging.
- Integrated `javascript-obfuscator` into the CI/CD pipeline. All proprietary backend code (APIs, core logic, socket handlers) is now heavily encrypted and obfuscated in production releases to protect intellectual property, while cleanly bypassing third-party `node_modules`.
- Built a lightweight Inno Setup executable (`.iss`) that dynamically fetches the latest `.zip` release directly from the GitHub API. It features a safe-uninstall protocol that rigorously protects organizer data (`/storage` and `/assets/packs`) between updates.
- Transformed the raw production terminal into a stylized ASCII dashboard. On boot, the server now clears the boot sequence, fires a native Windows OS notification, and automatically opens the user's default web browser to the Admin Panel.
- Upgraded the `restart` CLI command. It now natively instructs Windows to spawn a brand-new, detached terminal window running the server before gracefully shutting down the current one.

**v0.4.0: The Cropping Studio & Asset Pipeline**
- Completely removed static image dependencies from the React frontend. The application now exclusively streams high-performance WebP textures from the server's `/active` vault, drastically reducing the client bundle size.
- The backend now intelligently monitors the active texture directory. If empty, it will automatically unpack the `fiimdefault.mafpack` base game assets from the secure `default_packs` vault on startup.
- Tournament organizers can now easily share custom `.mafpack` files. Added secure REST endpoints to natively download custom packs to the local hard drive, and a file-upload bridge to import community packs directly into the server.
- Integrated an in-browser image editor (`react-easy-crop` & HTML5 Canvas). Organizers can upload raw, high-resolution images, visually crop them to perfect Poker Card ratios (2.5:3.5), and instantly compile them into proprietary `.mafpack` archives without needing external photo editing software.
- Engineered a recursive dictionary merging utility. The UI will now gracefully fall back to English strings if the active language (e.g., Russian, Hebrew) is missing a newly added translation key, preventing application crashes.

**v0.3.6: Dynamic Pack Manager & Bug Fixes**
- Completely refactored the Admin Settings tab. Tournament organizers can now view a dynamically fetched list of installed `.mafpack` archives and instantly swap the active server textures via a clean dropdown interface.
- Upgraded the `Player` and `Stream` React components to listen to the global `activePack` state. The UI now dynamically routes image requests to the Express `/api/assets/active/` endpoint, instantly updating graphics across all devices without requiring a page refresh.
- Fixed an issue where the Stream overlay would accidentally reset its room assignment back to 'GLOBAL' upon a browser refresh.
- Fixed an RTL layout bug causing incorrect localization rendering for stream overlay alignment (Left/Center/Right) when Hebrew was the active language.

**v0.3.5: The `.mafpack` Archiving Engine**
- Integrated `adm-zip` to compile raw, optimized WebP textures from the server's temporary vault into distributable `.mafpack` files.
- The compilation engine automatically injects a `manifest.json` into every `.mafpack`, stamping it with a unique cryptographic ID, author name, and versioning metadata.
- Built a REST endpoint capable of extracting and purging the active texture directory. Admins can now instantly swap the server's live textures by unzipping a selected `.mafpack` directly into the Express static serving folder.

**v0.3.4: Custom Asset Engine - Phase 1 (The HTTP Bridge)**
- Engineered a token-exchange system allowing authenticated WebSocket sessions to request temporary, 256-bit cryptographic Bearer tokens. This enables secure REST API file uploads without exposing the server to unauthenticated POST requests.
- Integrated `multer` and `sharp` to intercept large image uploads in memory. The server strictly enforces a 10MB payload limit and utilizes WebAssembly to instantly compress assets into the highly optimized WebP format before committing them to the physical disk.
- Established a secure directory structure within the `/storage` vault (`/temp`, `/packs`, `/active`) to isolate user-generated content and prepare for `.mafpack` compilation.
- Performed a comprehensive codebase sweep, standardizing all backend core files with JSDoc headers and operational comments for long-term maintainability.

**v0.3.3: Dynamic Role Localization & Ukrainian Support**
- Fixed an edge case in the Judge Panel and Admin Dashboard where player roles (Citizen, Mafia, etc.) were bypassing the `LanguageContext` and rendering static server-side strings. Role displays now dynamically construct dictionary keys (e.g., `roleCitizen`) to support live language switching.
- Officially integrated the manual Ukrainian translation module (`ua.js`) into the global dictionary engine.

**v0.3.2: Localization & State Persistence**
- Officially added complete translation dictionaries for Hebrew (`he.js`). The application now fully supports Right-to-Left (RTL) DOM rendering and structural layout mirroring for Israeli users.
- Fixed a race condition where the active UI language would briefly default back to English upon browser refresh. The `LanguageContext` now caches the active dictionary in the browser's `localStorage` and synchronizes seamlessly with the Socket.io `connect` lifecycle.
- Swept the React component tree to identify and extract residual hardcoded text strings, ensuring 100% of the UI is governed by the dynamic dictionary engine.

**v0.3.1: The Internationalization (i18n) Engine**
- Engineered a React Context Provider (`LanguageContext.jsx`) that distributes centralized localization dictionaries to all connected UI components. Changes to the active language now trigger instantaneous, zero-refresh re-renders across all tablets and stream overlays.
- Swept the entire CSS architecture (`App.css`, `Admin.css`, etc.) to replace hardcoded directional properties (e.g., `padding-left`, `left`) with modern CSS Logical Properties (`padding-inline-start`, `insetInlineStart`). The browser DOM will now automatically mirror the entire application layout when Right-to-Left (RTL) languages like Hebrew are selected.
- Expanded the Super Admin Dashboard (`Admin.jsx`) with a new Settings tab. Tournament organizers can now remotely change the global language and prepare external URLs for the upcoming Custom Asset Engine (v0.3.6).
- The `core/state.js` storage vault was upgraded to persistently save the `globalSettings` object, ensuring language and asset selections survive server reboots and power losses.
- Added a complete, 1:1 translation dictionary (`ru.js`) alongside the base English module (`en.js`).

**v0.3.0: Data Resilience & The Storage Vault**
- Completely refactored the 1000+ line `index.js` into a scalable, domain-driven architecture (`/core` and `/socket` modules), isolating state management from network routing.
- Replaced the vulnerable `store.json` plaintext file with a physically secure vault. Tournament data is now encrypted using AES-256-GCM, with the cryptographic key mathematically derived from the host server's physical MAC address. Stolen data cannot be decrypted on a different machine.
- Implemented a WebAssembly engine (`@subspace/reed-solomon-erasure.wasm`) to shatter the encrypted tournament data into 4 Data Shards and 2 Parity Shards (`/storage/shard_X.dat`). The server can now mathematically recreate missing or corrupted data on boot if sector failures occur.
- Upgraded the disk writing pipeline to utilize Atomic Swaps (`.tmp` -> `.dat`). The server is now completely immune to data corruption caused by sudden power losses during disk I/O.
- Engineered a backwards-compatible upgrade pipeline that automatically intercepts legacy `store.json` files from v0.2.x, injects missing schema fields, upgrades them to Schema v2, and locks them into the new WASM vault.
- The backend terminal `reset` command now recursively destroys the sharded vault directory.

**v0.2.5: Cryptographic Cloaking & Omniscient Debugger**
- Implemented an impenetrable mathematical cloak over all Socket.io traffic. The application now uses the `P-256` Elliptic Curve to execute a Diffie-Hellman handshake, generating unique, military-grade AES-256 symmetric keys for every connected device.
- All gameplay events, including `PRIVATE_ROLE_REVEAL` and `JOIN_ROOM`, are mathematically invisible over the local network, preventing packet-sniffing tools like Wireshark from extracting tournament data.
- Engineered a global traffic interceptor that securely logs pre-encryption and post-decryption payloads natively in the console. Automatically activates when `package.json` includes a `-dev` tag, featuring automated credential redaction to prevent plaintext password leaks.
- Fixed a UI lifecycle bug where the Lobby and Setup pages failed to inherit the `isDebugMode` state from the backend.

**v0.2.4: Network Resilience (DDoS Protection)**
- Implemented a socket middleware throttle that automatically drops packets if a single client emits more than 20 events per second, neutralizing automated spam scripts.
- Added a strict IP ledger that rejects handshakes if a single device attempts to open more than 5 simultaneous WebSocket connections.
- Reduced the Socket.io maximum buffer size from 1MB down to 8KB to prevent server memory exhaustion from maliciously large payloads.

**v0.2.3: Input Sanitization (The Armor Patch)**
- Built a strict type-checking middleware for all WebSocket listeners. The server now actively drops malformed payloads, preventing crashes caused by unexpected data types.
- Implemented hard character limits on strings (e.g., Room Codes and Player Names) and integer constraints on game logic to protect server memory and array indexing.

**v0.2.2: Challenge-Response Auth & Rate Limiting**
- Replaced plaintext password transmission with a secure cryptographic challenge-response system, protecting the Admin login from local Wi-Fi packet sniffing.
- Implemented an IP-based rate limiter that automatically locks out devices for 10 minutes after 5 failed authentication attempts.
- Configured the Express server to automatically block DevTools access to frontend source code during production releases.

**v0.2.1: The Identity Patch (Session Hardening)**
- Replaced weak client-side ID generation with server-issued, 256-bit cryptographic hex tokens to prevent session hijacking.
- The Node server now actively rejects all non-localhost WebSocket connections until the Master Password is fundamentally established.
- Decoupled the React AuthContext from legacy backend listeners, strictly relying on server-authorized `ROLE_ASSIGNED` handshakes.

**v0.2.0: The Admin Console Update**
- Completely overhauled the Super Admin Dashboard (`Admin.jsx`) into a responsive sidebar architecture.
- Added live Overview Plates featuring dynamic draft timers and multi-table synchronization.
- Centralized the Security and Stream Management modules into global tabs.
- Implemented global `isDebugMode` toggle.
- Added a unified Connected Devices interface with IP tracking and integrated single-mode seat assignments.
- Engineered a Phantom Player generation system for testing rigid tournament constraints.
- Integrated a live Mini-Tray and Judge Results board into the detailed room management view.
- Added strict 10-player validation lock-outs for Single Mode tournament configurations.

**v0.1.6: Interactive Player Tray Overhaul**
- Completely redesigned the Player draft tray (`Player.jsx`) with a dynamic flex-grid architecture that automatically scales from a 2-row layout to a 1-row layout as cards are drawn.
- Implemented a high-resolution velvet texture background with dynamic CSS drop-shadows to create a physical, floating card illusion.
- Fixed a local React state desync to ensure the cinematic reveal overlay instantly closes when the Judge forces a remote dismissal.
- Built dormant "Single Mode" logic for upcoming individual-tablet tournament configurations.
- Added artist credentials for the UI textures.

**v0.1.5: Stream Overlay & Setup Polish**
- Overhauled the Stream overlay (`Stream.jsx`) to utilize the standard tournament dark-theme palette.
- Standardized the stream seat indicator to precisely match the active card's width.
- Refactored the Setup screen (`Setup.jsx`) to use global responsive card classes for a uniform initialization experience.
- Replaced static text in both views with locale dictionary references (`en.js`) for future internationalization.
- Renamed all updated view component files to standard component naming conventions (e.g., `SetupView.jsx` -> `Setup.jsx`).

**v0.1.4: Judge View Tracking UI**
- Overhauled the moderator panel into a responsive, dual-column layout.
- Replaced the variable grid with a strict 1-10 list format for professional role tracking.
- Implemented team-based background coloring (Red/Black) and role-based text coloring (Gold/White) for rapid night-phase reading.
- Added live tracking for the number of connected Judge profiles.

**v0.1.3: Admin UI & Schema Versioning**
- Overhauled the Admin Login interface to match the new responsive, dark-theme architecture.
- Implemented dynamic version rendering in the UI footers synced directly with `package.json`.
- Upgraded the backend storage engine to use manual Schema Versioning, protecting active tournament data from being wiped during minor UI patch updates.
- Fixed a React Router authentication context loop.

**v0.1.2: Lobby UI & Localization**
- Replaced the legacy Lobby view with a responsive, Flexbox-based interface.
- Extracted static strings into `src/locales/en.js` to prepare for future localization.
- Refactored global CSS into modular, component-specific stylesheets.

**v0.1.1a Patch: Authentic Deck Assets**
- **Visuals Upgrade:** Replaced the temporary placeholder role art with actual, high-quality scans of a physical Classic Mafia deck.

**v0.1.1: The Visuals & QoL Update**
- **Web-Based Initialization:** Moved the initial master password setup from the buggy Node terminal to a sleek, intercepted React web UI (`/setup`).
- **High-Fidelity Assets:** Replaced CSS-colored squares with a customizable local asset pipeline (`public/roles/`), featuring proportional 2.5x3.5 cards.
- **Stream Layout Controls:** Admins can now dynamically align individual stream overlays to the Left, Center, or Right thirds of the screen for seamless OBS integration.
- **Flawless Session Memory:** Fixed a bug where device sessions were kept in volatile memory; player and admin devices are now safely written to `store.json` and survive complete server reboots.
- **Responsive Player Grid:** The Player View now utilizes a strict mathematical CSS grid that maintains a perfect 5-column layout on desktop/tablets and scales cleanly to 2 columns on mobile.
- **Server QoL Commands:** Added `status`, `restart`, `shutdown`, and `reset` commands to the backend terminal for live tournament administration.

**v0.1.0 Beta: The Persistence & Security Update**
- **Persistent Storage Engine:** The backend now utilizes Node's native `fs` module to save encrypted game states to `store.json`. The server seamlessly recovers active tables and drafts after sudden power losses or reboots.
- **Master Security Module:** Hardcoded passwords have been replaced with PBKDF2 cryptography. Added a new "Security" tab in the Admin Dashboard for live password rotation.
- **Terminal CLI:** Added a command-line interface to the Node server allowing for secure, password-protected factory resets.
- **Crash-Proof React Dashboard:** Completely refactored the Admin View with modular rendering and optional chaining, eliminating race-condition crashes during rapid table creation.
- **Smart Session Memory:** Admin sockets are now cached in persistent memory. Page refreshes no longer wipe Admin privileges, and unauthorized sockets are intelligently kicked back to the Lobby.
- **Dynamic Versioning:** The backend engine now dynamically reads its version directly from `package.json` to ensure exact sync across the stack.
- **Codebase Standardization:** Scrubbed all files and implemented professional JSDoc block comments across the frontend and backend for open-source readability.

**v0.0.4 Alpha: Stream Polish & Draft Synchronization**
- **Audience Protection Timer:** The Stream Overlay now operates independently of the player's reading speed. If a player dismisses their role instantly, the stream strictly holds the 3D card on the OBS broadcast for a minimum of 2.5 seconds to guarantee audience legibility.
- **Streamlined Player UX:** Removed the "Confirm Pick" dialog. Cards now register picks instantly on tap and feature a CSS scale "squish" effect for immediate tactile feedback.
- **Dynamic Judge Controls:** The Judge's "Force Pick" button now dynamically transforms into a red "Close Card" button whenever a role is actively displayed. This allows the Judge to remotely dismiss a card on the player's tablet and stream overlay if a player walks away.
- **Race Condition Guardrails:** 1. The server strictly rejects delayed FORCE_PICK commands if the player has already manually tapped a card while the Judge's confirmation popup was open.
	2. The Stream Overlay relies purely on explicit CLEAR_STREAM signals rather than inferring closures from trailing state updates.

**v0.0.3 Alpha: Tournament Reveal and Security**
- **Hidden-Slot Architecture:** Roles are now mapped to specific tray slots on the server. The actual deck is never broadcasted to the clients, completely preventing browser DevTools snooping.
- **Private Role Reveals:** When a player clicks a card, the server sends a targeted PRIVATE_ROLE_REVEAL event exclusively to their tablet, triggering a 3D CSS flip animation.
- **Sanitized Admin Broadcasting:** The ROOMS_UPDATE payload is now scrubbed before being sent to the Super Admin Dashboard. Admins cannot see the deck unless isDebugMode is explicitly toggled on.
- **Smart "Force Pick":** The Judge's FORCE_PICK command now safely selects from remaining available slots and remotely triggers the 3D flip animation on the active Player's tablet.
- **UI/UX Enhancements:**
	1. Player View now forces a strict 2x5 grid and includes a "Confirm Pick" guardrail.
	2. Judge View now features color-coded role tracking (Red: Citizen, Black: Mafia/Don, Gold: Sheriff) for rapid reading during the night phase.
	3. Admin controls strictly lock the millisecond a draft leaves the PENDING state.
	
**v0.0.2 Alpha: Multi-Table LAN.**
- **Super Admin Dashboard:** A global management interface that uses a tabbed system to oversee multiple game rooms simultaneously.
- **Room Isolation:** Socket.io rooms are used to prevent data leakage between different tournament tables.
- **Stream Management:** A dedicated "Stream Overlays" tab handles pending broadcast sources, requiring Admin verification to link a specific OBS feed to a game table.
- **LAN Optimization:** Vite and Node.js are configured to broadcast over the local network (0.0.0.0), allowing any tablet or smartphone on the same Wi-Fi to participate.

**v0.0.1 Alpha:** Basic MVP

## ⚖️ Credits & Acknowledgements

**Project Architecture & Engineering:** Dany "Nolan" Khomich  
**Original Mafia Game Concept:** Dmitry Davidoff (1986)  
**Current Classic Mafia Rules:** FIIM (2013); iMafia (2022); MafGame (2023); EmotionGames (2024)
**UI Assets:** Velvet texture background designed by Freepik author @benzoix
**UI Localisation:** Ukrainian - Ezzyslav Malyshkin (2026)

*Note: This project utilizes AI assistance for syntax generation, layout optimization, and debugging. Core application logic and system design are directed by the human developer.*