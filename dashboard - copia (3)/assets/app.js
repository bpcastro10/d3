const client = ZAFClient.init();
let ticketTrendPlot = null;
let priorityDistributionPlot = null;
let realtimePlot = null;

// Tooltip global (adaptado para uPlot)
let globalTooltip = null;

// Para guardar los límites originales de zoom
let originalScales = new WeakMap();

// Objeto para almacenar instancias de uPlot
let charts = {
    status: null,
    priority: null,
    temporal: null,
    hourly: null,
    weekday: null,
    projection: null
};

// Colores para los gráficos (pueden necesitar ajuste para uPlot si no usa los mismos formatos)
const chartColors = {
    primary: '#0d6efd',
    secondary: '#6c757d',
    success: '#198754',
    info: '#0dcaf0',
    warning: '#ffc107',
    danger: '#dc3545',
    light: '#f8f9fa',
    dark: '#212529'
};

// Configuración de fechas por defecto
function setDefaultDates() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    document.getElementById('startDate').value = startDate.toISOString().split('T')[0];
    document.getElementById('endDate').value = endDate.toISOString().split('T')[0];
}

// Inicializar la aplicación
async function init() {
    setDefaultDates();
    await updateDashboard();
    initRealtimePlot();
    startRealtimeUpdates();
}

// Inicializar gráfico en tiempo real
function initRealtimePlot() {
    const opts = {
        width: document.getElementById('realtimeTrend').offsetWidth,
        height: 300,
        title: "Tickets por Hora",
        cursor: {
            show: true,
            sync: {
                key: "ticketSync"
            }
        },
        scales: {
            x: {
                time: true,
            },
            y: {
                auto: true,
            }
        },
        axes: [
            {
                stroke: "#03363d",
                grid: { show: true, stroke: "#d8dcde" },
                ticks: { show: true, stroke: "#03363d" },
                font: "12px Arial",
            },
            {
                stroke: "#03363d",
                grid: { show: true, stroke: "#d8dcde" },
                ticks: { show: true, stroke: "#03363d" },
                font: "12px Arial",
            }
        ],
        series: [
            {},
            {
                stroke: "#03363d",
                width: 2,
                fill: "rgba(3, 54, 61, 0.1)",
            }
        ],
        plugins: [
            tooltipPlugin(),
            zoomPlugin()
        ]
    };

    realtimePlot = new uPlot(opts, [[], []], document.getElementById('realtimeTrend'));
}

// Configuración común básica para uPlot
// Las opciones específicas como escalas y series se definirán en cada función de gráfico
const commonUPlotOptions = {
    responsive: true,
    // width y height se pueden controlar con CSS a través del div contenedor
    // uPlot ajusta su tamaño al contenedor si responsive es true
    plugins: [
         // Plugins de zoom y drag-zoom se añadirán individualmente a los gráficos de líneas/barras temporales
    ],
    // Opciones de zoom y pan nativas de uPlot
    zoom: {
        interactive: true,
        wheel: true, // Habilitar zoom con rueda del ratón
        pinch: true, // Habilitar zoom con pellizco en touch
        drag: { // Habilitar zoom por selección de área con arrastrar
            setScale: true,
            x: true,
            y: true,
            // Cambiar color del área de selección si se desea
            // backgroundColor: 'rgba(0,0,255,0.1)',
            // borderColor: 'rgba(0,0,255,0.3)',
        },
        onZoom: function(u, xZoom, yZoom) { /* console.log(`Zoomed to x: ${xZoom}, y: ${yZoom}`); */ },
        onPan: function(u, xPan, yPan) { /* console.log(`Panned to x: ${xPan}, y: ${yPan}`); */ },
    },
    pan: {
        interactive: true,
        onPan: function(u, xPan, yPan) { /* console.log(`Panned to x: ${xPan}, y: ${yPan}`); */ },
    },
};

