# ASSIGNMENT 2 — NETWORK DESIGN AND SIMULATION FOR A CRITICAL LARGE HOSPITAL

Repo này chứa toàn bộ sản phẩm cho Assignment 2 (Mạng máy tính – HCMUT):

- **Báo cáo dự án** (`report/`) — tiếng Việt, theo cấu trúc Step 1→7 của đề bài.
- **Mô phỏng Packet Tracer** (`simulation/`) — file `.pkt` được dựng bằng MCP Packet Tracer (PTBuilder).
- **Plan / script / cấu hình IOS** tự động sinh (`docs/ptbuild/`).
- **Nhật ký xây dựng + kiểm chứng** (`docs/`).

## Kiến trúc tổng quan

- **Main Site (TP.HCM)**: 2 tòa nhà A/B + Data Center; 600 workstation, 10 server (thiết kế); VLAN theo phòng ban; DMZ; firewall/NAT; 2× DSL Internet load-sharing; WiFi toàn site; CCTV.
- **2 trạm phụ DBP & BHTQ**: 260 workstation mỗi site (thiết kế); 1 router WAN + 1 switch tầng truy cập mỗi site.
- **WAN**: 2 leased line MPLS (Ethernet handoff) + đường serial dự phòng → OSPF dynamic routing, sẵn sàng SD-WAN overlay.
- **Bảo mật**: ACL chặn khách WiFi → LAN, DMZ policy, NAT/PAT, hardening (SSH/enable secret/banner), syslog + NetFlow.

## Cách dựng lại mô phỏng

Packet Tracer mở sẵn + extension MCP Control Center (Extensions → MCP BUILDER):

1. `pt_open_project(<file .pkt>)` (hoặc chạy lại plan bằng `pt_live_deploy`).
2. Kết nối kiểm chứng: xem `report/` – phần Step 5 (bảng ping/traceroute).

## Trạng thái làm việc

Xem `docs/CHANGELOG.md` — mỗi commit tương ứng một bước dựng/kiểm chứng.
