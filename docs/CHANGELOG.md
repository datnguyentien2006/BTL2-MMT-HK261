# CHANGELOG

Log chi tiết từng bước làm — song song với commit messages của repo.

## 2026-11-09 — Dọn repo: chỉ giữ bản final nộp bài

- **Giao:** repo (GitHub `datnguyentien2006/BTL2-MMT-HK261`) chỉ giữ **bản final cuối cùng**;
  các bản trung gian/v1 không push lên repo nữa.
- **Xóa:**
  - `simulation/CCC-Hospital.pkt` (bản khung v1 46/45) và 2 ảnh `CCC_Hospital_v2_final.png` /
    `CCC_Hospital_v2_layout.png` (không được tham chiếu trong report) → `simulation/` giờ chứa
    duy nhất `CCC-Hospital-v2.pkt`.
  - `docs/ptbuild/CCC-Hospital/` (archive config v1, 20 file) — các thay đổi ACL guest/CCTV của
    thành viên trên bản v1 đã dồn vào lịch sử git; bản archive duy nhất của repo là
    `docs/ptbuild/CCC-Hospital-v2/`.
  - `web/` (dashboard NOC mô tả bản khung v1) — để tránh nhầm lẫn hai phiên bản thiết kế trong
    bộ nộp.
- **Sửa tham chiếu theo đó:** README,
  `report/REPORT_vi.md` (§5.2 bước chuẩn bị, §5.3 archive config, bảng đóng gói §8),
  `download/btl2_src.html` (ghi chú phiên bản + B.9 đóng gói) → PDF nộp render lại.
- **Gỡ narrative v1 khỏi report theo yêu cầu "chỉ giữ bản final":**
  - Viết lại toàn bộ §5 (STEP 4) thành mô hình v2: nguyên tắc thu nhỏ + mapping 49 thiết bị
    (FW-MAIN/GW-MAIN/GW-DBP/GW-BHTQ/R-HOME...), 8 bước dựng v2, 3 trụ yêu cầu, bảng địa chỉ v2,
    WAN Frame Relay/serial + debug log v2, ảnh `topology-v2.png`.
  - Xóa bảng đo v1 (KC-1→KC-6 dải 10.10.x) ở đầu §6 — chỉ còn ma trận KC-1→KC-8 đo live trên v2;
    xóa ảnh `report/images/topology-final.png` (ảnh mô hình v1).
  - §3.2 cập nhật danh mục thiết bị mô phỏng sang v2 (49/49, FW-MAIN, GW-MAIN, R-HOME);
    §7.2/§7.3 đổi R-EDGE-MS → FW-MAIN, ghi chú định tuyến mô hình dùng static AD 100/200.
  - PDF nộp (`BTL2_report.pdf`) render lại từ `btl2_src.html` đã bỏ câu "bản khung v1 còn giữ".
- Lịch sử git vẫn giữ nguyên toàn bộ file v1/web đã xóa (có thể truy vết bằng commit cũ).

## 2026-11-09 — Đợt đo kiểm chứng live trên CCC-Hospital-v2.pkt + chỉ SK xuất archive v2

- **Đo live KC-1→KC-8** trên `simulation/CCC-Hospital-v2.pkt` (49 thiết bị/49 link, PT 9.0.1)
  qua MCP: ping thật từ console thiết bị, `show` thật từ router/switch. Toàn bộ transcription:
  `docs/ptbuild/CCC-Hospital-v2/evidence-2026-11-09.md`.
- **KC-8 failover ISP1→ISP2 đo đầy đủ 2 kịch bản:** baseline 4/4; tắt ISP1 + thu hồi default
  chính → RIB FW-MAIN chuyển `Gateway of last resort is 199.115.1.3` (floating AD 50 nhậm
  chức), LT-MOBILE1→SRV-DNS **4/4 qua ISP2**, PC-DBP1→HIS 4/4 (FR độc lập), PC-A1→SRV-INT 0/4
  (dải "Internet" chỉ neo sau ISP1 — giới hạn sim đã ghi rành); khôi phục → 4/4.
- **Sửa config thiếu trong .pkt** (đã save lại):
  - FW-MAIN thiếu floating default AD 50 (report khai báo trước nhưng config thật chỉ có
    default ISP1) → thêm `ip route 0.0.0.0 0.0.0.0 199.115.1.3 50`.
  - SW-CORE ACL 150 thiếu permit guest → web DMZ TCP 80/443 (US-4) → rebuild ACL 150 đúng
    thứ tự + giữ bind `ip access-group 150 in` trên Vlan60.
  - Khôi phục crypto FW-MAIN (ISAKMP policy/key, transform TS-MOB, crypto map VPN-MOB dưới
    G0/2) bị rơi trong vòng boot build — khớp phụ lục A.4.
- **Archive v2 mới:** `docs/ptbuild/CCC-Hospital-v2/` — 9 config (`FW-MAIN`, `GW-MAIN`,
  `GW-DBP`, `GW-BHTQ`, `R-CORE-MS`, `R-HOME`, `SW-CORE`, `ISP1`, `ISP2` — xuất startup-config
  thật bằng pt_backup_config) + `metadata.json` + evidence.
- Xác minh đăng nhập console GW-MAIN: `enable` + `Hosp@2026!Sec` OK (mật khẩu thống nhất
  đúng cho toàn bộ router; hash Type 5 khác nhau giữa các thiết bị là hành vi bình thường
  của mỗi lần đặt secret).
- Report: điền số đo thật vào §6.1 (KC-1..KC-8), gắn nhãn bảng §6 là "đợt đo v1" để không
  nhầm với v2, thay promise "ảnh CLI chờ chụp" bằng reference file evidence.