// Plugin para tooltips (solo uno global, adaptado para uPlot)
function tooltipPlugin() {
    return {
        hooks: {
            setCursor: [
                (u) => {
                    if (!globalTooltip) {
                        globalTooltip = document.createElement("div");
                        globalTooltip.className = "uplot-tooltip";
                        globalTooltip.style.position = "absolute";
                        globalTooltip.style.pointerEvents = "none";
                        globalTooltip.style.zIndex = "100";
                        document.body.appendChild(globalTooltip);
                    }
                    const { left, top } = u.cursor;
                    const idx = u.cursor.idx;
                    if (idx !== null && u.data[0][idx] !== undefined) {
                        // Adaptar la información mostrada en el tooltip según el gráfico y los datos
                        let tooltipContent = '';
                        if (u.series && u.data && u.data[0] && u.data[0][idx] !== undefined) {
                             // Para gráficos temporales, mostrar fecha/hora
                             if (u.scales.x.time) {
                                  tooltipContent += `Fecha/Hora: ${uPlot.fmtDate(new Date(u.data[0][idx] * 1000), "{YYYY}-{MM}-{DD} {H}:{mm}")}<br>`;
                             } else { // Para gráficos categóricos (estado, prioridad, día de la semana)
                                  // Asumimos que el eje X son índices y usamos el valor de la etiqueta del eje
                                   const label = u.axes[0].values[u.data[0][idx]];
                                  tooltipContent += `Categoría: ${label}<br>`;
                             }

                             // Iterar sobre las series para mostrar valores
                             for(let i = 1; i < u.series.length; i++) {
                                  if (u.series[i].label && u.data[i] && u.data[i][idx] !== undefined && u.data[i][idx] !== null) {
                                       tooltipContent += `${u.series[i].label}: ${u.data[i][idx]}<br>`;
                                  }
                             }
                        }

                        if (tooltipContent) {
                            globalTooltip.innerHTML = tooltipContent;
                            globalTooltip.style.display = "block";
                             // Posicionar el tooltip cerca del cursor
                             const chartRect = u.root.getBoundingClientRect();
                             globalTooltip.style.left = (chartRect.left + left + 10) + "px";
                             globalTooltip.style.top = (chartRect.top + top - 30) + "px";
                        } else {
                             globalTooltip.style.display = "none";
                        }
                    } else {
                        globalTooltip.style.display = "none";
                    }
                }
            ],
            setSeries: [
                () => {
                    if (globalTooltip) globalTooltip.style.display = "none";
                }
            ],
            setScale: [
                () => {
                    if (globalTooltip) globalTooltip.style.display = "none";
                }
            ],
            ready: [
                (u) => {
                    u.root.addEventListener('mouseleave', () => {
                        if (globalTooltip) globalTooltip.style.display = "none";
                    });
                }
            ]
        }
    };
}

// Plugin para zoom con rueda y doble clic (reset) - Adaptado para uPlot
function zoomPlugin() {
    return {
        hooks: {
            ready: [
                (u) => {
                    // Guardar los límites originales al iniciar
                    if (!originalScales.has(u)) {
                        originalScales.set(u, {
                            xMin: u.scales.x.min,
                            xMax: u.scales.x.max,
                            yMin: u.scales.y.min,
                            yMax: u.scales.y.max
                        });
                    }

                    // La funcionalidad principal de zoom con rueda y arrastrar ahora usa las opciones nativas de uPlot (commonUPlotOptions.zoom)
                    // Este listener se mantiene principalmente para el doble clic para resetear el zoom.
                    u.over.addEventListener("dblclick", () => {
                        // Zoom out a los límites originales
                        const orig = originalScales.get(u);
                        if (orig) {
                            u.setScale("x", { min: orig.xMin, max: orig.xMax });
                            u.setScale("y", { min: orig.yMin, max: orig.yMax });
                        }
                    });
                }
            ]
        }
    };
}

// Plugin para zoom in con selección de región (drag) - Adaptado para uPlot
function dragZoomPlugin() {
    return {
        hooks: {
            ready: [
                (u) => {
                     // uPlot tiene una opción de drag-zoom nativa en su configuración.
                     // Podemos activarla en commonUPlotOptions o en las opciones individuales del gráfico.
                     // Este plugin JS sería para una implementación personalizada si la nativa no cumple.
                     // Vamos a confiar en la opción nativa de uPlot por ahora.
                }
            ]
        }
    };
}

// Actualizar datos en tiempo real
async function updateRealtimeData() {
    try {
        const tickets = await client.get('ticket.list');
        const currentTickets = tickets['ticket.list'];
        
        // Agrupar tickets por hora
        const hourlyData = {};
        currentTickets.forEach(ticket => {
            const date = new Date(ticket.created_at);
            const hourKey = date.toISOString().slice(0, 13);
            hourlyData[hourKey] = (hourlyData[hourKey] || 0) + 1;
        });

        // Actualizar datos del gráfico
        const now = new Date();
        const timestamps = [];
        const values = [];

        // Mantener solo las últimas 24 horas
        for (let i = 23; i >= 0; i--) {
            const date = new Date(now);
            date.setHours(date.getHours() - i);
            const hourKey = date.toISOString().slice(0, 13);
            timestamps.push(date.getTime());
            values.push(hourlyData[hourKey] || 0);
        }

        realtimePlot.setData([timestamps, values]);
    } catch (error) {
        console.error('Error al actualizar datos en tiempo real:', error);
    }
}

