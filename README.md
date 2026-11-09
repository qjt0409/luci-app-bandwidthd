# luci-app-bandwidthd

OpenWrt LuCI 应用，包含两部分：

1. **bandwidthd 配置页**（网络 → Bandwidthd）：替代九年未更新的
   AlexZhuo/luci-app-bandwidthd 的旧 Lua 页面，改为现代 LuCI 的 JS 页面，
   字段与原版一致；bandwidthd 本体仍是 OpenWrt feed 里的 `bandwidthd`
   包（按 IP 统计局域网流量并绘图，观察页 `/bandwidthd`），本仓库不含其代码。
2. **WAN 流量统计**（状态 → WAN流量统计）：按 **Padavan 固件 rstats**
   的统计方式实现的 WAN 口每日/每月总流量表，就是 Padavan
   「网络流量 - 单日流量表 / 单月流量表」那种：只有日期、下行、上行、总量，
   没有按 IP 的明细。**历史保存 13 个月，超期自动删除。**

## Padavan 的统计方式（rstats）

Padavan 源码 `trunk/user/rc/rstats.c`（源自 Tomato 的 rstats，
© 2006-2009 Jonathan Zarate，GPL）：

- 守护进程每 **60 秒**读一次 `/proc/net/dev` 里 WAN 接口的收发字节计数器；
- 与上次采样的**差值**累加进两个环形缓冲：按日（键为年月日）和按月（键为年月）；
- 历史以二进制结构存到持久区 `/etc/storage/rstats-history`，重启不丢；
- 系统时间还没被 NTP 校准时不累计，避免把流量记进错误日期；
- Web 页通过 `bandwidth("history")` 让守护进程现写一份 JS 数据再渲染成
  单日/单月两张表。

## 本实现的对应与取舍

| 项 | Padavan rstats | 本实现 |
|---|---|---|
| 采样间隔 | 60 秒 | 60 秒（可配） |
| 计数来源 | `/proc/net/dev` | `/sys/class/net/<dev>/statistics/{rx,tx}_bytes`（64 位计数器，无 32 位溢出问题） |
| 计数器复位（重启/PPPoE 重拨） | 接口索引变化时以当前计数为差值 | 计数变小或设备名变化时，差值 = 当前计数（即复位以来流量）；复位前最后一分钟内的流量不可避免会丢，与 rstats 相同 |
| 时间未校准 | 不累计 | 同：纪元 < 2024-01-01 时只更新基线，不累计 |
| 每日数据 | 环形缓冲 62 天 | 文本文件 `daily.csv`，一行一天：`YYYY-MM-DD,下行字节,上行字节`，可直接查看/备份 |
| 每月数据 | 独立环形缓冲 25 个月 | **由每日数据求和得出**，日/月永远对得上，不会互相漂移 |
| 保存期限 | 日 62 天 / 月 25 个月（环形覆盖） | **13 个月**：保留当月 + 此前 12 个月的每日行，更早的行每次采样时自动删除 |
| 持久化位置 | `/etc/storage`（内置持久区） | UCI `data_dir`，默认 `/etc/wanstats`；可指向硬盘，如 `/mnt/sdb2/tongji-wan`，刷机保留配置或单独备份该目录即可带走历史 |

> 注意：统计口径是**所选 WAN 设备的总流量**（含协议开销），与运营商账单
> 口径会有小差异。PPPoE 时自动检测到的设备是 `pppoe-wan`；如想按物理口
> 统计，可在设置里把「WAN 设备名」填成物理网卡（如 `eth1`）。

## 文件布局

```
Makefile                                     OpenWrt 包定义（安装时用 INSTALL_BIN 装脚本，不依赖 git 文件权限位）
htdocs/luci-static/resources/view/bandwidthd/
    config.js                                配置页（bandwidthd + wanstats 两组设置）
    wanstats.js                              状态页：单日/单月流量表（Padavan 样式）
root/etc/config/wanstats                     默认配置
root/etc/init.d/wanstats                     procd 服务（含 reload trigger）
root/usr/sbin/wanstatsd                      采样循环
root/usr/sbin/wanstats-collect               单次采样（差值累计 + 13 个月清理，逻辑核心）
root/usr/libexec/rpcd/wanstats               rpcd 插件：get_history / get_status
root/usr/share/{rpcd/acl.d,luci/menu.d}/     LuCI 权限与菜单
tests/run-tests.sh                           沙盒测试（假计数器 + 固定时间）
```

## 配置（/etc/config/wanstats）

```
config wanstats 'settings'
	option enabled '1'              # 采集开关
	option selection 'auto'         # 统计接口：auto / if:<逻辑接口> / dev:<物理设备>（ LuCI 设置页下拉选择）
	option interface 'wan'          # 旧选项：auto 时的 WAN 逻辑接口
	option device ''                # 旧选项：auto 时的设备名覆盖，留空走 ubus l3_device
	option data_dir '/etc/wanstats' # 数据目录，建议放硬盘如 /mnt/sdb2/tongji-wan
	option interval '60'            # 采样间隔（秒）
	option retention_months '13'    # 保留月数
```

统计接口三种选法（LuCI「网络 → WAN流量统计」设置页，列表由系统实时生成）：

- **auto（推荐）**：跟随逻辑接口 wan 的当前 l3_device——PPPoE 时是 pppoe-wan，
  改成 DHCP/静态后自动变成其物理网卡，不用改设置；
- **if:\<逻辑接口\>**：钉死某个逻辑接口，统计它的 l3_device；
- **dev:\<物理设备\>**：钉死物理设备（如 eth1），含该口上的全部流量（含 PPPoE 封装开销）。

## 编译进固件

把本仓库克隆到固件源码的 `package/` 下：

```sh
git clone https://github.com/qjt0409/luci-app-bandwidthd package/luci-app-bandwidthd
make menuconfig   # LuCI / Network 里勾选 luci-app-bandwidthd（依赖 bandwidthd 会自动带入）
make package/luci-app-bandwidthd/compile
```

在本人的 OpenWrt 云编译仓库（qjt0409/OpenWRT）中，把 `Scripts/packages.sh`
里原 AlexZhuo 版的克隆地址换成本仓库地址即可无缝替换（包名相同）。

## 测试

```sh
sh tests/run-tests.sh
```

用假的 sysfs 计数器与固定纪元时间驱动真实的采样脚本，覆盖：
首次基线、同日累计、跨日新行、计数器复位、时钟未校准不累计、
13 个月清理（含跨年边界）、按物理设备选择统计、rpcd 历史/选项 JSON
与月度求和、脚本/JSON/JS 语法（共 24 项）。

## 独立子包 luci-app-wanstats

`luci-app-wanstats/` 子目录是同一套 wanstats 的独立打包（版本 1.1.0，
自有 acl/menu 名，不含 bandwidthd 配置页）：可与原版
AlexZhuo/luci-app-bandwidthd 并存安装。固件构建时克隆本仓库后
提取该子目录单独成包；与根目录整包**不要同机共装**（共享 wanstats
的服务与脚本文件）。

## 许可

MIT（见 LICENSE）。统计方法源自 Padavan 的 rstats（GPL），本仓库为
独立重写，未包含其代码；bandwidthd 本体为 OpenWrt feed 的独立软件包。
