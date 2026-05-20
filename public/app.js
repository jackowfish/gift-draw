const $ = (id) => document.getElementById(id);

const store = {
  get(roomId) {
    try {
      return JSON.parse(localStorage.getItem(`gd:${roomId}`) || "null");
    } catch { return null; }
  },
  set(roomId, data) {
    localStorage.setItem(`gd:${roomId}`, JSON.stringify(data));
  },
};

const profile = {
  get() {
    try {
      return JSON.parse(localStorage.getItem("gd:profile") || "null") || {};
    } catch { return {}; }
  },
  set(p) {
    localStorage.setItem("gd:profile", JSON.stringify(p));
  },
};

let socket = null;
let me = { roomId: null, memberId: null, isHost: false };
let latest = null;
let updateTimer = null;

function show(el) { el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden"); }

function isEmailValid(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function hashCode() {
  return location.hash.length > 1 ? location.hash.slice(1).toUpperCase() : "";
}

function applyHashMode() {
  const code = hashCode();
  const p = profile.get();
  if (p.name && !$("name").value) $("name").value = p.name;
  if (p.email && !$("email").value) $("email").value = p.email;

  if (code) {
    $("createBlock").classList.add("hidden");
    $("joinBlock").classList.remove("hidden");
    $("lobbyTagline").classList.add("hidden");
    $("joinBanner").classList.remove("hidden");
    $("joinBannerCode").textContent = code;
    $("joinCode").value = code;
    setTimeout(() => {
      if (!$("name").value) $("name").focus();
      else if (!$("email").value) $("email").focus();
    }, 50);
  } else {
    $("createBlock").classList.remove("hidden");
    $("joinBlock").classList.add("hidden");
    $("lobbyTagline").classList.remove("hidden");
    $("joinBanner").classList.add("hidden");
  }
  if (typeof syncLobbyEmailVisibility === "function") syncLobbyEmailVisibility();
}

async function createRoom() {
  const name = $("name").value.trim();
  const email = $("email").value.trim();
  const occasion = $("occasion").value.trim();
  const collectEmails = $("collectEmails").checked;
  if (!name) { $("lobbyErr").textContent = "enter your name"; return; }
  if (collectEmails && (!email || !isEmailValid(email))) {
    $("lobbyErr").textContent = "enter a valid email"; return;
  }
  profile.set({ name, email });

  const res = await fetch("/api/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, occasion, collectEmails }),
  });
  if (!res.ok) { $("lobbyErr").textContent = "couldn't create draw"; return; }
  const { roomId, hostId, hostToken } = await res.json();
  store.set(roomId, { memberId: hostId, hostToken });
  location.hash = roomId;
  enterRoom(roomId, { name, email, hostToken });
}

function joinRoom(codeOverride) {
  const code = (codeOverride || $("joinCode").value).trim().toUpperCase();
  const name = $("name").value.trim();
  const email = $("email").value.trim();
  if (!code) { $("lobbyErr").textContent = "enter a draw code"; return; }
  if (!name) { $("lobbyErr").textContent = "enter your name"; return; }
  // Email is optional at join time - the room may not collect emails. If one
  // was typed, it has to look valid though.
  if (email && !isEmailValid(email)) { $("lobbyErr").textContent = "enter a valid email"; return; }
  profile.set({ name, email });
  location.hash = code;
  enterRoom(code, { name, email });
}

function enterRoom(roomId, { name, email, hostToken } = {}) {
  $("lobbyErr").textContent = "";
  const saved = store.get(roomId) || {};
  hostToken = hostToken || saved.hostToken;
  me = { roomId, memberId: saved.memberId || null, isHost: false };

  let firstJoin = true;
  socket = io();

  const doJoin = () => {
    socket.emit(
      "join",
      { roomId, name, email, memberId: me.memberId, hostToken },
      (resp) => {
        if (resp?.error) {
          if (firstJoin) {
            $("lobbyErr").textContent = resp.error;
            socket.disconnect();
            location.hash = "";
          }
          return;
        }
        me.memberId = resp.memberId;
        me.isHost = !!resp.isHost;
        store.set(roomId, {
          memberId: resp.memberId,
          hostToken: hostToken || saved.hostToken,
        });
        if (firstJoin) {
          firstJoin = false;
          hide($("lobby"));
          show($("room"));
          $("roomId").textContent = roomId;
          $("youAre").textContent = me.isHost ? "Host" : "Guest";
          $("myName").value = name || "";
          $("myEmail").value = email || "";
          if (me.isHost) {
            show($("hostRow"));
            show($("skipDrawRow"));
          }
        }
      }
    );
  };

  socket.on("connect", doJoin);
  socket.on("state", (s) => { latest = s; render(); });
}

function render() {
  if (!latest) return;
  const s = latest;
  const drawn = s.state === "drawn";
  const collectEmails = s.collectEmails !== false;

  $("stateLabel").textContent = drawn ? "Drawn" : "Collecting";
  $("stateLabel").classList.toggle("drawn", drawn);

  const inDraw = s.members.filter((m) => !m.skipDraw);
  const readyCount = inDraw.filter((m) => m.ready).length;
  $("counts").textContent = `${readyCount}/${inDraw.length} ready`;

  if (s.occasion) {
    show($("occasionLine"));
    $("occasionLine").textContent = s.occasion;
  } else {
    hide($("occasionLine"));
  }

  const meMember = s.members.find((m) => m.id === me.memberId);
  if (meMember) {
    // Email field hides entirely when the room isn't collecting emails, and
    // also for a host who's opted out of the draw.
    const hideEmailField =
      !collectEmails || (me.isHost && !!meMember.skipDraw);
    $("myEmailField").classList.toggle("hidden", hideEmailField);
    if (me.isHost) {
      $("skipDraw").checked = !!meMember.skipDraw;
    }
    if (meMember.skipDraw) {
      $("myStatus").textContent = "You won't get a pick, just running the draw.";
    } else if (meMember.ready) {
      $("myStatus").textContent = "You're ready ✓";
    } else if (collectEmails) {
      $("myStatus").textContent = "Fill in your name and email so the host can draw.";
    } else {
      $("myStatus").textContent = "Add your name so the host can draw.";
    }
  }

  if (drawn) {
    hide($("myInfo"));
    if (s.yourPick) {
      show($("result"));
      $("pickName").textContent = s.yourPick.name;
      $("pickDetail").textContent = collectEmails
        ? "Check your inbox for the same info."
        : "Keep this on screen, the draw doesn't send any emails.";
    } else if (meMember && meMember.skipDraw) {
      show($("result"));
      $("pickName").textContent = "🎁";
      $("pickDetail").textContent = "You sat this one out, everyone else got their pick.";
    } else if (meMember) {
      show($("result"));
      $("pickName").textContent = "—";
      $("pickDetail").textContent = "You didn't fill in your info in time.";
    }
  } else {
    show($("myInfo"));
    hide($("result"));
  }

  if (me.isHost) {
    show($("hostRow"));
    $("resetBtn").classList.toggle("hidden", !drawn);
    $("drawBtn").classList.toggle("hidden", drawn);
    $("drawBtn").disabled = readyCount < 2;
  }

  const ul = $("members");
  ul.innerHTML = "";
  for (const m of s.members) {
    const li = document.createElement("li");
    if (m.skipDraw) li.classList.add("skip");
    else if (m.ready) li.classList.add("ready");
    const tags = [];
    if (m.id === me.memberId) tags.push(`<span class="you-tag">you</span>`);
    if (m.isHost) tags.push(`<span class="host-tag">host</span>`);
    if (m.skipDraw) tags.push(`<span class="skip-tag">not in draw</span>`);
    const name = m.name || "…";
    const status = m.skipDraw
      ? "Running the draw"
      : (m.ready ? "Ready ✓" : "Needs info");
    const kick = me.isHost && !m.isHost && m.id !== me.memberId && !drawn
      ? `<button class="kick-btn" data-id="${m.id}" title="remove">✕</button>`
      : "";
    li.innerHTML = `
      <div class="m-name">${escapeHtml(name)} ${tags.join(" ")}</div>
      <div class="m-status">${status}</div>
      ${kick}
    `;
    ul.appendChild(li);
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

function scheduleMyInfoUpdate(immediate = false) {
  clearTimeout(updateTimer);
  const fire = () => {
    if (!socket) return;
    const name = $("myName").value.trim();
    const email = $("myEmail").value.trim();
    profile.set({ name, email });
    const payload = { name, email };
    if (me.isHost) payload.skipDraw = $("skipDraw").checked;
    socket.emit("update", payload, (r) => {
      if (r?.error) console.warn(r.error);
    });
  };
  if (immediate) fire();
  else updateTimer = setTimeout(fire, 300);
}

function syncLobbyEmailVisibility() {
  // In create mode, the host's own email is only needed if they're going
  // to email picks out. In join mode, the email field stays visible but
  // optional since we don't know the room's setting until we connect.
  const inJoinMode = !$("joinBlock").classList.contains("hidden");
  const hide = !inJoinMode && !$("collectEmails").checked;
  $("emailField").classList.toggle("hidden", hide);
}
$("collectEmails").addEventListener("change", syncLobbyEmailVisibility);

$("create").addEventListener("click", createRoom);
$("join").addEventListener("click", () => joinRoom());
$("joinHash").addEventListener("click", () => joinRoom(hashCode()));
$("backToMain").addEventListener("click", () => {
  history.replaceState(null, "", location.pathname);
  applyHashMode();
});
window.addEventListener("hashchange", applyHashMode);

$("myName").addEventListener("input", () => scheduleMyInfoUpdate());
$("myEmail").addEventListener("input", () => scheduleMyInfoUpdate());
$("myName").addEventListener("blur", () => scheduleMyInfoUpdate());
$("myEmail").addEventListener("blur", () => scheduleMyInfoUpdate());
$("skipDraw").addEventListener("change", () => {
  const skip = $("skipDraw").checked;
  $("myEmailField").classList.toggle("hidden", skip);
  scheduleMyInfoUpdate(true);
});

$("drawBtn").addEventListener("click", () => {
  $("drawBtn").disabled = true;
  socket.emit("draw", {}, (r) => {
    $("drawBtn").disabled = false;
    if (r?.error) { alert(r.error); return; }
    if (r?.emailErrors?.length) {
      alert(`draw done, but emails failed for: ${r.emailErrors.join(", ")}`);
    }
  });
});

$("resetBtn").addEventListener("click", () => {
  if (!confirm("redraw will wipe the previous draw. continue?")) return;
  socket.emit("reset", {}, (r) => { if (r?.error) alert(r.error); });
});

$("members").addEventListener("click", (e) => {
  const btn = e.target.closest(".kick-btn");
  if (!btn) return;
  const id = btn.dataset.id;
  if (!id) return;
  if (!confirm("remove this person from the hat?")) return;
  socket.emit("kick", { memberId: id }, (r) => { if (r?.error) alert(r.error); });
});

$("copyLink").addEventListener("click", async () => {
  const url = `${location.origin}/#${me.roomId}`;
  try {
    await navigator.clipboard.writeText(url);
    $("copyLink").textContent = "Copied!";
    setTimeout(() => ($("copyLink").textContent = "Copy invite"), 1500);
  } catch {}
});

applyHashMode();
