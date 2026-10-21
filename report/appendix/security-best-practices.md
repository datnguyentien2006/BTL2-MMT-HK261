# PHỤ LỤC B — CẨM NANG BEST PRACTICE BẢO MẬT (Bệnh viện CCC-Hospital)

> Áp dụng cho cả thiết kế thật (FortiGate/Catalyst/ISR) và cấu hình hardening trong mô hình
> Packet Tracer. Mỗi mục gồm: mục tiêu, biện pháp thực hiện, cách kiểm tra.

---

## B.1 Danh mục best practice (14 mục)

### 1) Chính sách mật khẩu & tài khoản

- Độ dài tối thiểu **12 ký tự**, phức tạp (hoa/thường/số/ký tự đặc biệt), không dùng mật khẩu chung.
- Router/switch: `enable secret` (bắt buộc, **không** dùng `enable password`), cấm `no service password-recovery` nếu cần kiểm soát vật lý.
- Storage password bằng **Type 8/9 (scrypt)**; từ chối Type 7 (dễ reverse); bật `service password-encryption` như lớp phụ.
- Bắt buộc đổi mật khẩu 90 ngày, khoá tài khoản sau 5 lần sai, không cho tái sử dụng 5 mật khẩu gần nhất.

### 2) Chỉ SSH, tắt Telnet

```ios
line vty 0 4
  exec-timeout 10 0
  logging synchronous
  transport input ssh
  login local
ip ssh time-out 30
ip ssh authentication-retries 3
ip ssh version 2
crypto key generate rsa modulus 2048 label SSH-KEY
```

- Telnet **disable toàn thiết bị** (`transport input ssh`); HTTP/HTTPS server tắt nếu không dùng (`no ip http server`).

### 3) Banner cổng vào (legally-bounded access)

```ios
banner login ^CCC
!! CANH BAO: He thong dich vu Y te - Chi danh cho nhan vien duoc phep truy cap !!
Truy cap khong phep se bi luu log va xu ly theo quy dinh noi bo & phap luat.
^
```

- Thêm `banner motd` khi bảo trì; banner phải nêu rõ *truy cập bị giám sát* (pháp lý).

### 4) Tài khoản quản trị phân quyền (RBAC)

- Dùng **users local + privilege level**: `privilege 15` cho admin, `privilege 1–5` cho helpdesk; đặt tên riêng theo người (ví dụ `admin-vtn`), không dùng account generic `admin`.
- AAA về TACACS+/RADIUS (ISE/FreeRADIUS) khi mở rộng; backup tài khoản local.
- SSH quản lý (vty) giới hạn theo ACL — chỉ VLAN 10 MGMT.

### 5) Port-security trên switch access

```ios
interface range Gi0/1-24
  switchport mode access
  switchport access vlan 30
  switchport port-security
  switchport port-security maximum 2
  switchport port-security violation restrict
  switchport port-security mac-address sticky
  spanning-tree portfast
exit
```

- max-mac 2 cho PC (PC + softphone), 4 cho PoE AP, 1 cho printer.
- `violation restrict` + gửi SNMP trap/syslog; review `show port-security violation` hàng tuần.

### 6) DHCP Snooping + Dynamic ARP Inspection (DAI)

```ios
ip dhcp snooping
ip dhcp snooping vlan 10,20,30,40,50,60,61,63,71,73
!
interface Gi0/24              ! trunk uplink về core = trusted
  ip dhcp snooping trust
exit
!
ip arp inspection vlan 10,20,30,40,50,60,61,63,71,73
interface Gi0/24
  ip arp inspection trust
exit
ip source binding 001A.A1B2.C3D4 vlan 30 Gi0/5
```

- Chặn rogue DHCP server và giả mạo ARP (gateway spoofing); kèm `ip verify source` (IP Source Guard).

### 7) ACL least-privilege — đặc biệt Wi-Fi khách

- VLAN 60/63/73 (guest) chỉ được: **DNS nội bộ (UDP/TCP 53 → 10.10.10.10)**, **HTTP/HTTPS đến web DMZ (10.10.200.10)** và **default out Internet (NAT PAT)**.
- **Deny all** về dải nội bộ `10.10.0.0/16`, `10.11.0.0/16`, `10.12.0.0/16`, VLAN 20, VLAN 50 (CCTV), VLAN 10 (MGMT); cuối ACL `deny ip ... log` để audit.
- ACL đặt closest-to-source trên R-CORE-MS subinterface VLAN 60/63/73 (hoặc trên NGFW policy).

