import express from 'express';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const tunnels = new Map(); // placaId -> WebSocket

// Middleware para capturar el body sin procesar
app.use((req, res, next) => {
    if (req.method === 'GET') {
        next();
        return;
    }
    
    // Capturar el body sin procesar
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
        req.rawBody = Buffer.concat(chunks);
        console.log(`👉 Raw body captured, size: ${req.rawBody.length} bytes`);
        console.log(`👉 Content-Type: ${req.headers['content-type'] || 'none'}`);
        next();
    });
});

// No usar parsers estándar para evitar transformaciones automáticas
// que podrían interferir con algunos tipos de contenido

app.get('', async (req, res) => {
    // send html with list of tunnels
    const tunnelList = Array.from(tunnels.keys()).map(placaId => `<a href="/tunnel/${placaId}/">${placaId}</a>`).join('');
    res.send(`<!DOCTYPE html>
<html>
<head>
    <title>Lista de Túneles</title>
</head>
<body>
    <h1>Lista de Túneles Activos</h1>
    <ul>
        ${tunnelList || '<li>No hay túneles activos</li>'}
    </ul>
</body>
</html>`);
});

const sanitizeHeaders = (headers) => {
    const sanitized = { ...headers };

    // If Transfer-Encoding exists, remove Content-Length to avoid conflicts
    if (sanitized['transfer-encoding'] || sanitized['Transfer-Encoding']) {
        delete sanitized['content-length'];
        delete sanitized['Content-Length'];
    }

    return sanitized;
};

const tunnelManagement = async (req, res) => {
    const placaId = req.params.placaId;
    const ws = tunnels.get(placaId);

    console.log(`🔍 Tunnel request for placaId: ${placaId}`, req.url);

    if (!ws || ws.readyState !== WebSocket.OPEN) {
        return res.status(502).send('Cliente no conectado');
    }

    const requestId = Math.random().toString(36).slice(2);
    const contentType = req.headers['content-type'] || '';
    
    console.log(`📥 Processing ${req.method} to ${req.url}`);
    console.log(`📥 Content-Type: ${contentType}`);
    console.log(`📥 Request URL: ${req.originalUrl}`);
      // Para GET no hay body
    let bodyToSend = '';
    
    if (req.method !== 'GET' && req.rawBody) {
        // Para otros métodos, usar el body tal como está, sin codificar
        bodyToSend = req.rawBody.toString('utf-8');
        console.log(`📥 Body size: ${bodyToSend.length} chars`);
    }
    
    const message = {
        type: 'request',
        id: requestId,
        method: req.method,
        path: "/" + (req.params.path ?? [""]).join('/') + "/",
        headers: req.headers,
        body: bodyToSend,
        isBase64Encoded: false
    };

    ws.send(JSON.stringify(message));
    console.log(`🔄 Request sent to tunnel with ID: ${requestId}`);

    const timeout = setTimeout(() => {
        res.status(504).send('Timeout del túnel');
    }, 120000); // 2 minutos de timeout

    const handler = (raw) => {
        try {
            const data = JSON.parse(raw);
            if (data.type === 'response' && data.id === requestId) {                // Sanitize headers to avoid Content-Length and Transfer-Encoding conflict
                const sanitizedHeaders = sanitizeHeaders(data.headers || {});
                
                // Preparar la respuesta con el código de estado y los headers
                res.status(data.statusCode || 200).set(sanitizedHeaders);
                  // Enviar la respuesta tal cual viene del otro lado
                if (!data.body) {
                    console.log('🔄 Response has no body');
                    return res.end();
                }
                
                // Enviar el cuerpo de respuesta tal cual, sin procesamiento
                console.log(`🔄 Sending response, size: ${data.body.length}`);
                res.end(data.body);
                clearTimeout(timeout);
                ws.off('message', handler);
            }
        } catch (e) {
            console.error('Error processing response:', e);
        }
    };

    ws.on('message', handler);
};
// Proxy HTTP entrante al túnel
app.all('/:placaId', async (req, res) => {
    tunnelManagement(req, res);
});

app.all('/:placaId/*path', async (req, res) => {
    tunnelManagement(req, res);
});

// WebSocket para la placa
wss.on('connection', (ws) => {
    let placaId = null;

    ws.on('message', (msg) => {
        try {
            const data = JSON.parse(msg);
            if (data.type === 'register' && data.id) {
                placaId = data.id;
                tunnels.set(placaId, ws);
                console.log(`🔌 Placa conectada: ${placaId}`);
            }
        } catch (e) {
            console.error('Error al parsear mensaje:', e);
        }
    });

    ws.on('close', () => {
        if (placaId) {
            tunnels.delete(placaId);
            console.log(`❌ Placa desconectada: ${placaId}`);
        }
    });
});

server.listen(8091, () => {
    console.log('Servidor towers-tunnel escuchando en http://localhost:8091');
});
