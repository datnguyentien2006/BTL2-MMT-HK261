# KỊCH BẢN DEMO BTL2 — MẠNG BỆNH VIỆN HẠNG MỤC QUAN TRỌNG

**Môn:** Mạng máy tính — Assignment 2 (HCMUT) · **Hình thức:** demo solo (1 người vừa điều khiển vừa thuyết trình)

| Hạng mục | Giá trị |
|---|---|
| Sản phẩm demo | `simulation/CCC-Hospital-v2.pkt` — 49 thiết bị / 49 link (Packet Tracer 9.0.1) |
| Thời lượng mục tiêu | **18 phút** (+ ~2 phút buffer) |
| Mật khẩu enable | `cisco123` (thống nhất 15 thiết bị IOS: 8 router + 7 switch) |
| Mô hình | Main Site TP.HCM + trạm phụ DBP/BHTQ + home/teleworker |
| Trạng thái chốt | Xanh 8/8 KC — đo live 2026-11-11 (dải 10.x) |

> **Nguyên tắc an toàn khi demo:** mọi thao tác phá tiết (cắt PVC, tắt ISP) đều có mục **khôi phục** ngay sau đó. Kết thúc demo, `.pkt` phải trở lại trạng thái "cả 2 đường sống" (xem Checklist mục 7).

---

## 0. ĐỌC NHANH TRƯỚC KHI VÀO (cheat sheet)

**Ba trụ yêu cầu của đề — phải hit trong 60 giây đầu:**

1. **Main Site chỉ có MỘT lối ra Internet** — mọi VLAN 10/20/30/40/50/60 đi SW-CORE (L3) -> R-CORE-MS -> FW-MAIN -> GW-MAIN -> WAN/Internet. Không VLAN nào tự ra ngoài.
2. **Trạm phụ KHÔNG có firewall riêng** — GW-DBP / GW-BHTQ chỉ là gateway mép; toàn bộ chính sách kiểm soát tập trung tại FW-MAIN + ACL trên SW-CORE.
3. **VPN mobile chấm NGAY TRÊN firewall** — tunnel FW-MAIN <-> R-HOME kết thúc tại FW-MAIN (G0/2 199.115.1.1), không đi vào LAN nội bộ.

**Tám kiểm chứng (KC) cần chạy:** KC-1 LAN nội bộ · KC-2 liên trạm/failover WAN (điểm nhấn) · KC-3 Internet NAT · KC-4 cô lập Wi-Fi khách · KC-5 DMZ chiều ngược · KC-6 hardening/SSH · KC-7 VPN mobile · KC-8 failover ISP.

**Ba câu chốt:** "Đề bài hỏi gì, mô hình trả lời đúng cái đó" — (1) một lối ra duy nhất; (2) trạm phụ tin cậy, policy tập trung; (3) VPN kết thúc trên firewall.

**Ba con số nhớ sẵn:** `199.115.1.1` (IP public chia sẻ DMZ) · `199.115.1.3` (ISP2, floating AD 50) · `cisco123` (enable secret).

---

## 1. CHUẨN BỊ

### 1.1. Trước ngày demo (T-1 ngày)

- Sao lưu `.pkt` ra nơi khác: copy `simulation/CCC-Hospital-v2.pkt` thành `CCC-Hospital-v2_BACKUP.pkt`.
- Mở `.pkt` bằng PT, bấm **File > Save** để chốt trạng thái sạch; đóng lại. Nếu PT hỏi lưu khi thoát, chọn **Không** sau khi đã save.
- Kiểm tra `pt_health_check` (nếu dùng MCP): phải 0 link đứt, 0 IP trùng.
- Mở sẵn 2 tài liệu để fallback: `report/REPORT_vi.md` (bảng §6.1) và `docs/ptbuild/CCC-Hospital-v2/evidence-2026-11-11.md`.

### 1.2. Trước 30 phút (T-30')

- Mở Packet Tracer, mở `simulation/CCC-Hospital-v2.pkt`, chờ topology load hết (nhìn góc dưới: 49/49 link).
- Tắt chế độ sleep/hibernate của máy; cắm sạc; tắt thông báo hệ điều hành.
- Thu nhỏ các app khác; chỉ giữ PT + trình xem PDF.
- Kiểm tra **Realtime mode** (góc dưới phải là đồng hồ, không phải mũi tên Simulation).

### 1.3. Trước 15 phút (T-15')

- **Zoom vừa khung:** View > Zoom, hoặc giữ Ctrl + lăn chuột để topology vừa màn hình; dùng con lăn để kéo canvas.
- Mở sẵn 1 cửa sổ console nhỏ gọn cho **GW-DBP** (sẽ dùng KC-2) và **FW-MAIN** (KC-3/7/8): double-click thiết bị > tab **CLI** > Enter.
- Mở sẵn desktop cho **PC-A1**, **PC-DBP1**, **LT-GR-MS1**, **LT-MOBILE1** (tab Desktop > Command Prompt) — để không phải mất thời gian bấm khi demo.
- Bấm sẵn `enable` + `cisco123` trên GW-DBP và FW-MAIN để prompt đã ở `#`.
- Kiểm tra nhanh 1 ping cầu chì: PC-A1 ping `10.0.16.2` (SRV-DNS) phải ra **Reply from ...** — xác nhận mô hình đang sống.

