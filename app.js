const tg = window.Telegram?.WebApp;

if (tg) {
  tg.ready();
  tg.expand();

  try {
    tg.setHeaderColor("#07111f");
    tg.setBackgroundColor("#07111f");
  } catch (e) {}
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
  upgrades: {
    power: 0,
    battery: 0,
    regen: 0
  },
  claimedTasks: [],
  lastDaily: 0,
  boost: {
    mult: 1,
    until: 0
  }
};

let state = {
  ...defaultState,
  upgrades: {
    ...defaultState.upgrades
  },
  boost: {
    ...defaultState.boost
  }
};

let serverReady = false;
let miningBusy = false;
let adBusy = false;

const $ = id => document.getElementById(id);

const fmt = n =>
  Math.floor(Number(n) || 0).toLocaleString();

function toast(msg) {
  const t = $("toast");

  if (!t) return;

  t.textContent = msg;
  t.classList.add("show");

  clearTimeout(window.__toast);

  window.__toast = setTimeout(() => {
    t.classList.remove("show");
  }, 1600);
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

  state.id =
    p.id ?? state.id;

  state.balance =
    Number(p.balance ?? state.balance);

  state.energy =
    Number(p.energy ?? state.energy);

  state.maxEnergy =
    Number(p.max_energy ?? state.maxEnergy);

  state.rate =
    Number(p.mining_power ?? state.rate);

  state.regen =
    Number(p.regen ?? state.regen);

  state.taps =
    Number(p.taps ?? state.taps);

  if (p.refs !== undefined) {
    state.refs = Number(p.refs);
  }

  if (p.ref_earned !== undefined) {
    state.refEarned =
      Number(p.ref_earned);
  }

  if (p.upgrades) {
    state.upgrades = {
      ...state.upgrades,
      ...p.upgrades
    };
  }

  if (p.claimed_tasks) {
    state.claimedTasks =
      Array.isArray(p.claimed_tasks)
        ? p.claimed_tasks
        : [];
  }
}

async function syncServerState() {
  if (!serverReady) return;

  try {
    const current =
      await api("/api/state", {
        method: "POST"
      });

    applyPlayer(current.player);
    render();

  } catch (err) {
    console.error(
      "State sync error:",
      err
    );
  }
}

async function bootServer() {
  if (!tg?.initData) {
    toast("Open this game inside Telegram");
    render();
    return;
  }

  try {
    const auth =
      await api("/api/auth", {
        method: "POST"
      });

    applyPlayer(auth.player);

    const current =
      await api("/api/state", {
        method: "POST"
      });

    applyPlayer(current.player);

    serverReady = true;

    render();

  } catch (err) {
    console.error(
      "Boot error:",
      err
    );

    toast(
      err.message ||
      "Could not connect to game server"
    );
  }
}


/* =====================================================
   MONETAG REWARDED AD
   ===================================================== */

async function watchAdForReward() {
  if (!serverReady) {
    toast("Game is still connecting...");
    return;
  }

  if (typeof show_11559295 !== "function") {
    toast("Advertisement is not ready");
    console.error("Monetag function show_11559295 is missing");
    return;
  }

  const ymid =
    "ad_" +
    Date.now() +
    "_" +
    Math.random().toString(36).slice(2, 10);

  console.log("MONETAG AD START:", {
    ymid,
    telegram_id: tg?.initDataUnsafe?.user?.id || null,
    requestVar: "mining_reward"
  });

  try {
    toast("Loading advertisement...");

    const event = await show_11559295({
      ymid: ymid,
      requestVar: "mining_reward"
    });

    console.log("MONETAG AD EVENT CONFIRMED:", event);

    toast("Ad completed! Checking reward...");

    /*
     * The Monetag postback may reach our backend
     * after the frontend Promise resolves.
     *
     * Poll the server several times instead of
     * checking only once after 2.5 seconds.
     */

    const delays = [
      1500,
      3000,
      4500,
      6000,
      7500
    ];

    for (const delay of delays) {
      await new Promise(resolve =>
        setTimeout(resolve, delay)
      );

      try {
        const current = await api("/api/state", {
          method: "POST",
          headers: {
            "Cache-Control": "no-cache"
          }
        });

        console.log(
          "SERVER STATE AFTER AD:",
          current.player
        );

        applyPlayer(current.player);
        render();

        /*
         * If balance has been updated, stop polling.
         *
         * We don't know the exact reward amount here,
         * so the important thing is that the server state
         * is refreshed repeatedly.
         */
      } catch (stateError) {
        console.error(
          "State refresh after ad failed:",
          stateError
        );
      }
    }

    toast("Balance checked 🎉");

  } catch (err) {
    console.error(
      "MONETAG AD ERROR:",
      err
    );

    toast("Ad skipped or unavailable");
  }
}

