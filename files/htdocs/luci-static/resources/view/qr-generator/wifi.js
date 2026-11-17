'use strict';
'require view';
'require ui';

function ubusCall(object, method, params) {
	return fetch('/ubus', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			jsonrpc: '2.0',
			id: 1,
			method: 'call',
			params: [0, object, method, params || {}]
		})
	}).then(function(resp) {
		return resp.json();
	}).then(function(data) {
		if (data.error) throw new Error(data.error.message || String(data.error));
		var r = data.result;
		if (Array.isArray(r) && r.length >= 2 && r[0] !== 0) {
			throw new Error('UBUS error code: ' + r[0]);
		}
		return Array.isArray(r) && r.length >= 2 ? r[1] : r;
	});
}

function callList() {
	return ubusCall('luci.qr-generator', 'wifi', {});
}

function callGen(kind, content, size, level, identifier) {
	return fetch('/cgi-bin/qr-generate', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ kind, content, size, level, identifier })
	}).then(function(resp) {
		return resp.json();
	}).then(function(data) {
		return { ok: data.ok, error: data.error, image: data.image, log: data.stamp || '/tmp/generateq/logs/' };
	});
}

function sizeSelect() {
	return E('select', { 'class': 'cbi-input-select' }, [1, 2, 4, 6, 8, 10, 12, 16, 20].map(function(n) {
		return E('option', { 'value': n, 'selected': n === 8 }, String(n));
	}));
}

function levelSelect() {
	return E('select', { 'class': 'cbi-input-select' }, ['L', 'M', 'Q', 'H'].map(function(n) {
		return E('option', { 'value': n, 'selected': n === 'M' }, n);
	}));
}

function showQR(net, button, size, level) {
	button.disabled = true;
	button.textContent = 'Создание...';

	var payload = net.ssid || '';
	var enc = net.encryption || 'none';
	var content = 'WIFI:T:' + enc + ';S:' + encodeURIComponent(net.ssid) + ';';

	if (enc && enc !== 'none' && enc !== 'owe') {
		var pass = prompt('Введите пароль для ' + net.ssid + ':');
		if (pass === null) {
			button.disabled = false;
			button.textContent = 'Показать QR';
			return;
		}
		content += 'P:' + pass + ';';
	}
	content += ';;';

	callGen('wifi', content, +size.value, level.value, net.ssid).then(function(response) {
		if (!response || !response.ok || !response.image)
			throw new Error(response && response.error || ('Не удалось создать QR-код. См. логи: ' + (response.log || '/tmp/generateq/logs/')));
		ui.showModal('Wi-Fi QR: ' + net.ssid, [
			E('div', { 'style': 'text-align:center; padding:15px' }, [
				E('img', {
					'src': 'data:image/svg+xml;base64,' + response.image,
					'style': 'max-width:100%; height:auto; image-rendering:pixelated'
				}),
				E('p', {}, net.ssid || 'Скрытая сеть'),
				E('p', {}, 'Защита: ' + enc)
			]),
			E('div', { 'style': 'text-align:left; word-break:break-all; padding:0 15px 15px 15px' }, [
				E('b', {}, 'QR-код:'),
				E('pre', { 'style': 'margin:8px 0 0 0; padding:8px; background:#f5f5f5; border:1px solid #ddd; word-break:break-all' }, [E('code', {}, content)])
			]),
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'btn cbi-button', 'click': ui.hideModal }, 'Закрыть')
			])
		]);
	}).catch(function(error) {
		ui.addNotification(null, E('p', {}, error.message || String(error)));
	}).finally(function() {
		button.disabled = false;
		button.textContent = 'Показать QR';
	});
}

return view.extend({
	load: function() {
		return callList().then(function(d) {
			return { networks: (d && d.networks) || [] };
		}).catch(function(error) {
			return { networks: [] };
		});
	},

	render: function(data) {
		var networks = data && data.networks ? data.networks : [];

		var size = sizeSelect();
		var level = levelSelect();

		var rows = [];
		for (var i in networks) {
			var net = networks[i];
			var button = E('button', {
				'class': 'btn cbi-button cbi-button-action',
				'click': (function(n, s, l) { return function() { showQR(n, button, s, l); }; })(net, size, level)
			}, 'Показать QR');

			rows.push(E('tr', {}, [
				E('td', {}, net.ssid || '(скрытая сеть)'),
				E('td', {}, net.encryption || 'none'),
				E('td', {}, net.id),
				E('td', {}, button)
			]));
		}

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, 'Wi-Fi'),
			E('p', {}, 'QR-коды для точек доступа роутера. Список обновляется при каждом открытии вкладки.'),
			E('div', { 'style': 'margin-bottom:10px' }, [
				E('label', { 'class': 'cbi-value-title' }, 'Размер'),
				size,
				E('label', { 'class': 'cbi-value-title', 'style': 'margin-left:15px' }, 'Коррекция ошибок'),
				level
			]),
			networks.length ? E('table', { 'class': 'table' }, [
				E('tr', {}, [ E('th', {}, 'Имя сети'), E('th', {}, 'Защита'), E('th', {}, 'Интерфейс'), E('th', {}, 'Действие') ]),
				...rows
			]) : E('p', {}, 'Включённые точки доступа не найдены.')
		]);
	}
});