// Iniciar actualizaciones en tiempo real
function startRealtimeUpdates() {
    updateRealtimeData();
    setInterval(updateRealtimeData, 60000);
}

// Obtener datos de tickets
async function getTicketData() {
    try {
        const tickets = await client.get('ticket.list');
        return tickets['ticket.list'];
    } catch (error) {
        console.error('Error al obtener tickets:', error);
        return [];
    }
}

// Actualizar el dashboard
async function updateDashboard() {
    const startDate = new Date(document.getElementById('startDate').value);
    const endDate = new Date(document.getElementById('endDate').value);
    
    const tickets = await getTicketData();
    const filteredTickets = tickets.filter(ticket => {
        const ticketDate = new Date(ticket.created_at);
        return ticketDate >= startDate && ticketDate <= endDate;
    });

    updateStats(filteredTickets);
    updatePlots(filteredTickets);
}

// Actualizar estadísticas
function updateStats(tickets) {
    document.getElementById('totalTickets').textContent = tickets.length;
    document.getElementById('openTickets').textContent = 
        tickets.filter(t => t.status === 'open').length;
    document.getElementById('closedTickets').textContent = 
        tickets.filter(t => t.status === 'closed').length;
}

// Actualizar gráficos
function updatePlots(tickets) {
    updateTicketTrend(tickets);
    updatePriorityDistribution(tickets);
}

// Actualizar gráfico de tendencia de tickets
function updateTicketTrend(tickets) {
    const dates = {};
    tickets.forEach(ticket => {
        const date = ticket.created_at.split('T')[0];
        dates[date] = (dates[date] || 0) + 1;
    });

    const sortedDates = Object.keys(dates).sort();
    const timestamps = sortedDates.map(date => new Date(date).getTime());
    const counts = sortedDates.map(date => dates[date]);

    if (ticketTrendPlot) {
        ticketTrendPlot.destroy();
    }

    const opts = {
        width: document.getElementById('ticketTrend').offsetWidth,
        height: 300,
        title: "Tickets por Día",
        cursor: {
            show: true,
            sync: {
                key: "ticketSync"
            }
        },
        scales: {
            x: {
                time: true,
            },
            y: {
                auto: true,
            }
        },
        axes: [
            {
                stroke: "#03363d",
                grid: { show: true, stroke: "#d8dcde" },
                ticks: { show: true, stroke: "#03363d" },
                font: "12px Arial",
            },
            {
                stroke: "#03363d",
                grid: { show: true, stroke: "#d8dcde" },
                ticks: { show: true, stroke: "#03363d" },
                font: "12px Arial",
            }
        ],
        series: [
            {},
            {
                stroke: "#03363d",
                width: 2,
                fill: "rgba(3, 54, 61, 0.1)",
            }
        ],
        plugins: [
            tooltipPlugin(),
            zoomPlugin()
        ]
    };

    ticketTrendPlot = new uPlot(opts, [timestamps, counts], document.getElementById('ticketTrend'));
}

// Actualizar gráfico de distribución de prioridades
function updatePriorityDistribution(tickets) {
    const priorities = {};
    tickets.forEach(ticket => {
        priorities[ticket.priority] = (priorities[ticket.priority] || 0) + 1;
    });

    if (priorityDistributionPlot) {
        priorityDistributionPlot.destroy();
    }

    const labels = Object.keys(priorities);
    const values = Object.values(priorities);
    const total = values.reduce((a, b) => a + b, 0);
    const percentages = values.map(v => (v / total * 100).toFixed(1));

    const opts = {
        width: document.getElementById('priorityDistribution').offsetWidth,
        height: 300,
        title: "Distribución por Prioridad",
        cursor: {
            show: true,
            sync: {
                key: "ticketSync"
            }
        },
        scales: {
            x: {
                auto: true,
            },
            y: {
                auto: true,
            }
        },
        axes: [
            {
                stroke: "#03363d",
                grid: { show: true, stroke: "#d8dcde" },
                ticks: { show: true, stroke: "#03363d" },
                font: "12px Arial",
            },
            {
                stroke: "#03363d",
                grid: { show: true, stroke: "#d8dcde" },
                ticks: { show: true, stroke: "#03363d" },
                font: "12px Arial",
            }
        ],
        series: [
            {},
            {
                stroke: "#03363d",
                width: 2,
                fill: "rgba(3, 54, 61, 0.1)",
            }
        ],
        plugins: [
            tooltipPlugin(),
            zoomPlugin()
        ]
    };

    priorityDistributionPlot = new uPlot(opts, [labels, values], document.getElementById('priorityDistribution'));
}

