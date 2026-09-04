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

class CDP:
    def __init__(self, ws_url):
        self.ws_url = ws_url
        self.ws = None
        self.req_id = 0
        self.pending = {}
        self.errors = []

    async def connect(self):
        self.ws = await websockets.connect(self.ws_url)
        asyncio.create_task(self.loop())
        await self.send("Page.enable")
        await self.send("Runtime.enable")
        await self.send("Emulation.setDeviceMetricsOverride", {
            "width": 1440, "height": 900, "deviceScaleFactor": 1, "mobile": False
        })

    async def loop(self):
        try:
            async for raw in self.ws:
                msg = json.loads(raw)
                if "id" in msg and msg["id"] in self.pending:
                    self.pending[msg["id"]].set_result(msg)
                elif msg.get("method") == "Runtime.exceptionThrown":
                    self.errors.append(msg["params"])
        except:
            pass

    async def send(self, method, params=None):
        self.req_id += 1
        msg_id = self.req_id
        fut = asyncio.get_running_loop().create_future()
        self.pending[msg_id] = fut
        await self.ws.send(json.dumps({"id": msg_id, "method": method, "params": params or {}}))
        return await fut

    async def eval(self, expr):
        res = await self.send("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True})
        return res.get("result", {}).get("result", {}).get("value")

    async def snap(self, filename):
        res = await self.send("Page.captureScreenshot", {"format": "png"})
        b64 = res.get("result", {}).get("data", "")
        if b64:
            path = os.path.join(ARTIFACTS_DIR, filename)
            with open(path, "wb") as f:
                f.write(base64.b64decode(b64))
            print(f"Saved: {filename}")

async def run():
    chrome = subprocess.Popen([
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "--headless=new", "--disable-gpu", "--no-sandbox",
        "--remote-debugging-port=9225", "about:blank"
    ])
    time.sleep(1.2)
    try:
        with urllib.request.urlopen("http://127.0.0.1:9225/json") as r:
            tabs = json.loads(r.read())
        page = [t for t in tabs if t["type"] == "page"][0]
        cdp = CDP(page["webSocketDebuggerUrl"])
        await cdp.connect()

        # 1. Search Autocomplete
        await cdp.send("Page.navigate", {"url": f"{BASE_URL}/"})
        await asyncio.sleep(2.0)
        
        await cdp.eval("""(() => {
            const input = document.querySelector('input[placeholder*=\"Search\"]');
            if (input) {
                input.focus();
                input.dispatchEvent(new Event('focus', { bubbles: true }));
                // Use React internal setter if available, or simulate input
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                nativeInputValueSetter.call(input, 'Varanasi');
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        })()""")
        await asyncio.sleep(1.5)
        await cdp.snap("audit_17b_search_autocomplete.png")

        # 2. Login Page
        await cdp.send("Page.navigate", {"url": f"{BASE_URL}/login"})
        await asyncio.sleep(2.0)
        await cdp.snap("audit_20_login_portal.png")

        # 3. Verify error log
        print(f"CDP recorded exceptions: {len(cdp.errors)}")

    finally:
        chrome.terminate()

if __name__ == "__main__":
    asyncio.run(run())
