# Classic Mafia Draft App

A multi-device draft management system for Classic Mafia tournaments.

## 📦 Installation & Deployment
1. Clone the repository.
2. Run `npm install` in both the `/client` and `/server` directories.
3. Build the frontend for production: `cd client && npm run build`
4. Start the server: `cd server && npm run start`
5. Access the local address (e.g., `http://localhost:3000`) to initialize the master password via the setup interface.

## 🗺️ Development Roadmap

The application is currently in the pre-release development phase, focusing on iterative architectural and visual updates.

* **v0.1.1 - v0.2.0: UI/UX Overhaul.** Gradual refinement of all graphical user interfaces. Updates will be pushed sequentially, one view at a time.
* **v0.2.1 - v0.3.0: Security Implementation.** Focus on encrypting all communications between the React frontend and Node backend. Includes hashing all sensitive information stored on the local machine to protect against state corruption or external modification.
* **v1.0.0: Stable Release.** Final functional version. Includes the packaging of the application into standard executable/installer formats, deprecating the CMD launch requirement.

## 🏗️ Architecture

- **Room Management:** Admins create isolated socket rooms via the Dashboard. Client devices select their designated room during the Lobby registration phase.
- **State Synchronization:** The game deck and role assignments are managed strictly server-side. Payloads broadcasted to clients are sanitized to prevent unauthorized inspection via browser developer tools.
- **Stream Integration:** Broadcast overlays connect via the `/stream` route and require manual Admin verification to assign them to specific socket rooms.

## 📝 Changelog

**v0.1.2: Lobby UI & Localization**
- Replaced the legacy Lobby view with a responsive, Flexbox-based interface.
- Extracted static strings into `src/locales/en.js` to prepare for future localization.
- Refactored global CSS into modular, component-specific stylesheets.

**v0.1.1a: Asset Implementation**
- Integrated standard asset pipeline for local rendering of playing card images (`public/roles/`).

**v0.1.1: Visuals & Stability**
- Implemented web-based initialization for secure master password setup (`/setup`).
- Added layout alignment controls (Left, Center, Right) for stream overlays.
- Ensured session persistence by writing device states to `store.json`.
- Added standard CLI commands (`status`, `restart`, `shutdown`, `reset`) for server management.

**v0.1.0: Persistence & Security Update**
- Implemented native `fs` module storage to persist encrypted game states across reboots.
- Replaced hardcoded credentials with PBKDF2 cryptography.
- Added a security module to the Admin Dashboard for live password rotation.
- Standardized file structures and implemented JSDoc commentaries.

**v0.0.4: Stream Synchronization**
- Added an Audience Protection Timer to ensure stream overlays maintain visibility of the card independently of the player's dismissal speed.
- Implemented strict server-side rejection for delayed `FORCE_PICK` commands to prevent race conditions during rapid user input.

**v0.0.3: Tournament Integrity**
- Roles are mapped to server-side indices; the complete deck array is never broadcasted to clients.
- Implemented `PRIVATE_ROLE_REVEAL` events for targeted device updates.

**v0.0.2: Multi-Table Support**
- Implemented Socket.io room isolation to support concurrent tournament tables.
- Configured host routing to allow local network (0.0.0.0) device connections.

**v0.0.1:** Initial MVP

## ⚖️ Credits & Acknowledgements
**Project Engineering:** Dany Khomich
**Original Game Concept:** Dmitry Davidoff (1986)
**Rulesets:** FIIM (2013); iMafia (2022); MafGame (2023); EmotionGames (2024)

*Note: This project utilizes AI assistance for syntax generation, layout optimization, and debugging. Core application logic and system design are directed by the human developer.*