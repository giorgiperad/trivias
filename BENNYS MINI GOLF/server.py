import http.server
import socketserver
import json
import os
import webbrowser
import sys

# Set directory to the folder containing this script
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def log_message(self, format, *args):
        # Print logs to console
        sys.stderr.write("%s - - [%s] %s\n" %
                         (self.client_address[0],
                          self.log_date_time_string(),
                          format%args))

    def do_GET(self):
        # API Endpoint for Benny's Mini Golf
        if self.path == '/api/courses':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            
            courses_dir = os.path.join(DIRECTORY, 'courses')
            courses = []
            
            if os.path.exists(courses_dir):
                for filename in os.listdir(courses_dir):
                    if filename.endswith('.json'):
                        # Create display name
                        name = os.path.splitext(filename)[0].replace('_', ' ').title()
                        
                        # Try to read metadata
                        course_info = {
                            'filename': filename,
                            'name': name,
                            'file': f'courses/{filename}'
                        }
                        
                        try:
                            with open(os.path.join(courses_dir, filename), 'r', encoding='utf-8') as f:
                                data = json.load(f)
                                if 'name' in data:
                                    course_info['name'] = data['name']
                        except:
                            pass
                            
                        courses.append(course_info)
            
            self.wfile.write(json.dumps(courses).encode())
            return
        
        return http.server.SimpleHTTPRequestHandler.do_GET(self)

class ThreadingSimpleServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    pass

def start_server():
    # Port 0 means select an arbitrary unused port
    with ThreadingSimpleServer(("127.0.0.1", 0), Handler) as httpd:
        port = httpd.server_address[1]
        print(f"Serving Benny's Mini Golf at http://127.0.0.1:{port}")
        
        # Open in browser
        url = f"http://127.0.0.1:{port}/index.html"
        webbrowser.open(url)
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")

if __name__ == "__main__":
    start_server()
