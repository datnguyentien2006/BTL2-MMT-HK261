# PHỤ LỤC A — CẤU HÌNH VPN ĐỀ XUẤT (thiết bị THẬT)

> **Lưu ý quan trọng:** Các cấu hình dưới đây là **cấu hình mẫu cho thiết bị vật lý thật**
> (ISR 4331 / ISR 4451 / NGFW) theo thiết kế Step 1–3. Đây **KHÔNG phải cấu hình đang chạy
> trong mô hình Packet Tracer hiện tại** — Packet Tracer không hỗ trợ đầy đủ
> crypto isakmp/IPsec/GRE. Trong mô phỏng, đường liên trạm dùng PVC Frame Relay + serial
> backup với static route AD 100/200; VPN/IPsec chỉ được **thiết kế ở đây để triển khai thực tế**.
>
> **Bảng IP áp dụng:** Phụ lục này viết theo **bảng IP chốt v3 (dải 10.x, 2026-11-11)** —
> giống hệt mô hình Packet Tracer (§2.2/§5.4 báo cáo chính): Main `10.0.64.0/19` (Tòa A),
> `10.0.96.0/19` (Tòa B), `10.0.16.0/20` (server farm), `10.0.1.0/24` (DMZ), `10.0.32.0/19`
> (CCTV), `10.0.8.0/21` (guest); DBP `10.128.0.0/14`; BHTQ `10.132.0.0/14`; WAN EPL
> `172.17.10.0/30` + `172.17.20.0/30`; serial backup `172.18.10.0/30` + `172.18.20.0/30`;
> teleworker home LAN `10.127.128.0/24`. Trong file `.pkt` các dải WAN mô phỏng bằng Frame
> Relay; GRE overlay `10.254.0.0/30` kết thúc tại FW-MAIN.
>
> Tham số dùng theo bảng IP đã chốt:
> - Key chung: `HOSP2026` (ISAKMP pre-shared key — khi vận hành thật nên thay bằng key mạnh, duy nhất cho từng peer và xoay vòng định kỳ)
> - Peers Ethernet EPL: R-WAN-MS `172.17.10.1` ↔ R-DBP `172.17.10.2`; R-WAN-MS `172.17.20.1` ↔ R-BHTQ `172.17.20.2`
> - Peers serial backup: R-WAN-MS `172.18.10.1` ↔ R-DBP `172.18.10.2`; R-WAN-MS `172.18.20.1` ↔ R-BHTQ `172.18.20.2`
> - Mạng hứng thú (interesting traffic): Main `10.0.0.0 0.63.255.255` ↔ DBP `10.128.0.0 0.3.255.255`, Main ↔ BHTQ `10.132.0.0 0.3.255.255`
> - Home LAN teleworker: `10.127.128.0/24`

---

## A.1 Site-to-Site IPsec thuần (ACL-based, cổ điển) — R-WAN-MS ↔ R-DBP

Phù hợp khi không muốn chạy GRE; IPsec chỉ bảo vệ traffic Main (`10.0.0.0 0.63.255.255`) ↔ DBP (`10.128.0.0 0.3.255.255`).
Vấn đề: OSPF multicast `224.0.0.5` không đi qua IPsec thuần ⇒ cần static route song song.
(Variant GRE-over-IPsec / SVTI ở A.2 khắc phục điều này.)

