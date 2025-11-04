/* static/script.js
All frontend JavaScript for Yahoo Bank demo.
- Exports window.handleLogin(username, password)
- Exposes window.initDashboard() which initializes dashboard UI after load
- Contains DOM event handlers, API calls, Chart.js integration, scam popup logic, dark mode persistence

Note: uses vanilla JS and Chart.js (from CDN included on page).
*/

/* -------------------------
   Helper utilities
   ------------------------- */

/**
 * Simple helper to do JSON POSTs and return parsed JSON or throw.
 * Returns a Promise resolving to JSON or rejecting with Error-like object.
 */
function apiPost(path, data) {
  return fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data || {})
  }).then(async (res) => {
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(json.error || json.message || "Server error");
      err.response = json;
      throw err;
    }
    return json;
  });
}

/**
 * Simple GET helper returning JSON or throwing.
 */
function apiGet(path) {
  return fetch(path, { credentials: "same-origin" })
    .then(async (res) => {
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(json.error || json.message || "Server error");
        err.response = json;
        throw err;
      }
      return json;
    });
}

/**
 * Format number as Euro string with commas and 2 decimals.
 */
function fmtEuro(amount) {
  const n = Number(amount) || 0;
  return "€" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* -------------------------
   Exported: handleLogin
   Called by index.html when user submits login
   ------------------------- */
window.handleLogin = function(username, password) {
  // Trim and simple validation
  username = (username || "").trim();
  password = (password || "");
  if (!username || !password) {
    return Promise.reject({ message: "Enter username and password." });
  }
  // POST to /api/login then redirect to /dashboard on success
  return apiPost("/api/login", { username, password })
    .then((resp) => {
      // redirect to dashboard (server serves the page)
      window.location.href = "/dashboard";
    })
    .catch((err) => {
      // bubble up so index.html can show the message
      throw err;
    });
};

/* -------------------------
   Dashboard initialization & global state
   ------------------------- */
let currentUser = null;
let displayedBalance = 0;
let activityChart = null;
let chartData = {
  sent: 0,
  spent: 0,
  scam_losses: 0,
  invest: 0,
  bonus: 0
};

// Elements (populated on init)
const el = {};
const SCAMMER_NAMES = ['Prince Nwabudike','Ms. Okafor','Mr. Ade','Dr. Obi','Lady Ifeanyi'];

function qs(id) { return document.getElementById(id); }

/* -------------------------
   Animate balance from current displayed value to new value
   Uses requestAnimationFrame for smoothness.
   ------------------------- */
function animateBalanceTo(newBalance) {
  const elBalance = qs("balanceValue");
  const start = displayedBalance;
  const end = Number(newBalance) || 0;
  const duration = 700; // ms
  const startTs = performance.now();

  function step(now) {
    const t = Math.min(1, (now - startTs) / duration);
    const value = start + (end - start) * easeOutCubic(t);
    elBalance.textContent = fmtEuro(value);
    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      displayedBalance = end;
      elBalance.textContent = fmtEuro(end);
    }
  }
  requestAnimationFrame(step);

  function easeOutCubic(x){ return 1 - Math.pow(1 - x, 3); }
}

/* -------------------------
   Chart.js initialization
   - Shows totals for sent, spent, scam losses, invest (net), bonus
   - updateActivityChart() will animate updates
   ------------------------- */
function initActivityChart() {
  const ctx = qs("activityChart").getContext("2d");
  const labels = ["Sent","Spent","Scam Losses","Invest (net)","Bonus"];
  const dataset = {
    labels,
    datasets: [{
      label: "Totals (€)",
      data: [
        chartData.sent, chartData.spent, chartData.scam_losses, chartData.invest, chartData.bonus
      ],
      borderColor: undefined,
      borderWidth: 1,
      fill: false,
      tension: 0.3,
    }]
  };
  activityChart = new Chart(ctx, {
    type: "line",
    data: dataset,
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { display: true },
        y: { ticks: { callback: (v) => fmtEuro(v) } }
      }
    }
  });
}

function updateActivityChart() {
  if (!activityChart) return;
  activityChart.data.datasets[0].data = [
    chartData.sent, chartData.spent, chartData.scam_losses, chartData.invest, chartData.bonus
  ];
  activityChart.update();
}

/* -------------------------
   Dark mode: persist in localStorage
   ------------------------- */
