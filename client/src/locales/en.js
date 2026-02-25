/**
 * @file src/locales/en.js
 * @description English localization dictionary. 
 * Centralizes static text for the UI to support future internationalization (i18n).
 */
 
export const en = {
  lobby: {
    title: "Classic Mafia",
    subtitle: "Identify this device to join the draft",
    deviceLabel: "Device Name",
    devicePlaceholder: "e.g. Table 1 (iPad)",
    roomLabel: "Select Room",
    roomPlaceholder: "-- Select Tournament Room --",
    joinButton: "Join Lobby",
    waitingTitle: "Awaiting Host",
    waitingSubtitle: "Device '{device}' is registered in {room}. Waiting for role assignment...",
    cancelButton: "Cancel Registration",
    adminLogin: "Admin Login",
    connected: "Connected",
    disconnected: "Disconnected",
    debugActive: "Debug Mode Active"
  },
  login: {
    title: "Admin Portal",
    subtitle: "Authorized personnel only",
    passwordLabel: "Master Password",
    passwordPlaceholder: "Enter master password",
    authButton: "Authenticate",
    returnButton: "Return to Lobby",
    defaultError: "Invalid Password",
    connected: "Connected",
    disconnected: "Disconnected",
    debugActive: "Debug Mode Active"
  },
  judge: {
    title: "Moderator Panel",
    players: "Players: {count}/10",
    judges: "Judges: {count}",
    statusPending: "Status: PENDING",
    statusInProgress: "Status: DRAFTING",
    statusCompleted: "Status: COMPLETED",
    lockRoles: "Lock Roles",
    unlockRoles: "Unlock Roles",
    startDraft: "Start Draft",
    unlockTray: "Unlock Tray",
    forcePick: "Force Random Pick",
    forcePickConfirm: "Are you sure you want to force a random pick for the current seat?",
    closeCard: "Close Active Card",
    resetDraft: "Reset Draft",
    seat: "Seat {number}",
    emptySeat: "Waiting...",
    connected: "Connected",
    disconnected: "Disconnected",
    debugActive: "Debug Mode Active"
  },
  stream: {
    title: "Stream Source Connected",
    subtitle: "Waiting for Admin to assign a table...",
    ipLabel: "Source IP Address",
    seat: "Seat {number}"
  },
  setup: {
    title: "Tournament Initialization",
    subtitle: "Create a master administrative password to secure your live tournament.",
    passLabel: "New Master Password",
    passPlaceholder: "Enter new password",
    confirmLabel: "Confirm Password",
    confirmPlaceholder: "Re-enter password",
    submitButton: "Secure Server",
    errorLength: "Password must be at least 4 characters long.",
    errorMatch: "Passwords do not match.",
    connected: "Connected",
    disconnected: "Disconnected"
  }
};