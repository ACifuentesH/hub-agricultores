"""
Sync masivo de las 28 estaciones WeatherLink.
Invoca /functions/v1/weatherlink-sync con chunk_days=30 hasta que cada
estación esté al día. Concurrencia controlada (4 en paralelo) para no
saturar la API.

Uso:
    PYTHONIOENCODING=utf-8 python scripts/sync_weatherlink_masivo.py
"""
from __future__ import annotations
import os, json, urllib.request, urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from time import time, sleep

ROOT = Path(__file__).resolve().parent.parent
ENV = {}
for line in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.startswith("#"):
        k, _, v = line.partition("=")
        ENV[k.strip()] = v.strip().strip('"').strip("'")

BASE = ENV["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
SVC  = ENV["SUPABASE_SERVICE_ROLE_KEY"]
ANON = ENV["NEXT_PUBLIC_SUPABASE_ANON_KEY"]

SYNC_URL = f"{BASE}/functions/v1/weatherlink-sync"
CHUNK_DAYS = 30
CONCURRENCY = 4
MAX_ITER_PER_STATION = 15  # max ~450 días si chunk=30; suficiente para histórico de 1 año


def fetch_stations() -> list[dict]:
    url = f"{BASE}/rest/v1/sync_status?select=station_id,station_name,last_ts,status&order=station_name"
    req = urllib.request.Request(url, headers={
        "apikey": SVC, "Authorization": f"Bearer {SVC}", "Accept": "application/json",
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def sync_one(station_id: str, station_name: str) -> dict:
    """Itera invocando el edge function hasta done=true o max_iter."""
    iters = 0
    last_records = 0
    start = time()
    last_response = None
    while iters < MAX_ITER_PER_STATION:
        body = json.dumps({
            "station_id": station_id,
            "station_name": station_name,
            "chunk_days": CHUNK_DAYS,
        }).encode("utf-8")
        req = urllib.request.Request(SYNC_URL, data=body, method="POST", headers={
            "Content-Type": "application/json",
            "apikey": ANON,
            "Authorization": f"Bearer {ANON}",
        })
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                resp = json.loads(r.read())
        except urllib.error.HTTPError as e:
            try:
                resp = json.loads(e.read())
            except Exception:
                resp = {"ok": False, "error": f"HTTP {e.code}"}
        except Exception as e:
            resp = {"ok": False, "error": str(e)}

        last_response = resp
        if not resp.get("ok"):
            return {
                "station_id": station_id, "station_name": station_name,
                "status": "ERROR", "error": resp.get("error"),
                "iterations": iters + 1, "elapsed_s": round(time() - start, 1),
            }

        records = resp.get("records_saved", 0)
        last_records += records
        iters += 1
        if resp.get("done"):
            break
        # Pequeña pausa entre chunks de la misma estación
        sleep(0.5)

    elapsed = round(time() - start, 1)
    return {
        "station_id": station_id, "station_name": station_name,
        "status": "DONE" if last_response and last_response.get("done") else "PARCIAL",
        "iterations": iters,
        "records_total": last_records,
        "last_ts": last_response.get("last_ts") if last_response else None,
        "elapsed_s": elapsed,
    }


def main():
    stations = fetch_stations()
    print(f"Sincronizando {len(stations)} estaciones (concurrency={CONCURRENCY}, chunk={CHUNK_DAYS}d)\n")
    print(f"{'Station ID':<10} {'Nombre':<35} {'Status':<8} {'Iters':<6} {'Recs':<8} {'Elapsed'}")
    print("-" * 90)

    results = []
    t0 = time()
    with ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
        futs = {
            pool.submit(sync_one, s["station_id"], s.get("station_name") or s["station_id"]): s
            for s in stations
        }
        for fut in as_completed(futs):
            r = fut.result()
            results.append(r)
            status = r["status"]
            mark = "✓" if status == "DONE" else ("⏸" if status == "PARCIAL" else "✗")
            err = f" — {r.get('error', '')}" if status == "ERROR" else ""
            print(f"{r['station_id']:<10} {r['station_name'][:34]:<35} {mark} {status:<6} "
                  f"{r['iterations']:<6} {r.get('records_total', 0):<8} {r['elapsed_s']}s{err}")

    print("-" * 90)
    total_recs = sum(r.get("records_total", 0) for r in results)
    done = sum(1 for r in results if r["status"] == "DONE")
    err = sum(1 for r in results if r["status"] == "ERROR")
    parc = sum(1 for r in results if r["status"] == "PARCIAL")
    elapsed = round(time() - t0, 1)
    print(f"\nResumen: {done} al día · {parc} parcial · {err} error")
    print(f"Total registros nuevos: {total_recs:,}")
    print(f"Tiempo total: {elapsed}s ({elapsed/60:.1f} min)")


if __name__ == "__main__":
    main()
