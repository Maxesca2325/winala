"""Talks to Winala's backend: writes go through the ingest-predictions Edge Function
(shared secret), reads use the public RPCs (anon key)."""
from __future__ import annotations

import os
import time

import requests


class Backend:
    def __init__(self) -> None:
        self.url = os.environ["SUPABASE_URL"].rstrip("/")
        self.anon = os.environ["SUPABASE_ANON_KEY"]
        self.secret = os.environ["INGEST_SECRET"]

    def _post(self, path: str, body: dict, headers: dict) -> dict:
        last = None
        for i in range(4):
            try:
                r = requests.post(f"{self.url}{path}", json=body, headers=headers, timeout=40)
                if r.status_code >= 500:
                    raise RuntimeError(f"{r.status_code} {r.text[:200]}")
                if r.status_code >= 400:
                    raise ValueError(f"{r.status_code} {r.text[:300]}")
                return r.json() if r.content else {}
            except ValueError:
                raise
            except Exception as e:  # transient: retry (all writes are idempotent)
                last = e
                time.sleep(2**i)
        raise RuntimeError(f"POST {path} failed: {last}")

    def ingest(self, body: dict) -> dict:
        return self._post("/functions/v1/ingest-predictions", body, {"x-ingest-secret": self.secret})

    def rpc(self, fn: str, args: dict) -> list | dict:
        return self._post(
            f"/rest/v1/rpc/{fn}", args, {"apikey": self.anon, "Authorization": f"Bearer {self.anon}"}
        )
