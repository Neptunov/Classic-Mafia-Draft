# Classic Mafia Draft App - Tournament Edition

A professional-grade, multi-table draft management system for Classic Mafia.

## 🚀 LAN Setup
1. Find your IPv4 Address (`ipconfig` in CMD).
2. Start Backend: `cd server && npm run dev`
3. Start Frontend: `cd client && npm run dev`
4. Access via: `http://[YOUR_IP]:5173`

## 📡 Room Management
- **Admins** create tables (e.g., "Table 1", "Finals") via the Dashboard.
- **Players** select the table from a dropdown in the Lobby.
- **Streams** connect via `/stream` and appear in the "Stream Overlays" tab for assignment.

## 🔑 Security
- **Admin Password:** mafia
- **Role Locking:** Prevents room deletion or configuration changes once a draft is ready.

## 🃏 The Draft Experience
1. **The Tray:** Players are presented with a 2x5 grid of hidden cards.
2. **The Pick:** A player taps a card for an instant, tactile selection.
3. **The Reveal:** The card physically flips on the screen to reveal their role in secret.
4. **The Judge:** The Judge's control panel instantly updates with the player's seat, card number, and color-coded role.
5. **Tournament Integrity:** The underlying deck is never sent over the network. State payloads are strictly sanitized to prevent inspection cheating.

## 📝 Changelog

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
- **Race Condition Guardrails:** 
	1. The server strictly rejects delayed FORCE_PICK commands if the player has already manually tapped a card while the Judge's confirmation popup was open.
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