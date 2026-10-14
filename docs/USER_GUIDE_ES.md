# OB-Pulse — guía inicial en español

## ¿Qué es?

OB-Pulse es una aplicación de escritorio pequeña para saber qué modelos de IA locales hay cargados,
cuánta memoria ocupa el equipo y qué rendimiento da una prueba de generación. No requiere cuenta,
ni envía métricas a onBlank.

**Esta entrega es código fuente inicial, no un instalador para usuarios finales.** El equipo de
desarrollo debe compilar, probar y publicar instaladores de Windows/macOS/Linux.

## Ollama

1. Instala Ollama aparte desde su distribuidor oficial.
2. Abre OB-Pulse (cuando exista el instalador oficial) y elige Ollama.
3. Si el servidor está cerrado, el botón **Start** permite iniciarlo desde la app. Si ya estaba
   abierto en otra aplicación, OB-Pulse se conecta y muestra "External service": por seguridad,
   no te permitirá apagar un servidor que no abrió.
4. La lista de modelos muestra qué está descargado y qué está cargado en memoria.
5. **Load / Unload** carga o descarga un modelo de RAM; no elimina el modelo del disco.
6. **Test speed** ejecuta una pequeña prueba real de lectura/prefill y escritura/decode.
7. Cerrar la ventana oculta OB-Pulse en la bandeja; **Quit** termina la aplicación.

## Qué significan los números

- **Host CPU/RAM**: carga de todo el ordenador, no del modelo únicamente.
- **Resident memory**: estimación que comunica Ollama de memoria de GPU residente; no es % de uso de GPU.
- **Context capacity**: tamaño de ventana reservado por el runtime cuando se informa.
- **Context used**: aparece `—` hasta conectar un cliente con ID de sesión y medición real.
- **READ/WRITE**: por ahora solo la última prueba solicitada, no las conversaciones de otras apps.
- `—` significa desconocido o no disponible, nunca valor cero.
