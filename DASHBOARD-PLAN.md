# Panel local de uso de OpenWhispr Proxy

Este documento recoge el alcance acordado para implementar en otra sesión un panel local que permita consultar el histórico de SQLite y analizar su consumo. La interfaz se servirá desde el propio proxy, dentro de la misma imagen de Docker. El panel se implementó en la rama `feat/local-usage-dashboard`. Este documento conserva el alcance acordado y los criterios de aceptación.

## Contexto de implementación

1. Continuar en la rama `feat/local-usage-dashboard` y comprobar el estado de Git antes de editar.
2. Leer este documento y las instrucciones del repositorio. Preferir las herramientas de codebase-memory-mcp para descubrir código.
3. Revisar el estado actual del esquema y los servicios antes de implementar, por si han cambiado desde esta conversación.
4. Implementar la lectura del histórico y la interfaz según el alcance siguiente.
5. Verificar el funcionamiento tanto en desarrollo como con la imagen de Docker.

El documento y la implementación quedan disponibles para revisión y commit. No se ha solicitado crear commits.

## Decisiones acordadas

- El proxy se ejecuta localmente en Docker. El panel se abre mediante una URL de localhost y no requiere autenticación.
- Se mantiene una única imagen, un único contenedor y el servidor existente.
- La interfaz usa React y TypeScript, TanStack Table para la tabla y TanStack Charts para los gráficos.
- Al abrir la página se carga todo el histórico disponible. Para incorporar nuevas peticiones se recarga la página; no hay actualización automática.
- La búsqueda, los filtros, la ordenación y las agregaciones se calculan en memoria en el navegador.
- La tabla y el dashboard comparten filtros por defecto, con una opción para desvincularlos.
- Se muestran las métricas soportadas por los datos actuales. No se añade captura de tokens en esta tarea.
- El panel consulta únicamente las dos tablas originales. No se amplía la captura de peticiones.

## Arquitectura y Docker

El backend actual usa Nest y Node. El archivo `dockerfile` ya separa construcción, dependencias de producción y ejecución. `docker-compose.yml` monta `./data:/app/data`, donde permanece SQLite.

Añadir el frontend al repositorio como código separado por componentes. Compilarlo durante la construcción y copiar sus archivos estáticos a la imagen final. El proceso de Nest sirve esos archivos y conserva sus endpoints de proxy. No hace falta un segundo proceso de frontend en producción.

Rutas propuestas, pendientes de comprobar que no colisionan con las existentes:

- `GET /dashboard` entrega el HTML de entrada de la aplicación.
- Los recursos compilados se sirven bajo una ruta propia del panel.
- `GET /dashboard/api/requests` entrega el histórico completo mediante JSON.

El navegador solicita los datos una vez al abrir la aplicación. SQLite solo lo lee el backend. No se incrusta la lógica completa ni todo el histórico dentro de una cadena HTML mantenida a mano. Los recursos del panel se incluyen en la imagen, sin depender de CDNs para funcionar en local.

El frontend debe quedar organizado en componentes de filtros, tabla, detalle de petición, resúmenes y gráficos. Las reglas de filtrado y agregación deben poder reutilizarse entre tabla y dashboard. No se ha elegido una biblioteca de componentes visuales ni se exige Tailwind.

## Datos existentes y significado

Se verificaron las migraciones, las inserciones del repositorio y las columnas de la base local `data/usage.db`, sin leer el contenido de los textos.

Referencias del código actual:

- `src/usage/usage.repository.ts`: esquema, migraciones e inserciones.
- `src/audio/audio.service.ts`: captura de las transcripciones.
- `src/chat/chat.service.ts`: captura de las mejoras de texto.
- `src/chat/chat.controller.ts`: validación y entrada del endpoint de chat.
- `src/main.ts`: arranque del servidor.

Las tablas `transcriptions` y `enhanced_transcriptions` tienen las columnas siguientes:

