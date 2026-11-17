#!/usr/bin/env ucode

'use strict';

import { access, popen, open, unlink, rename } from 'fs';
import { cursor } from 'uci';

const uci = cursor();

const BASE_DIR = '/tmp/generateq';
const LOG_DIR = BASE_DIR + '/logs';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/* ---------- логирование ---------- */

function log_path_for(ts) {
	let t = localtime(ts);
	return LOG_DIR + '/' + sprintf('%04d%02d%02d.log', t.year, t.mon, t.mday);
}

function now_ms() {
	let c = clock();
	if (c) {
		let nsec = c[1];
		let ms = 0;
		while (nsec >= 1000000) { nsec -= 1000000; ms += 1; }
		return c[0] * 1000 + ms;
	}
	return time() * 1000;
}

function log_write(level, context, message, detail) {
	let ts = time();
	let t = localtime(ts);
	let ms = now_ms() % 1000;
	let stamp = sprintf('%02d:%02d:%02d.%03d', t.hour, t.min, t.sec, ms);
	let line = '[' + stamp + '] [' + level + ':' + context + '] ' + message;
	if (detail != null && detail != '')
		line += ' | detail: ' + detail;
	let path = log_path_for(ts);
	let f = null;
	try {
		f = open(path, 'a', 0o600);
		if (f) {
			f.write(line + '\n');
			f.close();
		}
	} catch (e) {
		system('echo "' + line + '" >> ' + path);
	}
	return path;
}

function log_debug(context, message, detail) {
	return log_write('DEBUG', context, message, detail);
}

function log_info(context, message, detail) {
	return log_write('INFO', context, message, detail);
}

function log_warn(context, message, detail) {
	return log_write('WARN', context, message, detail);
}

function log_error(context, message, detail) {
	return log_write('ERROR', context, message, detail);
}

/* ---------- время ---------- */

function fmt_ts(ts, ms) {
	let t = localtime(ts);
	let msec = (ms == null) ? 0 : ms;
	return sprintf('%04d%02d%02d%02d%02d%02d%03d', t.year, t.mon, t.mday, t.hour, t.min, t.sec, msec);
}

/* ---------- файловая система ---------- */

function ensure_dirs() {
	system('mkdir -p ' + BASE_DIR);
	system('mkdir -p ' + LOG_DIR);
	system('mkdir -p /tmp/qrencode');
	system('touch ' + BASE_DIR + '/text.encode');
	system('touch ' + BASE_DIR + '/wifi.encode');
	system('touch ' + BASE_DIR + '/email.encode');
	system('touch ' + BASE_DIR + '/url.encode');
	return true;
}

function image_file(kind) {
	return BASE_DIR + '/' + kind + '.encode';
}

function image_save(kind, line, context) {
	let lp = log_path_for(time());
	let path = image_file(kind);
	try {
		let f = open(path, 'r');
		if (f) {
			let data = f.read('all');
			let first = split(data, '\n')[0];
			if (length(first)) {
				let parts = split(first, '\t');
				let oldStamp = parts[0];
				if (type(oldStamp) == 'string' && length(oldStamp) > 0) {
					let ago = fmt_ts(time() - (MAX_AGE_MS / 1000), 0);
					if (oldStamp < ago) {
						try { unlink(path); } catch (e) {}
					}
				}
			}
		}
	} catch (e) {}
	let tmp = path + '.tmp';
	let f2 = null;
	try {
		f2 = open(tmp, 'w', 0o600);
		f2.write(line + '\n');
		f2.close();
		rename(tmp, path);
	} catch (e2) {
		try { unlink(tmp); } catch (e3) {}
		return { ok: false, log: lp };
	}
	return { ok: true, log: lp };
}

/* ---------- base64 ---------- */

function base64_file(path, context) {
	let lp = log_path_for(time());
	log_debug(context, 'base64_file', 'вход: path=' + path);
	let proc = null;
	try {
		proc = popen(['/bin/busybox', 'base64', path], 'r');
	} catch (e) {
		log_error(context, 'Не удалось запустить base64', JSON.stringify(path) + ' | ' + e, lp);
		return { ok: false, log: lp };
	}
	if (!proc) {
		log_error(context, 'popen вернул null для base64', path, lp);
		return { ok: false, log: lp };
	}
	let out = '';
	let code = -1;
	try {
		out = proc.read('all');
		code = proc.close();
	} catch (e) {
		log_error(context, 'Ошибка чтения/закрытия base64', path + ' | ' + e, lp);
		return { ok: false, log: lp };
	}
	if (code != 0 || !length(out)) {
		log_error(context, 'base64 вернул ошибку', path + ', код: ' + code, lp);
		return { ok: false, log: lp };
	}
	log_debug(context, 'base64_file', 'успех: path=' + path + ', размер=' + length(out), lp);
	return { ok: true, data: replace(out, /\s+$/, '') };
}

