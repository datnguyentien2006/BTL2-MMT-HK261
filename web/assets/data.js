/* CCC Hospital · design data extracted from docs/ptbuild/CCC-Hospital/plan.json
   and report/REPORT_vi.md. Coordinates are on a 1200 × 820 logical canvas. */

window.CCC = (function () {
  "use strict";

  const zones = [
    { id: "internet", x: 16,  y: 16,  w: 300, h: 300, title: "INTERNET",    sub: "AS + teleworker",     tone: "var(--violet)" },
    { id: "edge",     x: 332, y: 16,  w: 340, h: 300, title: "EDGE & DMZ",  sub: "NAT · ACL · public services", tone: "var(--rose)" },
    { id: "wan",      x: 688, y: 16,  w: 496, h: 300, title: "WAN HUB",     sub: "OSPF area 0 · SD-WAN ready", tone: "var(--accent)" },
    { id: "core",     x: 332, y: 348, w: 546, h: 120, title: "CORE",        sub: "router-on-a-stick · inter-VLAN", tone: "var(--accent)" },
    { id: "bldA",     x: 16,  y: 348, w: 300, h: 198, title: "BUILDING A",  sub: "VLAN 30 · 10.10.30.0/24", tone: "var(--sky)" },
    { id: "bldB",     x: 16,  y: 562, w: 300, h: 242, title: "BUILDING B",  sub: "VLAN 40 · 10.10.40.0/24", tone: "var(--sky)" },
    { id: "srv",      x: 332, y: 484, w: 300, h: 320, title: "SERVER FARM", sub: "VLAN 20 · 10.10.20.0/24", tone: "var(--violet)" },
    { id: "cctv",     x: 648, y: 484, w: 230, h: 320, title: "CCTV",        sub: "VLAN 50 · 10.10.50.0/24", tone: "var(--cctv)" },
    { id: "dbp",      x: 894, y: 348, w: 290, h: 230, title: "DBP STREET",  sub: "VLAN 61 · 62 · 63", tone: "var(--emerald)" },
    { id: "bhtq",     x: 894, y: 594, w: 290, h: 226, title: "BHTQ STREET", sub: "VLAN 71 · 72 · 73", tone: "var(--emerald)" }
  ];

  const nodes = [
    {
      id: "cloud", name: "INTERNET", sub: "public WAN", kind: "cloud", zoneClass: "z-internet",
      x: 28, y: 56, zone: "Internet", site: "Public Internet", groups: ["internet"],
      model: "Emulated by ISP1/ISP2", design: "Carrier Internet", role: "Public Internet + test web host",
      vlan: "—", ips: ["198.51.100.0/24"], config: null,
      note: "ISP1 and ISP2 emulate Internet reachability. SRV-WEB-INT at 198.51.100.10 is the external web test target."
    },
    {
      id: "isp1", name: "ISP1", sub: "2911 · 203.0.113.1", kind: "router", zoneClass: "z-internet",
      x: 176, y: 56, zone: "Internet", site: "Internet", groups: ["internet"],
      model: "Cisco 2911", design: "ISP edge (carrier)", role: "Primary Internet · hosts test web server",
      vlan: "—", ips: ["Gi0/0 203.0.113.1/30", "Gi0/1 198.51.100.1/24"], config: "ISP1_config.txt",
      note: "Primary Internet path. A static route for 192.168.250.0/24 provides the return path to the teleworker LAN."
    },
    {
      id: "isp2", name: "ISP2", sub: "2911 · 203.0.114.1", kind: "router", zoneClass: "z-internet",
      x: 176, y: 204, zone: "Internet", site: "Internet", groups: ["internet"],
      model: "Cisco 2911", design: "ISP edge (carrier)", role: "Secondary Internet · teleworker LAN",
      vlan: "—", ips: ["Gi0/0 203.0.114.1/30", "Gi0/1 192.168.250.1/24"], config: "ISP2_config.txt",
      note: "Floating static route AD 50 on R-EDGE-MS takes over when ISP1 fails. Also terminates the home LAN 192.168.250.0/24."
    },
    {
      id: "webint", name: "SRV-WEB-INT", sub: "198.51.100.10", kind: "server", zoneClass: "z-internet",
      x: 176, y: 112, zone: "Internet", site: "Internet", groups: ["internet"],
      model: "Server-PT", design: "External web service", role: "Internet web server · test target",
      vlan: "—", ips: ["198.51.100.10/24", "GW 198.51.100.1"], config: null,
      note: "Used by KC-3 to prove PAT and Internet reachability from the LAN and branches."
    },
    {
      id: "ap-home", name: "AP-HOME", sub: "home Wi-Fi", kind: "ap", zoneClass: "z-home",
      x: 28, y: 172, zone: "Internet", site: "Teleworker", groups: ["internet"],
      model: "AccessPoint-PT", design: "Home Wi-Fi router", role: "Teleworker home access point",
      vlan: "—", ips: [], config: null,
      note: "Bridges LT-TELE into the home LAN. In production the teleworker uses a client VPN to the NGFW."
    },
    {
      id: "lt-tele", name: "LT-TELE", sub: "192.168.250.10", kind: "laptop", zoneClass: "z-home",
      x: 28, y: 236, zone: "Internet", site: "Teleworker", groups: ["internet"],
      model: "Laptop-PT", design: "Client VPN laptop", role: "Teleworker / on-call doctor",
      vlan: "—", ips: ["192.168.250.10/24", "GW 192.168.250.1"], config: null,
      note: "Used to test static NAT (203.0.115.10) and PAT from an external network."
    },

    {
      id: "r-edge", name: "R-EDGE-MS", sub: "2911 · NAT / ACL", kind: "router", zoneClass: "z-edge",
      x: 532, y: 64, zone: "Edge", site: "Main site", groups: ["main", "edge"],
      model: "Cisco 2911", design: "2× FortiGate 600E (HA)", role: "Edge firewall · NAT/PAT · DMZ gateway",
      vlan: "DMZ 200", ips: ["Gi0/0 203.0.113.2/30", "Gi0/1 203.0.114.2/30", "Gi0/2 10.10.0.2/30"], config: "R-EDGE-MS_config.txt",
      note: "Simulated firewall: stateless ACLs, PAT to both ISPs and static NAT 203.0.115.10 ↔ 10.10.200.10. Production requires an NGFW with IPS."
    },
    {
      id: "sw-dmz", name: "SW-DMZ", sub: "VLAN 200 · trunk", kind: "switch", zoneClass: "z-edge",
      x: 532, y: 214, zone: "Edge", site: "Main site", groups: ["main", "edge"],
      model: "2960-24TT", design: "Catalyst 9300 pair", role: "DMZ access switch",
      vlan: "200", ips: [], config: "SW-DMZ_config.txt",
      note: "Port-security applied on Fa0/1 and Fa0/2 for the web and mail servers."
    },
    {
      id: "web-dmz", name: "SRV-WEB-DMZ", sub: "10.10.200.10", kind: "server", zoneClass: "z-edge",
      x: 344, y: 206, zone: "Edge", site: "Main site", groups: ["main", "edge"],
      model: "Server-PT", design: "HPE DL380 · web", role: "Public web server · static NAT target",
      vlan: "200", ips: ["10.10.200.10/24", "GW 10.10.200.1"], config: null,
      note: "Answers on 203.0.115.10:80 via static NAT. The internal DNS record www.hospital.local resolves to this public address."
    },
    {
      id: "mail-dmz", name: "SRV-MAIL-DMZ", sub: "10.10.200.11", kind: "server", zoneClass: "z-edge",
      x: 344, y: 262, zone: "Edge", site: "Main site", groups: ["main", "edge"],
      model: "Server-PT", design: "HPE DL380 · mail", role: "Public mail server",
      vlan: "200", ips: ["10.10.200.11/24", "GW 10.10.200.1"], config: null,
      note: "Second DMZ service. Only the web server has a 1:1 static NAT entry in the simulation."
    },

    {
      id: "r-wan", name: "R-WAN-MS", sub: "ISR4331 · WAN hub", kind: "router", zoneClass: "z-wan",
      x: 872, y: 88, zone: "WAN", site: "Main site", groups: ["main", "branches"],
      model: "Cisco ISR4331", design: "ISR 4451-X", role: "WAN hub · MPLS + serial backup",
      vlan: "—", ips: ["Gi0/0/0 10.10.0.6/30", "Gi0/0/1 10.254.0.1/30", "Gi0/0/2 10.254.0.5/30", "S0/1/0 10.255.0.1/30", "S0/2/0 10.255.0.5/30"],
      config: "R-WAN-MS_config.txt",
      note: "OSPF adjacency with R-CORE-MS, R-DBP and R-BHTQ. Serial interfaces are DCE at 2 Mbps clock rate and carry the backup path."
    },

    {
      id: "r-core", name: "R-CORE-MS", sub: "2911 · ROAS", kind: "router", zoneClass: "z-core",
      x: 620, y: 396, zone: "Core", site: "Main site", groups: ["main"],
      model: "Cisco 2911", design: "2× Catalyst 9500", role: "Core router · inter-VLAN gateways",
      vlan: "10, 20, 30, 40, 50, 60, 200",
      ips: ["Gi0/0.10 10.10.10.1/24", "Gi0/0.20 10.10.20.1/24", "Gi0/0.30 10.10.30.1/24", "Gi0/0.40 10.10.40.1/24",
            "Gi0/0.50 10.10.50.1/24", "Gi0/0.60 10.10.60.1/24", "Gi0/0.200 10.10.200.1/24", "Gi0/1 10.10.0.1/30", "Gi0/2 10.10.0.5/30"],
      config: "R-CORE-MS_config.txt",
      note: "Router-on-a-stick with one 802.1Q sub-interface per VLAN. OSPF area 0 advertises every subnet. Single-router design is a known SPOF."
    },
    {
      id: "sw-core", name: "SW-CORE", sub: "3560 · L3 core", kind: "switch", zoneClass: "z-core",
      x: 420, y: 396, zone: "Core", site: "Main site", groups: ["main"],
      model: "Cisco 3560-24PS", design: "2× Catalyst 9500", role: "L3 core / distribution switch",
      vlan: "Trunk to access", ips: [], config: "SW-CORE_config.txt",
      note: "Aggregates building A/B, server farm, CCTV and DMZ access switches. Hardened with SSH-only management."
    },

    {
      id: "sw-a", name: "SW-BLD-A", sub: "VLAN 30 · trunk", kind: "switch", zoneClass: "z-access",
      x: 102, y: 396, zone: "Building A", site: "Main site", groups: ["main"],
      model: "2960-24TT", design: "Catalyst 9200L-48P", role: "Building A access switch",
      vlan: "30", ips: [], config: "SW-BLD-A_config.txt",
      note: "24-port access switch; port-security max 2 sticky, restrict on user ports."
    },
    {
      id: "pc-a", name: "PC-A1–A3", sub: "+ PRN-A · VLAN 30", kind: "cluster", zoneClass: "z-access",
      x: 32, y: 468, zone: "Building A", site: "Main site", groups: ["main"],
      model: "PC-PT / Printer-PT", design: "600 staff workstations", role: "Building A staff endpoints",
      vlan: "30", ips: ["PC-A1 10.10.30.11", "PC-A2 10.10.30.12", "PC-A3 10.10.30.13", "PRN-A 10.10.30.50"],
      config: null, members: "PC-A1, PC-A2, PC-A3 and PRN-A represent department staff on VLAN 30.",
      note: "The simulation collapses 600 main-site workstations into representative endpoints per VLAN."
    },
    {
      id: "ap-a", name: "AP-BLD-A", sub: "Wi-Fi · VLAN 30/60", kind: "ap", zoneClass: "z-access",
      x: 172, y: 468, zone: "Building A", site: "Main site", groups: ["main"],
      model: "AccessPoint-PT", design: "28× Catalyst 9130AXI", role: "Building A Wi-Fi · staff + guest SSID",
      vlan: "30 / 60", ips: [], config: null,
      note: "Guest clients associate here and receive DHCP from VLAN 60, then hit ACL 150."
    },

    {
      id: "sw-b", name: "SW-BLD-B", sub: "VLAN 40 · trunk", kind: "switch", zoneClass: "z-access",
      x: 102, y: 620, zone: "Building B", site: "Main site", groups: ["main"],
      model: "2960-24TT", design: "Catalyst 9200L-48P", role: "Building B access switch",
      vlan: "40", ips: [], config: "SW-BLD-B_config.txt",
      note: "Same hardening and port-security profile as Building A."
    },
    {
      id: "pc-b", name: "PC-B1–B3", sub: "+ PRN-B · VLAN 40", kind: "cluster", zoneClass: "z-access",
      x: 32, y: 724, zone: "Building B", site: "Main site", groups: ["main"],
      model: "PC-PT / Printer-PT", design: "Staff workstations", role: "Building B staff endpoints",
      vlan: "40", ips: ["PC-B1 10.10.40.11", "PC-B2 10.10.40.12", "PC-B3 10.10.40.13", "PRN-B 10.10.40.50"],
      config: null, members: "PC-B1, PC-B2, PC-B3 and PRN-B represent department staff on VLAN 40.",
      note: "Inter-VLAN reachability to the server farm is verified under KC-1."
    },
    {
      id: "ap-b", name: "AP-BLD-B", sub: "Wi-Fi · VLAN 40/60", kind: "ap", zoneClass: "z-access",
      x: 172, y: 724, zone: "Building B", site: "Main site", groups: ["main"],
      model: "AccessPoint-PT", design: "28× Catalyst 9130AXI", role: "Building B Wi-Fi · staff + guest SSID",
      vlan: "40 / 60", ips: [], config: null,
      note: "The guest smartphone associates here; DHCP and the guest ACL are verified in KC-4."
    },

    {
      id: "sw-srv", name: "SW-SRV", sub: "VLAN 20 · trunk", kind: "switch", zoneClass: "z-dc",
      x: 480, y: 646, zone: "Server farm", site: "Main site", groups: ["main"],
      model: "2960-24TT", design: "Catalyst 9300-48P", role: "Server farm access switch",
      vlan: "20", ips: [], config: "SW-SRV_config.txt",
      note: "Four simulated servers represent the 10-server design (HIS, PACS, DB, DNS, log, NVR, web, mail and branch servers)."
    },
    {
      id: "srv-dns", name: "SRV-DNS", sub: "10.10.20.5", kind: "server", zoneClass: "z-dc",
      x: 340, y: 568, zone: "Server farm", site: "Main site", groups: ["main"],
      model: "Server-PT", design: "HPE DL380 · DNS", role: "Internal DNS · 5 records",
      vlan: "20", ips: ["10.10.20.5/24", "GW 10.10.20.1"], config: null,
      note: "Records: www/his/pacs/mail.hospital.local + www.internet-test.com. Guest ACL permits DNS to this host."
    },
    {
      id: "srv-his", name: "SRV-HIS", sub: "10.10.20.6", kind: "server", zoneClass: "z-dc",
      x: 340, y: 646, zone: "Server farm", site: "Main site", groups: ["main"],
      model: "Server-PT", design: "HPE DL380 · HIS", role: "HIS application server",
      vlan: "20", ips: ["10.10.20.6/24", "GW 10.10.20.1"], config: null,
      note: "Primary target for cross-site tests from DBP and BHTQ (KC-2)."
    },
    {
      id: "srv-pacs", name: "SRV-PACS", sub: "10.10.20.7", kind: "server", zoneClass: "z-dc",
      x: 340, y: 724, zone: "Server farm", site: "Main site", groups: ["main"],
      model: "Server-PT", design: "HPE DL380 · PACS", role: "RIS-PACS imaging server",
      vlan: "20", ips: ["10.10.20.7/24", "GW 10.10.20.1"], config: null,
      note: "The design adds a load balancer in front of HIS/PACS/DB for production."
    },
    {
      id: "srv-log", name: "SRV-LOG", sub: "10.10.20.8", kind: "server", zoneClass: "z-dc",
      x: 480, y: 724, zone: "Server farm", site: "Main site", groups: ["main"],
      model: "Server-PT", design: "HPE DL380 · logging", role: "Syslog + NetFlow collector",
      vlan: "20", ips: ["10.10.20.8/24", "GW 10.10.20.1"], config: null,
      note: "Receives logging from R-EDGE-MS and R-CORE-MS; NetFlow exporter NF-HOSP sends to UDP 2055."
    },

    {
      id: "sw-cctv", name: "SW-CCTV", sub: "VLAN 50 · trunk", kind: "switch", zoneClass: "z-cctv",
      x: 699, y: 540, zone: "CCTV", site: "Main site", groups: ["main"],
      model: "2960-24TT", design: "Catalyst 9200L-48P PoE+", role: "CCTV access switch",
      vlan: "50", ips: [], config: "SW-CCTV_config.txt",
      note: "Camera traffic is isolated on VLAN 50 and never mixed with staff VLANs."
    },
    {
      id: "nvr", name: "SRV-NVR", sub: "10.10.50.10", kind: "server", zoneClass: "z-cctv",
      x: 699, y: 616, zone: "CCTV", site: "Main site", groups: ["main"],
      model: "Server-PT", design: "NVR + storage", role: "Camera recording / NVR",
      vlan: "50", ips: ["10.10.50.10/24", "GW 10.10.50.1"], config: null,
      note: "KC-1 verifies CAM-01 → SRV-NVR 4/4 inside the CCTV VLAN."
    },
    {
      id: "cams", name: "CAM-01/02", sub: "10.10.50.21–22", kind: "cluster", zoneClass: "z-cctv",
      x: 699, y: 692, zone: "CCTV", site: "Main site", groups: ["main"],
      model: "PC-PT (camera role)", design: "IP cameras", role: "IP surveillance cameras",
      vlan: "50", ips: ["CAM-01 10.10.50.21", "CAM-02 10.10.50.22"], config: null,
      members: "CAM-01 and CAM-02 simulate IP cameras on VLAN 50.",
      note: "Camera endpoints are represented by PC-PT devices in Packet Tracer."
    },

    {
      id: "r-dbp", name: "R-DBP", sub: "2911 · ROAS", kind: "router", zoneClass: "z-branch",
      x: 1044, y: 388, zone: "DBP", site: "DBP Street", groups: ["branches"],
      model: "Cisco 2911", design: "ISR 4331 + NIM-2T", role: "DBP branch router · inter-VLAN",
      vlan: "61, 62, 63",
      ips: ["Gi0/0.61 10.11.10.1/24", "Gi0/0.62 10.11.20.1/24", "Gi0/0.63 10.11.60.1/24", "Gi0/1 10.254.0.2/30", "S0/0/0 10.255.0.2/30"],
      config: "R-DBP_config.txt",
      note: "Primary path is Ethernet MPLS 10.254.0.0/30. When Gi0/1 is shut down, OSPF moves traffic to serial 10.255.0.0/30."
    },
    {
      id: "sw-dbp", name: "SW-DBP", sub: "2960 · 3 VLANs", kind: "switch", zoneClass: "z-branch",
      x: 906, y: 388, zone: "DBP", site: "DBP Street", groups: ["branches"],
      model: "2960-24TT", design: "Catalyst 9200L-48P", role: "DBP access switch",
      vlan: "61 / 62 / 63", ips: [], config: "SW-DBP_config.txt",
      note: "Trunks staff, server and guest VLANs to R-DBP sub-interfaces."
    },
    {
      id: "pc-dbp", name: "PC-DBP1/2", sub: "+ AP · VLAN 61", kind: "cluster", zoneClass: "z-branch",
      x: 906, y: 508, zone: "DBP", site: "DBP Street", groups: ["branches"],
      model: "PC-PT / AccessPoint-PT", design: "260 workstations", role: "DBP staff endpoints",
      vlan: "61", ips: ["PC-DBP1 10.11.10.11", "PC-DBP2 10.11.10.12"], config: null,
      members: "PC-DBP1, PC-DBP2 and AP-DBP represent 260 staff workstations.",
      note: "PC-DBP1 is the KC-2 test source for cross-site HIS access and failover."
    },
    {
      id: "srv-dbp", name: "SRV-DBP", sub: "10.11.20.10", kind: "server", zoneClass: "z-branch",
      x: 1044, y: 508, zone: "DBP", site: "DBP Street", groups: ["branches"],
      model: "Server-PT", design: "HPE DL380 branch", role: "DBP local server",
      vlan: "62", ips: ["10.11.20.10/24", "GW 10.11.20.1"], config: null,
      note: "Branch-local services; HIS/PACS remain centralized at the main site."
    },

    {
      id: "r-bhtq", name: "R-BHTQ", sub: "2911 · ROAS", kind: "router", zoneClass: "z-branch",
      x: 906, y: 636, zone: "BHTQ", site: "BHTQ Street", groups: ["branches"],
      model: "Cisco 2911", design: "ISR 4331 + NIM-2T", role: "BHTQ branch router · inter-VLAN",
      vlan: "71, 72, 73",
      ips: ["Gi0/0.71 10.12.10.1/24", "Gi0/0.72 10.12.20.1/24", "Gi0/0.73 10.12.60.1/24", "Gi0/1 10.254.0.6/30", "S0/0/0 10.255.0.6/30"],
      config: "R-BHTQ_config.txt",
      note: "Primary path is Ethernet MPLS 10.254.0.4/30, with serial 10.255.0.4/30 as the OSPF-cost backup."
    },
    {
      id: "sw-bhtq", name: "SW-BHTQ", sub: "2960 · 3 VLANs", kind: "switch", zoneClass: "z-branch",
      x: 906, y: 700, zone: "BHTQ", site: "BHTQ Street", groups: ["branches"],
      model: "2960-24TT", design: "Catalyst 9200L-48P", role: "BHTQ access switch",
      vlan: "71 / 72 / 73", ips: [], config: "SW-BHTQ_config.txt",
      note: "Mirrors the DBP access design with staff, server and guest VLANs."
    },
    {
      id: "pc-bhtq", name: "PC-BHTQ1/2", sub: "+ AP · VLAN 71", kind: "cluster", zoneClass: "z-branch",
      x: 906, y: 762, zone: "BHTQ", site: "BHTQ Street", groups: ["branches"],
      model: "PC-PT / AccessPoint-PT", design: "260 workstations", role: "BHTQ staff endpoints",
      vlan: "71", ips: ["PC-BHTQ1 10.12.10.11", "PC-BHTQ2 10.12.10.12"], config: null,
      members: "PC-BHTQ1, PC-BHTQ2 and AP-BHTQ represent 260 staff workstations.",
      note: "Guest smartphone and laptop tests use the BHTQ/main guest VLANs under ACL 151/152."
    },
    {
      id: "srv-bhtq", name: "SRV-BHTQ", sub: "10.12.20.10", kind: "server", zoneClass: "z-branch",
      x: 1044, y: 762, zone: "BHTQ", site: "BHTQ Street", groups: ["branches"],
      model: "Server-PT", design: "HPE DL380 branch", role: "BHTQ local server",
      vlan: "72", ips: ["10.12.20.10/24", "GW 10.12.20.1"], config: null,
      note: "Local branch service; the hospital-wide HIS/PACS traffic returns to the main site."
    }
  ];

  const links = [
    { a: "cloud", b: "isp1", type: "internet", label: "Public Internet" },
    { a: "cloud", b: "isp2", type: "internet", label: "Public Internet" },
    { a: "isp1", b: "r-edge", type: "internet", label: "ISP1 uplink · 203.0.113.0/30" },
    { a: "isp2", b: "r-edge", type: "internet", label: "ISP2 uplink · 203.0.114.0/30" },
    { a: "isp1", b: "webint", type: "copper", label: "Internet web server" },
    { a: "isp2", b: "ap-home", type: "internet", label: "Home LAN" },
    { a: "ap-home", b: "lt-tele", type: "internet", label: "Teleworker Wi-Fi" },
    { a: "r-edge", b: "sw-dmz", type: "copper", label: "DMZ trunk · VLAN 200" },
    { a: "sw-dmz", b: "web-dmz", type: "copper", label: "DMZ web server" },
    { a: "sw-dmz", b: "mail-dmz", type: "copper", label: "DMZ mail server" },
    { a: "r-edge", b: "r-core", type: "routed", via: [{ x: 666, y: 120 }], label: "Edge ↔ core · 10.10.0.0/30" },
    { a: "r-core", b: "sw-core", type: "fiber", label: "Core trunk · 10G" },
    { a: "r-core", b: "r-wan", type: "routed", label: "Core ↔ WAN hub · 10.10.0.4/30" },
    { a: "sw-core", b: "sw-dmz", type: "fiber", label: "DMZ trunk · VLAN 200" },
    { a: "sw-core", b: "sw-a", type: "fiber", label: "Building A trunk · VLAN 30" },
    { a: "sw-core", b: "sw-b", type: "fiber", via: [{ x: 324, y: 440 }, { x: 324, y: 610 }], label: "Building B trunk · VLAN 40" },
    { a: "sw-core", b: "sw-srv", type: "fiber", label: "Server farm trunk · VLAN 20" },
    { a: "sw-core", b: "sw-cctv", type: "fiber", via: [{ x: 660, y: 533 }], label: "CCTV trunk · VLAN 50" },
    { a: "sw-a", b: "pc-a", type: "copper", label: "Access ports" },
    { a: "sw-a", b: "ap-a", type: "copper", label: "AP uplink" },
    { a: "sw-b", b: "pc-b", type: "copper", label: "Access ports" },
    { a: "sw-b", b: "ap-b", type: "copper", label: "AP uplink" },
    { a: "sw-srv", b: "srv-dns", type: "copper", label: "DNS server" },
    { a: "sw-srv", b: "srv-his", type: "copper", label: "HIS server" },
    { a: "sw-srv", b: "srv-pacs", type: "copper", label: "PACS server" },
    { a: "sw-srv", b: "srv-log", type: "copper", label: "Log / NetFlow collector" },
    { a: "sw-cctv", b: "nvr", type: "copper", label: "NVR" },
    { a: "sw-cctv", b: "cams", type: "copper", via: [{ x: 688, y: 594 }, { x: 688, y: 715 }], label: "IP cameras" },
    { a: "r-wan", b: "r-dbp", type: "mpls", label: "MPLS EPL #1 · 10.254.0.0/30" },
    { a: "r-wan", b: "r-dbp", type: "serial", label: "Serial backup · 10.255.0.0/30" },
    { a: "r-wan", b: "r-bhtq", type: "mpls", via: [{ x: 882, y: 190 }, { x: 882, y: 632 }], label: "MPLS EPL #2 · 10.254.0.4/30" },
    { a: "r-wan", b: "r-bhtq", type: "serial", via: [{ x: 890, y: 190 }, { x: 890, y: 632 }], label: "Serial backup · 10.255.0.4/30" },
    { a: "r-dbp", b: "sw-dbp", type: "copper", label: "ROAS trunk" },
    { a: "sw-dbp", b: "pc-dbp", type: "copper", label: "Staff VLAN 61" },
    { a: "sw-dbp", b: "srv-dbp", type: "copper", label: "Server VLAN 62" },
    { a: "r-bhtq", b: "sw-bhtq", type: "copper", label: "ROAS trunk" },
    { a: "sw-bhtq", b: "pc-bhtq", type: "copper", label: "Staff VLAN 71" },
    { a: "sw-bhtq", b: "srv-bhtq", type: "copper", label: "Server VLAN 72" }
  ];

  const vlans = {
    main: {
      summary: [
        { k: "Workstations", v: "600" },
        { k: "Servers", v: "10" },
        { k: "VLANs", v: "7" },
        { k: "WAN", v: "2× MPLS + serial" },
        { k: "Subnet", v: "10.10.0.0/16", mono: true }
      ],
      rows: [
        { id: 10,  name: "MGMT",        subnet: "10.10.10.0/24",  gw: "10.10.10.1",  purpose: "Device management",              tone: "tag-grey" },
        { id: 20,  name: "SERVER-FARM", subnet: "10.10.20.0/24",  gw: "10.10.20.1",  purpose: "DNS · HIS · PACS · LOG · NVR",   tone: "tag-violet" },
        { id: 30,  name: "DEPT-A",      subnet: "10.10.30.0/24",  gw: "10.10.30.1",  purpose: "Building A staff",               tone: "tag-blue" },
        { id: 40,  name: "DEPT-B",      subnet: "10.10.40.0/24",  gw: "10.10.40.1",  purpose: "Building B staff",               tone: "tag-blue" },
        { id: 50,  name: "CCTV",        subnet: "10.10.50.0/24",  gw: "10.10.50.1",  purpose: "IP cameras + NVR",               tone: "tag-grey" },
        { id: 60,  name: "WIFI-GUEST",  subnet: "10.10.60.0/24",  gw: "10.10.60.1",  purpose: "Paid guest Wi-Fi",               tone: "tag-amber" },
        { id: 200, name: "DMZ",         subnet: "10.10.200.0/24", gw: "10.10.200.1", purpose: "Public web + mail",              tone: "tag-rose" }
      ]
    },
    dbp: {
      summary: [
        { k: "Workstations", v: "260" },
        { k: "Servers", v: "2" },
        { k: "VLANs", v: "3" },
        { k: "Uplink", v: "EPL 200 Mbps + serial" },
        { k: "Subnet", v: "10.11.0.0/16", mono: true }
      ],
      rows: [
        { id: 61, name: "STAFF",  subnet: "10.11.10.0/24", gw: "10.11.10.1", purpose: "Branch staff",  tone: "tag-blue" },
        { id: 62, name: "SERVER", subnet: "10.11.20.0/24", gw: "10.11.20.1", purpose: "Branch server", tone: "tag-violet" },
        { id: 63, name: "GUEST",  subnet: "10.11.60.0/24", gw: "10.11.60.1", purpose: "Guest Wi-Fi",   tone: "tag-amber" }
      ]
    },
    bhtq: {
      summary: [
        { k: "Workstations", v: "260" },
        { k: "Servers", v: "2" },
        { k: "VLANs", v: "3" },
        { k: "Uplink", v: "EPL 200 Mbps + serial" },
        { k: "Subnet", v: "10.12.0.0/16", mono: true }
      ],
      rows: [
        { id: 71, name: "STAFF",  subnet: "10.12.10.0/24", gw: "10.12.10.1", purpose: "Branch staff",  tone: "tag-blue" },
        { id: 72, name: "SERVER", subnet: "10.12.20.0/24", gw: "10.12.20.1", purpose: "Branch server", tone: "tag-violet" },
        { id: 73, name: "GUEST",  subnet: "10.12.60.0/24", gw: "10.12.60.1", purpose: "Guest Wi-Fi",   tone: "tag-amber" }
      ]
    }
  };

  const bandwidth = {
    down: 674000,
    up: 140000,
    total: 814000,
    totalTbit: 6.512,
    peak: 724,
    peakGrowth: 869,
    avg: 452,
    avgGrowth: 543,
    sources: [
      { label: "Main workstations", value: 300000, swatch: "swatch-blue" },
      { label: "DBP workstations",  value: 130000, swatch: "swatch-cyan" },
      { label: "BHTQ workstations", value: 130000, swatch: "swatch-teal" },
      { label: "Guest Wi-Fi",       value: 100000, swatch: "swatch-violet" },
      { label: "Servers · down",    value: 14000,  swatch: "swatch-grey" },
      { label: "All upload",        value: 140000, swatch: "swatch-amber" }
    ],
    branch: { load: 185000, a: 103, aGrow: 123, b: 164, bGrow: 197 }
  };

  const bom = [
    { n: 1,  item: "Access switch PoE+ 48-port", model: "Catalyst 9200L-48P-4G", qty: "30", unit: 105, total: 3150, role: "APs, cameras, PCs" },
    { n: 2,  item: "Distribution / DC switch",   model: "Catalyst 9300-48P",     qty: "6",  unit: 180, total: 1080, role: "Floor and block aggregation" },
    { n: 3,  item: "Core switch L3",             model: "Catalyst 9500-16X",     qty: "2",  unit: 420, total: 840,  role: "Core HA pair" },
    { n: 4,  item: "Router WAN main",            model: "ISR 4451-X",            qty: "1",  unit: 250, total: 250,  role: "MPLS + serial hub" },
    { n: 5,  item: "Router WAN auxiliary",       model: "ISR 4331 + NIM-2T",     qty: "2",  unit: 90,  total: 180,  role: "DBP / BHTQ" },
    { n: 6,  item: "NGFW main (HA pair)",        model: "FortiGate 600E",        qty: "2",  unit: 320, total: 640,  role: "NAT, DMZ, IPS, VPN" },
    { n: 7,  item: "Wi-Fi 6 indoor AP",          model: "Catalyst 9130AXI",      qty: "28", unit: 28,  total: 784,  role: "Site-wide wireless" },
    { n: 8,  item: "Wireless controller",        model: "Catalyst 9800-40 (HA)", qty: "1",  unit: 380, total: 380,  role: "AP + guest SSID management" },
    { n: 9,  item: "GPON OLT + ONU",             model: "OLT 8-port + 32 ONU",   qty: "1 + 32", unit: null, total: 148, role: "In-building fiber" },
    { n: 10, item: "Server rack 2U",             model: "HPE DL380 Gen11",       qty: "14", unit: 190, total: 2660, role: "HIS, PACS, DB, DNS, log" },
    { n: 11, item: "Storage SAN / NAS",          model: "HPE MSA 2052 + backup", qty: "2",  unit: 300, total: 600,  role: "HIS / PACS storage" },
    { n: 12, item: "Load balancer",              model: "F5 BIG-IP VE cluster",  qty: "1 cluster", unit: 180, total: 180, role: "HIS / PACS / DB front end" },
    { n: 13, item: "Patch panel copper / fiber", model: "Cat6A 24p + ODF",       qty: "52", unit: 4,   total: 208,  role: "Per-floor cabling" },
    { n: 14, item: "UPS 10 kVA + ATS",           model: "APC / UGreen rack",     qty: "6",  unit: 130, total: 780,  role: "DC, IT room, branches" },
    { n: 15, item: "UPS rack 3 kVA",             model: "Rack UPS",              qty: "20", unit: 30,  total: 600,  role: "Floor cabinets" },
    { n: 16, item: "Rack 42U / 9U",              model: "—",                     qty: "8 / 12", unit: null, total: 464, role: "DC + floor racks" },
    { n: 17, item: "Cabling & materials",        model: "OM4 / SM + Cat6A",      qty: "lot", unit: null, total: 1200, role: "≈25 km cable" },
    { n: 18, item: "Software / licences",        model: "IOS-XE, FortiCare, WLC", qty: "package", unit: null, total: 500, role: "3–5 year support" }
  ];

  const bomTotal = 14600;

  const verification = [
    {
      kc: "KC-1",
      title: "LAN & inter-VLAN access",
      target: "VLAN 30/40 PCs → DNS, HIS, NVR",
      expected: "100% success, DNS resolves",
      actual: "PC-A1 → SRV-DNS 4/4; PC-A1 → PC-B1 4/4; CAM-01 → SRV-NVR 4/4. Internal DNS resolves www.hospital.local to 10.10.200.10.",
      evidence: [
        "Inter-VLAN routing through R-CORE-MS Gi0/0 sub-interfaces",
        "CCTV remains isolated on VLAN 50 while still reaching its NVR",
        "Same-VLAN and inter-VLAN tests both pass"
      ],
      command: "ping 10.10.20.5 · ping 10.10.40.11 · nslookup www.hospital.local",
      caveat: null
    },
    {
      kc: "KC-2",
      title: "Cross-site WAN + failover",
      target: "DBP / BHTQ → SRV-HIS at the main site",
      expected: "Traffic uses MPLS EPL; serial takes over on failure",
      actual: "PC-DBP1 → SRV-HIS 4/4 over the EPL. Shutting Gi0/1 on R-DBP moved traffic to serial 10.255.0.0/30 with 4/4 replies; restoring the EPL returned 4/4.",
      evidence: [
        "OSPF reconverged automatically without manual routes",
        "Serial path verified 5/5 from R-WAN-MS",
        "Both branch sites use the same dual-path design"
      ],
      command: "shutdown / no shutdown Gi0/1 (R-DBP) · ping 10.10.20.6 · traceroute",
      caveat: null
    },
    {
      kc: "KC-3",
      title: "Internet access via PAT",
      target: "LAN and branch clients → 198.51.100.10",
      expected: "PAT translation; ISP1 failure moves traffic to ISP2",
      actual: "LT-GR-MS1 → 198.51.100.10 4/4 through PAT on R-EDGE-MS. Static NAT DMZ was tested from LT-TELE (3/4 after ARP warm-up, TTL 125).",
      evidence: [
        "NAT overload toward ISP1 on Gi0/0",
        "Floating static AD 50 toward ISP2 configured",
        "ISP1 shutdown not repeated in the final verification pass"
      ],
      command: "ping 198.51.100.10 · show ip nat translations",
      caveat: "ISP1 shutdown/failover was validated during the build but not repeated in the final matrix."
    },
    {
      kc: "KC-4",
      title: "Guest Wi-Fi isolation",
      target: "Guest VLAN 60/63/73 → internal LAN",
      expected: "DHCP + DNS + DMZ web + Internet only; LAN blocked",
      actual: "LT-GR-MS1 = 10.10.60.23 and SM-GR-MS1 = 10.10.60.21 via DHCP. nslookup crosses the ACL; ping 10.10.30.11 = 0/4; ICMP to DMZ 0/4; HTTP to the DMZ web server is permitted.",
      evidence: [
        "ACL 150/151/152 deny 10.0.0.0/8 after explicit permits",
        "DHCP permit at sequence 5 prevents APIPA",
        "DMZ web access limited to TCP/80"
      ],
      command: "ping 10.10.30.11 · ping 10.10.200.10 · nslookup www.hospital.local",
      caveat: null
    },
    {
      kc: "KC-5",
      title: "DMZ static NAT",
      target: "Internet client → 203.0.115.10",
      expected: "Public web page served; no path into the LAN",
      actual: "LT-TELE → 203.0.115.10 3/4 after ARP warm-up (TTL 125). SRV-WEB-DMZ serves the hospital web page.",
      evidence: [
        "1:1 static NAT 203.0.115.10 ↔ 10.10.200.10",
        "Public DNS record points to the NAT address",
        "Return-direction ACL is a production NGFW rule"
      ],
      command: "ping 203.0.115.10 · browse http://203.0.115.10",
      caveat: "DMZ → LAN return ACL is not modeled on the PT router-on-a-stick; it is enforced by the production NGFW policy."
    },
    {
      kc: "KC-6",
      title: "Management hardening",
      target: "SSH-only access · syslog · port-security",
      expected: "Telnet refused, SSH works, violations restrict",
      actual: "Hardening applied to 6 routers + SW-CORE with 0 high-severity findings. Sticky/restrict port-security on 24 access ports. Syslog and NetFlow collectors remain reachable.",
      evidence: [
        "enable secret · SSH v2 only · transport input ssh",
        "Local admin privilege 15 with banner",
        "syslog 10.10.20.8 · NetFlow export to :2055"
      ],
      command: "ssh -l admin 10.10.10.1 · telnet 10.10.10.1 · show port-security",
      caveat: "Type 5 secret hashing is a Packet Tracer IOS limitation; production uses stronger local authentication."
    }
  ];

  const acl = [
    { seq: "5",  rule: "permit udp any any eq 67",        action: "ALLOW", note: "DHCP DISCOVER from 0.0.0.0" },
    { seq: "10", rule: "permit udp any host 10.10.20.5 eq 53", action: "ALLOW", note: "Internal DNS" },
    { seq: "20", rule: "permit tcp any host 10.10.200.10 eq 80", action: "ALLOW", note: "DMZ web only" },
    { seq: "30", rule: "deny ip any 10.0.0.0 0.255.255.255", action: "DENY", note: "Hospital LAN isolation" },
    { seq: "40", rule: "permit ip any any",                action: "ALLOW", note: "Internet" },
    { seq: "—",  rule: "implicit deny",                    action: "DENY", note: "Default" }
  ];

  const issues = [
    { n: "01", title: "Edge router is not an NGFW", text: "The 2911 provides stateless ACL/NAT only. The production design specifies an HA FortiGate 600E pair with IPS and SSL inspection.", sev: "HIGH" },
    { n: "02", title: "Router-on-a-stick is a SPOF", text: "Inter-VLAN routing depends on one router. Production uses a core switch pair with HSRP/VSS.", sev: "HIGH" },
    { n: "03", title: "OSPF single area 0", text: "Fine for seven routers; multi-area (area 0 + 1/2) is required as the routing domain grows beyond ~50 routers.", sev: "MED" },
    { n: "04", title: "No HA for DMZ static NAT", text: "A single NAT mapping cannot fail between two ISPs without NGFW clustering.", sev: "MED" },
    { n: "05", title: "Serial backup is narrow", text: "N×E1 capacity carries critical HIS/PACS only. SD-WAN with 4G/5G is the full-resilience path.", sev: "MED" },
    { n: "06", title: "ISP load-share is failover", text: "Floating AD 50 provides failover, not true load balancing. PBR, BGP or SD-WAN adds sharing.", sev: "LOW" },
    { n: "07", title: "Detection is staged, not active", text: "Syslog + NetFlow feed a collector, but there are no IPS signatures or SIEM correlation yet.", sev: "MED" },
    { n: "08", title: "Guest Wi-Fi lacks a portal", text: "VLAN + ACL isolation is in place; captive portal, vouchers and rate limiting are on the roadmap.", sev: "LOW" }
  ];

  /* ---- Operations data ------------------------------------------------ */

  const mgmt = {
    "r-edge": "10.10.10.2",
    "r-core": "10.10.10.1",
    "r-wan": "10.10.10.3",
    "sw-core": "10.10.10.4",
    "sw-a": "10.10.10.11",
    "sw-b": "10.10.10.12",
    "sw-srv": "10.10.10.13",
    "sw-cctv": "10.10.10.14",
    "sw-dmz": "10.10.10.15",
    "r-dbp": "10.11.10.1",
    "sw-dbp": "10.11.10.2",
    "r-bhtq": "10.12.10.1",
    "sw-bhtq": "10.12.10.2",
    "isp1": "203.0.113.1",
    "isp2": "203.0.114.1",
    "webint": "198.51.100.10",
    "lt-tele": "192.168.250.10"
  };

  const clusterMembers = {
    "pc-a": [
      { name: "PC-A1", ip: "10.10.30.11" },
      { name: "PC-A2", ip: "10.10.30.12" },
      { name: "PC-A3", ip: "10.10.30.13" },
      { name: "PRN-A", ip: "10.10.30.50", kind: "printer" }
    ],
    "pc-b": [
      { name: "PC-B1", ip: "10.10.40.11" },
      { name: "PC-B2", ip: "10.10.40.12" },
      { name: "PC-B3", ip: "10.10.40.13" },
      { name: "PRN-B", ip: "10.10.40.50", kind: "printer" }
    ],
    "cams": [
      { name: "CAM-01", ip: "10.10.50.21", kind: "cctv" },
      { name: "CAM-02", ip: "10.10.50.22", kind: "cctv" }
    ],
    "pc-dbp": [
      { name: "PC-DBP1", ip: "10.11.10.11" },
      { name: "PC-DBP2", ip: "10.11.10.12" },
      { name: "AP-DBP", ip: "—", kind: "ap", nodeId: "pc-dbp" }
    ],
    "pc-bhtq": [
      { name: "PC-BHTQ1", ip: "10.12.10.11" },
      { name: "PC-BHTQ2", ip: "10.12.10.12" },
      { name: "AP-BHTQ", ip: "—", kind: "ap", nodeId: "pc-bhtq" }
    ]
  };

  const extraDevices = [
    {
      id: "sw-home", name: "SW-HOME", kind: "switch", site: "Teleworker",
      model: "Cisco 2960-24TT", role: "Home office access switch",
      mgmt: "192.168.250.2", nodeId: "ap-home", config: "SW-HOME_config.txt"
    }
  ];

  const linkById = {
    "r-wan|r-dbp|mpls": { label: "MPLS EPL #1 · DBP", site: "DBP Street", monitor: "OSPF" },
    "r-wan|r-dbp|serial": { label: "Serial backup · DBP", site: "DBP Street", monitor: "OSPF" },
    "r-wan|r-bhtq|mpls": { label: "MPLS EPL #2 · BHTQ", site: "BHTQ Street", monitor: "OSPF" },
    "r-wan|r-bhtq|serial": { label: "Serial backup · BHTQ", site: "BHTQ Street", monitor: "OSPF" },
    "isp1|r-edge|internet": { label: "ISP1 uplink", site: "Edge", monitor: "NAT" },
    "isp2|r-edge|internet": { label: "ISP2 uplink", site: "Edge", monitor: "NAT" }
  };

  const ospf = [
    { local: "R-CORE-MS", neighbor: "R-WAN-MS", addr: "10.10.0.6", iface: "Gi0/2", state: "FULL", uptime: "4d 06h" },
    { local: "R-WAN-MS", neighbor: "R-CORE-MS", addr: "10.10.0.5", iface: "Gi0/0/0", state: "FULL", uptime: "4d 06h" },
    { local: "R-WAN-MS", neighbor: "R-DBP", addr: "10.254.0.2", iface: "Gi0/0/1", state: "FULL", uptime: "4d 05h", backupAddr: "10.255.0.2", backupIface: "S0/1/0" },
    { local: "R-WAN-MS", neighbor: "R-BHTQ", addr: "10.254.0.6", iface: "Gi0/0/2", state: "FULL", uptime: "4d 05h", backupAddr: "10.255.0.6", backupIface: "S0/2/0" }
  ];

  const routes = [
    { code: "C", prefix: "10.10.10.0/24", via: "directly connected", iface: "Gi0/0.10", metric: "0/0" },
    { code: "C", prefix: "10.10.20.0/24", via: "directly connected", iface: "Gi0/0.20", metric: "0/0" },
    { code: "C", prefix: "10.10.30.0/24", via: "directly connected", iface: "Gi0/0.30", metric: "0/0" },
    { code: "C", prefix: "10.10.40.0/24", via: "directly connected", iface: "Gi0/0.40", metric: "0/0" },
    { code: "C", prefix: "10.10.50.0/24", via: "directly connected", iface: "Gi0/0.50", metric: "0/0" },
    { code: "C", prefix: "10.10.60.0/24", via: "directly connected", iface: "Gi0/0.60", metric: "0/0" },
    { code: "C", prefix: "10.10.200.0/24", via: "directly connected", iface: "Gi0/0.200", metric: "0/0" },
    { code: "O", prefix: "10.11.0.0/16", via: "10.10.0.6", iface: "Gi0/2", metric: "110/2", branch: "dbp" },
    { code: "O", prefix: "10.12.0.0/16", via: "10.10.0.6", iface: "Gi0/2", metric: "110/2", branch: "bhtq" },
    { code: "S*", prefix: "0.0.0.0/0", via: "10.10.0.2", iface: "Gi0/1", metric: "1/0" }
  ];

  const seedEvents = [
    { minutesAgo: 3, severity: "info", source: "R-DBP", category: "routing", message: "OSPF neighbor 10.254.0.1 (R-WAN-MS) FULL on Gi0/1" },
    { minutesAgo: 11, severity: "warning", source: "SW-BLD-A", category: "security", message: "PSECURE_VIOLATION Fa0/9 — sticky MAC 000c.29a1.4f22 restricted" },
    { minutesAgo: 24, severity: "info", source: "R-EDGE-MS", category: "nat", message: "Static NAT 203.0.115.10 ↔ 10.10.200.10 active" },
    { minutesAgo: 38, severity: "info", source: "R-EDGE-MS", category: "wan", message: "ISP2 floating static 0.0.0.0/0 AD 50 on standby" },
    { minutesAgo: 55, severity: "success", source: "BACKUP", category: "system", message: "Nightly configuration backup finished — 8 devices" },
    { minutesAgo: 78, severity: "info", source: "GUEST", category: "security", message: "DHCP lease 10.10.60.23 issued to LT-GR-MS1 (VLAN 60)" },
    { minutesAgo: 96, severity: "success", source: "HEALTH", category: "system", message: "Scheduled health check passed 6/6" },
    { minutesAgo: 118, severity: "info", source: "R-WAN-MS", category: "wan", message: "Serial S0/1/0 up — backup path stand-by" },
    { minutesAgo: 141, severity: "warning", source: "SW-CCTV", category: "system", message: "NTP not configured — local clock is drifting" },
    { minutesAgo: 166, severity: "info", source: "R-CORE-MS", category: "routing", message: "OSPF advertised 10.10.0.4/30 on Gi0/2" },
    { minutesAgo: 189, severity: "success", source: "SECURITY", category: "security", message: "Guest ACL 150/151/152 applied to VLAN 60/63/73" },
    { minutesAgo: 214, severity: "info", source: "TRAFFIC", category: "traffic", message: "Peak throughput 724 Mbps recorded at 09:55" }
  ];

  const seedAlerts = [
    { minutesAgo: 11, severity: "warning", title: "Port-security violation", detail: "SW-BLD-A Fa0/9 restricted a sticky MAC. Port remains blocked.", source: "SW-BLD-A" },
    { minutesAgo: 38, severity: "info", title: "ISP2 on standby", detail: "Floating static AD 50 ready to take over if ISP1 fails.", source: "R-EDGE-MS" }
  ];

  const traffic = {
    "24h": [190, 150, 128, 112, 104, 118, 176, 248, 386, 512, 664, 724, 648, 566, 604, 690, 723, 688, 542, 428, 356, 298, 246, 205],
    "6h": [512, 604, 690, 723, 688, 612, 540, 470, 420, 372, 318, 266],
    "1h": [588, 604, 622, 612, 598, 584, 601, 618, 632, 612, 596, 612]
  };

  const topTalkers = [
    { label: "HIS application", value: 214, tone: "var(--accent)" },
    { label: "PACS imaging", value: 168, tone: "var(--violet)" },
    { label: "Staff workstations", value: 122, tone: "var(--sky)" },
    { label: "Guest Wi-Fi", value: 96, tone: "var(--amber)" },
    { label: "CCTV recording", value: 42, tone: "var(--cctv)" }
  ];

  const snapshots = [
    { id: "snap-1", device: "R-CORE-MS", site: "Main site", minutesAgo: 12, size: "4.6 KB", md5: "9f2c…a71b", config: "R-CORE-MS_config.txt" },
    { id: "snap-2", device: "R-EDGE-MS", site: "Main site", minutesAgo: 12, size: "5.1 KB", md5: "31e8…c04d", config: "R-EDGE-MS_config.txt" },
    { id: "snap-3", device: "R-WAN-MS", site: "Main site", minutesAgo: 14, size: "4.9 KB", md5: "b407…88f2", config: "R-WAN-MS_config.txt" },
    { id: "snap-4", device: "R-DBP", site: "DBP Street", minutesAgo: 14, size: "3.8 KB", md5: "7a19…d2c8", config: "R-DBP_config.txt" },
    { id: "snap-5", device: "R-BHTQ", site: "BHTQ Street", minutesAgo: 14, size: "3.9 KB", md5: "5cd0…91aa", config: "R-BHTQ_config.txt" },
    { id: "snap-6", device: "SW-CORE", site: "Main site", minutesAgo: 15, size: "3.2 KB", md5: "ea73…4b16", config: "SW-CORE_config.txt" },
    { id: "snap-7", device: "SW-BLD-A", site: "Main site", minutesAgo: 16, size: "2.7 KB", md5: "04be…f9d3", config: "SW-BLD-A_config.txt" },
    { id: "snap-8", device: "SW-DBP", site: "DBP Street", minutesAgo: 16, size: "2.4 KB", md5: "d18f…6e72", config: "SW-DBP_config.txt" }
  ];

  const hardening = [
    { device: "R-EDGE-MS", type: "router", site: "Main site", ssh: 1, secret: 1, vty: 1, syslog: 1, ntp: 1, portSec: null },
    { device: "R-CORE-MS", type: "router", site: "Main site", ssh: 1, secret: 1, vty: 1, syslog: 1, ntp: 1, portSec: null },
    { device: "R-WAN-MS", type: "router", site: "Main site", ssh: 1, secret: 1, vty: 1, syslog: 1, ntp: 1, portSec: null },
    { device: "R-DBP", type: "router", site: "DBP Street", ssh: 1, secret: 1, vty: 1, syslog: 1, ntp: 0, portSec: null },
    { device: "R-BHTQ", type: "router", site: "BHTQ Street", ssh: 1, secret: 1, vty: 1, syslog: 1, ntp: 0, portSec: null },
    { device: "SW-CORE", type: "switch", site: "Main site", ssh: 1, secret: 1, vty: 1, syslog: 1, ntp: 1, portSec: 1 },
    { device: "SW-BLD-A", type: "switch", site: "Main site", ssh: 1, secret: 1, vty: 1, syslog: 1, ntp: 1, portSec: 1 },
    { device: "SW-BLD-B", type: "switch", site: "Main site", ssh: 1, secret: 1, vty: 1, syslog: 1, ntp: 1, portSec: 1 },
    { device: "SW-SRV", type: "switch", site: "Main site", ssh: 1, secret: 1, vty: 1, syslog: 1, ntp: 1, portSec: 1 },
    { device: "SW-CCTV", type: "switch", site: "Main site", ssh: 1, secret: 1, vty: 1, syslog: 1, ntp: 0, portSec: 1 },
    { device: "SW-DMZ", type: "switch", site: "Main site", ssh: 1, secret: 1, vty: 1, syslog: 1, ntp: 1, portSec: 1 },
    { device: "SW-DBP", type: "switch", site: "DBP Street", ssh: 1, secret: 1, vty: 1, syslog: 1, ntp: 1, portSec: 1 },
    { device: "SW-BHTQ", type: "switch", site: "BHTQ Street", ssh: 1, secret: 1, vty: 1, syslog: 1, ntp: 1, portSec: 1 }
  ];

  const portSecurity = [
    { device: "SW-BLD-A", site: "Main site", ports: 6, policy: "sticky · restrict", max: "2 user / 4 AP", violations: 1 },
    { device: "SW-BLD-B", site: "Main site", ports: 6, policy: "sticky · restrict", max: "2 user / 4 AP", violations: 0 },
    { device: "SW-SRV", site: "Main site", ports: 4, policy: "sticky · restrict", max: "2 server", violations: 0 },
    { device: "SW-CCTV", site: "Main site", ports: 2, policy: "sticky · restrict", max: "2 camera", violations: 0 },
    { device: "SW-DMZ", site: "Main site", ports: 2, policy: "sticky · restrict", max: "2 server", violations: 0 },
    { device: "SW-DBP", site: "DBP Street", ports: 4, policy: "sticky · restrict", max: "2 user", violations: 0 }
  ];

  const pingTargets = [
    { label: "SRV-HIS", ip: "10.10.20.6" },
    { label: "SRV-DNS", ip: "10.10.20.5" },
    { label: "DMZ web", ip: "203.0.115.10" },
    { label: "R-DBP uplink", ip: "10.254.0.2" },
    { label: "Branch server", ip: "10.12.20.10" },
    { label: "Internet test", ip: "198.51.100.10" }
  ];

  return {
    meta: {
      title: "CCC NOC · Network Operations Console",
      assignment: "Computer Networks — Assignment 2 · HCMUT",
      version: "v1.0",
      ptVersion: "Packet Tracer 9.0.1",
      devices: 46,
      links: 45
    },
    zones,
    nodes,
    links,
    vlans,
    bandwidth,
    bom,
    bomTotal,
    verification,
    acl,
    issues,
    mgmt,
    clusterMembers,
    extraDevices,
    linkById,
    ospf,
    routes,
    seedEvents,
    seedAlerts,
    traffic,
    topTalkers,
    snapshots,
    hardening,
    portSecurity,
    pingTargets
  };
})();
