import http from 'http';

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    
    console.log(`🌐 HTTP ${req.method} ${req.url} from ${req.headers.host}`);
    
    if (url.pathname === '/health' || url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 'healthy', 
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      }));
      return;
    }
    
    if (url.pathname === '/eod/trigger') {
      console.log('🎯 EOD trigger endpoint hit');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        message: 'EOD trigger endpoint working',
        timestamp: new Date().toISOString()
      }));
      return;
    }
    
    if (url.pathname === '/eod/status') {
      console.log('📊 EOD status endpoint hit');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 'EOD status endpoint working',
        timestamp: new Date().toISOString()
      }));
      return;
    }
    
    console.log(`❌ Unknown endpoint: ${url.pathname}`);
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    
  } catch (error) {
    console.error('❌ HTTP Server Error:', error);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Simple HTTP server listening on 0.0.0.0:${PORT}`);
});

console.log('🚀 Simple HTTP server started...');
