# Towers Tunnel

Un servidor de túnel WebSocket para redirigir peticiones HTTP entre clientes.

## Descripción

Towers Tunnel es una solución que permite establecer túneles HTTP a través de conexiones WebSocket, facilitando la comunicación entre servidores que podrían estar detrás de firewalls o NAT. El sistema consiste en dos componentes:

1. **Servidor de Túnel** (este repositorio): Actúa como intermediario entre las peticiones entrantes y los dispositivos (placas) conectados.
2. **Cliente de Túnel**: Se ejecuta en los dispositivos remotos y establece una conexión WebSocket con el servidor.

## Características

- Transmisión transparente de peticiones HTTP (cualquier método y contenido).
- Soporte completo para diferentes tipos de contenido (JSON, form-data, application/x-www-form-urlencoded, binarios).
- Manejo de headers HTTP sin modificaciones.
- Preservación exacta del cuerpo de las peticiones.
- Timeout configurable para peticiones.
- Interfaz web simple para listar los túneles activos.

## Instalación

```bash
npm install
```

## Uso

Para iniciar el servidor:

```bash
node index.js
```

El servidor escuchará en el puerto 8091 por defecto.

## Cómo funciona

1. **Registro de dispositivos**: Los dispositivos se conectan al servidor a través de WebSocket y se registran con un ID único.
2. **Peticiones entrantes**: Cuando llega una petición HTTP a la ruta `/:placaId/*`, el servidor la reenvía al dispositivo correspondiente.
3. **Respuesta**: El dispositivo procesa la petición y envía la respuesta de vuelta al servidor, que a su vez la devuelve al cliente original.

## Rutas

- **`/`**: Muestra una lista de los túneles activos.
- **`/:placaId/*`**: Ruta para enviar peticiones a un dispositivo específico.

## Protocolo WebSocket

### Mensajes del servidor al cliente

```json
{
  "type": "request",
  "id": "requestId",
  "method": "HTTP_METHOD",
  "path": "/path/to/resource",
  "headers": { /* headers originales */ },
  "body": "cuerpo de la petición sin codificar",
  "isBase64Encoded": false
}
```

### Mensajes del cliente al servidor

Registro:
```json
{
  "type": "register", 
  "id": "placaId"
}
```

Respuesta:
```json
{
  "type": "response",
  "id": "requestId",
  "statusCode": 200,
  "headers": { /* headers de respuesta */ },
  "body": "cuerpo de la respuesta",
  "isBase64Encoded": false
}
```

## Cliente de Túnel

El cliente de túnel está disponible en el repositorio: [Towers Tunnel Client](https://github.com/TorresOwO/towers-tunnel-client)

## Ejemplos

### Envío de una petición al túnel:

```javascript
fetch("http://servidor/tunnel/placa1/api/recurso", {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded"
  },
  body: "param1=valor1&param2=valor2"
});
```

## Consideraciones

- El servidor actúa como un proxy puro, transmitiendo las peticiones sin modificar su contenido.
- Para peticiones grandes, considerar ajustar el timeout (actualmente 2 minutos).
