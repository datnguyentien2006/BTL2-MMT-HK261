lwAddDevice("ISP1", 0, "2911", 60, 70);
lwAddDevice("R-EDGE-MS", 0, "2911", 300, 70);
lwAddDevice("ISP2", 0, "2911", 560, 70);
lwAddDevice("R-CORE-MS", 0, "2911", 300, 170);
lwAddDevice("R-WAN-MS", 0, "ISR4331", 560, 170);
lwAddDevice("R-DBP", 0, "2911", 680, 90);
lwAddDevice("R-BHTQ", 0, "2911", 860, 90);
lwAddDevice("SW-CORE", 1, "3560-24PS", 300, 260);
lwAddDevice("SW-BLD-A", 1, "2960-24TT", 110, 260);
lwAddDevice("SW-BLD-B", 1, "2960-24TT", 220, 260);
lwAddDevice("SW-SRV", 1, "2960-24TT", 420, 260);
lwAddDevice("SW-CCTV", 1, "2960-24TT", 540, 260);
lwAddDevice("SW-DMZ", 1, "2960-24TT", 650, 260);
lwAddDevice("SW-DBP", 1, "2960-24TT", 680, 260);
lwAddDevice("SW-BHTQ", 1, "2960-24TT", 860, 260);
lwAddDevice("SW-HOME", 1, "Switch-PT", 480, 170);
lwAddDevice("PC-A1", 8, "PC-PT", 40, 420);
lwAddDevice("PC-A2", 8, "PC-PT", 80, 420);
lwAddDevice("PC-A3", 8, "PC-PT", 120, 420);
lwAddDevice("PRN-A", 8, "Printer-PT", 160, 420);
lwAddDevice("PC-B1", 8, "PC-PT", 210, 420);
lwAddDevice("PC-B2", 8, "PC-PT", 250, 420);
lwAddDevice("PC-B3", 8, "PC-PT", 290, 420);
lwAddDevice("PRN-B", 8, "Printer-PT", 330, 420);
lwAddDevice("SRV-DNS", 9, "Server-PT", 380, 420);
lwAddDevice("SRV-HIS", 9, "Server-PT", 420, 420);
lwAddDevice("SRV-PACS", 9, "Server-PT", 460, 420);
lwAddDevice("SRV-LOG", 9, "Server-PT", 500, 420);
lwAddDevice("SRV-NVR", 9, "Server-PT", 550, 420);
lwAddDevice("CAM-01", 8, "PC-PT", 590, 420);
lwAddDevice("CAM-02", 8, "PC-PT", 630, 420);
lwAddDevice("SRV-WEB-DMZ", 9, "Server-PT", 680, 420);
lwAddDevice("SRV-MAIL-DMZ", 9, "Server-PT", 720, 420);
lwAddDevice("PC-DBP1", 8, "PC-PT", 700, 420);
lwAddDevice("PC-DBP2", 8, "PC-PT", 740, 420);
lwAddDevice("SRV-DBP", 9, "Server-PT", 780, 420);
lwAddDevice("PC-BHTQ1", 8, "PC-PT", 880, 420);
lwAddDevice("PC-BHTQ2", 8, "PC-PT", 920, 420);
lwAddDevice("SRV-BHTQ", 9, "Server-PT", 960, 420);
lwAddDevice("SRV-WEB-INT", 9, "Server-PT", 40, 160);
lwAddDevice("LT-TELE", 8, "Laptop-PT", 540, 170);
lwAddDevice("AP-BLD-A", 7, "AccessPoint-PT", 180, 340);
lwAddDevice("AP-BLD-B", 7, "AccessPoint-PT", 360, 340);
lwAddDevice("AP-DBP", 7, "AccessPoint-PT", 730, 340);
lwAddDevice("AP-BHTQ", 7, "AccessPoint-PT", 910, 340);
lwAddDevice("AP-HOME", 7, "AccessPoint-PT", 500, 170);
lwAddLink("ISP1", "GigabitEthernet0/0", "R-EDGE-MS", "GigabitEthernet0/0", 8101);
lwAddLink("ISP2", "GigabitEthernet0/0", "R-EDGE-MS", "GigabitEthernet0/1", 8101);
lwAddLink("R-EDGE-MS", "GigabitEthernet0/2", "R-CORE-MS", "GigabitEthernet0/1", 8101);
lwAddLink("R-CORE-MS", "GigabitEthernet0/2", "R-WAN-MS", "GigabitEthernet0/0/0", 8101);
lwAddLink("R-CORE-MS", "GigabitEthernet0/0", "SW-CORE", "GigabitEthernet0/1", 8100);
lwAddLink("SW-CORE", "FastEthernet0/2", "SW-BLD-A", "GigabitEthernet0/1", 8101);
lwAddLink("SW-CORE", "FastEthernet0/4", "SW-BLD-B", "GigabitEthernet0/1", 8101);
lwAddLink("SW-CORE", "FastEthernet0/6", "SW-SRV", "GigabitEthernet0/1", 8101);
lwAddLink("SW-CORE", "FastEthernet0/8", "SW-CCTV", "GigabitEthernet0/1", 8101);
lwAddLink("SW-CORE", "FastEthernet0/10", "SW-DMZ", "GigabitEthernet0/1", 8101);
lwAddLink("SW-BLD-A", "FastEthernet0/1", "PC-A1", "FastEthernet0", 8100);
lwAddLink("SW-BLD-A", "FastEthernet0/2", "PC-A2", "FastEthernet0", 8100);
lwAddLink("SW-BLD-A", "FastEthernet0/3", "PC-A3", "FastEthernet0", 8100);
lwAddLink("SW-BLD-A", "FastEthernet0/5", "PRN-A", "FastEthernet0", 8100);
lwAddLink("SW-BLD-A", "FastEthernet0/23", "AP-BLD-A", "Port 0", 8100);
lwAddLink("SW-BLD-B", "FastEthernet0/1", "PC-B1", "FastEthernet0", 8100);
lwAddLink("SW-BLD-B", "FastEthernet0/2", "PC-B2", "FastEthernet0", 8100);
lwAddLink("SW-BLD-B", "FastEthernet0/3", "PC-B3", "FastEthernet0", 8100);
lwAddLink("SW-BLD-B", "FastEthernet0/5", "PRN-B", "FastEthernet0", 8100);
lwAddLink("SW-BLD-B", "FastEthernet0/23", "AP-BLD-B", "Port 0", 8100);
lwAddLink("SW-SRV", "FastEthernet0/1", "SRV-DNS", "FastEthernet0", 8100);
lwAddLink("SW-SRV", "FastEthernet0/2", "SRV-HIS", "FastEthernet0", 8100);
lwAddLink("SW-SRV", "FastEthernet0/3", "SRV-PACS", "FastEthernet0", 8100);
lwAddLink("SW-SRV", "FastEthernet0/4", "SRV-LOG", "FastEthernet0", 8100);
lwAddLink("SW-CCTV", "FastEthernet0/1", "SRV-NVR", "FastEthernet0", 8100);
lwAddLink("SW-CCTV", "FastEthernet0/2", "CAM-01", "FastEthernet0", 8100);
lwAddLink("SW-CCTV", "FastEthernet0/3", "CAM-02", "FastEthernet0", 8100);
lwAddLink("SW-DMZ", "FastEthernet0/1", "SRV-WEB-DMZ", "FastEthernet0", 8100);
lwAddLink("SW-DMZ", "FastEthernet0/2", "SRV-MAIL-DMZ", "FastEthernet0", 8100);
lwAddLink("R-DBP", "GigabitEthernet0/0", "SW-DBP", "GigabitEthernet0/1", 8100);
lwAddLink("SW-DBP", "FastEthernet0/1", "PC-DBP1", "FastEthernet0", 8100);
lwAddLink("SW-DBP", "FastEthernet0/2", "PC-DBP2", "FastEthernet0", 8100);
lwAddLink("SW-DBP", "FastEthernet0/3", "SRV-DBP", "FastEthernet0", 8100);
lwAddLink("SW-DBP", "FastEthernet0/23", "AP-DBP", "Port 0", 8100);
lwAddLink("R-BHTQ", "GigabitEthernet0/0", "SW-BHTQ", "GigabitEthernet0/1", 8100);
lwAddLink("SW-BHTQ", "FastEthernet0/1", "PC-BHTQ1", "FastEthernet0", 8100);
lwAddLink("SW-BHTQ", "FastEthernet0/2", "PC-BHTQ2", "FastEthernet0", 8100);
lwAddLink("SW-BHTQ", "FastEthernet0/3", "SRV-BHTQ", "FastEthernet0", 8100);
lwAddLink("SW-BHTQ", "FastEthernet0/23", "AP-BHTQ", "Port 0", 8100);
lwAddLink("ISP1", "GigabitEthernet0/1", "SRV-WEB-INT", "FastEthernet0", 8101);
lwAddLink("ISP2", "GigabitEthernet0/1", "SW-HOME", "FastEthernet0/1", 8100);
lwAddLink("SW-HOME", "FastEthernet0/1", "AP-HOME", "Port 0", 8100);
lwAddLink("SW-HOME", "FastEthernet2/1", "LT-TELE", "FastEthernet0", 8100);
lwAddLink("R-WAN-MS", "GigabitEthernet0/0/1", "R-DBP", "GigabitEthernet0/1", 8101);
lwAddLink("R-WAN-MS", "GigabitEthernet0/0/2", "R-BHTQ", "GigabitEthernet0/1", 8101);
/* === Configuraciones CLI por dispositivo ===
Copiar y pegar en la CLI de cada dispositivo. */
/* --- ISP1 ---
enable
configure terminal
hostname ISP1
no ip domain-lookup

interface GigabitEthernet0/0
 ip address 203.0.113.1 255.255.255.252
 no shutdown
 exit

interface GigabitEthernet0/1
 ip address 198.51.100.1 255.255.255.0
 no shutdown
 exit

ip route 203.0.115.0 255.255.255.0 203.0.113.2

end
write memory
*/ 
/* --- R-EDGE-MS ---
enable
configure terminal
hostname R-EDGE-MS
no ip domain-lookup

interface GigabitEthernet0/0
 ip address 203.0.113.2 255.255.255.252
 no shutdown
 exit

interface GigabitEthernet0/1
 ip address 203.0.114.2 255.255.255.252
 no shutdown
 exit

interface GigabitEthernet0/2
 ip address 10.10.0.2 255.255.255.252
 no shutdown
 exit

ip route 0.0.0.0 0.0.0.0 203.0.113.1
ip route 0.0.0.0 0.0.0.0 203.0.114.1 50

router ospf 1
 router-id 203.0.113.2
 network 10.10.0.0 0.0.0.3 area 0
 exit

end
write memory
*/ 
/* --- ISP2 ---
enable
configure terminal
hostname ISP2
no ip domain-lookup

interface GigabitEthernet0/0
 ip address 203.0.114.1 255.255.255.252
 no shutdown
 exit

interface GigabitEthernet0/1
 ip address 192.168.250.1 255.255.255.0
 no shutdown
 exit

ip dhcp excluded-address 192.168.250.1 192.168.250.1
ip dhcp pool TELE-HOME
 network 192.168.250.0 255.255.255.0
 default-router 192.168.250.1
 dns-server 198.51.100.10
 exit

ip route 203.0.115.0 255.255.255.0 203.0.114.2
ip route 0.0.0.0 0.0.0.0 203.0.114.2

end
write memory
*/ 
/* --- R-CORE-MS ---
enable
configure terminal
hostname R-CORE-MS
no ip domain-lookup

interface GigabitEthernet0/1
 ip address 10.10.0.1 255.255.255.252
 no shutdown
 exit

interface GigabitEthernet0/2
 ip address 10.10.0.5 255.255.255.252
 no shutdown
 exit

interface GigabitEthernet0/0
 no shutdown
 exit
interface GigabitEthernet0/0.10
 encapsulation dot1Q 10
 ip address 10.10.10.1 255.255.255.0
 exit
interface GigabitEthernet0/0.20
 encapsulation dot1Q 20
 ip address 10.10.20.1 255.255.255.0
 exit
interface GigabitEthernet0/0.30
 encapsulation dot1Q 30
 ip address 10.10.30.1 255.255.255.0
 exit
interface GigabitEthernet0/0.40
 encapsulation dot1Q 40
 ip address 10.10.40.1 255.255.255.0
 exit
interface GigabitEthernet0/0.50
 encapsulation dot1Q 50
 ip address 10.10.50.1 255.255.255.0
 exit
interface GigabitEthernet0/0.60
 encapsulation dot1Q 60
 ip address 10.10.60.1 255.255.255.0
 exit
interface GigabitEthernet0/0.200
 encapsulation dot1Q 200
 ip address 10.10.200.1 255.255.255.0
 exit

ip dhcp excluded-address 10.10.30.1 10.10.30.30
ip dhcp excluded-address 10.10.40.1 10.10.40.30
ip dhcp excluded-address 10.10.60.1 10.10.60.20
ip dhcp pool VLAN30-MS
 network 10.10.30.0 255.255.255.0
 default-router 10.10.30.1
 dns-server 10.10.20.5
 exit

ip dhcp pool VLAN40-MS
 network 10.10.40.0 255.255.255.0
 default-router 10.10.40.1
 dns-server 10.10.20.5
 exit

ip dhcp pool VLAN60-MS
 network 10.10.60.0 255.255.255.0
 default-router 10.10.60.1
 dns-server 10.10.20.5
 exit

router ospf 1
 router-id 10.10.0.1
 network 10.10.0.0 0.0.0.3 area 0
 network 10.10.0.4 0.0.0.3 area 0
 network 10.10.10.0 0.0.0.255 area 0
 network 10.10.20.0 0.0.0.255 area 0
 network 10.10.30.0 0.0.0.255 area 0
 network 10.10.40.0 0.0.0.255 area 0
 network 10.10.50.0 0.0.0.255 area 0
 network 10.10.60.0 0.0.0.255 area 0
 network 10.10.200.0 0.0.0.255 area 0
 exit

end
write memory
*/ 
/* --- R-WAN-MS ---
enable
configure terminal
hostname R-WAN-MS
no ip domain-lookup

interface GigabitEthernet0/0/0
 ip address 10.10.0.6 255.255.255.252
 no shutdown
 exit

interface GigabitEthernet0/0/1
 ip address 10.254.0.1 255.255.255.252
 no shutdown
 exit

interface GigabitEthernet0/0/2
 ip address 10.254.0.5 255.255.255.252
 no shutdown
 exit

router ospf 1
 router-id 10.10.0.6
 network 10.10.0.4 0.0.0.3 area 0
 network 10.254.0.0 0.0.0.3 area 0
 network 10.254.0.4 0.0.0.3 area 0
 exit

end
write memory
*/ 
/* --- R-DBP ---
enable
configure terminal
hostname R-DBP
no ip domain-lookup

interface GigabitEthernet0/1
 ip address 10.254.0.2 255.255.255.252
 no shutdown
 exit

interface GigabitEthernet0/0
 no shutdown
 exit
interface GigabitEthernet0/0.61
 encapsulation dot1Q 61
 ip address 10.11.10.1 255.255.255.0
 exit
interface GigabitEthernet0/0.62
 encapsulation dot1Q 62
 ip address 10.11.20.1 255.255.255.0
 exit
interface GigabitEthernet0/0.63
 encapsulation dot1Q 63
 ip address 10.11.60.1 255.255.255.0
 exit

ip dhcp excluded-address 10.11.10.1 10.11.10.30
ip dhcp excluded-address 10.11.60.1 10.11.60.20
ip dhcp pool DBP-STAFF
 network 10.11.10.0 255.255.255.0
 default-router 10.11.10.1
 dns-server 10.10.20.5
 exit

ip dhcp pool DBP-GUEST
 network 10.11.60.0 255.255.255.0
 default-router 10.11.60.1
 dns-server 10.10.20.5
 exit

router ospf 1
 router-id 10.11.10.1
 network 10.11.10.0 0.0.0.255 area 0
 network 10.11.20.0 0.0.0.255 area 0
 network 10.11.60.0 0.0.0.255 area 0
 network 10.254.0.0 0.0.0.3 area 0
 exit

end
write memory
*/ 
/* --- R-BHTQ ---
enable
configure terminal
hostname R-BHTQ
no ip domain-lookup

interface GigabitEthernet0/1
 ip address 10.254.0.6 255.255.255.252
 no shutdown
 exit

interface GigabitEthernet0/0
 no shutdown
 exit
interface GigabitEthernet0/0.71
 encapsulation dot1Q 71
 ip address 10.12.10.1 255.255.255.0
 exit
interface GigabitEthernet0/0.72
 encapsulation dot1Q 72
 ip address 10.12.20.1 255.255.255.0
 exit
interface GigabitEthernet0/0.73
 encapsulation dot1Q 73
 ip address 10.12.60.1 255.255.255.0
 exit

ip dhcp excluded-address 10.12.10.1 10.12.10.30
ip dhcp excluded-address 10.12.60.1 10.12.60.20
ip dhcp pool BHTQ-STAFF
 network 10.12.10.0 255.255.255.0
 default-router 10.12.10.1
 dns-server 10.10.20.5
 exit

ip dhcp pool BHTQ-GUEST
 network 10.12.60.0 255.255.255.0
 default-router 10.12.60.1
 dns-server 10.10.20.5
 exit

router ospf 1
 router-id 10.12.10.1
 network 10.12.10.0 0.0.0.255 area 0
 network 10.12.20.0 0.0.0.255 area 0
 network 10.12.60.0 0.0.0.255 area 0
 network 10.254.0.4 0.0.0.3 area 0
 exit

end
write memory
*/ 
/* --- SW-CORE ---
enable
configure terminal
hostname SW-CORE
vlan 10
 name MGMT
 exit
vlan 20
 name SERVER-FARM
 exit
vlan 30
 name DEPT-A
 exit
vlan 40
 name DEPT-B
 exit
vlan 50
 name CCTV
 exit
vlan 60
 name WIFI-GUEST
 exit
vlan 200
 name DMZ
 exit
vlan 61
 name DBP-STAFF
 exit
vlan 62
 name DBP-SRV
 exit
vlan 63
 name DBP-GUEST
 exit
vlan 71
 name BHTQ-STAFF
 exit
vlan 72
 name BHTQ-SRV
 exit
vlan 73
 name BHTQ-GUEST
 exit
interface GigabitEthernet0/1
 switchport trunk encapsulation dot1q
 switchport mode trunk
 switchport trunk allowed vlan 10,20,30,40,50,60,200
 exit
interface FastEthernet0/2
 switchport trunk encapsulation dot1q
 switchport mode trunk
 switchport trunk allowed vlan 30,60
 exit
interface FastEthernet0/4
 switchport trunk encapsulation dot1q
 switchport mode trunk
 switchport trunk allowed vlan 40,60
 exit
interface FastEthernet0/6
 switchport trunk encapsulation dot1q
 switchport mode trunk
 switchport trunk allowed vlan 20
 exit
interface FastEthernet0/8
 switchport trunk encapsulation dot1q
 switchport mode trunk
 switchport trunk allowed vlan 50
 exit
interface FastEthernet0/10
 switchport trunk encapsulation dot1q
 switchport mode trunk
 switchport trunk allowed vlan 200
 exit
end
write memory
*/ 
/* --- SW-BLD-A ---
enable
configure terminal
hostname SW-BLD-A
vlan 10
 name MGMT
 exit
vlan 20
 name SERVER-FARM
 exit
vlan 30
 name DEPT-A
 exit
vlan 40
 name DEPT-B
 exit
vlan 50
 name CCTV
 exit
vlan 60
 name WIFI-GUEST
 exit
vlan 200
 name DMZ
 exit
vlan 61
 name DBP-STAFF
 exit
vlan 62
 name DBP-SRV
 exit
vlan 63
 name DBP-GUEST
 exit
vlan 71
 name BHTQ-STAFF
 exit
vlan 72
 name BHTQ-SRV
 exit
vlan 73
 name BHTQ-GUEST
 exit
interface FastEthernet0/1
 switchport mode access
 switchport access vlan 30
 exit
interface FastEthernet0/2
 switchport mode access
 switchport access vlan 30
 exit
interface FastEthernet0/3
 switchport mode access
 switchport access vlan 30
 exit
interface FastEthernet0/5
 switchport mode access
 switchport access vlan 30
 exit
interface FastEthernet0/23
 switchport mode access
 switchport access vlan 60
 exit
interface GigabitEthernet0/1
 switchport mode trunk
 switchport trunk allowed vlan 30,60
 exit
end
write memory
*/ 
/* --- SW-BLD-B ---
enable
configure terminal
hostname SW-BLD-B
vlan 10
 name MGMT
 exit
vlan 20
 name SERVER-FARM
 exit
vlan 30
 name DEPT-A
 exit
vlan 40
 name DEPT-B
 exit
vlan 50
 name CCTV
 exit
vlan 60
 name WIFI-GUEST
 exit
vlan 200
 name DMZ
 exit
vlan 61
 name DBP-STAFF
 exit
vlan 62
 name DBP-SRV
 exit
vlan 63
 name DBP-GUEST
 exit
vlan 71
 name BHTQ-STAFF
 exit
vlan 72
 name BHTQ-SRV
 exit
vlan 73
 name BHTQ-GUEST
 exit
interface FastEthernet0/1
 switchport mode access
 switchport access vlan 40
 exit
interface FastEthernet0/2
 switchport mode access
 switchport access vlan 40
 exit
interface FastEthernet0/3
 switchport mode access
 switchport access vlan 40
 exit
interface FastEthernet0/5
 switchport mode access
 switchport access vlan 40
 exit
interface FastEthernet0/23
 switchport mode access
 switchport access vlan 60
 exit
interface GigabitEthernet0/1
 switchport mode trunk
 switchport trunk allowed vlan 40,60
 exit
end
write memory
*/ 
/* --- SW-SRV ---
enable
configure terminal
hostname SW-SRV
vlan 10
 name MGMT
 exit
vlan 20
 name SERVER-FARM
 exit
vlan 30
 name DEPT-A
 exit
vlan 40
 name DEPT-B
 exit
vlan 50
 name CCTV
 exit
vlan 60
 name WIFI-GUEST
 exit
vlan 200
 name DMZ
 exit
vlan 61
 name DBP-STAFF
 exit
vlan 62
 name DBP-SRV
 exit
vlan 63
 name DBP-GUEST
 exit
vlan 71
 name BHTQ-STAFF
 exit
vlan 72
 name BHTQ-SRV
 exit
vlan 73
 name BHTQ-GUEST
 exit
interface FastEthernet0/1
 switchport mode access
 switchport access vlan 20
 exit
interface FastEthernet0/2
 switchport mode access
 switchport access vlan 20
 exit
interface FastEthernet0/3
 switchport mode access
 switchport access vlan 20
 exit
interface FastEthernet0/4
 switchport mode access
 switchport access vlan 20
 exit
interface GigabitEthernet0/1
 switchport mode trunk
 switchport trunk allowed vlan 20
 exit
end
write memory
*/ 
/* --- SW-CCTV ---
enable
configure terminal
hostname SW-CCTV
vlan 10
 name MGMT
 exit
vlan 20
 name SERVER-FARM
 exit
vlan 30
 name DEPT-A
 exit
vlan 40
 name DEPT-B
 exit
vlan 50
 name CCTV
 exit
vlan 60
 name WIFI-GUEST
 exit
vlan 200
 name DMZ
 exit
vlan 61
 name DBP-STAFF
 exit
vlan 62
 name DBP-SRV
 exit
vlan 63
 name DBP-GUEST
 exit
vlan 71
 name BHTQ-STAFF
 exit
vlan 72
 name BHTQ-SRV
 exit
vlan 73
 name BHTQ-GUEST
 exit
interface FastEthernet0/1
 switchport mode access
 switchport access vlan 50
 exit
interface FastEthernet0/2
 switchport mode access
 switchport access vlan 50
 exit
interface FastEthernet0/3
 switchport mode access
 switchport access vlan 50
 exit
interface GigabitEthernet0/1
 switchport mode trunk
 switchport trunk allowed vlan 50
 exit
end
write memory
*/ 
/* --- SW-DMZ ---
enable
configure terminal
hostname SW-DMZ
vlan 10
 name MGMT
 exit
vlan 20
 name SERVER-FARM
 exit
vlan 30
 name DEPT-A
 exit
vlan 40
 name DEPT-B
 exit
vlan 50
 name CCTV
 exit
vlan 60
 name WIFI-GUEST
 exit
vlan 200
 name DMZ
 exit
vlan 61
 name DBP-STAFF
 exit
vlan 62
 name DBP-SRV
 exit
vlan 63
 name DBP-GUEST
 exit
vlan 71
 name BHTQ-STAFF
 exit
vlan 72
 name BHTQ-SRV
 exit
vlan 73
 name BHTQ-GUEST
 exit
interface FastEthernet0/1
 switchport mode access
 switchport access vlan 200
 exit
interface FastEthernet0/2
 switchport mode access
 switchport access vlan 200
 exit
interface GigabitEthernet0/1
 switchport mode trunk
 switchport trunk allowed vlan 200
 exit
end
write memory
*/ 
/* --- SW-DBP ---
enable
configure terminal
hostname SW-DBP
vlan 10
 name MGMT
 exit
vlan 20
 name SERVER-FARM
 exit
vlan 30
 name DEPT-A
 exit
vlan 40
 name DEPT-B
 exit
vlan 50
 name CCTV
 exit
vlan 60
 name WIFI-GUEST
 exit
vlan 200
 name DMZ
 exit
vlan 61
 name DBP-STAFF
 exit
vlan 62
 name DBP-SRV
 exit
vlan 63
 name DBP-GUEST
 exit
vlan 71
 name BHTQ-STAFF
 exit
vlan 72
 name BHTQ-SRV
 exit
vlan 73
 name BHTQ-GUEST
 exit
interface FastEthernet0/1
 switchport mode access
 switchport access vlan 61
 exit
interface FastEthernet0/2
 switchport mode access
 switchport access vlan 61
 exit
interface FastEthernet0/3
 switchport mode access
 switchport access vlan 62
 exit
interface FastEthernet0/23
 switchport mode access
 switchport access vlan 63
 exit
interface GigabitEthernet0/1
 switchport mode trunk
 switchport trunk allowed vlan 61,62,63
 exit
end
write memory
*/ 
/* --- SW-BHTQ ---
enable
configure terminal
hostname SW-BHTQ
vlan 10
 name MGMT
 exit
vlan 20
 name SERVER-FARM
 exit
vlan 30
 name DEPT-A
 exit
vlan 40
 name DEPT-B
 exit
vlan 50
 name CCTV
 exit
vlan 60
 name WIFI-GUEST
 exit
vlan 200
 name DMZ
 exit
vlan 61
 name DBP-STAFF
 exit
vlan 62
 name DBP-SRV
 exit
vlan 63
 name DBP-GUEST
 exit
vlan 71
 name BHTQ-STAFF
 exit
vlan 72
 name BHTQ-SRV
 exit
vlan 73
 name BHTQ-GUEST
 exit
interface FastEthernet0/1
 switchport mode access
 switchport access vlan 71
 exit
interface FastEthernet0/2
 switchport mode access
 switchport access vlan 71
 exit
interface FastEthernet0/3
 switchport mode access
 switchport access vlan 72
 exit
interface FastEthernet0/23
 switchport mode access
 switchport access vlan 73
 exit
interface GigabitEthernet0/1
 switchport mode trunk
 switchport trunk allowed vlan 71,72,73
 exit
end
write memory
*/ 
/* --- SW-HOME ---
enable
configure terminal
hostname SW-HOME
vlan 10
 name MGMT
 exit
vlan 20
 name SERVER-FARM
 exit
vlan 30
 name DEPT-A
 exit
vlan 40
 name DEPT-B
 exit
vlan 50
 name CCTV
 exit
vlan 60
 name WIFI-GUEST
 exit
vlan 200
 name DMZ
 exit
vlan 61
 name DBP-STAFF
 exit
vlan 62
 name DBP-SRV
 exit
vlan 63
 name DBP-GUEST
 exit
vlan 71
 name BHTQ-STAFF
 exit
vlan 72
 name BHTQ-SRV
 exit
vlan 73
 name BHTQ-GUEST
 exit
end
write memory
*/ 