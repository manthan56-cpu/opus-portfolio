// Minimal static server for local development. No dependencies.
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 5500;
const ROOT = path.resolve(__dirname, "..");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(body);
}

http
  .createServer((req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    } catch {
      return send(res, 400, "Bad Request");
    }

    // fs.stat throws synchronously on null-byte paths, which would kill the server
    if (pathname.includes("\0")) {
      return send(res, 400, "Bad Request");
    }

    let filePath = path.join(ROOT, pathname);
    if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
      return send(res, 403, "Forbidden");
    }

    fs.stat(filePath, (err, stat) => {
      if (!err && stat.isDirectory()) {
        filePath = path.join(filePath, "index.html");
        try {
          stat = fs.statSync(filePath);
        } catch (e) {
          err = e;
        }
      }
      if (err || !stat.isFile()) return send(res, 404, "Not Found");

      const type = TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
      const size = stat.size;
      const headers = {
        "Content-Type": type,
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-cache",
      };

      const range = req.headers.range;
      if (range) {
        const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
        let start, end;
        if (m && (m[1] || m[2])) {
          if (m[1]) {
            start = parseInt(m[1], 10);
            end = m[2] ? Math.min(parseInt(m[2], 10), size - 1) : size - 1;
          } else {
            // Suffix range: last N bytes
            start = Math.max(size - parseInt(m[2], 10), 0);
            end = size - 1;
          }
        }
        if (start === undefined || start > end || start >= size) {
          res.writeHead(416, { "Content-Range": `bytes */${size}` });
          return res.end();
        }
        res.writeHead(206, {
          ...headers,
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Content-Length": end - start + 1,
        });
        if (req.method === "HEAD") return res.end();
        return fs.createReadStream(filePath, { start, end }).pipe(res);
      }

      res.writeHead(200, { ...headers, "Content-Length": size });
      if (req.method === "HEAD") return res.end();
      fs.createReadStream(filePath).pipe(res);
    });
  })
  .listen(PORT, () => {
    console.log(`Serving ${ROOT} at http://localhost:${PORT}`);
  });
