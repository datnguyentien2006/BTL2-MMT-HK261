# PHỤ LỤC C — CHECKLIST KIỂM THỬ VÀ BẰNG CHỨNG CỦA B3

## C.1 Guest Wi-Fi isolation

Thực hiện trên một PC thuộc VLAN Guest tại Main, DBP và BHTQ.

| Trường hợp            | Lệnh/Ping                                      | Kết quả mong đợi                                         | Screenshot                     |
| --------------------- | ---------------------------------------------- | -------------------------------------------------------- | ------------------------------ |
| Main → DNS            | `ping 10.0.16.2` hoặc truy cập DNS            | Thành công nếu dịch vụ DNS hoạt động                     | `TC-B3-GUEST-MS-DNS.png`       |
| Main → web DMZ        | `ping 10.0.1.2` / mở HTTP                     | Ping có thể bị chặn; truy cập HTTP/HTTPS phải thành công | `TC-B3-GUEST-MS-DMZ.png`       |
| Guest → LAN nhân viên | `ping 10.0.64.x` hoặc `10.0.96.x`             | Timeout, ACL `deny log`                                  | `TC-B3-GUEST-MS-LAN-DENY.png`  |
| Guest → CCTV          | `ping 10.0.32.x`                              | Timeout, ACL không cho truy cập CCTV                     | `TC-B3-GUEST-MS-CCTV-DENY.png` |
| Guest → DBP/BHTQ      | `ping 10.128.x.x` hoặc `10.132.x.x`           | Timeout, không truy cập mạng nội bộ trạm phụ             | `TC-B3-GUEST-REMOTE-DENY.png`  |
| Guest → Internet      | Mở web ngoài hoặc `ping` IP công cộng được NAT | Thành công                                               | `TC-B3-GUEST-INTERNET.png`     |

Lặp lại ma trận cho LAN trạm phụ DBP `10.128.0.0/14` và BHTQ `10.132.0.0/14`:

| Source | Allowed                                                    | Denied                                                                  |
| ------ | ---------------------------------------------------------- | ----------------------------------------------------------------------- |
| Guest  | DNS `10.0.16.2`, web DMZ `10.0.1.2`, Internet qua NAT      | All `10.0.0.0/8` private networks except permitted DNS and DMZ services |

## C.2 Camera/CCTV

- Kiểm tra PC/NVR ở VLAN 50 có truy cập camera và camera phản hồi.
- Kiểm tra camera/NVR tại VLAN 50 có truy cập DNS và syslog theo policy.
- Kiểm tra VLAN Guest, Staff và Internet không truy cập trực tiếp VLAN 50.
- Nếu camera không hỗ trợ ping, dùng DHCP/DNS HTTP hoặc trạng thái giao tiếp trong Packet Tracer.
- Trên SW-CORE chạy `show access-lists 160` (ACL CCTV bind trên Vlan50); chụp kết quả counters sau khi test deny.
- Chụp topology, bảng trạng thái camera/NVR và trang giám sát.

Gợi ý tên ảnh:

- `TC-B3-CCTV-CAMERA-NVR.png`
- `TC-B3-CCTV-GUEST-DENY.png`
- `TC-B3-CCTV-SERVER-DHCP.png`

## C.3 VPN/IPsec

Trong mô hình `.pkt` hiện tại, **teleworker GRE-over-IPsec đã triển khai thật** (`Tunnel0` FW-MAIN ↔ R-HOME, overlay `10.254.0.0/30`) và được kiểm chứng qua KC-7 — không còn là "chỉ thiết kế".

Kết quả bắt buộc trong mô hình chính:

- `show crypto ipsec sa` trên FW-MAIN: SA GRE (`prot 47`, `esp-aes esp-sha-hmac`) **ACTIVE** cả `inbound`/`outbound` esp sas, `#pkts encaps`/`#pkts encrypt` tăng đồng bộ.
- Ping từ `LT-MOBILE1` (10.127.128.10) → SRV-DNS (10.0.16.2) / SRV-HIS (10.0.16.3) đạt, `TTL=124`, 0% loss (traffic đi trong tunnel GRE, chấm dứt tại FW-MAIN).
- Liên trạm DBP/BHTQ: PVC Frame Relay static AD 100 + serial backup floating AD 200, LMI `keepalive 10` — `show frame-relay pvc` cho DLCI 110/120 `STATUS = ACTIVE` (**không chạy OSPF trong mô phỏng**; static thay cho OSPF multi-area của thiết kế thật).
- Site-to-site IPsec Main ↔ DBP/BHTQ (A.1/A.2 `vpn-configs.md`) là cấu hình **đề xuất cho thiết bị thật**, chưa dựng trong Packet Tracer — phải ghi rõ như vậy khi trình bày.

Máy phải kiểm tra trong thiết bị thật hoặc môi trường bổ sung:

| Test                     | Kết quả mong đợi                                       |
| ------------------------ | ------------------------------------------------------ |
| Phase 1 IKE              | Tunnel SA UP                                           |
| Phase 2 IPsec            | Security association có encrypted/decrypted packets    |
| Ping Main ↔ DBP qua VPN  | Đạt qua đường EPL hoặc backup                          |
| Ping Main ↔ BHTQ qua VPN | Đạt qua đường EPL hoặc backup                          |
| Teleworker ↔ LAN nội bộ  | Chỉ mạng được phép truy cập (đạt trong `.pkt` — KC-7)  |
| Đứt EPL                  | Traffic chuyển sang backup/alternate path theo routing |

## C.4 B3 cleanup trước nộp

- [ ] Xuất `show access-lists` từ FW-MAIN (DMZ-IN/guest), SW-CORE (ACL 150/160) và GW-DBP/GW-BHTQ.
- [ ] Lưu bằng chứng routing liên site: `show ip route` (static PVC AD 100 + backup AD 200) và `show frame-relay pvc` (DLCI 110/120 `ACTIVE`, LMI `keepalive 10`).
- [ ] Kiểm tra `show ip interface brief` trên ba router guest/VLAN.
- [ ] Đặt tên ảnh theo bảng trên, không dùng tên chung như `test1.png`.
- [ ] Lưu cấu hình bằng `write memory` trên mỗi router/switch.
- [ ] Xóa mật khẩu, khóa pre-shared key và token khỏi repository.
- [ ] Cập nhật `/06-security` và gửi ảnh cho A2 trước mốc nội dung web.