function base64_str(str, context) {
	let lp = log_path_for(time());
	let tmp = BASE_DIR + '/.b64enc';
	let f = null;
	try {
		f = open(tmp, 'w', 0o600);
		f.write(str);
		f.close();
	} catch (e) {
		try { f.close(); } catch (e2) {}
		log_error(context, 'Не удалось записать временный файл base64', tmp + ' | ' + e, lp);
		return { ok: false, log: lp };
	}
	let r = base64_file(tmp, context);
	try { unlink(tmp); } catch (e) {}
	return r;
}

function base64_decode(b64, context) {
	let lp = log_path_for(time());
	let tmp = BASE_DIR + '/.b64dec';
	let f = null;
	try {
		f = open(tmp, 'w', 0o600);
		f.write(b64);
		f.close();
	} catch (e) {
		try { f.close(); } catch (e2) {}
		log_error(context, 'Не удалось записать временный файл base64 декодирования', tmp + ' | ' + e, lp);
		return { ok: false, log: lp };
	}
	let proc = null;
	try {
		proc = popen(['/bin/busybox', 'base64', '-d', tmp], 'r');
	} catch (e) {
		log_error(context, 'Не удалось запустить base64 -d', ' | ' + e, lp);
		return { ok: false, log: lp };
	}
	if (!proc) {
		log_error(context, 'popen вернул null для base64 -d', '', lp);
		return { ok: false, log: lp };
	}
	let out = '';
	let code = -1;
	try {
		out = proc.read('all');
		code = proc.close();
	} catch (e) {
		log_error(context, 'Ошибка чтения base64 -d', ' | ' + e, lp);
		return { ok: false, log: lp };
	}
	try { unlink(tmp); } catch (e) {}
	if (code != 0) {
		log_error(context, 'base64 -d вернул ошибку', 'код: ' + code, lp);
		return { ok: false, log: lp };
	}
	return { ok: true, data: out };
}

/* ---------- генерация QR через bash скрипт ---------- */

function qr_generate_via_script(content, size, level, context) {
	let lp = log_path_for(time());
	log_info(context, 'Генерация QR через скрипт', 'size=' + size + ' level=' + level + ' len=' + length(content), lp);

	let stamp = fmt_ts(time(), now_ms());

	let proc = null;
	try {
		proc = popen(['/usr/libexec/qr-generate.sh', kind_from_content(content), content, size, level, stamp], 'r');
	} catch (e) {
		log_error(context, 'Не удалось запустить qr-generate.sh', ' | ' + e, lp);
		return { ok: false, error: 'Не удалось запустить скрипт', log: lp };
	}
	if (!proc) {
		log_error(context, 'popen вернул null для qr-generate.sh', '', lp);
		return { ok: false, error: 'Не удалось запустить скрипт', log: lp };
	}

	let out = '';
	let code = -1;
	try {
		out = proc.read('all');
		code = proc.close();
	} catch (e) {
		log_error(context, 'Ошибка чтения qr-generate.sh', ' | ' + e, lp);
		return { ok: false, error: 'Ошибка чтения скрипта', log: lp };
	}

	if (code != 0 || !length(out)) {
		log_error(context, 'qr-generate.sh вернул ошибку', 'код: ' + code, lp);
		return { ok: false, error: 'qr-generate.sh вернул ошибку', log: lp };
	}

	let resp = json(out);
	if (type(resp) != 'object' || !resp.ok) {
		log_error(context, 'qr-generate.sh вернул некорректный ответ', out, lp);
		return { ok: false, error: resp && resp.error ? resp.error : 'Некорректный ответ скрипта', log: lp };
	}

	log_info(context, 'QR-код сгенерирован через скрипт', 'размер=' + length(resp.image) + ' stamp=' + resp.stamp, lp);
	return { ok: true, image: resp.image, stamp: resp.stamp, log: lp };
}

function kind_from_content(content) {
	if (index(['mailto:', 'WIFI:T:'], content) != -1) {
		if (index(content, 'WIFI:T:') != -1) return 'wifi';
		if (index(content, 'mailto:') != -1) return 'email';
	}
	if (index(content, 'BEGIN:VCARD') == 0) return 'vcard';
	return 'text';
}