function applyThemeFromStorage() {
  const dark = localStorage.getItem("yahoobank_dark") === "1";
  document.body.classList.toggle("dark", dark);
  qs("darkToggle").checked = dark;
}
function toggleDarkMode() {
  const isDark = qs("darkToggle").checked;
  localStorage.setItem("yahoobank_dark", isDark ? "1" : "0");
  document.body.classList.toggle("dark", isDark);
}

/* -------------------------
   Dashboard event handlers (each has a short comment describing its purpose)
   ------------------------- */

/* Logout button handler: calls /api/logout then redirects to index */
function handleLogout() {
  apiPost("/api/logout", {}).then(() => {
    window.location.href = "/";
  }).catch((err) => {
    alert("Logout failed: " + (err.message || "error"));
  });
}

/* Send button handler: collects recipient & amount and posts to /api/send */
function handleSend() {
  const to = qs("sendTo").value.trim();
  const amount = parseFloat(qs("sendAmount").value);
  if (!to) return showTempMsg("sendMsg", "Enter recipient username.", true);
  if (!amount || amount <= 0) return showTempMsg("sendMsg", "Enter a valid amount.", true);
  apiPost("/api/send", { to, amount })
    .then((resp) => {
      animateBalanceTo(resp.balance);
      // update chart bookkeeping
      chartData.sent += Number(amount);
      updateActivityChart();
      showTempMsg("sendMsg", resp.message, false);
    })
    .catch((err) => {
      showTempMsg("sendMsg", err.message || "Send failed", true);
    });
}

/* Spend button handler: collects item & cost and posts to /api/spend */
function handleSpend() {
  const item = qs("spendItem").value.trim() || "Item";
  const cost = parseFloat(qs("spendCost").value);
  if (!cost || cost <= 0) return showTempMsg("spendMsg", "Enter a valid cost.", true);
  apiPost("/api/spend", { item, cost })
    .then((resp) => {
      animateBalanceTo(resp.balance);
      chartData.spent += Number(cost);
      updateActivityChart();
      showTempMsg("spendMsg", resp.message, false);
    })
    .catch((err) => {
      showTempMsg("spendMsg", err.message || "Purchase failed", true);
    });
}

/* Invest button handler: posts to /api/invest */
function handleInvest() {
  const amount = parseFloat(qs("investAmount").value);
  if (!amount || amount <= 0) return showTempMsg("investMsg", "Enter a valid amount.", true);
  apiPost("/api/invest", { amount })
    .then((resp) => {
      animateBalanceTo(resp.balance);
      // server returns net change in activities; this client also updates chart by parsing message.
      // We'll parse numeric euro from formatted_balance differences instead.
      // Simpler: add resp.message extracted amount (we can try parsing numbers).
      // Instead, we will fetch fresh account activities from GET /api/account to keep consistent.
      refreshAccountAndActivities();
      showTempMsg("investMsg", resp.message, false);
    })
    .catch((err) => {
      showTempMsg("investMsg", err.message || "Invest failed", true);
    });
}

/* Gov bonus handler: calls /api/govbonus */
function handleGovBonus() {
  apiPost("/api/govbonus", {})
    .then((resp) => {
      animateBalanceTo(resp.balance);
      chartData.bonus += Number(resp.amount || 0);
      updateActivityChart();
      flashElement(qs("balanceValue"), "flash-success");
      alert(resp.message);
    })
    .catch((err) => alert("Gov bonus failed: " + (err.message || "")));
}

/* Scam Alert handler: show popup immediately */
function handleScamAlertClick() {
  showScamPopup();
}

/* Popup: Send Money (scam) -> calls /api/scam */
function popupSendMoney() {
  apiPost("/api/scam", {})
    .then((resp) => {
      animateBalanceTo(resp.balance);
      if (resp.princed) {
        // prince reward handled like bonus
        chartData.bonus += 10000;
      } else if (resp.stolen) {
        chartData.scam_losses += Number(resp.stolen);
      }
      updateActivityChart();
      hideScamPopup();
      showTempMsg(null, resp.message, false, 4000);
    })
    .catch((err) => {
      hideScamPopup();
      showTempMsg(null, err.message || "Scam call failed", true, 4000);
    });
}