// Función para actualizar las métricas principales en el HTML
function updateMetrics(data) {
    console.log("Updating metrics with data:", data);
    // Ajustar según la estructura real de la respuesta del endpoint /analyze
    if (data) {
        document.getElementById('total-tickets').textContent = data.total_tickets !== undefined ? data.total_tickets : 'N/A';
        
        // Actualizar métricas basadas en daily_statistics si están disponibles
         if (data.daily_statistics) {
             // Para 'Tickets hoy', necesitamos el recuento del día actual de tickets_by_date
              const today = new Date().toISOString().split('T')[0];
             let ticketsToday = 0;
             if (data.tickets_by_date && data.tickets_by_date.date && data.tickets_by_date.count) {
                 const todayIndex = data.tickets_by_date.date.findIndex(d => d === today);
                 if (todayIndex !== -1) {
                     ticketsToday = data.tickets_by_date.count[todayIndex];
                 }
             }
              document.getElementById('tickets-hoy').textContent = ticketsToday;

             // Para 'Tickets pendientes' y 'Tasa de resolución', necesitamos esos datos directamente del backend o calcularlos
             // Si el backend no los proporciona explícitamente en la respuesta /analyze actual
             // (revisando main.py, no los devuelve así directamente, solo distribuciones y estadísticas diarias/horarias)
             // Mantendremos placeholders por ahora o los calcularemos si es factible desde los datos crudos (que no tenemos aquí).
              document.getElementById('tickets-pendientes').textContent = '-'; // Backend no proporciona directamente
              document.getElementById('tasa-resolucion').textContent = '-%'; // Backend no proporciona directamente
         } else {
              // Limpiar o poner N/A si no hay datos de estadísticas diarias
              document.getElementById('tickets-hoy').textContent = 'N/A';
              document.getElementById('tickets-pendientes').textContent = 'N/A';
              document.getElementById('tasa-resolucion').textContent = 'N/A';
         }
    }
}

// Función para crear el gráfico de distribución por estado (adaptado a barras uPlot)
function createStatusChart(data) {
    console.log("Creating Status Chart (uPlot)", data);
    const container = document.getElementById('status-chart');
    if (!container) return;

    // Destruir gráfico existente si lo hay
    if (charts.status) {
         charts.status.destroy();
         container.innerHTML = ''; // Limpiar el div
    }

    // Adaptar datos de status_distribution del backend para uPlot (gráfico de barras simple)
    if (data && data.status_distribution && data.status_distribution.status && data.status_distribution.count) {
        const labels = data.status_distribution.status;
        const counts = data.status_distribution.count;

        // uPlot para barras categóricas: usar índices como eje X y mapear etiquetas
        const xValues = Array.from(labels.keys());
        const yValues = counts;

        const opts = {
            ...commonUPlotOptions,
            title: "Distribución por Estado",
            width: container.offsetWidth,
            height: 350, // Altura definida en el contenedor CSS
            scales: {
                x: { }, // Eje numérico para índices
                y: { auto: true, min: 0 },
            },
            series: [
                {},
                {
                    label: "Cantidad",
                    stroke: chartColors.primary,
                    fill: "rgba(13, 110, 253, 0.2)",
                    paths: uPlot.paths.bars({ size: [0.6, 0.1] }),
                    points: { show: false },
                },
            ],
            axes: [
                {   // x-axis
                    values: labels, // Mostrar las etiquetas de estado
                    side: 2, // Mostrar abajo
                },
                {   // y-axis
                     size: (u, values, space) => u.axisFontSize,
                }
            ],
            plugins: [tooltipPlugin() /* No se añade zoom a gráficos de distribución categórica */]
        };

        const plotData = [xValues, yValues];

        charts.status = new uPlot(opts, plotData, container);

    } else {
         container.innerHTML = '<p>No hay datos disponibles para el gráfico de estado.</p>';
    }
}