### 1.4. Trước 5 phút (T-5')

- Đọc lại mục 0 (cheat sheet) và timeline mục 3.
- Mở sẵn file PDF kịch bản này ở mục "Lệnh nhanh" (Phụ lục A) để liếc.
- Hít thở, nói chậm. **Không** mở TAB khác trong lúc demo.

### 1.5. Dàn cửa sổ chuẩn (để không phải quét màn hình tìm thiết bị)

| Vị trí màn hình | Thiết bị | Dùng ở KC |
|---|---|---|
| Trái-trên | PC-A1 (Desktop/Command Prompt) | KC-1, KC-5, KC-8 |
| Trái-dưới | LT-GR-MS1 (Desktop/Command Prompt) | KC-4 |
| Giữa | SW-CORE (CLI) | KC-1, KC-4, KC-5 |
| Phải-trên | FW-MAIN (CLI) | KC-3, KC-7, KC-8 |
| Phải-dưới | GW-DBP (CLI) | KC-2 |

### 1.6. Trang bị dự phòng (bắt buộc có)

- **Ảnh bằng chứng** (thay thế nếu live lỗi): `report/images/connection_test/ping_cross_vlan.png`, `ping_intra_vlan.png`, `ping_aux_site.png`, `ping_from_guest_to_internal.png`, `connect_web_dmz.png`, `internet_to_webserver.png`.
- **File evidence** `evidence-2026-11-11.md` — số đo gốc KC-1 -> KC-8.
- **Câu đổ thuyết trình** nếu 1 thao tác live lỗi: xem mục 5 (Plan-B).

---

## 2. BẢN ĐỒ 8 KC & 3 TRỤ

| KC | Nội dung | Thiết bị/lệnh chính | Kết quả mong đợi | Trụ |
|---|---|---|---|---|
| KC-1 | LAN nội bộ Main Site: cùng VLAN, liên VLAN, DNS nội bộ, camera->NVR | PC-A1 ping; nslookup | 4/4 tất cả; DNS trả 10.0.16.x | single exit |
| KC-2 | Liên trạm: PC-DBP1/PC-BHTQ1 -> SRV-HIS; **cắt PVC -> backup tiếp quản** | ping + traceroute GW-DBP | 4/4; hop 1 = 172.18.10.1 | - |
| KC-3 | Internet qua PAT + static NAT cho DMZ | PC-A1 ping 198.51.100.10; `show ip nat translations` | 4/4; bảng NAT PAT + 3 dòng static | single exit |
| KC-4 | Wi-Fi khách bị cô lập nội bộ | LT-GR-MS1 ping | LAN 0/4, DNS 0/4, Internet 4/4 | - |
| KC-5 | DMZ: LAN->DMZ thông, DMZ không vào nội bộ | PC-A1 ping; `show ip access-lists DMZ-IN` | LAN->DMZ 4/4; DMZ->LAN chặn | - |
| KC-6 | Hardening: SSH mở, telnet chặn, secret, port-security | `ssh`, `telnet`, `show port-security` | SSH OK; telnet bị từ chối | - |
| KC-7 | **VPN mobile chấm trên firewall** | LT-MOBILE1 ping SRV-DNS; `show run` | 4/4 qua Tunnel0 | VPN trên FW |
| KC-8 | Failover Internet ISP1 -> ISP2 (floating AD 50) | tắt ISP1; `show ip route` | Gateway of last resort = 199.115.1.3 | - |

---

## 3. TIMELINE PHÚT-ĐỐI-PHÚT (18 phút)

| Phút | Nội dung | Thao tác chính | KC | Điểm phải hit |
|---|---|---|---|---|
| 0:00–1:00 | Mở đầu | Chỉ 3 vùng trên canvas: MAIN SITE / Branch DBP+BHTQ / HOME | - | 3 trụ yêu cầu trong 60 giây |
| 1:00–2:30 | Kiến trúc Main Site | SW-CORE: `show ip interface brief` (6 SVI 10.0.x); R-CORE-MS: `show ip dhcp binding` | - | một lối ra duy nhất + DHCP tập trung |
| 2:30–4:00 | KC-1 LAN | PC-A1 ping SRV-DNS, SRV-HIS, PC-A2, PC-B1; `nslookup` | KC-1 | liên VLAN qua SVI, dải /19 |
| 4:00–5:30 | KC-4 Guest | LT-GR-MS1 ping PC-A1 / SRV-DNS / Internet; SW-CORE `show access-lists 150` | KC-4 | ACL closest-to-source |
| 5:30–6:45 | KC-5 DMZ | PC-A1 ping 10.0.1.2; SW-CORE `show ip access-lists DMZ-IN` | KC-5 | DMZ-IN established |
| 6:45–8:30 | **KC-2 failover WAN** | ping liên tục PC-DBP1 -> HIS; cắt PVC 2 đầu; traceroute; khôi phục | KC-2 | AD 100/200, ping không đứt |
| 8:30–10:00 | KC-3 NAT | PC-A1 ping 198.51.100.10; FW-MAIN `show ip nat translations` | KC-3 | PAT + static NAT share IP |
| 10:00–11:30 | KC-7 VPN mobile | LT-MOBILE1 ping SRV-DNS; FW-MAIN `show ip route` + `show run | include crypto` | KC-7 | tunnel kết thúc trên FW |
| 11:30–13:00 | KC-8 failover ISP | tắt ISP1 + thu hồi default chính; `show ip route`; mobile ping; khôi phục | KC-8 | GOLR = 199.115.1.3 |
| 13:00–14:30 | KC-6 Hardening | `ssh`, `telnet` (chặn), `enable`/cisco123, port-security | KC-6 | 15 thiết bị cùng hash |
| 14:30–16:00 | Bảo mật mở rộng | ACL 160 CCTV (camera->NVR only); NetFlow/syslog về SRV-LOG | - | giám sát như đề hỏi |
| 16:00–17:30 | Đánh giá & roadmap | Reliability / upgrade / safe / security + roadmap 1 câu/KC | - | bám bảng §7 report |
| 17:30–18:00 | Kết | Tổng kết 8/8 KC xanh + 3 trụ | - | câu chốt |

