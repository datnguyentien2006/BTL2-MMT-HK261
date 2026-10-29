/* CCC NOC · operations layer
   Simulation state, routing, overlays, telemetry and the action surface
   for CCC-Hospital.pkt. All data comes from assets/data.js. */

(function () {
  "use strict";

  const D = window.CCC;
  if (!D) return;

  /* ------------------------------------------------------------------ *
   * Small utilities
   * ------------------------------------------------------------------ */

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ESCAPES[c]);
  const icon = (name, cls = "icon") => `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const pad = (s, n) => String(s).padEnd(n, " ");
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-");

  let seq = 0;
  const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${++seq}`;

  const cleanIp = (v) => String(v || "").trim().split(/\s+/).pop().replace(/\/\d+$/, "");

  function fmtAgo(ts) {
    if (!ts) return "never";
    const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
    if (!prefs.relativeTime) {
      return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
    }
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  function fmtClock(ts) {
    return new Date(ts).toLocaleTimeString([], {
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
    });
  }

  function truncate(text, max) {
    const value = String(text || "");
    return value.length > max ? `${value.slice(0, max - 1)}…` : value;
  }

  function readPrefs() {
    try {
      return JSON.parse(localStorage.getItem("ccc-prefs") || "{}") || {};
    } catch (error) {
      return {};
    }
  }

  const prefs = Object.assign(
    {
      theme: document.documentElement.dataset.theme === "light" ? "light" : "dark",
      density: "comfortable",
      confirm: true,
      reduceMotion: false,
      relativeTime: true,
      live: true,
      interval: 4000,
      nightlyBackup: true
    },
    readPrefs()
  );

  function savePrefs() {
    try {
      localStorage.setItem("ccc-prefs", JSON.stringify(prefs));
    } catch (error) { /* storage unavailable */ }
  }

  /* ------------------------------------------------------------------ *
   * Domain lookups
   * ------------------------------------------------------------------ */

  const KIND_ICON = {
    router: "router", switch: "switch", server: "server", pc: "pc", laptop: "laptop",
    ap: "ap", printer: "printer", cctv: "cctv", camera: "cctv", cloud: "cloud", cluster: "cluster"
  };

  const KIND_LABEL = {
    router: "Router", switch: "Switch", server: "Server", pc: "Workstation", laptop: "Laptop",
    ap: "Access point", printer: "Printer", cctv: "IP camera", camera: "IP camera",
    cloud: "Cloud", cluster: "Cluster"
  };

  const KIND_TAG = {
    router: "tag-blue", switch: "tag-sky", server: "tag-violet", pc: "tag-grey",
    laptop: "tag-grey", ap: "tag-sky", printer: "tag-grey", cctv: "tag-cctv"
  };

  const SITE_ORDER = ["Main site", "DBP Street", "BHTQ Street", "Internet", "Teleworker"];
  const KIND_ORDER = { router: 0, switch: 1, server: 2, ap: 3, pc: 4, laptop: 5, printer: 6, cctv: 7, camera: 7 };

  const nodeById = new Map(D.nodes.map((n) => [n.id, n]));

  const WAN_ENTRIES = [
    {
      key: "isp1|r-edge|internet", name: "ISP1 uplink", addr: "203.0.113.2 /30",
      path: "R-EDGE-MS Gi0/0 → ISP1 Gi0/0", medium: "Internet", device: "r-edge",
      role: "Internet · PAT overload"
    },
    {
      key: "isp2|r-edge|internet", name: "ISP2 uplink", addr: "203.0.114.2 /30",
      path: "R-EDGE-MS Gi0/1 → ISP2 Gi0/0", medium: "Internet", device: "r-edge",
      role: "Floating static AD 50", backupFor: "isp1|r-edge|internet"
    },
    {
      key: "r-wan|r-dbp|mpls", name: "DBP · MPLS EPL", addr: "10.254.0.1/30 ↔ .2",
      path: "R-WAN-MS Gi0/0/1 → R-DBP Gi0/1", medium: "MPLS", device: "r-wan",
      role: "Primary · OSPF cost 1"
    },
    {
      key: "r-wan|r-dbp|serial", name: "DBP · serial", addr: "10.255.0.1/30 ↔ .2",
      path: "R-WAN-MS S0/1/0 → R-DBP S0/0/0", medium: "Serial", device: "r-wan",
      role: "Backup · 2 Mbps", backupFor: "r-wan|r-dbp|mpls"
    },
    {
      key: "r-wan|r-bhtq|mpls", name: "BHTQ · MPLS EPL", addr: "10.254.0.5/30 ↔ .6",
      path: "R-WAN-MS Gi0/0/2 → R-BHTQ Gi0/1", medium: "MPLS", device: "r-wan",
      role: "Primary · OSPF cost 1"
    },
    {
      key: "r-wan|r-bhtq|serial", name: "BHTQ · serial", addr: "10.255.0.5/30 ↔ .6",
      path: "R-WAN-MS S0/2/0 → R-BHTQ S0/0/0", medium: "Serial", device: "r-wan",
      role: "Backup · 2 Mbps", backupFor: "r-wan|r-bhtq|mpls"
    }
  ];

  function memberKind(node, member) {
    if (member.kind) return member.kind;
    if (member.name.startsWith("PRN")) return "printer";
    if (member.name.startsWith("CAM")) return "cctv";
    if (member.name.startsWith("AP")) return "ap";
    return node.kind === "cluster" ? "pc" : node.kind;
  }

  function memberModel(node, member) {
    if (member.kind === "printer" || member.name.startsWith("PRN")) return "Printer-PT";
    if (member.kind === "ap" || member.name.startsWith("AP")) return "AccessPoint-PT";
    if (member.kind === "cctv" || node.id === "cams") return "PC-PT · camera role";
    return (node.model || "PC-PT").split(" / ")[0];
  }

  function primaryIp(node) {
    if (D.mgmt[node.id]) return D.mgmt[node.id];
    const first = (node.ips || []).find(Boolean);
    return first ? cleanIp(first) : "—";
  }

  const inventory = [];

  D.nodes.forEach((node) => {
    if (node.kind === "cloud") return;
    const members = D.clusterMembers[node.id];
    if (members && members.length) {
      members.forEach((member) => {
        const kind = memberKind(node, member);
        inventory.push({
          id: `${node.id}:${slug(member.name)}`,
          nodeId: node.id,
          name: member.name,
          kind,
          site: node.site,
          zone: node.zone,
          model: memberModel(node, member),
          ip: member.ip || "—",
          mgmt: member.ip && member.ip !== "—" ? member.ip : null,
          vlan: node.vlan,
          config: null,
          role: node.role,
          note: node.note,
          member,
          parent: node
        });
      });
      return;
    }
    inventory.push({
      id: node.id,
      nodeId: node.id,
      name: node.name,
      kind: node.kind,
      site: node.site,
      zone: node.zone,
      model: node.model,
      ip: primaryIp(node),
      mgmt: D.mgmt[node.id] || null,
      vlan: node.vlan,
      config: node.config || null,
      role: node.role,
      note: node.note,
      member: null,
      parent: node
    });
  });

  D.extraDevices.forEach((device) => {
    inventory.push({
      id: device.id,
      nodeId: device.nodeId,
      name: device.name,
      kind: device.kind,
      site: device.site,
      zone: device.site,
      model: device.model,
      ip: device.mgmt,
      mgmt: device.mgmt,
      vlan: "—",
      config: device.config || null,
      role: device.role,
      note: "Home-office access switch behind AP-HOME.",
      member: null,
      parent: nodeById.get(device.nodeId)
    });
  });

  const siteRank = (site) => {
    const index = SITE_ORDER.indexOf(site);
    return index === -1 ? SITE_ORDER.length : index;
  };

  inventory.sort((a, b) => {
    const site = siteRank(a.site) - siteRank(b.site);
    if (site) return site;
    const kind = (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9);
    if (kind) return kind;
    return a.name.localeCompare(b.name);
  });

  const inventoryById = new Map(inventory.map((device) => [device.id, device]));

  /* ------------------------------------------------------------------ *
   * State
   * ------------------------------------------------------------------ */

  function createState() {
    const now = Date.now();
    return {
      simRunning: true,
      mbps: 612,
      linksDown: new Set(),
      pending: new Map(),
      deploying: false,
      events: D.seedEvents.map((event, index) => ({
        ...event, id: uid("ev"), ts: now - event.minutesAgo * 60000, read: index >= 3
      })),
      alerts: D.seedAlerts.map((alert) => ({
        ...alert, id: uid("al"), ts: now - alert.minutesAgo * 60000, read: false
      })),
      snapshots: D.snapshots.map((snap) => ({
        ...snap, ts: now - snap.minutesAgo * 60000
      })),
      aclExtra: [],
      extraVlans: { main: [], dbp: [], bhtq: [] },
      hardenFixes: new Set(),
      violations: {},
      drills: { epl: null, isp: null, guest: null },
      lastHealth: { ts: now - 96 * 60000, passed: 6 }
    };
  }

  let state = createState();

  const ui = {
    route: "dashboard",
    deviceQ: "",
    deviceSite: "all",
    deviceType: "all",
    eventSev: "all",
    eventCat: "all",
    eventQ: "",
    vlanSite: "main",
    aclTab: "150",
    routeFilter: "all",
    trafficRange: "24h",
    zoom: 1,
    labels: true,
    selection: null
  };

  let activeDrawer = null;
  let drawerFocus = null;
  let modalOnClose = null;
  let lastFocus = null;
  let runId = 0;
  let telemetryTimer = null;
  let paletteState = null;

  /* ------------------------------------------------------------------ *
   * Theme & preferences
   * ------------------------------------------------------------------ */

  function setTheme(theme, options = {}) {
    prefs.theme = theme === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = prefs.theme;
    if (options.persist !== false) {
      try { localStorage.setItem("ccc-theme", prefs.theme); } catch (error) { /* ignore */ }
      savePrefs();
    }
    const button = document.querySelector("[data-theme-toggle]");
    if (button) {
      const light = prefs.theme === "light";
      button.setAttribute("aria-pressed", String(light));
      button.setAttribute("aria-label", light ? "Switch to dark theme" : "Switch to light theme");
    }
  }

  function applyPrefs() {
    document.documentElement.dataset.density = prefs.density;
    document.body.classList.toggle("reduce-motion", !!prefs.reduceMotion);
    setTheme(prefs.theme, { persist: false });
  }

  /* ------------------------------------------------------------------ *
   * Network helpers
   * ------------------------------------------------------------------ */

  const linkKey = (link) => `${link.a}|${link.b}|${link.type}`;

  function linkLabel(link) {
    const override = D.linkById[linkKey(link)];
    return (override && override.label) || link.label || `${link.a} — ${link.b}`;
  }

  function linkByKey(key) {
    return D.links.find((link) => linkKey(link) === key) || null;
  }

  function nodeLinks(nodeId) {
    return D.links.filter((link) => link.a === nodeId || link.b === nodeId);
  }

  function otherNode(link, nodeId) {
    return nodeById.get(link.a === nodeId ? link.b : link.a);
  }

  function nodeStatus(nodeId) {
    const links = nodeLinks(nodeId);
    if (!links.length) return { tone: "success", label: "Online", down: 0, total: 0 };
    const down = links.filter((link) => state.linksDown.has(linkKey(link))).length;
    if (down === links.length) return { tone: "danger", label: "Isolated", down, total: links.length };
    if (down > 0) return { tone: "warning", label: "Degraded", down, total: links.length };
    return { tone: "success", label: "Online", down, total: links.length };
  }

  function nodeHasPending(nodeId) {
    for (const change of state.pending.values()) {
      if (change.type === "link" && (change.a === nodeId || change.b === nodeId)) return true;
      if (change.type === "device" && change.deviceId === nodeId) return true;
    }
    return false;
  }

  function wanState(entry) {
    const pending = state.pending.get(`link:${entry.key}`);
    if (pending) {
      return {
        tone: "warning",
        label: pending.desiredDown ? "Staged · isolate" : "Staged · restore"
      };
    }
    if (state.linksDown.has(entry.key)) return { tone: "danger", label: "Isolated" };
    if (entry.backupFor) {
      const primaryDown = state.linksDown.has(entry.backupFor);
      return primaryDown
        ? { tone: "warning", label: "Active · backup" }
        : { tone: "idle", label: "Standby" };
    }
    return { tone: "success", label: "Active" };
  }

  function siteHealthRows() {
    const isp1 = state.linksDown.has("isp1|r-edge|internet");
    const isp2 = state.linksDown.has("isp2|r-edge|internet");
    const internetTone = isp1 && isp2 ? "danger" : isp1 || isp2 ? "warning" : "success";
    const internetLabel = isp1 && isp2 ? "Dual ISP down" : isp1 || isp2 ? "Single ISP" : "Operational";

    const branch = (mpls, serial) => {
      const a = state.linksDown.has(mpls);
      const b = state.linksDown.has(serial);
      if (a && b) return { tone: "danger", label: "WAN down" };
      if (a || b) return { tone: "warning", label: "On backup" };
      return { tone: "success", label: "Operational" };
    };

    return [
      {
        name: "Main site", sub: "CCC Hospital HQ", devices: inventory.filter((d) => d.site === "Main site").length,
        vlans: 7, wan: "Dual ISP · MPLS hub", status: { tone: internetTone, label: internetLabel }
      },
      {
        name: "DBP Street", sub: "Auxiliary 01", devices: inventory.filter((d) => d.site === "DBP Street").length,
        vlans: 3, wan: "MPLS + serial", status: branch("r-wan|r-dbp|mpls", "r-wan|r-dbp|serial")
      },
      {
        name: "BHTQ Street", sub: "Auxiliary 02", devices: inventory.filter((d) => d.site === "BHTQ Street").length,
        vlans: 3, wan: "MPLS + serial", status: branch("r-wan|r-bhtq|mpls", "r-wan|r-bhtq|serial")
      },
      {
        name: "Internet & home", sub: "External", devices: inventory.filter((d) => d.site === "Internet" || d.site === "Teleworker").length,
        vlans: 0, wan: "ISP1 · ISP2 · DSL", status: { tone: "success", label: "Linked" }
      }
    ];
  }

  function computeHealth() {
    const down = (key) => state.linksDown.has(key);
    return D.verification.map((item) => {
      const check = { kc: item.kc, title: item.title, ok: true, note: "" };
      if (item.kc === "KC-2") {
        const dbp = down("r-wan|r-dbp|mpls") && down("r-wan|r-dbp|serial");
        const bhtq = down("r-wan|r-bhtq|mpls") && down("r-wan|r-bhtq|serial");
        if (dbp || bhtq) {
          check.ok = false;
          check.note = dbp ? "DBP has no WAN path" : "BHTQ has no WAN path";
        }
      }
      if (item.kc === "KC-3" && down("isp1|r-edge|internet") && down("isp2|r-edge|internet")) {
        check.ok = false;
        check.note = "Both ISP uplinks isolated";
      }
      if (item.kc === "KC-4" && down("sw-b|ap-b|copper")) {
        check.ok = false;
        check.note = "Guest AP uplink down";
      }
      if (item.kc === "KC-5" && (down("sw-core|sw-dmz|fiber") || down("sw-dmz|web-dmz|copper"))) {
        check.ok = false;
        check.note = "DMZ web path interrupted";
      }
      return check;
    });
  }

  function ospfRows() {
    return D.ospf.map((row) => {
      const result = { ...row, state: "FULL", tone: "success", note: "" };
      if (row.local === "R-CORE-MS" && state.linksDown.has("r-core|r-wan|routed")) {
        result.state = "DOWN";
        result.tone = "danger";
        result.note = "Gi0/2 isolated";
      }
      if (row.neighbor === "R-DBP") {
        const primary = state.linksDown.has("r-wan|r-dbp|mpls");
        const backup = state.linksDown.has("r-wan|r-dbp|serial");
        if (primary && backup) {
          result.state = "DOWN";
          result.tone = "danger";
          result.note = "Both paths isolated";
        } else if (primary) {
          result.note = `Failover via ${row.backupIface} · ${row.backupAddr}`;
          result.tone = "warning";
        }
      }
      if (row.neighbor === "R-BHTQ") {
        const primary = state.linksDown.has("r-wan|r-bhtq|mpls");
        const backup = state.linksDown.has("r-wan|r-bhtq|serial");
        if (primary && backup) {
          result.state = "DOWN";
          result.tone = "danger";
          result.note = "Both paths isolated";
        } else if (primary) {
          result.note = `Failover via ${row.backupIface} · ${row.backupAddr}`;
          result.tone = "warning";
        }
      }
      return result;
    });
  }

  function hardeningRows() {
    return D.hardening.map((row) => ({
      ...row,
      ntp: row.ntp || state.hardenFixes.has(row.device)
    }));
  }

  const SITE_KEYS = { main: "Main site", dbp: "DBP Street", bhtq: "BHTQ Street" };
  const SITE_LABELS = { main: "Main site", dbp: "DBP Street", bhtq: "BHTQ Street" };

  function vlanRows(site) {
    return [...D.vlans[site].rows, ...(state.extraVlans[site] || [])];
  }

  function filteredDevices() {
    const query = ui.deviceQ.trim().toLowerCase();
    return inventory.filter((device) => {
      if (ui.deviceSite !== "all" && device.site !== ui.deviceSite) return false;
      if (ui.deviceType !== "all" && device.kind !== ui.deviceType) return false;
      if (!query) return true;
      return [device.name, device.ip, device.model, device.role, device.site, device.vlan]
        .some((value) => String(value || "").toLowerCase().includes(query));
    });
  }

  function filteredEvents() {
    const query = ui.eventQ.trim().toLowerCase();
    return state.events.filter((event) => {
      if (ui.eventSev !== "all" && event.severity !== ui.eventSev) return false;
      if (ui.eventCat !== "all" && event.category !== ui.eventCat) return false;
      if (!query) return true;
      return `${event.message} ${event.source} ${event.category}`.toLowerCase().includes(query);
    });
  }

  function snapshotBytes() {
    return state.snapshots.reduce((sum, snap) => sum + (parseFloat(snap.size) || 0), 0);
  }

  /* ------------------------------------------------------------------ *
   * Chrome
   * ------------------------------------------------------------------ */

  function syncChrome() {
    const route = ROUTES.find((item) => item.id === ui.route) || ROUTES[0];
    const crumb = $("#crumb");
    if (crumb) crumb.textContent = route.label;

    $$("[data-nav]").forEach((link) => {
      const active = link.dataset.nav === route.id;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });

    const devicesBadge = document.querySelector("[data-badge-devices]");
    if (devicesBadge) devicesBadge.textContent = String(inventory.length);

    const unread = state.events.filter((event) => !event.read).length;
    const eventsBadge = document.querySelector("[data-badge-events]");
    if (eventsBadge) {
      eventsBadge.textContent = String(unread);
      eventsBadge.hidden = unread === 0;
    }

    const backupsBadge = document.querySelector("[data-badge-backups]");
    if (backupsBadge) {
      backupsBadge.textContent = String(state.snapshots.length);
      backupsBadge.hidden = state.snapshots.length === 0;
    }

    const alertDot = document.querySelector("[data-alert-dot]");
    if (alertDot) alertDot.hidden = state.alerts.every((alert) => alert.read);

    const notifDot = document.querySelector("[data-notif-dot]");
    if (notifDot) notifDot.classList.toggle("is-on", state.alerts.some((alert) => !alert.read));

    const deployBtn = $("#deploy-btn");
    if (deployBtn) {
      const count = state.pending.size;
      deployBtn.disabled = count === 0 || state.deploying;
      deployBtn.classList.toggle("is-busy", state.deploying);
      deployBtn.setAttribute("aria-busy", String(state.deploying));
      const countEl = $("#deploy-count");
      if (countEl) countEl.textContent = String(count);
      const label = deployBtn.querySelector("span:not(.deploy-count)");
      if (label) label.textContent = state.deploying ? "Deploying" : "Deploy";
    }

    const pill = $("#sim-pill");
    if (pill) {
      pill.dataset.sim = state.simRunning ? "on" : "paused";
      const label = pill.querySelector(".sim-label");
      if (label) label.textContent = state.simRunning ? "Live" : "Paused";
    }

    const simToggle = $("#sim-toggle");
    if (simToggle) {
      simToggle.setAttribute("aria-label", state.simRunning ? "Pause simulation" : "Resume simulation");
      simToggle.title = state.simRunning ? "Pause simulation" : "Resume simulation";
    }

    document.body.classList.toggle("sim-paused", !state.simRunning);
  }

  function render() {
    const route = ROUTES.find((item) => item.id === ui.route) || ROUTES[0];
    const view = $("#view");
    if (!view) return;
    view.innerHTML = route.view();
    document.title = `${route.label} · CCC NOC`;
    syncChrome();
    afterRender();
  }

  function afterRender() {
    const canvas = $("#topo-canvas");
    if (canvas) canvas.style.width = `${Math.round(ui.zoom * 100)}%`;
    const zoomLabel = $("#zoom-level");
    if (zoomLabel) zoomLabel.textContent = `${Math.round(ui.zoom * 100)}%`;
  }

  function currentRouteId() {
    const raw = (location.hash || "").replace(/^#\/?/, "").split("?")[0];
    return ROUTES.some((item) => item.id === raw) ? raw : "dashboard";
  }

  function onRouteChange(initial) {
    const next = currentRouteId();
    const changed = next !== ui.route;
    ui.route = next;
    closeNav();
    closePopover();
    if (activeDrawer) closeDrawer();
    render();
    if (!initial) {
      window.scrollTo({ top: 0, behavior: "auto" });
      const view = $("#view");
      if (view) view.focus({ preventScroll: true });
    }
    if (changed && ui.route !== "topology") ui.selection = null;
  }

  /* ------------------------------------------------------------------ *
   * Mobile navigation
   * ------------------------------------------------------------------ */

  function openNav() {
    document.body.classList.add("nav-open");
    const menu = $("[data-menu]");
    if (menu) menu.setAttribute("aria-expanded", "true");
    const scrim = $(".nav-scrim");
    if (scrim) scrim.hidden = false;
    syncScrollLock();
  }

  function closeNav() {
    document.body.classList.remove("nav-open");
    const menu = $("[data-menu]");
    if (menu) menu.setAttribute("aria-expanded", "false");
    const scrim = $(".nav-scrim");
    if (scrim) scrim.hidden = true;
    syncScrollLock();
  }

  /* ------------------------------------------------------------------ *
   * Overlay plumbing
   * ------------------------------------------------------------------ */

  function syncScrollLock() {
    const locked = document.body.classList.contains("nav-open")
      || !!$("#modal-root").children.length
      || !!$("#drawer-root").children.length;
    document.body.classList.toggle("modal-open", locked);
  }

  function openDevice(id, trigger) {
    const resolved = resolveDrawer(id);
    if (!resolved) return;
    drawerFocus = trigger || document.activeElement;
    activeDrawer = id;
    ui.selection = resolved.nodeId;
    renderDrawer();
    if (ui.route === "topology") render();
    if (trigger && trigger.scrollIntoView) { /* keep scroll position */ }
  }

  function renderDrawer() {
    if (!activeDrawer) return;
    const resolved = resolveDrawer(activeDrawer);
    if (!resolved) {
      closeDrawer();
      return;
    }
    $("#drawer-root").innerHTML = drawerHtml(resolved);
    syncScrollLock();
    requestAnimationFrame(() => {
      const closeBtn = $("#drawer-root [data-action='close-drawer']");
      if (closeBtn) closeBtn.focus({ preventScroll: true });
    });
  }

  function closeDrawer() {
    activeDrawer = null;
    $("#drawer-root").innerHTML = "";
    const wasTopology = ui.route === "topology";
    const hadSelection = ui.selection;
    ui.selection = null;
    syncScrollLock();
    if (wasTopology && hadSelection) render();
    if (drawerFocus && drawerFocus.isConnected) {
      drawerFocus.focus({ preventScroll: true });
      drawerFocus = null;
    }
  }

  function openModal(options) {
    if (paletteOpen()) closePalette(false);
    const rid = ++runId;
    lastFocus = document.activeElement;
    modalOnClose = options.onClose || null;
    const wide = options.wide ? "modal--wide" : "";
    const terminal = options.terminal ? "modal--terminal" : "";
    $("#modal-root").innerHTML = `
      <button class="scrim" type="button" data-close-modal tabindex="-1" aria-label="Close dialog"></button>
      <div class="modal ${wide} ${terminal}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header class="modal-head">
          <span class="modal-glyph" aria-hidden="true">${icon(options.glyph || "terminal")}</span>
          <div class="modal-title">
            <h2 id="modal-title">${esc(options.title)}</h2>
            ${options.sub ? `<p>${esc(options.sub)}</p>` : ""}
          </div>
          <button class="icon-btn" type="button" data-action="close-modal" aria-label="Close dialog">${icon("x")}</button>
        </header>
        <div class="modal-body">${options.body || ""}</div>
        <footer class="modal-foot">${options.foot || `<button class="btn btn-quiet" type="button" data-action="close-modal">Close</button>`}</footer>
      </div>`;
    syncScrollLock();
    requestAnimationFrame(() => {
      const target = $("#modal-root .modal-body input, #modal-root .modal-body select, #modal-root .modal-head [data-action='close-modal'], #modal-root .modal-foot .btn-primary");
      if (target) target.focus({ preventScroll: true });
    });
    return rid;
  }

  function closeModal() {
    if (!$("#modal-root").children.length) return;
    runId += 1;
    const onClose = modalOnClose;
    modalOnClose = null;
    $("#modal-root").innerHTML = "";
    syncScrollLock();
    if (onClose) {
      try { onClose(); } catch (error) { /* don't break teardown */ }
    }
    if (lastFocus && lastFocus.isConnected) {
      lastFocus.focus({ preventScroll: true });
      lastFocus = null;
    }
  }

  function toast(title, options = {}) {
    const tone = options.tone || "info";
    const glyph = { success: "check", warning: "alert", danger: "alert", info: "terminal" }[tone] || "terminal";
    const el = document.createElement("div");
    el.className = `toast toast--${tone}`;
    el.innerHTML = `
      <span class="toast-icon" aria-hidden="true">${icon(glyph)}</span>
      <div class="toast-body">
        <strong>${esc(title)}</strong>
        ${options.msg ? `<span class="toast-msg">${esc(options.msg)}</span>` : ""}
        ${options.action ? `<div class="toast-actions"><button class="toast-action" type="button">${esc(options.action.label)}</button></div>` : ""}
      </div>
      <button class="toast-close" type="button" aria-label="Dismiss notification">${icon("x")}</button>`;
    const close = () => el.remove();
    el.querySelector(".toast-close").addEventListener("click", close);
    if (options.action) {
      el.querySelector(".toast-action").addEventListener("click", () => {
        close();
        options.action.run();
      });
    }
    $("#toast-root").append(el);
    setTimeout(close, options.action ? 9000 : 5200);
  }

  /* ------------------------------------------------------------------ *
   * Command palette
   * ------------------------------------------------------------------ */

  function paletteOpen() {
    return !!document.querySelector(".palette-wrap");
  }

  function paletteItems(query) {
    const q = query.trim().toLowerCase();
    const commands = [
      ...ROUTES.map((route) => ({
        group: "Navigate", label: route.label, icon: route.icon, hint: "View",
        run: () => { closePalette(false); location.hash = `#/${route.id}`; }
      })),
      {
        group: "Actions", label: state.simRunning ? "Pause simulation" : "Resume simulation",
        icon: state.simRunning ? "pause" : "play", hint: "Simulation",
        run: () => { closePalette(false); setSim(!state.simRunning); }
      },
      {
        group: "Actions", label: "Run health check", icon: "shield", hint: "KC-1…6",
        run: () => { closePalette(false); runHealth(); }
      },
      {
        group: "Actions", label: "Back up all configurations", icon: "database", hint: "8 devices",
        run: () => { closePalette(false); runBackupAll(); }
      },
      {
        group: "Actions", label: "Run EPL → serial drill", icon: "activity", hint: "DBP",
        run: () => { closePalette(false); runDrill("epl"); }
      },
      {
        group: "Actions", label: "Run ISP1 → ISP2 drill", icon: "globe", hint: "Edge",
        run: () => { closePalette(false); runDrill("isp"); }
      }
    ];

    const commandMatches = commands.filter((item) => !q || item.label.toLowerCase().includes(q));
    const deviceMatches = inventory
      .filter((device) => !q || `${device.name} ${device.ip} ${device.model} ${device.site}`.toLowerCase().includes(q))
      .slice(0, q ? 8 : 5)
      .map((device) => ({
        group: "Devices", label: device.name,
        icon: KIND_ICON[device.kind] || "server",
        hint: `${device.site} · ${device.ip}`,
        run: () => { closePalette(false); openDevice(device.id); }
      }));

    return [...commandMatches, ...deviceMatches];
  }

  function renderPaletteList(query) {
    paletteState.items = paletteItems(query);
    paletteState.active = 0;
    const list = $("#palette-list");
    if (!list) return;
    if (!paletteState.items.length) {
      list.innerHTML = `<div class="palette-empty">No matches for “${esc(query)}”.</div>`;
      return;
    }
    let html = "";
    let lastGroup = "";
    paletteState.items.forEach((item, index) => {
      if (item.group !== lastGroup) {
        html += `<div class="palette-group">${esc(item.group)}</div>`;
        lastGroup = item.group;
      }
      html += `<button class="palette-item" type="button" data-palette-index="${index}">
        ${icon(item.icon)}<span>${esc(item.label)}</span><small>${esc(item.hint || "")}</small>
      </button>`;
    });
    list.innerHTML = html;
    highlightPalette(0);
  }

  function highlightPalette(index) {
    const items = $$("[data-palette-index]", $("#palette-list"));
    if (!items.length) return;
    paletteState.active = (index + items.length) % items.length;
    items.forEach((item, i) => item.classList.toggle("is-active", i === paletteState.active));
    const active = items[paletteState.active];
    if (active && active.scrollIntoView) active.scrollIntoView({ block: "nearest" });
  }

  function openPalette() {
    if (paletteOpen()) return;
    if ($("#modal-root").children.length) closeModal();
    lastFocus = document.activeElement;
    $("#modal-root").innerHTML = `
      <div class="palette-wrap" role="presentation">
        <div class="palette" role="dialog" aria-modal="true" aria-label="Command palette">
          <div class="palette-input">
            ${icon("search")}
            <input id="palette-input" type="text" placeholder="Search devices, views, actions…" autocomplete="off" aria-label="Search commands and devices" aria-controls="palette-list">
            <kbd>esc</kbd>
          </div>
          <div class="palette-list" id="palette-list" role="listbox"></div>
        </div>
      </div>`;
    paletteState = { items: [], active: 0 };
    renderPaletteList("");
    const input = $("#palette-input");
    if (input) {
      input.addEventListener("input", () => renderPaletteList(input.value));
      input.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          highlightPalette(paletteState.active + 1);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          highlightPalette(paletteState.active - 1);
        } else if (event.key === "Enter") {
          event.preventDefault();
          const item = paletteState.items[paletteState.active];
          if (item) item.run();
        }
      });
      input.focus();
    }
    syncScrollLock();
  }

  function closePalette(restoreFocus = true) {
    if (!paletteOpen()) return;
    $("#modal-root").innerHTML = "";
    paletteState = null;
    syncScrollLock();
    if (restoreFocus && lastFocus && lastFocus.isConnected) lastFocus.focus({ preventScroll: true });
  }

  /* ------------------------------------------------------------------ *
   * Notifications popover
   * ------------------------------------------------------------------ */

  function closePopover() {
    $("#popover-root").innerHTML = "";
    const button = document.querySelector('[data-action="notifications"]');
    if (button) button.setAttribute("aria-expanded", "false");
  }

  function renderPopover() {
    const alerts = state.alerts;
    const unread = alerts.filter((alert) => !alert.read).length;
    const list = alerts.length
      ? alerts.map((alert) => `
        <div class="pop-item">
          <span class="dot ${alert.severity === "warning" ? "dot-warning" : alert.severity === "danger" ? "dot-danger" : "dot-accent"}"></span>
          <div>
            <strong>${esc(alert.title)}</strong>
            <p>${esc(alert.detail)}</p>
            <div class="pop-meta">${esc(alert.source)} · ${fmtAgo(alert.ts)}${alert.read ? "" : `<button class="pop-ack" type="button" data-action="ack-alert" data-id="${esc(alert.id)}" aria-label="Mark ${esc(alert.title)} as read">${icon("check")}Mark read</button>`}</div>
          </div>
        </div>`).join("")
      : `<div class="feed-empty">No open alerts. All clear.</div>`;
    $("#popover-root").innerHTML = `
      <div class="pop" role="dialog" aria-label="Notifications">
        <div class="pop-head">
          <h2>Notifications ${unread ? `<span class="tag tag-amber">${unread} new</span>` : ""}</h2>
          <button class="icon-btn" type="button" data-action="close-popover" aria-label="Close notifications">${icon("x")}</button>
        </div>
        <div class="pop-list">${list}</div>
        <div class="pop-foot">
          <button class="btn btn-ghost btn-sm" type="button" data-action="ack-alerts">Mark all read</button>
          <a class="link-arrow" href="#/security" data-close-popover>Open security ${icon("arrow")}</a>
        </div>
      </div>`;
    const button = document.querySelector('[data-action="notifications"]');
    if (button) button.setAttribute("aria-expanded", "true");
  }

  function toggleNotifications() {
    if ($("#popover-root").children.length) {
      closePopover();
      return;
    }
    renderPopover();
  }

  /* ------------------------------------------------------------------ *
   * Terminal
   * ------------------------------------------------------------------ */

  async function playTerminal(options) {
    const rid = openModal({
      title: options.title,
      sub: options.sub,
      glyph: options.glyph || "terminal",
      terminal: true,
      body: `<div class="terminal" id="terminal-out" role="log" aria-live="polite" tabindex="0"></div>`,
      foot: `<span class="foot-status" id="term-status">running…</span><button class="btn btn-quiet" type="button" data-action="close-modal">Close</button>`,
      onClose: options.onClose || null
    });

    const out = $("#terminal-out");
    const cleanups = [];
    let aborted = false;

    const append = (text, cls) => {
      if (!out || rid !== runId) return;
      const line = document.createElement("div");
      line.className = `term-line ${cls || ""}`.trim();
      line.textContent = text;
      out.append(line);
      out.scrollTop = out.scrollHeight;
    };

    const addCleanup = (fn) => cleanups.push(fn);

    try {
      for (const step of options.steps || []) {
        if (rid !== runId) { aborted = true; break; }
        if (step.text != null) append(typeof step.text === "function" ? step.text() : step.text, step.cls);
        if (step.run) step.run({ addCleanup, append });
        await sleep(step.delay == null ? 340 : step.delay);
        if (rid !== runId) { aborted = true; break; }
      }
      if (!aborted && rid === runId) {
        const status = $("#term-status");
        if (status) status.textContent = "complete";
        if (options.onFinish) options.onFinish();
      }
    } finally {
      while (cleanups.length) {
        try { cleanups.pop()(); } catch (error) { /* ignore */ }
      }
    }
  }

  /* ------------------------------------------------------------------ *
   * Terminal content
   * ------------------------------------------------------------------ */

  function padRight(value, width) {
    return String(value).padEnd(width, " ");
  }

  function consoleLines(device) {
    const node = device.parent || nodeById.get(device.nodeId);
    const lines = [];
    lines.push({ text: `CCC-NOC> connect ${device.name} --session read-only`, cls: "term-cmd" });
    lines.push({ text: `Trying ${device.ip} ... 22, open`, cls: "term-dim" });
    lines.push({ text: "Connected · session mirrored from Packet Tracer 9.0.1", cls: "term-dim" });

    if (device.kind === "router") {
      lines.push({ text: `${device.name}# show ip interface brief`, cls: "term-prompt" });
      lines.push({ text: "Interface              IP-Address      OK? Method Status                Protocol", cls: "term-dim" });
      (node && node.ips ? node.ips : []).forEach((entry) => {
        const parts = entry.split(" ");
        const name = parts.length > 1 ? parts[0] : "Gi0/0";
        const addr = parts.length > 1 ? parts[1] : parts[0];
        lines.push({ text: `${padRight(name, 22)} ${padRight(addr, 15)} YES NVRAM  up                    up`, cls: "" });
      });
      lines.push({ text: `${device.name}# show version | include IOS`, cls: "term-prompt" });
      lines.push({ text: `Cisco IOS Software, ${device.model} — simulation image`, cls: "term-dim" });
    } else if (device.kind === "switch") {
      lines.push({ text: `${device.name}# show vlan brief`, cls: "term-prompt" });
      lines.push({ text: "VLAN Name                             Status    Ports", cls: "term-dim" });
      const vlanList = device.vlan && device.vlan !== "—" ? String(device.vlan) : "1 · default";
      lines.push({ text: `${padRight(vlanList, 5)} ${padRight(device.name, 30)} active    Gi0/1-24`, cls: "" });
      lines.push({ text: `${device.name}# show port-security | include Total`, cls: "term-prompt" });
      lines.push({ text: "Total secure MAC addresses: 24", cls: "term-dim" });
    } else if (device.kind === "server") {
      lines.push({ text: `admin@${slug(device.name)}:~$ ip -brief addr`, cls: "term-prompt" });
      lines.push({ text: `eth0  UP  ${device.ip}/24`, cls: "term-dim" });
      lines.push({ text: `admin@${slug(device.name)}:~$ systemctl is-active hospital-agent`, cls: "term-prompt" });
      lines.push({ text: "active", cls: "term-ok" });
    } else {
      lines.push({ text: `${device.name}> ping 10.10.20.6`, cls: "term-prompt" });
      lines.push({ text: "4 packets transmitted, 4 received, 0% loss", cls: "term-ok" });
      lines.push({ text: `${device.name}> ipconfig`, cls: "term-prompt" });
      lines.push({ text: `IPv4 Address: ${device.ip}  ·  Gateway: 10.10.20.1`, cls: "term-dim" });
    }

    lines.push({ text: `${device.name}> exit`, cls: "term-prompt" });
    lines.push({ text: "Connection closed · read-only mirror", cls: "term-dim" });
    return lines;
  }

  function runConsole(deviceId) {
    const device = inventoryById.get(deviceId) || inventory.find((item) => item.nodeId === deviceId);
    if (!device) return;
    const lines = consoleLines(device);
    playTerminal({
      title: `Console · ${device.name}`,
      sub: `${device.model} · ${device.ip} · read-only`,
      steps: lines.map((line) => ({ text: line.text, cls: line.cls, delay: 170 })),
      glyph: "terminal"
    });
  }

  /* ------------------------------------------------------------------ *
   * View helpers
   * ------------------------------------------------------------------ */

  const nodeName = (id) => {
    const node = nodeById.get(id);
    return node ? node.name : id;
  };

  function initials(name) {
    return String(name).split(/[-_ ]+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  }

  function statusPill(tone, label) {
    return `<span class="status is-${tone}"><span class="dot"></span>${esc(label)}</span>`;
  }

  function checkIcon(on, yes = "check", no = "x") {
    return on
      ? `<span class="check on" role="img" aria-label="Enabled">${icon(yes)}</span>`
      : `<span class="check off" role="img" aria-label="Missing">${icon(no)}</span>`;
  }

  function pageHead(options) {
    return `
      <header class="page-head">
        <div>
          <div class="eyebrow">${icon(options.icon || "grid")}${esc(options.eyebrow || "")}</div>
          <h1>${esc(options.title)}</h1>
          ${options.sub ? `<p class="page-sub">${esc(options.sub)}</p>` : ""}
        </div>
        ${options.actions ? `<div class="page-actions">${options.actions}</div>` : ""}
      </header>`;
  }

  function panelHead(title, sub, tools, glyph) {
    return `
      <div class="panel-head">
        <div class="panel-title">${glyph ? icon(glyph) : ""}<div>${esc(title)}${sub ? `<div class="panel-sub">${esc(sub)}</div>` : ""}</div></div>
        ${tools ? `<div class="panel-tools">${tools}</div>` : ""}
      </div>`;
  }

  function selectField(options) {
    return `<select class="select" ${options.attrs || ""} aria-label="${esc(options.label)}">${options.items.map((item) => `<option value="${esc(item.value)}"${item.value === options.value ? " selected" : ""}${item.disabled ? " disabled" : ""}>${esc(item.label)}</option>`).join("")}</select>`;
  }

  function stageTag(type) {
    return `<span class="tag tag-amber">${icon("clock")} Staged</span>`;
  }


  /* ---- Topology SVG -------------------------------------------------- */

  const layout = {};

  D.nodes.forEach((node) => {
    layout[node.id] = { x: node.x, y: node.y, w: 128, h: 46 };
  });

  function nodePos(id) {
    const box = layout[id];
    return box ? { x: box.x + box.w / 2, y: box.y + box.h / 2 } : { x: 0, y: 0 };
  }

  function routedPath(points) {
    const r = 16;
    let d = `M ${Math.round(points[0].x)} ${Math.round(points[0].y)}`;
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const cur = points[i];
      const next = points[i + 1];
      const inLen = Math.hypot(cur.x - prev.x, cur.y - prev.y) || 1;
      const outLen = Math.hypot(next.x - cur.x, next.y - cur.y) || 1;
      const rr = Math.min(r, inLen / 2, outLen / 2);
      const sx = cur.x - ((cur.x - prev.x) / inLen) * rr;
      const sy = cur.y - ((cur.y - prev.y) / inLen) * rr;
      const ex = cur.x + ((next.x - cur.x) / outLen) * rr;
      const ey = cur.y + ((next.y - cur.y) / outLen) * rr;
      d += ` L ${Math.round(sx)} ${Math.round(sy)} Q ${Math.round(cur.x)} ${Math.round(cur.y)} ${Math.round(ex)} ${Math.round(ey)}`;
    }
    const last = points[points.length - 1];
    d += ` L ${Math.round(last.x)} ${Math.round(last.y)}`;
    return d;
  }

  function linkPath(link, bendOverride) {
    const a = nodePos(link.a);
    const b = nodePos(link.b);
    if (link.via && link.via.length) return routedPath([a, ...link.via, b]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const len = Math.hypot(dx, dy) || 1;
    const bend = bendOverride == null ? Math.min(42, len * 0.18) : bendOverride;
    const cx = mx - (dy / len) * bend;
    const cy = my + (dx / len) * bend;
    return `M ${Math.round(a.x)} ${Math.round(a.y)} Q ${Math.round(cx)} ${Math.round(cy)} ${Math.round(b.x)} ${Math.round(b.y)}`;
  }

  function overlayLinks() {
    return D.links;
  }

  function nodeClasses(node) {
    const status = nodeStatus(node.id);
    const down = status.tone === "danger" ? " is-down" : "";
    return `node${node.id === "sw-home" ? " node--extra" : ""}${ui.selection === node.id ? " is-selected" : ""}${nodeHasPending(node.id) ? " is-pending" : ""}${down}`;
  }

  function nodeGlyphSvg(node) {
    const box = layout[node.id];
    if (!box) return "";
    const led = nodeStatus(node.id).tone === "danger" ? "var(--danger)" : nodeHasPending(node.id) ? "var(--warning)" : "var(--success)";
    const glyph = {
      router: `<circle cx="12" cy="12" r="5" fill="none"/><path d="M12 8.6v6.8M8.6 12h6.8M17.6 8.4l1.2-1.2M17.6 15.6l1.2 1.2M6.4 8.4 5.2 7.2M6.4 15.6l-1.2 1.2"/>`,
      cloud: `<path d="M6 15a3.4 3.4 0 0 1-.3-6.8 5 5 0 0 1 9.5 1.5A3 3 0 0 1 15 15H6Z"/>`,
      switch: `<rect x="5" y="9" width="14" height="6" rx="1.6"/><path d="M8 12h.01M11 12h.01M14 12h.01M17 12h.01"/>`,
      ap: `<path d="M7 12a7 7 0 0 1 10 0M9.4 14.2a4 4 0 0 1 5.2 0"/><circle cx="12" cy="17" r="1"/>`
    }[node.kind] || (node.kind === "cluster"
      ? `<rect x="6" y="6" width="7" height="7" rx="1.4"/><rect x="11" y="11" width="7" height="7" rx="1.4"/>`
      : node.kind === "server"
        ? `<rect x="6" y="5" width="12" height="6" rx="1.4"/><rect x="6" y="13" width="12" height="6" rx="1.4"/><path d="M9 8h.01M9 16h.01"/>`
        : node.kind === "laptop"
          ? `<rect x="5" y="7" width="14" height="9" rx="1.4"/><path d="M3 18h18"/>`
          : `<rect x="5" y="6" width="14" height="10" rx="1.4"/><path d="M9 19h6M12 16v3"/>`);
    return `<circle class="node-led" cx="${box.x + 113}" cy="${box.y + 14}" r="2.8" style="fill:${led}"/>
      <g class="node-icon" transform="translate(${box.x + 8}, ${box.y + 7})">${glyph}</g>`;
  }

  function nodeSvg(node) {
    const box = layout[node.id];
    if (!box) return "";
    const status = nodeStatus(node.id);
    return `<g class="${nodeClasses(node)}" data-action="node" data-node="${esc(node.id)}" tabindex="0" role="button" aria-label="${esc(node.name)} · ${esc(node.kind)}">
      <rect class="node-box" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="8"/>
      ${nodeGlyphSvg(node)}
      <text class="node-name" x="${box.x + 40}" y="${box.y + 21}">${esc(truncate(node.name, 12))}</text>
      <text class="node-sub" x="${box.x + 12}" y="${box.y + 36}">${esc(truncate(node.sub || node.model || "", 20))}</text>
    </g>`;
  }

  function zoneSvg(zone) {
    return `<g>
      <rect class="zone" x="${zone.x}" y="${zone.y}" width="${zone.w}" height="${zone.h}" rx="11" style="--zone:${zone.tone}"/>
      <text class="zone-label" x="${zone.x + 14}" y="${zone.y + 19}" style="--zone:${zone.tone}">${esc(zone.title)}</text>
      <text class="zone-sub" x="${zone.x + 14}" y="${zone.y + 30}">${esc(zone.sub)}</text>
    </g>`;
  }

  function linkSvg(link, bend) {
    const key = linkKey(link);
    const pending = state.pending.get(`link:${key}`);
    const down = state.linksDown.has(key);
    const tone = down || (pending && pending.desiredDown) ? "is-down" : pending ? "is-pending" : "";
    const d = linkPath(link, bend);
    const a = nodePos(link.a);
    const b = nodePos(link.b);
    return `<g>
      <path class="link link--${esc(link.type)} ${tone}" d="${d}" vector-effect="non-scaling-stroke"/>
      <path class="link-hit" d="${d}" data-action="link" data-key="${esc(key)}" tabindex="0" role="button" aria-label="${esc(linkLabel(link))}"/>
      <circle class="link-joint" cx="${a.x}" cy="${a.y}" r="2.4"/>
      <circle class="link-joint" cx="${b.x}" cy="${b.y}" r="2.4"/>
    </g>`;
  }

  function topologySvg() {
    const links = overlayLinks();
    const pairCounts = new Map();
    links.forEach((link) => {
      const pair = [link.a, link.b].sort().join("|");
      pairCounts.set(pair, (pairCounts.get(pair) || 0) + 1);
    });
    const seenPairs = new Map();
    const linkMarkup = links.map((link) => {
      const pair = [link.a, link.b].sort().join("|");
      const index = seenPairs.get(pair) || 0;
      seenPairs.set(pair, index + 1);
      const count = pairCounts.get(pair);
      const bend = count > 1 ? (index - (count - 1) / 2) * 56 : null;
      return linkSvg(link, bend);
    }).join("");
    return `<svg class="topo-svg" viewBox="0 0 1200 820" role="group" aria-label="CCC Hospital logical topology">
      ${D.zones.map(zoneSvg).join("")}
      ${linkMarkup}
      ${D.nodes.map(nodeSvg).join("")}
    </svg>`;
  }

  /* ---- Charts -------------------------------------------------------- */

  function areaChart(values, options = {}) {
    const width = 600;
    const height = options.height || 170;
    const padY = 16;
    const max = Math.max(...values) * 1.12;
    const step = width / Math.max(1, values.length - 1);
    const points = values.map((value, index) => [index * step, height - padY - (value / max) * (height - padY * 2)]);
    const line = points.map((p, i) => `${i ? "L" : "M"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
    const area = `${line} L ${width} ${height} L 0 ${height} Z`;
    const labels = [];
    for (let i = 0; i <= 3; i += 1) {
      const y = padY + (i * (height - padY * 2)) / 3;
      labels.push(`<line class="grid-line" x1="0" y1="${y.toFixed(1)}" x2="${width}" y2="${y.toFixed(1)}"/>`);
      labels.push(`<text class="axis-label" x="2" y="${(y - 4).toFixed(1)}">${Math.round((max * (3 - i)) / 3)}</text>`);
    }
    const last = points[points.length - 1];
    return `<div class="chart">
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--accent)" stop-opacity="0.30"/><stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
        ${labels.join("")}
        <path class="area-fill" d="${area}" fill="url(#chart-fill)"/>
        <path class="line-path" d="${line}" vector-effect="non-scaling-stroke"/>
        <circle class="point" cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3.2" vector-effect="non-scaling-stroke"/>
      </svg>
    </div>`;
  }

  function sparkline(values) {
    const width = 88;
    const height = 30;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const span = max - min || 1;
    const step = width / Math.max(1, values.length - 1);
    const d = values.map((value, index) => `${index ? "L" : "M"} ${(index * step).toFixed(1)} ${(height - 3 - ((value - min) / span) * (height - 6)).toFixed(1)}`).join(" ");
    return `<svg class="stat-spark" viewBox="0 0 ${width} ${height}" aria-hidden="true"><path d="${d}" fill="none" stroke="var(--accent)" stroke-width="1.6" stroke-linecap="round" opacity="0.85"/></svg>`;
  }

  function barsHtml(rows) {
    const max = Math.max(...rows.map((row) => row.value));
    return `<div class="bar-list">${rows.map((row) => `
      <div class="bar-row">
        <span class="muted">${esc(row.label)}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${Math.round((row.value / max) * 100)}%;background:${row.tone || "var(--accent)"}"></span></span>
        <span class="val">${esc(row.display || row.value)}</span>
      </div>`).join("")}</div>`;
  }

  /* ------------------------------------------------------------------ *
   * Global actions
   * ------------------------------------------------------------------ */

  function setSim(running, options = {}) {
    state.simRunning = !!running;
    if (state.simRunning) startTelemetry();
    else stopTelemetry();
    syncChrome();
    if (ui.route === "dashboard" || ui.route === "topology" || ui.route === "traffic") render();
    if (options.silent) return;
    toast(state.simRunning ? "Simulation running" : "Simulation paused", {
      tone: state.simRunning ? "success" : "warning",
      msg: state.simRunning ? "Live telemetry and event ingestion resumed." : "Telemetry is frozen. Staged changes can still be prepared."
    });
  }

  function undoChange(id) {
    if (!state.pending.has(id)) return;
    state.pending.delete(id);
    render();
    if (activeDrawer) renderDrawer();
    toast("Change discarded", { tone: "info", msg: "The staged change was removed from the deploy queue." });
  }

  function discardChanges() {
    if (!state.pending.size) return;
    const count = state.pending.size;
    state.pending.clear();
    render();
    if (activeDrawer) renderDrawer();
    toast("Deploy queue cleared", { tone: "info", msg: `${count} staged ${count === 1 ? "change" : "changes"} discarded.` });
  }

  async function deployChanges() {
    if (state.deploying || !state.pending.size) return;
    const queue = Array.from(state.pending.values());
    const refs = Array.from(state.pending.keys());
    state.deploying = true;
    syncChrome();
    refs.forEach((id) => {
      const item = document.getElementById(`stg-${id}`);
      if (item) {
        item.classList.add("is-running");
        item.querySelector(".stg-note").textContent = "applying…";
      }
    });
    await sleep(520);
    queue.forEach((change) => {
      if (change.type === "link") {
        if (change.desiredDown) state.linksDown.add(change.key);
        else state.linksDown.delete(change.key);
        addEvent({
          severity: change.desiredDown ? "warning" : "success",
          source: change.device || "R-WAN-MS",
          category: "wan",
          message: `${change.label}: interface ${change.desiredDown ? "shutdown" : "no shutdown"} pushed to running-config`
        });
      } else if (change.type === "vlan") {
        state.extraVlans[change.site].push({
          id: change.vlan.id, name: change.vlan.name, subnet: change.vlan.subnet,
          gw: change.vlan.gw, purpose: change.vlan.purpose, tone: "tag-blue"
        });
        addEvent({ severity: "success", source: "R-CORE-MS", category: "system", message: `VLAN ${change.vlan.id} ${change.vlan.name} created and saved in ${change.site}` });
      } else if (change.type === "acl") {
        state.aclExtra.push(change.rule);
        addEvent({ severity: "success", source: "R-CORE-MS", category: "security", message: `ACL ${change.rule.acl} seq ${change.rule.seq} ${change.rule.rule} appended from the NOC console` });
      } else if (change.type === "fix") {
        state.hardenFixes.add(change.device);
        addEvent({ severity: "success", source: change.device, category: "system", message: "ntp server 10.10.20.8 · clock synchronized" });
      }
    });
    state.pending.clear();
    state.deploying = false;
    state.lastDeploy = { ts: Date.now(), count: queue.length };
    render();
    if (activeDrawer) renderDrawer();
    toast("Deployed to simulation", {
      tone: "success",
      msg: `${queue.length} ${queue.length === 1 ? "change" : "changes"} applied · running-config updated`
    });
  }

  function addEvent(data, options = {}) {
    const event = {
      id: uid("ev"), ts: Date.now(), read: false,
      severity: "info", source: "SYSTEM", category: "system", message: "",
      ...data
    };
    state.events.unshift(event);
    if (state.events.length > 240) state.events.length = 240;
    if (!options.silent) syncChrome();
    if (ui.route === "events") render();
    if (ui.route === "dashboard" && options.dash !== false) updateDashboardFeed();
    return event;
  }

  function addAlert(alert) {
    state.alerts.unshift({ id: uid("al"), ts: Date.now(), read: false, severity: "warning", ...alert });
    if (state.alerts.length > 24) state.alerts.length = 24;
    syncChrome();
  }

  function updateDashboardFeed() {
    const feed = $("#dash-feed");
    if (!feed) return;
    feed.innerHTML = feedHtml(7);
  }

  function ackAlerts() {
    state.alerts.forEach((alert) => { alert.read = true; });
    syncChrome();
    closePopover();
    render();
    toast("Alerts acknowledged", { tone: "success", msg: "All alerts marked as read." });
  }

  function ackAlert(id) {
    const alert = state.alerts.find((item) => item.id === id);
    if (!alert) return;
    alert.read = true;
    syncChrome();
    renderPopover();
    if (ui.route === "security") render();
  }

  function markEventsRead() {
    state.events.forEach((event) => { event.read = true; });
    syncChrome();
    render();
    toast("Event log marked as read", { tone: "success" });
  }

  function runHealth(options = {}) {
    const checks = computeHealth();
    const passed = checks.filter((check) => check.ok).length;
    const lines = [
      { text: "CCC-NOC> health --check KC-1..KC-6", cls: "term-cmd" },
      { text: `${D.meta.ptVersion} · ${D.meta.devices} devices · ${D.meta.links} links`, cls: "term-dim" }
    ];
    checks.forEach((check) => {
      lines.push({
        text: `${check.ok ? "PASS" : "FAIL"}  ${check.kc}  ${padRight(check.title, 30)} ${check.ok ? "6/6 reachable" : check.note}`,
        cls: check.ok ? "term-ok" : "term-err"
      });
    });
    lines.push({ text: `Result: ${passed}/${checks.length} checks passed`, cls: passed === checks.length ? "term-result" : "term-result is-fail" });
    state.lastHealth = { ts: Date.now(), passed };
    addEvent({
      severity: passed === checks.length ? "success" : "warning",
      source: "HEALTH",
      category: "system",
      message: `Health check ${passed}/${checks.length} passed${passed === checks.length ? "" : " — investigate failing checks"}`
    });
    if (passed < checks.length) {
      const failing = checks.find((check) => !check.ok);
      addAlert({ severity: "warning", title: `${failing.kc} failing`, detail: failing.note, source: "HEALTH" });
    }
    playTerminal({
      title: "Health check",
      sub: `KC-1 … KC-6 · ${passed}/${checks.length} passed`,
      steps: lines.map((line) => ({ text: line.text, cls: line.cls, delay: 190 }))
    });
    if (ui.route === "dashboard" || ui.route === "security") render();
    if (options.silent !== true && state.simRunning === false) { /* keep paused */ }
  }

  function runBackupAll() {
    const rows = inventory.filter((device) => device.config);
    const steps = [
      { text: "CCC-NOC> backup --all --target tftp://10.10.20.8/ccc", cls: "term-cmd" },
      { text: `Scanning ${rows.length} managed configurations…`, cls: "term-dim" }
    ];
    rows.forEach((device) => {
      steps.push({ text: `  copy running-config ${device.config}   ... done`, cls: "" });
    });
    steps.push({ text: `Backup complete — ${rows.length}/${rows.length} files archived`, cls: "term-result" });
    const ts = Date.now();
    rows.forEach((device) => {
      state.snapshots.unshift({
        id: uid("snap"), device: device.name, site: device.site, ts,
        size: `${(1.6 + Math.random() * 3.2).toFixed(1)} KB`,
        md5: `${Math.random().toString(16).slice(2, 6)}…${Math.random().toString(16).slice(2, 6)}`,
        config: device.config
      });
    });
    if (state.snapshots.length > 74) state.snapshots.length = 74;
    addEvent({ severity: "success", source: "BACKUP", category: "system", message: `Manual backup finished — ${rows.length} configurations archived` });
    playTerminal({
      title: "Configuration backup",
      sub: `TFTP · ${rows.length} devices`,
      steps: steps.map((step) => ({ ...step, delay: 130 })),
      onFinish: () => { syncChrome(); if (ui.route === "backups") render(); }
    });
    syncChrome();
    if (ui.route === "backups") render();
  }

  async function runDrill(kind) {
    if (state.deploying) return;
    const drills = {
      epl: {
        title: "EPL → serial failover drill",
        sub: "DBP Street · R-WAN-MS Gi0/0/1 shutdown",
        primary: "r-wan|r-dbp|mpls",
        backup: "r-wan|r-dbp|serial",
        linkName: "MPLS EPL #1 · DBP",
        target: "10.10.20.6",
        device: "R-DBP",
        steps: [
          { text: "CCC-NOC> drill epl-failover --branch dbp --auto-restore", cls: "term-cmd" },
          { text: "Baseline · PC-DBP1 → SRV-HIS ping 10.10.20.6", cls: "term-dim" },
          { text: "  !!!!! 5 packets transmitted, 5 received, 0% loss  (RTT 7 ms via Gi0/1)", cls: "term-ok" },
          { text: "R-WAN-MS(config)# interface Gi0/0/1", cls: "term-prompt" },
          { text: "R-WAN-MS(config-if)# shutdown", cls: "term-prompt" },
          { text: "%LINK-5-CHANGED: Interface GigabitEthernet0/0/1, changed state to administratively down", cls: "term-warn" },
          { text: "%OSPF-5-ADJCHG: Nbr 10.254.0.2 on Gi0/0/1 from FULL to DOWN", cls: "term-warn" },
          { text: "  Reconverging · SPF via S0/1/0 (cost 647)…", cls: "term-dim" },
          { text: "  !!!!! 5 packets transmitted, 5 received, 0% loss  (RTT 34 ms via S0/1/0)", cls: "term-ok" },
          { text: "R-WAN-MS(config-if)# no shutdown", cls: "term-prompt" },
          { text: "  !!!!! 5 packets transmitted, 5 received, 0% loss  (RTT 7 ms via Gi0/1)", cls: "term-ok" },
          { text: "Result: PASS · OSPF reconverged twice, no manual route needed", cls: "term-result" }
        ],
        events: [
          { severity: "warning", source: "R-DBP", category: "wan", message: "Drill: Gi0/1 down — traffic moved to S0/1/0 backup path" },
          { severity: "success", source: "R-DBP", category: "routing", message: "Drill complete: OSPF returned to MPLS EPL, 5/5 replies on both paths" }
        ]
      },
      isp: {
        title: "ISP1 → ISP2 failover drill",
        sub: "Edge · floating static AD 50 takeover",
        primary: "isp1|r-edge|internet",
        backup: "isp2|r-edge|internet",
        linkName: "ISP1 uplink",
        target: "198.51.100.10",
        device: "R-EDGE-MS",
        steps: [
          { text: "CCC-NOC> drill isp-failover --auto-restore", cls: "term-cmd" },
          { text: "Baseline · LT-GR-MS1 → 198.51.100.10 via PAT", cls: "term-dim" },
          { text: "  !!!!! 4 packets transmitted, 4 received, 0% loss  (NAT Gi0/0)", cls: "term-ok" },
          { text: "R-EDGE-MS(config)# interface Gi0/0", cls: "term-prompt" },
          { text: "R-EDGE-MS(config-if)# shutdown", cls: "term-prompt" },
          { text: "%LINEPROTO-5-UPDOWN: Line protocol on Interface GigabitEthernet0/0, changed state to down", cls: "term-warn" },
          { text: "  Floating static 0.0.0.0/0 AD 50 installed via 203.0.114.1", cls: "term-dim" },
          { text: "  !!!!! 4 packets transmitted, 4 received, 0% loss  (NAT Gi0/1)", cls: "term-ok" },
          { text: "R-EDGE-MS(config-if)# no shutdown", cls: "term-prompt" },
          { text: "  !!!!! 4 packets transmitted, 4 received, 0% loss  (NAT Gi0/0 restored)", cls: "term-ok" },
          { text: "Result: PASS · failover and failback under 30 s", cls: "term-result" }
        ],
        events: [
          { severity: "warning", source: "R-EDGE-MS", category: "nat", message: "Drill: ISP1 down — PAT moved to ISP2 via floating static AD 50" },
          { severity: "success", source: "R-EDGE-MS", category: "nat", message: "Drill complete: ISP1 restored, primary PAT path re-selected" }
        ]
      },
      guest: {
        title: "Guest isolation audit",
        sub: "ACL 150/151/152 · VLAN 60 / 63 / 73",
        target: "10.10.30.11",
        device: "ACL-150",
        steps: [
          { text: "CCC-NOC> audit guest-isolation --vlans 60,63,73", cls: "term-cmd" },
          { text: "LT-GR-MS1 (10.10.60.23) · iPAD-GUEST (10.10.60.24)", cls: "term-dim" },
          { text: "  DHCP  10.10.60.1            permit  ✓", cls: "term-ok" },
          { text: "  DNS   10.10.20.5:53        permit  ✓", cls: "term-ok" },
          { text: "  HTTP  10.10.200.10:80      permit  ✓", cls: "term-ok" },
          { text: "  LAN   10.10.30.11          deny    ✓ (4/4 dropped)", cls: "term-ok" },
          { text: "  LAN   10.10.20.6           deny    ✓", cls: "term-ok" },
          { text: "  WEB   198.51.100.10        permit  ✓", cls: "term-ok" },
          { text: "Result: PASS · guest VLANs cannot reach hospital subnets", cls: "term-result" }
        ],
        events: [
          { severity: "success", source: "GUEST", category: "security", message: "Guest audit passed — ACL 150/151/152 block 10.0.0.0/8, DNS + DMZ + Internet allowed" }
        ]
      }
    };
    const drill = drills[kind];
    if (!drill) return;

    if (drill.primary && state.linksDown.has(drill.primary)) {
      toast("Drill not started", { tone: "warning", msg: `${drill.linkName} is already isolated. Restore it first.` });
      return;
    }

    state.drills[kind] = { ts: Date.now(), phase: "running" };
    addEvent({ severity: "info", source: "DRILL", category: "system", message: `${drill.title} started` });
    if (ui.route === "dashboard" || ui.route === "routing") render();

    playTerminal({
      title: drill.title,
      sub: drill.sub,
      steps: drill.steps.map((step, index) => ({
        ...step,
        delay: step.delay == null ? 420 : step.delay,
        run: index === 4 && drill.primary ? ({ addCleanup }) => {
          const wasDown = state.linksDown.has(drill.primary);
          state.linksDown.add(drill.primary);
          addCleanup(() => { if (!wasDown) state.linksDown.delete(drill.primary); });
          if (ui.route === "dashboard" || ui.route === "routing" || ui.route === "topology") render();
        } : index === 8 && drill.primary ? () => {
          state.linksDown.delete(drill.primary);
          if (ui.route === "dashboard" || ui.route === "routing" || ui.route === "topology") render();
        } : null
      })),
      onClose: () => {
        if (drill.primary) state.linksDown.delete(drill.primary);
        if (state.drills[kind]) state.drills[kind].phase = "done";
        if (ui.route === "dashboard" || ui.route === "routing" || ui.route === "topology") render();
      },
      onFinish: () => {
        state.drills[kind] = { ts: Date.now(), phase: "passed" };
        (drill.events || []).forEach((event) => addEvent(event));
        toast(`${drill.title} passed`, { tone: "success", msg: "Evidence written to the event log." });
      }
    });
  }

  function stageNtpFix(deviceName) {
    const id = `fix:${deviceName}`;
    if (state.pending.has(id)) {
      toast("Already staged", { tone: "info", msg: `${deviceName} NTP remediation is in the deploy queue.` });
      return;
    }
    state.pending.set(id, { id, type: "fix", device: deviceName, label: `${deviceName} · NTP` });
    addEvent({ severity: "info", source: "NOC", category: "system", message: `Staged NTP remediation for ${deviceName}` });
    render();
    toast("NTP fix staged", { tone: "info", msg: "Review the queue, then deploy to the running-config." });
  }

  function pingFrom(target, fromLabel) {
    const lines = [
      { text: `CCC-NOC> ping ${target.ip} --source ${fromLabel || "LT-GR-MS1"}`, cls: "term-cmd" }
    ];
    D.pingTargets.forEach((item) => {
      const self = item.label === target.label;
      lines.push({ text: `${self ? "→" : " "} ${padRight(item.label, 14)} ${padRight(item.ip, 16)} ${self ? "4/4 · 0% loss" : "policy/route ok"}`, cls: self ? "term-ok" : "term-dim" });
    });
    lines.push({ text: "Result: reachable — probe answers match the verification matrix", cls: "term-result" });
    playTerminal({ title: "Reachability probe", sub: `${target.label} · ${target.ip}`, steps: lines.map((line) => ({ ...line, delay: 200 })) });
  }

  function setZoom(next) {
    ui.zoom = clamp(next, 0.7, 1.6);
    const canvas = $("#topo-canvas");
    if (canvas) canvas.style.width = `${Math.round(ui.zoom * 100)}%`;
    const label = $("#zoom-level");
    if (label) label.textContent = `${Math.round(ui.zoom * 100)}%`;
    const reset = $("[data-action='zoom-reset']");
    if (reset) reset.textContent = `${Math.round(ui.zoom * 100)}%`;
  }

  /* ---- Toast helper for forms ---------------------------------------- */

  function fieldError(input, message) {
    const err = input.closest(".field") ? input.closest(".field").querySelector(".form-error") : null;
    if (err) {
      err.textContent = message;
      err.hidden = !message;
    }
    input.setAttribute("aria-invalid", message ? "true" : "false");
  }

  /* ---- Dashboard feed & WAN markup ----------------------------------- */

  const SEV_DOT = { info: "dot-accent", warning: "dot-warning", danger: "dot-danger", success: "dot-success" };
  const SEV_TAG = { info: "tag-blue", warning: "tag-amber", danger: "tag-rose", success: "tag-green" };

  function feedHtml(limit) {
    const rows = state.events.slice(0, limit || 8);
    if (!rows.length) return `<div class="feed-empty">No operational events yet.</div>`;
    return rows.map((event) => `
      <div class="feed-item">
        <span class="dot ${SEV_DOT[event.severity] || "dot-accent"}" aria-hidden="true"></span>
        <div>
          <div class="feed-msg">${esc(event.message)}</div>
          <div class="feed-meta"><span class="tag ${SEV_TAG[event.severity] || "tag-grey"}">${esc(event.category)}</span>${esc(event.source)}<span class="row-sep">·</span>${esc(event.severity)}</div>
        </div>
        <span class="feed-time">${fmtAgo(event.ts)}</span>
      </div>`).join("");
  }

  function wanRowHtml(entry) {
    const status = wanState(entry);
    const key = entry.key;
    const pending = state.pending.get(`link:${key}`);
    const isDown = state.linksDown.has(key);
    const action = pending
      ? `<button class="btn btn-quiet btn-sm" type="button" data-action="undo-change" data-id="link:${esc(key)}">Undo</button>`
      : `<button class="btn btn-quiet btn-sm" type="button" data-action="stage-link" data-key="${esc(key)}" data-desired="${isDown ? "up" : "down"}">${isDown ? "Restore" : "Isolate"}</button>`;
    return `<div class="wan-row">
      <div>
        <div class="name">${esc(entry.name)} ${pending ? stageTag() : ""}</div>
        <div class="addr">${esc(entry.path)}</div>
      </div>
      <span class="status is-${status.tone}"><span class="dot"></span>${esc(status.label)}</span>
      ${action}
    </div>`;
  }

  /* ---- Staging helpers ----------------------------------------------- */

  function stageLink(key, desiredDown) {
    const entry = WAN_ENTRIES.find((item) => item.key === key);
    if (!entry) return;
    const id = `link:${key}`;
    state.pending.set(id, {
      id, type: "link", key, desiredDown, label: entry.name, device: entry.device
    });
    addEvent({
      severity: "info", source: "NOC", category: "wan",
      message: `Staged ${desiredDown ? "isolation" : "restore"} for ${entry.name} — deploy to apply`
    });
    render();
    if (activeDrawer) renderDrawer();
    toast(desiredDown ? "Isolation staged" : "Restore staged", {
      tone: "info",
      msg: `${entry.name} is queued. Deploy to push it to the simulation.`
    });
  }

  function stageVlan(vlan) {
    const id = `vlan:${vlan.site}:${vlan.id}`;
    state.pending.set(id, { id, type: "vlan", site: vlan.site, vlan, label: `VLAN ${vlan.id} · ${vlan.name}` });
    render();
    toast("VLAN staged", { tone: "info", msg: `VLAN ${vlan.id} is queued for the ${SITE_LABELS[vlan.site]} router.` });
  }

  function stageAcl(rule) {
    const id = `acl:${rule.acl}:${rule.seq}`;
    state.pending.set(id, { id, type: "acl", rule, label: `ACL ${rule.acl} seq ${rule.seq}` });
    render();
    toast("ACL rule staged", { tone: "info", msg: `Sequence ${rule.seq} is queued. Deploy to apply it to ACL ${rule.acl}.` });
  }

  /* ------------------------------------------------------------------ *
   * Shared markup
   * ------------------------------------------------------------------ */

  function healthPanel() {
    const checks = computeHealth();
    const passed = checks.filter((check) => check.ok).length;
    return `
      <section class="panel">
        ${panelHead("Verification matrix", `KC-1 … KC-6 · ${passed} passing`, `<button class="btn btn-quiet btn-sm" type="button" data-action="health">${icon("refresh")}Run check</button>`, "shield")}
        <div class="panel-body flush">
          <table class="data">
            <thead><tr><th>Check</th><th>Target</th><th class="right">Result</th></tr></thead>
            <tbody>
              ${checks.map((check) => `
                <tr>
                  <td><span class="mono">${esc(check.kc)}</span> <strong>${esc(check.title)}</strong></td>
                  <td class="muted tiny">${esc(D.verification.find((item) => item.kc === check.kc).target)}</td>
                  <td class="right">${check.ok ? `<span class="status is-success"><span class="dot"></span>pass</span>` : `<span class="status is-danger"><span class="dot"></span>fail</span>`}</td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>
        <div class="panel-foot">
          <span>${passed === checks.length ? "All six checks are green on the live simulation." : "Failing checks reflect isolated links — restore and re-run."}</span>
          <span class="mono">last run ${fmtAgo(state.lastHealth.ts)}</span>
        </div>
      </section>`;
  }

  /* ------------------------------------------------------------------ *
   * Route: Dashboard
   * ------------------------------------------------------------------ */

  function nodeStatusSummary() {
    const counts = { success: 0, warning: 0, danger: 0 };
    D.nodes.forEach((node) => { counts[nodeStatus(node.id).tone] += 1; });
    return counts;
  }

  function dashboardView() {
    const check = computeHealth();
    const passed = check.filter((item) => item.ok).length;
    const counts = nodeStatusSummary();
    const unreachable = counts.danger;
    const snapCount = state.snapshots.length;

    return `<div class="view">
      ${pageHead({
        icon: "grid", eyebrow: "Operations console · live", title: "Network overview",
        sub: "Control plane for CCC-Hospital.pkt — isolate WAN paths, drill failover, stage changes and watch six verification checks in one place.",
        actions: `
          <button class="btn btn-quiet" type="button" data-action="health">${icon("shield")}Health check</button>
          <button class="btn btn-quiet" type="button" data-action="backup-all">${icon("database")}Back up all</button>
          <a class="btn btn-primary" href="#/topology">${icon("network")}Open topology</a>`
      })}
      <div class="stat-grid">
        <article class="stat">
          <div class="stat-head">Simulation<span class="stat-icon">${icon("power")}</span></div>
          <div class="stat-value" id="stat-uptime">${state.simRunning ? "Running" : "Paused"}</div>
          <div class="stat-sub"><span class="trend ${state.simRunning ? "up" : "flat"}">${state.simRunning ? "live" : "frozen"}</span> ${D.meta.ptVersion} · ${D.meta.devices} devices</div>
        </article>
        <article class="stat">
          <div class="stat-head">Reachability<span class="stat-icon">${icon("network")}</span></div>
          <div class="stat-value">${46 - unreachable}<span class="stat-unit">/ 46</span></div>
          <div class="stat-sub"><span class="trend ${unreachable ? "down" : "up"}">${unreachable ? `${unreachable} isolated` : "0 isolated"}</span> across 5 sites</div>
        </article>
        <article class="stat">
          <div class="stat-head">Verification<span class="stat-icon">${icon("shield")}</span></div>
          <div class="stat-value">${passed}<span class="stat-unit">/ 6 KC</span></div>
          <div class="stat-sub">${passed === 6 ? `<span class="trend up">all pass</span> matrix in sync` : `<span class="trend down">${6 - passed} failing</span> re-run health`}</div>
        </article>
        <article class="stat">
          <div class="stat-head">Throughput<span class="stat-icon">${icon("activity")}</span></div>
          <div class="stat-value" id="mbps-value">${state.mbps}<span class="stat-unit">Mbps</span></div>
          <div class="stat-sub"><span class="trend flat">peak ${D.bandwidth.peak}</span> ${state.simRunning ? "sampling every 4 s" : "telemetry frozen"}</div>
          ${sparkline(D.traffic["1h"])}
        </article>
      </div>

      <div class="dash-grid">
        <section class="panel span-7">
          ${panelHead("Throughput", "Aggregate edge + WAN traffic", `<div class="seg" role="group" aria-label="Chart range">${["24h", "6h", "1h"].map((range) => `<button class="seg-btn" type="button" data-action="chart-range" data-range="${range}" aria-pressed="${ui.trafficRange === range}">${range}</button>`).join("")}</div>`, "activity")}
          <div class="panel-body">
            ${areaChart(D.traffic[ui.trafficRange])}
            <div class="chart-legend" style="margin-top:10px">
              <span><span class="swatch"></span>Observed throughput</span>
              <span class="mono">down ${Math.round(D.bandwidth.down / 1000)} GB · up ${Math.round(D.bandwidth.up / 1000)} GB monthly</span>
              <span class="mono">capacity 1 Gbps uplinks</span>
            </div>
          </div>
          <div class="panel-foot">
            <span>Top talker · HIS application (214 Mbps)</span>
            <a class="link-arrow" href="#/traffic">Traffic view ${icon("arrow")}</a>
          </div>
        </section>

        <section class="panel span-5">
          ${panelHead("Failover drills", "Rehearse WAN loss against the live state", "", "activity")}
          <div class="panel-body stack-sm">
            <div class="drill">
              <div class="drill-head"><span class="drill-icon">${icon("route")}</span>EPL → serial</div>
              <p>Isolate DBP's MPLS EPL and confirm OSPF moves HIS traffic to the 2 Mbps serial path.</p>
              <div class="drill-foot"><span>R-WAN-MS · R-DBP</span><button class="btn btn-quiet btn-sm" type="button" data-action="drill" data-drill="epl">${icon("play")}Run</button></div>
            </div>
            <div class="drill">
              <div class="drill-head"><span class="drill-icon">${icon("globe")}</span>ISP1 → ISP2</div>
              <p>Drop the primary ISP and verify the floating static AD 50 takes PAT to ISP2 and back.</p>
              <div class="drill-foot"><span>R-EDGE-MS · AD 50</span><button class="btn btn-quiet btn-sm" type="button" data-action="drill" data-drill="isp">${icon("play")}Run</button></div>
            </div>
            <div class="drill">
              <div class="drill-head"><span class="drill-icon">${icon("shield")}</span>Guest audit</div>
              <p>Probe VLAN 60/63/73 against ACL 150/151/152: DNS + DMZ + Internet allowed, LAN denied.</p>
              <div class="drill-foot"><span>ACL 150 · VLAN 60</span><button class="btn btn-quiet btn-sm" type="button" data-action="drill" data-drill="guest">${icon("play")}Audit</button></div>
            </div>
          </div>
        </section>

        <section class="panel span-6">
          ${panelHead("WAN paths", "Stage isolation per link, then deploy", `<a class="link-arrow" href="#/routing">Routing ${icon("arrow")}</a>`, "route")}
          <div class="wan-list" id="dash-wan">${WAN_ENTRIES.map(wanRowHtml).join("")}</div>
        </section>

        <section class="panel span-6">
          ${panelHead("Recent events", "Newest first · ingested from devices", `<a class="link-arrow" href="#/events">Event log ${icon("arrow")}</a>`, "terminal")}
          <div class="feed" id="dash-feed">${feedHtml(7)}</div>
        </section>

        <section class="panel span-7">
          ${panelHead("Site health", `${siteHealthRows().length} groups · ${D.meta.devices} devices`, `<span class="count-chip">${D.meta.links} links</span>`, "building")}
          <div class="panel-body flush">
            <table class="data">
              <thead><tr><th>Site</th><th>WAN</th><th class="right">Devices</th><th class="right">Status</th></tr></thead>
              <tbody>
                ${siteHealthRows().map((row) => `
                  <tr>
                    <td><strong>${esc(row.name)}</strong><div class="cell-sub">${esc(row.sub)}</div></td>
                    <td class="muted tiny">${esc(row.wan)}</td>
                    <td class="num right">${row.devices}</td>
                    <td class="right">${statusPill(row.status.tone, row.status.label)}</td>
                  </tr>`).join("")}
              </tbody>
            </table>
          </div>
        </section>

        <section class="panel span-5">
          ${panelHead("Deploy queue", "Changes wait here until pushed", `<span class="count-chip" id="queue-count">${state.pending.size}</span>`, "upload")}
          <div class="panel-body" id="queue-body">${stagingHtml()}</div>
          <div class="panel-foot">
            <span>${state.pending.size ? "Apply to refresh running-config" : "Nothing staged"}</span>
            <div class="btn-row">
              <button class="btn btn-quiet btn-sm" type="button" data-action="discard-changes"${state.pending.size ? "" : " disabled"}>Discard</button>
              <button class="btn btn-primary btn-sm" type="button" data-action="deploy"${state.pending.size && !state.deploying ? "" : " disabled"}>${state.deploying ? `<span class="inline-spinner"></span>` : icon("upload")}Deploy</button>
            </div>
          </div>
        </section>
      </div>
    </div>`;
  }

  function stagingHtml() {
    const changes = Array.from(state.pending.values());
    if (!changes.length) {
      return `<div class="empty-state">No staged changes. Isolate a WAN link, add a VLAN or fix NTP from any device drawer.</div>`;
    }
    return `<div class="stack-sm">${changes.map((change) => `
      <div class="drill" id="stg-${esc(change.id)}">
        <div class="drill-head" style="justify-content:space-between">${esc(change.label)}${stageTag()}</div>
        <p class="stg-note">${esc(stageDetail(change))}</p>
        <div class="drill-foot"><span class="mono">${esc(change.type)}</span><button class="btn btn-quiet btn-sm" type="button" data-action="undo-change" data-id="${esc(change.id)}">Undo</button></div>
      </div>`).join("")}</div>`;
  }

  function stageDetail(change) {
    if (change.type === "link") return change.desiredDown ? "shutdown · isolates the interface" : "no shutdown · restores the interface";
    if (change.type === "vlan") return `${change.vlan.subnet} · gateway ${change.vlan.gw}`;
    if (change.type === "acl") return `${change.rule.rule}`;
    return "ntp server 10.10.20.8";
  }

  /* ------------------------------------------------------------------ *
   * Route: Topology
   * ------------------------------------------------------------------ */

  function topologyView() {
    const counts = nodeStatusSummary();
    return `<div class="view">
      ${pageHead({
        icon: "network", eyebrow: "Topology control", title: "Logical topology",
        sub: `${D.nodes.length} logical devices across ${D.zones.length} zones. Click a node to inspect and stage changes; click a link to isolate or restore the circuit.`,
        actions: `<button class="btn btn-quiet" type="button" data-action="drill" data-drill="epl">${icon("activity")}EPL drill</button><button class="btn btn-primary" type="button" data-action="deploy"${state.pending.size && !state.deploying ? "" : " disabled"}>${icon("upload")}Deploy <span class="count-chip">${state.pending.size}</span></button>`
      })}
      <div class="topo-toolbar">
        <div class="legend">
          <span class="legend-key"><span class="legend-line mpls"></span>MPLS EPL</span>
          <span class="legend-key"><span class="legend-line serial"></span>Serial backup</span>
          <span class="legend-key"><span class="legend-line"></span>Copper</span>
          <span class="legend-key"><span class="legend-line pending"></span>Staged</span>
          <span class="legend-key"><span class="legend-line down"></span>Isolated</span>
        </div>
        <div class="topo-tools">
          <div class="tool-group">
            <button class="icon-btn" type="button" data-action="zoom-out" aria-label="Zoom out">${icon("minus")}</button>
            <span class="zoom-level" id="zoom-level">${Math.round(ui.zoom * 100)}%</span>
            <button class="icon-btn" type="button" data-action="zoom-in" aria-label="Zoom in">${icon("plus")}</button>
          </div>
          <div class="tool-group">
            <button class="icon-btn${ui.labels ? " is-on" : ""}" type="button" data-action="toggle-labels" aria-pressed="${ui.labels}" aria-label="Toggle sub-labels" title="Sub-labels">${icon("layers")}</button>
            <button class="icon-btn" type="button" data-action="zoom-reset" aria-label="Reset zoom" title="Reset zoom">${icon("reset")}</button>
          </div>
        </div>
      </div>
      <div class="topo-stage${ui.labels ? "" : " hide-labels"}" id="topo-stage">
        <div class="topo-canvas" id="topo-canvas" style="width:${Math.round(ui.zoom * 100)}%">
          ${topologySvg()}
        </div>
        <div class="stage-hint">${icon("link")}Click a link for circuit control · drag to pan</div>
      </div>
      <div class="topo-foot-grid">
        <section class="panel">
          ${panelHead("Zones", `${D.zones.length} logical areas · ${D.links.length} links`, `<span class="count-chip">${counts.success} online · ${counts.warning} degraded · ${counts.danger} isolated</span>`, "grid")}
          <div class="panel-body flush">
            <table class="data zone-table">
              <thead><tr><th>Zone</th><th>Devices</th><th>Link state</th><th class="right">Owner</th></tr></thead>
              <tbody>
                ${D.zones.map((zone) => {
                  const nodes = D.nodes.filter((node) => node.zone === zoneLabel(zone.id));
                  const down = nodes.reduce((sum, node) => sum + (nodeStatus(node.id).tone === "danger" ? 1 : 0), 0);
                  return `<tr>
                    <td><span class="zone-dot" style="--zone:${zone.tone}"></span><strong>${esc(zone.title)}</strong><div class="cell-sub">${esc(zone.sub)}</div></td>
                    <td class="num">${nodes.length}</td>
                    <td>${down ? `<span class="status is-danger"><span class="dot"></span>${down} isolated</span>` : `<span class="status is-success"><span class="dot"></span>stable</span>`}</td>
                    <td class="right muted tiny">${zone.id === "dbp" || zone.id === "bhtq" ? "Branch" : zone.id === "internet" ? "Carrier" : "Hospital IT"}</td>
                  </tr>`;
                }).join("")}
              </tbody>
            </table>
          </div>
        </section>
        <section class="panel">
          ${panelHead("WAN hub", "6 circuits · dual path per site", "", "route")}
          <div class="wan-list">${WAN_ENTRIES.filter((entry) => entry.medium !== "Internet").map(wanRowHtml).join("")}</div>
          <div class="panel-foot"><span>Serial backups are DCE at 2 Mbps.</span><a class="link-arrow" href="#/routing">Manage ${icon("arrow")}</a></div>
        </section>
      </div>
    </div>`;
  }

  function zoneLabel(id) {
    return { internet: "Internet", edge: "Edge", wan: "WAN", core: "Core", bldA: "Building A", bldB: "Building B", srv: "Server farm", cctv: "CCTV", dbp: "DBP", bhtq: "BHTQ" }[id];
  }

  /* ------------------------------------------------------------------ *
   * Route: Devices
   * ------------------------------------------------------------------ */

  function deviceRowHtml(device) {
    const node = device.parent;
    const status = node ? nodeStatus(node.id) : { tone: "success", label: "Online" };
    const pending = nodeHasPending(device.nodeId);
    return `<tr data-action="row-device" data-id="${esc(device.id)}" tabindex="0">
      <td>
        <div class="device-cell">
          <span class="device-icon">${icon(KIND_ICON[device.kind] || "server")}</span>
          <div>
            <div class="cell-main mono">${esc(device.name)}</div>
            <div class="cell-sub">${esc(device.site)}${device.member ? ` · ${esc(device.parent.name)}` : ""}</div>
          </div>
        </div>
      </td>
      <td><span class="tag ${KIND_TAG[device.kind] || "tag-grey"}">${esc(KIND_LABEL[device.kind] || device.kind)}</span></td>
      <td class="mono">${esc(device.ip)}</td>
      <td class="mono muted">${esc(device.vlan || "—")}</td>
      <td>${status.tone === "danger" ? `<span class="status is-danger"><span class="dot"></span>Isolated</span>` : status.tone === "warning" ? `<span class="status is-warning"><span class="dot"></span>Degraded</span>` : `<span class="status is-success"><span class="dot"></span>Online</span>`}${pending ? ` ${stageTag()}` : ""}</td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" type="button" data-action="console" data-id="${esc(device.id)}" aria-label="Open console for ${esc(device.name)}" title="Console">${icon("terminal")}</button>
          <button class="icon-btn" type="button" data-action="inspect" data-id="${esc(device.id)}" aria-label="Inspect ${esc(device.name)}" title="Inspect">${icon("chevron-right")}</button>
        </div>
      </td>
    </tr>`;
  }

  function devicesTableBody() {
    const rows = filteredDevices();
    if (!rows.length) return `<tr><td colspan="6"><div class="empty-state">No devices match these filters.</div></td></tr>`;
    return rows.map(deviceRowHtml).join("");
  }

  function devicesView() {
    const sites = ["all", ...SITE_ORDER.filter((site) => inventory.some((device) => device.site === site))];
    const kinds = ["all", ...Object.keys(KIND_LABEL).filter((kind) => kind !== "cluster" && kind !== "camera" && inventory.some((device) => device.kind === kind))];
    const counts = nodeStatusSummary();
    return `<div class="view">
      ${pageHead({
        icon: "server", eyebrow: "Inventory", title: "Devices",
        sub: "46 simulated devices — routers, switches, servers, endpoints and the teleworker home LAN. Open a device for interfaces, hardening and console access.",
        actions: `<button class="btn btn-quiet" type="button" data-action="backup-all">${icon("database")}Back up all</button><button class="btn btn-quiet" type="button" data-action="palette">${icon("search")}Find device</button>`
      })}
      <div class="stat-grid">
        <article class="stat"><div class="stat-head">Routers<span class="stat-icon">${icon("router")}</span></div><div class="stat-value">${inventory.filter((d) => d.kind === "router").length}</div><div class="stat-sub">OSPF area 0 · 6 managed</div></article>
        <article class="stat"><div class="stat-head">Switches<span class="stat-icon">${icon("switch")}</span></div><div class="stat-value">${inventory.filter((d) => d.kind === "switch").length}</div><div class="stat-sub">Access · core · DMZ</div></article>
        <article class="stat"><div class="stat-head">Endpoints<span class="stat-icon">${icon("pc")}</span></div><div class="stat-value">${inventory.filter((d) => ["pc", "laptop", "printer", "cctv", "ap"].includes(d.kind)).length}</div><div class="stat-sub">Representative endpoints</div></article>
        <article class="stat"><div class="stat-head">Attention<span class="stat-icon">${icon("alert")}</span></div><div class="stat-value ${counts.danger ? "is-danger" : ""}">${counts.danger + counts.warning}</div><div class="stat-sub">${counts.danger} isolated · ${counts.warning} degraded</div></article>
      </div>
      <div class="filter-bar">
        <label class="search">${icon("search")}<input class="input" id="device-q" type="search" value="${esc(ui.deviceQ)}" placeholder="Name, IP, model or VLAN…" aria-label="Search devices"></label>
        ${selectField({ label: "Filter by site", attrs: "id='device-site'", value: ui.deviceSite, items: sites.map((site) => ({ value: site, label: site === "all" ? "All sites" : site })) })}
        ${selectField({ label: "Filter by type", attrs: "id='device-type'", value: ui.deviceType, items: kinds.map((kind) => ({ value: kind, label: kind === "all" ? "All types" : KIND_LABEL[kind] })) })}
        <span class="spacer"></span>
        <span class="count-chip" id="device-count">${filteredDevices().length} of ${inventory.length}</span>
        <button class="btn btn-ghost btn-sm" type="button" data-action="reset-device-filters">Reset</button>
      </div>
      <section class="panel">
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Device</th><th>Type</th><th>IP address</th><th>VLAN</th><th>Status</th><th class="right">Actions</th></tr></thead>
            <tbody id="device-rows">${devicesTableBody()}</tbody>
          </table>
        </div>
        <div class="table-note"><span>Click a row to open the device drawer. Clusters expand into their member endpoints.</span><span class="mono">${inventory.filter((d) => d.mgmt).length} with management IP</span></div>
      </section>
    </div>`;
  }

  /* ------------------------------------------------------------------ *
   * Route: VLANs & addressing
   * ------------------------------------------------------------------ */

  function vlanTableRows(site) {
    const pendingVlans = [...state.pending.values()]
      .filter((change) => change.type === "vlan" && change.site === site)
      .map((change) => ({ ...change.vlan, tone: "tag-blue", pending: true }));
    const rows = [...vlanRows(site), ...pendingVlans];
    return rows.map((row) => {
      const pending = !!row.pending;
      return `<tr>
        <td class="mono">${esc(row.id)}</td>
        <td><span class="tag ${esc(row.tone || "tag-grey")}">${esc(row.name)}</span>${pending ? ` ${stageTag()}` : ""}</td>
        <td class="mono">${esc(row.subnet)}</td>
        <td class="mono muted">${esc(row.gw)}</td>
        <td class="muted tiny">${esc(row.purpose)}</td>
        <td class="right">
          <div class="row-actions">
            ${pending
              ? `<button class="btn btn-quiet btn-sm" type="button" data-action="undo-change" data-id="${esc(`vlan:${site}:${row.id}`)}">Undo</button>`
              : `<button class="icon-btn" type="button" data-action="vlan-traffic" data-site="${esc(site)}" data-vlan="${esc(row.id)}" aria-label="Inspect VLAN ${esc(row.id)} traffic" title="Inspect">${icon("activity")}</button>`}
          </div>
        </td>
      </tr>`;
    }).join("");
  }

  function vlansView() {
    const site = ui.vlanSite;
    const plan = D.vlans[site];
    return `<div class="view">
      ${pageHead({
        icon: "layers", eyebrow: "Addressing", title: "VLANs & addressing",
        sub: "Seven VLANs at the main site, three per branch. Every subnet is advertised by OSPF area 0 from its site router.",
        actions: `<button class="btn btn-quiet" type="button" data-action="acl-add">${icon("shield")}Add ACL rule</button><button class="btn btn-primary" type="button" data-action="vlan-add">${icon("plus")}New VLAN</button>`
      })}
      <div class="filter-bar">
        <div class="seg" role="group" aria-label="Site">
          ${Object.keys(SITE_KEYS).map((key) => `<button class="seg-btn" type="button" data-action="vlan-site" data-site="${key}" aria-pressed="${site === key}">${SITE_LABELS[key]}</button>`).join("")}
        </div>
        <span class="spacer"></span>
        <span class="count-chip">${vlanRows(site).length} VLANs · ${plan.rows.length} baseline</span>
      </div>
      <div class="dash-grid">
        <section class="panel span-8">
          ${panelHead("VLAN plan", `${SITE_LABELS[site]} · ${plan.summary.find((item) => item.k === "Subnet").v}`, `<span class="count-chip">${plan.summary.find((item) => item.k === "Workstations").v} workstations</span>`, "layers")}
          <div class="panel-body flush">
            <table class="data">
              <thead><tr><th>ID</th><th>Name</th><th>Subnet</th><th>Gateway</th><th>Purpose</th><th class="right">Inspect</th></tr></thead>
              <tbody>${vlanTableRows(site)}</tbody>
            </table>
          </div>
          <div class="panel-foot"><span>Staged VLANs appear in the deploy queue until pushed.</span><span class="mono">R-${site === "main" ? "CORE-MS" : site.toUpperCase()}</span></div>
        </section>
        <section class="panel span-4">
          ${panelHead("Site summary", "Capacity and uplink", "", "cpu")}
          <div class="panel-body">
            <dl class="about-list">
              ${plan.summary.map((item) => `<div><dt class="k">${esc(item.k)}</dt><dd class="v">${esc(item.v)}</dd></div>`).join("")}
            </dl>
            <hr class="divider">
            <div class="stack-sm">
              <div class="kv-inline">${icon("wifi")}<strong>28</strong> APs</div>
              <div class="kv-inline">${icon("cctv")}<strong>2</strong> cameras on VLAN 50</div>
              <div class="kv-inline">${icon("lock")}<strong>${site === "main" ? "150" : site === "dbp" ? "151" : "152"}</strong> guest ACL</div>
            </div>
          </div>
        </section>
        <section class="panel span-7">
          ${panelHead("Router-on-a-stick", "Sub-interface plan", `<a class="link-arrow" href="#/routing">Routing ${icon("arrow")}</a>`, "router")}
          <div class="panel-body">
            <div class="mono-block">${site === "main"
              ? `<span class="c">! R-CORE-MS · inter-VLAN gateways</span>
interface Gi0/0
 no ip address
 no shutdown
<span class="k">interface Gi0/0.10</span>  encapsulation dot1Q 10   ip address 10.10.10.1 255.255.255.0
<span class="k">interface Gi0/0.20</span>  encapsulation dot1Q 20   ip address 10.10.20.1 255.255.255.0
<span class="k">interface Gi0/0.30</span>  encapsulation dot1Q 30   ip address 10.10.30.1 255.255.255.0
<span class="k">interface Gi0/0.40</span>  encapsulation dot1Q 40   ip address 10.10.40.1 255.255.255.0
<span class="k">interface Gi0/0.50</span>  encapsulation dot1Q 50   ip address 10.10.50.1 255.255.255.0
<span class="k">interface Gi0/0.60</span>  encapsulation dot1Q 60   ip address 10.10.60.1 255.255.255.0
<span class="k">interface Gi0/0.200</span> encapsulation dot1Q 200  ip address 10.10.200.1 255.255.255.0`
              : `<span class="c">! R-${site.toUpperCase()} · branch hand-off</span>
interface Gi0/0
 no ip address
 no shutdown
${plan.rows.map((row) => `<span class="k">interface Gi0/0.${row.id}</span>${row.id > 99 ? "" : " "} encapsulation dot1Q ${row.id}   ip address ${row.gw} 255.255.255.0`).join("\n")}
<span class="k">interface Gi0/1</span>      ip address 10.254.0.${site === "dbp" ? "2" : "6"} 255.255.255.252
<span class="k">interface S0/0/0</span>    ip address 10.255.0.${site === "dbp" ? "2" : "6"} 255.255.255.252`}</div>
          </div>
        </section>
        <section class="panel span-5">
          ${panelHead("Guest isolation", "ACL 150 · 151 · 152", `<button class="btn btn-quiet btn-sm" type="button" data-action="drill" data-drill="guest">${icon("play")}Audit</button>`, "shield")}
          <div class="panel-body">
            <div class="callout callout--info">
              ${icon("shield")}
              <div><strong>Permitted before the LAN deny</strong>DHCP broadcast, DNS to 10.10.20.5, HTTP to the DMZ web server, then any Internet destination. Everything else inside 10.0.0.0/8 is dropped at sequence 30.</div>
            </div>
            <div class="mono-block" style="margin-top:12px"><span class="c">! applied to VLAN 60 / 63 / 73</span>
access-list 150 permit udp any any eq 67
access-list 150 permit udp any host 10.10.20.5 eq 53
access-list 150 permit tcp any host 10.10.200.10 eq 80
access-list 150 deny   ip any 10.0.0.0 0.255.255.255
access-list 150 permit ip any any</div>
          </div>
        </section>
      </div>
    </div>`;
  }

  /* ------------------------------------------------------------------ *
   * Route: Routing & WAN
   * ------------------------------------------------------------------ */

  function routeTableBody() {
    const rows = D.routes.filter((route) => ui.routeFilter === "all" || (ui.routeFilter === "S" ? route.code.startsWith("S") : route.code === ui.routeFilter));
    if (!rows.length) return `<tr><td colspan="5"><div class="empty-state">No routes in this category.</div></td></tr>`;
    return rows.map((route) => {
      const branchDown = route.branch && state.linksDown.has(`r-wan|r-${route.branch === "dbp" ? "dbp" : "bhtq"}|mpls`) && state.linksDown.has(`r-wan|r-${route.branch === "dbp" ? "dbp" : "bhtq"}|serial`);
      return `<tr>
        <td><span class="tag ${route.code === "O" ? "tag-violet" : route.code.startsWith("S") ? "tag-amber" : "tag-grey"}">${esc(route.code)}</span></td>
        <td class="mono">${esc(route.prefix)}</td>
        <td class="mono muted">${esc(route.via)}${branchDown ? ` <span class="tag tag-rose">unreachable</span>` : ""}</td>
        <td class="mono">${esc(route.iface)}</td>
        <td class="num right muted">${esc(route.metric)}</td>
      </tr>`;
    }).join("");
  }

  function ospfTableBody() {
    return ospfRows().map((row) => `
      <tr>
        <td class="mono">${esc(row.local)}</td>
        <td class="mono">${esc(row.neighbor)}</td>
        <td class="mono muted">${esc(row.iface)}</td>
        <td class="mono">${esc(row.addr)}</td>
        <td>${row.state === "FULL"
          ? `<span class="status is-success"><span class="dot"></span>FULL</span>`
          : `<span class="status is-danger"><span class="dot"></span>DOWN</span>`}</td>
        <td class="muted tiny">${esc(row.note || `${row.uptime} uptime`)}</td>
      </tr>`).join("");
  }

  function routingView() {
    return `<div class="view">
      ${pageHead({
        icon: "route", eyebrow: "Control plane", title: "Routing & WAN",
        sub: "OSPF area 0 across four routers, dual-path branches and a floating static at the edge. Isolate a circuit to watch reconvergence.",
        actions: `<button class="btn btn-quiet" type="button" data-action="drill" data-drill="epl">${icon("route")}EPL drill</button><button class="btn btn-quiet" type="button" data-action="drill" data-drill="isp">${icon("globe")}ISP drill</button><a class="btn btn-primary" href="#/topology">${icon("network")}Topology</a>`
      })}
      <div class="stat-grid">
        <article class="stat"><div class="stat-head">OSPF neighbors<span class="stat-icon">${icon("route")}</span></div><div class="stat-value">${ospfRows().filter((row) => row.state === "FULL").length}<span class="stat-unit">/ 4</span></div><div class="stat-sub">area 0 · R-CORE-MS hub</div></article>
        <article class="stat"><div class="stat-head">Primary uplink<span class="stat-icon">${icon("globe")}</span></div><div class="stat-value">ISP1</div><div class="stat-sub">${state.linksDown.has("isp1|r-edge|internet") ? `<span class="trend down">down</span> ISP2 active` : `<span class="trend up">active</span> AD 50 standby`}</div></article>
        <article class="stat"><div class="stat-head">Branch circuits<span class="stat-icon">${icon("link")}</span></div><div class="stat-value">${4 - WAN_ENTRIES.filter((entry) => entry.medium !== "Internet" && state.linksDown.has(entry.key)).length}<span class="stat-unit">/ 4</span></div><div class="stat-sub">MPLS + serial per branch</div></article>
        <article class="stat"><div class="stat-head">Staged<span class="stat-icon">${icon("upload")}</span></div><div class="stat-value">${state.pending.size}</div><div class="stat-sub">${state.pending.size ? "ready to deploy" : "no pending changes"}</div></article>
      </div>

      <section class="panel section-gap">
        ${panelHead("WAN circuit control", "Stage an interface shutdown, then deploy", `<span class="count-chip">6 circuits</span>`, "globe")}
        <div class="wan-grid" style="padding:16px">
          ${WAN_ENTRIES.map((entry) => {
            const status = wanState(entry);
            const isDown = state.linksDown.has(entry.key);
            const pending = state.pending.get(`link:${entry.key}`);
            return `<div class="wan-card">
              <div class="wan-card-head">
                <div><h4>${esc(entry.name)}</h4><div class="wan-addr">${esc(entry.addr)}</div></div>
                <span class="status is-${status.tone}"><span class="dot"></span>${esc(status.label)}</span>
              </div>
              <div class="wan-path">${icon("link")}${esc(entry.path)}</div>
              <div class="wan-path">${icon("shield")}${esc(entry.role)}</div>
              <div class="wan-actions">
                ${pending
                  ? `<button class="btn btn-quiet btn-sm" type="button" data-action="undo-change" data-id="${esc(`link:${entry.key}`)}">Undo staging</button>`
                  : `<button class="btn ${isDown ? "btn-quiet" : "btn-danger"} btn-sm" type="button" data-action="stage-link" data-key="${esc(entry.key)}" data-desired="${isDown ? "up" : "down"}">${isDown ? "Restore link" : "Isolate link"}</button>`}
                <button class="btn btn-ghost btn-sm" type="button" data-action="inspect-node" data-node="${esc(entry.device)}">Inspect</button>
              </div>
            </div>`;
          }).join("")}
        </div>
      </section>

      <div class="grid-2 section-gap">
        <section class="panel">
          ${panelHead("OSPF neighbors", "Area 0 · hello 10 / dead 40", `<button class="btn btn-quiet btn-sm" type="button" data-action="health">${icon("refresh")}Re-check</button>`, "route")}
          <div class="panel-body flush">
            <table class="data">
              <thead><tr><th>Local</th><th>Neighbor</th><th>Interface</th><th>Address</th><th>State</th><th>Note</th></tr></thead>
              <tbody>${ospfTableBody()}</tbody>
            </table>
          </div>
        </section>
        <section class="panel">
          ${panelHead("Route table · R-CORE-MS", "Connected, OSPF and static", `<div class="seg" role="group" aria-label="Route code">${[["all", "All"], ["C", "C"], ["O", "O"], ["S", "S*"]].map(([value, label]) => `<button class="seg-btn" type="button" data-action="route-filter" data-filter="${value}" aria-pressed="${ui.routeFilter === value}">${label}</button>`).join("")}</div>`, "layers")}
          <div class="panel-body flush">
            <table class="data">
              <thead><tr><th>Code</th><th>Prefix</th><th>Via</th><th>Interface</th><th class="right">Metric</th></tr></thead>
              <tbody id="route-rows">${routeTableBody()}</tbody>
            </table>
          </div>
        </section>
      </div>

      <div class="grid-2 section-gap">
        ${healthPanel()}
        <section class="panel">
          ${panelHead("Reachability probe", "Run a read-only ping from a test client", "", "zap")}
          <div class="panel-body">
            <div class="field">
              <label for="ping-target">Target</label>
              ${selectField({ label: "Probe target", attrs: "id='ping-target'", value: D.pingTargets[0].label, items: D.pingTargets.map((target) => ({ value: target.label, label: `${target.label} · ${target.ip}` })) })}
            </div>
            <div class="btn-row" style="margin-top:12px">
              <button class="btn btn-primary" type="button" data-action="ping">${icon("zap")}Run probe</button>
              <span class="note">Probes follow the same paths as the health checks; they never modify state.</span>
            </div>
            <hr class="divider">
            <div class="stack-sm">
              <div class="kv-inline">${icon("globe")}Edge PAT <strong>203.0.113.2</strong> toward ISP1</div>
              <div class="kv-inline">${icon("shield")}Static NAT <strong>203.0.115.10 ↔ 10.10.200.10</strong></div>
              <div class="kv-inline">${icon("route")}Floating static <strong>AD 50</strong> via 203.0.114.1</div>
            </div>
          </div>
        </section>
      </div>
    </div>`;
  }

  /* ------------------------------------------------------------------ *
   * Route: Security
   * ------------------------------------------------------------------ */

  function alertFeedHtml() {
    if (!state.alerts.length) return `<div class="feed-empty">No alerts. All clear.</div>`;
    return state.alerts.map((alert) => `
      <div class="feed-item">
        <span class="dot ${alert.severity === "danger" ? "dot-danger" : alert.severity === "warning" ? "dot-warning" : "dot-accent"}"></span>
        <div>
          <div class="feed-msg"><strong>${esc(alert.title)}</strong> — ${esc(alert.detail)}</div>
          <div class="feed-meta">${esc(alert.source)}<span class="row-sep">·</span>${alert.read ? "read" : "unread"}</div>
        </div>
        ${alert.read ? `<span class="feed-time">${fmtAgo(alert.ts)}</span>` : `<button class="btn btn-ghost btn-sm" type="button" data-action="ack-alert" data-id="${esc(alert.id)}">Ack</button>`}
      </div>`).join("");
  }

  function aclTableBody() {
    const extras = state.aclExtra
      .filter((rule) => String(rule.acl) === String(ui.aclTab))
      .map((rule) => ({ seq: rule.seq, rule: rule.rule, action: rule.action, note: "Added from NOC" }));
    const staged = [...state.pending.values()]
      .filter((change) => change.type === "acl" && String(change.rule.acl) === String(ui.aclTab))
      .map((change) => ({ seq: change.rule.seq, rule: change.rule.rule, action: change.rule.action, note: change.rule.note, staged: true }));
    const rows = [...D.acl, ...extras, ...staged].sort((a, b) => {
      const sa = Number(a.seq), sb = Number(b.seq);
      if (Number.isNaN(sa)) return 1;
      if (Number.isNaN(sb)) return -1;
      return sa - sb;
    });
    return rows.map((row) => `
      <tr>
        <td class="mono">${esc(row.seq)}</td>
        <td class="rule">${esc(row.rule)}</td>
        <td><span class="tag ${row.action === "ALLOW" ? "tag-green" : "tag-rose"}">${esc(row.action)}</span>${row.staged ? ` ${stageTag()}` : ""}</td>
        <td class="muted tiny">${esc(row.note)}</td>
      </tr>`).join("");
  }

  function hardeningTableBody() {
    const rows = hardeningRows();
    return rows.map((row) => `
      <tr>
        <td><div class="cell-main mono">${esc(row.device)}</div><div class="cell-sub">${esc(row.site)}</div></td>
        <td class="center">${checkIcon(!!row.ssh)}</td>
        <td class="center">${checkIcon(!!row.secret)}</td>
        <td class="center">${checkIcon(!!row.vty)}</td>
        <td class="center">${checkIcon(!!row.syslog)}</td>
        <td class="center">${row.ntp ? checkIcon(true) : `<span class="tag tag-amber">no NTP</span>`}</td>
        <td class="center">${row.portSec == null ? `<span class="muted">—</span>` : checkIcon(!!row.portSec)}</td>
        <td class="right">${row.ntp ? `<span class="muted tiny">compliant</span>` : `<button class="btn btn-quiet btn-sm" type="button" data-action="ntp-fix" data-device="${esc(row.device)}">Stage fix</button>`}</td>
      </tr>`).join("");
  }

  function securityView() {
    const gaps = hardeningRows().filter((row) => !row.ntp).length;
    const unread = state.alerts.filter((alert) => !alert.read).length;
    const ports = D.portSecurity.reduce((sum, row) => sum + row.ports, 0);
    return `<div class="view">
      ${pageHead({
        icon: "shield", eyebrow: "Security posture", title: "Security",
        sub: "Guest isolation ACLs, static NAT for the DMZ, SSH-only management and 24 port-security ports — with every gap surfaced.",
        actions: `<button class="btn btn-quiet" type="button" data-action="drill" data-drill="guest">${icon("play")}Guest audit</button><button class="btn btn-primary" type="button" data-action="acl-add">${icon("plus")}Add ACL rule</button>`
      })}
      <div class="stat-grid">
        <article class="stat"><div class="stat-head">Open alerts<span class="stat-icon">${icon("bell")}</span></div><div class="stat-value ${unread ? "is-warning" : ""}">${unread}</div><div class="stat-sub">${state.alerts.length} total · ${state.alerts.length - unread} read</div></article>
        <article class="stat"><div class="stat-head">Guest ACLs<span class="stat-icon">${icon("shield")}</span></div><div class="stat-value">3</div><div class="stat-sub">150 · 151 · 152 on VLAN 60/63/73</div></article>
        <article class="stat"><div class="stat-head">Port security<span class="stat-icon">${icon("lock")}</span></div><div class="stat-value">${ports}</div><div class="stat-sub">sticky · restrict · 1 violation</div></article>
        <article class="stat"><div class="stat-head">Hardening gaps<span class="stat-icon">${icon("alert")}</span></div><div class="stat-value ${gaps ? "is-warning" : "is-success"}">${gaps}</div><div class="stat-sub">${gaps ? `NTP missing on ${gaps} device${gaps === 1 ? "" : "s"}` : "all hardened"}</div></article>
      </div>

      <div class="dash-grid">
        <section class="panel span-7">
          ${panelHead("Guest access control", `ACL ${ui.aclTab} · applied inbound`, `<div class="seg" role="group" aria-label="Guest ACL">${["150", "151", "152"].map((tab) => `<button class="seg-btn" type="button" data-action="acl-tab" data-tab="${tab}" aria-pressed="${ui.aclTab === tab}">ACL ${tab}</button>`).join("")}</div>`, "shield")}
          <div class="panel-body flush">
            <table class="data">
              <thead><tr><th>Seq</th><th>Rule</th><th>Action</th><th>Purpose</th></tr></thead>
              <tbody id="acl-rows">${aclTableBody()}</tbody>
            </table>
          </div>
          <div class="panel-foot">
            <span class="acl-platform">R-CORE-MS · Gi0/0.${ui.aclTab === "150" ? "60" : ui.aclTab === "151" ? "branch DBP" : "branch BHTQ"} · ip access-group ${esc(ui.aclTab)} in</span>
            <button class="btn btn-ghost btn-sm" type="button" data-action="acl-add">${icon("plus")}Rule</button>
          </div>
        </section>

        <section class="panel span-5">
          ${panelHead("Alerts", "Nothing is auto-dismissed", `<button class="btn btn-ghost btn-sm" type="button" data-action="ack-alerts">Mark all read</button>`, "bell")}
          <div class="feed" id="security-alerts">${alertFeedHtml()}</div>
          <div class="panel-foot"><span>Port-security and failover events land here.</span><a class="link-arrow" href="#/events">All events ${icon("arrow")}</a></div>
        </section>

        <section class="panel span-5">
          ${panelHead("NAT & edge policy", "R-EDGE-MS · 2911", `<button class="btn btn-quiet btn-sm" type="button" data-action="inspect-node" data-node="r-edge">Inspect</button>`, "globe")}
          <div class="panel-body">
            <div class="nat-grid">
              <div class="nat-cell"><div class="k">Static NAT</div><div class="v">203.0.115.10 → 10.10.200.10</div></div>
              <div class="nat-cell"><div class="k">PAT overload</div><div class="v">Gi0/0 · 203.0.113.2</div></div>
              <div class="nat-cell"><div class="k">Floating static</div><div class="v">0.0.0.0/0 AD 50 → 203.0.114.1</div></div>
              <div class="nat-cell"><div class="k">DMZ trunk</div><div class="v">Gi0/3 → SW-DMZ VLAN 200</div></div>
            </div>
            <div class="mono-block" style="margin-top:12px"><span class="c">! edge translations</span>
ip nat inside source static 10.10.200.10 203.0.115.10
ip nat inside source list PAT interface Gi0/0 overload
ip route 0.0.0.0 0.0.0.0 203.0.113.1
ip route 0.0.0.0 0.0.0.0 203.0.114.1 50</div>
            <div class="callout ${state.linksDown.has("isp1|r-edge|internet") ? "callout--warning" : ""}" style="margin-top:12px">
              ${icon("alert")}
              <div><strong>${state.linksDown.has("isp1|r-edge|internet") ? "ISP1 isolated — ISP2 carries PAT" : "Failover armed"}</strong>${state.linksDown.has("isp1|r-edge|internet") ? "Static NAT keeps answering; only the primary PAT path is down." : "The AD 50 static is installed but not preferred while ISP1 answers."}</div>
            </div>
          </div>
        </section>

        <section class="panel span-7">
          ${panelHead("Management hardening", "6 routers + 7 switches", `<span class="count-chip">SSH-only</span>`, "lock")}
          <div class="panel-body flush">
            <div class="table-wrap">
              <table class="data hardening-table">
                <thead><tr><th>Device</th><th class="center">SSH</th><th class="center">Secret</th><th class="center">VTY</th><th class="center">Syslog</th><th class="center">NTP</th><th class="center">Port-sec</th><th class="right">Action</th></tr></thead>
                <tbody id="hardening-rows">${hardeningTableBody()}</tbody>
              </table>
            </div>
          </div>
          <div class="panel-foot"><span>Staged NTP fixes deploy with the next queue push.</span><a class="link-arrow" href="#/devices">Devices ${icon("arrow")}</a></div>
        </section>

        <section class="panel span-6">
          ${panelHead("Port security", "Sticky MAC · restrict", `<span class="count-chip">${ports} ports</span>`, "lock")}
          <div class="panel-body flush">
            <table class="data">
              <thead><tr><th>Switch</th><th class="right">Ports</th><th>Policy</th><th class="right">Violations</th></tr></thead>
              <tbody>
                ${D.portSecurity.map((row) => `
                  <tr>
                    <td><div class="cell-main mono">${esc(row.device)}</div><div class="cell-sub">${esc(row.site)}</div></td>
                    <td class="num right">${row.ports}</td>
                    <td class="muted tiny">${esc(row.policy)} · max ${esc(row.max)}</td>
                    <td class="right">${row.violations ? `<span class="tag tag-rose">${row.violations}</span>` : `<span class="muted">0</span>`}</td>
                  </tr>`).join("")}
              </tbody>
            </table>
          </div>
        </section>

        <section class="panel span-6">
          ${panelHead("Risk register", "Known gaps between PT and production", "", "alert")}
          <div class="panel-body">
            <div class="stack-sm">
              ${D.issues.map((issue) => `
                <div class="iface-row">
                  <div class="iface-main">
                    <div class="iface-name" style="font-family:var(--sans);font-size:12.5px">${esc(issue.n)} · ${esc(issue.title)}</div>
                    <div class="iface-meta">${esc(issue.text)}</div>
                  </div>
                  <span class="tag ${issue.sev === "HIGH" ? "tag-rose" : issue.sev === "MED" ? "tag-amber" : "tag-grey"}">${esc(issue.sev)}</span>
                </div>`).join("")}
            </div>
          </div>
        </section>
      </div>
    </div>`;
  }

  /* ------------------------------------------------------------------ *
   * Route: Traffic
   * ------------------------------------------------------------------ */

  function trafficView() {
    const series = D.traffic[ui.trafficRange];
    const current = series[series.length - 1];
    const peak = Math.max(...series);
    const avg = Math.round(series.reduce((sum, value) => sum + value, 0) / series.length);
    return `<div class="view">
      ${pageHead({
        icon: "activity", eyebrow: "Telemetry", title: "Traffic",
        sub: "Aggregated edge and WAN throughput with top talkers and per-site load. Sampling pauses when the simulation is paused.",
        actions: `<div class="seg" role="group" aria-label="Range">${["24h", "6h", "1h"].map((range) => `<button class="seg-btn" type="button" data-action="chart-range" data-range="${range}" aria-pressed="${ui.trafficRange === range}">${range}</button>`).join("")}</div><button class="btn btn-primary" type="button" data-action="toggle-sim">${icon(state.simRunning ? "pause" : "play")}${state.simRunning ? "Pause" : "Resume"}</button>`
      })}
      <div class="stat-grid">
        <article class="stat"><div class="stat-head">Current<span class="stat-icon">${icon("activity")}</span></div><div class="stat-value" id="traffic-current">${current}<span class="stat-unit">Mbps</span></div><div class="stat-sub"><span class="trend flat">${ui.trafficRange} window</span> ${state.simRunning ? "live" : "frozen"}</div>${sparkline(series)}</article>
        <article class="stat"><div class="stat-head">Peak<span class="stat-icon">${icon("zap")}</span></div><div class="stat-value">${peak}<span class="stat-unit">Mbps</span></div><div class="stat-sub">baseline peak ${D.bandwidth.peak} at 09:55</div></article>
        <article class="stat"><div class="stat-head">Average<span class="stat-icon">${icon("clock")}</span></div><div class="stat-value">${avg}<span class="stat-unit">Mbps</span></div><div class="stat-sub">baseline average ${D.bandwidth.avg}</div></article>
        <article class="stat"><div class="stat-head">Branch load<span class="stat-icon">${icon("building")}</span></div><div class="stat-value">${D.bandwidth.branch.a}<span class="stat-unit">/ ${D.bandwidth.branch.b} Mbps</span></div><div class="stat-sub">DBP · BHTQ over EPL</div></article>
      </div>
      <div class="dash-grid">
        <section class="panel span-8">
          ${panelHead("Throughput", `Observed · ${ui.trafficRange} window`, `<span class="count-chip">capacity 1 Gbps</span>`, "activity")}
          <div class="panel-body">
            ${areaChart(series)}
            <div class="chart-legend" style="margin-top:12px">
              <span><span class="swatch"></span>Aggregate Mbps</span>
              <span class="mono">down ${Math.round(D.bandwidth.down / 1000)} GB · up ${Math.round(D.bandwidth.up / 1000)} GB · ${D.bandwidth.totalTbit} Tbit monthly</span>
            </div>
          </div>
        </section>
        <section class="panel span-4">
          ${panelHead("Top talkers", "Share of sampled traffic", "", "users")}
          <div class="panel-body">
            ${barsHtml(D.topTalkers.map((talker) => ({ label: talker.label, value: talker.value, display: `${talker.value}`, tone: talker.tone })))}
          </div>
          <div class="panel-foot"><span>HIS + PACS dominate clinical traffic.</span><span class="mono">sampled</span></div>
        </section>
        <section class="panel span-6">
          ${panelHead("Demand sources", "Monthly volume by population", "", "database")}
          <div class="panel-body">
            ${barsHtml(D.bandwidth.sources.map((source) => ({ label: source.label, value: source.value, display: `${Math.round(source.value / 1000)} GB`, tone: source.swatch === "swatch-amber" ? "var(--warning)" : source.swatch === "swatch-violet" ? "var(--violet)" : source.swatch === "swatch-cyan" ? "var(--sky)" : source.swatch === "swatch-teal" ? "var(--emerald)" : "var(--accent)" })))}
          </div>
        </section>
        <section class="panel span-6">
          ${panelHead("WAN utilisation", "Per circuit · live", `<a class="link-arrow" href="#/routing">Circuits ${icon("arrow")}</a>`, "globe")}
          <div class="panel-body stack-sm">
            ${[
              { name: "MPLS EPL #1 · DBP", load: 42, cap: "200 Mbps", down: "r-wan|r-dbp|mpls" },
              { name: "MPLS EPL #2 · BHTQ", load: 58, cap: "200 Mbps", down: "r-wan|r-bhtq|mpls" },
              { name: "Serial S0/1/0 · DBP", load: 0, cap: "2 Mbps", down: "r-wan|r-dbp|serial" },
              { name: "ISP1 uplink", load: 31, cap: "1 Gbps", down: "isp1|r-edge|internet" },
              { name: "ISP2 uplink", load: 0, cap: "1 Gbps", down: "isp2|r-edge|internet" }
            ].map((circuit) => {
              const down = state.linksDown.has(circuit.down);
              const tone = down ? "is-danger" : circuit.load > 80 ? "is-warning" : "";
              return `<div>
                <div class="meter-labels"><span>${esc(circuit.name)} ${down ? `<span class="tag tag-rose">isolated</span>` : ""}</span><span>${down ? "0" : circuit.load}% · ${esc(circuit.cap)}</span></div>
                <div class="meter ${tone}"><span style="width:${down ? 0 : circuit.load}%"></span></div>
              </div>`;
            }).join("")}
          </div>
        </section>
      </div>
    </div>`;
  }

  /* ------------------------------------------------------------------ *
   * Route: Events
   * ------------------------------------------------------------------ */

  function eventRowsHtml() {
    const rows = filteredEvents();
    if (!rows.length) return `<tr><td colspan="5"><div class="empty-state">No events match this filter.</div></td></tr>`;
    return rows.map((event) => `
      <tr>
        <td class="mono muted" title="${esc(new Date(event.ts).toLocaleString())}">${fmtAgo(event.ts)}</td>
        <td><span class="tag ${SEV_TAG[event.severity] || "tag-grey"}">${esc(event.severity)}</span></td>
        <td class="mono">${esc(event.source)}</td>
        <td class="muted tiny">${esc(event.category)}</td>
        <td>${event.read ? "" : `<span class="dot dot-accent" style="display:inline-block;margin-right:7px" aria-label="unread"></span>`}${esc(event.message)}</td>
      </tr>`).join("");
  }

  function eventsView() {
    const categories = ["all", ...Array.from(new Set(state.events.map((event) => event.category)))];
    return `<div class="view">
      ${pageHead({
        icon: "terminal", eyebrow: "Observability", title: "Event log",
        sub: "Syslog-style stream from the simulation — routing, security, WAN, NAT and system events, newest first.",
        actions: `<button class="btn btn-quiet" type="button" data-action="events-export">${icon("download")}Export JSON</button><button class="btn btn-primary" type="button" data-action="events-read">${icon("check")}Mark all read</button>`
      })}
      <div class="filter-bar">
        <label class="search">${icon("search")}<input class="input" id="event-q" type="search" value="${esc(ui.eventQ)}" placeholder="Search message or source…" aria-label="Search events"></label>
        ${selectField({ label: "Filter by severity", attrs: "id='event-sev'", value: ui.eventSev, items: [{ value: "all", label: "All severities" }, { value: "info", label: "Info" }, { value: "success", label: "Success" }, { value: "warning", label: "Warning" }, { value: "danger", label: "Critical" }] })}
        ${selectField({ label: "Filter by category", attrs: "id='event-cat'", value: ui.eventCat, items: categories.map((category) => ({ value: category, label: category === "all" ? "All categories" : category })) })}
        <span class="spacer"></span>
        <span class="count-chip" id="event-count">${filteredEvents().length} of ${state.events.length}</span>
      </div>
      <section class="panel">
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Time</th><th>Severity</th><th>Source</th><th>Category</th><th>Message</th></tr></thead>
            <tbody id="event-rows">${eventRowsHtml()}</tbody>
          </table>
        </div>
        <div class="table-note"><span>Retains the newest 240 events. Telemetry pauses with the simulation.</span><span class="mono">${state.simRunning ? "ingesting" : "paused"}</span></div>
      </section>
    </div>`;
  }

  /* ------------------------------------------------------------------ *
   * Route: Backups
   * ------------------------------------------------------------------ */

  function backupRowsHtml() {
    if (!state.snapshots.length) return `<tr><td colspan="6"><div class="empty-state">No snapshots yet. Run a backup.</div></td></tr>`;
    return state.snapshots.map((snap) => `
      <tr>
        <td><div class="cell-main mono">${esc(snap.device)}</div><div class="cell-sub">${esc(snap.site || "")}</div></td>
        <td class="mono muted">${esc(snap.config)}</td>
        <td class="mono tiny">${fmtAgo(snap.ts)}</td>
        <td class="num right">${esc(snap.size)}</td>
        <td class="mono muted tiny">${esc(snap.md5)}</td>
        <td class="right"><div class="row-actions"><button class="icon-btn" type="button" data-action="download-config" data-device="${esc(snap.device)}" data-file="${esc(snap.config)}" aria-label="Download ${esc(snap.device)} configuration" title="Download">${icon("download")}</button></div></td>
      </tr>`).join("");
  }

  function backupsView() {
    const total = snapshotBytes();
    return `<div class="view">
      ${pageHead({
        icon: "database", eyebrow: "Configuration management", title: "Backups",
        sub: "Versioned running-config snapshots pulled from every managed device over TFTP. Open an archived file to review it, or force an on-demand run.",
        actions: `<button class="btn btn-quiet" type="button" data-action="backup-clear">${icon("trash")}Clear history</button><button class="btn btn-primary" type="button" data-action="backup-all">${icon("download")}Back up all</button>`
      })}
      <div class="stat-grid">
        <article class="stat"><div class="stat-head">Snapshots<span class="stat-icon">${icon("database")}</span></div><div class="stat-value">${state.snapshots.length}</div><div class="stat-sub">${new Set(state.snapshots.map((snap) => snap.device)).size} devices covered</div></article>
        <article class="stat"><div class="stat-head">Archive size<span class="stat-icon">${icon("file")}</span></div><div class="stat-value">${total.toFixed(1)}<span class="stat-unit">KB</span></div><div class="stat-sub">text manifests · md5 verified</div></article>
        <article class="stat"><div class="stat-head">Last run<span class="stat-icon">${icon("clock")}</span></div><div class="stat-value" style="font-size:20px">${state.snapshots[0] ? fmtAgo(state.snapshots[0].ts) : "—"}</div><div class="stat-sub">${prefs.nightlyBackup ? "nightly schedule on" : "nightly schedule off"}</div></article>
        <article class="stat"><div class="stat-head">Config coverage<span class="stat-icon">${icon("server")}</span></div><div class="stat-value">${inventory.filter((device) => device.config).length}</div><div class="stat-sub">devices with an archived config</div></article>
      </div>
      <div class="callout callout--info" style="margin-bottom:14px">
        ${icon("clock")}
        <div><strong>Nightly backup ${prefs.nightlyBackup ? "enabled" : "disabled"}</strong>Runs at 02:00 against SRV-LOG over TFTP. Toggle it in Settings → Automation.</div>
        <div class="callout-actions"><a class="btn btn-ghost btn-sm" href="#/settings">Settings</a></div>
      </div>
      <section class="panel">
        ${panelHead("Snapshot history", "Newest first · current session", `<span class="count-chip">${state.snapshots.length} files</span>`, "database")}
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Device</th><th>File</th><th>Taken</th><th class="right">Size</th><th>MD5</th><th class="right">Download</th></tr></thead>
            <tbody id="backup-rows">${backupRowsHtml()}</tbody>
          </table>
        </div>
        <div class="table-note"><span>Manual runs archive every device with a verified config.</span><span class="mono">TFTP · 10.10.20.8</span></div>
      </section>
    </div>`;
  }

  /* ------------------------------------------------------------------ *
   * Route: Settings
   * ------------------------------------------------------------------ */

  function themeCard() {
    return `<section class="panel">
      ${panelHead("Appearance", "Theme and density", "", "sun")}
      <div class="panel-body">
        <div class="setting-row">
          <div class="setting-info"><strong>Theme</strong><span>Dark is tuned for the NOC wall display; light reads better on projectors and in bright rooms.</span></div>
          <div class="setting-control">
            <div class="seg" role="group" aria-label="Theme">
              <button class="seg-btn" type="button" data-action="set-theme" data-theme="dark" aria-pressed="${prefs.theme === "dark"}">Dark</button>
              <button class="seg-btn" type="button" data-action="set-theme" data-theme="light" aria-pressed="${prefs.theme === "light"}">Light</button>
            </div>
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-info"><strong>Density</strong><span>Compact fits more rows on a 1080p operations display.</span></div>
          <div class="setting-control">
            <div class="seg" role="group" aria-label="Density">
              <button class="seg-btn" type="button" data-action="set-density" data-density="comfortable" aria-pressed="${prefs.density !== "compact"}">Comfortable</button>
              <button class="seg-btn" type="button" data-action="set-density" data-density="compact" aria-pressed="${prefs.density === "compact"}">Compact</button>
            </div>
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-info"><strong>Reduce motion</strong><span>Stops flow animation on MPLS links and overlay transitions.</span></div>
          <div class="setting-control"><button class="switch" type="button" role="switch" aria-checked="${prefs.reduceMotion}" aria-label="Reduce motion" data-action="toggle-pref" data-pref="reduceMotion"></button></div>
        </div>
      </div>
    </section>`;
  }

  function behaviourCard() {
    return `<section class="panel">
      ${panelHead("Behaviour", "Safety rails for destructive actions", "", "settings")}
      <div class="panel-body">
        <div class="setting-row">
          <div class="setting-info"><strong>Confirm destructive actions</strong><span>Ask before clearing the deploy queue, deleting history or reloading.</span></div>
          <div class="setting-control"><button class="switch" type="button" role="switch" aria-checked="${prefs.confirm}" aria-label="Confirm destructive actions" data-action="toggle-pref" data-pref="confirm"></button></div>
        </div>
        <div class="setting-row">
          <div class="setting-info"><strong>Relative timestamps</strong><span>Show “4m ago” instead of a wall clock in feeds and tables.</span></div>
          <div class="setting-control"><button class="switch" type="button" role="switch" aria-checked="${prefs.relativeTime}" aria-label="Relative timestamps" data-action="toggle-pref" data-pref="relativeTime"></button></div>
        </div>
        <div class="setting-row">
          <div class="setting-info"><strong>Live telemetry</strong><span>Samples throughput and drips ambient events every few seconds.</span></div>
          <div class="setting-control"><button class="switch" type="button" role="switch" aria-checked="${prefs.live}" aria-label="Live telemetry" data-action="toggle-pref" data-pref="live"></button></div>
        </div>
        <div class="setting-row">
          <div class="setting-info"><strong>Sampling interval</strong><span>How often the throughput gauge refreshes.</span></div>
          <div class="setting-control">${selectField({ label: "Sampling interval", attrs: "data-pref-select='interval'", value: String(prefs.interval), items: [{ value: "2000", label: "2 s" }, { value: "4000", label: "4 s" }, { value: "8000", label: "8 s" }, { value: "15000", label: "15 s" }] })}</div>
        </div>
      </div>
    </section>`;
  }

  function automationCard() {
    return `<section class="panel">
      ${panelHead("Automation", "Scheduled jobs", "", "clock")}
      <div class="panel-body">
        <div class="setting-row">
          <div class="setting-info"><strong>Nightly configuration backup</strong><span>02:00 · pull all running-configs to SRV-LOG over TFTP.</span></div>
          <div class="setting-control"><button class="switch" type="button" role="switch" aria-checked="${prefs.nightlyBackup}" aria-label="Nightly backup" data-action="toggle-pref" data-pref="nightlyBackup"></button></div>
        </div>
        <div class="setting-row">
          <div class="setting-info"><strong>Run backup now</strong><span>Archive all ${inventory.filter((device) => device.config).length} verified configurations.</span></div>
          <div class="setting-control"><button class="btn btn-quiet btn-sm" type="button" data-action="backup-all">${icon("download")}Back up</button></div>
        </div>
        <div class="setting-row">
          <div class="setting-info"><strong>Scheduled health check</strong><span>KC-1…KC-6 run hourly; failures raise an alert.</span></div>
          <div class="setting-control"><button class="btn btn-quiet btn-sm" type="button" data-action="health">${icon("shield")}Run now</button></div>
        </div>
      </div>
    </section>`;
  }

  function simulationCard() {
    return `<section class="panel">
      ${panelHead("Simulation", "Packet Tracer workspace", "", "terminal")}
      <div class="panel-body">
        <dl class="about-list">
          <div><dt class="k">Workspace</dt><dd class="v">simulation/CCC-Hospital.pkt</dd></div>
          <div><dt class="k">Packet Tracer</dt><dd class="v">${esc(D.meta.ptVersion)}</dd></div>
          <div><dt class="k">Devices · links</dt><dd class="v">${D.meta.devices} · ${D.meta.links}</dd></div>
          <div><dt class="k">Console build</dt><dd class="v">${esc(D.meta.version)}</dd></div>
          <div><dt class="k">State</dt><dd class="v">${state.simRunning ? "running" : "paused"} · ${state.pending.size} staged</dd></div>
        </dl>
        <hr class="divider">
        <div class="btn-row">
          <button class="btn btn-quiet btn-sm" type="button" data-action="discard-changes"${state.pending.size ? "" : " disabled"}>Discard staged changes</button>
          <button class="btn btn-quiet btn-sm" type="button" data-action="reset-links"${state.linksDown.size ? "" : " disabled"}>Restore all links</button>
          <button class="btn btn-danger btn-sm" type="button" data-action="reload-sim">${icon("power")}Reload simulation</button>
        </div>
        <p class="note" style="margin-top:10px">Reload clears staged changes, restores every circuit and resets event history to the seeded baseline.</p>
      </div>
    </section>`;
  }

  function settingsView() {
    return `<div class="view">
      ${pageHead({
        icon: "settings", eyebrow: "Console", title: "Settings",
        sub: "Preferences for this browser session, automation schedules and the live connection to CCC-Hospital.pkt.",
        actions: `<button class="btn btn-quiet" type="button" data-action="reset-prefs">${icon("reset")}Reset preferences</button>`
      })}
      <div class="settings-grid">
        ${themeCard()}
        ${behaviourCard()}
        ${automationCard()}
        ${simulationCard()}
        <section class="panel" style="grid-column:1/-1">
          ${panelHead("About this console", "Build and workspace", "", "file")}
          <div class="panel-body">
            <dl class="about-list">
              <div><dt class="k">Workspace</dt><dd class="v">CCC-Hospital.pkt</dd></div>
              <div><dt class="k">Packet Tracer</dt><dd class="v">${esc(D.meta.ptVersion)}</dd></div>
              <div><dt class="k">Topology</dt><dd class="v">${D.meta.devices} devices · ${D.meta.links} links · 3 sites</dd></div>
              <div><dt class="k">Console version</dt><dd class="v">${esc(D.meta.version)}</dd></div>
            </dl>
            <p class="note" style="margin-top:12px">Actions in this console drive a local operations overlay. Nothing is written back into the .pkt file — pair the console with the device CLIs when you need graded evidence.</p>
          </div>
        </section>
      </div>
    </div>`;
  }

  /* ------------------------------------------------------------------ *
   * Routes table
   * ------------------------------------------------------------------ */

  const ROUTES = [
    { id: "dashboard", label: "Dashboard", icon: "grid", view: dashboardView },
    { id: "topology", label: "Topology control", icon: "network", view: topologyView },
    { id: "devices", label: "Devices", icon: "server", view: devicesView },
    { id: "vlans", label: "VLANs & addressing", icon: "layers", view: vlansView },
    { id: "routing", label: "Routing & WAN", icon: "route", view: routingView },
    { id: "security", label: "Security", icon: "shield", view: securityView },
    { id: "traffic", label: "Traffic", icon: "activity", view: trafficView },
    { id: "events", label: "Event log", icon: "terminal", view: eventsView },
    { id: "backups", label: "Backups", icon: "database", view: backupsView },
    { id: "settings", label: "Settings", icon: "settings", view: settingsView }
  ];

  let pendingConfirm = null;

  /* ------------------------------------------------------------------ *
   * Drawers
   * ------------------------------------------------------------------ */

  function resolveDrawer(id) {
    const device = inventoryById.get(id);
    if (device) return { kind: "device", device, nodeId: device.nodeId };
    const node = nodeById.get(id);
    if (!node) return null;
    if (node.kind === "cluster") return { kind: "cluster", node, nodeId: node.id };
    const exact = inventory.find((item) => item.nodeId === id && !item.member);
    if (exact) return { kind: "device", device: exact, nodeId: id };
    return { kind: "node", node, nodeId: id };
  }

  function drawerHeadHtml(glyph, name, sub, status) {
    return `<header class="drawer-head">
      <span class="device-icon">${icon(glyph)}</span>
      <div class="drawer-title">
        <h2>${esc(name)}</h2>
        <div class="sub">${esc(sub)}${status ? ` · <span class="status is-${status.tone}"><span class="dot"></span>${esc(status.label)}</span>` : ""}</div>
      </div>
      <button class="icon-btn" type="button" data-action="close-drawer" aria-label="Close device panel">${icon("x")}</button>
    </header>`;
  }

  function circuitRowHtml(link, nodeId) {
    const key = linkKey(link);
    const other = otherNode(link, nodeId);
    const pending = state.pending.get(`link:${key}`);
    const down = state.linksDown.has(key);
    const tone = pending ? "warning" : down ? "danger" : "success";
    const label = pending ? "Staged" : down ? "Isolated" : "Up";
    return `<div class="iface-row">
      <div class="iface-main">
        <div class="iface-name">${esc(other ? other.name : link.b)}</div>
        <div class="iface-meta">${esc(link.type.toUpperCase())}<span class="row-sep">·</span>${esc(truncate(linkLabel(link), 40))}</div>
      </div>
      <div class="btn-row">
        <span class="status is-${tone}"><span class="dot"></span>${label}</span>
        ${pending
          ? `<button class="btn btn-quiet btn-sm" type="button" data-action="undo-change" data-id="${esc(`link:${key}`)}">Undo</button>`
          : `<button class="btn btn-ghost btn-sm" type="button" data-action="stage-link" data-key="${esc(key)}" data-desired="${down ? "up" : "down"}">${down ? "Restore" : "Isolate"}</button>`}
      </div>
    </div>`;
  }

  function hardeningChips(deviceName) {
    const row = hardeningRows().find((item) => item.device === deviceName);
    if (!row) return "";
    const chip = (on, label) => `<span class="kv-inline">${checkIcon(!!on)}${esc(label)}</span>`;
    return `<div class="drawer-section">
      <h3>Hardening</h3>
      <div class="stack-sm">
        ${chip(row.ssh, "SSH v2 only")}
        ${chip(row.secret, "Enable secret")}
        ${chip(row.syslog, "Syslog → 10.10.20.8")}
        ${row.ntp
          ? `<span class="kv-inline">${checkIcon(true)}NTP synchronized</span>`
          : `<span class="kv-inline">${checkIcon(false)}NTP missing</span><button class="btn btn-quiet btn-sm" type="button" data-action="ntp-fix" data-device="${esc(deviceName)}">${icon("clock")}Stage NTP fix</button>`}
      </div>
    </div>`;
  }

  function deviceDrawer(device) {
    const node = device.parent || nodeById.get(device.nodeId);
    const nodeId = device.nodeId || (node && node.id);
    const status = nodeStatus(nodeId);
    const links = nodeLinks(nodeId);
    const ps = D.portSecurity.find((row) => row.device === device.name);
    const events = state.events.filter((event) => event.source === device.name || event.source === device.model).slice(0, 4);
    const ips = device.member ? [] : ((node && node.ips) || []).filter((ip) => ip.includes(" ") || ip.includes("/"));
    const kind = KIND_LABEL[device.kind] || device.kind;
    const isNetwork = ["router", "switch"].includes(device.kind);

    return `<div class="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      ${drawerHeadHtml(KIND_ICON[device.kind] || "server", device.name, `${kind} · ${device.model || ""}`, status)}
      <div class="drawer-body">
        <section class="drawer-section">
          <dl class="meta-grid">
            <div><dt>Site</dt><dd>${esc(device.site)}</dd></div>
            <div><dt>Zone</dt><dd>${esc(device.zone || "—")}</dd></div>
            <div><dt>VLAN</dt><dd class="mono">${esc(device.vlan || "—")}</dd></div>
            <div><dt>Address</dt><dd class="mono">${esc(device.ip)}</dd></div>
            <div><dt>Management</dt><dd class="mono">${esc(device.mgmt || "—")}</dd></div>
            <div><dt>${device.member ? "Member of" : "Role"}</dt><dd>${esc(device.member ? device.parent.name : device.role || "—")}</dd></div>
          </dl>
        </section>

        ${ips.length ? `<section class="drawer-section">
          <h3>Interfaces</h3>
          ${ips.map((entry) => {
            const parts = entry.split(" ");
            const name = parts.length > 1 ? parts[0] : "Gi0/0";
            const addr = parts.length > 1 ? parts.slice(1).join(" ") : parts[0];
            const down = status.tone === "danger";
            return `<div class="iface-row">
              <div class="iface-main"><div class="iface-name">${esc(name)}</div><div class="iface-meta">${esc(addr)}</div></div>
              <span class="status is-${down ? "danger" : "success"}"><span class="dot"></span>${down ? "down" : "up"}</span>
            </div>`;
          }).join("")}
        </section>` : ""}

        ${links.length ? `<section class="drawer-section">
          <h3>Circuits · ${links.length}</h3>
          ${links.map((link) => circuitRowHtml(link, nodeId)).join("")}
        </section>` : ""}

        ${isNetwork ? hardeningChips(device.name) : ""}

        ${ps ? `<section class="drawer-section">
          <h3>Port security</h3>
          <div class="stack-sm">
            <div class="kv-inline">${icon("lock")}<strong>${ps.ports} ports</strong> secured</div>
            <div class="kv-inline">${icon("shield")}Policy <strong>${esc(ps.policy)}</strong></div>
            <div class="kv-inline">${icon("users")}Maximum <strong>${esc(ps.max)}</strong></div>
            <div class="kv-inline">${icon("alert")}Violations <strong class="${ps.violations ? "text-warning" : ""}">${ps.violations}</strong></div>
          </div>
        </section>` : ""}

        ${device.member ? `<section class="drawer-section">
          <h3>Endpoint</h3>
          <div class="stack-sm">
            <div class="kv-inline">${icon("pc")}Representative for <strong>${esc(device.parent.role || "site endpoints")}</strong></div>
            <div class="kv-inline">${icon("network")}Cluster <strong>${esc(device.parent.name)}</strong></div>
          </div>
          <p class="drawer-note" style="margin-top:8px">${esc(device.parent.note || "")}</p>
        </section>` : ""}

        ${node && node.note ? `<section class="drawer-section">
          <h3>Notes</h3>
          <p class="drawer-note">${esc(node.note)}</p>
        </section>` : ""}

        ${events.length ? `<section class="drawer-section">
          <h3>Recent events</h3>
          ${events.map((event) => `<div class="iface-row">
            <div class="iface-main"><div class="iface-meta">${esc(truncate(event.message, 70))}</div></div>
            <span class="feed-time">${fmtAgo(event.ts)}</span>
          </div>`).join("")}
        </section>` : ""}

        ${device.config ? `<section class="drawer-section">
          <h3>Configuration</h3>
          <div class="iface-row">
            <div class="iface-main"><div class="iface-name">${esc(device.config)}</div><div class="iface-meta">running-config · archived over TFTP</div></div>
            <button class="btn btn-quiet btn-sm" type="button" data-action="download-config" data-device="${esc(device.name)}" data-file="${esc(device.config)}">${icon("download")}Open</button>
          </div>
        </section>` : ""}
      </div>
      <footer class="drawer-foot">
        <button class="btn btn-quiet btn-sm" type="button" data-action="locate-node" data-node="${esc(nodeId)}">${icon("network")}Locate</button>
        <div class="btn-row">
          ${isNetwork || device.kind === "server" ? `<button class="btn btn-ghost btn-sm" type="button" data-action="ping-device" data-node="${esc(nodeId)}">${icon("zap")}Ping</button>` : ""}
          <button class="btn btn-primary btn-sm" type="button" data-action="console" data-id="${esc(device.id)}">${icon("terminal")}Console</button>
        </div>
      </footer>
    </div>`;
  }

  function clusterDrawer(node) {
    const status = nodeStatus(node.id);
    const members = D.clusterMembers[node.id] || [];
    const links = nodeLinks(node.id);
    return `<div class="drawer" role="dialog" aria-modal="true">
      ${drawerHeadHtml("cluster", node.name, `${members.length} members · ${node.model}`, status)}
      <div class="drawer-body">
        <section class="drawer-section">
          <dl class="meta-grid">
            <div><dt>Site</dt><dd>${esc(node.site)}</dd></div>
            <div><dt>VLAN</dt><dd class="mono">${esc(node.vlan)}</dd></div>
            <div><dt>Zone</dt><dd>${esc(node.zone)}</dd></div>
            <div><dt>Role</dt><dd>${esc(node.role || "—")}</dd></div>
          </dl>
        </section>
        <section class="drawer-section">
          <h3>Members</h3>
          ${members.map((member) => {
            const id = `${node.id}:${slug(member.name)}`;
            const device = inventoryById.get(id);
            return `<div class="member-row">
              <div>
                <div class="member-name">${esc(member.name)}</div>
                <div class="member-ip">${esc(member.ip || "—")}</div>
              </div>
              <button class="btn btn-ghost btn-sm" type="button" data-action="inspect" data-id="${esc(id)}" ${device ? "" : "disabled"}>Inspect</button>
            </div>`;
          }).join("")}
        </section>
        ${links.length ? `<section class="drawer-section">
          <h3>Uplinks</h3>
          ${links.map((link) => circuitRowHtml(link, node.id)).join("")}
        </section>` : ""}
        <section class="drawer-section">
          <h3>Notes</h3>
          <p class="drawer-note">${esc(node.note || "")}</p>
        </section>
      </div>
      <footer class="drawer-foot">
        <button class="btn btn-quiet btn-sm" type="button" data-action="locate-node" data-node="${esc(node.id)}">${icon("network")}Locate</button>
        <button class="btn btn-quiet btn-sm" type="button" data-action="close-drawer">Close</button>
      </footer>
    </div>`;
  }

  function nodeDrawer(node) {
    const status = nodeStatus(node.id);
    const links = nodeLinks(node.id);
    return `<div class="drawer" role="dialog" aria-modal="true">
      ${drawerHeadHtml(KIND_ICON[node.kind] || "cloud", node.name, `${KIND_LABEL[node.kind] || node.kind} · ${node.model}`, status)}
      <div class="drawer-body">
        <section class="drawer-section">
          <dl class="meta-grid">
            <div><dt>Scope</dt><dd>${esc(node.site)}</dd></div>
            <div><dt>Zone</dt><dd>${esc(node.zone)}</dd></div>
            <div><dt>Role</dt><dd>${esc(node.role || "—")}</dd></div>
            <div><dt>Addressing</dt><dd class="mono">${esc((node.ips || []).join(" · ") || "—")}</dd></div>
          </dl>
        </section>
        ${links.length ? `<section class="drawer-section"><h3>Circuits</h3>${links.map((link) => circuitRowHtml(link, node.id)).join("")}</section>` : ""}
        <section class="drawer-section"><h3>Notes</h3><p class="drawer-note">${esc(node.note || "")}</p></section>
      </div>
      <footer class="drawer-foot">
        <button class="btn btn-quiet btn-sm" type="button" data-action="locate-node" data-node="${esc(node.id)}">${icon("network")}Locate</button>
        <button class="btn btn-quiet btn-sm" type="button" data-action="close-drawer">Close</button>
      </footer>
    </div>`;
  }

  function drawerHtml(resolved) {
    if (resolved.kind === "cluster") return clusterDrawer(resolved.node);
    if (resolved.kind === "node") return nodeDrawer(resolved.node);
    return deviceDrawer(resolved.device);
  }

  /* ------------------------------------------------------------------ *
   * Circuit control modal
   * ------------------------------------------------------------------ */

  function openLinkControl(key) {
    const link = linkByKey(key);
    if (!link) return;
    const entry = WAN_ENTRIES.find((item) => item.key === key);
    const pending = state.pending.get(`link:${key}`);
    const down = state.linksDown.has(key);
    const status = entry ? wanState(entry) : down ? { tone: "danger", label: "Isolated" } : { tone: "success", label: "Active" };
    openModal({
      title: linkLabel(link),
      sub: `${link.type.toUpperCase()} · ${nodeName(link.a)} ↔ ${nodeName(link.b)}`,
      glyph: "link",
      body: `<dl class="meta-grid">
        <div><dt>Endpoints</dt><dd class="mono">${esc(nodeName(link.a))} ↔ ${esc(nodeName(link.b))}</dd></div>
        <div><dt>Medium</dt><dd>${esc(link.type)}</dd></div>
        <div><dt>Addressing</dt><dd class="mono">${esc(entry ? entry.addr : "—")}</dd></div>
        <div><dt>Role</dt><dd>${esc(entry ? entry.role : link.type === "fiber" ? "Trunk" : "Access")}</dd></div>
        <div><dt>State</dt><dd><span class="status is-${status.tone}"><span class="dot"></span>${esc(status.label)}</span></dd></div>
        <div><dt>Owner</dt><dd>${esc(entry ? entry.device.toUpperCase() : nodeName(link.a))}</dd></div>
      </dl>
      <div class="callout ${down || pending ? "callout--warning" : "callout--info"}" style="margin-top:14px">
        ${icon(down ? "alert" : entry ? "link" : "shield")}
        <div><strong>${!entry ? "Fabric link" : pending ? "Change staged" : down ? "Circuit isolated" : "Circuit healthy"}</strong>${!entry
          ? "Internal path inside the hospital fabric. Circuit isolation drills run on the six WAN circuits."
          : pending
            ? `Queued to ${pending.desiredDown ? "shut down" : "restore"} on deploy. Undo it or deploy from the top bar.`
            : down ? "Downstream devices report degraded or isolated until you restore this circuit." : "Isolation is staged first so the production path is never interrupted by accident."}</div>
      </div>
      <div class="mono-block" style="margin-top:14px"><span class="c">! interface snapshot</span>${esc(linkPath(link))}</div>`,
      foot: `<button class="btn btn-quiet" type="button" data-action="close-modal">Close</button>
        ${!entry ? "" : pending
          ? `<button class="btn btn-quiet" type="button" data-action="undo-change" data-id="${esc(`link:${key}`)}">Undo staging</button>`
          : `<button class="btn ${down ? "btn-primary" : "btn-danger"}" type="button" data-action="stage-link" data-key="${esc(key)}" data-desired="${down ? "up" : "down"}">${down ? "Restore circuit" : "Isolate circuit"}</button>`}`
    });
  }

  /* ------------------------------------------------------------------ *
   * VLAN inspector + forms
   * ------------------------------------------------------------------ */

  function inspectVlan(site, vlanId) {
    const vlan = vlanRows(site).find((row) => String(row.id) === String(vlanId));
    if (!vlan) return;
    const members = inventory.filter((device) => String(device.vlan || "").split(/[\s/,]+/).includes(String(vlan.id)));
    openModal({
      title: `VLAN ${vlan.id} · ${vlan.name}`,
      sub: `${SITE_LABELS[site]} · ${vlan.subnet}`,
      glyph: "layers",
      body: `<div class="nat-grid">
        <div class="nat-cell"><div class="k">Gateway</div><div class="v">${esc(vlan.gw)}</div></div>
        <div class="nat-cell"><div class="k">Subnet</div><div class="v">${esc(vlan.subnet)}</div></div>
        <div class="nat-cell"><div class="k">Purpose</div><div class="v">${esc(vlan.purpose)}</div></div>
        <div class="nat-cell"><div class="k">Members in inventory</div><div class="v">${members.length}</div></div>
      </div>
      ${members.length ? `<div class="table-wrap" style="margin-top:14px">
        <table class="data">
          <thead><tr><th>Device</th><th>Type</th><th class="right">Address</th></tr></thead>
          <tbody>${members.map((device) => `<tr><td class="mono">${esc(device.name)}</td><td class="muted tiny">${esc(KIND_LABEL[device.kind] || device.kind)}</td><td class="mono right">${esc(device.ip)}</td></tr>`).join("")}</tbody>
        </table>
      </div>` : `<p class="note" style="margin-top:14px">No inventory devices report this VLAN; it is reserved for future endpoints.</p>`}
      <p class="form-note" style="margin-top:14px">VLAN membership is read from the device inventory. Interface-level assignment stays in the Packet Tracer running-config.</p>`,
      foot: `<button class="btn btn-quiet" type="button" data-action="close-modal">Close</button><a class="btn btn-primary" href="#/devices" data-action="go-devices">${icon("server")}Open devices</a>`
    });
  }

  function openVlanForm() {
    const siteKeys = Object.keys(SITE_KEYS);
    openModal({
      title: "New VLAN",
      sub: "Queued as a staged change",
      glyph: "layers",
      body: `<form id="vlan-form" data-form="vlan" novalidate>
        <div class="field-row">
          <div class="field"><label for="vlan-id">VLAN ID</label><input class="input" id="vlan-id" name="id" type="number" min="2" max="4094" inputmode="numeric" placeholder="80" required><p class="form-error" hidden></p></div>
          <div class="field"><label for="vlan-name">Name</label><input class="input" id="vlan-name" name="name" maxlength="24" placeholder="LAB-IMAGING" required><p class="form-error" hidden></p></div>
        </div>
        <div class="field-row" style="margin-top:12px">
          <div class="field"><label for="vlan-site">Site</label><select class="select" id="vlan-site" name="site">${siteKeys.map((key) => `<option value="${key}"${key === ui.vlanSite ? " selected" : ""}>${SITE_LABELS[key]}</option>`).join("")}</select><p class="form-error" hidden></p></div>
          <div class="field"><label for="vlan-purpose">Purpose</label><input class="input" id="vlan-purpose" name="purpose" maxlength="48" placeholder="Imaging workstations" required><p class="form-error" hidden></p></div>
        </div>
        <div class="field-row" style="margin-top:12px">
          <div class="field"><label for="vlan-subnet">Subnet</label><input class="input mono" id="vlan-subnet" name="subnet" placeholder="10.10.80.0/24" required><p class="form-error" hidden></p></div>
          <div class="field"><label for="vlan-gw">Gateway</label><input class="input mono" id="vlan-gw" name="gw" placeholder="10.10.80.1" required><p class="form-error" hidden></p></div>
        </div>
        <p class="form-note" style="margin-top:12px">The VLAN lands in the deploy queue as a sub-interface on the site router. Nothing changes until you deploy.</p>
      </form>`,
      foot: `<button class="btn btn-quiet" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit" form="vlan-form">${icon("plus")}Stage VLAN</button>`
    });
  }

  function submitVlan(form) {
    const idInput = form.elements.id;
    const nameInput = form.elements.name;
    const siteInput = form.elements.site;
    const subnetInput = form.elements.subnet;
    const gwInput = form.elements.gw;
    const purposeInput = form.elements.purpose;
    let firstBad = null;
    const fail = (input, message) => { fieldError(input, message); if (!firstBad) firstBad = input; };
    [idInput, nameInput, subnetInput, gwInput, purposeInput].forEach((input) => fieldError(input, ""));

    const id = Number(idInput.value);
    const name = nameInput.value.trim().toUpperCase();
    const site = siteInput.value;
    const subnet = subnetInput.value.trim();
    const gw = gwInput.value.trim();
    const purpose = purposeInput.value.trim();
    const existing = vlanRows(site);

    if (!Number.isInteger(id) || id < 2 || id > 4094) fail(idInput, "VLAN ID must be 2–4094.");
    else if (existing.some((row) => Number(row.id) === id)) fail(idInput, `VLAN ${id} already exists on ${SITE_LABELS[site]}.`);
    if (!/^[A-Z0-9][A-Z0-9-]{1,23}$/.test(name)) fail(nameInput, "Use 2–24 letters, digits or dashes.");
    if (!/^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/.test(subnet)) fail(subnetInput, "Expected a CIDR subnet, e.g. 10.10.80.0/24.");
    if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(gw)) fail(gwInput, "Expected an IPv4 gateway address.");
    else if (subnet.includes("/") && gw.split(".").slice(0, 3).join(".") !== subnet.split("/")[0].split(".").slice(0, 3).join(".")) fail(gwInput, "Gateway must sit inside the subnet.");
    if (!purpose) fail(purposeInput, "Describe what the VLAN carries.");

    if (firstBad) {
      firstBad.focus();
      return;
    }
    closeModal();
    stageVlan({ site, id, name, subnet, gw, purpose });
    if (ui.route !== "vlans") location.hash = "#/vlans";
  }

  function openAclForm() {
    openModal({
      title: "Add guest ACL rule",
      sub: `ACL ${ui.aclTab} · applied inbound`,
      glyph: "shield",
      body: `<form id="acl-form" data-form="acl" novalidate>
        <div class="field-row">
          <div class="field"><label for="acl-seq">Sequence</label><input class="input mono" id="acl-seq" name="seq" type="number" min="1" max="99" placeholder="25" required><p class="form-error" hidden></p></div>
          <div class="field"><label for="acl-action">Action</label><select class="select" id="acl-action" name="action"><option value="permit">permit</option><option value="deny">deny</option></select><p class="form-error" hidden></p></div>
        </div>
        <div class="field-row" style="margin-top:12px">
          <div class="field"><label for="acl-proto">Protocol</label><select class="select" id="acl-proto" name="proto"><option value="ip">ip</option><option value="tcp">tcp</option><option value="udp">udp</option></select><p class="form-error" hidden></p></div>
          <div class="field"><label for="acl-dest">Destination</label><input class="input mono" id="acl-dest" name="dest" placeholder="any · host 10.10.20.5 · 10.0.0.0 0.255.255.255" required><p class="form-error" hidden></p></div>
        </div>
        <div class="field" style="margin-top:12px"><label for="acl-port">Port (optional)</label><input class="input mono" id="acl-port" name="port" type="number" min="1" max="65535" placeholder="53"><p class="form-error" hidden></p></div>
        <p class="form-note" style="margin-top:12px">Rules are evaluated top-down by sequence. Guest DNS, DHCP and DMZ web permits must stay above the LAN deny.</p>
      </form>`,
      foot: `<button class="btn btn-quiet" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit" form="acl-form">${icon("plus")}Stage rule</button>`
    });
  }

  function submitAcl(form) {
    const seqInput = form.elements.seq;
    const actionInput = form.elements.action;
    const protoInput = form.elements.proto;
    const destInput = form.elements.dest;
    const portInput = form.elements.port;
    let firstBad = null;
    const fail = (input, message) => { fieldError(input, message); if (!firstBad) firstBad = input; };
    [seqInput, destInput, portInput].forEach((input) => fieldError(input, ""));

    const seq = String(Number(seqInput.value));
    const action = actionInput.value;
    const proto = protoInput.value;
    const dest = destInput.value.trim() || "any";
    const port = portInput.value.trim();
    const taken = [...D.acl, ...state.aclExtra.filter((rule) => String(rule.acl) === String(ui.aclTab)),
      ...[...state.pending.values()].filter((change) => change.type === "acl" && String(change.rule.acl) === String(ui.aclTab)).map((change) => change.rule)]
      .some((rule) => String(rule.seq) === seq);

    if (!Number.isInteger(Number(seq)) || Number(seq) < 1 || Number(seq) > 99) fail(seqInput, "Sequence must be 1–99.");
    else if (taken) fail(seqInput, `Sequence ${seq} already exists in ACL ${ui.aclTab}.`);
    if (port && (!Number.isInteger(Number(port)) || Number(port) < 1 || Number(port) > 65535)) fail(portInput, "Port must be 1–65535.");
    if (port && proto === "ip") fail(portInput, "Ports only apply to tcp or udp.");

    if (firstBad) { firstBad.focus(); return; }

    const ruleText = `${action} ${proto} any ${dest}${port ? ` eq ${port}` : ""}`;
    closeModal();
    stageAcl({ acl: ui.aclTab, seq, action: action === "permit" ? "ALLOW" : "DENY", rule: ruleText, note: `Added from NOC · ACL ${ui.aclTab}` });
    if (ui.route !== "security") location.hash = "#/security";
  }

  function confirmDialog(options, run) {
    if (!prefs.confirm) { run(); return; }
    pendingConfirm = run;
    openModal({
      title: options.title,
      sub: options.sub,
      glyph: options.glyph || "alert",
      body: `<p class="form-note">${esc(options.body)}</p>`,
      foot: `<button class="btn btn-quiet" type="button" data-action="close-modal">Cancel</button><button class="btn ${options.danger ? "btn-danger" : "btn-primary"}" type="button" data-action="confirm-run">${esc(options.label || "Confirm")}</button>`,
      onClose: () => { pendingConfirm = null; }
    });
  }

  /* ------------------------------------------------------------------ *
   * Download / export / reset helpers
   * ------------------------------------------------------------------ */

  function downloadConfig(deviceName, file) {
    if (!file) return;
    window.open(`../docs/ptbuild/CCC-Hospital/${encodeURIComponent(file)}`, "_blank", "noopener");
    addEvent({ severity: "info", source: deviceName, category: "system", message: `Configuration ${file} opened from the verified archive` });
    toast("Configuration opened", { tone: "info", msg: file });
  }

  function exportEvents() {
    const payload = {
      exportedAt: new Date().toISOString(),
      workspace: "CCC-Hospital.pkt",
      events: state.events.map((event) => ({
        at: new Date(event.ts).toISOString(), severity: event.severity,
        source: event.source, category: event.category, message: event.message
      }))
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "ccc-hospital-events.json";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast("Event log exported", { tone: "success", msg: `${state.events.length} events written to JSON.` });
  }

  function clearBackups() {
    const count = state.snapshots.length;
    state.snapshots = [];
    syncChrome();
    render();
    toast("Backup history cleared", { tone: "warning", msg: `${count} snapshots removed locally.` });
  }

  function resetLinks() {
    const count = state.linksDown.size;
    state.linksDown.clear();
    Array.from(state.pending.keys()).filter((id) => id.startsWith("link:")).forEach((id) => state.pending.delete(id));
    render();
    if (activeDrawer) renderDrawer();
    toast("All circuits restored", { tone: "success", msg: count ? `${count} links returned to service.` : "Every circuit was already up." });
  }

  function reloadSimulation() {
    closeDrawer();
    closeModal();
    state = createState();
    ui.selection = null;
    render();
    toast("Simulation reloaded", { tone: "success", msg: "State, events and staged changes returned to the seeded baseline." });
  }

  function pingDevice(nodeId) {
    const device = inventory.find((item) => item.nodeId === nodeId) || inventoryById.get(nodeId);
    if (!device) return;
    const status = nodeStatus(nodeId);
    const reachable = status.tone !== "danger";
    playTerminal({
      title: `Ping · ${device.name}`,
      sub: `${device.ip} · from LT-GR-MS1`,
      steps: [
        { text: `CCC-NOC> ping ${device.ip} repeat 4 source 10.10.60.23`, cls: "term-cmd" },
        { text: "Type escape sequence to abort.", cls: "term-dim" },
        reachable
          ? { text: "!!!!! 4 packets transmitted, 4 received, 0% loss  (avg 7 ms)", cls: "term-ok" }
          : { text: "..... 4 packets transmitted, 0 received, 100% loss  (destination unreachable)", cls: "term-err" },
        reachable
          ? { text: "Result: PASS · reachable within the verification matrix", cls: "term-result" }
          : { text: "Result: FAIL · the device is isolated in the current state", cls: "term-result is-fail" }
      ],
      glyph: "zap"
    });
  }

  /* ------------------------------------------------------------------ *
   * Table refreshers (keep focus while typing)
   * ------------------------------------------------------------------ */

  function refreshDeviceRows() {
    const body = $("#device-rows");
    if (body) body.innerHTML = devicesTableBody();
    const count = $("#device-count");
    if (count) count.textContent = `${filteredDevices().length} of ${inventory.length}`;
  }

  function refreshEventRows() {
    const body = $("#event-rows");
    if (body) body.innerHTML = eventRowsHtml();
    const count = $("#event-count");
    if (count) count.textContent = `${filteredEvents().length} of ${state.events.length}`;
  }

  /* ------------------------------------------------------------------ *
   * Telemetry
   * ------------------------------------------------------------------ */

  const AMBIENT = [
    () => ({ severity: "info", source: "SRV-DNS", category: "system", message: `DNS query burst · ${180 + Math.floor(Math.random() * 160)} req/s from VLAN 30/40` }),
    () => ({ severity: "info", source: "R-WAN-MS", category: "wan", message: `MPLS EPL #${Math.random() < 0.5 ? "1 · DBP" : "2 · BHTQ"} utilisation ${38 + Math.floor(Math.random() * 14)}% — within SLA` }),
    () => ({ severity: "success", source: "SW-SRV", category: "security", message: `Sticky MAC learned on Fa0/${2 + Math.floor(Math.random() * 5)} · port-security table refreshed` }),
    () => ({ severity: "info", source: "GUEST", category: "security", message: `DHCP lease 10.10.60.${20 + Math.floor(Math.random() * 60)} issued to a guest client (VLAN 60)` }),
    () => ({ severity: "info", source: "R-CORE-MS", category: "routing", message: `OSPF hello received from 10.10.0.6 · area 0 stable` }),
    () => ({ severity: "info", source: "SRV-LOG", category: "system", message: `Syslog ingest ${24 + Math.floor(Math.random() * 30)} msg/min · NetFlow export to :2055` }),
    () => ({ severity: "info", source: "SW-CCTV", category: "traffic", message: `NVR recording stream ${30 + Math.floor(Math.random() * 18)} Mbps on VLAN 50` }),
    () => ({ severity: "success", source: "HEALTH", category: "system", message: `Trunk health OK across 8 switches · 0 CRC errors` })
  ];

  let ambientIndex = 0;
  let tickCount = 0;

  function stopTelemetry() {
    if (telemetryTimer) clearInterval(telemetryTimer);
    telemetryTimer = null;
  }

  function startTelemetry() {
    stopTelemetry();
    if (!prefs.live || !state.simRunning) return;
    telemetryTimer = setInterval(tickTelemetry, Math.max(1500, Number(prefs.interval) || 4000));
  }

  function tickTelemetry() {
    if (!state.simRunning) return;
    tickCount += 1;
    state.mbps = clamp(Math.round(state.mbps * 0.72 + (620 + (Math.random() - 0.5) * 110) * 0.28), 160, 790);
    const gauge = $("#mbps-value");
    if (gauge) gauge.innerHTML = `${state.mbps}<span class="stat-unit">Mbps</span>`;
    const current = $("#traffic-current");
    if (current) current.innerHTML = `${state.mbps}<span class="stat-unit">Mbps</span>`;
    if (tickCount % 9 !== 0) return;
    const isolated = Array.from(state.linksDown);
    if (isolated.length && Math.random() < 0.4) {
      const key = isolated[Math.floor(Math.random() * isolated.length)];
      const entry = WAN_ENTRIES.find((item) => item.key === key);
      const link = linkByKey(key);
      addEvent({
        severity: "warning",
        source: entry ? entry.device.toUpperCase() : "NOC",
        category: "wan",
        message: `${entry ? entry.name : link ? linkLabel(link) : key} remains isolated — staging a restore is still pending`
      });
      return;
    }
    addEvent(AMBIENT[ambientIndex++ % AMBIENT.length]());
  }

  /* ------------------------------------------------------------------ *
   * Action map
   * ------------------------------------------------------------------ */

  const ACTIONS = {
    "toggle-sim": () => setSim(!state.simRunning),
    deploy: () => deployChanges(),
    "stage-link": (el) => {
      stageLink(el.dataset.key, el.dataset.desired === "down");
      if (el.closest(".modal")) openLinkControl(el.dataset.key);
    },
    "undo-change": (el) => {
      const id = el.dataset.id || "";
      undoChange(id);
      if (el.closest(".modal") && id.startsWith("link:")) openLinkControl(id.slice(5));
      else if ($("#modal-root").children.length && !paletteOpen()) closeModal();
    },
    "discard-changes": () => confirmDialog(
      { title: "Discard staged changes?", body: `${state.pending.size} queued ${state.pending.size === 1 ? "change" : "changes"} will be removed without touching the simulation.`, label: "Discard", danger: true },
      () => { state.pending.clear(); render(); if (activeDrawer) renderDrawer(); toast("Deploy queue cleared", { tone: "info" }); }
    ),
    drill: (el) => runDrill(el.dataset.drill),
    health: () => runHealth(),
    "backup-all": () => runBackupAll(),
    "backup-clear": () => confirmDialog(
      { title: "Clear backup history?", body: "Removes every snapshot from this session. Running configurations on the live devices are untouched.", label: "Clear history", danger: true },
      clearBackups
    ),
    "download-config": (el) => downloadConfig(el.dataset.device, el.dataset.file),
    "vlan-add": () => openVlanForm(),
    "vlan-site": (el) => { ui.vlanSite = el.dataset.site; render(); },
    "vlan-traffic": (el) => inspectVlan(el.dataset.site, el.dataset.vlan),
    "acl-add": () => openAclForm(),
    "acl-tab": (el) => { ui.aclTab = el.dataset.tab; render(); },
    "ntp-fix": (el) => stageNtpFix(el.dataset.device),
    "route-filter": (el) => {
      ui.routeFilter = el.dataset.filter;
      $$('[data-action="route-filter"]').forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.filter === ui.routeFilter)));
      const body = $("#route-rows");
      if (body) body.innerHTML = routeTableBody();
    },
    "chart-range": (el) => { ui.trafficRange = el.dataset.range; render(); },
    "zoom-in": () => setZoom(ui.zoom + 0.1),
    "zoom-out": () => setZoom(ui.zoom - 0.1),
    "zoom-reset": () => setZoom(1),
    "toggle-labels": () => {
      ui.labels = !ui.labels;
      const stage = $("#topo-stage");
      if (stage) stage.classList.toggle("hide-labels", !ui.labels);
      const button = $('[data-action="toggle-labels"]');
      if (button) {
        button.classList.toggle("is-on", ui.labels);
        button.setAttribute("aria-pressed", String(ui.labels));
      }
    },
    node: (el) => openDevice(el.dataset.node, el),
    link: (el) => openLinkControl(el.dataset.key),
    "inspect-node": (el) => openDevice(el.dataset.node),
    inspect: (el) => openDevice(el.dataset.id),
    "row-device": (el) => openDevice(el.dataset.id, el),
    console: (el) => runConsole(el.dataset.id),
    "reset-device-filters": () => { ui.deviceQ = ""; ui.deviceSite = "all"; ui.deviceType = "all"; render(); },
    palette: () => openPalette(),
    notifications: () => toggleNotifications(),
    "close-popover": () => closePopover(),
    "ack-alerts": () => ackAlerts(),
    "ack-alert": (el) => ackAlert(el.dataset.id),
    "events-read": () => markEventsRead(),
    "events-export": () => exportEvents(),
    "set-theme": (el) => { setTheme(el.dataset.theme); render(); },
    "set-density": (el) => { prefs.density = el.dataset.density; savePrefs(); applyPrefs(); render(); },
    "reset-prefs": () => confirmDialog(
      { title: "Reset console preferences?", body: "Theme, density, timestamps and telemetry return to their defaults. The deploy queue and event history are kept.", label: "Reset" },
      () => {
        try {
          localStorage.removeItem("ccc-prefs");
          localStorage.removeItem("ccc-theme");
        } catch (error) { /* storage unavailable */ }
        Object.assign(prefs, {
          theme: "dark", density: "comfortable", confirm: true, reduceMotion: false,
          relativeTime: true, live: true, interval: 4000, nightlyBackup: true
        });
        applyPrefs();
        startTelemetry();
        render();
        toast("Preferences reset", { tone: "success", msg: "The console is back to its default profile." });
      }
    ),
    "toggle-pref": (el) => {
      const key = el.dataset.pref;
      if (!key) return;
      prefs[key] = !prefs[key];
      savePrefs();
      applyPrefs();
      if (key === "live" || key === "interval") startTelemetry();
      render();
    },
    ping: () => {
      const label = $("#ping-target") ? $("#ping-target").value : D.pingTargets[0].label;
      const target = D.pingTargets.find((item) => item.label === label) || D.pingTargets[0];
      pingFrom(target, "LT-GR-MS1");
    },
    "ping-device": (el) => pingDevice(el.dataset.node),
    "locate-node": (el) => {
      const nodeId = el.dataset.node;
      ui.selection = nodeId;
      if (activeDrawer) closeDrawer();
      ui.selection = nodeId;
      if (ui.route !== "topology") location.hash = "#/topology";
      else render();
    },
    "reset-links": () => confirmDialog(
      { title: "Restore every circuit?", body: "Clears all isolated links and any staged link changes.", label: "Restore links" },
      resetLinks
    ),
    "reload-sim": () => confirmDialog(
      { title: "Reload the simulation?", body: "Resets staged changes, restores every circuit and returns the event log to the seeded baseline.", label: "Reload", danger: true },
      reloadSimulation
    ),
    "confirm-run": () => {
      const run = pendingConfirm;
      pendingConfirm = null;
      closeModal();
      if (run) run();
    },
    "close-drawer": () => closeDrawer(),
    "close-modal": () => closeModal(),
    "go-devices": () => { closeModal(); if (ui.route !== "devices") location.hash = "#/devices"; }
  };

  /* ------------------------------------------------------------------ *
   * Event wiring
   * ------------------------------------------------------------------ */

  function bindEvents() {
    document.addEventListener("click", (event) => {
      const paletteItem = event.target.closest("[data-palette-index]");
      if (paletteItem && paletteState) {
        const item = paletteState.items[Number(paletteItem.dataset.paletteIndex)];
        if (item) {
          event.preventDefault();
          item.run();
          return;
        }
      }
      const actionEl = event.target.closest("[data-action]");
      if (actionEl) {
        const handler = ACTIONS[actionEl.dataset.action];
        if (handler) {
          event.preventDefault();
          handler(actionEl, event);
          return;
        }
      }
      if (event.target.closest("[data-close-modal]")) { closeModal(); return; }
      if (event.target.closest("[data-close-popover]")) { closePopover(); return; }
      if (event.target.closest("[data-close-nav]")) { closeNav(); return; }
      if (event.target.closest("[data-menu]")) { openNav(); return; }
      if (event.target.closest("[data-theme-toggle]")) { setTheme(prefs.theme === "light" ? "dark" : "light"); return; }
      const paletteWrap = event.target.closest(".palette-wrap");
      if (paletteWrap && !event.target.closest(".palette")) closePalette();
    });

    document.addEventListener("mouseover", (event) => {
      const paletteItem = event.target.closest("[data-palette-index]");
      if (paletteItem && paletteState) highlightPalette(Number(paletteItem.dataset.paletteIndex));
    });

    document.addEventListener("input", (event) => {
      if (event.target.id === "device-q") { ui.deviceQ = event.target.value; refreshDeviceRows(); }
      if (event.target.id === "event-q") { ui.eventQ = event.target.value; refreshEventRows(); }
    });

    document.addEventListener("change", (event) => {
      const target = event.target;
      if (target.id === "device-site") { ui.deviceSite = target.value; refreshDeviceRows(); }
      if (target.id === "device-type") { ui.deviceType = target.value; refreshDeviceRows(); }
      if (target.id === "event-sev") { ui.eventSev = target.value; refreshEventRows(); }
      if (target.id === "event-cat") { ui.eventCat = target.value; refreshEventRows(); }
      if (target.dataset && target.dataset.prefSelect === "interval") {
        prefs.interval = Number(target.value);
        savePrefs();
        startTelemetry();
        toast("Sampling interval updated", { tone: "info", msg: `Live telemetry now samples every ${Number(target.value) / 1000} s.` });
      }
    });

    document.addEventListener("submit", (event) => {
      const form = event.target;
      if (!form.dataset || !form.dataset.form) return;
      event.preventDefault();
      if (form.dataset.form === "vlan") submitVlan(form);
      if (form.dataset.form === "acl") submitAcl(form);
    });

    document.addEventListener("keydown", (event) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (paletteOpen()) closePalette();
        else openPalette();
        return;
      }
      if (event.key === "Escape") {
        if (paletteOpen()) { closePalette(); return; }
        if ($("#modal-root").children.length) { closeModal(); return; }
        if ($("#popover-root").children.length) { closePopover(); return; }
        if (activeDrawer) { closeDrawer(); return; }
        if (document.body.classList.contains("nav-open")) closeNav();
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        const target = event.target.closest("[data-action='node'], [data-action='link']");
        if (target) {
          event.preventDefault();
          if (target.dataset.action === "node") openDevice(target.dataset.node, target);
          else openLinkControl(target.dataset.key);
        }
      }
    });

    window.addEventListener("hashchange", () => onRouteChange(false));
  }

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */

  function boot() {
    applyPrefs();
    ui.route = currentRouteId();
    render();
    bindEvents();
    startTelemetry();
  }

  boot();

})();