// Función para crear el gráfico de distribución por prioridad (adaptado a barras uPlot)
function createPriorityChart(data) {
    console.log("Creating Priority Chart (uPlot)", data);
     const container = document.getElementById('priority-chart');
    if (!container) return;

    // Destruir gráfico existente si lo hay
    if (charts.priority) {
         charts.priority.destroy();
         container.innerHTML = ''; // Limpiar el div
    }

    // Adaptar datos de priority_distribution del backend para uPlot (gráfico de barras simple)
     if (data && data.priority_distribution && data.priority_distribution.priority && data.priority_distribution.count) {
        const labels = data.priority_distribution.priority;
        const counts = data.priority_distribution.count;

         // uPlot para barras categóricas: usar índices como eje X y mapear etiquetas
        const xValues = Array.from(labels.keys());
        const yValues = counts;

        const opts = {
            ...commonUPlotOptions,
            title: "Distribución por Prioridad",
             width: container.offsetWidth,
            height: 350,
            scales: {
                x: { }, // Eje numérico para índices
                y: { auto: true, min: 0 },
            },
            series: [
                {},
                {
                    label: "Cantidad",
                    stroke: chartColors.info,
                    fill: "rgba(13, 202, 240, 0.2)",
                    paths: uPlot.paths.bars({ size: [0.6, 0.1] }),
                    points: { show: false },
                },
            ],
             axes: [
                {   // x-axis
                    values: labels, // Mostrar las etiquetas de prioridad
                     side: 2, // Mostrar abajo
                },
                {   // y-axis
                     size: (u, values, space) => u.axisFontSize,
                }
            ],
             plugins: [tooltipPlugin() /* No se añade zoom a gráficos de distribución categórica */]
        };

         const plotData = [xValues, yValues];

        charts.priority = new uPlot(opts, plotData, container);

    } else {
         container.innerHTML = '<p>No hay datos disponibles para el gráfico de prioridad.</p>';
    }
}

// Función para crear el gráfico temporal (Tickets por Día)
function createTemporalChart(data) {
     console.log("Creating Temporal Chart (uPlot)", data);
      const container = document.getElementById('temporal-chart');
    if (!container) return;

    // Destruir gráfico existente si lo hay
    if (charts.temporal) {
         charts.temporal.destroy();
         container.innerHTML = ''; // Limpiar el div
    }

    // Adaptar datos de tickets_by_date del backend para uPlot
    if (data && data.tickets_by_date && data.tickets_by_date.date && data.tickets_by_date.count) {
        const dates = data.tickets_by_date.date.map(d => new Date(d).getTime() / 1000); // uPlot usa timestamps en segundos
        const counts = data.tickets_by_date.count;

        const opts = {
            ...commonUPlotOptions,
            title: "Tickets por Día",
             width: container.offsetWidth,
            height: 350, // Altura definida en el contenedor CSS
            scales: {
                x: { time: true },
                y: { auto: true, min: 0 },
            },
            series: [
                {},
                {
                    label: "Tickets por día",
                    stroke: chartColors.primary,
                    width: 2,
                    fill: "rgba(13, 110, 253, 0.1)",
                },
            ],
            axes: [
                {   // x-axis
                    values: (u, ticks, space) => ticks.map(ts => uPlot.fmtDate(new Date(ts * 1000), "{MMM} {DD}")),
                },
                {   // y-axis
                    size: (u, values, space) => u.axisFontSize,
                }
            ],
             plugins: [tooltipPlugin(), zoomPlugin()]
        };

        charts.temporal = new uPlot(opts, [dates, counts], container);
    } else {
         container.innerHTML = '<p>No hay datos disponibles para el gráfico temporal.</p>';
    }
}

