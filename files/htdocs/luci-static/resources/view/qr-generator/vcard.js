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

return view.extend({
	load: function() {
		return Promise.resolve({});
	},

	render: function(data) {
		var result = E('div', { 'class': 'alert-message', 'style': 'display:none; margin-top:15px' });

		var content = E('textarea', {
			'class': 'cbi-input-textarea',
			'style': 'width:100%; min-height:160px',
			'placeholder': 'BEGIN:VCARD\nVERSION:3.0\nFN:Имя Фамилия\nORG:Организация\nTEL:+79001234567\nEMAIL:mail@example.com\nURL:https://example.com\nEND:VCARD'
		});

		var size = sizeSelect();
		var level = levelSelect();

		var button = E('button', {
			'class': 'btn cbi-button cbi-button-action',
			'click': function() {
				var text = content.value.trim();
				button.disabled = true;
				button.textContent = 'Создание...';
				callGen('vcard', text, +size.value, level.value, '').then(function(r) {
					result.style.display = '';
					if (r.ok) {
						result.className = 'alert-message success';
						result.textContent = 'QR-код создан.';
						var img = E('img', {
							'src': 'data:image/svg+xml;base64,' + r.image,
							'style': 'display:block; max-width:220px; height:auto; margin:10px auto; image-rendering:pixelated'
						});
						result.appendChild(img);
						content.value = '';
						var code = E('pre', { 'style': 'text-align:left; margin:10px 0 0 0; padding:8px; background:#f5f5f5; border:1px solid #ddd; max-height:150px; overflow:auto; word-break:break-all' }, [E('code', {}, text)]);
						result.appendChild(code);
					} else {
						result.className = 'alert-message error';
						result.textContent = r.error || ('Не удалось создать QR-код. См. логи: ' + (r.log || '/tmp/generateq/logs/'));
					}
				}).catch(function(error) {
					result.style.display = '';
					result.className = 'alert-message error';
					result.textContent = 'Ошибка: ' + error;
				}).finally(function() {
					button.disabled = false;
					button.textContent = 'Создать QR-код';
				});
			}
		}, 'Создать QR-код');

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, 'Визитка'),
			E('p', {}, 'QR-код визитки (vCard) со контактами для быстрого сохранения в телефоне.'),
			E('div', { 'class': 'cbi-section' }, [
				E('label', { 'class': 'cbi-value-title' }, 'Контакт (vCard)'),
				content,
				E('div', { 'style': 'margin-top:15px' }, [ E('label', { 'class': 'cbi-value-title' }, 'Размер'), size ]),
				E('div', { 'style': 'margin-top:15px' }, [ E('label', { 'class': 'cbi-value-title' }, 'Коррекция ошибок'), level ]),
				E('div', { 'style': 'margin-top:20px' }, [ button ]),
				result
			])
		]);
	}
});
