'use strict';
'require view';
'require form';
'require rpc';

/*
 * WAN流量统计设置 - the counted interface is selectable:
 *   auto       follow the logical WAN interface (its current l3_device);
 *              switching PPPoE <-> DHCP/static is picked up automatically
 *   if:<name>  count the l3_device of that logical interface
 *   dev:<name> count this physical device, whatever the WAN setup is
 */

var callOptions = rpc.declare({
	object: 'wanstats',
	method: 'get_options',
	expect: { '': {} }
});

return view.extend({
	load: function () {
		return callOptions().catch(function () {
			return { interfaces: [], devices: [] };
		});
	},

	render: function (data) {
		var ifaces = (data && data.interfaces) || [];
		var devices = (data && data.devices) || [];

		var wanNow = '';
		ifaces.forEach(function (ifc) {
			if (ifc.name === 'wan')
				wanNow = ifc.l3_device || ifc.device || '';
		});

		var m = new form.Map('wanstats', _('WAN流量统计设置'),
			_('选择要统计哪个接口的流量。自动模式跟随逻辑接口 wan：拨号时统计 pppoe-wan，改成 DHCP 或静态地址后会自动统计其物理网卡，不用改设置。'));

		var s = m.section(form.NamedSection, 'settings', 'wanstats', '');
		s.addremove = false;

		var o;

		o = s.option(form.Flag, 'enabled', _('启用采集'));
		o.rmempty = false;

		o = s.option(form.ListValue, 'selection', _('统计接口'));
		o.value('auto', _('自动（跟随 WAN 接口）') + (wanNow ? ' - ' + _('当前') + ': ' + wanNow : ''));
		ifaces.forEach(function (ifc) {
			var dev = ifc.l3_device || ifc.device || '';
			o.value('if:' + ifc.name,
				_('逻辑接口') + ' ' + ifc.name +
				(ifc.proto ? ' (' + ifc.proto + ')' : '') +
				(dev ? ' - ' + dev : ''));
		});
		devices.forEach(function (d) {
			if (d === 'lo') return;
			o.value('dev:' + d, _('物理设备') + ' ' + d);
		});
		o.default = 'auto';
		o.rmempty = false;

		o = s.option(form.Value, 'data_dir', _('数据保存目录'),
			_('每日流量历史与采样状态保存在此目录。放在硬盘/外置存储上可跨固件升级保留，如 /mnt/sdb2/tongji-wan'));
		o.placeholder = '/etc/wanstats';

		o = s.option(form.Value, 'interval', _('采样间隔（秒）'));
		o.datatype = 'uinteger';
		o.placeholder = '60';

		o = s.option(form.Value, 'retention_months', _('保留月数'),
			_('保留当月加此前 N-1 个月的数据，默认 13'));
		o.datatype = 'uinteger';
		o.placeholder = '13';

		return m.render();
	}
});
