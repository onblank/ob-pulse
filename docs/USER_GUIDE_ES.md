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
3. Si el servidor está cerrado, el botón grande de encendido permite iniciarlo desde la app. Si ya estaba
   abierto en otra aplicación, OB-Pulse se conecta y muestra "External service": por seguridad,
   no te permitirá apagar un servidor que no abrió.
4. La lista de modelos muestra qué está descargado y qué está cargado en memoria.
5. **Load / Unload** carga o descarga un modelo de RAM; no elimina el modelo del disco.
6. **Test speed** ejecuta una pequeña prueba real de lectura/prefill y escritura/decode.
7. Cerrar la ventana oculta OB-Pulse en la bandeja; **Quit** termina la aplicación.

## Bandeja, modo compacto y modo ampliado

- Al ocultar o cerrar la ventana solo queda el icono de OB-Pulse en la bandeja del sistema. Pulsa el
  icono para volver a mostrar u ocultar el gadget.
- El modo compacto muestra el control de encendido seguro, el modelo cargado y los gráficos de la
  última hora. Usa el botón de ampliar para abrir el panel completo.
- El modo ampliado añade el selector de runtime, la lista de modelos, carga/descarga, benchmark y
  lecturas detalladas. Usa el botón de contraer para volver al gadget.
- Los gráficos solo viven en memoria: conservan como máximo una hora mientras OB-Pulse siga abierto
  y se vacían al salir de la aplicación. Ocultar la ventana no detiene el muestreo.

## Qué significan los números

- **Host CPU/RAM**: carga de todo el ordenador, no del modelo únicamente.
- **Resident memory**: estimación que comunica Ollama de memoria de GPU residente; no es % de uso de GPU.
- **Context capacity**: tamaño de ventana reservado por el runtime cuando se informa.
- **Context used**: aparece `—` hasta conectar un cliente con ID de sesión y medición real.
- **READ/WRITE**: por ahora solo pruebas solicitadas explícitamente, no las conversaciones de otras apps.
- `—` significa desconocido o no disponible, nunca valor cero.
