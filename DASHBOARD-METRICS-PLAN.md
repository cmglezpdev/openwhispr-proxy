# Mejoras de métricas y gráficos del dashboard

Alcance confirmado el 18 de octubre de 2026. Este documento conserva las decisiones para una implementación futura. La implementación está pendiente y debe esperar al commit del trabajo actual y a la migración del CSS a Tailwind.

Complementa [DASHBOARD-PLAN.md](./DASHBOARD-PLAN.md). Para las cards, el formato de audio y las visualizaciones descritas aquí, estas decisiones sustituyen las del plan anterior. El resto del comportamiento del dashboard se conserva.

## Orden de trabajo

1. Comitear los cambios actuales del proyecto.
2. Migrar el CSS del dashboard a Tailwind.
3. Implementar las mejoras de este documento sobre la interfaz ya migrada.

La petición que origina este archivo solo autoriza documentar el alcance. No incluye crear commits, migrar estilos ni implementar las mejoras ahora. La versión de Tailwind y los detalles de la migración se decidirán en esa tarea.

## Cards principales

Mantener tres cards: Requests, Recorded spend y Audio processed. Eliminar la card de Median latency. Esto no exige retirar la latencia de la tabla o de otras vistas.

Requests sigue contando las peticiones reales de transcripción y de mejora de texto. No se divide el total entre dos ni se presenta como cantidad de dictados.

Recorded spend muestra siempre dos decimales en USD. Por ejemplo, `$4.119862` pasa a `$4.12`. El redondeo es de presentación; los cálculos y los datos conservan su precisión.

Audio processed suma únicamente las duraciones conocidas de las transcripciones. Conserva la indicación de cobertura. Usa un selector discreto `Auto / Min / Horas`:

| Modo | Presentación |
| --- | --- |
| Auto, menos de un minuto | Segundos, por ejemplo `45 s` |
| Auto, desde un minuto hasta menos de una hora | Minutos y segundos, por ejemplo `36 min 50 s` |
| Auto, desde una hora | Horas y minutos, por ejemplo `2 h 15 min` |
| Min | Total en minutos decimales, con hasta dos decimales |
| Horas | Total en horas decimales, con hasta dos decimales |

Las horas son la unidad máxima del modo automático, incluso si el total supera un día. Los cambios de unidad solo afectan a la presentación.

## Aclaración sobre la duración registrada

La base guarda `duration_seconds`, pero el dashboard existente ya divide la suma entre 60 para mostrar minutos. No hay que reinterpretar el valor de la captura como segundos.

Los `2,209.6 min` de la captura equivalen aproximadamente a 36 horas, 49 minutos y 36 segundos. El `.6` es una fracción de minuto, unos 36 segundos. Las grabaciones también pueden tener fracciones de segundo.

Durante la revisión se consultó la base local en modo de solo lectura. En ese momento tenía 1,233 transcripciones, 1,126 con duración conocida, y un total de 133,240.983 segundos, aproximadamente 37 horas. Son valores de referencia de aquella revisión, no constantes para la interfaz ni resultados esperados de pruebas.

La duración procede del campo `durationInSeconds` del proveedor o, como alternativa, del análisis del archivo de audio. El total almacenado no demuestra cuánto tiempo hubo voz efectiva: puede incluir silencios y grabaciones repetidas. No se corrigen duraciones históricas ni se introduce detección de voz en esta tarea.

## Minigráficas de fondo

Sustituir los iconos de las tres cards por gráficas tenues que ocupen su fondo, con una línea y relleno verde suave. El valor, el título, los controles y la cobertura deben seguir leyéndose con claridad.

Crear un componente separado para poder ajustar o retirar esta presentación sin rehacer las cards ni sus cálculos. Cada gráfica usa su propia métrica: cantidad de requests, gasto registrado o duración de audio.

Las gráficas representan datos reales del mismo conjunto filtrado que las cards y Trend. No usan datos decorativos, muestras aleatorias ni una ventana temporal distinta.

Elegir automáticamente intervalos de calendario que produzcan un máximo aproximado de 30 puntos. Today puede usar horas; los rangos más amplios pueden usar días o agrupaciones de horas o días. Para históricos extensos, ampliar los intervalos en lugar de recortar el histórico. La agrupación suma los valores y conserva los totales; no elimina puntos para reducir su cantidad.