// Función para crear el gráfico por hora (adaptado a uPlot)
function createHourlyChart(data) {
     console.log("Creating Hourly Chart (uPlot)", data);
     const container = document.getElementById('hourly-chart');
    if (!container) return;

    // Destruir gráfico existente si lo hay
    if (charts.hourly) {
         charts.hourly.destroy();
         container.innerHTML = ''; // Limpiar el div
    }

    // Adaptar datos de hourly_distribution del backend para uPlot
     if (data && data.hourly_distribution && data.hourly_distribution.hours && data.hourly_distribution.counts) {
        const hours = data.hourly_distribution.hours; // Son números de 0 a 23
        const counts = data.hourly_distribution.counts;

        // Para uPlot, podríamos usar los números de hora como eje X numérico o convertir a un formato de tiempo/categoría
        // Usaremos los números de hora directamente por simplicidad

        const opts = {
            ...commonUPlotOptions,
            title: "Distribución por Hora",
             width: container.offsetWidth,
            height: 350,
            scales: {
                x: { }, // Eje numérico simple
                y: { auto: true, min: 0 },
            },
            series: [
                {},
                {
                    label: "Tickets por hora",
                    stroke: chartColors.info,
                    width: 2,
                    fill: "rgba(13, 202, 240, 0.1)",
                },
            ],
             axes: [
                {   // x-axis
                    values: hours,
                     label: "Hora del día (0-23)"
                },
                {   // y-axis
                     size: (u, values, space) => u.axisFontSize,
                }
            ],
             plugins: [tooltipPlugin(), zoomPlugin()]
        };

        charts.hourly = new uPlot(opts, [hours, counts], container);
    } else {
         container.innerHTML = '<p>No hay datos disponibles para el gráfico por hora.</p>';
    }
}

// Función para crear el gráfico por día de la semana (adaptado a uPlot)
function createWeekdayChart(data) {
    console.log("Creating Weekday Chart (uPlot)", data);
    const container = document.getElementById('weekday-chart');
    if (!container) return;

    // Destruir gráfico existente si lo hay
    if (charts.weekday) {
         charts.weekday.destroy();
         container.innerHTML = ''; // Limpiar el div
    }

     // Adaptar datos de weekday_distribution del backend para uPlot (gráfico de barras simple)
     if (data && data.weekday_distribution && data.weekday_distribution.weekdays && data.weekday_distribution.counts) {
        const weekdays = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const rawWeekdays = data.weekday_distribution.weekdays; // Números 0-6
        const counts = data.weekday_distribution.counts;

        // Ordenar los datos por día de la semana (0-6)
        const sortedData = rawWeekdays.map((day, index) => ({ day: day, count: counts[index] }))
                                       .sort((a, b) => a.day - b.day);

        const sortedWeekdaysLabels = sortedData.map(item => weekdays[item.day]);
        const sortedCounts = sortedData.map(item => item.count);

        // Para uPlot como gráfico de barras, podemos usar índices o los nombres como categorías si se configura adecuadamente
        // Usaremos índices como eje X y mapearemos las etiquetas manualmente

        const opts = {
            ...commonUPlotOptions,
            title: "Distribución por Día de la Semana",
             width: container.offsetWidth,
            height: 350,
            scales: {
                x: { }, // Eje numérico para índices
                y: { auto: true, min: 0 },
            },
            series: [
                {},
                {
                    label: "Tickets por día",
                    stroke: chartColors.warning,
                    fill: "rgba(255, 193, 7, 0.2)",
                    // Para barras, uPlot usa `paths` o renderizadores personalizados. Configuración básica:
                    paths: uPlot.paths.bars({ size: [0.6, 0.1] }), // Ajusta el tamaño de las barras
                    points: { show: false },
                },
            ],
             axes: [
                {   // x-axis
                    values: sortedWeekdaysLabels, // Mostrar las etiquetas de los días
                     side: 2, // Mostrar abajo
                },
                {   // y-axis
                     size: (u, values, space) => u.axisFontSize,
                }
            ],
             plugins: [tooltipPlugin() /* No se añade zoom a gráficos de distribución categórica */]
        };

        // Los datos para uPlot deben ser un array de arrays: [[x-values], [y-values]]
        const plotData = [Array.from(sortedData.keys()), sortedCounts]; // Eje X con índices 0-6

        charts.weekday = new uPlot(opts, plotData, container);
    } else {
         container.innerHTML = '<p>No hay datos disponibles para el gráfico por día de la semana.</p>';
    }
}