### 8) Phân đoạn VLAN / micro-segmentation

- Bảng VLAN chốt: MGMT 10 / SERVER-FARM 20 / DEPT-A 30 / DEPT-B 40 / CCTV 50 / GUEST 60 / DMZ 200 + DBP 61/62/63 + BHTQ 71/72/73.
- **VLAN MGMT không có gateway đi ra Internet**; chỉ permit từ trạm quản trị & jump host.
- VLAN 20 (server farm) chỉ permit port dịch vụ cụ thể (HIS 8080/443, DB 1521, DNS 53, syslog 514/9995) từ VLAN 30/40/61/71 + DMZ trả lời stateful; deny else.
- Đóng giao VLAN↔VLAN không cần thiết (chặn vlan-1 không dùng, CDP chỉ bật lênlink).

### 9) DMZ, NAT & stateful firewall

- DMZ VLAN 200: **static NAT 1:1 203.0.115.10 → 10.10.200.10**; ACL ONLY 80/443 (web), 25/587 (mail) từ Internet.
- **Không cho DMZ khởi tạo kết nối vào LAN** — chỉ permit reply/reset; mail server chỉ được relay qua SMTP gateway hợp lệ (kết nối TLS tới relay nội bộ).
- Trên thiết bị thật: NGFW (FortiGate/Palo Alto/ASA) thay R-EDGE-MS với **intrusion prevention, web app firewall (WAF), SSL inspection**.

### 10) IDS/IPS — giai đoạn & lộ trình

- **Stage 1 (hiện tại/mô phỏng):** syslog + NetFlow về SRV-LOG — phân tích bất thường bằng script/SIEM gửi cảnh báo (detection-based, "IDS giả lập").
- **Stage 2:** đặt IPS inline trên NGFW giữa Core↔Internet+DMZ; signature auto-update; policy: alert cho traffic lạ, block cho mức high/critical.
- **Stage 3:** SIEM đầy đủ (Wazuh/Splunk/Sigma/Elastic IR), correlation: syslog+NetFlow+AD log+VPN log; runbook IR (phản hồi sự cố) cho bệnh viện 24/7.

### 11) Đào tạo nâng cao nhận thức (phishing/social engineering)

- Campaign nội bộ 2 lần/năm: email giả mạo (phishing drill), báo cáo vào helpdesk; nội dung cụ thể y tế: *giả mạo email nhân viên gửi file "đơn thuốc/BHYT" nâng quyền*.
- Bật **MFA** cho mọi tài khoản VPN/email/jump host; hướng dẫn nhân viên lưu mật khẩu ở password manager, không lưu trong email/file nội bộ.
- Poster/hướng dẫn tại phòng: quy tắc USB (không cắm USB lạ vào máy trạm HIS), thoát app, khóa màn hình.

### 12) Backup 3-2-1 và DR cho y tế

- **3-2-1-1-0:** 3 bản, 2 loại media, 1 bản offsite (DR site), 1 bản immutable/air-gap (WORM), 0 lỗi kiểm tra.
- **RTO/RPO:** HIS **RTO ≤ 4 h, RPO ≤ 15 phút** (theo SLA bệnh viện hạng lớn); PACS **RPO ≤ 24 h** (lưu trữ hình ảnh thời gian dài); diễn tập RTO 2 lần/năm.
- Backup tách VLAN/policy VLAN 20 riêng, tài khoản backup không dùng domain admin; kiểm tra restore định kỳ (đề mục "0").

### 13) Patch & quản lý cấu hình

- Change tracking: Git cho cấu hình (Oxidized/RANCID) — mỗi thay đổi có review; **hàng tuần** review config-backup.
- Chu kỳ patch: routers/switches tuân thủ security advisory hàng quý; server Windows vá hàng tháng; firmware NGFW/AP cập nhật <30 ngày từ CVE công bố.
- Cấu hình chuẩn hoá bằng **golden template** + compliance check (ví dụ: disable unused services, shut unused ports).

### 14) Monitoring: syslog / NetFlow / SNMP

