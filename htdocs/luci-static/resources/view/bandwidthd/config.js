'use strict';
'require view';
'require form';

/*
 * Configuration page for the classic bandwidthd daemon (per-IP graphs),
 * replacing the old Lua CBI page of AlexZhuo/luci-app-bandwidthd.
 * The WAN daily/monthly statistics have their own settings page:
 * view/bandwidthd/settings.js (menu: Network -> WAN流量统计).
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

return view.extend({
	render: function () {
		return mBandwidthd.render();
	}
});