No se añaden ejes, leyendas ni detalles que compitan con la cifra principal. Los periodos sin actividad y las métricas desconocidas deben respetar las reglas del dashboard actual.

## Mapa de calor

Situarlo debajo de Trend, con un cuadrado por día y una escala de intensidad de menor a mayor uso. Incluir un selector entre requests, audio y gasto registrado.

El mapa sigue los filtros del dashboard, incluido el rango de fechas superior. Con Today representa un solo día. No impone un calendario independiente de doce meses. All time representa el histórico disponible.

Agrupar y etiquetar por días y meses para facilitar la lectura. Mostrar la fecha y el valor de cada día al inspeccionarlo, con sus unidades. Los valores desconocidos deben distinguirse de un cero real; mostrar la cobertura cuando corresponda.

## Métricas secundarias

Añadir una sección secundaria con palabras habladas, palabras por minuto, racha actual y racha más larga. No se necesita otra card de dictados ni controles para ocultar estas métricas en esta entrega.

### Palabras y ritmo

Contar las palabras del texto de las transcripciones. Excluir los textos de las mejoras para evitar contar dos veces el mismo contenido. El conteo representa las palabras del texto transcrito, no una medición independiente de la voz.

Estas métricas siguen los filtros del dashboard. Para palabras por minuto, usar únicamente transcripciones que tengan texto utilizable y duración conocida positiva:

`palabras por minuto = suma de palabras elegibles / (suma de segundos elegibles / 60)`

No promediar sin ponderación los ritmos de cada grabación. La duración incluye los silencios del audio. Indicar la cobertura de los datos empleados y mostrar un estado sin dato cuando no haya información suficiente, sin divisiones entre cero ni valores inválidos.

### Rachas

Un día cuenta si tiene al menos una transcripción exitosa. Las peticiones de mejora por sí solas no mantienen una racha. Usar las transcripciones guardadas como evidencia disponible; no se añade captura de estados o errores.

La racha actual es la secuencia de días consecutivos que termina hoy o ayer. Si no hubo actividad en ninguno de esos dos días, vale cero. La racha más larga es la mayor secuencia de días consecutivos con actividad.

Ambas se calculan sobre todo el historial, independientemente de los filtros del dashboard. Indicar ese alcance junto a las cifras para que no parezcan métricas de la selección.

## Fechas y datos incompletos

Interpretar los timestamps almacenados como UTC y agrupar los días, las horas y las rachas en la zona horaria del navegador. Usar calendario local, incluidos sus cambios de horario, en lugar de asumir que todos los días duran exactamente 24 horas.

Conservar las reglas existentes para costes y duraciones desconocidos. No sustituir datos ausentes por cero ni inventar palabras, duraciones o vínculos entre peticiones. Estas mejoras aprovechan el historial existente y no requieren nuevas tablas ni cambios en su captura.

## Criterios de aceptación

- [ ] El trabajo previo está comiteado y la migración a Tailwind está terminada antes de implementar estas mejoras.
- [ ] Hay tres cards principales y el gasto se presenta con dos decimales.
- [ ] Audio cambia de unidad correctamente en los límites de un minuto y una hora; el selector permite ver minutos u horas decimales.
- [ ] Las minigráficas están en un componente separado y conservan los totales del conjunto filtrado al agrupar.
- [ ] Cambiar el rango superior actualiza las cards, sus fondos y el mapa de calor.
- [ ] El mapa ofrece requests, audio y gasto, con un cuadrado por día y valores inspeccionables.
- [ ] Palabras y ritmo excluyen las mejoras de texto; el ritmo usa el cociente de totales con cobertura válida.
- [ ] Las rachas usan todo el historial, funcionan con actividad ayer y respetan los días locales del navegador.
- [ ] La selección vacía y los datos incompletos no producen cifras inválidas ni presentan valores desconocidos como cero.
- [ ] La presentación se revisa en escritorio y móvil, comprobando legibilidad de las cards y del calendario.

Cuando se implemente, ejecutar los checks del proyecto y verificar las reglas de agregación, los límites temporales y la presentación en el navegador. Este archivo por sí solo no requiere cambios de código ni pruebas de implementación.