```ios
! ==================== R-WAN-MS (Main) ====================
enable
configure terminal
hostname R-WAN-MS

! --- 1) IKE phase 1 (ISAKMP) ---
crypto isakmp enable
crypto isakmp policy 10
  encr aes 256
  authentication pre-share
  group 14
  lifetime 86400
  hash sha256
exit
crypto isakmp key HOSP2026 address 172.17.10.2         ! peer R-DBP (EPL)
crypto isakmp key HOSP2026 address 172.18.10.2         ! peer R-DBP (serial backup)
crypto isakmp key HOSP2026 address 172.17.20.2         ! peer R-BHTQ (EPL)
crypto isakmp key HOSP2026 address 172.18.20.2         ! peer R-BHTQ (serial backup)

! --- 2) IKE phase 2 (transform-set) ---
crypto ipsec transform-set TS-AES256SHA256 esp-aes 256 esp-sha-hmac
  mode tunnel
exit

! --- 3) ACL "interesting traffic" ---
ip access-list extended VPN-INTERESTING-DBP
  permit ip 10.0.0.0 0.63.255.255 10.128.0.0 0.3.255.255
exit
ip access-list extended VPN-INTERESTING-BHTQ
  permit ip 10.0.0.0 0.63.255.255 10.132.0.0 0.3.255.255
exit

! --- 4) Crypto map ---
crypto map CMAP-VPN 10 ipsec-isakmp
  set peer 172.17.10.2
  set peer 172.18.10.2
  set security-association lifetime seconds 3600
  set transform-set TS-AES256SHA256
  match address VPN-INTERESTING-DBP
exit
crypto map CMAP-VPN 20 ipsec-isakmp
  set peer 172.17.20.2
  set peer 172.18.20.2
  set security-association lifetime seconds 3600
  set transform-set TS-AES256SHA256
  match address VPN-INTERESTING-BHTQ
exit

! --- 5) Gắn crypto map lên các interface WAN ---
interface GigabitEthernet0/0/1
  ip address 172.17.10.1 255.255.255.252
  crypto map CMAP-VPN
exit
interface GigabitEthernet0/0/2
  ip address 172.17.20.1 255.255.255.252
  crypto map CMAP-VPN
exit
interface Serial0/1/0        ! NIM-2T; backup path cũng dùng chung CMAP
  ip address 172.18.10.1 255.255.255.252
  crypto map CMAP-VPN
exit
interface Serial0/2/0
  ip address 172.18.20.1 255.255.255.252
  crypto map CMAP-VPN
exit

! --- 6) Loại trừ VPN khỏi NAT (role này thực tế để NGFW đảm nhiệm; nếu device này làm NAT Internet thì cần NAT-exemption cho dải VPN) ---
! (Thiết kế thật: NAT/PAT giao cho NGFW phía Internet, R-WAN-MS chỉ làm routing/VPN hub) ---

! --- 7) Lưu & kiểm tra ---
end
write memory
crypto isakmp sa
crypto ipsec sa
show crypto isakmp sa
show crypto ipsec sa | include pkts
```

```ios
! ==================== R-DBP (trạm phụ) ====================
crypto isakmp enable
crypto isakmp policy 10
  encr aes 256
  authentication pre-share
  group 14
  lifetime 86400
  hash sha256
exit
crypto isakmp key HOSP2026 address 172.17.10.1
crypto isakmp key HOSP2026 address 172.18.10.1

crypto ipsec transform-set TS-AES256SHA256 esp-aes 256 esp-sha-hmac
  mode tunnel
exit

ip access-list extended VPN-INTERESTING-MAIN
  permit ip 10.128.0.0 0.3.255.255 10.0.0.0 0.63.255.255
exit

crypto map CMAP-VPN 10 ipsec-isakmp
  set peer 172.17.10.1
  set peer 172.18.10.1
  set security-association lifetime seconds 3600
  set transform-set TS-AES256SHA256
  match address VPN-INTERESTING-MAIN
exit

interface GigabitEthernet0/1
  ip address 172.17.10.2 255.255.255.252
  crypto map CMAP-VPN
exit
interface Serial0/0/0
  ip address 172.18.10.2 255.255.255.252
  crypto map CMAP-VPN
exit
end
write memory
```

> Cấu hình **R-BHTQ** đồng luận với R-DBP: đổi ACL thành `10.132.0.0 0.3.255.255 + Main`,
> peer `172.17.20.1` / `172.18.20.1`, IP WAN của trạm `172.17.20.2` / `172.18.20.2`.

---

## A.2 Variant khuyến nghị: **GRE (SVTI) over IPsec** — chèn OSPF/lộ đầy đủ

GRE-over-IPsec là chuẩn khuyến nghị vì:
- OSPF multicast chạy được trong tunnel (không cần static route song song như A.1);
- Hỗ trợ **routing động chạy bên trong IPsec** + headroom cho SD-WAN overlay sau này (tunnel → cài BGP/BFD);
- Mỗi site một tunnel point-to-point dạng SVTI (Static Virtual Tunnel Interface) — đơn giản
  hơn crypto-map ACL, trạng thái up/down gắn với interface, dễ monitor.