---

## 4. KỊCH BẢN CHI TIẾT

### 4.1. Mở đầu (0:00–1:00)

**Mục tiêu:** định vị người nghe trong 60 giây.

- Chỉ tay lên canvas, lần lượt 3 vùng: **Main Site (TP.HCM)** — 2 tòa nhà + Data Center; **trạm phụ DBP & BHTQ** (góc phải); **HOME/teleworker** (góc trái, sau AP-HOME).
- Nói 3 trụ (mục 0).
- Nói luôn 1 câu phòng trước: "Các link Serial màu đỏ trên canvas là quy ước vẽ của PT cho link Frame Relay, không phải link lỗi — trạng thái thật là up/up."

**Lời thoại:** « Mô hình này là bản thu nhỏ đại diện của kiến trúc 1.120 workstation + 14 server trong report: giữ đúng cấu trúc IP/VLAN/NAT/ACL/VPN, rút gọn số máy trạm thành các PC đại diện. »

### 4.2. Kiến trúc Main Site — "một lối ra duy nhất" (1:00–2:30)

**Thao tác:** double-click **SW-CORE** > CLI > Enter > `enable` > `cisco123`.

```
show ip interface brief
show vlan brief
```

**Kết quả mong đợi:** 6 SVI up/up — Vlan10 10.0.64.1 (/19), Vlan20 10.0.96.1 (/19), Vlan30 10.0.16.1 (/20), Vlan40 10.0.1.1 (/24), Vlan50 10.0.32.1 (/19), Vlan60 10.0.8.1 (/21).

Double-click **R-CORE-MS** > CLI > Enter > `enable` > `cisco123`:

```
show ip dhcp binding
show ip route
```

**Lời thoại:** « SW-CORE là gateway của mọi VLAN (L3 SVI). DHCP không nằm trên switch mà tập trung ở R-CORE-MS — SW-CORE chuyển tiếp DHCP bằng `ip helper-address`. Từ mọi VLAN, đường ra duy nhất là: SW-CORE -> R-CORE-MS -> FW-MAIN -> GW-MAIN -> WAN. Đây là trụ số 1: một lối ra duy nhất, kiểm soát tập trung. »

**Plan B:** nếu `show ip dhcp binding` trống, không sao — chuyển ngay sang KC-1 (PC ping vẫn chứng minh DHCP đã cấp IP đúng dải).

### 4.3. KC-1 — LAN nội bộ Main Site (2:30–4:00)

**Thao tác:** **PC-A1** > Desktop > Command Prompt.

```
ipconfig
ping 10.0.16.2
ping 10.0.16.3
ping 10.0.64.21
ping 10.0.96.21
nslookup his.hospital.local 10.0.16.2
```

**Kết quả mong đợi:** 4/4 với tất cả (cùng VLAN: PC-A1 -> PC-A2; liên VLAN: PC-A1 -> PC-B1 10.0.96.x); nslookup trả `10.0.16.3`.

> **Lưu ý vàng:** IP của từng PC do DHCP cấp nên **thứ tự có thể đổi giữa các lần mở** — hãy đọc `ipconfig` của PC-đích trước khi ping, đừng đọc IP từ kịch bản. IP **server là cố định** (10.0.16.2/.3/.4/.5/.6) nên luôn ping được.

**Lời thoại:** « PC Tòa A và Tòa B khác VLAN (10 vs 20) vẫn ping được — đúng vì inter-VLAN đi qua SVI trên SW-CORE. Tầng 3 này là 'xương sống' giữ trật tự giữa 600 máy trạm thiết kế. DNS nội bộ đặt ở VLAN 30 và trả đúng địa chỉ server nội bộ. »

**Plan B:** nếu ping đầu ném 1 gói (Request timed out) — bình thường, do ARP cold + STP hội tụ trong PT. Gõ lại lệnh ping lần 2, hoặc nói: "gói đầu là ARP, từ gói 2 trở đi 4/4".

**Đo thêm (nếu còn thời gian):** CAM-01 -> `ping 10.0.16.6` (SRV-NVR) chứng minh camera chỉ nói chuyện với NVR.

### 4.4. KC-4 — Wi-Fi khách bị cô lập (4:00–5:30)

