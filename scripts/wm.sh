#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_DIR="$ROOT_DIR/.local"
PID_FILE="$LOCAL_DIR/server.pid"
LOG_FILE="$LOCAL_DIR/server.log"

NODE_VERSION="${NODE_VERSION:-v18.20.8}"
PORT="${PORT:-11021}"

detect_platform() {
  local os
  local arch
  os="$(uname -s)"
  arch="$(uname -m)"

  case "$os" in
    Darwin) os="darwin" ;;
    Linux) os="linux" ;;
    *)
      echo "Unsupported OS: $os" >&2
      exit 1
      ;;
  esac

  case "$arch" in
    arm64|aarch64) arch="arm64" ;;
    x86_64|amd64) arch="x64" ;;
    *)
      echo "Unsupported architecture: $arch" >&2
      exit 1
      ;;
  esac

  echo "${os}-${arch}"
}

ensure_local_node() {
  local platform
  local node_dir
  local tarball
  local url

  platform="$(detect_platform)"
  node_dir="$LOCAL_DIR/node-${NODE_VERSION}-${platform}"

  if [ ! -x "$node_dir/bin/node" ]; then
    mkdir -p "$LOCAL_DIR"
    tarball="node-${NODE_VERSION}-${platform}.tar.gz"
    url="https://nodejs.org/dist/${NODE_VERSION}/${tarball}"
    echo "Downloading Node ${NODE_VERSION} (${platform})..."
    curl -fsSLo "$LOCAL_DIR/$tarball" "$url"
    tar -xzf "$LOCAL_DIR/$tarball" -C "$LOCAL_DIR"
    rm -f "$LOCAL_DIR/$tarball"
  fi

  export PATH="$node_dir/bin:$PATH"
  hash -r
}

ensure_dependencies() {
  if [ ! -d "$ROOT_DIR/node_modules/better-sqlite3" ]; then
    echo "Installing dependencies..."
    (cd "$ROOT_DIR" && npm install)
  fi
}

is_running() {
  if [ ! -f "$PID_FILE" ]; then
    return 1
  fi

  local pid
  pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [ -z "$pid" ]; then
    return 1
  fi

  if kill -0 "$pid" >/dev/null 2>&1; then
    return 0
  fi

  return 1
}

start_background() {
  ensure_local_node
  ensure_dependencies
  mkdir -p "$LOCAL_DIR"

  if is_running; then
    local pid
    pid="$(cat "$PID_FILE")"
    echo "WeddingManager is already running (PID: $pid)"
    echo "URL: http://127.0.0.1:${PORT}"
    exit 0
  fi

  (
    cd "$ROOT_DIR"
    nohup node server.js >"$LOG_FILE" 2>&1 &
    echo $! >"$PID_FILE"
  )

  sleep 1
  if ! is_running; then
    echo "Failed to start service. Last logs:"
    tail -n 80 "$LOG_FILE" 2>/dev/null || true
    exit 1
  fi

  local pid
  pid="$(cat "$PID_FILE")"
  echo "WeddingManager started in background."
  echo "PID: $pid"
  echo "URL: http://127.0.0.1:${PORT}"
  echo "Log: $LOG_FILE"
}

run_foreground() {
  ensure_local_node
  ensure_dependencies

  echo "Running WeddingManager in foreground..."
  echo "URL: http://127.0.0.1:${PORT}"
  echo "Press Ctrl+C to stop."
  cd "$ROOT_DIR"
  exec node server.js
}

stop_service() {
  if ! is_running; then
    echo "WeddingManager is not running."
    rm -f "$PID_FILE"
    exit 0
  fi

  local pid
  pid="$(cat "$PID_FILE")"
  kill "$pid"
  rm -f "$PID_FILE"
  echo "Stopped WeddingManager (PID: $pid)."
}

show_status() {
  if is_running; then
    local pid
    pid="$(cat "$PID_FILE")"
    echo "WeddingManager is running (PID: $pid)"
    echo "URL: http://127.0.0.1:${PORT}"
    echo "Log: $LOG_FILE"
  else
    echo "WeddingManager is not running."
  fi
}

follow_logs() {
  mkdir -p "$LOCAL_DIR"
  touch "$LOG_FILE"
  echo "Following logs: $LOG_FILE"
  tail -f "$LOG_FILE"
}

usage() {
  cat <<'EOF'
Usage:
  ./scripts/wm.sh start       Start service in background (one-click)
  ./scripts/wm.sh foreground  Run service in foreground (live logs)
  ./scripts/wm.sh stop        Stop background service
  ./scripts/wm.sh status      Show service status
  ./scripts/wm.sh logs        Tail background logs
EOF
}

COMMAND="${1:-start}"
case "$COMMAND" in
  start)
    start_background
    ;;
  foreground|fg)
    run_foreground
    ;;
  stop)
    stop_service
    ;;
  status)
    show_status
    ;;
  logs)
    follow_logs
    ;;
  *)
    usage
    exit 1
    ;;
esac