```ios
! ==================== R-WAN-MS (Main) — SVTI ====================
crypto isakmp enable
crypto isakmp policy 10
  encr aes 256
  authentication pre-share
  group 14
  lifetime 86400
  hash sha256
exit
crypto isakmp key HOSP2026 address 172.17.10.2
crypto isakmp key HOSP2026 address 172.17.20.2

crypto ipsec transform-set TS-AES256SHA256 esp-aes 256 esp-sha-hmac
  mode tunnel
exit

! --- SVTI tunnel tới R-DBP ---
interface Tunnel10
  description "SVTI to R-DBP via EPL"
  ip address 172.16.10.1 255.255.255.252
  ip mtu 1400
  ip tcp adjust-mss 1360
  tunnel source GigabitEthernet0/0/1            ! 172.17.10.1
  tunnel destination 172.17.10.2
  tunnel mode ipsec ipv4
  tunnel protection ipsec profile PROF-SVTI
exit
! --- SVTI tunnel tới R-BHTQ ---
interface Tunnel20
  description "SVTI to R-BHTQ via EPL"
  ip address 172.16.10.5 255.255.255.252
  ip mtu 1400
  ip tcp adjust-mss 1360
  tunnel source GigabitEthernet0/0/2            ! 172.17.20.1
  tunnel destination 172.17.20.2
  tunnel mode ipsec ipv4
  tunnel protection ipsec profile PROF-SVTI
exit

crypto ipsec profile PROF-SVTI
  set transform-set TS-AES256SHA256
exit

! --- OSPF chạy trong tunnel ---
router ospf 1
  network 172.16.10.0 0.0.0.3 area 1            ! DBP area
  network 172.16.10.4 0.0.0.3 area 2            ! BHTQ area
exit
```

### A.3 Vai trò với serial backup

- Tunnel backup thứ hai (Tunnel11/Tunnel21): source là interface serial, destination là IP serial
  của peer; OSPF cost cao hơn (bandwidth thấp) hoặc dùng `ip ospf cost 2000`,
  đảm bảo khi EPL đứt, OSPF tự chuyển sang serial — **khuyến nghị đặt sẵn cấu hình từ đầu**.

```ios
interface Tunnel11
  description "SVTI backup to R-DBP via serial"
  ip address 172.16.10.9 255.255.255.252
  ip mtu 1400
  ip tcp adjust-mss 1280
  ip ospf cost 2000
  tunnel source Serial0/1/0
  tunnel destination 172.18.10.2
  tunnel mode ipsec ipv4
  tunnel protection ipsec profile PROF-SVTI-BACKUP
exit
crypto ipsec profile PROF-SVTI-BACKUP
  set transform-set TS-AES256SHA256
  set pfs group14
exit
```

> **SD-WAN readiness:** GRE/SVTI/IPsec hiện đã sẵn sàng → khi triển khai Catalyst SD-WAN /
> FortiGate ADVPN, tunnel IPsec chính là **transport cho overlay**; chỉ cần bổ sung BGP/BFD
> hoặc OMP. Không cần thay đổi cấu trúc IP WAN.

---

## A.4 Teleworker VPN (Home LAN 10.127.128.0/24)

### A.4.1 Phương án (a) — Remote-access IPsec theo chuẩn IOS (EzVPN legacy / NAT-T)

Client VPN tool cũ (Cisco VPN Client, iOS VPN config, hoặc OS X IKEv2):
Gateway: R-EDGE-MS (thiết bị thật là NGFW) hoặc R-WAN-MS, mở cổng udp/500 + udp/4500 (IPsec NAT-T).

```ios
! ============ R-EDGE-MS (thiết bị thật: NGFW đảm nhiệm vai này; dưới đây là thể hiện IOS) ============
! --- 1) ISAKMP client ---
crypto isakmp enable
crypto isakmp policy 20
  encr aes 256
  authentication pre-share
  group 14
  lifetime 86400
  hash sha256
exit
crypto isakmp key 0 HOSP2026 address 0.0.0.0 0.0.0.0          ! legacy EzVPN: key chung
crypto isakmp client configuration group TELEWORKER
  key HOSP2026
  dns 10.0.16.2                                               ! SRV-DNS (VLAN 30)
  domain hospital.local
  pool VPN-POOL
  netmask 255.255.255.0
  acl 120
exit

! --- 2) Pool IP cho client ---
ip local pool VPN-POOL 10.127.129.10 10.127.129.99            ! tách VLAN/phân đoạn riêng thực tế VPN pool (kề dải mobile 10.127.128.0/24)

! --- 3) ACL push cho client: only internal ---
access-list 120 permit ip 10.0.0.0 0.63.255.255 any           ! → chỉ nhét route internal về client

! --- 4) Transform + crypto map (mode cisco / EzVPN) ---
crypto ipsec transform-set TS-TELE esp-aes 256 esp-sha-hmac
  mode tunnel
exit
crypto dynamic-map DMAP-TELE 10
  set transform-set TS-TELE
  reverse-route
exit
crypto map CMAP-CRYPTO 100 ipsec-isakmp
  set peer dynamic DMAP-TELE
  set transform-set TS-TELE
  match address VPN-REMOTE
  crypto isakmp client configuration group TELEWORKER
exit

ip access-list extended VPN-REMOTE
  permit ip 10.0.0.0 0.63.255.255 10.127.129.0 0.0.0.255
exit
! --- 5) NAT-T (giữ được qua home router NAT) ---
! IOS tự bật IPsec/NAT-T (udp/4500) theo mặc định khi khớp.

! --- 6) Gắn crypto map lên interface Internet ---
interface GigabitEthernet0/0
 crypto map CMAP-CRYPTO
end
write memory
```

