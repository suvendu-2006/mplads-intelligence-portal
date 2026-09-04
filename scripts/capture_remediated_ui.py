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
            "height": 1000,
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
        
        print("Navigating to National Dashboard...")
        await client.send("Page.navigate", {"url": f"{BASE_URL}/"})
        await asyncio.sleep(2.5)
        
        # 1. LIGHT MODE TEST
        print("Enforcing Light Mode...")
        await client.eval_js("document.documentElement.setAttribute('data-theme', 'light'); window.scrollTo(0, 0);")
        await asyncio.sleep(1)
        await client.capture_screenshot("remediated_light_mode.png")
        
        # 2. STATUS TAB TEST (Works Delivery Status)
        print("Switching to Works Status Tab...")
        await client.eval_js("""
            const btns = Array.from(document.querySelectorAll('button'));
            const statusBtn = btns.find(b => b.textContent.includes('Works Status'));
            if (statusBtn) statusBtn.click();
        """)
        await asyncio.sleep(1)
        await client.capture_screenshot("remediated_pie_status_tab.png")
        
        # 3. SCROLL DOWN TO ROW 2 CHARTS (Area chart + Sectoral grid)
        print("Scrolling down to Row 2 charts...")
        await client.eval_js("window.scrollTo(0, 800);")
        await asyncio.sleep(1)
        await client.capture_screenshot("remediated_lower_charts_light.png")

        # 4. DARK MODE LOWER CHARTS
        print("Enforcing Dark Mode on lower charts...")
        await client.eval_js("document.documentElement.setAttribute('data-theme', 'dark');")
        await asyncio.sleep(1)
        await client.capture_screenshot("remediated_lower_charts_dark.png")
        
        # 5. DARK MODE TOP TEST
        print("Scrolling to top in Dark Mode...")
        await client.eval_js("window.scrollTo(0, 0);")
        await asyncio.sleep(1)
        await client.capture_screenshot("remediated_dark_mode.png")
        
        # 6. MP DETAIL PAGE VERIFICATION
        print("Navigating to MP Detail Page...")
        await client.send("Page.navigate", {"url": f"{BASE_URL}/mps/6a932b5ecd944524379ee23d"})
        await asyncio.sleep(2)
        await client.capture_screenshot("remediated_mp_detail_dark.png")
        await client.eval_js("document.documentElement.setAttribute('data-theme', 'light');")
        await asyncio.sleep(1)
        await client.capture_screenshot("remediated_mp_detail_light.png")

        # Switch back to light mode for user
        await client.eval_js("document.documentElement.setAttribute('data-theme', 'light');")
        
        await client.close()
    finally:
        chrome_proc.terminate()
        chrome_proc.wait()

if __name__ == "__main__":
    asyncio.run(main())