**Thao tác:** **LT-GR-MS1** > Desktop > Command Prompt.

```
ipconfig
ping 10.0.64.23
ping 10.0.16.2
ping 198.51.100.10
```

Đọc IP PC-A1 từ `ipconfig` ở KC-1 (đang là 10.0.64.x), thay vào dòng ping đầu.

**Kết quả mong đợi:** `ipconfig` -> 10.0.8.x (VLAN 60); -> PC-A1 **Request timed out (0/4)**; -> SRV-DNS ICMP **0/4** (chỉ mở udp/53, không mở ICMP); -> Internet **4/4**.

Trên **SW-CORE**:

```
show access-lists 150
```

**Lời thoại:** « ACL 150 gắn vào Vlan60 theo chiều in — tức lọc ngay tại nguồn (closest to source). Khách chỉ được: DNS nội bộ (udp/53), web DMZ (tcp 80/443), và Internet. Mọi thứ khác vào 10.0.0.0/8 bị deny. Ping ICMP bị chặn là đúng chính sách — khách vẫn dùng DNS và web bình thường. »

**Plan B:** nếu laptop chưa associate Wi-Fi, mở tab Desktop > PC Wireless > Connect tới SSID của AP-GUEST. Nếu vẫn không lên IP, dùng ảnh `ping_from_guest_to_internal.png`.

### 4.5. KC-5 — DMZ chiều ngược (5:30–6:45)

**Thao tác:** **PC-A1** > Command Prompt:

```
ping 10.0.1.2
```

**Kết quả mong đợi:** 4/4 (LAN -> DMZ thông). Mở **PC-A1 > Desktop > Web Browser**, nhập `http://10.0.1.2` -> hiện trang web của SRV-WEB-DMZ.

Trên **SW-CORE**:

```
show ip access-lists DMZ-IN
```

**Lời thoại:** « DMZ nằm ở VLAN 40 sau firewall. Chiều cho phép là LAN/Internet chủ động vào DMZ (web), còn DMZ **không được** chủ động vào nội bộ: ACL DMZ-IN chỉ mở `established`, một permit DNS, và một permit `echo-reply` để trả lời ping của LAN; còn lại deny vào 10.0.0.0/8. Test ngược bằng MCP (server không có console trong GUI) đã cho DMZ -> LAN 0/4. »

**Plan B:** nếu cần chứng minh chiều ngược live, chạy `pt_verify_connectivity` từ SRV-WEB-DMZ -> 10.0.64.x (MCP), hoặc show ảnh `connect_web_dmz.png` / bảng KC-5 trong evidence.

### 4.6. KC-2 — Liên trạm & failover WAN (6:45–8:30) — ĐIỂM NHẤN

**Ý tưởng trình diễn:** trong lúc cắt đường chính, vẫn ping liên tục từ PC-DBP1 -> HIS để thấy **không mất gói nào**.

**Bước 1 — baseline:** **PC-DBP1** > Desktop > Command Prompt:

```
ipconfig
ping 10.0.16.3
```

**Kết quả:** 4/4. Ghi lại cửa sổ ping để so sánh sau.

**Bước 2 — xác nhận đường chính:** **GW-DBP** > CLI > `enable` > `cisco123`:

```
show ip route 10.0.16.3
traceroute 10.0.16.3
```

**Kết quả:** next-hop hiện tại là **172.17.10.1** (PVC Frame Relay, AD 100); traceroute hop 1 = 172.17.10.1.

**Bước 3 — cắt PVC cả hai đầu:**

- **GW-DBP**: `conf t` -> `interface Serial0/1/0` -> `shutdown`
- **GW-MAIN**: `conf t` -> `interface Serial0/1/0` -> `shutdown`

**Bước 4 — chứng minh backup tiếp quản:** trên **GW-DBP**:

```
ping 172.17.10.1
traceroute 10.0.16.3
```

**Kết quả mong đợi:** ping 172.17.10.1 -> **0/5** (đường chính chết); traceroute -> **hop 1 = 172.18.10.1** (đã rẽ sang Serial backup, AD 200).

**Bước 5 — PC-DBP1 ping lại HIS:** **4/4** — không đứt liên trạm.

**Bước 6 — khôi phục:** trên **GW-DBP** và **GW-MAIN**: `conf t` -> `interface Serial0/1/0` -> `no shutdown`. Ping lại PC-DBP1 -> HIS: **4/4** qua đường chính.

**Lời thoại:** « Hai đường WAN có cùng đích nhưng khác AD: đường Frame Relay chính là AD 100, đường Serial dự phòng là floating static AD 200. Admin distance quyết định: đường nào AD nhỏ hơn vào bảng định tuyến. Khi đường chính chết, AD 200 mới 'nhậm chức' — đây là failover tĩnh, xác định và dễ kiểm chứng. Trong thiết kế thật, hai tuyến là MPLS EPL 300 Mbps còn đây là cách PT cấp L2 leased line. »

**Plan B:** nếu traceroute vẫn chỉ hop 1 = 172.17.10.1 sau khi shutdown, chờ 5–10 giây cho route hội tụ rồi lệnh lại. Nếu backup không nhậm, kiểm tra `show ip route` trên GW-DBP (phải thấy dòng AD 200 qua 172.18.10.1).

