import asyncio
import httpx
import sqlite3
import os

async def main():
    base_url = "http://localhost:8000"

    print("--- Verification Start ---")

    # 0. Reset DB
    print("Resetting traces.db...")
    try:
        with sqlite3.connect("selfsurgeon-backend/traces.db") as conn:
            conn.execute("DELETE FROM traces")
            conn.commit()
    except Exception as e:
        print(f"Could not reset DB: {e}")

    # Using a very long timeout for LLM calls
    timeout = httpx.Timeout(120.0, connect=10.0)

    # 1. Generate failing traces
    print("Testing: /api/victim/generate... (This may take 30-60s)")
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            resp = await client.post(f"{base_url}/api/victim/generate?count=20")
            data = resp.json()
            print(f"Result: {data}")
            if not data.get("success") or data.get("data", {}).get("failures") == 0:
                print("❌ FAILED: Should have generated failures.")
                return
        except Exception as e:
            print(f"❌ ERROR: {e}")
            return

    # 2. Trigger surgery
    print("\nTesting: /api/trigger... (This may take 30-60s)")
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            resp = await client.post(f"{base_url}/api/trigger")
            data = resp.json()
            print(f"Result: {data}")
            if not data.get("success") or data.get("data", {}).get("status") != "DEPLOYED":
                print("❌ FAILED: Surgery should have been deployed.")
                return
        except Exception as e:
            print(f"❌ ERROR: {e}")
            return

    # 3. Generate traces again (should be fixed)
    print("\nTesting: /api/victim/generate (Post-Fix)...")
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            resp = await client.post(f"{base_url}/api/victim/generate?count=20")
            data = resp.json()
            print(f"Result: {data}")
            if data.get("data", {}).get("failures") != 0:
                print("❌ FAILED: Should have 0 failures after surgery.")
                return
        except Exception as e:
            print(f"❌ ERROR: {e}")
            return

    # 4. Check surgeries
    print("\nTesting: /api/surgeries...")
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            resp = await client.get(f"{base_url}/api/surgeries")
            data = resp.json()
            print(f"Result: {len(data.get('data', []))} surgeries found.")
            if not data.get("data") or len(data["data"]) == 0:
                print("❌ FAILED: No surgery record found.")
                return
        except Exception as e:
            print(f"❌ ERROR: {e}")
            return

    print("\n--- ✅ ALL VERIFICATIONS PASSED ---")

if __name__ == "__main__":
    asyncio.run(main())
