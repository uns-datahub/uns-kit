This folder is reserved for your project-specific Python code.

The update tools will NOT overwrite `python/app/**` (and also preserve legacy `python/rtt/**`, `python/venv`, `python/.venv`, and `python/__pycache__`).

Suggested layout:
- `python/app/` your packages, modules, or CLI scripts
- Reference the gateway client in `python/gateway_client.py` if you interact with the UNS gateway from Python