### 4.7. KC-3 — Internet: PAT + static NAT (8:30–10:00)

**Thao tác:** **PC-A1** > Command Prompt:

```
ping 198.51.100.10
```

**Kết quả:** 4/4 (ra Internet qua PAT của FW-MAIN).

Trên **FW-MAIN** > CLI > `enable` > `cisco123`:

```
show ip nat translations
show run | include ip nat
```

**Kết quả mong đợi:**
- 1 dòng NAT động (ICMP) vừa sinh ra: inside local 10.0.64.x -> inside global **199.115.1.1** (PAT overload, list 100 -> G0/2).
- 3 dòng static NAT: `199.115.1.1:80 -> 10.0.1.2`, `199.115.1.1:443 -> 10.0.1.2`, `199.115.1.1:25 -> 10.0.1.3`.

**Lời thoại:** « Cả LAN lẫn Wi-Fi khách đều ra Internet qua **một** IP public 199.115.1.1 bằng PAT — nhiều phiên trong, một IP ngoài. IP public đó còn chia sẻ cho DMZ bằng static NAT theo cổng: 80/443 vào web, 25 vào mail. Một IP public, ba dịch vụ — đúng bài 'share IP public'. »

**Plan B:** nếu trình duyệt PT test từ phía Internet không thực hiện được (mô hình chỉ có SRV-INT, không có PC ở dải Internet), trình bày bảng `show ip nat translations` + ảnh `internet_to_webserver.png` làm bằng chứng static NAT. Không cần tạo thiết bị mới trong lúc demo.

### 4.8. KC-7 — VPN mobile chấm trên firewall (10:00–11:30)

**Thao tác:** **LT-MOBILE1** > Desktop > Command Prompt:

```
ipconfig
ping 10.0.16.2
ping 10.0.16.3
```

**Kết quả:** IP 10.127.128.x (LAN nhà); ping SRV-DNS và SRV-HIS **4/4** — đi qua tunnel.

Trên **FW-MAIN**:

```
show ip route
show run | include crypto|isakmp|tunnel
```

**Kết quả mong đợi:** route `10.127.128.0/24 -> 10.254.0.2` (qua Tunnel0); cấu hình crypto map/isakmp hiện diện.

**Lời thoại:** « Đây là trụ số 3: VPN mobile kết thúc **ngay tại firewall**, không đi vào LAN. Tunnel GRE FW-MAIN <-> R-HOME nằm trên overlay 10.254.0.0/30. Crypto map và ISAKMP policy vẫn cấu hình đầy đủ — nói thẳng: trên PT 9.0.1, IKE main-mode không hội tụ với path đa hop có NAT, đây là hạn chế của simulator, không phải sai cấu hình; đường dữ liệu thật trong mô hình chạy bằng GRE. »

**Plan B:** nếu tunnel down, `pt_device_power` reboot lại FW-MAIN + R-HOME (qua MCP) để GRE bắt lại next-hop, hoặc dẫn bảng KC-7 trong evidence.

### 4.9. KC-8 — Failover Internet ISP1 -> ISP2 (11:30–13:00)

**Bước 1 — baseline:**

- **PC-A1**: `ping 198.51.100.10` -> 4/4.
- **LT-MOBILE1**: `ping 10.0.16.2` -> 4/4.
- **PC-DBP1**: `ping 10.0.16.3` -> 4/4.

**Bước 2 — giả lập ISP1 chết:**

- Trên canvas: click **ISP1** > tab **Physical** > tắt công tắc nguồn (nút đỏ).
- Trên **FW-MAIN**: `conf t` -> `no ip route 0.0.0.0 0.0.0.0 199.115.1.2` (thu hồi default chính để floating AD 50 nhậm chức).

**Bước 3 — kiểm chứng:** trên **FW-MAIN**:

```
show ip route
```

**Kết quả mong đợi:** dòng `Gateway of last resort is 199.115.1.3 to network 0.0.0.0` — route dự phòng qua ISP2 (AD 50) đã nhậm chức.

**Bước 4 — đo lại:** **LT-MOBILE1** -> `ping 10.0.16.2` -> **4/4 qua ISP2** (VPN mobile không chết); **PC-DBP1** -> `ping 10.0.16.3` -> **4/4** (liên trạm Frame Relay độc lập với Internet ISP).

**Câu trung thực (nói rõ giới hạn sim):** **PC-A1** -> `ping 198.51.100.10` -> **0/4** — đúng vì dải "Internet" 198.51.100.0/24 chỉ neo sau ISP1; thiết kế thật là 2 AS với full BGP table nên cả hai ISP đều route được.

**Bước 5 — khôi phục:** FW-MAIN: `conf t` -> `ip route 0.0.0.0 0.0.0.0 199.115.1.2`; bật lại nguồn **ISP1**. Ping lại PC-A1 -> 198.51.100.10 = **4/4**.

**Lời thoại:** « Failover Internet dùng floating static AD 50: default chính qua ISP1 (AD 1), default dự phòng qua ISP2 (AD 50). ISP1 chết thì AD 50 vào bảng. Điểm đáng chú ý: **không phải mọi thứ đều đi qua ISP1** — liên trạm đi WAN riêng, VPN mobile đi tunnel và re-route qua ISP2, nên hai dịch vụ trọng yếu vẫn sống. »

