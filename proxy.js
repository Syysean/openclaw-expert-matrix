const http = require("http");
const https = require("https");

const SILICONFLOW_HOST = "api.siliconflow.cn";

const DEEPSEEK_KEY = process.env.SILICONFLOW_DEEPSEEK_API_KEY;
const QWEN_KEY     = process.env.SILICONFLOW_QWEN_API_KEY;

const TEXT_MODEL = "Pro/deepseek-ai/DeepSeek-V3.2";
const VISION_MODEL = "Qwen/Qwen3.5-35B-A3B";

const MAX_BODY_SIZE = 10 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 120_000;

if (!DEEPSEEK_KEY) {
  console.error("[proxy] FATAL: SILICONFLOW_DEEPSEEK_API_KEY environment variable is not set.");
  process.exit(1);
}
if (!QWEN_KEY) {
  console.error("[proxy] FATAL: SILICONFLOW_QWEN_API_KEY environment variable is not set.");
  process.exit(1);
}

http.createServer((req, res) => {
  let body = [];
  let bodySize = 0;
  let aborted = false;

  req.on("data", chunk => {
    bodySize += chunk.length;
    if (bodySize > MAX_BODY_SIZE) {
      aborted = true;
      res.writeHead(413, { "Content-Type": "text/plain" });
      res.end("Request body too large");
      req.destroy();
      return;
    }
    body.push(chunk);
  });

  req.on("end", () => {
    if (aborted) return;
    let bodyStr = Buffer.concat(body).toString();
    try {
      const json = JSON.parse(bodyStr);
      const hasImage = json.messages?.some(m =>
        Array.isArray(m.content) &&
        m.content.some(c => c.type === "image_url" || c.type === "image")
      );
      let selectedKey;
      if (hasImage) {
        json.model = VISION_MODEL;
        selectedKey = QWEN_KEY;
        console.log(`[proxy] image detected -> ${VISION_MODEL} (qwen key)`);
      } else {
        json.model = TEXT_MODEL;
        selectedKey = DEEPSEEK_KEY;
        console.log(`[proxy] text only -> ${TEXT_MODEL} (deepseek key)`);
      }
      bodyStr = JSON.stringify(json);
      const contentLength = Buffer.byteLength(bodyStr);
      const headers = {
        ...req.headers,
        host: SILICONFLOW_HOST,
        authorization: `Bearer ${selectedKey}`,
        "content-length": contentLength,
        "content-type": "application/json",
      };
      delete headers["transfer-encoding"];
      delete headers["connection"];
      const proxy = https.request({
        hostname: SILICONFLOW_HOST,
        path: req.url,
        method: req.method,
        headers,
      }, (proxyRes) => {
        if (proxyRes.statusCode >= 400) {
          let errBody = [];
          proxyRes.on("data", chunk => errBody.push(chunk));
          proxyRes.on("end", () => {
            const errStr = Buffer.concat(errBody).toString();
            console.error(`[proxy] upstream error ${proxyRes.statusCode}:`, errStr);
            if (!res.headersSent) res.writeHead(proxyRes.statusCode, proxyRes.headers);
            res.end(errStr);
          });
          return;
        }
        if (!res.headersSent) res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
        proxyRes.on("error", (err) => { res.destroy(err); });
      });
      proxy.setTimeout(UPSTREAM_TIMEOUT_MS, () => {
        proxy.destroy(new Error("upstream timeout"));
      });
      proxy.on("error", (err) => {
        console.error("[proxy] request error:", err.message);
        if (!res.headersSent) res.writeHead(502, { "Content-Type": "text/plain" });
        res.end(`Bad Gateway: ${err.message}`);
      });
      proxy.write(bodyStr);
      proxy.end();
    } catch (err) {
      console.error("[proxy] parse error:", err.message);
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Bad Request: invalid JSON");
    }
  });

  req.on("error", (err) => { console.error("[proxy] client error:", err.message); });

}).listen(13001, () => {
  console.log("[proxy] Smart routing proxy on :13001");
  console.log(`[proxy] text  -> ${TEXT_MODEL} (SILICONFLOW_DEEPSEEK_API_KEY)`);
  console.log(`[proxy] image -> ${VISION_MODEL} (SILICONFLOW_QWEN_API_KEY)`);
  console.log(`[proxy] max body: ${MAX_BODY_SIZE / 1024 / 1024}MB, timeout: ${UPSTREAM_TIMEOUT_MS / 1000}s`);
});
