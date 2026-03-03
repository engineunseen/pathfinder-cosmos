import http from 'http';
import https from 'https';
import { URL } from 'url';

const PORT = 8001;

async function fetchAvailableModels(baseUrl, auth, targetUrl) {
    return new Promise((resolve) => {
        const transport = baseUrl.startsWith('https') ? https : http;
        const req = transport.request(`${baseUrl}/models`, {
            headers: { 'Authorization': auth, 'x-target-url': targetUrl },
            rejectUnauthorized: false
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json.data?.map(m => m.id).join(", ") || "No models found");
                } catch (e) { resolve("Error parsing models list"); }
            });
        });
        req.on('error', () => resolve("Error fetching models list"));
        req.end();
    });
}

function proxyRequest(req, payload, targetUrl, res, redirectCount = 0) {
    if (redirectCount > 3) {
        res.writeHead(502); res.end("Redirect loop"); return;
    }

    try {
        const parsedUrl = new URL(targetUrl);
        const transport = parsedUrl.protocol === 'https:' ? https : http;

        const cleanHeaders = {
            'accept': 'application/json',
            'user-agent': 'Pathfinder-Proxy/3.3.28',
            'content-type': 'application/json',
            'host': parsedUrl.host,
            'connection': 'keep-alive'
        };
        if (req.headers['authorization']) cleanHeaders['authorization'] = req.headers['authorization'];

        const proxyReq = transport.request({
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.pathname + (parsedUrl.search || ''),
            method: req.method,
            headers: cleanHeaders,
            timeout: 60000,
            rejectUnauthorized: false
        }, async (proxyRes) => {
            // Handle Redirects
            if ([301, 302, 307, 308].includes(proxyRes.statusCode) && proxyRes.headers.location) {
                proxyRequest(req, payload, proxyRes.headers.location, res, redirectCount + 1);
                return;
            }

            // Handle 404 (Model not found)
            if (proxyRes.statusCode === 404 && targetUrl.includes('/chat/completions')) {
                const baseUrl = targetUrl.replace('/chat/completions', '');
                const modelList = await fetchAvailableModels(baseUrl, cleanHeaders['authorization'], req.headers['x-target-url']);
                console.error(`\n❌ MODEL NOT FOUND: The name in settings is wrong.`);
                console.log(`📡 AVAILABLE MODELS ON SERVER: [ ${modelList} ]`);
                console.log(`👉 Action: Copy the correct name into 'AI Model' settings in the simulation.\n`);
            }

            console.log(`[${proxyRes.statusCode}] -> ${targetUrl.substring(0, 50)}...`);
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res);
        });

        proxyReq.on('error', err => {
            console.error(`[ERROR]: ${err.message}`);
            if (!res.headersSent) { res.writeHead(502); res.end(err.message); }
        });

        proxyReq.write(payload);
        proxyReq.end();
    } catch (e) {
        console.error(`[FATAL]: ${e.message}`);
        if (!res.headersSent) { res.writeHead(400); res.end(e.message); }
    }
}

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-target-url');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    let body = [];
    req.on('data', chunk => body.push(chunk));
    req.on('end', () => {
        const payload = Buffer.concat(body);
        let rawTarget = req.headers['x-target-url'] || '';
        if (!rawTarget || rawTarget === 'null') { res.writeHead(400); res.end("Target URL missing"); return; }
        if (!rawTarget.startsWith('http')) rawTarget = 'https://' + rawTarget;

        let cleanPath = req.url.split('?')[0].replace(/\/v1/g, '').replace(/\/+/g, '/');
        if (cleanPath === '/') cleanPath = '';
        const targetBase = rawTarget.replace(/\/+$/, '').replace(/\/v1$/, '');
        const finalUrl = `${targetBase}/v1${cleanPath}`;

        proxyRequest(req, payload, finalUrl, res);
    });
});

server.listen(PORT, () => {
    console.log(`\n🌌 NVIDIA COSMOS DETECT-BRIDGE v3.3.28`);
    console.log(`🚀 Proxy: http://localhost:${PORT}`);
    console.log(`🛠  I will list available models automatically on 404 errors.\n`);
});
