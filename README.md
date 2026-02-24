# Classic Mafia Draft App - Tournament Edition

A professional-grade, multi-table draft management system for Classic Mafia.

### ⚙️ Installation & Deployment
1. Clone the repository.
2. Run `npm install` in both the `/client` and `/server` directories.
3. Build the frontend for production: `cd client && npm run build`
4. Start the server: `cd server && npm run start`
5. Open your browser to the provided local address (e.g., `http://localhost:3000`) and complete the web-based initialization to securely create your master password!

## 📡 Room Management
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

**v0.1.1a Patch: Authentic Deck Assets**
- **Premium Visuals:** Replaced the temporary placeholder role art with actual, high-quality scans of a physical Classic Mafia deck.

**v0.1.1: The Visuals & QoL Update**
This update replaces prototype UI with custom visuals and fixes several core persistence bugs.

**Key Additions & Fixes:**
- **Web-Based Initialization:** Moved the initial master password setup from the buggy Node terminal to a sleek, intercepted React web UI (`/setup`).
- **High-Fidelity Assets:** Replaced CSS-colored squares with a customizable local asset pipeline (`public/roles/`), featuring proportional 2.5x3.5 cards.
- **Stream Layout Controls:** Admins can now dynamically align individual stream overlays to the Left, Center, or Right thirds of the screen for seamless OBS integration.
- **Flawless Session Memory:** Fixed a bug where device sessions were kept in volatile memory; player and admin devices are now safely written to `store.json` and survive complete server reboots.
- **Responsive Player Grid:** The Player View now utilizes a strict mathematical CSS grid that maintains a perfect 5-column layout on desktop/tablets and scales cleanly to 2 columns on mobile.
- **Server QoL Commands:** Added `status`, `restart`, `shutdown`, and `reset` commands to the backend terminal for live tournament administration.

**v0.1.0 Beta: The Persistence & Security Update**
This major update transforms the application from a volatile memory script into a production-ready tournament server. 

**Key Architectural Changes:**
- **Persistent Storage Engine:** The backend now utilizes Node's native `fs` module to save encrypted game states to `store.json`. The server seamlessly recovers active tables and drafts after sudden power losses or reboots.
- **Master Security Module:** Hardcoded passwords have been replaced with PBKDF2 cryptography. Added a new "Security" tab in the Admin Dashboard for live password rotation.
- **Terminal CLI:** Added a command-line interface to the Node server allowing for secure, password-protected factory resets.
- **Crash-Proof React Dashboard:** Completely refactored the Admin View with modular rendering and optional chaining, eliminating race-condition crashes during rapid table creation.
- **Smart Session Memory:** Admin sockets are now cached in persistent memory. Page refreshes no longer wipe Admin privileges, and unauthorized sockets are intelligently kicked back to the Lobby.
- **Dynamic Versioning:** The backend engine now dynamically reads its version directly from `package.json` to ensure exact sync across the stack.
- **Codebase Standardization:** Scrubbed all files and implemented professional JSDoc block comments across the frontend and backend for open-source readability.

**v0.0.4 Alpha: Stream Polish & Draft Synchronization**

**Key Architectural Changes**
- **Audience Protection Timer:** The Stream Overlay now operates independently of the player's reading speed. If a player dismisses their role instantly, the stream strictly holds the 3D card on the OBS broadcast for a minimum of 2.5 seconds to guarantee audience legibility.
- **Streamlined Player UX:** Removed the "Confirm Pick" dialog. Cards now register picks instantly on tap and feature a CSS scale "squish" effect for immediate tactile feedback.
- **Dynamic Judge Controls:** The Judge's "Force Pick" button now dynamically transforms into a red "Close Card" button whenever a role is actively displayed. This allows the Judge to remotely dismiss a card on the player's tablet and stream overlay if a player walks away.
- **Race Condition Guardrails:** 1. The server strictly rejects delayed FORCE_PICK commands if the player has already manually tapped a card while the Judge's confirmation popup was open.
	2. The Stream Overlay relies purely on explicit CLEAR_STREAM signals rather than inferring closures from trailing state updates.

**v0.0.3 Alpha: Tournament Reveal and Security**

**Key Architectural Changes**
- **Hidden-Slot Architecture:** Roles are now mapped to specific tray slots on the server. The actual deck is never broadcasted to the clients, completely preventing browser DevTools snooping.
- **Private Role Reveals:** When a player clicks a card, the server sends a targeted PRIVATE_ROLE_REVEAL event exclusively to their tablet, triggering a 3D CSS flip animation.
- **Sanitized Admin Broadcasting:** The ROOMS_UPDATE payload is now scrubbed before being sent to the Super Admin Dashboard. Admins cannot see the deck unless isDebugMode is explicitly toggled on.
- **Smart "Force Pick":** The Judge's FORCE_PICK command now safely selects from remaining available slots and remotely triggers the 3D flip animation on the active Player's tablet.
- **UI/UX Enhancements:**
	1. Player View now forces a strict 2x5 grid and includes a "Confirm Pick" guardrail.
	2. Judge View now features color-coded role tracking (Red: Citizen, Black: Mafia/Don, Gold: Sheriff) for rapid reading during the night phase.
	3. Admin controls strictly lock the millisecond a draft leaves the PENDING state.
	
**v0.0.2 Alpha: Multi-Table LAN.**
 
**Key Architectural Changes**
- **Super Admin Dashboard:** A global management interface that uses a tabbed system to oversee multiple game rooms simultaneously.
- **Room Isolation:** Socket.io rooms are used to prevent data leakage between different tournament tables.
- **Stream Management:** A dedicated "Stream Overlays" tab handles pending broadcast sources, requiring Admin verification to link a specific OBS feed to a game table.
- **LAN Optimization:** Vite and Node.js are configured to broadcast over the local network (0.0.0.0), allowing any tablet or smartphone on the same Wi-Fi to participate.

**v0.0.1 Alpha:** Basic MVP

## 📝 Credits & Acknowledgements

**Project Architecture & Engineering:** Dany "Nolan" Khomich
**Original Mafia Game Concept:** Dmitry Davidoff (1986)
**Current Classic Mafia Rules:** FIIM (2013), 

**AI Assistance Disclaimer:**
This project was developed with the assistance of AI (Google Gemini). The AI was utilized as a pair-programming partner for syntax generation, debugging complex state race-conditions, and optimizing CSS Grid layouts. All core application logic, security architecture, and system design decisions were directed and reviewed by the human developer.