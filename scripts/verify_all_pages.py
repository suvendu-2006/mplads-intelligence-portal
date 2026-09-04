import asyncio
import base64
import json
import os
import subprocess
import time
import urllib.request
import websockets

ARTIFACTS_DIR = "/Users/suvendu/.gemini/antigravity-ide/brain/5cc2e502-5fde-4a72-bdb8-ddf64c0a7de4"
BASE_URL = "http://localhost:5173"

class CDPClient:
    def __init__(self, ws_url):
        self.ws_url = ws_url
        self.ws = None
        self.req_id = 0
        self.pending_responses = {}
        self.listen_task = None

    async def connect(self):
        self.ws = await websockets.connect(self.ws_url, max_size=50 * 1024 * 1024)
        self.listen_task = asyncio.create_task(self._listen())
        
        await self.send("Page.enable")
        await self.send("Runtime.enable")
        await self.send("DOM.enable")
        await self.send("Emulation.setDeviceMetricsOverride", {
            "width": 1440,
            "height": 950,
            "deviceScaleFactor": 1,
            "mobile": False
        })

    async def _listen(self):
        try:
            async for raw in self.ws:
                msg = json.loads(raw)
                if "id" in msg:
                    req_id = msg["id"]
                    if req_id in self.pending_responses:
                        self.pending_responses[req_id].set_result(msg)
        except Exception:
            pass

    async def send(self, method, params=None):
        self.req_id += 1
        curr_id = self.req_id
        payload = {"id": curr_id, "method": method, "params": params or {}}
        loop = asyncio.get_running_loop()
        fut = loop.create_future()
        self.pending_responses[curr_id] = fut
        await self.ws.send(json.dumps(payload))
        return await fut

    async def eval_js(self, expression):
        res = await self.send("Runtime.evaluate", {
            "expression": expression,
            "returnByValue": True,
            "awaitPromise": True
        })
        return res.get("result", {}).get("result", {}).get("value")

    async def capture_screenshot(self, filename):
        res = await self.send("Page.captureScreenshot", {"format": "png"})
        b64 = res.get("result", {}).get("data", "")
        if b64:
            path = os.path.join(ARTIFACTS_DIR, filename)
            with open(path, "wb") as f:
                f.write(base64.b64decode(b64))
            print(f"Captured: {path}")

    async def close(self):
        if self.listen_task:
            self.listen_task.cancel()
        if self.ws:
            await self.ws.close()

async def main():
    import tempfile
    tmpdir = tempfile.mkdtemp()
    chrome_proc = subprocess.Popen([
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        f"--user-data-dir={tmpdir}",
        "--remote-debugging-port=9222",
        "about:blank"
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    time.sleep(2)
    try:
        with urllib.request.urlopen("http://127.0.0.1:9222/json") as r:
            tabs = json.loads(r.read().decode("utf-8"))
        page_tab = [t for t in tabs if t.get("type") == "page"][0]
        ws_url = page_tab["webSocketDebuggerUrl"]
        
        client = CDPClient(ws_url)
        await client.connect()
        
        # 1. National Dashboard - Light Mode
        print("1. National Dashboard Light...")
        await client.send("Page.navigate", {"url": f"{BASE_URL}/"})
        await asyncio.sleep(2.5)
        await client.eval_js("document.documentElement.setAttribute('data-theme', 'light'); window.scrollTo(0, 0);")
        await asyncio.sleep(1)
        await client.capture_screenshot("audit_01_national_light.png")

        # 2. National Dashboard - Chart 1 (States & UTs)
        print("2. National Dashboard Chart 1...")
        await client.eval_js("window.scrollTo(0, 480);")
        await asyncio.sleep(1)
        await client.capture_screenshot("audit_02_chart1_states_uts.png")

        # 3. National Dashboard - Dark Mode
        print("3. National Dashboard Dark...")
        await client.eval_js("document.documentElement.setAttribute('data-theme', 'dark'); window.scrollTo(0, 0);")
        await asyncio.sleep(1)
        await client.capture_screenshot("audit_03_national_dark.png")
        await client.eval_js("window.scrollTo(0, 480);")
        await asyncio.sleep(1)
        await client.capture_screenshot("audit_04_chart1_dark.png")

        # 4. Browse States & UTs - Light Mode
        print("4. Browse States Light...")
        await client.send("Page.navigate", {"url": f"{BASE_URL}/states"})
        await asyncio.sleep(2)
        await client.eval_js("document.documentElement.setAttribute('data-theme', 'light'); window.scrollTo(0, 0);")
        await asyncio.sleep(1)
        await client.capture_screenshot("audit_05_states_light.png")

        # 5. Browse States & UTs - Dark Mode
        print("5. Browse States Dark...")
        await client.eval_js("document.documentElement.setAttribute('data-theme', 'dark');")
        await asyncio.sleep(1)
        await client.capture_screenshot("audit_06_states_dark.png")

        # 6. State Detail (Maharashtra) - Light Mode
        print("6. State Detail Maharashtra Light...")
        await client.send("Page.navigate", {"url": f"{BASE_URL}/states/MAHARASHTRA"})
        await asyncio.sleep(2)
        await client.eval_js("document.documentElement.setAttribute('data-theme', 'light'); window.scrollTo(0, 700);")
        await asyncio.sleep(1)
        await client.capture_screenshot("audit_07_districts_light.png")

        # 7. Browse MPs - Light Mode
        print("7. Browse MPs Light...")
        await client.send("Page.navigate", {"url": f"{BASE_URL}/mps"})
        await asyncio.sleep(2)
        await client.eval_js("document.documentElement.setAttribute('data-theme', 'light'); window.scrollTo(0, 0);")
        await asyncio.sleep(1)
        await client.capture_screenshot("audit_08_mps_light.png")

        # 8. Browse MPs - Dark Mode
        print("8. Browse MPs Dark...")
        await client.eval_js("document.documentElement.setAttribute('data-theme', 'dark');")
        await asyncio.sleep(1)
        await client.capture_screenshot("audit_09_mps_dark.png")

        # 9. MP Detail Page - Light Mode
        print("9. MP Detail Page...")
        await client.send("Page.navigate", {"url": f"{BASE_URL}/mps/6a932b5ecd944524379ee23d"})
        await asyncio.sleep(2)
        await client.eval_js("document.documentElement.setAttribute('data-theme', 'light'); window.scrollTo(0, 0);")
        await asyncio.sleep(1)
        await client.capture_screenshot("audit_10_mpdetail_fundcard_light.png")

        # Reset to light mode
        await client.eval_js("document.documentElement.setAttribute('data-theme', 'light');")
        await client.close()
        print("All visual audits captured successfully!")
    finally:
        chrome_proc.terminate()
        chrome_proc.wait()

if __name__ == "__main__":
    asyncio.run(main())
