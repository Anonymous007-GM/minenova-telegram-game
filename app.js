const tg = window.Telegram?.WebApp;

if (tg) {
  tg.ready();
  tg.expand();
  try {
    tg.setHeaderColor("#07111f");
    tg.setBackgroundColor("#07111f");
  } catch(e) {}
}

const defaultState = {
  id: null,
  balance: 0,
  energy: 0,
  maxEnergy: 1000,
  rate: 1,
  regen: 3,
  taps: 0,
  refs: 0,
  refEarned: 0,
  upgrades: {power:0, battery:0, regen:0},
  claimedTasks: [],
  lastDaily: 0,
  boost: {mult:1, until:0}
};

let state = {...defaultState};
let serverReady = false;
let miningBusy = false;

const $ = id => document.getElementById(id);

const fmt = n =>
  Math.floor(Number(n) || 0).toLocaleString();

function save() {
  // Server is the source of truth.
}

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(window.__toast);
  window.__toast = setTimeout(
    () => t.classList.remove("show"),
    1600
  );
}

function activeMult() {
  return Date.now() < state.boost.until
    ? state.boost.mult
    : 1;
}

async function api(path, options = {}) {
  if (!tg?.initData) {
    throw new Error("Open the game inside Telegram");
  }

  const headers = {
    "Content-Type": "application/json",
    "X-Telegram-Init-Data": tg.initData,
    ...(options.headers || {})
  };

  const res = await fetch(path, {
    ...options,
    headers
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      body.error || `Request failed (${res.status})`
    );
  }

  return body;
}

function applyPlayer(p) {
  if (!p) return;

  state.id = p.id ?? state.id;
  state.balance = Number(p.balance ?? state.balance);
  state.energy = Number(p.energy ?? state.energy);
  state.maxEnergy =
    Number(p.max_energy ?? state.maxEnergy);
  state.rate =
    Number(p.mining_power ?? state.rate);
  state.regen =
    Number(p.regen ?? state.regen);
  state.taps =
    Number(p.taps ?? state.taps);
}

async function bootServer() {
  if (!tg?.initData) {
    toast("Open this game inside Telegram");
    render();
    return;
  }

  try {
    const auth = await api("/api/auth", {
      method: "POST"
    });

    applyPlayer(auth.player);

    const current = await api("/api/state", {
      method: "POST"
    });

    applyPlayer(current.player);

    serverReady = true;
    render();

  } catch (err) {
    console.error(err);
    toast(
      err.message ||
      "Could not connect to game server"
    );
  }
}

async function watchAdForReward() {
  if (!serverReady) {
    toast("Game is still connecting...");
    return;
  }

  if (typeof show_11559295 !== "function") {
    toast("Advertisement is not ready");
    return;
  }

  const ymid =
    "ad_" +
    Date.now() +
    "_" +
    Math.random().toString(36).slice(2, 10);

  try {
  toast("Loading advertisement...");

  await show_11559295({
    ymid: ymid,
    requestVar: "mining_reward"
  });

  toast("Ad completed! Reward is being processed...");

} catch (err) {
  console.error("Monetag:", err);
  toast("Ad skipped or unavailable");
}
}
function render() {
  $("balance").textContent = fmt(state.balance);
  $("rate").textContent =
    fmt(state.rate * activeMult());
  $("energy").textContent = fmt(state.energy);
  $("maxEnergy").textContent =
    fmt(state.maxEnergy);
  $("regen").textContent = fmt(state.regen);

  $("energyBar").style.width =
    Math.max(
      0,
      state.energy / state.maxEnergy * 100
    ) + "%";

  $("refCount").textContent = fmt(state.refs);
  $("refEarned").textContent =
    fmt(state.refEarned);

  $("profileBalance").textContent =
    fmt(state.balance);

  $("profileTaps").textContent =
    fmt(state.taps);

  renderUpgrades();
  renderBoosts();
  renderTasks();
  renderLeaderboard();
}

