#!/bin/sh
# /usr/libexec/qr-generate.sh
# Генерирует QR-код через qrencode, возвращает JSON с base64
# Аргументы: kind content size level identifier

kind="$1"
content="$2"
size="$3"
level="$4"
identifier="$5"

[ -z "$size" ] && size=8
[ -z "$level" ] && level=M

# Проверяем qrencode
if [ ! -x /usr/bin/qrencode ]; then
    echo '{"ok":false,"error":"qrencode не установлен"}'
    exit 0
fi

# Проверяем контент
if [ -z "$content" ]; then
    echo '{"ok":false,"error":"Пустой контент"}'
    exit 0
fi

# Генерируем timestamp с миллисекундами
stamp=$(date +%Y%m%d%H%M%S)
ms=$(date +%N | cut -c1-3)
stamp="${stamp}${ms}"

# Генерируем SVG
svg_file="/tmp/qrencode/${stamp}.svg"
mkdir -p /tmp/qrencode

if ! /usr/bin/qrencode -t SVG -o "$svg_file" -s "$size" -l "$level" -- "$content" 2>/dev/null; then
    echo "{\"ok\":false,\"error\":\"qrencode вернул ошибку\"}"
    exit 0
fi

# Кодируем в base64
b64=$(base64 -w0 "$svg_file" 2>/dev/null)
rm -f "$svg_file"

if [ -z "$b64" ]; then
    echo '{"ok":false,"error":"base64 кодирование не удалось"}'
    exit 0
fi

# Возвращаем JSON
echo "{\"ok\":true,\"image\":\"$b64\",\"stamp\":\"$stamp\",\"kind\":\"$kind\"}"
