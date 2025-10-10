import os
import sys
import time
import socket
import subprocess
import atexit
import signal
import grpc

class GatewayManager:
    """
    Ensures a Node.js UNS gateway is running.
    Can start it automatically if needed.
    """
    def __init__(self, addr: str | None = None, auto: bool = True, timeout_s: int = 20):
        self.addr = addr
        self.auto = auto
        self.timeout_s = timeout_s
        self._proc: subprocess.Popen | None = None

    def _default_addr(self) -> str:
        if os.name == "nt":
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(("127.0.0.1", 0))
                port = s.getsockname()[1]
            return f"127.0.0.1:{port}"
        else:
            script = os.path.basename(sys.argv[0]).replace(".py", "")
            return f"unix:/tmp/uns-gateway-{script}-{os.getpid()}.sock"

    def _cleanup(self):
        if not self._proc:
            return
        try:
            if self._proc.poll() is None:
                if os.name == "nt":
                    self._proc.terminate()
                else:
                    os.killpg(os.getpgid(self._proc.pid), signal.SIGTERM)
                try:
                    self._proc.wait(timeout=3)
                except Exception:
                    if os.name == "nt":
                        self._proc.kill()
                    else:
                        os.killpg(os.getpgid(self._proc.pid), signal.SIGKILL)
        except Exception:
            pass
        self._proc = None

    def ensure_running(self) -> str:
        addr = self.addr or self._default_addr()
        ch = grpc.insecure_channel(addr)
        try:
            grpc.channel_ready_future(ch).result(timeout=2)
            ch.close()
            return addr
        except Exception:
            ch.close()
            if not self.auto:
                return addr

        # Spawn Node.js gateway
        repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        cli_path = os.path.join(repo_root, "node_modules", "@uns-kit", "core", "dist", "uns-grpc", "uns-gateway-cli")
        popen_kwargs = {}
        creationflags = 0
        if os.name != "nt":
            popen_kwargs["preexec_fn"] = os.setsid
        else:
            creationflags = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)

        suffix = f"py-{os.path.basename(sys.argv[0]).replace('.py','')}-{os.getpid()}"
        self._proc = subprocess.Popen(
            ["node", cli_path, "--addr", addr, "--instanceSuffix", suffix, "--instanceMode", "force"],
            cwd=repo_root,
            creationflags=creationflags,
            **popen_kwargs,
        )
        atexit.register(self._cleanup)

        # Wait for channel ready
        start = time.time()
        while time.time() - start < self.timeout_s:
            ch2 = grpc.insecure_channel(addr)
            try:
                grpc.channel_ready_future(ch2).result(timeout=2)
                ch2.close()
                wait_s = int(os.environ.get("UNS_GATEWAY_HANDOVER_WAIT", "11"))
                if wait_s > 0:
                    time.sleep(wait_s)
                return addr
            except Exception:
                ch2.close()
                time.sleep(0.5)

        raise RuntimeError("Gateway did not become ready in time")
