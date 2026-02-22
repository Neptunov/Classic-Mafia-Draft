# Classic Mafia Draft App

A real-time, server-dictated web application built for drafting and assigning roles in Classic Mafia tournaments. Designed for both multi-device setups and single-device "pass-and-play" environments.

## 🏗 Architecture

This project uses a Server-Dictated Architecture powered by WebSockets. Clients do not hold authoritative game state; they act strictly as "dumb terminals" that render whatever view the Node.js server assigns to them.

* **Backend:** Node.js, Express, Socket.io
* **Frontend:** React, Vite, React Router v6

## ✨ Features

* **Admin Orchestration:** All devices connect to a central Lobby. An authenticated Admin explicitly assigns each device to be a Player Tray, a Judge Control, or a Stream Overlay.
* **Session Persistence:** Devices generate a local `deviceId`. If a tablet's browser refreshes or the Wi-Fi drops, the server instantly remembers its role and game state upon reconnection.
* **Pass-and-Play Budget Mode:** The Player Tray enforces privacy. Players pick a card, memorize their color-coded role (Citizen, Sheriff, Mafia, Don) on a locked screen, and hide it before passing the tablet to the next seat.
* **OBS Stream Overlay:** A dedicated `/stream` route provides a transparent, auto-hiding, queued CSS animation overlay for live broadcast integration. It gracefully handles rapid-fire role reveals without skipping.
* **Judge Guardrails:** Strict server-side state locks prevent the draft from starting before roles are locked, and includes "Force Pick" and "Reset" features for tournament mistakes.

## 🚀 How to Run Locally

You will need two terminal windows to run the frontend and backend simultaneously.

**1. Start the Server (Backend)**
```bash
cd server
npm install
npm run dev
```
Runs on http://localhost:3001

**2. Start the Client (Frontend)**
```bash
cd client
npm install
npm run dev
```
Runs on http://localhost:5173

**🔐 Default Credentials**
Admin Password: mafia