# PHỤ LỤC D — ĐO LƯỜNG VÀ BÁO CÁO BĂNG THÔNG

## D.1 Phạm vi

Báo cáo này phân biệt:

- **Ước tính thiết kế:** tính toán từ dung lượng đề bài và giả định tải.
- **Đo Packet Tracer:** kết quả lấy từ `ping`, `show interfaces`, bandwidth monitor hoặc Traffic Generator trong mô phỏng.
- **Thông số sản phẩm thật:** công suất ISP/EPL/NVR cần xác nhận bằng hợp đồng hoặc benchmark thiết bị.

Hiện workspace chưa có log đo throughput theo thời gian nên các kết quả phía dưới là **ước tính thiết kế**, chưa phải phép đo live đầy đủ.

## D.2 Công thức

```text
Tải băng thông (Mbps)
= tổng dung lượng ngày (MB) × 8 / thời gian hiệu dụng (giây)

Tải peak
= 80% × tổng dung lượng ngày × 8 / 5 400 giây

Băng thông có dự phòng tăng trưởng 20%
= tải tính toán × 1,20
```

Quy đổi: `1 MB = 8 Mbit`.

## D.3 Tải toàn hệ thống

| Nguồn tải                 | Dung lượng ngày xuống (MB) | Dung lượng ngày lên (MB) | Tổng (MB/ngày) |
| ------------------------- | -------------------------: | -----------------------: | -------------: |
| Workstation Main          |                    300 000 |                   60 000 |        360 000 |
| Workstation DBP           |                    130 000 |                   26 000 |        156 000 |
| Workstation BHTQ          |                    130 000 |                   26 000 |        156 000 |
| 14 server                 |                     14 000 |                   28 000 |         42 000 |
| Guest Wi-Fi: 200 thiết bị |                    100 000 |                        0 |        100 000 |
| **Tổng**                  |                **674 000** |              **140 000** |    **814 000** |

Tổng bit/ngày:

```text
814 000 MB/ngày × 8 = 6 512 000 Mbit/ngày
```

### Trung bình trong 3 giờ hiệu dụng

```text
6 512 000 / 10 800 ≈ 603 Mbps
603 × 1,20 ≈ 724 Mbps
```

### Peak 80/20

Giả định 80% dung lượng xuất hiện trong một nửa tổng khung hiệu dụng, tương ứng 5 400 giây:

```text
0,80 × 6 512 000 / 5 400 ≈ 965 Mbps
965 × 1,20 ≈ 1 158 Mbps
```

**Kết luận:** thiết kế Internet khuyến nghị là 2 link 1 Gbps. Tổng công suất 2 Gbps có phần 20% dự phòng dư địa, nhưng từng ISP cần hiểu rõ load-sharing/failover của router thực tế.

## D.4 Băng thông mỗi trạm phụ

| Trạm phụ | Staff xuống (MB) | Staff lên (MB) | Server xuống (MB) | Server lên (MB) | Guest xuống (MB) | Tổng (MB/ngày) |
| -------- | ---------------: | -------------: | ----------------: | --------------: | ---------------: | -------------: |
| DBP      |          130 000 |         26 000 |             2 000 |           4 000 |           25 000 |        187 000 |
| BHTQ     |          130 000 |         26 000 |             2 000 |           4 000 |           25 000 |        187 000 |

Mỗi trạm phụ:

```text
187 000 MB/ngày × 8 = 1 496 000 Mbit/ngày
Trung bình: 1 496 000 / 10 800 ≈ 139 Mbps
Peak + tăng trưởng:
0,80 × 1 496 000 / 5 400 × 1,20 ≈ 266 Mbps
```

**Kết luận:** EPL 300 Mbps/hướng phù hợp cho tải tính toán và còn khoảng 34 Mbps dự phòng trước khi tính load khác. Serial/N×E1 hoặc Internet IPsec chỉ dùng backup vì băng thông thấp hơn nhiều.

## D.5 Camera/CCTV

Thiết kế giả định 4 Mbps cho mỗi camera H.265 4 MP.

| Vùng      | Số camera | Tải đồng thời (Mbps) | Tải + growth 20% (Mbps) |
| --------- | --------: | -------------------: | ----------------------: |
| Main Site |        48 |                  192 |                     230 |
| DBP       |         7 |                   28 |                      34 |
| BHTQ      |         7 |                   28 |                      34 |
| **Tổng**  |    **62** |              **248** |                 **298** |

Con số 250 Mbps trong báo cáo làm tròn từ công suất 62 × 4 Mbps. VLAN/central uplink:

- uplink Main CCTV 10GbE phù hợp về năng lực lý thuyết;
- NVR 32-channel Main và 8-channel trạm phụ cần đủ kênh/hardware/PoE thực tế;
- tính toán không bao gồm dư ghi hình, retransmission, metadata, HA, 802.1X hoặc snapshot traffic.

## D.6 Phương pháp đo trong Packet Tracer

### A. Đo link WAN theo CLI

```ios
show interfaces GigabitEthernet0/0/1
show interfaces Serial0/1/0
show ip ospf neighbor
```

Thu thập các chỉ số:

- `5 minute input rate` / `5 minute output rate`
- packets/sec
- input/output errors
- drops

### B. Đo luồng test

| Test ID | Source                     | Đích               | Mục tiêu                |
| ------- | -------------------------- | ------------------ | ----------------------- |
| BW-01   | PC Main                    | SRV-HIS Main       | Baseline LAN            |
| BW-02   | PC DBP                     | SRV-HIS Main       | Tải qua EPL 300 Mbps    |
| BW-03   | PC BHTQ                    | SRV-HIS Main       | Tải qua EPL 300 Mbps    |
| BW-04   | Guest VLAN                 | Internet/public IP | NAT throughput          |
| BW-05   | 62 camera mô hình đại diện | NVR                | Tổng tải luồng ghi hình |

Trong Packet Tracer, nếu Traffic Generator/iperf không hỗ trợ cho model thiết bị đang dùng, ghi lại bằng Simulation mode + ICMP/DNS/HTTP đồng thời và dùng counters/clock rate trên interface.

### C. Thông tin bắt buộc trong bảng kết quả

| Trường                  | Giá trị |
| ----------------------- | ------- |
| Ngày giờ đo             |         |
| Phiên bản Packet Tracer |         |
| Đường đo                |         |
| Test duration           |         |
| Lý thuyết bandwidth     |         |
| Measured bandwidth      |         |
| Utilization %           |         |
| Packet loss             |         |
| Latency                 |         |
| Jitter                  |         |
| Ghi chú/gui giống mẫu   |         |

## D.7 Kết quả đo cần lưu lại

Lưu hai loại bằng chứng:

1. Screenshot CLI `show interfaces` trước và sau traffic burst.
2. Screenshot Simulation mode/counters thể hiện packet loss, latency hoặc ECMP/OSPF failover.

Tên file gợi ý:

- `BW-01-MAIN-HIS.png`
- `BW-02-DBP-WAN.png`
- `BW-03-BHTQ-WAN.png`
- `BW-04-GUEST-NAT.png`
- `BW-05-CCTV-NVR.png`
- `BW-CLI-R-WAN-MS.png`

## D.8 Khẳng định cần tránh

Không ghi rằng hệ thống đã đạt một mức Mbps cụ thể nếu chưa chạy traffic trong PT và lưu counters. Không gọi ước tính là kết quả đo. Không ghi IPsec đã vận hành nếu file `.pkt` không hỗ trợ hoặc không có tunnel/output SA.