/* Popup: Try to Gain (client-side fun small gain) */
function popupTryToGain() {
  const smallGain = (Math.random() * 10 + 1).toFixed(2);
  // Just animate locally and add to chart as tiny bonus (not calling server)
  displayedBalance += Number(smallGain);
  animateBalanceTo(displayedBalance);
  chartData.bonus += Number(smallGain);
  updateActivityChart();
  hideScamPopup();
  showTempMsg(null, `You cleverly gained ${fmtEuro(smallGain)} (client-side).`, false, 3000);
}

/* Popup ignore */
function popupIgnore() {
  hideScamPopup();
}

/* -------------------------
   UI helpers
   ------------------------- */
function showTempMsg(elementId, message, isError=false, timeout=3000) {
  if (!elementId) {
    // global transient message (use alert area) — just use browser alert fallback
    const tmp = document.createElement("div");
    tmp.className = isError ? "message error" : "message";
    tmp.textContent = message;
    tmp.style.position = "fixed";
    tmp.style.left = "50%";
    tmp.style.top = "10%";
    tmp.style.transform = "translateX(-50%)";
    tmp.style.zIndex = 9999;
    document.body.appendChild(tmp);
    setTimeout(() => tmp.remove(), timeout);
    return;
  }
  const el = qs(elementId);
  if (!el) return;
  el.textContent = message;
  if (isError) el.classList.add("error");
  setTimeout(() => { el.textContent = ""; el.classList.remove("error"); }, timeout);
}

function flashElement(element, className, timeout=900) {
  if (!element) return;
  element.classList.add(className);
  setTimeout(() => element.classList.remove(className), timeout);
}

/* -------------------------
   NPC mini-game: modal and logic
   - createNPCButtons fetches list of npc keys and renders buttons
   - clicking a button opens modal with A+B puzzle
   - submitting calls /api/scam_mini_game with success true/false
   ------------------------- */
let currentTargetNPC = null;
let currentA = 0;
let currentB = 0;

function createNPCButtons(npcs) {
  const container = qs("npcContainer");
  container.innerHTML = "";
  npcs.forEach((key) => {
    const btn = document.createElement("button");
    btn.className = "npc-btn";
    btn.textContent = key.replace(/_/g, " ");
    btn.addEventListener("click", () => openMiniGameModal(key));
    container.appendChild(btn);
  });
}

function openMiniGameModal(npcKey) {
  currentTargetNPC = npcKey;
  // create a small math challenge
  currentA = Math.floor(Math.random() * 20) + 1;
  currentB = Math.floor(Math.random() * 20) + 1;
  qs("npcNameDisplay").textContent = "Target: " + npcKey.replace(/_/g, " ");
  qs("mathA").textContent = currentA;
  qs("mathB").textContent = currentB;
  qs("mathAnswer").value = "";
  qs("modalMsg").textContent = "";
  qs("modal").classList.remove("hidden");
}

function closeMiniGameModal() {
  qs("modal").classList.add("hidden");
  currentTargetNPC = null;
}

/* Submit answer handler in modal */
function submitMiniGameAnswer() {
  const ans = Number(qs("mathAnswer").value);
  const correct = ans === (currentA * currentB);
  // Call API with success true/false
  apiPost("/api/scam_mini_game", { target: currentTargetNPC, success: correct })
    .then((resp) => {
      // success contains either success:true or false but server returns useful messages
      animateBalanceTo(resp.balance);
      // Update local chart bookkeeping by refreshing activities from /api/account
      refreshAccountAndActivities();
      qs("modalMsg").textContent = resp.message || "Result received.";
      if (resp.success) {
        flashElement(qs("modalContent"), "flash-success");
      } else {
        flashElement(qs("modalContent"), "flash-fail");
      }
      // close modal after short delay
      setTimeout(closeMiniGameModal, 1500);
    })
    .catch((err) => {
      qs("modalMsg").textContent = err.message || "Action failed";
      setTimeout(closeMiniGameModal, 1500);
    });
}

/* -------------------------
   Scam popup UI (timed random popups)
   - appear every 2-4 minutes randomly
   - also shown when user clicks Scam Alert button
   ------------------------- */
let scamTimer = null;
function randomIntervalMs() {
  return (120 + Math.random() * 120) * 1000; // 120s to 240s (2-4 minutes)
}
function scheduleScamPopup() {
  clearTimeout(scamTimer);
  scamTimer = setTimeout(() => {
    showScamPopup();
    scheduleScamPopup();
  }, randomIntervalMs());
}