/* =====================================================
   RENDER
   ===================================================== */

function render() {

  if ($("balance")) {
    $("balance").textContent =
      fmt(state.balance);
  }

  if ($("rate")) {
    $("rate").textContent =
      fmt(
        state.rate *
        activeMult()
      );
  }

  if ($("energy")) {
    $("energy").textContent =
      fmt(state.energy);
  }

  if ($("maxEnergy")) {
    $("maxEnergy").textContent =
      fmt(state.maxEnergy);
  }

  if ($("regen")) {
    $("regen").textContent =
      fmt(state.regen);
  }

  if ($("energyBar")) {

    const percent =
      state.maxEnergy > 0
        ? state.energy /
          state.maxEnergy *
          100
        : 0;

    $("energyBar").style.width =
      Math.max(
        0,
        Math.min(100, percent)
      ) + "%";
  }

  if ($("refCount")) {
    $("refCount").textContent =
      fmt(state.refs);
  }

  if ($("refEarned")) {
    $("refEarned").textContent =
      fmt(state.refEarned);
  }

  if ($("profileBalance")) {
    $("profileBalance").textContent =
      fmt(state.balance);
  }

  if ($("profileTaps")) {
    $("profileTaps").textContent =
      fmt(state.taps);
  }

  renderUpgrades();
  renderBoosts();
  renderTasks();
  renderLeaderboard();
}


/* =====================================================
   MINING
   ===================================================== */

async function mine(e) {

  if (!serverReady) return;

  if (miningBusy) return;

  if (state.energy < 1) {
    toast("Not enough energy");
    return;
  }

  const btn =
    $("mineBtn");

  if (!btn) return;

  miningBusy = true;

  btn.classList.remove("pop");

  void btn.offsetWidth;

  btn.classList.add("pop");

  const rect =
    btn.getBoundingClientRect();

  const r =
    document.createElement("span");

  r.className = "float";

  r.textContent =
    "+" + fmt(state.rate);

  r.style.left =
    (
      e?.clientX ||
      rect.left +
      rect.width / 2
    ) + "px";

  r.style.top =
    (
      e?.clientY ||
      rect.top +
      rect.height / 2
    ) + "px";

  document.body.appendChild(r);

  setTimeout(() => {
    r.remove();
  }, 700);

  try {

    await api("/api/mine", {
      method: "POST"
    });

    /*
      Server is source of truth.
    */

    await syncServerState();

  } catch (err) {

    console.error(
      "Mining error:",
      err
    );

    toast(
      err.message ||
      "Mining failed"
    );

    await syncServerState();

  } finally {

    miningBusy = false;
  }
}


/* =====================================================
   BUTTONS
   ===================================================== */

if ($("mineBtn")) {

  $("mineBtn").addEventListener(
    "click",
    mine
  );
}

if ($("fullEnergyBtn")) {

  $("fullEnergyBtn").addEventListener(
    "click",
    () =>
      toast(
        "Energy purchases will be connected next."
      )
  );
}


/* =====================================================
   UPGRADES
   ===================================================== */

