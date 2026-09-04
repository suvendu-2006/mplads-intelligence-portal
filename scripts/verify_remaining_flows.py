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
        self.console_errors = []
        self.runtime_exceptions = []
        self.failed_requests = []
        self.listen_task = None

    async def connect(self):
        self.ws = await websockets.connect(self.ws_url, max_size=50 * 1024 * 1024)
        self.listen_task = asyncio.create_task(self._listen())
        
        await self.send("Page.enable")
        await self.send("Runtime.enable")
        await self.send("Network.enable")
        await self.send("Console.enable")
        await self.send("Emulation.setDeviceMetricsOverride", {
            "width": 1440,
            "height": 900,
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
                elif "method" in msg:
                    method = msg["method"]
                    params = msg.get("params", {})
                    
                    if method == "Runtime.exceptionThrown":
                        details = params.get("exceptionDetails", {})
                        exc_text = details.get("text", "")
                        exc_desc = details.get("exception", {}).get("description", "")
                        self.runtime_exceptions.append(f"{exc_text}: {exc_desc}")
                        print(f"  [RUNTIME EXCEPTION] {exc_text}: {exc_desc}")
                    
                    elif method == "Runtime.consoleAPICalled":
                        c_type = params.get("type", "")
                        args = [a.get("value") or a.get("description") or "" for a in params.get("args", [])]
                        joined = " ".join(str(a) for a in args)
                        if c_type == "error":
                            self.console_errors.append(joined)
                            print(f"  [CONSOLE ERROR] {joined}")
                    
                    elif method == "Network.responseReceived":
                        resp = params.get("response", {})
                        status = resp.get("status", 200)
                        url = resp.get("url", "")
                        if status >= 400 and not url.endswith("/favicon.ico"):
                            self.failed_requests.append(f"HTTP {status} on {url}")
                            print(f"  [NETWORK ERROR] HTTP {status}: {url}")

        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"Listen loop error: {e}")

    async def send(self, method, params=None):
        self.req_id += 1
        msg_id = self.req_id
        payload = {"id": msg_id, "method": method, "params": params or {}}
        fut = asyncio.get_running_loop().create_future()
        self.pending_responses[msg_id] = fut
        await self.ws.send(json.dumps(payload))
        return await fut

    async def navigate(self, url, wait_seconds=2.0):
        print(f"\n---> Navigating to: {url}")
        res = await self.send("Page.navigate", {"url": url})
        await asyncio.sleep(wait_seconds)
        return res

    async def evaluate(self, expr):
        res = await self.send("Runtime.evaluate", {
            "expression": expr,
            "returnByValue": True,
            "awaitPromise": True
        })
        result = res.get("result", {}).get("result", {})
        return result.get("value")

    async def capture_screenshot(self, filename):
        path = os.path.join(ARTIFACTS_DIR, filename)
        res = await self.send("Page.captureScreenshot", {"format": "png"})
        b64 = res.get("result", {}).get("data", "")
        if b64:
            with open(path, "wb") as f:
                f.write(base64.b64decode(b64))
            print(f"  Screenshot saved: {path} ({len(b64)*3//4} bytes)")
        return path

    async def close(self):
        if self.listen_task:
            self.listen_task.cancel()
        if self.ws:
            await self.ws.close()


async def run_remaining_audit():
    chrome_proc = subprocess.Popen([
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--remote-debugging-port=9223",
        "about:blank"
    ])
    time.sleep(1.5)

    try:
        with urllib.request.urlopen("http://127.0.0.1:9223/json") as r:
            tabs = json.loads(r.read())
        page_tab = [t for t in tabs if t.get("type") == "page"][0]
        ws_url = page_tab["webSocketDebuggerUrl"]

        client = CDPClient(ws_url)
        await client.connect()

        # Step 1: Set user state in localStorage as State Nodal (Gujarat)
        await client.navigate(f"{BASE_URL}/", wait_seconds=1.5)
        await client.evaluate("""(() => {
            const store = {
                state: {
                    user: {
                        role: 'state_nodal_officer',
                        state: 'GUJARAT',
                        permissions: ['read:national', 'read:states', 'read:mps', 'read:map', 'manage:state', 'audit:state'],
                        sessionToken: 'demo_token_state_nodal'
                    },
                    theme: 'dark',
                    lang: 'en'
                },
                version: 0
            };
            localStorage.setItem('satark-storage', JSON.stringify(store));
        })()""")

        # Step 2: Visit /my-state now that role is State Nodal
        await client.navigate(f"{BASE_URL}/my-state", wait_seconds=2.5)
        my_state_title = await client.evaluate("document.body.innerText.includes('State Nodal Command') || document.body.innerText.includes('GUJARAT')")
        print(f"  MyState authorized render: {my_state_title}")
        await client.capture_screenshot("audit_14_my_state_nodal.png")

        # Step 3: Now visit Varanasi District Dashboard and click "Verify MB"
        await client.navigate(f"{BASE_URL}/districts/VARANASI", wait_seconds=2.5)
        clicked_verify = await client.evaluate("""(() => {
            const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Verify MB'));
            if (btn) {
                btn.click();
                return true;
            }
            return false;
        })()""")
        print(f"  Clicked 'Verify MB': {clicked_verify}")
        await asyncio.sleep(1.5)
        await client.capture_screenshot("audit_15_district_verify_modal.png")

        # Step 4: Test MP Role & /mp-dashboard
        await client.evaluate("""(() => {
            const store = {
                state: {
                    user: {
                        role: 'mp',
                        state: 'Uttar Pradesh',
                        mpId: '6a932b5bcd944524379edf76',
                        mpName: 'Shri Narendra Modi',
                        permissions: ['read:national', 'read:states', 'read:mps', 'read:map', 'manage:constituency'],
                        sessionToken: 'demo_token_mp'
                    },
                    theme: 'dark',
                    lang: 'en'
                },
                version: 0
            };
            localStorage.setItem('satark-storage', JSON.stringify(store));
        })()""")
        await client.navigate(f"{BASE_URL}/mp-dashboard", wait_seconds=2.5)
        mp_dash_render = await client.evaluate("document.body.innerText.includes('Shri Narendra Modi') || document.body.innerText.includes('Constituency Corpus Ledger')")
        print(f"  MP Dashboard authorized render: {mp_dash_render}")
        await client.capture_screenshot("audit_16_mp_dashboard.png")

        # Step 5: Test Live Global Search in Header
        await client.navigate(f"{BASE_URL}/", wait_seconds=2.0)
        search_results = await client.evaluate("""(() => {
            const input = document.querySelector('input[placeholder*=\"Search\"]');
            if (input) {
                input.focus();
                input.value = 'Varanasi';
                input.dispatchEvent(new Event('input', { bubbles: true }));
                return true;
            }
            return false;
        })()""")
        print(f"  Typed in search input: {search_results}")
        await asyncio.sleep(1.5)
        await client.capture_screenshot("audit_17_search_bar.png")

        # Summary of Errors
        print("\n=======================================================")
        print("      REMAINING FLOWS BROWSER AUDIT SUMMARY            ")
        print("=======================================================")
        print(f"Runtime Exceptions: {len(client.runtime_exceptions)}")
        for e in client.runtime_exceptions:
            print(f"  - {e}")
        print(f"Console Errors: {len(client.console_errors)}")
        for ce in client.console_errors:
            print(f"  - {ce}")
        print(f"Failed HTTP Requests: {len(client.failed_requests)}")
        for fr in client.failed_requests:
            print(f"  - {fr}")
        print("=======================================================")

        await client.close()

    finally:
        chrome_proc.terminate()

if __name__ == "__main__":
    asyncio.run(run_remaining_audit())
