#!/bin/sh
set -e

# ボリュームマウント等で pagemake が後から現れた場合も pip インストール
if [ -f /app/pagemake/requirements.txt ]; then
  if ! python3 -c "import selenium" >/dev/null 2>&1; then
    echo "Installing pagemake Python dependencies..."
    pip3 install --break-system-packages -r /app/pagemake/requirements.txt
  fi
fi

exec "$@"
