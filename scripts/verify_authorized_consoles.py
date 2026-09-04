import asyncio
import base64
import json
import os
import subprocess
import time
import urllib.request
import websockets

ARTIFACTS_DIR = "/Users/suvendu/.gemini/antigravity-ide/brain/5cc2e502-5fde-4a72-bdb8-ddf64c0a7de4"
BASE_URL = "http://127.0.0.1:8000"

async def run():
    chrome_proc = subprocess.Popen([
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--remote-debugging-port=9224",
        "about:blank"
    ])
    time.sleep(1.5)

    try:
        with urllib.request.urlopen("http://127.0.0.1:9224/json") as r:
            tabs = json.loads(r.read())
        page_tab = [t for t in tabs if t.get("type") == "page"][0]
        ws_url = page_tab["webSocketDebuggerUrl"]

        ws = await websockets.connect(ws_url, max_size=50 * 1024 * 1024)
        
        async def send(method, params=None):
            msg = {"id": 1, "method": method, "params": params or {}}
            await ws.send(json.dumps(msg))
            resp = await ws.recv()
            return json.loads(resp)

        await send("Page.enable")
        await send("Runtime.enable")
        await send("Emulation.setDeviceMetricsOverride", {
            "width": 1440,
            "height": 900,
            "deviceScaleFactor": 1,
            "mobile": False
        })

        async def capture(filename):
            res = await send("Page.captureScreenshot", {"format": "png"})
            b64 = res.get("result", {}).get("data", "")
            if b64:
                path = os.path.join(ARTIFACTS_DIR, filename)
                with open(path, "wb") as f:
                    f.write(base64.b64decode(b64))
                print(f"Captured {filename}")

        # 1. Test State Nodal Officer authorized console: /my-state
        await send("Page.navigate", {"url": f"{BASE_URL}/"})
        await asyncio.sleep(1.5)
        
        state_nodal_session = {
            "state": {
                "user": {
                    "role": "state_nodal_officer",
                    "state": "GUJARAT",
                    "permissions": ["read:national", "read:states", "read:mps", "read:map", "manage:state", "audit:state"],
                    "sessionToken": "test_token"
                }
            },
            "version": 0
        }
        await send("Runtime.evaluate", {
            "expression": f"localStorage.setItem('mplads-user-session', JSON.stringify({json.dumps(state_nodal_session)}));"
        })

        await send("Page.navigate", {"url": f"{BASE_URL}/my-state"})
        await asyncio.sleep(2.5)
        await capture("audit_18_my_state_authorized_gujarat.png")

        # 2. Test MP authorized console: /mp-dashboard
        mp_session = {
            "state": {
                "user": {
                    "role": "mp",
                    "state": "Uttar Pradesh",
                    "mpId": "6a932b5bcd944524379edf76",
                    "mpName": "Shri Narendra Modi",
                    "permissions": ["read:national", "read:states", "read:mps", "read:map", "manage:constituency"],
                    "sessionToken": "test_token_mp"
                }
            },
            "version": 0
        }
        await send("Runtime.evaluate", {
            "expression": f"localStorage.setItem('mplads-user-session', JSON.stringify({json.dumps(mp_session)}));"
        })

        await send("Page.navigate", {"url": f"{BASE_URL}/mp-dashboard"})
        await asyncio.sleep(2.5)
        await capture("audit_19_mp_dashboard_authorized_modi.png")

        # 3. Test Login page: /login
        await send("Page.navigate", {"url": f"{BASE_URL}/login"})
        await asyncio.sleep(2.0)
        await capture("audit_20_login_portal.png")

        await ws.close()

    finally:
        chrome_proc.terminate()

if __name__ == "__main__":
    asyncio.run(run())