**Plan B:** GRE tunnel trong PT không tự chuyển next-hop khi route đổi — nếu mobile ping fail sau failover, reboot FW-MAIN + R-HOME qua `pt_device_power`, rồi ping lại. Nếu thời gian gấp, dẫn bảng KC-8 trong evidence.

### 4.10. KC-6 — Hardening & quản trị (13:00–14:30)

**Thao tác:** **GW-MAIN** > CLI:

```
show running-config | include enable secret|banner|transport|line vty
```

- Nhập `enable` -> mật khẩu `cisco123` -> prompt `GW-MAIN#`. Nhắc: banner MOTD hiển thị khi đăng nhập.

**Test SSH & chặn telnet:** trên **R-CORE-MS** > CLI:

```
ssh -l admin 172.16.0.6
```

-> kết nối SSH thành công (nhập mật khẩu user `admin`). Sau đó:

```
telnet 172.16.0.6
```

-> **bị từ chối** (vì `transport input ssh`).

**Port-security:** trên **SW-BLD-A** > CLI:

```
show port-security interface fastEthernet0/1
```

**Kết quả mong đợi:** Port Status: Secure-up; Violation: Restrict; Sticky MAC đã học.

**Lời thoại:** « Mật khẩu enable được thống nhất thành `cisco123` trên **15 thiết bị IOS** (8 router + 7 switch); hash MD5 `$1$mERr$5.a6P4JqbNiMX01usIfka/` khớp trên cả 15 startup-config — đã kiểm bằng đọc lại config thật. Telnet bị chặn, chỉ SSH; có user local, banner, và port-security sticky/restrict ở 24 cổng access. »

**Plan B:** nếu `ssh` từ R-CORE-MS không kết nối (RSA key chưa sinh sau reboot), chạy `crypto key generate rsa modulus 1024` trên thiết bị đích rồi thử lại — hoặc dẫn `pt_audit_security`.

### 4.11. Bảo mật mở rộng & giám sát (14:30–16:00)

**Thao tác:** trên **SW-CORE**:

```
show access-lists 160
```

**Kết quả:** ACL 160 cho VLAN 50 CCTV chỉ cho camera <-> NVR, deny phần còn lại. Nhắc US-7: camera nằm riêng khỏi mạng truy cập.

**Giám sát:** trên **FW-MAIN** hoặc **R-CORE-MS**:

```
show running-config | include logging|netflow
```

**Lời thoại:** « Ngoài ACL khách, còn ACL cô lập camera: chỉ NVR giao tiếp với camera, không có đường ra Internet. NetFlow và syslog đẩy về SRV-LOG (10.0.16.5) làm nền cho IDS/IPS — đúng yêu cầu 'monitoring' của đề. »

**Plan B:** nếu lệnh `show` trả về ít dòng, dẫn Phụ lục B (best practice) trong report.

### 4.12. Đánh giá & kết (16:00–18:00)

- **Reliability:** 2 đường WAN độc lập + serial backup; 2 ISP failover; (thiết kế thật: core pair).
- **Scalability (upgrade):** VLAN modul hóa; dải /19 //20 //21 //24 tách theo khu vực; trạm phụ /14 dư địa; SD-WAN-ready.
- **Safety & Security:** tách CCTV/guest/MGMT; DMZ + static NAT; ACL least-privilege; hardening; syslog/NetFlow; roadmap thay FW-MAIN bằng NGFW thật (FortiGate 600E).

**Câu kết:** « Tám kiểm chứng KC-1 đến KC-8 đều xanh, và ba trụ yêu cầu của đề đã được trả lời trực tiếp bằng cấu hình thật và số đo live, không phải bằng slide. »

---

## 5. BẢNG PLAN-B (thao tác rủi ro -> cách xử lý -> câu đổ)

| Tình huống | Nguyên nhân | Cách xử lý | Câu nói khi đổ |
|---|---|---|---|
| Ping đầu tiên mất 1 gói | ARP cold / STP hội tụ trong PT | Gõ ping lần 2 | "Gói đầu là ARP, từ gói 2 trở đi 4/4 — hành vi bình thường của simulator." |
| `nslookup` timeout | DNS service chưa bind sau khi reboot server | Chờ 5–10 giây, gõ lại; hoặc ping trực tiếp IP server | "DNS cần vài giây khởi động lại dịch vụ sau reboot." |
| LLaptop không nhận IP Wi-Fi | Chưa associate AP | Desktop > PC Wireless > Connect đúng SSID | "Laptop cần associate lại SSID; đây là bước client, không phải lỗi cấu hình." |
| Tunnel GRE down sau failover | PT: GRE không tự chuyển next-hop khi route đổi | Reboot FW-MAIN + R-HOME (pt_device_power) | "Hạn chế của PT: GRE cần re-establish next-hop; đường dữ liệu vẫn đúng thiết kế." |
| SSH từ router fail | RSA key chưa sinh sau reboot | `crypto key generate rsa modulus 1024` | "RSA key phải sinh lại sau reboot — một bước bảo trì bình thường." |
| Backup không nhậm sau cắt PVC | Route chưa hội tụ | Chờ 5–10 giây; `show ip route` xác nhận AD 200 | "Static route hội tụ tức thời; cho nó một nhịp." |
| Bảng NAT không hiện dòng động | Ping chưa sinh traffic | Ping lại từ PC-A1 | "Bảng NAT chỉ hiện entry khi đã có phiên — ping vừa rồi tạo ra nó." |
| Bất kỳ thao tác live lỗi nặng | - | Dẫn ảnh + file evidence | "Số đo này đã được ghi lại đầy đủ trong evidence; em xin trình bày bảng để đối chiếu." |

