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
2. **The Pick:** A player taps a card and confirms their choice.
3. **The Reveal:** The card physically flips on the screen to reveal their role in secret.
4. **The Judge:** The Judge's control panel instantly updates with the player's seat, card number, and color-coded role.
5. **Tournament Integrity:** The underlying deck is never sent over the network. State payloads are strictly sanitized to prevent inspection cheating.