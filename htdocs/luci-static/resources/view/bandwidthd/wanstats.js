'use strict';
'require view';
'require rpc';
'require poll';
'require ui';

/*
 * WAN流量统计 - Padavan-style daily / monthly traffic tables.
 * Data comes from the rpcd object "wanstats" (see root/usr/libexec/rpcd/wanstats),
 * which reads the plain-text daily history written by wanstats-collect.
 */

var callHistory = rpc.declare({
	object: 'wanstats',
	method: 'get_history',
	expect: { '': {} }
});

var currentData = { daily: [], monthly: [], device: '', updated: 0 };
var currentUnit = 'GiB';
var currentTab = 'daily';

var UNITS = {
	'KiB': 1024,
	'MiB': 1024 * 1024,
	'GiB': 1024 * 1024 * 1024,
	'TiB': 1024 * 1024 * 1024 * 1024
};

function fmt(bytes) {
	var div = UNITS[currentUnit] || UNITS['GiB'];
	return (bytes / div).toFixed(2) + ' ' + currentUnit;
}

function fmtDailyDate(s) {
	/* 2026-02-05 -> 2026年2月5日 */
	var p = s.split('-');
	if (p.length !== 3) return s;
	return p[0] + '年' + parseInt(p[1], 10) + '月' + parseInt(p[2], 10) + '日';
}

function fmtMonth(s) {
	/* 2026-02 -> 2026年2月 */
	var p = s.split('-');
	if (p.length !== 2) return s;
	return p[0] + '年' + parseInt(p[1], 10) + '月';
}

function buildTable(rows, isDaily) {
	var head = E('tr', { 'class': 'tr table-titles' }, [
		E('th', { 'class': 'th left' }, _('日期')),
		E('th', { 'class': 'th right' }, _('下行')),
		E('th', { 'class': 'th right' }, _('上行')),
		E('th', { 'class': 'th right' }, _('总共量值'))
	]);

	var body = rows.map(function (r) {
		/* data-title is required: Argon's layout below 1152px hides the
		 * .table-titles row and labels each cell from its data-title. */
		return E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td left', 'data-title': _('日期') }, isDaily ? fmtDailyDate(r.date) : fmtMonth(r.month)),
			E('td', { 'class': 'td right', 'data-title': _('下行') }, fmt(r.rx)),
			E('td', { 'class': 'td right', 'data-title': _('上行') }, fmt(r.tx)),
			E('td', { 'class': 'td right', 'data-title': _('总共量值') }, fmt(r.rx + r.tx))
		]);
	});

	if (!body.length)
		body = [E('tr', { 'class': 'tr placeholder' },
			E('td', { 'class': 'td' }, _('暂无数据。采集服务每分钟采样一次，重启后需等待系统时间同步完成才会开始累计。')) )];

	return E('table', { 'class': 'table' }, [head].concat(body));
}

function redraw() {
	var dailyBox = document.getElementById('wanstats-daily');
	var monthlyBox = document.getElementById('wanstats-monthly');
	var summary = document.getElementById('wanstats-summary');
	if (!dailyBox || !monthlyBox) return;

	dailyBox.style.display = (currentTab === 'daily') ? '' : 'none';
	monthlyBox.style.display = (currentTab === 'monthly') ? '' : 'none';

	/* rebuild tables in place */
	dailyBox.innerHTML = '';
	dailyBox.appendChild(buildTable(currentData.daily || [], true));
	monthlyBox.innerHTML = '';
	monthlyBox.appendChild(buildTable(currentData.monthly || [], false));

	if (summary) {
		var d0 = (currentData.daily && currentData.daily[0]) || null;
		var m0 = (currentData.monthly && currentData.monthly[0]) || null;
		var parts = [];
		if (currentData.device) parts.push(_('统计接口') + ': ' + currentData.device);
		if (d0) parts.push(_('最近一日') + ' (' + d0.date + '): ' + fmt(d0.rx + d0.tx));
		if (m0) parts.push(_('最近一月') + ' (' + m0.month + '): ' + fmt(m0.rx + m0.tx));
		summary.textContent = parts.join('　|　');
	}
}

function applyData(data) {
	if (data && (data.daily || data.monthly))
		currentData = data;
	redraw();
}

return view.extend({
	load: function () {
		return callHistory().catch(function () {
			return { daily: [], monthly: [], device: '', updated: 0 };
		});
	},

	render: function (data) {
		currentData = data || currentData;

		var tabBtn = function (id, label) {
			return E('button', {
				'class': 'cbi-button',
				'click': function (ev) {
					ev.preventDefault();
					currentTab = id;
					redraw();
				}
			}, label);
		};

		var unitSel = E('select', {
			'class': 'cbi-input-select',
			'change': function (ev) {
				currentUnit = ev.target.value;
				redraw();
			}
		}, Object.keys(UNITS).map(function (u) {
			return E('option', { 'value': u, 'selected': (u === currentUnit) ? '' : null }, u);
		}));

		var node = E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('网络流量 - WAN')),
			E('div', { 'class': 'cbi-map-descr' },
				_('按 Padavan rstats 的方式统计 WAN 口流量：每分钟采样接口计数器，增量计入当天；每月流量为当月每日流量之和。历史保存 13 个月，超期自动删除。')),
			E('div', { 'id': 'wanstats-summary', 'style': 'margin:0.5em 0' }, ''),
			E('div', { 'style': 'margin:0.5em 0; display:flex; gap:0.5em; align-items:center' }, [
				tabBtn('daily', _('单日流量表')),
				tabBtn('monthly', _('单月流量表')),
				E('span', {}, _('单位:')),
				unitSel,
				E('button', {
					'class': 'cbi-button',
					'click': function (ev) {
						ev.preventDefault();
						return callHistory().then(applyData);
					}
				}, _('刷新'))
			]),
			E('div', { 'id': 'wanstats-daily' }, ''),
			E('div', { 'id': 'wanstats-monthly' }, '')
		]);

		poll.add(function () {
			return callHistory().then(applyData).catch(function () {});
		}, 60);

		/* first paint after the node is in the DOM */
		setTimeout(redraw, 0);
		return node;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
