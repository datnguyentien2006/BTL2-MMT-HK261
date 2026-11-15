# ASSIGNMENT 2 — NETWORK DESIGN AND SIMULATION FOR A CRITICAL LARGE HOSPITAL

Sản phẩm Assignment 2 (Mạng máy tính — HCMUT): thiết kế & mô phỏng mạng cho bệnh viện
hạng mục quan trọng (Main Site TP.HCM + 2 trạm phụ DBP/BHTQ).

Báo cáo nộp chính (PDF) được nộp riêng trên BKeL. Repo này là **toàn bộ nguồn, mô hình
mô phỏng và bằng chứng đo** đi kèm báo cáo đó.

## Cấu trúc

| Đường dẫn | Nội dung |
| --- | --- |
| `simulation/CCC-Hospital-v2.pkt` | Mô hình Packet Tracer bản chốt — 49 thiết bị / 49 link |
| `report/REPORT_vi.md` | Báo cáo đầy đủ tiếng Việt theo Step 1→7, kèm bảng kết quả KC-1→KC-8 |
| `report.tex` | Bản nguồn LaTeX của báo cáo (fragment — build cùng `main.tex` của nhóm) |
| `report/appendix/` | Phụ lục A (cấu hình VPN), B (cẩm nang best practice bảo mật), C (checklist kiểm thử), D (đo băng thông) |
| `report/CCC-Hospital-Diagrams/` | Sơ đồ Draw.io: kiến trúc logic, Main Site vật lý, trạm phụ, WAN/OSPF routing |
| `report/images/` | `topology.png` + 6 ảnh kiểm thử kết nối bắt buộc của đề bài |
| `docs/ptbuild/CCC-Hospital-v2/` | 9 archive `startup-config` (xuất thật từ `.pkt`), `metadata.json`, `evidence-2026-11-11.md` (bản ghi đo live KC-1→KC-8) |
| `docs/DEMO_SCRIPT.md` | Kịch bản demo / vấn đáp |
| `report/appendix/b3-test-checklist.md` | Checklist kiểm thử + danh mục ảnh bằng chứng |

## Kiến trúc tóm tắt

- **Main Site (TP.HCM)**: 2 tòa nhà A/B + Data Center; 600 workstation, 10 server (thiết kế);
  VLAN theo phòng ban; DMZ; firewall/NAT; 2× DSL Internet; Wi-Fi toàn site; CCTV.
- **2 trạm phụ DBP & BHTQ**: 260 workstation mỗi site (thiết kế); 1 router WAN + switch tầng truy cập.
- **WAN**: thiết kế thật dùng MPLS/Ethernet + serial dự phòng với OSPF; trong `.pkt` mô phỏng bằng
  **Frame Relay** (PVC DLCI 110/120) + **static AD 100** và **floating static AD 200** trên serial backup.
- **Bảo mật**: ACL chặn khách Wi-Fi → LAN, ACL DMZ, NAT/PAT + static NAT, hardening toàn bộ
  thiết bị IOS (SSHv2 trên `vty 0 15`, đóng cổng trống, port-security), syslog + NetFlow về SRV-LOG.
- **VPN**: GRE-over-IPsec site-to-site `Tunnel0` FW-MAIN ↔ R-HOME (overlay `10.254.0.0/30`),
  mã hóa ESP-AES/ESP-SHA-HMAC.

## Mở mô phỏng

1. Packet Tracer ≥ 8.x kèm extension MCP Control Center (Extensions → MCP BUILDER) nếu muốn
   điều khiển bằng tool; mở trực tiếp file `.pkt` cũng chạy được.
2. `pt_open_project("simulation/CCC-Hospital-v2.pkt")`.
3. Đối chiếu kết quả: `docs/ptbuild/CCC-Hospital-v2/evidence-2026-11-11.md` (KC-1→KC-8)
   và §5 trong báo cáo.

## Ghi chú

- Mật khẩu/PSK trong archive config và phụ lục là **credential lab của bài tập**
  (`cisco123`, PSK `HOSP2026`) — không dùng cho hệ thống thật.
- `report.tex` là fragment (không có preamble); bản PDF nộp được build cùng `main.tex`
  của nhóm với các gói `tabularx`, `longtable`, `graphicx`, `float`.
- `report/REPORT_vi.md` và `report.tex` mô tả cùng một thiết kế; PDF nộp là bản rút gọn
  7 chương theo đúng khung điểm Step 1→7 của đề.