- `id`: entero autoincremental, independiente en cada tabla.
- `created_at`: fecha de inserción, generada con `datetime('now')` de SQLite, en UTC y sin sufijo explícito de zona horaria.
- `model`: modelo utilizado.
- `text`: texto resultante del proveedor.
- `cost_usd`: coste registrado, que puede faltar.
- `generation_id`: identificador de generación, que puede faltar.
- `latency_ms`: duración de la llamada al proveedor, que puede faltar en filas antiguas.

Solo `transcriptions` tiene `duration_seconds`, que también puede faltar. Representa duración del audio, no tiempo de espera de la petición.

La identidad de una fila en el listado combinado debe incluir el tipo y el ID para evitar colisiones entre las tablas. No existe una relación persistida que permita unir una transcripción con su posterior mejora como una misma sesión de dictado.

Actualmente no se persisten tokens de entrada, salida, caché o totales. El servicio de chat recibe el resultado de generación, pero no envía contadores de tokens al repositorio. El panel no debe estimarlos a partir del texto o del coste ni mostrar controles de tokens sin datos.

Tampoco se guardan nombre, petición original completa, URL del audio o estado de error. `generation_id` no es una URL persistida y no debe convertirse en un enlace supuesto.

El coste del chat se extrae de los metadatos del último paso. El código actual no suma explícitamente costes de varios pasos. El panel muestra el coste registrado y no lo presenta como una conciliación exacta de facturación.

## Reglas para valores desconocidos

- Un coste desconocido se muestra como "Sin dato", nunca como cero.
- El gasto total suma únicamente costes conocidos y muestra cuántas peticiones carecen de coste.
- Los minutos suman las duraciones conocidas de las transcripciones. Las mejoras de texto muestran "No aplica" en duración de audio.
- Distinguir una transcripción con duración desconocida de una mejora a la que no aplica esa métrica.
- Calcular promedios, medianas y otros resúmenes solo sobre valores disponibles e indicar su cobertura cuando corresponda.
- Una selección vacía muestra un estado sin resultados, con contadores en cero y sin porcentajes o promedios inválidos.

## Tabla y filtros

Mostrar un listado unificado de transcripciones y mejoras. Ofrecer todas las columnas disponibles mediante un selector de columnas. Mantener el texto largo abreviado en las filas y abrir el resultado completo al seleccionar una petición.

Filtros de la primera versión:

- Fecha desde/hasta y accesos rápidos para hoy, últimos 7, 30 y 90 días, mes actual e histórico completo.
- Tipo de operación, transcripción o mejora.
- Modelo con selección múltiple, incluyendo un estado para modelo desconocido cuando corresponda.
- Coste mayor que, menor que o entre dos valores. Añadir selección de coste conocido o sin dato.
- Duración de audio por rango, aplicable a transcripciones.
- Latencia por rango.
- Búsqueda de texto en el resultado, y búsqueda exacta de identificadores.

Combinar filtros de campos diferentes mediante Y. Combinar los valores seleccionados de un mismo campo mediante O. No se requiere un constructor de expresiones anidadas.

Ejemplo de consulta: transcripciones de septiembre, de cualquiera de dos modelos seleccionados, con coste mayor que un importe.

Permitir ordenar por fecha, coste, duración, latencia y modelo, en ambas direcciones y con ordenación por varias columnas. Usar fecha descendente por defecto. Los identificadores sirven para localizar y copiar, sin ofrecerlos como ordenación principal. Los valores desconocidos deben tener una posición consistente al ordenar.

La paginación es visual y se hace sobre los datos cargados. Ordenar o cambiar de página no modifica el conjunto usado por los gráficos. Mostrar número de coincidencias, filtros activos y una acción para limpiarlos.

## Relación entre tabla y dashboard

El modo vinculado está activo por defecto. Tabla, tarjetas y gráficos usan el mismo subconjunto filtrado completo, antes de paginar. Un filtro cambiado desde cualquiera de las vistas actualiza ese estado compartido.

Cambiar la métrica, la agrupación temporal o el tipo de representación de un gráfico solo cambia su presentación. No cambia los filtros ni las filas de la tabla.

Un acceso rápido como "última semana" sí modifica el filtro de fechas. En modo vinculado afecta a ambas vistas.

