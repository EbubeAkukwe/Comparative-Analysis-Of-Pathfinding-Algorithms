from http.server import SimpleHTTPRequestHandler, HTTPServer

class HighPrecisionRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Unlocks browser shared memory and enables high-precision performance.now()
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        super().end_headers()

if __name__ == '__main__':
    server_address = ('localhost', 8000)
    httpd = HTTPServer(server_address, HighPrecisionRequestHandler)
    print("🚀 Experiment server running at: http://localhost:8000")
    print("Security headers injected. High-precision timing is unlocked.")
    httpd.serve_forever()