# CHANGELOG

Log chi tiết từng bước làm — song song với commit messages của repo.

## 2026-10-21 — Khởi động dự án

- Phân tích đề bài Assignment 2 (bệnh viện 3 site, VLAN, WAN, VPN, bảo mật).
- Chọn dữ liệu bàn giao: báo cáo tiếng Việt, không cần trang bìa (điền sau).
- Kết nối MCP Packet Tracer: OK (HTTP + file bridge, PT 9.0.1.0858), workspace trống.
- Lập `plan` 46 thiết bị / 45 link → `pt_validate_plan` PASS (0 lỗi, 0 warning).

## 2026-10-21 — Deploy khung topology vào Packet Tracer

- `pt_live_deploy`: 46/46 thiết bị, 43/45 link khớp ngay lập tức.
- 2 link thất bại do Switch-PT generic đặt tên port `FastEthernet1/1`, `FastEthernet2/1`
  (khác nhánh phổ biến `FastEthernet0/x`) → sửa bằng `pt_add_link`: OK → 45/45 link.
- Lắp module WAN serial: `NIM-2T` slot `"0/1"` & `"0/2"` cho R-WAN-MS (ISR4331),
  `HWIC-2T` slot `"0/0"` cho R-DBP và R-BHTQ (2911). 3/4 lần đầu lỗi do slot `"0/0"`
  không tồn tại trên ISR4331 (NIM chỉ có `0/1`,`0/2`) → fix, cài đủ.
- Nối 2 link serial (leased line dự phòng):
  - R-WAN-MS `Serial0/1/0` ↔ R-DBP `Serial0/0/0`
  - R-WAN-MS `Serial0/2/0` ↔ R-BHTQ `Serial0/0/0`
- Cấu hình IP serial + clock rate 2 000 000 + thêm mạng vào OSPF area 0 qua `configureIosDevice`.
  Phát hiện + sửa lỗi gán IP trái chiều trên R-WAN-MS (S0/1/0 phải là 10.255.0.1, S0/2/0 là 10.255.0.5).
  Root cause: gán `10.255.0.5` cho S0/2/0 khi S0/1/0 vẫn giữ `10.255.0.5/30` → IOS chặn
  `% 10.255.0.4 overlaps with Serial0/1/0` âm thầm trong batch push. Sửa theo thứ tự:
  S0/1/0 → 10.255.0.1 trước, rồi S0/2/0 → 10.255.0.5.
- OSPF: R-WAN-MS đã up đầy đủ adjacency với R-CORE-MS (10.10.0.1), R-DBP (10.11.10.1), R-BHTQ (10.12.10.1).
- `pt_verify_connectivity` serial backup: R-WAN-MS → 10.255.0.2 (R-DBP) 5/5; → 10.255.0.6 (R-BHTQ) 5/5.

## Tiếp theo (roadmap)

1. default-information originate trên R-EDGE-MS; NAT/PAT + static NAT DMZ.
2. ACL guest-WiFi trên 3 sub-interface (.60/.63/.73).
3. Server: web page, DNS records, syslog; NetFlow trên R-EDGE-MS.
4. Wireless guests (laptop + smartphone) – kiểm tra association.
5. Bảng kiểm chứng ping/traceroute theo Step 5 + screenshot + lưu `.pkt` vào `simulation/`.
6. Viết báo cáo `report/REPORT_vi.md` (Step 1→7).

## 2026-10-21 — Dịch vụ, NAT/ACL, DNS, wireless

- **NAT trên R-EDGE-MS**: PAT acl 1 → Gi0/0 (ISP1), PAT acl 2 → Gi0/1 (ISP2),
  static `10.10.200.10 ↔ 203.0.115.10` — kiểm chứng ping từ LT-TELE → 203.0.115.10 3/4 (TTL 125).
- **ACL guest 150/151/152** áp vào Gi0/0.60/.63/.73 chiều `in` (permit DNS → 10.10.20.5 + TCP/80 →
  DMZ web; deny 10.0.0.0/8; permit any).
- **DNS**: 5 record trên SRV-DNS (www/his/pacs/mail .hospital.local + www.internet-test.com);
  **Web**: index.html trên SRV-WEB-DMZ/INT/HIS; **syslog** bật trên SRV-LOG + `logging 10.10.20.8`
  trên R-EDGE-MS & R-CORE-MS; **NetFlow** NF-HOSP → 10.10.20.8:2055.
- **Wireless guest giờ chạy**: SQL thêm/lắp NIC chỉ trên bridge: `removeModule('0')` +
  `addModule('0', PT-LAPTOP-NM-1W)` trên LT-GR-MS1; smartphone SMARTPHONE-PT có sẵn Wireless0.

## 2026-10-21 — Chẩn đoán & sửa các lỗi kết nối (khoản "debug" đáng giữ)

- **Lỗi #1 — ACL chặn DHCP guest**: DISCOVER đi với src `0.0.0.0` → không match permit nào của
  ACL 150 (src-scoped) → implicit deny → client chỉ nhận APIPA. Chỉnh được nhờ *Sim mode* +
  `pt_read_packet_trace`. Fix: `5 permit udp any any eq bootps` vào ACL 150/151/152.
- **Lỗi #2 — Static IP không được gán cho host**: PT 9.0.1 không có `setIp`; dùng
  `port.setIpSubnetMask(ip, mask)` + `port.setDefaultGateway` + `port.setDnsServerIp` để chuẩn hoá
  lại 16 IP (SRV-DNS .20.5, SRV-HIS .20.6, SRV-PACS .20.7, SRV-NVR .50.10, CAM-01 .50.21,
  SRV-WEB-DMZ .200.10, PC-A/B/DBP/BHTQ 1 .11). *Không dùng* cách cấu static qua console
  (`ipconfig /ip` là Invalid Command trong build này).
