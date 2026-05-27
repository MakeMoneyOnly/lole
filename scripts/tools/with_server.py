#!/usr/bin/env python3
"""
Run one or more dev servers, wait for readiness, then run a command.

Examples:
  python scripts/with_server.py --server "pnpm dev" --port 3000 -- python e2e/run.py
  python scripts/with_server.py --server "pnpm api:dev" --port 4000 --server "pnpm web:dev" --port 3000 -- python tests/smoke.py
"""

from __future__ import annotations

import argparse
import signal
import socket
import subprocess  # nosec B404
import sys
import threading
import time
from dataclasses import dataclass
from typing import Iterable, List, Optional


@dataclass
class ManagedServer:
    name: str
    command: str
    port: Optional[int]
    process: subprocess.Popen[str]


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run servers, wait for ports, then execute a command."
    )
    parser.add_argument(
        "--server",
        action="append",
        default=[],
        help="Server command to run. Can be provided multiple times.",
    )
    parser.add_argument(
        "--port",
        action="append",
        type=int,
        default=[],
        help="Readiness port for each --server (same order). Optional.",
    )
    parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="Host used for readiness checks (default: 127.0.0.1).",
    )
    parser.add_argument(
        "--startup-timeout",
        type=float,
        default=90.0,
        help="Seconds to wait for each readiness port (default: 90).",
    )
    parser.add_argument(
        "--poll-interval",
        type=float,
        default=0.25,
        help="Seconds between readiness checks (default: 0.25).",
    )
    parser.add_argument(
        "command",
        nargs=argparse.REMAINDER,
        help="Command to run after servers are ready. Prefix with --",
    )
    return parser.parse_args()


def _is_port_open(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        return sock.connect_ex((host, port)) == 0


def _wait_for_port(
    *,
    host: str,
    port: int,
    timeout_seconds: float,
    poll_interval: float,
    process: subprocess.Popen[str],
) -> bool:
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        if process.poll() is not None:
            return False
        if _is_port_open(host, port):
            return True
        time.sleep(poll_interval)
    return False


def _stream_output(prefix: str, process: subprocess.Popen[str]) -> None:
    if process.stdout is None:
        return
    for line in iter(process.stdout.readline, ""):
        if not line:
            break
        sys.stdout.write(f"[{prefix}] {line}")
        sys.stdout.flush()


def _start_servers(
    server_commands: List[str],
    ports: List[Optional[int]],
) -> List[ManagedServer]:
    servers: List[ManagedServer] = []
    for i, command in enumerate(server_commands):
        name = f"server-{i + 1}"
        process = subprocess.Popen(
            command,
            shell=True,  # nosec B602
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
        threading.Thread(
            target=_stream_output, args=(name, process), daemon=True
        ).start()
        servers.append(
            ManagedServer(name=name, command=command, port=ports[i], process=process)
        )
    return servers


def _terminate_servers(servers: Iterable[ManagedServer]) -> None:
    for server in servers:
        if server.process.poll() is None:
            server.process.terminate()
    for server in servers:
        if server.process.poll() is None:
            try:
                server.process.wait(timeout=8)
            except subprocess.TimeoutExpired:
                server.process.kill()


def main() -> int:
    args = _parse_args()

    if not args.server:
        print("Error: at least one --server command is required.", file=sys.stderr)
        return 2

    if len(args.port) > len(args.server):
        print(
            "Error: received more --port values than --server values.",
            file=sys.stderr,
        )
        return 2

    ports: List[Optional[int]] = [None] * len(args.server)
    for i, port in enumerate(args.port):
        ports[i] = port

    command = list(args.command)
    if command and command[0] == "--":
        command = command[1:]

    stop_requested = False

    def _handle_signal(signum: int, _frame: object) -> None:
        nonlocal stop_requested
        stop_requested = True
        print(f"\nReceived signal {signum}; shutting down...")

    signal.signal(signal.SIGINT, _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)

    servers = _start_servers(args.server, ports)

    try:
        for server in servers:
            if server.port is None:
                continue
            print(
                f"Waiting for {server.name} on {args.host}:{server.port} "
                f"(timeout: {args.startup_timeout:.0f}s)..."
            )
            ready = _wait_for_port(
                host=args.host,
                port=server.port,
                timeout_seconds=args.startup_timeout,
                poll_interval=args.poll_interval,
                process=server.process,
            )
            if not ready:
                print(
                    f"Error: {server.name} failed readiness check on port {server.port}.",
                    file=sys.stderr,
                )
                return 1

        if command:
            print(f"Running command: {' '.join(command)}")
            completed = subprocess.run(command, check=False)  # nosec B603
            return completed.returncode

        print("Servers are running. Press Ctrl+C to stop.")
        while not stop_requested:
            if any(server.process.poll() is not None for server in servers):
                return 1
            time.sleep(0.5)
        return 130
    finally:
        _terminate_servers(servers)


if __name__ == "__main__":
    raise SystemExit(main())
