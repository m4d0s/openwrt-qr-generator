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

function buildVCard(fn, org, phones, emails, urls) {
	var lines = ['BEGIN:VCARD', 'VERSION:3.0'];
	if (fn) lines.push('FN:' + fn);
	if (org) lines.push('ORG:' + org);
	for (var i = 0; i < phones.length; i++) {
		if (phones[i].value) lines.push('TEL;TYPE=' + (phones[i].type || 'CELL') + ':' + phones[i].value);
	}
	for (var j = 0; j < emails.length; j++) {
		if (emails[j].value) lines.push('EMAIL;TYPE=INTERNET:' + emails[j].value);
	}
	for (var k = 0; k < urls.length; k++) {
		if (urls[k].value) lines.push('URL:' + urls[k].value);
	}
	lines.push('END:VCARD');
	return lines.join('\r\n');
}

return view.extend({
	load: function() {
		return Promise.resolve({});
	},

	render: function(data) {
		var result = E('div', { 'class': 'alert-message', 'style': 'display:none; margin-top:15px' });

		var fnInput = E('input', { 'class': 'cbi-input-text', 'style': 'width:100%;', 'placeholder': 'Иван Иванов' });
		var orgInput = E('input', { 'class': 'cbi-input-text', 'style': 'width:100%;', 'placeholder': 'ООО «Ромашка»' });

		var phoneBox = E('div', { 'style': 'margin-top:10px;' });
		var phoneRows = [ { type: 'CELL', value: '' } ];

		function renderPhones() {
			while (phoneBox.firstChild) { phoneBox.removeChild(phoneBox.firstChild); }
			for (var i = 0; i < phoneRows.length; i++) {
				var row = E('div', { 'style': 'display:flex; align-items:center; gap:8px; margin-bottom:8px;' });
				var sel = E('select', { 'class': 'cbi-input-select', 'style': 'width:auto;' });
				['CELL', 'HOME', 'WORK', 'INTL'].forEach(function(t) { sel.appendChild(E('option', { 'value': t }, t)); });
				sel.value = phoneRows[i].type;
				var val = E('input', { 'class': 'cbi-input-text', 'style': 'flex:1;', 'value': phoneRows[i].value, 'placeholder': 'Номер телефона' });
				var rmBtn = E('button', { 'class': 'btn cbi-button', 'click': (function(idx) { return function() { phoneRows.splice(idx, 1); renderPhones(); }; })(i) }, 'Удалить');
				row.appendChild(sel);
				row.appendChild(val);
				row.appendChild(rmBtn);
				phoneBox.appendChild(row);
			}
		}
		renderPhones();

		var emailBox = E('div', { 'style': 'margin-top:10px;' });
		var emailRows = [ { value: '' } ];

		function renderEmails() {
			while (emailBox.firstChild) { emailBox.removeChild(emailBox.firstChild); }
			for (var j = 0; j < emailRows.length; j++) {
				var erow = E('div', { 'style': 'display:flex; align-items:center; gap:8px; margin-bottom:8px;' });
				var evalInput = E('input', { 'class': 'cbi-input-text', 'style': 'flex:1;', 'value': emailRows[j].value, 'placeholder': 'E-mail' });
				var erem = E('button', { 'class': 'btn cbi-button', 'click': (function(idx) { return function() { emailRows.splice(idx, 1); renderEmails(); }; })(j) }, 'Удалить');
				erow.appendChild(evalInput);
				erow.appendChild(erem);
				emailBox.appendChild(erow);
			}
		}
		renderEmails();

		var urlBox = E('div', { 'style': 'margin-top:10px;' });
		var urlRows = [ { value: '' } ];

		function renderUrls() {
			while (urlBox.firstChild) { urlBox.removeChild(urlBox.firstChild); }
			for (var k = 0; k < urlRows.length; k++) {
				var urow = E('div', { 'style': 'display:flex; align-items:center; gap:8px; margin-bottom:8px;' });
				var uval = E('input', { 'class': 'cbi-input-text', 'style': 'flex:1;', 'value': urlRows[k].value, 'placeholder': 'https://example.com' });
				var urem = E('button', { 'class': 'btn cbi-button', 'click': (function(idx) { return function() { urlRows.splice(idx, 1); renderUrls(); }; })(k) }, 'Удалить');
				urow.appendChild(uval);
				urow.appendChild(urem);
				urlBox.appendChild(urow);
			}
		}
		renderUrls();

		function addPhone() { phoneRows.push({ type: 'CELL', value: '' }); renderPhones(); }
		function addEmail() { emailRows.push({ value: '' }); renderEmails(); }
		function addUrl() { urlRows.push({ value: '' }); renderUrls(); }

		var size = sizeSelect();
		var level = levelSelect();

		var button = E('button', {
			'class': 'btn cbi-button cbi-button-action',
			'click': function() {
				var contentStr = buildVCard(fnInput.value.trim(), orgInput.value.trim(), phoneRows, emailRows, urlRows);
				button.disabled = true;
				button.textContent = 'Создание...';
				callGen('vcard', contentStr, +size.value, level.value, '').then(function(r) {
					result.style.display = '';
					if (r.ok) {
						result.className = 'alert-message success';
						result.textContent = 'Контекст QR-кода: ' + context;
						var img = E('img', {
							'src': 'data:image/svg+xml;base64,' + r.image,
							'style': 'display:block; max-width:220px; height:auto; margin:10px auto; image-rendering:pixelated'
						});
						result.appendChild(img);
						var code = E('pre', { 'style': 'text-align:left; margin:10px 0 0 0; padding:8px; background:#f5f5f5; border:1px solid #ddd; max-height:150px; overflow:auto; word-break:break-all' }, [E('code', {}, contentStr)]);
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
			E('p', {}, 'QR-код визитки vCard со списком контактов: ФИО, телефоны, e-mail и сайты.'),
			E('div', { 'class': 'cbi-section' }, [
				E('label', { 'class': 'cbi-value-title' }, 'ФИО'),
				fnInput,
				E('div', { 'style': 'margin-top:15px' }, [ E('label', { 'class': 'cbi-value-title' }, 'Организация'), orgInput ]),
				E('div', { 'style': 'margin-top:15px' }, [
					E('label', { 'class': 'cbi-value-title' }, 'Телефоны'),
					phoneBox,
					E('div', { 'style': 'margin-top:10px' }, [ E('button', { 'class': 'btn cbi-button', 'click': addPhone }, '+ Добавить телефон') ])
				]),
				E('div', { 'style': 'margin-top:15px' }, [
					E('label', { 'class': 'cbi-value-title' }, 'Электронные почты'),
					emailBox,
					E('div', { 'style': 'margin-top:10px' }, [ E('button', { 'class': 'btn cbi-button', 'click': addEmail }, '+ Добавить e-mail') ])
				]),
				E('div', { 'style': 'margin-top:15px' }, [
					E('label', { 'class': 'cbi-value-title' }, 'Сайты'),
					urlBox,
					E('div', { 'style': 'margin-top:10px' }, [ E('button', { 'class': 'btn cbi-button', 'click': addUrl }, '+ Добавить сайт') ])
				]),
				E('div', { 'style': 'margin-top:15px' }, [ E('label', { 'class': 'cbi-value-title' }, 'Размер'), size ]),
				E('div', { 'style': 'margin-top:15px' }, [ E('label', { 'class': 'cbi-value-title' }, 'Коррекция ошибок'), level ]),
				E('div', { 'style': 'margin-top:20px' }, [ button ]),
				result
			])
		]);
	}
});
