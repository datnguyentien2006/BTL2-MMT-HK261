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
- Trên R-CORE-MS chạy `show access-lists CCTV-OUT`; chụp kết quả counters sau khi test deny.
- Chụp topology, bảng trạng thái camera/NVR và trang giám sát.

Gợi ý tên ảnh:

- `TC-B3-CCTV-CAMERA-NVR.png`
- `TC-B3-CCTV-GUEST-DENY.png`
- `TC-B3-CCTV-SERVER-DHCP.png`

## C.3 VPN/IPsec

Packet Tracer hiện tại không chạy VPN/IPsec như phần thiết bị vật lý thật. Kết quả bắt buộc trong mô hình chính là:

- OSPF liên site hoạt động qua EPL.
- Serial/backup path được chỉ ra trong thiết kế nhưng không chấp nhận thay cho cấu hình crypto thực tế nếu bản .pkt không hỗ trợ.
- Tài liệu VPN thực tế nằm trong `vpn-configs.md` và phải ghi rõ đây là cấu hình đề xuất, chưa triển khai trong Packet Tracer.

Máy phải kiểm tra trong thiết bị thật hoặc môi trường bổ sung:

| Test                     | Kết quả mong đợi                                       |
| ------------------------ | ------------------------------------------------------ |
| Phase 1 IKE              | Tunnel SA UP                                           |
| Phase 2 IPsec            | Security association có encrypted/decrypted packets    |
| Ping Main ↔ DBP qua VPN  | Đạt qua đường EPL hoặc backup                          |
| Ping Main ↔ BHTQ qua VPN | Đạt qua đường EPL hoặc backup                          |
| Teleworker ↔ LAN nội bộ  | Chỉ mạng được phép truy cập                            |
| Đứt EPL                  | Traffic chuyển sang backup/alternate path theo routing |

## C.4 B3 cleanup trước nộp

- [ ] Xuất `show access-lists` từ R-CORE-MS, R-DBP và R-BHTQ.
- [ ] Lưu `show ip ospf neighbor` cho liên site.
- [ ] Kiểm tra `show ip interface brief` trên ba router guest/VLAN.
- [ ] Đặt tên ảnh theo bảng trên, không dùng tên chung như `test1.png`.
- [ ] Lưu cấu hình bằng `write memory` trên mỗi router/switch.
- [ ] Xóa mật khẩu, khóa pre-shared key và token khỏi repository.
- [ ] Cập nhật `/06-security` và gửi ảnh cho A2 trước mốc nội dung web.