function upgradeCost(type) {

  const lvl =
    Number(
      state.upgrades[type] || 0
    );

  const base = {
    power: 150,
    battery: 400,
    regen: 300
  }[type];

  return Math.floor(
    base *
    Math.pow(1.65, lvl)
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

  const list =
    $("upgradeList");

  if (!list) return;

  list.innerHTML =
    upgradeData
      .map(
        ([type, icon, name, desc]) => {

          const lvl =
            Number(
              state.upgrades[type] || 0
            );

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
                ${
                  state.balance < cost
                    ? "disabled"
                    : ""
                }
              >
                ${fmt(cost)} NOVA
              </button>

            </div>
          `;
        }
      )
      .join("");
}

window.buyUpgrade =
  type => {

    toast(
      "Upgrades are not connected to the server yet."
    );

  };


/* =====================================================
   BOOSTS
   ===================================================== */

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

  const list =
    $("boostList");

  if (!list) return;

  list.innerHTML =
    boosts
      .map(
        (
          [
            id,
            icon,
            name,
            desc,
            mult,
            sec,
            cost
          ]
        ) =>
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

              <h3>
                ${name}
              </h3>

              <p>
                ${desc}
              </p>

              <button
                onclick="useBoost('${id}')"
              >
                ${
                  id === "refill"
                    ? "ACTIVATE"
                    : "ACTIVATE BOOST"
                }
              </button>

            </div>
          `
      )
      .join("");
}

window.useBoost =
  id => {

    toast(
      "Boosts are not connected to the server yet."
    );

  };


/* =====================================================
   TASKS
   ===================================================== */

const tasks = [

  [
    "daily",
    "📅",
    "Daily Miner",
    "Mine 100 times today.",
    100,
    () =>
      state.taps >= 100
  ],

  [
    "rich",
    "💎",
    "Reach 5,000 NOVA",
    "Build your first serious stash.",
    300,
    () =>
      state.balance >= 5000
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
      ).some(
        v => Number(v) > 0
      )
  ]

];

function renderTasks() {

  const list =
    $("taskList");

  if (!list) return;

  list.innerHTML =
    tasks
      .map(
        (
          [
            id,
            icon,
            name,
            desc,
            reward,
            done
          ]
        ) => {

          const claimed =
            state.claimedTasks
              .includes(id);

          const ready =
            done();

          return `
            <div class="item">

              <div class="item-icon">
                ${icon}
              </div>

              <div class="item-main">

                <b>
                  ${name}
                </b>

                <small>
                  ${desc}
                  · +${reward} NOVA
                </small>

              </div>

              <button
                onclick="claimTask('${id}')"
                ${
                  claimed ||
                  !ready
                    ? "disabled"
                    : ""
                }
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
      )
      .join("");
}

window.claimTask =
  id => {

    toast(
      "Tasks are not connected to the server yet."
    );

  };


/* =====================================================
   LEADERBOARD
   ===================================================== */

function renderLeaderboard() {

  const list =
    $("leaderboard");

  if (!list) return;

  const meName =
    tg?.initDataUnsafe
      ?.user
      ?.first_name ||
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
    names.map(
      (n, i) => ({
        n,
        score: scores[i]
      })
    );

  rows.push({
    n: meName,
    score: state.balance
  });

  rows.sort(
    (a, b) =>
      b.score - a.score
  );

  list.innerHTML =
    rows
      .slice(0, 10)
      .map(
        (r, i) =>
          `
            <div class="rank-row">

              <div class="rank-num">
                ${i + 1}
              </div>

              <div class="rank-avatar">
                ${
                  i < 3
                    ? ["🥇", "🥈", "🥉"][i]
                    : "⛏️"
                }
              </div>

              <div class="rank-user">

                <b>
                  ${escapeHtml(r.n)}
                </b>

                <small>
                  ${
                    i < 3
                      ? "Elite miner"
                      : "Miner"
                  }
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
    c =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[c]
  );
}


/* =====================================================
   SCREENS / NAVIGATION
   ===================================================== */

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
        () =>
          openScreen(
            b.dataset.go
          )
      )
  );


/* =====================================================
   PROFILE
   ===================================================== */

function profile() {

  const u =
    tg?.initDataUnsafe?.user;

  if ($("profileName")) {

    $("profileName").textContent =
      u?.first_name ||
      "Miner";
  }

  if ($("profileUsername")) {

    $("profileUsername").textContent =
      u?.username
        ? "@" + u.username
        : "Telegram Miner";
  }

  if ($("profileAvatar")) {

    $("profileAvatar").textContent =
      u?.emoji_status_custom_emoji_id
        ? "✦"
        : "👤";
  }

  if ($("profileModal")) {

    $("profileModal")
      .classList.remove(
        "hidden"
      );
  }
}

if ($("profileBtn")) {

  $("profileBtn").onclick =
    profile;
}

if ($("closeModal")) {

  $("closeModal").onclick =
    () =>
      $("profileModal")
        ?.classList.add(
          "hidden"
        );
}

if ($("profileModal")) {

  $("profileModal").onclick =
    e => {

      if (
        e.target.id ===
        "profileModal"
      ) {

        $("profileModal")
          .classList.add(
            "hidden"
          );
      }
    };
}


/* =====================================================
   INVITE
   ===================================================== */

function inviteLink() {

  const bot =
    "YOUR_BOT_USERNAME";

  if ($("inviteLink")) {

    $("inviteLink").textContent =
      `https://t.me/${bot}?start=ref_demo`;
  }
}

if ($("copyInvite")) {

  $("copyInvite").onclick =
    async () => {

      try {

        await navigator.clipboard
          .writeText(
            $("inviteLink")
              .textContent
          );

        toast(
          "Invite link copied"
        );

      } catch (e) {

        toast(
          "Copy failed"
        );
      }
    };
}


/* =====================================================
   BOOST TIMER
   ===================================================== */

setInterval(() => {

  if (
    state.boost.until &&
    Date.now() >
      state.boost.until
  ) {

    state.boost = {
      mult: 1,
      until: 0
    };

    render();
  }

}, 1000);


/* =====================================================
   START APP
   ===================================================== */

inviteLink();

render();

bootServer();