- Syslog gửi về SRV-LOG (UDP 514 + TLS nếu có), định mức log: login/privilege escalation/port-security/VPN/denied ACL; đồng bộ giờ NTP từ server nội bộ (không đi ra Internet).
- NetFlow (Flexible NetFlow v9/IPFIX) từ R-EDGE-MS + core switch → phân tích baseline lưu lượng, phát hiện exfiltration (tăng traffic bất thường lúc 2h sáng).
- SNMPv3 (authPriv, AES-128/SHA) + Zabbix/PRTG; hạn chế SNMPv2c; trap alert (link-down, CPU 80%, đĩa >85%, camera offline NVR).
- Monitor: uptime core/edge, VPN tunnel state, OSPF neighbor, ISP latency, UPS, NVR FPS, server HIS response time.

---

## B.2 Ma trận policy theo vùng (baseline)

| Policy control | DMZ (VLAN 200) | Server-Farm (VLAN 20) | LAN nhân viên (30/40) | LAN trạm phụ (61/71) | Guest (60/63/73) | CCTV (50) | MGMT (10) |
|---|---|---|---|---|---|---|---|
| Internet truy xuất (inbound) | chỉ 80/443/25/587 qua static NAT | không | không | không | không | không | không |
| Internet outbound | khống chế (web/mail ra nguồn hợp lệ) | theo whitelist | permit NAT PAT | qua Main → NAT | permit NAT PAT | trực tiếp Internet không cho phép | không |
| Truy cập LAN nội bộ | **deny trường tạo kết nối vào LAN** | permit dịch vụ cụ thể từ 30/40/61/71 | peer-to-peer deny; tới VLAN 20 theo port | tới VLAN 20 theo port | **deny toàn LAN** (chỉ DNS + web DMZ) | deny, chỉ NVR ↔ camera | tất cả là whitelist |
| Truy cập CCTV | deny | NVR hợp lệ | deny | deny | deny | trong segment riêng | permit giám sát |
| DHCP | static | static | pool + snooping | pool+snooping | pool Guest rate-limit | static | static |
| Port-security max-MAC | 2 | 1 | 2 | 2 | 1 | 3 | 1 |
| AAA/SSH | chỉ SSH v2 + DMZ ACL riêng | SSH + MGMT ACL | SSH (MGMT ACL) | SSH (MGMT ACL) | không quản trị | SSH | SSH + jump host |
| Log | syslog + NetFlow | syslog | syslog | syslog | log đầy đủ | syslog | syslog full |
| IDS/IPS stage | NGFW IPS + WAF | NetFlow anomaly | NetFlow | NetFlow | tập trung log | NetFlow | alert priority P1 |

---

## B.3 Hardening checklist (áp dụng trong mô phỏng Packet Tracer)

```ios
enable secret 5 <hash>
service password-encryption
no service password-recovery          ! cân nhắc bảo mật vật lý theo chính sách
line console 0
  exec-timeout 15 0
  login local
line vty 0 4
  exec-timeout 10 0
  transport input ssh
exit
username admin-vtn privilege 15 secret 9 <hash>
username helpdesk privilege 1 secret 9 <hash>
no ip http server
no ip http secure-server
no cdp run                            ! chỉ bật cdp trên uplink nếu cần
ip domain-name hospital.local
crypto key generate rsa modulus 2048
banner login @...@                     ! banner như mục B.1-3
```

- Switch access: hạn chế trunk, chỉ trunk các VLAN được phép; VLAN 1 không dùng → dùng Native VLAN khác (VLAN 999, shut).
- Checklist kiểm bằng `pt_audit_security` (mô phỏng PT) hoặc audit script thật sau khi config.

---

## B.4 Sơ đồ luồng log & monitoring (tóm tắt)

```
IP camera x N ─┐
NVR ────────── VLAN 50 ──┐
Access switch ─TRUNK─┐   │
R-CORE-MS ─┐         │   │
R-WAN-MS  ─┤         │   │
R-EDGE-MS ─┤  syslog (UDP 514) + NetFlow (v9) ──► SRV-LOG  ──► SIEM/Alert (email/SMS)
L3 switch  ─┘                                 └─► Zabbix (SNMPv3) ──► Dashboard NOC 24/7
NGFW (thực tế) ─ bổ sung log ──► SRV-LOG
```

> Tài liệu này dùng chung cho thiết kế thật & mô phỏng; mục B.3 là phần hardening
> thực hiện trên Packet Tracer (phù hợp mô hình), phần còn lại hướng dẫn triển
> khai trên thiết bị thật.