function wifi_escape(value) {
	return replace('' + (value ?? ''), /([\\;,:"])/g, '\\$1');
}

function build_wifi_payload(section, context) {
	let ssid = section.ssid || '';
	let encryption = section.encryption || 'none';
	let password = section.key || '';
	let security = 'nopass';

	if (encryption != 'none' && encryption != 'owe') {
		if (!password) return null;
		security = 'WPA';
	}

	let payload = 'WIFI:T:' + security + ';S:' + wifi_escape(ssid) + ';';
	if (security != 'nopass') payload += 'P:' + wifi_escape(password) + ';';
	if (section.hidden == '1') payload += 'H:true;';
	payload += ';';

	return { payload: payload, ssid: ssid, encryption: encryption };
}

/* ---------- RPC методы ---------- */

const methods = {
	status: {
		call: function(request) {
			let lp = log_path_for(time());
			let avail = !!access('/usr/bin/qrencode', 'x');
			return { available: avail, log: lp };
		}
	},

	generate_typed: {
		call: function(request) {
			let lp = log_path_for(time());
			let args = request.args || {};
			let kind = args.kind || 'text';
			let content = args.content;
			let size = args.size ?? 8;
			let level = args.level ?? 'M';
			let identifier = args.identifier || '';

			if (index(['text', 'email', 'url', 'vcard'], kind) == -1) {
				return { ok: false, error: 'Неизвестный тип', log: lp };
			}
			if (type(content) != 'string' || length(content) == 0) {
				return { ok: false, error: 'Пустой контент', log: lp };
			}

			let r = qr_generate_via_script(content, size, level, 'generate_typed');
			if (!r.ok) return { ok: false, error: r.error, log: r.log };

			let id = r.stamp;
			let b64 = base64_str(json({ kind: kind, content: content, identifier: identifier }), 'generate_typed');
			if (!b64.ok) return { ok: false, error: 'base64 ошибка', log: b64.log };

			let line = id + '\t' + b64.data + '\t' + r.image;
			let save = image_save(kind, line, 'generate_typed');
			if (!save.ok) return { ok: false, error: 'Не удалось сохранить картинку. Подробнее в логе: ' + save.log, log: save.log };

			return { ok: true, id: id, kind: kind, image: r.image, content: content, log: save.log };
		}
	},

	wifi_generate: {
		call: function(request) {
			let lp = log_path_for(time());
			let args = request.args || {};
			let id = args.id;
			let size = args.size ?? 8;
			let level = args.level ?? 'M';

			if (type(id) != 'string' || !match(id, /^[a-zA-Z0-9_]+$/)) {
				return { ok: false, error: 'Некорректный интерфейс', log: lp };
			}
			if (type(size) != 'int' || size < 1 || size > 20) {
				return { ok: false, error: 'Некорректный размер', log: lp };
			}
			if (index(['L', 'M', 'Q', 'H'], level) == -1) {
				return { ok: false, error: 'Некорректный уровень', log: lp };
			}

			let section = null;
			uci.foreach('wireless', 'wifi-iface', function(s) {
				if (s['.name'] == id && s.mode == 'ap' && s.disabled != '1') section = s;
			});

			if (!section) return { ok: false, error: 'Точка не найдена', log: lp };

			let wp = build_wifi_payload(section, 'wifi_generate');
			if (!wp) return { ok: false, error: 'Не удалось сформировать payload', log: lp };

			let r = qr_generate_via_script(wp.payload, size, level, 'wifi_generate');
			if (!r.ok) return { ok: false, error: r.error, log: r.log };

			let info = base64_str(json({ kind: 'wifi', content: wp.payload, identifier: wp.ssid || '(скрытая)' }), 'wifi_generate');
			if (!info.ok) return { ok: false, error: 'Не удалось закодировать информацию в base64. Подробнее в логе: ' + info.log, log: info.log };
			let line = r.stamp + '\t' + info.data + '\t' + r.image;
			let save = image_save('wifi', line, 'wifi_generate');
			if (!save.ok) return { ok: false, error: 'Не удалось сохранить картинку. Подробнее в логе: ' + save.log, log: save.log };

			return { ok: true, ssid: wp.ssid, encryption: wp.encryption, image: r.image, content: wp.payload, log: save.log };
		}
	},

	wifi: {
		call: function(request) {
			let lp = log_path_for(time());
			let networks = [];
			uci.foreach('wireless', 'wifi-iface', function(section) {
				if (section.mode != 'ap' || section.disabled == '1') return;
				push(networks, { id: section['.name'], ssid: section.ssid || '', encryption: section.encryption || 'none' });
			});
			return { ok: true, networks: networks, log: lp };
		}
	}
};

return { 'luci.qr-generator': methods };
