'use strict';
'require view';
'require form';

/*
 * Configuration page:
 *  1. the classic bandwidthd daemon settings (per-IP graphs), replacing
 *     the old Lua CBI page of AlexZhuo/luci-app-bandwidthd;
 *  2. the WAN daily/monthly statistics (wanstats) settings.
 */

var mBandwidthd = new form.Map('bandwidthd', _('Bandwidthd'),
	_('Bandwidthd 按 IP 统计局域网流量并绘图。') + '<br/>' +
	_('图形观察页面') + ': <a href="/bandwidthd" target="_blank">/bandwidthd</a>');

var s = mBandwidthd.section(form.TypedSection, 'bandwidthd', '');
s.addremove = false;
s.anonymous = true;

var o;

o = s.option(form.Flag, 'enabled', _('Enable'));
o.rmempty = false;

o = s.option(form.Value, 'dev', _('dev'), _('被监控网卡，如 br-lan'));
o.rmempty = false;

o = s.option(form.Value, 'subnets', _('subnets'), _('被监控网段，如 10.0.1.0/24'));
o.rmempty = false;

o = s.option(form.Value, 'skip_intervals', _('skip_intervals'));
o.datatype = 'uinteger';

o = s.option(form.Value, 'graph_cutoff', _('graph_cutoff'));
o.datatype = 'uinteger';

o = s.option(form.Flag, 'promiscuous', _('promiscuous'));
o = s.option(form.Flag, 'output_cdf', _('output_cdf'), _('把数据写入 CDF 文件（持久化必需）'));
o = s.option(form.Flag, 'recover_cdf', _('recover_cdf'), _('启动时读回 CDF 文件恢复历史'));
o = s.option(form.Value, 'filter', _('filter'));
o = s.option(form.Flag, 'graph', _('graph'));
o = s.option(form.Value, 'meta_refresh', _('meta_refresh'));
o.datatype = 'uinteger';

var mWanstats = new form.Map('wanstats', _('WAN流量统计'),
	_('按 Padavan rstats 的方式统计 WAN 口每日/每月总流量，历史保存 13 个月，超期自动删除。统计结果在「状态 - WAN流量统计」页面查看。'));

var s2 = mWanstats.section(form.NamedSection, 'settings', 'wanstats', '');
s2.addremove = false;

o = s2.option(form.Flag, 'enabled', _('启用采集'));
o.rmempty = false;

o = s2.option(form.Value, 'interface', _('WAN 逻辑接口'),
	_('用于自动获取 WAN 设备名，一般填 wan'));
o.placeholder = 'wan';

o = s2.option(form.Value, 'device', _('WAN 设备名（可选）'),
	_('留空自动检测。PPPoE 时自动检测到的是 pppoe-wan（拨号会话的流量）；如需按物理口统计可填物理网卡名，如 eth1'));
o.placeholder = _('自动检测');

o = s2.option(form.Value, 'data_dir', _('数据保存目录'),
	_('每日流量历史与采样状态保存在此目录。放在硬盘/外置存储上可跨固件升级保留，如 /mnt/sdb2/tongji-wan'));
o.placeholder = '/etc/wanstats';

o = s2.option(form.Value, 'interval', _('采样间隔（秒）'));
o.datatype = 'uinteger';
o.placeholder = '60';

o = s2.option(form.Value, 'retention_months', _('保留月数'),
	_('保留当月加此前 N-1 个月的数据，默认 13'));
o.datatype = 'uinteger';
o.placeholder = '13';

return view.extend({
	render: function () {
		return Promise.all([
			mBandwidthd.render(),
			mWanstats.render()
		]).then(function (nodes) {
			return E('div', {}, nodes);
		});
	}
});
