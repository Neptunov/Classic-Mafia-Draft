# Classic Mafia Draft App - Tournament Edition

A professional-grade, multi-table draft management system for Classic Mafia.

### 📦 Installation & Deployment
1. Clone the repository.
2. Run `npm install` in both the `/client` and `/server` directories.
3. Build the frontend for production: `cd client && npm run build`
4. Start the server: `cd server && npm run start`
5. Open your browser to the provided local address (e.g., `http://localhost:3000`) and complete the web-based initialization to securely create your master password!

## 🗺️ Development Roadmap

The application is currently in the pre-release development phase, focusing on iterative architectural and visual updates.

* **v0.2.0:** Admin Console Rework (Finalizing the UI/UX update phase).
* **v0.2.1 - v0.3.0: Security Implementation.** Focus on encrypting all communications between the React frontend and Node backend. Includes hashing all sensitive information stored on the local machine to protect against state corruption or external modification.
* **v1.0.0: Stable Release.** Final functional version. Includes the packaging of the application into standard executable/installer formats, deprecating the CMD launch requirement.

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

*Note: This project utilizes AI assistance for syntax generation, layout optimization, and debugging. Core application logic and system design are directed by the human developer.*