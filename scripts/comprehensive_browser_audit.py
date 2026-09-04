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
                            # Ignore benign font or expected resource warnings if any
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


async def run_audit():
    chrome_proc = subprocess.Popen([
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--remote-debugging-port=9222",
        "about:blank"
    ])
    time.sleep(1.5)

    try:
        with urllib.request.urlopen("http://127.0.0.1:9222/json") as r:
            tabs = json.loads(r.read())
        page_tab = [t for t in tabs if t.get("type") == "page"][0]
        ws_url = page_tab["webSocketDebuggerUrl"]

        client = CDPClient(ws_url)
        await client.connect()

        # 1. National Overview
        await client.navigate(f"{BASE_URL}/", wait_seconds=2.5)
        title = await client.evaluate("document.title")
        print(f"  Page Title: {title}")
        kpi_count = await client.evaluate("document.querySelectorAll('.lux-card, .metric-card, [class*=\"StatCard\"]').length")
        print(f"  Metric/Card count: {kpi_count}")
        await client.capture_screenshot("audit_01_national.png")

        # 2. Browse States & UTs
        await client.navigate(f"{BASE_URL}/states", wait_seconds=2.5)
        state_cards_count = await client.evaluate("document.querySelectorAll('.grid > div').length")
        print(f"  State cards rendered: {state_cards_count}")
        await client.capture_screenshot("audit_02_states.png")

        # 3. State Detail: Gujarat
        await client.navigate(f"{BASE_URL}/states/Gujarat", wait_seconds=2.5)
        dist_selector = await client.evaluate("document.body.innerText.includes('Explore District Dashboard')")
        print(f"  District links present: {dist_selector}")
        await client.capture_screenshot("audit_03_gujarat.png")

        # 4. District Dashboard: Ahmedabad
        await client.navigate(f"{BASE_URL}/districts/AHMEDABAD", wait_seconds=2.5)
        table_rows = await client.evaluate("document.querySelectorAll('table tbody tr').length")
        print(f"  Ahmedabad works table rows: {table_rows}")
        await client.capture_screenshot("audit_04_ahmedabad.png")

        # 5. Browse MPs Performance
        await client.navigate(f"{BASE_URL}/mps", wait_seconds=2.5)
        mp_cards_count = await client.evaluate("document.querySelectorAll('.grid > div').length")
        print(f"  MP cards rendered: {mp_cards_count}")
        await client.capture_screenshot("audit_05_mps.png")

        # 6. MP Detail: Narendra Modi (Varanasi)
        await client.navigate(f"{BASE_URL}/mps/6a932b5bcd944524379edf76", wait_seconds=2.5)
        mp_name_header = await client.evaluate("document.body.innerText.includes('Shri Narendra Modi')")
        print(f"  Narendra Modi header present: {mp_name_header}")
        await client.capture_screenshot("audit_06_modi_detail.png")

        # 7. Sovereign India GIS Map
        await client.navigate(f"{BASE_URL}/map", wait_seconds=3.0)
        svg_or_canvas = await client.evaluate("document.querySelectorAll('svg, canvas, .leaflet-container').length")
        print(f"  Map elements rendered: {svg_or_canvas}")
        await client.capture_screenshot("audit_07_gis_map.png")

        # 8. Vigilance & Anomaly Command Desk
        await client.navigate(f"{BASE_URL}/audit", wait_seconds=2.5)
        audit_rows = await client.evaluate("document.querySelectorAll('table tbody tr').length")
        print(f"  Audit table rows: {audit_rows}")
        await client.capture_screenshot("audit_08_audit_desk.png")

        # 9. Test Interactive Modal: Open First "Inspect Report" Modal
        print("\n---> Triggering first 'Inspect Report' button on Audit Desk...")
        clicked = await client.evaluate("""(() => {
            const btns = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.includes('Inspect Report'));
            if (btns.length > 0) {
                btns[0].click();
                return true;
            }
            return false;
        })()""")
        print(f"  Inspect Report button clicked: {clicked}")
        await asyncio.sleep(1.5)
        
        # Verify modal content: simplified title, guidelines, INR values
        modal_info = await client.evaluate("""(() => {
            const modal = document.querySelector('[class*=\"fixed\"][class*=\"z-50\"], .lux-card');
            const text = document.body.innerText;
            return {
                hasVerificationReport: text.includes('District Vigilance • Audit Verification Report') || text.includes('Audit Work Inspection Report'),
                hasCPWDorGuidelines: text.includes('Guidelines') || text.includes('MoSPI') || text.includes('CPWD') || text.includes('Inspection Checklist'),
                hasTheorems: text.includes('Benford') || text.includes('p-value') || text.includes('H0:')
            };
        })()""")
        print(f"  Modal Content Check: {modal_info}")
        await client.capture_screenshot("audit_09_inspection_modal.png")

        # Close modal
        await client.evaluate("""(() => {
            const closeBtn = document.querySelector('button[aria-label=\"Close\"], button svg.lucide-x, button:has(svg.lucide-x)');
            if (closeBtn) closeBtn.click();
            else {
                // Click outside or Escape
                const backdrop = document.querySelector('.fixed.inset-0');
                if (backdrop) backdrop.click();
            }
        })()""")
        await asyncio.sleep(1.0)

        # 10. Role Switcher Verification: State Nodal Switch
        print("\n---> Testing Role Switcher to State Nodal...")
        switch_clicked = await client.evaluate("""(() => {
            const switchBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('SWITCH ROLE') || b.innerText.includes('Switch Role') || b.innerText.includes('User'));
            if (switchBtn) {
                switchBtn.click();
                return true;
            }
            return false;
        })()""")
        await asyncio.sleep(0.8)

        # Click State Nodal role option
        modal_opened = await client.evaluate("""(() => {
            const stateNodalBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('State Nodal'));
            if (stateNodalBtn) {
                stateNodalBtn.click();
                return true;
            }
            return false;
        })()""")
        await asyncio.sleep(0.8)
        await client.capture_screenshot("audit_10_role_state_nodal_dropdown.png")

        # Select "GUJARAT" in the state selector
        state_selected = await client.evaluate("""(() => {
            const sel = document.querySelector('select');
            if (sel) {
                const opt = Array.from(sel.options).find(o => o.value.includes('GUJARAT'));
                if (opt) {
                    sel.value = opt.value;
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                    return opt.value;
                }
            }
            return null;
        })()""")
        print(f"  Selected state nodal option: {state_selected}")
        await asyncio.sleep(2.0)
        current_url = await client.evaluate("window.location.pathname")
        print(f"  Current URL after state nodal selection: {current_url}")
        await client.capture_screenshot("audit_11_landed_state_gujarat.png")

        # 11. Test DM / District Authority 2-Step Selection
        print("\n---> Testing Role Switcher to District Authority (2 questions)...")
        await client.evaluate("""(() => {
            const switchBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('SWITCH ROLE') || b.innerText.includes('State Nodal'));
            if (switchBtn) switchBtn.click();
        })()""")
        await asyncio.sleep(0.8)

        await client.evaluate("""(() => {
            const dmBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('District Authority'));
            if (dmBtn) dmBtn.click();
        })()""")
        await asyncio.sleep(0.8)
        await client.capture_screenshot("audit_12_role_dm_2step_dropdown.png")

        # Select State "UTTAR PRADESH" then District "VARANASI"
        dm_selection = await client.evaluate("""(() => {
            const selects = Array.from(document.querySelectorAll('select'));
            if (selects.length >= 2) {
                // First select is State
                const stateSel = selects[0];
                const upOpt = Array.from(stateSel.options).find(o => o.value.includes('UTTAR PRADESH'));
                if (upOpt) {
                    stateSel.value = upOpt.value;
                    stateSel.dispatchEvent(new Event('change', { bubbles: true }));
                }
                return 'state_selected';
            }
            return 'not_enough_selects';
        })()""")
        await asyncio.sleep(1.0)

        # Now select Varanasi in the second dropdown
        dist_selected = await client.evaluate("""(() => {
            const selects = Array.from(document.querySelectorAll('select'));
            if (selects.length >= 2) {
                const distSel = selects[1];
                const vnsOpt = Array.from(distSel.options).find(o => o.value.includes('VARANASI'));
                if (vnsOpt) {
                    distSel.value = vnsOpt.value;
                    distSel.dispatchEvent(new Event('change', { bubbles: true }));
                    return vnsOpt.value;
                }
            }
            return null;
        })()""")
        print(f"  Selected DM district: {dist_selected}")
        await asyncio.sleep(2.0)
        current_url_dm = await client.evaluate("window.location.pathname")
        print(f"  Current URL after DM district selection: {current_url_dm}")
        await client.capture_screenshot("audit_13_landed_dm_varanasi.png")

        # Summary of Errors
        print("\n=======================================================")
        print("          END-TO-END BROWSER AUDIT SUMMARY             ")
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
    asyncio.run(run_audit())