---

## 6. BỘ CÂU HỎI THẦY HAY HỎI & ĐÁP CHỐT

1. **Vì sao dùng GRE thay IPsec trong mô hình?** — IKE main-mode của PT 9.0.1 không hội tụ trên path đa hop có NAT (hạn chế simulator). GRE là đường dữ liệu chạy được; crypto map/ISAKMP vẫn cấu hình đầy đủ làm bằng chứng thiết kế.
2. **AD 100 và AD 200 nghĩa là gì?** — Administrative distance: đường chính Frame Relay AD 100, đường Serial backup là floating static AD 200; đường AD nhỏ hơn được ưu tiên, backup chỉ vào RIB khi đường chính chết.
3. **Vì sao VLAN tòa A/B dùng /19 mà không phải /24?** — 600 workstation thiết kế + dư địa tăng trưởng; /19 cho 8.190 host, tách theo khu vực nên vẫn dễ quản lý và tổng hợp route.
4. **Vì sao mô phỏng WAN bằng Frame Relay?** — PT không mô phỏng MPLS EPL; Frame Relay cấp đúng lớp L2 leased line point-to-point để kiểm chứng logic failover. Thiết kế thật là MPLS handoff Ethernet 300 Mbps/trạm.
5. **Trạm phụ không có firewall thì có an toàn không?** — Đúng yêu cầu đề: trạm phụ nằm sau WAN riêng tư (không tin cậy Internet trực tiếp); chính sách tập trung một điểm tại FW-MAIN + ACL trên SW-CORE, dễ kiểm soát và nhất quán.
6. **Một IP public mà phục vụ cả web lẫn mail thế nào?** — Static NAT theo cổng: 199.115.1.1:80/443 -> web DMZ, :25 -> mail DMZ; phần PAT động cho LAN dùng chung IP đó qua overload.
7. **"Một lối ra duy nhất" nghĩa là gì?** — Mọi VLAN -> SW-CORE -> R-CORE-MS -> FW-MAIN -> GW-MAIN -> WAN/Internet; không VLAN nào có đường tắt ra ngoài, nên mọi chính sách đều nằm trên một chặng.
8. **Mật khẩu `cisco123` có phải mật khẩu thật không?** — Là lab password cho mô hình. Triển khai thật phải dùng mật khẩu mạnh + AAA/RADIUS + `enable secret` băm type 8/9, không dùng type 5 (MD5) như PT.
9. **Vì sao DHCP tập trung ở R-CORE-MS mà gateway lại ở SW-CORE?** — SW-CORE làm L3 gateway (SVI) cho fromng VLAN; DHCP server đặt trên R-CORE-MS, SW-CORE dùng `ip helper-address` để chuyển tiếp request — mô hình tập trung, dễ quản trị pool.
10. **Vì sao VLAN CCTV không có đường ra Internet?** — Least privilege: camera chỉ cần nói chuyện với NVR; ACL 160 chỉ mở camera <-> NVR, deny phần còn lại để giảm bề mặt tấn công.
11. **Failover Internet trong mô phỏng khác thực tế thế nào?** — Mô phỏng chỉ có một dải "Internet" neo sau ISP1 nên PC-A1 -> SRV-INT 0/4 khi ISP1 chết; thực tế 2 ISP là 2 AS với full BGP table nên cả hai đều route được. Điểm đúng: mobile + liên trạm vẫn sống.
12. **Vì sao ping đầu tiên đôi khi mất gói?** — ARP cold (chưa có bảng ARP) và STP hội tụ trong PT; đây là đặc tính simulator.

---

## 7. CHECKLIST KHÔI PHỤC SAU DEMO (bắt buộc)

Trước khi rời máy, xác nhận `.pkt` không kết thúc trong trạng thái sự cố:

- [ ] **PVC Frame Relay**: GW-MAIN `show ip interface Serial0/1/0` và `Serial0/1/1` -> up/up; GW-DBP/GW-BHTQ `Serial0/1/0` -> up/up.
- [ ] **Serial backup**: GW-MAIN `Serial0/2/0`, `Serial0/2/1` -> up/up.
- [ ] **ISP1**: đã bật lại nguồn (Physical tab, công tắc xanh).
- [ ] **Default route FW-MAIN**: `show ip route` -> `Gateway of last resort is 199.115.1.2` (ISP1, AD 1); vẫn còn dòng AD 50 qua 199.115.1.3.
- [ ] **Ping hồi phục**: PC-A1 -> 198.51.100.10 = 4/4; PC-DBP1 -> 10.0.16.3 = 4/4; LT-MOBILE1 -> 10.0.16.2 = 4/4.
- [ ] **Health check** (MCP): 0 link đứt, 0 IP trùng.
- [ ] **Lưu file**: File > Save (Ctrl+S). Nếu có MCP: `pt_save_project`.

