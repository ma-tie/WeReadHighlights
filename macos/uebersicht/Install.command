#!/bin/zsh
set -eu

cd -- "${0:A:h}"
if [[ ! -f install.cjs ]]; then
  cd macos/uebersicht
fi
for app in /Applications/Übersicht.app "$HOME/Applications/Übersicht.app"; do
  runtime="$app/Contents/Resources/node-x64"
  if [[ "$(uname -m)" == arm64 ]]; then
    runtime="$app/Contents/Resources/node-arm64"
  fi
  if [[ -x "$runtime" ]]; then
    "$runtime" install.cjs
    /usr/bin/open "$app"
    exit 0
  fi
done

printf '%s\n' '请先把 Übersicht 安装到「应用程序」文件夹。' 'https://tracesof.net/uebersicht/'
exit 1
