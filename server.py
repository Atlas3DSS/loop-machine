#!/usr/bin/env python3
"""PSY LOOP MACHINE server
  - Serves static files from current directory
  - Proxies /ace-api/* requests to the ACE-Step API server

Usage:
  python server.py [port]              # default port 8080
  ACE_STEP_URL=http://host:8001 python server.py
"""

import http.server
import urllib.request
import urllib.error
import json
import sys
import os

ACE_STEP_URL = os.environ.get('ACE_STEP_URL', 'http://localhost:8001')
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080


class Handler(http.server.SimpleHTTPRequestHandler):

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def _proxy(self, method):
        target = ACE_STEP_URL + self.path[len('/ace-api'):]

        headers = {}
        ct = self.headers.get('Content-Type')
        if ct:
            headers['Content-Type'] = ct

        body = None
        if method == 'POST':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length) if length > 0 else b''

        try:
            req = urllib.request.Request(
                target, data=body, headers=headers, method=method
            )
            with urllib.request.urlopen(req, timeout=600) as resp:
                data = resp.read()
                self.send_response(resp.status)
                self._cors()
                for h in ('Content-Type', 'Content-Disposition'):
                    v = resp.getheader(h)
                    if v:
                        self.send_header(h, v)
                self.send_header('Content-Length', len(data))
                self.end_headers()
                self.wfile.write(data)

        except urllib.error.HTTPError as e:
            err_body = e.read()
            self.send_response(e.code)
            self._cors()
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', len(err_body))
            self.end_headers()
            self.wfile.write(err_body)

        except Exception as e:
            msg = json.dumps({'error': str(e)}).encode()
            self.send_response(502)
            self._cors()
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', len(msg))
            self.end_headers()
            self.wfile.write(msg)

    # ── route handlers ──

    def do_GET(self):
        if self.path.startswith('/ace-api/'):
            return self._proxy('GET')
        return super().do_GET()

    def do_POST(self):
        if self.path.startswith('/ace-api/'):
            return self._proxy('POST')
        self.send_error(405)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    # quieter logging
    def log_message(self, fmt, *args):
        msg = fmt % args
        if '/ace-api/' in msg:
            sys.stderr.write(f'  [proxy]  {msg}\n')
        elif not any(ext in msg for ext in ('.js', '.css', '.ico', '.map', '.env')):
            sys.stderr.write(f'  [static] {msg}\n')


print(f'╔══════════════════════════════════════════════╗')
print(f'║  PSY LOOP MACHINE  →  http://localhost:{PORT}')
print(f'║  ACE-Step proxy    →  {ACE_STEP_URL}')
print(f'╚══════════════════════════════════════════════╝')
http.server.HTTPServer(('', PORT), Handler).serve_forever()