async function mine(e) {
  if (!serverReady || miningBusy) return;

  if (state.energy < 1) {
    toast("Not enough energy");
    return;
  }

  // Make the button respond immediately
  const btn = $("mineBtn");

  btn.classList.remove("pop");
  void btn.offsetWidth;
  btn.classList.add("pop");

  const rect = btn.getBoundingClientRect();

  const r = document.createElement("span");
  r.className = "float";
  r.textContent = "+" + fmt(state.rate);

  r.style.left =
    (e?.clientX || rect.left + rect.width / 2) + "px";

  r.style.top =
    (e?.clientY || rect.top + rect.height / 2) + "px";

  document.body.appendChild(r);

  setTimeout(() => r.remove(), 700);

  // Update the UI immediately
  state.energy -= 1;
  state.balance += state.rate;
  state.taps += 1;

  render();

  // Send the mining action to the server
  // without making the button wait for the response.
  try {
    await api("/api/mine", {
      method: "POST"
    });

    // Get the server's actual state afterwards.
    const current = await api("/api/state", {
      method: "POST"
    });

    applyPlayer(current.player);
    render();

  } catch (err) {
    console.error(err);

    // Refresh from server if the request failed.
    try {
      const current = await api("/api/state", {
        method: "POST"
      });

      applyPlayer(current.player);
      render();

    } catch (_) {
      toast("Connection problem");
    }
  }
}

$("mineBtn").addEventListener(
  "click",
  mine
);

$("fullEnergyBtn").addEventListener(
  "click",
  () => toast(
    "Energy purchases will be connected next."
  )
);

function upgradeCost(type) {
  const lvl = state.upgrades[type];

  const base = {
    power: 150,
    battery: 400,
    regen: 300
  }[type];

  return Math.floor(
    base * Math.pow(1.65, lvl)
  );
}

const upgradeData = [
  [
    "power",
    "⛏️",
    "Mining Power",
    "Increase NOVA earned per tap.",
    "rate"
  ],
  [
    "battery",
    "🔋",
    "Energy Tank",
    "Increase maximum energy by 100.",
    "maxEnergy"
  ],
  [
    "regen",
    "💧",
    "Auto Regen",
    "Recover 1 extra energy every second.",
    "regen"
  ]
];

function renderUpgrades() {
  $("upgradeList").innerHTML =
    upgradeData.map(
      ([type,icon,name,desc,stat]) => {

        const lvl =
          state.upgrades[type];

        const cost =
          upgradeCost(type);

        return `
          <div class="item">
            <div class="item-icon">
              ${icon}
            </div>

            <div class="item-main">
              <b>
                ${name} · Lv.${lvl}
              </b>

              <small>
                ${desc}
              </small>
            </div>

            <button
              onclick="buyUpgrade('${type}')"
              ${state.balance < cost
                ? "disabled"
                : ""}
            >
              ${fmt(cost)} NOVA
            </button>
          </div>
        `;
      }
    ).join("");
}

window.buyUpgrade = type => {
  toast(
    "Upgrades are not connected to the server yet."
  );
};

const boosts = [
  [
    "turbo",
    "⚡",
    "Turbo Drill",
    "5× mining power for 30 seconds.",
    5,
    30,
    250
  ],
  [
    "overdrive",
    "🔥",
    "Overdrive",
    "10× mining power for 15 seconds.",
    10,
    15,
    600
  ],
  [
    "refill",
    "🔋",
    "Energy Surge",
    "Instantly refill your energy.",
    1,
    0,
    150
  ]
];

function renderBoosts() {
  $("boostList").innerHTML =
    boosts.map(
      ([id,icon,name,desc,mult,sec,cost]) =>
      `
        <div class="boost">

          <div class="boost-top">
            <div class="boost-icon">
              ${icon}
            </div>

            <b>
              ${fmt(cost)} NOVA
            </b>
          </div>

          <h3>${name}</h3>

          <p>${desc}</p>

          <button
            onclick="useBoost('${id}')"
          >
            ${id === "refill"
              ? "ACTIVATE"
              : "ACTIVATE BOOST"}
          </button>

        </div>
      `
    ).join("");
}

window.useBoost = id => {
  toast(
    "Boosts are not connected to the server yet."
  );
};

const tasks = [
  [
    "daily",
    "📅",
    "Daily Miner",
    "Mine 100 times today.",
    100,
    () => state.taps >= 100
  ],
  [
    "rich",
    "💎",
    "Reach 5,000 NOVA",
    "Build your first serious stash.",
    300,
    () => state.balance >= 5000
  ],
  [
    "power",
    "🔧",
    "Upgrade your rig",
    "Purchase any upgrade.",
    250,
    () =>
      Object.values(
        state.upgrades
      ).some(v => v > 0)
  ]
];

