# Release source: QR Code Generator 1.2-r1

Отдельная исходная папка для сборки OpenWrt LuCI-пакета `luci-app-qr-generator` версии 1.2-r1.

## Структура

- Makefile — стандартный Makefile пакета LuCI (LUCI_TITLE, LUCI_DEPENDS, PKG_VERSION=1.2, PKG_RELEASE=1)
- files/ — файлы, устанавливаемые в целевую систему:
  - root/usr/share/rpcd/ucode/luci-qr-generator.uc — backend (ucode)
  - root/usr/share/rpcd/acl.d/luci-app-qr-generator.json — ACL
  - root/usr/share/luci/menu.d/luci-app-qr-generator.json — меню
  - root/usr/libexec/qr-generate.sh — генерация QR через qrencode
  - root/www/cgi-bin/qr-generate — CGI-скрипт генерации
  - htdocs/luci-static/resources/view/qr-generator/*.js — frontend (text/email/url/wifi)

## Что нужно для сборки

1. OpenWrt SDK — сборочная среда (обязательно):
   - Ссылка: https://downloads.openwrt.org/
   - Распаковка: SDK-артефакт распаковывается в отдельную директорию, например `/opt/openwrt-sdk`.
2. LuCI (пакет `luci-base` + feed `luci`) — для сборки LuCI backend/frontend:
   - Ссылка: https://github.com/openwrt/luci
   - Распаковка: клонировать/скопировать в `<sdk>/feeds/luci`.
3. qrencode — генерация QR:
   - Ссылка: https://git.openwrt.org/?p=project/qrencode.git
   - Пакет: `qrencode` (обычно уже входит в SDK feeds/base).

## Пошаговая сборка своей версии

1. Скопировать содержимое этой папки в свежий OpenWrt SDK:

   ```
   cp -r /path/to/release/* /opt/openwrt-sdk/package/luci-app-qr-generator/
   ```

2. Сборка:

   ```
   cd /opt/openwrt-sdk
   make package/luci-app-qr-generator/compile
   ```

3. APK появится в:

   ```
   /opt/openwrt-sdk/bin/packages/<arch>/<target>/luci-app-qr-generator-1.2-r1.apk
   ```

4. Установка на устройство:

   ```
   apk add --allow-untrusted /tmp/luci-app-qr-generator-1.2-r1.apk
   /etc/init.d/rpcd restart
   rm -f /tmp/luci-indexcache.*
   rm -rf /tmp/luci-modulecache/
   ```

## SHA256SUMS

Файл `SHA256SUMS` (в корне репозитория) содержит хеш последнего релиза:

```
872aacce32a5c0e83c6682d068c2e36716b0c9a24f8fdf4cf9d1b3ff8fc7f2a8  luci-app-qr-generator-1.2-r1.apk
```