> **Lưu ý NAT-T (RFC 3947-3948):** IPsec ngang qua **NAT home** — bật NAT-T (UDP 4500)
> hoặc UDP-encapsulated ESP; đa số home router/NAT PAT hiện hỗ trợ.
> EzVPN (Cisco VPN Client) là cơ chế legacy — Packet Tracer không hỗ trợ native, không khuyến nghị:
> client kết nối bằng Cisco Secure Client với IKEv2/IPsec hoặc gói GRE từ Home LAN để kiểm chứng.
> bằng GRE/trace từ home.

### A.4.2 Phương án (b) — Đề xuất triển khai: **SSL/TLS VPN AnyConnect trên NGFW**

Đây là phương án **khuyến nghị cho triển khai thực tế** (phương án A.4.1 giữ lại với vai trò
backup/chuẩn cơ sở):

| Mục | Mô tả |
|---|---|
| Thiết bị | NGFW (FortiGate 600E pair) đặt tại Main Site, song song với R-EDGE-MS/ISP1 |
| Cơ chế | SSL VPN/TLS 1.3 (TCP 443) hoặc IKEv2/IPsec (kèm NAT-T); FortiGate gọi SSL-VPN, Palo Alto GlobalProtect, Cisco ASA/FTD gọi AnyConnect |
| Client | Cisco Secure Client (AnyConnect) / FortiClient VPN — có VPN-only module, chạy qua NAT 4G/khách sạn/home router |
| Nhận định | TLS VPN chỉ cần **TCP 443** — qua mọi NAT/proxy; IKEv2 + NAT-T tốt hơn cho mobile/cellular |

Cấu hình mẫu ví dụ trên FortiGate (chỉ minh hoạ):

```
config vpn ssl settings
  set tunnel-ip-pools "VPN-POOL-TLW"
  set dns-servers 10.0.16.2
  set source-interface "port-WAN-ISP1" "port-WAN-ISP2"
  set port 443
end
config user group
  edit "GRP-TELEWORKER"
    set member "local-user-bs-truc" "remote-ldap-AD"
  next
end
config firewall policy
  edit 90
    set name "SSLVPN-to-LAN"
    set srcintf "tunnel-sslvpn" set dstintf "trunk-core"
    set srcaddr "VPN-POOL-TLW" set dstaddr "10.0.0.0-8"
    set action accept set schedule "always" set service "ANY"
    set logtraffic all
  next
end
```

Đề xuất bổ sung: **OTP/2FA** (email/SMS) + group policy theo AD/LDAP, chỉ cấp
route tới VLAN 10 / 20 / 30 (HIS/PACS đặt VLAN 30), tách kho IPv4 pool riêng 10.127.129.0/24, chính sách
"VPN-only" (full-tunnel bắt buộc, không split-tunnel cho data nội bộ), audit session log.

---

## A.5 Danh sách dùng được theo kênh

| Kênh | Đã cấu hình tại | Ghi chú |
|---|---|---|
| Main ↔ DBP | A.1 (IPsec thuần) / A.2 (SVTI GRE) | Cả 2 variant sẵn |
| Main ↔ BHTQ | A.1 / A.2 | Như trên (tương tự cấu hình DBP) |
| Serial backup | A.2 — Tunnel11/21 | OSPF cost cao |
| Teleworker | A.4.1 (IOS IPsec/NAT-T) + A.4.2 (TLS AnyConnect trên NGFW, khuyến nghị) | Home LAN 10.127.128.0/24 |

**Chung:** khi triển khai trên thiết bị thật, **xác nhận lại bảng IP chốt** (mục §2.2
báo cáo chính), chạy `show crypto isakmp sa` / `show crypto ipsec sa peer <IP>`; log
crypto → SRV-LOG (syslog) và NetFlow có tag VPN-DSCP.