function renderTasks() {
  $("taskList").innerHTML =
    tasks.map(
      ([id,icon,name,desc,reward,done]) => {

        const claimed =
          state.claimedTasks.includes(id);

        const ready = done();

        return `
          <div class="item">

            <div class="item-icon">
              ${icon}
            </div>

            <div class="item-main">

              <b>${name}</b>

              <small>
                ${desc} · +${reward} NOVA
              </small>

            </div>

            <button
              onclick="claimTask('${id}')"
              ${claimed || !ready
                ? "disabled"
                : ""}
            >
              ${
                claimed
                  ? "CLAIMED"
                  : ready
                    ? "CLAIM"
                    : "LOCKED"
              }
            </button>

          </div>
        `;
      }
    ).join("");
}

window.claimTask = id => {
  toast(
    "Tasks are not connected to the server yet."
  );
};

function renderLeaderboard() {

  const meName =
    tg?.initDataUnsafe?.user?.first_name ||
    "You";

  const names = [
    "NovaPilot",
    "AstroMiner",
    "LunarFox",
    "PixelDrill",
    "OrbitMax",
    "CosmoTap",
    "StarForge"
  ];

  const scores = [
    98200,
    76100,
    65300,
    52100,
    44400,
    39100,
    31200
  ];

  const rows =
    names.map((n,i) => ({
      n,
      score: scores[i]
    }));

  rows.push({
    n: meName,
    score: state.balance
  });

  rows.sort(
    (a,b) => b.score - a.score
  );

  $("leaderboard").innerHTML =
    rows
      .slice(0,10)
      .map(
        (r,i) =>
        `
          <div class="rank-row">

            <div class="rank-num">
              ${i + 1}
            </div>

            <div class="rank-avatar">
              ${
                i < 3
                  ? ["🥇","🥈","🥉"][i]
                  : "⛏️"
              }
            </div>

            <div class="rank-user">

              <b>
                ${escapeHtml(r.n)}
              </b>

              <small>
                ${i < 3
                  ? "Elite miner"
                  : "Miner"}
              </small>

            </div>

            <div class="rank-score">
              ${fmt(r.score)}
            </div>

          </div>
        `
      )
      .join("");
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c])
  );
}

function openScreen(id) {

  document
    .querySelectorAll(".screen")
    .forEach(
      x =>
        x.classList.toggle(
          "active",
          x.id === id
        )
    );

  document
    .querySelectorAll(".nav")
    .forEach(
      x =>
        x.classList.toggle(
          "active",
          x.dataset.go === id
        )
    );

  if (id === "tasks") {
    renderTasks();
  }
}

document
  .querySelectorAll("[data-go]")
  .forEach(
    b =>
      b.addEventListener(
        "click",
        () => openScreen(b.dataset.go)
      )
  );

function profile() {

  const u =
    tg?.initDataUnsafe?.user;

  $("profileName").textContent =
    u?.first_name || "Miner";

  $("profileUsername").textContent =
    u?.username
      ? "@" + u.username
      : "Telegram Miner";

  $("profileAvatar").textContent =
    u?.emoji_status_custom_emoji_id
      ? "✦"
      : "👤";

  $("profileModal")
    .classList.remove("hidden");
}

$("profileBtn").onclick =
  profile;

$("closeModal").onclick =
  () =>
    $("profileModal")
      .classList.add("hidden");

$("profileModal").onclick =
  e => {
    if (e.target.id === "profileModal") {
      $("profileModal")
        .classList.add("hidden");
    }
  };

function inviteLink() {

  const bot =
    "YOUR_BOT_USERNAME";

  $("inviteLink").textContent =
    `https://t.me/${bot}?start=ref_demo`;
}

$("copyInvite").onclick =
  async () => {

    try {

      await navigator.clipboard.writeText(
        $("inviteLink").textContent
      );

      toast("Invite link copied");

    } catch(e) {

      toast("Copy failed");
    }
  };

setInterval(() => {

  if (
    state.boost.until &&
    Date.now() > state.boost.until
  ) {

    state.boost = {
      mult: 1,
      until: 0
    };

    render();
  }

}, 1000);

inviteLink();
render();
bootServer();
