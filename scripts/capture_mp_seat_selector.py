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
        msg_id = self.req_id
        payload = {"id": msg_id, "method": method, "params": params or {}}
        fut = asyncio.get_event_loop().create_future()
        self.pending_responses[msg_id] = fut
        await self.ws.send(json.dumps(payload))
        return await fut

    async def evaluate(self, expr):
        res = await self.send("Runtime.evaluate", {
            "expression": expr,
            "awaitPromise": True,
            "returnByValue": True
        })
        return res.get("result", {}).get("result", {}).get("value")

    async def capture_screenshot(self, filepath):
        res = await self.send("Page.captureScreenshot", {"format": "png", "quality": 100})
        b64_data = res["result"]["data"]
        with open(filepath, "wb") as f:
            f.write(base64.b64decode(b64_data))
        print(f"Captured: {filepath}")

    async def close(self):
        if self.listen_task:
            self.listen_task.cancel()
        if self.ws:
            await self.ws.close()

async def main():
    chrome_bin = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    cdp_port = 9225
    chrome_proc = subprocess.Popen([
        chrome_bin,
        "--headless=new",
        f"--remote-debugging-port={cdp_port}",
        "--no-first-run",
        "--no-default-browser-check",
        "--user-data-dir=/tmp/chrome_mp_test"
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    time.sleep(1.5)
    
    try:
        targets_url = f"http://127.0.0.1:{cdp_port}/json"
        with urllib.request.urlopen(targets_url) as resp:
            targets = json.loads(resp.read().decode())
        ws_url = targets[0]["webSocketDebuggerUrl"]
        
        client = CDPClient(ws_url)
        await client.connect()
        
        print("Navigating to dashboard...")
        await client.send("Page.navigate", {"url": BASE_URL})
        await asyncio.sleep(2.0)
        
        # Click the Switch Role button
        print("Opening Switch Role dropdown...")
        await client.evaluate("""
            const btns = Array.from(document.querySelectorAll('button'));
            const switchBtn = btns.find(b => b.textContent && (b.textContent.includes('Switch Role') || b.textContent.includes('SWITCH ROLE') || b.textContent.includes('User') || b.textContent.includes('MP')));
            if (switchBtn) switchBtn.click();
        """)
        await asyncio.sleep(0.8)
        
        # Click on MP option to expand it
        print("Expanding MP persona card...")
        await client.evaluate("""
            const roleBtns = Array.from(document.querySelectorAll('button'));
            const mpBtn = roleBtns.find(b => b.textContent && b.textContent.includes('Member of Parliament'));
            if (mpBtn) mpBtn.click();
        """)
        await asyncio.sleep(0.8)
        
        # Capture initial state of MP selector
        shot1 = os.path.join(ARTIFACTS_DIR, "mp_selector_pan_india.png")
        await client.capture_screenshot(shot1)
        
        # Select Uttar Pradesh in the state dropdown
        print("Selecting Uttar Pradesh...")
        await client.evaluate("""
            const selects = Array.from(document.querySelectorAll('select'));
            const stateSelect = selects.find(s => Array.from(s.options).some(o => o.value === 'UTTAR PRADESH'));
            if (stateSelect) {
                stateSelect.value = 'UTTAR PRADESH';
                stateSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
        """)
        await asyncio.sleep(0.8)
        
        shot2 = os.path.join(ARTIFACTS_DIR, "mp_selector_uttar_pradesh.png")
        await client.capture_screenshot(shot2)
        
        # Filter search for "Varanasi"
        print("Searching for Varanasi...")
        await client.evaluate("""
            const inputs = Array.from(document.querySelectorAll('input'));
            const searchInput = inputs.find(i => i.placeholder && i.placeholder.includes('Search seat or MP'));
            if (searchInput) {
                searchInput.value = 'Varanasi';
                searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        """)
        await asyncio.sleep(0.8)
        
        shot3 = os.path.join(ARTIFACTS_DIR, "mp_selector_search_varanasi.png")
        await client.capture_screenshot(shot3)
        
        await client.close()
    finally:
        chrome_proc.terminate()
        chrome_proc.wait()

if __name__ == "__main__":
    asyncio.run(main())
