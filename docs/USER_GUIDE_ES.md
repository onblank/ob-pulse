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

## LM Studio y autenticación

1. Crea el token y sus permisos desde **Developer → Server Settings → Manage Tokens** en LM Studio.
2. En OB-Pulse selecciona **LM Studio**, abre el engranaje de configuración y pega el token en
   **API authentication**.
3. Pulse lo cifra con Keychain, DPAPI o un almacén seguro compatible de Linux. Si no existe un
   backend protegido, el botón permanece deshabilitado y el token no se guarda.
4. El valor guardado no vuelve a mostrarse. Puedes reemplazarlo o eliminarlo explícitamente.
5. Si el token es incorrecto o carece de permisos, Pulse muestra el rechazo sin incluir el secreto.

No pegues tokens de proveedores remotos: este campo admite únicamente el token del servidor local
LM Studio en `127.0.0.1:1234`.

## Bandeja, monitor y configuración

- Al ocultar o cerrar la ventana solo queda el icono de OB-Pulse en la bandeja del sistema. Pulsa el
  icono para volver a mostrar u ocultar el gadget.
- El modo compacto muestra el control de encendido seguro, el modelo cargado y los gráficos de la
  última hora. Usa el botón de ampliar para abrir el panel completo.
- El modo ampliado queda dedicado al selector de runtime, modelos, carga/descarga, benchmark,
  consumos e indicadores. Usa el botón de contraer para volver al gadget.
- La franja superior muestra simultáneamente todos los runtimes habilitados. Pulsa una tarjeta para
  ver su detalle; los errores, modelos y acciones pertenecen únicamente a ese proveedor.
- Cada tarjeta ofrece solo una acción permitida y segura: iniciar, detener un proceso propio, tomar
  control explícito o liberarlo. Los runtimes de solo observación no muestran controles falsos.
- El engranaje abre configuración. Si estás en el gadget compacto, OB-Pulse amplía primero la
  ventana. Apariencia, runtimes visibles, credenciales, instrumentación y permisos viven allí.
- Al salir de configuración vuelves al monitor ampliado; al contraer vuelves siempre al gadget.
- Los gráficos solo viven en memoria: conservan como máximo una hora mientras OB-Pulse siga abierto
  y se vacían al salir de la aplicación. Ocultar la ventana no detiene el muestreo.

## Qué significan los números

- **Host CPU/RAM**: carga de todo el ordenador, no del modelo únicamente.
- **Resident memory**: estimación que comunica Ollama de memoria de GPU residente; no es % de uso de GPU.
- **Context capacity**: tamaño de ventana reservado por el runtime cuando se informa.
- **Context used**: aparece `—` hasta conectar un cliente con ID de sesión y medición real.
- **READ/WRITE**: por ahora solo pruebas solicitadas explícitamente, no las conversaciones de otras apps.
- `—` significa desconocido o no disponible, nunca valor cero.

## Instrumentación opcional de una sesión

1. Abre el engranaje y busca **Sessions & request history**. El puente está desactivado al iniciar
   OB-Pulse.
2. Pulsa **Enable bridge** solo si vas a conectar un cliente local aprobado.
3. Usa los botones **Copy** para entregar manualmente al cliente el endpoint `127.0.0.1` y el token
   temporal que muestra la app.
4. Cuando el cliente emita eventos v1 verás contexto usado/capacidad, época de compactación,
   velocidad de lectura/escritura y latencia al primer token cuando esos valores hayan sido medidos.
5. Pulsa **Disable bridge** al terminar. El puerto se cierra y el token deja de ser válido.

El puente no intercepta tráfico ni conversaciones. Rechaza campos libres o desconocidos y nunca
acepta prompts, respuestas, argumentos de herramientas o credenciales. Los datos de sesión viven
solo en memoria hasta cerrar OB-Pulse.
