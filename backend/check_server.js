const http = require('http');
const req = http.get('http://localhost:3001/api/tables', (res) => {
  console.log(`STATUS: ${res.statusCode}`);
});
req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});