Al desvincular, copiar los filtros actuales al dashboard. Desde ese momento cada vista puede modificarlos de forma independiente. Mostrar los filtros activos en cada vista y el estado de vinculación. Al volver a vincular, el dashboard adopta los filtros de la tabla y descarta sus filtros independientes.

## Métricas y gráficos

Las tarjetas resumen incluyen cantidad de peticiones, gasto registrado, minutos de audio y latencia mediana. Todas respetan los filtros de su vista. Mostrar la cobertura de costes y duraciones junto a los totales correspondientes.

Gráficos principales:

- Peticiones por periodo con barras del total registrado.
- Consumo por periodo con selector de gasto registrado o minutos de audio.
- Comparación por modelo o tipo de operación mediante barras horizontales. Permitir elegir peticiones, gasto o minutos cuando aplique.

Ofrecer agrupación por día, semana, mes y año. Las fechas de SQLite se interpretan explícitamente como UTC y se muestran y agrupan en la zona horaria del navegador. Usar semanas de lunes a domingo e indicar los límites del periodo en los tooltips. El rango de fechas pertenece a los filtros; no crear otro rango oculto dentro del gráfico.

Puede añadirse una línea de gasto acumulado dentro del subconjunto seleccionado. Las barras son la representación inicial para consumos por periodo y comparaciones. No se requiere un pastel en esta versión. No mezclar dólares y minutos sobre el mismo eje.

Completar con cero los periodos sin peticiones dentro del rango representado, sin convertir en cero el coste desconocido de peticiones existentes. Los tooltips deben distinguir gasto registrado y operaciones sin coste disponible.

## Límites del alcance

Esta tarea no añade captura ni estimación de tokens, recuperación del histórico desde el proveedor, autenticación, actualización en tiempo real, otro contenedor de frontend ni correlación de operaciones como sesiones de dictado. Tampoco modifica la semántica de facturación o los costes históricos.

El panel trabaja con los campos existentes y conserva las migraciones originales. No añade tablas, estados HTTP ni captura de errores. Las bases que ya tengan una versión superior se pueden seguir leyendo sin borrar datos.

## Verificación de la implementación

- [x] La misma imagen sirve el proxy y el panel; el volumen de SQLite permanece operativo.
- [x] Se conservan las tablas y las filas originales.
- [x] Las peticiones rechazadas no cambian el histórico del panel.
- [x] Consultar el panel no añade filas de consumo.
- [x] La aplicación carga el histórico completo y permite actualizarlo recargando la página.
- [x] Los filtros combinados producen las mismas coincidencias en tabla y dashboard vinculado.
- [x] Los gráficos usan todas las coincidencias y no solo la página visible de la tabla.
- [x] Desvincular, filtrar por separado y volver a vincular respeta las reglas descritas.
- [x] Las agregaciones manejan costes y duraciones desconocidos, filas históricas y selección vacía.
- [x] Las fechas próximas a medianoche UTC y los cambios de semana se agrupan correctamente en la zona local.
- [x] Se pueden inspeccionar textos largos sin romper el listado.
- [x] El contrato y la interfaz no exponen credenciales ni muestran métricas de tokens inexistentes.

Ejecutar los checks del repositorio que correspondan y probar la imagen construida. Los tests nuevos deben cubrir las reglas de filtrado y agregación, especialmente valores desconocidos y límites temporales.

## Referencias de las bibliotecas

- [TanStack Table: procesamiento en cliente o servidor](https://tanstack.com/table/latest/docs/guide/client-side-vs-server-side).
- [TanStack Table: filtros por columna](https://tanstack.com/table/latest/docs/framework/react/guide/column-filtering).
- [TanStack Charts](https://tanstack.com/charts/latest).

Se verificó la existencia de TanStack Charts y su API estable durante la conversación. Al implementar, comprobar las versiones vigentes y sus APIs oficiales antes de instalar dependencias.

## Verificación

Ejecutar `pnpm test:all`, el build y los linters después de modificar el panel. Las pruebas usan bases temporales y las llamadas al SDK están simuladas dentro de Jest.

La captura adicional y la simulación de Postman se retiraron del alcance. No se requieren herramientas de Postman para desarrollar o probar el dashboard. No se crearon commits.