- **Lỗi #3 — Laptop associate nhầm AP-HOME** (teleworker) vì XY gần AP đó: `pt_move_device`
  LT-GR-MS1 → (120, 400); sau đó LTS nhận `10.10.60.23/24` DHCP bình thường.
- **Lỗi #4 — Thiếu gateway cho SRV-WEB-INT**: đặt `198.51.100.1` thì reply mới đi ra khác subnet.
- **Teleworker stub**: thêm `ip route 192.168.250.0/24` trên R-EDGE-MS & ISP1 cho đường về.

## 2026-10-21 — Hardening, port-security, kiểm chứng & đóng gói

- `pt_apply_hardening` áp cho ISP1, R-EDGE-MS, R-CORE-MS, R-WAN-MS, R-DBP, R-BHTQ, SW-CORE:
  hostname, banner motd, `enable secret`, `ip domain-name`, RSA 1024, SSH v2, vty `transport input ssh`,
  user local `admin` (privilege 15). Lưu ý schema user của tool: `{username, secret, privilege}`.
- `pt_apply_port_security` áp cho 24 access port (attain: PC/server = max 2, sticky, violation restrict;
  uplink AP = max 4, sticky off, restrict): SW-BLD-A/B (Fa0/1,2,3,5,23), SW-SRV (Fa0/1..4),
  SW-CCTV (Fa0/1,2), SW-DMZ (Fa0/1,2), SW-DBP/BHTQ (Fa0/1,2,23).
- Bảng kiểm chứng (report Step 5, KC-1→KC-6) chạy thật: tất cả ĐẠT, trừ một hạn chế đã ghi chú
  (LT-TELE → 198.51.100.10 chưa qua được trong mô hình; static NAT DMZ đã OK).
- **Failover EPL → serial (KC-2)**: shutdown `Gi0/1` R-DBP → PC-DBP1 → SRV-HIS 4/4 vẫn OK (OSPF
  chuyển qua serial backup `10.255.0.0/30`); `no shutdown` → 4/4 (EPL).
- Xóa thiết bị test `PC-TEST60`; dán 10 annotation (subnet labels) trên canvas; chụp
  `report/images/topology-final(*).png`.
- **Lưu bài nộp**: `pt_save_project` → `simulation/CCC-Hospital.pkt` (≈252 KB, Packet Tracer 9.0.1).

## 2026-11-07 — Bản chốt v2 (49 thiết bị) theo 3 trụ đề bài

- **Tái kiến trúc `simulation/CCC-Hospital-v2.pkt`** (49 thiết bị / 49 link): Main Site một lối ra
  (VLAN → SW-CORE L3 → R-CORE-MS → **FW-MAIN** → GW-MAIN → WAN); trạm phụ GW-DBP/GW-BHTQ **không
  firewall**; VPN mobile chấm ngay trên firewall FW-MAIN ↔ R-HOME.
- **Đánh lại dải địa chỉ:** VLAN 10/20/30/40/50/60 = 192.168.10/20/30/40/50/60.0/24; WAN transit
  172.16.0.x; Frame Relay 172.17.10/20.0/30; serial backup 172.18.10/20.0/30; trạm phụ
  192.168.110/120.0/24; mobile worker 192.168.90.0/24; overlay 10.254.0.0/30.
- **WAN Frame Relay**: 2 PVC ánh xạ DLCI tay trong GUI (GW-MAIN S0/1/0 dlci **110** ↔ GW-DBP
  S0/1/0 dlci **101**; GW-MAIN S0/1/1 dlci **120** ↔ GW-BHTQ S0/1/0 dlci **102**) + 2 serial
  backup (floating static **AD 200**) trên GW-MAIN S0/2/0, S0/2/1.
- **KC-2 failover v2 (đo thật):** cắt PVC DBP cả hai đầu → `ping 172.17.10.1` 0/5, `traceroute`
  GW-DBP→HIS **hop 1 = 172.18.10.1** (rẽ serial backup), PC-DBP1 → HIS vẫn 4/4; khôi phục → 4/4.
- **KC-7 VPN mobile:** GRE tunnel FW-MAIN↔R-HOME up; LT-MOBILE1 (192.168.90.10) → SRV-DNS 0 % loss.
  IKE/IPsec main-mode của PT 9.0.1 kẹt `MM_SA_SETUP` trên path đa-hop có NAT → dùng GRE làm đường dữ
  liệu, giữ nguyên crypto-map làm chứng cứ thiết kế.
- **Wi-Fi:** hai AP đặt SSID khác nhau bằng GUI; sau khi nạp lại project, LT-GR-MS1 → 192.168.60.21
  (AP-GUEST), LT-MOBILE1 → 192.168.90.10 (AP-HOME).
- **Khắc phục mất dấu enable secret GW-MAIN:** đặt lại đồng nhất `Hosp@2026!Sec` cho router qua
  `configureIosDevice`; bổ sung static route trả về nhánh (110/120) trên GW-MAIN + floating default
  (AD 200) trên GW-DBP/GW-BHTQ.
- **Kiểm tra sức khoẻ cuối:** `pt_health_check` → 0 link down, 0 IP trùng; chốt `.pkt` + ảnh canvas
  `report/images/topology-v2.png`; cập nhật `REPORT_vi.md` mục 5.4 và 6.1.