// Función para crear el gráfico de proyección (adaptado a uPlot)
function createProjectionChart(data) {
    console.log("Creating Projection Chart (uPlot)", data);
    const container = document.getElementById('projection-chart');
    if (!container) return;

    // Destruir gráfico existente si lo hay
    if (charts.projection) {
         charts.projection.destroy();
         container.innerHTML = ''; // Limpiar el div
    }

    // Adaptar datos de tickets_by_date y projection del backend para uPlot
     if (data && data.tickets_by_date && data.tickets_by_date.date && data.tickets_by_date.count && data.projection) {
        const dates = data.tickets_by_date.date.map(d => new Date(d).getTime() / 1000); // Timestamps históricos
        const counts = data.tickets_by_date.count;

        const futureDates = data.projection.dates.map(d => new Date(d).getTime() / 1000); // Timestamps futuros
        const projectionValues = data.projection.values;
        const upperLimits = data.projection.confidence.upper;
        const lowerLimits = data.projection.confidence.lower;

        // Combinar fechas históricas y futuras para el eje X
        const allDates = [...dates, ...futureDates];

        // Datos para las líneas de proyección (se extienden por todas las fechas)
        const avgLineData = allDates.map((dateTs) => {
             // Para fechas históricas y futuras, usar el valor de proyección correspondiente
             const futureIndex = futureDates.indexOf(dateTs);
             if (futureIndex !== -1) {
                  return projectionValues[futureIndex];
             } else {
                  // Para fechas históricas antes de la proyección, usar el último valor real como punto de partida
                  // o simplemente extender el promedio calculado para la proyección.
                  // Opción 1 (extender promedio): Calcular el promedio de los últimos 7 días reales y extenderlo.
                  const last7DaysCounts = counts.slice(-7);
                  const avg = last7DaysCounts.reduce((a, b) => a + b, 0) / last7DaysCounts.length;
                  return avg;
             }
        });

        const upperLineData = allDates.map((dateTs) => {
             const futureIndex = futureDates.indexOf(dateTs);
             if (futureIndex !== -1) {
                  return upperLimits[futureIndex];
             } else {
                  // Extender límite superior basado en el std de los últimos 7 días reales
                   const last7DaysCounts = counts.slice(-7);
                   const avg = last7DaysCounts.reduce((a, b) => a + b, 0) / last7DaysCounts.length;
                   const std = Math.sqrt(last7DaysCounts.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / last7DaysCounts.length);
                   return avg + std;
             }
        });

         const lowerLineData = allDates.map((dateTs) => {
             const futureIndex = futureDates.indexOf(dateTs);
             if (futureIndex !== -1) {
                  return lowerLimits[futureIndex];
             } else {
                   const last7DaysCounts = counts.slice(-7);
                   const avg = last7DaysCounts.reduce((a, b) => a + b, 0) / last7DaysCounts.length;
                   const std = Math.sqrt(last7DaysCounts.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / last7DaysCounts.length);
                   const lower = avg - std;
                   return lower < 0 ? 0 : lower; // Asegurar que no sea negativo
             }
         });

        // Datos para Tickets reales (solo hasta la última fecha histórica)
        const realTicketsData = allDates.map((dateTs) => { // Mapear sobre todas las fechas
             const historicalIndex = dates.indexOf(dateTs);
             if (historicalIndex !== -1) {
                  return counts[historicalIndex];
             } else {
                  return null; // Null para fechas futuras
             }
        });

        const opts = {
            ...commonUPlotOptions,
            title: "Proyección de Tickets",
             width: container.offsetWidth,
            height: 350,
            scales: {
                x: { time: true },
                y: { auto: true, min: 0 }, // Asegurar que el eje Y comience en 0
            },
            series: [
                {},
                { label: "Proyección", stroke: chartColors.success, width: 2, dash: [5, 5] },
                { label: "Límite superior", stroke: chartColors.warning, width: 1, dash: [2, 2] },
                { label: "Límite inferior", stroke: chartColors.danger, width: 1, dash: [2, 2] },
                { label: "Tickets reales", stroke: chartColors.primary, width: 2, fill: "rgba(13, 110, 253, 0.1)"},
            ],
             axes: [
                {   // x-axis
                    values: (u, ticks, space) => ticks.map(ts => uPlot.fmtDate(new Date(ts * 1000), "{MMM} {DD}")),
                },
                {   // y-axis
                     size: (u, values, space) => u.axisFontSize,
                }
            ],
             plugins: [tooltipPlugin(), zoomPlugin()]
        };

        // Los datos para uPlot deben ser un array de arrays: [[x-values], [series1-values], [series2-values], ...]
        // Asegurarse de que las series estén en el orden correcto para que 'Tickets reales' esté encima
        const plotData = [allDates, avgLineData, upperLineData, lowerLineData, realTicketsData];

        charts.projection = new uPlot(opts, plotData, container);

     } else {
         container.innerHTML = '<p>No hay datos disponibles para el gráfico de proyección.</p>';
    }
}