## 2026-11-08 — Round fix trước khi nộp (khớp chuẩn checklist đề bài)

- **Sửa cơ số tính Step 3**: khung giờ "9–11h & 15–16h" = **3 giờ hiệu dụng** (bản đọc nhầm 4h).
  Method A: 6.512.000 Mbit ÷ 10.800 s ≈ 603 Mbps → +20% ≈ **724 Mbps**; Method B: peak ≈
  **965 Mbps** → ×1,2 ≈ **1.158 Mbps**. WAN/trạm: tính lại (kèm lưu lượng server tải xuống qua
  WAN) ≈ 139/222 Mbps → ×1,2 ≈ 166/**266 Mbps** → **chọn EPL 300 Mbps/trạm** (trước 200).
- **Thêm §3.6** — bảng so sánh 5 phương án WAN (MPLS L3VPN, EPL, serial FR, IPsec/DMVPN,
  SD-WAN) với chi phí thuê + ưu/nhược + lý do chọn EPL (yêu cầu rành của đề).
- **Thêm §3.7** — đề xuất hệ thống CCTV (62 camera, NVR RAID-6/6-8, VLAN 50, sizing ~28 TB main,
  băng thông ~250 Mbps, PoE+) theo đề bài "propose a surveillance camera system".
- Bổ sung LIS/CRM (§2.1) và "phishing" ở roadmap §7.3.
- Sửa KC-4 + Phụ lục A.4/B.1-7: đích DNS đúng **10.10.20.5** (không phải 10.10.10.10).
- Phụ lục A thêm ghi chú rõ: bảng IP của phụ lục mô tả **thiết kế thật (Step 1–3)**; bảng IP v2
  của .pkt ở §5.4 chỉ áp dụng cho mô phỏng.
- §5.3 + §6.1: mô tả đúng vị trí cấu hình v1 (`docs/ptbuild/CCC-Hospital/`) và vị trí export
  config v2 (`docs/ptbuild/CCC-Hospital-v2/`); đánh dấu 3 mục ảnh Step 5 chờ chụp từ .pkt v2
  (thay tham chiếu ảnh chưa tồn tại = broken render).

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

## 2026-11-07 — Bản chốt v2 (3 trụ yêu cầu + WAN Frame Relay + VPN mobile)

- **Tái kiến trúc thành `simulation/CCC-Hospital-v2.pkt`** (49 thiết bị / 49 link): Main Site một lối ra
  (VLAN → SW-CORE L3 → R-CORE-MS → **FW-MAIN** → GW-MAIN → WAN); trạm phụ DBP/BHTQ **không firewall**;
  VPN mobile **chấm trên FW-MAIN** (G0/2 199.115.1.1).
- **Đánh lại dải địa chỉ**: VLAN 10/20/30/40/50/60 = 192.168.10/20/30/40/50/60.0/24; thêm VLAN 40 DMZ;
  Internet giả lập 198.51.100.0/24 + 203.0.113.0/30; mobile LAN 192.168.90.0/24; trạm 192.168.110/120.0/24.
- **WAN Frame Relay (DLCI cấu hình tay trong GUI — API PT không phơi DLCI)**:
  GW-MAIN S0/1/0 ↔ GW-DBP S0/1/0 (**DLCI 110 ↔ 101**, 172.17.10.0/30);
  GW-MAIN S0/1/1 ↔ GW-BHTQ S0/1/0 (**DLCI 120 ↔ 102**, 172.17.20.0/30).
- **Serial backup + floating static**: GW-MAIN S0/2/0 ↔ GW-DBP S0/1/1 (172.18.10.0/30) và
  GW-MAIN S0/2/1 ↔ GW-BHTQ S0/1/1 (172.18.20.0/30); default route AD 100 (FR) + **AD 200** (serial) ở hai
  gateway nhánh; route về 192.168.110/120.0/24 trên GW-MAIN (AD 100/200).
- **Wireless**: SSID khác nhau bằng GUI (AP-GUEST / AP-HOME) — sau khi nạp lại project, PT mới lọc đúng;
  LT-GR-MS1 = **192.168.60.21** (guest), LT-MOBILE1 = **192.168.90.10** (mobile).
- **VPN mobile**: IKE/IPsec main-mode không hội tụ trên path đa-hop có NAT (giới hạn PT 9.0.1) → dựng
  **GRE tunnel FW-MAIN ↔ R-HOME (10.254.0.0/30)** làm đường chạy được; crypto-map/ISAKMP **giữ nguyên**
  làm chứng cứ thiết kế.
- **Sửa mất dấu enable secret trên GW-MAIN**: đặt lại đồng nhất `Hosp@2026!Sec` qua `configureIosDevice`.
- **KC-2 v2 (failover FR → serial) đo thật**: PC-DBP1/PC-BHTQ1 → SRV-HIS 4/4; cắt PVC DBP cả hai đầu
  (`ping 172.17.10.1` 0/5) → `traceroute` từ GW-DBP hop 1 = **172.18.10.1** (serial backup), PC vẫn 4/4;
  khôi phục → 4/4. `pt_health_check`: 0 link down, 0 IP trùng.
- **Báo cáo**: thêm mục **5.4** (kiến trúc + bảng địa chỉ + bảng DLCI v2) và **6.1** (ma trận KC-1→KC-8 v2)
  trong `report/REPORT_vi.md`; thêm ảnh `report/images/topology-v2.png`.
- **Lưu bài nộp v2**: `simulation/CCC-Hospital-v2.pkt` (≈260 KB, Packet Tracer 9.0.1).