function showScamPopup() {
  const popup = qs("scamPopup");
  const name = SCAMMER_NAMES[Math.floor(Math.random()*SCAMMER_NAMES.length)];
  qs("scammerName").textContent = name;
  qs("scamText").textContent = `Hello ${currentUser || 'friend'}, I have a business offer...`;
  popup.classList.remove("hidden");
}
function hideScamPopup() {
  qs("scamPopup").classList.add("hidden");
}

/* -------------------------
   Fetch account & NPC list on dashboard load
   ------------------------- */
function refreshAccountAndActivities() {
  return apiGet("/api/account")
    .then((resp) => {
      currentUser = resp.username;
      qs("welcome").textContent = `Welcome, ${resp.username}`;
      qs("usernameBadge").textContent = resp.username;
      animateBalanceTo(resp.balance);
      // Update bookkeeping from server-side activities to avoid desync
      const a = resp.activities || {};
      chartData.sent = Number(a.sent || 0);
      chartData.spent = Number(a.spent || 0);
      chartData.scam_losses = Number(a.scam_losses || 0);
      chartData.invest = Number(a.invest || 0);
      chartData.bonus = Number(a.bonus || 0);
      updateActivityChart();
    })
    .catch((err) => {
      alert("Failed to load account. You may need to log in again.");
      window.location.href = "/";
    });
}

/* -------------------------
   Initialize dashboard: called on DOMContentLoaded
   - wires event handlers, fetches account & NPCs, sets up chart, theme, popup timers
   ------------------------- */
window.initDashboard = function() {
  // elements used repeatedly
  el.logoutBtn = qs("logoutBtn");
  el.darkToggle = qs("darkToggle");
  el.sendBtn = qs("sendBtn");
  el.spendBtn = qs("spendBtn");
  el.investBtn = qs("investBtn");
  el.npcContainer = qs("npcContainer");
  el.govBonusBtn = qs("govBonusBtn");
  el.scamAlertBtn = qs("scamAlertBtn");

  // Wire up events
  el.logoutBtn.addEventListener("click", handleLogout);
  el.darkToggle.addEventListener("change", toggleDarkMode);
  el.sendBtn.addEventListener("click", handleSend);
  el.spendBtn.addEventListener("click", handleSpend);
  el.investBtn.addEventListener("click", handleInvest);
  el.govBonusBtn.addEventListener("click", handleGovBonus);
  el.scamAlertBtn.addEventListener("click", handleScamAlertClick);

  // popup events
  qs("popupSend").addEventListener("click", popupSendMoney);
  qs("popupGain").addEventListener("click", popupTryToGain);
  qs("popupIgnore").addEventListener("click", popupIgnore);

  // modal events
  qs("modalClose").addEventListener("click", closeMiniGameModal);
  qs("cancelModal").addEventListener("click", closeMiniGameModal);
  qs("submitAnswer").addEventListener("click", submitMiniGameAnswer);

  // allow hitting Enter in modal input to submit
  qs("mathAnswer").addEventListener("keyup", function(e){
    if (e.key === "Enter") submitMiniGameAnswer();
  });

  // apply persisted theme
  applyThemeFromStorage();

  // init chart
  initActivityChart();

  // fetch account & npcs
  Promise.all([apiGet("/api/account"), apiGet("/api/npcs")])
    .then(([acct, npcsResp]) => {
      currentUser = acct.username;
      qs("welcome").textContent = `Welcome, ${acct.username}`;
      qs("usernameBadge").textContent = acct.username;
      displayedBalance = Number(acct.balance || 0);
      qs("balanceValue").textContent = fmtEuro(displayedBalance);
      // activities
      const a = acct.activities || {};
      chartData.sent = Number(a.sent || 0);
      chartData.spent = Number(a.spent || 0);
      chartData.scam_losses = Number(a.scam_losses || 0);
      chartData.invest = Number(a.invest || 0);
      chartData.bonus = Number(a.bonus || 0);
      updateActivityChart();

      // NPCs
      createNPCButtons(npcsResp.npcs || []);
      // schedule scam popup timer (client-side)
      scheduleScamPopup();
    })
    .catch((err) => {
      alert("Failed to initialize dashboard: " + (err.message || ""));
      window.location.href = "/";
    });
};

/* -------------------------
   Start - attach some global shortcuts for testing
   ------------------------- */
window.showScamPopup = showScamPopup;
window.hideScamPopup = hideScamPopup;
window.refreshAccountAndActivities = refreshAccountAndActivities;
