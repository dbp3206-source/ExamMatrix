#!/bin/bash
set -eu
export PORT="${PORT:-10000}"
database_address=${RENDER_DATABASE_URL:?Missing Render database connection string}
database_address=${database_address##*@}
export DB_URL="jdbc:postgresql://${database_address}"
envsubst '${PORT}' < /app/nginx.conf.template > /etc/nginx/http.d/exammatrix.conf

java -jar /app/app.jar &
backend_pid=$!
nginx -g 'daemon off;' &
nginx_pid=$!

stop() {
  kill -TERM "$nginx_pid" "$backend_pid" 2>/dev/null || true
  wait "$nginx_pid" "$backend_pid" 2>/dev/null || true
}
trap stop EXIT
trap 'exit 143' TERM
trap 'exit 130' INT
wait -n "$backend_pid" "$nginx_pid"