// Función para actualizar todos los gráficos
function updateCharts(data) {
    console.log("Updating charts with data:", data);
    // uPlot no tiene un método destroy directo en la instancia principal de la misma forma que Chart.js
    // Para "destruir" y recrear, a menudo se elimina el elemento DOM contenedor y se crea uno nuevo,
    // o se intenta actualizar la instancia existente si uPlot soporta esa funcionalidad de forma limpia.
    // La forma más segura y común es recrear el contenedor y el gráfico.

    // En este caso, como charts es un objeto con instancias de uPlot,
    // podemos intentar llamar al método .destroy() si existe o manejar la limpieza del DOM.
    // Según la documentación de uPlot, la instancia tiene un método `destroy()`.

     Object.keys(charts).forEach(key => {
        if (charts[key]) {
            try {
                 charts[key].destroy();
            } catch (e) {
                 console.error(`Error destroying chart ${key}:`, e);
            }
            charts[key] = null; // Limpiar la referencia
            // Opcional: si la destrucción no limpia el DOM, podrías querer limpiar el innerHTML del contenedor
            const container = document.getElementById(`${key}-chart`);
            if(container) container.innerHTML = '';
        }
     });

    createStatusChart(data);
    createPriorityChart(data);
    createTemporalChart(data);
    createHourlyChart(data);
    createWeekdayChart(data);
    createProjectionChart(data);
}

// URL del backend (configurable)
const BACKEND_URL = 'http://localhost:5000'; // Cambiar en producción

// Función para obtener tickets de Zendesk
async function fetchTicketsFromZendesk() {
    try {
        // Obtener tickets usando la API de Zendesk con la URL real
        const response = await client.request({
            url: 'https://pichincha1724690163.zendesk.com/api/v2/tickets.json',
            type: 'GET',
            contentType: 'application/json',
            headers: {
                'Accept': 'application/json',
                'Authorization': 'Basic ' + btoa('usuario@email.com:token') // Reemplazar con credenciales reales
            },
            data: {
                per_page: 100, // Número de tickets por página
                sort_by: 'created_at',
                sort_order: 'desc'
            }
        });

        // Transformar los datos al formato esperado por el backend
        const tickets = response.tickets.map(ticket => ({
            id: ticket.id,
            status: ticket.status,
            created_at: ticket.created_at,
            subject: ticket.subject,
            priority: ticket.priority || 'normal' // Valor por defecto si no hay prioridad
        }));

        // Si hay más páginas, obtenerlas también
        let nextPage = response.next_page;
        while (nextPage) {
            const nextResponse = await client.request({
                url: nextPage,
                type: 'GET',
                contentType: 'application/json',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': 'Basic ' + btoa('usuario@email.com:token')
                }
            });

            const nextTickets = nextResponse.tickets.map(ticket => ({
                id: ticket.id,
                status: ticket.status,
                created_at: ticket.created_at,
                subject: ticket.subject,
                priority: ticket.priority || 'normal'
            }));

            tickets.push(...nextTickets);
            nextPage = nextResponse.next_page;
        }

        return tickets;
    } catch (error) {
        console.error('Error al obtener tickets de Zendesk:', error);
        client.invoke('notify', 'Error al obtener tickets de Zendesk: ' + error.message, 'error');
        throw error;
    }
}

// Función para enviar datos al backend y obtener análisis
async function analyzeTickets(tickets) {
    try {
        const response = await fetch(`${BACKEND_URL}/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ tickets })
        });

        if (!response.ok) {
            throw new Error(`Error del backend: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error al analizar tickets:', error);
        throw error;
    }
}

// Función principal para obtener y analizar datos
async function fetchTicketDataAndAnalyze() {
    try {
        // Mostrar indicador de carga
        client.invoke('showLoading');

        // Obtener tickets de Zendesk
        const tickets = await fetchTicketsFromZendesk();

        // Enviar al backend para análisis
        const analysisResult = await analyzeTickets(tickets);

        // Actualizar la interfaz con los resultados
        updateMetrics(analysisResult);
        updateCharts(analysisResult);

        // Ocultar indicador de carga
        client.invoke('hideLoading');
    } catch (error) {
        console.error('Error en el proceso de análisis:', error);
        client.invoke('notify', 'Error al obtener o analizar los datos', 'error');
        client.invoke('hideLoading');
    }
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    // Cargar datos iniciales
    fetchTicketDataAndAnalyze();

    // Configurar actualización periódica (cada 5 minutos)
    setInterval(fetchTicketDataAndAnalyze, 5 * 60 * 1000);
}); 