---

## 8. PHỤ LỤC A — LỆNH NHANH COPY-PASTE

**SW-CORE** (`enable` / `cisco123`):
```
show ip interface brief
show vlan brief
show access-lists 150
show ip access-lists DMZ-IN
show access-lists 160
show port-security interface fastEthernet0/1
```

**R-CORE-MS**:
```
show ip dhcp binding
show ip route
ssh -l admin 172.16.0.6
telnet 172.16.0.6
```

**FW-MAIN**:
```
show ip nat translations
show ip route
show run | include ip nat
show run | include route|crypto|isakmp|tunnel
conf t
no ip route 0.0.0.0 0.0.0.0 199.115.1.2
ip route 0.0.0.0 0.0.0.0 199.115.1.2
```

**GW-DBP** (KC-2):
```
show ip route 10.0.16.3
traceroute 10.0.16.3
ping 172.17.10.1
conf t
interface Serial0/1/0
 shutdown
 no shutdown
```

**GW-MAIN**:
```
show running-config | include enable secret|banner|transport
conf t
interface Serial0/1/0
 shutdown
 no shutdown
```

**PC-A1 / PC-B / PC-DBP1 / PC-BHTQ1 / LT-GR-MS1 / LT-MOBILE1** (Desktop > Command Prompt):
```
ipconfig
ping 10.0.16.2
ping 10.0.16.3
ping 198.51.100.10
nslookup his.hospital.local 10.0.16.2
tracert 10.0.16.3
```
**Web Browser (PC-A1):** `http://10.0.1.2`

**Tắt/bật nguồn ISP1:** click ISP1 > tab Physical > công tắc nguồn.

---

## 9. PHỤ LỤC B — BẢNG TRA NHANH IP & KÊNH WAN

**VLAN / dải LAN (Main Site):**

| VLAN | Tên | Dải | Gateway (SW-CORE) |
|---|---|---|---|
| 10 | DEPT-A (Tòa A) | 10.0.64.0/19 | 10.0.64.1 |
| 20 | DEPT-B (Tòa B) | 10.0.96.0/19 | 10.0.96.1 |
| 30 | SERVER-FARM | 10.0.16.0/20 | 10.0.16.1 |
| 40 | DMZ | 10.0.1.0/24 | 10.0.1.1 |
| 50 | CCTV | 10.0.32.0/19 | 10.0.32.1 |
| 60 | WIFI-GUEST | 10.0.8.0/21 | 10.0.8.1 |

**Server cố định (ping được):**

| Thiết bị | IP | Thiết bị | IP |
|---|---|---|---|
| SRV-DNS | 10.0.16.2 | SRV-WEB-DMZ | 10.0.1.2 |
| SRV-HIS | 10.0.16.3 | SRV-MAIL-DMZ | 10.0.1.3 |
| SRV-PACS | 10.0.16.4 | SRV-INT | 198.51.100.10 |
| SRV-LOG | 10.0.16.5 | SRV-DBP-1 | 10.128.0.10 |
| SRV-NVR | 10.0.16.6 | SRV-BHTQ-1 | 10.132.0.10 |

**Trạm phụ & home:** DBP LAN 10.128.0.0/14 (GW 10.128.0.1) · BHTQ LAN 10.132.0.0/14 (GW 10.132.0.1) · Home 10.127.128.0/24 (GW 10.127.128.1).

**Kênh WAN / Internet:**

| Kênh | Đầu A | Đầu B | Vai trò |
|---|---|---|---|
| PVC Main-DBP | GW-MAIN S0/1/0 172.17.10.1 (DLCI 110) | GW-DBP S0/1/0 172.17.10.2 (DLCI 101) | Chính, AD 100 |
| PVC Main-BHTQ | GW-MAIN S0/1/1 172.17.20.1 (DLCI 120) | GW-BHTQ S0/1/0 172.17.20.2 (DLCI 102) | Chính, AD 100 |
| Serial backup DBP | GW-MAIN S0/2/0 172.18.10.1 | GW-DBP S0/1/1 172.18.10.2 | Floating AD 200 |
| Serial backup BHTQ | GW-MAIN S0/2/1 172.18.20.1 | GW-BHTQ S0/1/1 172.18.20.2 | Floating AD 200 |
| Internet ISP1 | FW-MAIN 199.115.1.1 | ISP1 199.115.1.2 | Default chính (AD 1) |
| Internet ISP2 | FW-MAIN 199.115.1.1 | ISP2 199.115.1.3 | Default dự phòng (AD 50) |
| Overlay GRE | FW-MAIN Tunnel0 10.254.0.1 | R-HOME Tunnel0 10.254.0.2 | VPN mobile |

---

*Kịch bản soạn cho demo viva BTL2 — Mạng máy tính, HCMUT. Số liệu và cấu hình trong tài liệu này khớp với `simulation/CCC-Hospital-v2.pkt` và `docs/ptbuild/CCC-Hospital-v2/evidence-2026-11-11.md`.*
