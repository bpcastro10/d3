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

// Colores para los gráficos (compatibles con el tema de Zendesk)
const chartColors = {
    primary: '#03363d',    // Color principal de Zendesk
    secondary: '#68737d',  // Gris de Zendesk
    success: '#2f3941',    // Verde oscuro de Zendesk
    info: '#0d6efd',      // Azul de Zendesk
    warning: '#ffc107',    // Amarillo de Zendesk
    danger: '#dc3545',     // Rojo de Zendesk
    light: '#f8f9fa',      // Gris claro
    dark: '#2f3941'        // Gris oscuro de Zendesk
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

// Configuración común para uPlot
const commonUPlotOptions = {
    responsive: true,
    plugins: [],
    zoom: {
        interactive: true,
        wheel: true,
        pinch: true,
        drag: {
            setScale: true,
            x: true,
            y: true,
        },
    },
    pan: {
        interactive: true,
    },
};

// Plugin para tooltips
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
                        let tooltipContent = '';
                        if (u.series && u.data && u.data[0] && u.data[0][idx] !== undefined) {
                            if (u.scales.x.time) {
                                tooltipContent += `Fecha/Hora: ${uPlot.fmtDate(new Date(u.data[0][idx] * 1000), "{YYYY}-{MM}-{DD} {H}:{mm}")}<br>`;
                            } else {
                                const label = u.axes[0].values[u.data[0][idx]];
                                tooltipContent += `Categoría: ${label}<br>`;
                            }

                            for(let i = 1; i < u.series.length; i++) {
                                if (u.series[i].label && u.data[i] && u.data[i][idx] !== undefined && u.data[i][idx] !== null) {
                                    tooltipContent += `${u.series[i].label}: ${u.data[i][idx]}<br>`;
                                }
                            }
                        }

                        if (tooltipContent) {
                            globalTooltip.innerHTML = tooltipContent;
                            globalTooltip.style.display = "block";
                            const chartRect = u.root.getBoundingClientRect();
                            globalTooltip.style.left = (chartRect.left + left + window.scrollX + 10) + "px";
                            globalTooltip.style.top = (chartRect.top + top + window.scrollY - 30) + "px";
                        } else {
                            globalTooltip.style.display = "none";
                        }
                    } else {
                        globalTooltip.style.display = "none";
                    }
                }
            ],
            setSeries: [
                () => { if (globalTooltip) globalTooltip.style.display = "none"; }
            ],
            setScale: [
                () => { if (globalTooltip) globalTooltip.style.display = "none"; }
            ],
            ready: [
                (u) => { u.root.addEventListener('mouseleave', () => { if (globalTooltip) globalTooltip.style.display = "none"; }); }
            ]
        }
    };
}

// Plugin para reset de zoom
function zoomResetPlugin() {
    return {
        hooks: {
            ready: [
                (u) => {
                    if (!originalScales.has(u)) {
                        originalScales.set(u, {
                            xMin: u.scales.x.min,
                            xMax: u.scales.x.max,
                            yMin: u.scales.y.min,
                            yMax: u.scales.y.max
                        });
                    }
                    u.over.addEventListener("dblclick", () => {
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
    try {
        const tickets = await fetchZendeskTickets();
        const analysis = analyzeTickets(tickets);
        updateMetrics(analysis);
        updateCharts(analysis);
    } catch (error) {
        console.error('Error al actualizar el dashboard:', error);
        document.querySelector('.container-fluid').innerHTML = `
            <div class="alert alert-danger" role="alert">
                Error al cargar los datos. Por favor, intente nuevamente más tarde.
            </div>
        `;
    }
}

// Obtener tickets de Zendesk usando la API REST
async function fetchZendeskTickets() {
    try {
        // Obtener tickets usando la API REST de Zendesk a través de ZAF
        const response = await client.request({
            url: '/api/v2/tickets.json',
            type: 'GET',
            contentType: 'application/json',
            headers: {
                'Accept': 'application/json'
            }
        });

        return response.tickets.map(ticket => ({
            id: ticket.id,
            status: ticket.status,
            created_at: ticket.created_at,
            subject: ticket.subject,
            priority: ticket.priority || 'normal'
        }));
    } catch (error) {
        console.error('Error al obtener tickets de Zendesk:', error);
        throw error;
    }
}

// Analizar tickets
function analyzeTickets(tickets) {
    try {
        // Convertir fechas a objetos Date
        const ticketsWithDates = tickets.map(ticket => ({
            ...ticket,
            created_at: new Date(ticket.created_at)
        }));

        // Análisis básico
        const analysis = {
            total_tickets: ticketsWithDates.length,
            status_distribution: {
                status: [],
                count: []
            },
            priority_distribution: {
                priority: [],
                count: []
            },
            tickets_by_date: {
                date: [],
                count: []
            }
        };

        // Distribución por estado
        const statusCounts = {};
        ticketsWithDates.forEach(ticket => {
            statusCounts[ticket.status] = (statusCounts[ticket.status] || 0) + 1;
        });
        analysis.status_distribution.status = Object.keys(statusCounts);
        analysis.status_distribution.count = Object.values(statusCounts);

        // Distribución por prioridad
        const priorityCounts = {};
        ticketsWithDates.forEach(ticket => {
            priorityCounts[ticket.priority] = (priorityCounts[ticket.priority] || 0) + 1;
        });
        analysis.priority_distribution.priority = Object.keys(priorityCounts);
        analysis.priority_distribution.count = Object.values(priorityCounts);

        // Distribución por fecha
        const dateCounts = {};
        ticketsWithDates.forEach(ticket => {
            const date = ticket.created_at.toISOString().split('T')[0];
            dateCounts[date] = (dateCounts[date] || 0) + 1;
        });
        const sortedDates = Object.keys(dateCounts).sort();
        analysis.tickets_by_date.date = sortedDates;
        analysis.tickets_by_date.count = sortedDates.map(date => dateCounts[date]);

        // Análisis por hora
        const hourlyCounts = Array(24).fill(0);
        ticketsWithDates.forEach(ticket => {
            const hour = ticket.created_at.getHours();
            hourlyCounts[hour]++;
        });
        analysis.hourly_distribution = {
            hours: Array.from({length: 24}, (_, i) => i),
            counts: hourlyCounts
        };

        // Análisis por día de la semana
        const weekdayCounts = Array(7).fill(0);
        ticketsWithDates.forEach(ticket => {
            const weekday = ticket.created_at.getDay();
            weekdayCounts[weekday]++;
        });
        analysis.weekday_distribution = {
            weekdays: Array.from({length: 7}, (_, i) => i),
            counts: weekdayCounts
        };

        // Proyección (simplificada para el frontend)
        if (analysis.tickets_by_date.count.length > 7) {
            const last7Days = analysis.tickets_by_date.count.slice(-7);
            const avg = last7Days.reduce((a, b) => a + b, 0) / 7;
            const std = Math.sqrt(last7Days.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / 6);

            const lastDate = new Date(sortedDates[sortedDates.length - 1]);
            const futureDates = Array.from({length: 7}, (_, i) => {
                const date = new Date(lastDate);
                date.setDate(date.getDate() + i + 1);
                return date.toISOString().split('T')[0];
            });

            analysis.projection = {
                dates: futureDates,
                values: Array(7).fill(avg),
                confidence: {
                    upper: Array(7).fill(avg + std),
                    lower: Array(7).fill(Math.max(0, avg - std))
                }
            };
        }

        return analysis;
    } catch (error) {
        console.error('Error al analizar tickets:', error);
        throw error;
    }
}

// Función para actualizar las métricas
function updateMetrics(data) {
    if (data) {
        document.getElementById('total-tickets').textContent = data.total_tickets || '0';
        
        if (data.tickets_by_date && data.tickets_by_date.date && data.tickets_by_date.count) {
            const today = new Date().toISOString().split('T')[0];
            const todayIndex = data.tickets_by_date.date.indexOf(today);
            const ticketsToday = todayIndex !== -1 ? data.tickets_by_date.count[todayIndex] : 0;
            document.getElementById('tickets-hoy').textContent = ticketsToday;
        }

        // Calcular tickets pendientes y tasa de resolución
        const pendingTickets = data.status_distribution.count[data.status_distribution.status.indexOf('pending')] || 0;
        document.getElementById('tickets-pendientes').textContent = pendingTickets;
        
        const solvedTickets = data.status_distribution.count[data.status_distribution.status.indexOf('solved')] || 0;
        const resolutionRate = data.total_tickets > 0 ? Math.round((solvedTickets / data.total_tickets) * 100) : 0;
        document.getElementById('tasa-resolucion').textContent = `${resolutionRate}%`;
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

// Inicialización de la aplicación ZAF
client.on('app.activated', () => {
    console.log('Zendesk app activated');
    updateDashboard();
    // Actualizar cada 5 minutos (ajustar según límites de la API de Zendesk)
    setInterval(updateDashboard, 5 * 60 * 1000);
});

// Consideraciones adicionales para ZAF:
// - Manejo de errores más robusto.
// - Considerar límites de tasa de la API de Zendesk si se hacen muchas llamadas directas.
// - Seguridad: asegurar que las llamadas al backend sean seguras en producción.
// - Posible uso de Setting API para URLs de backend u otras configuraciones.
// - Internacionalización si es necesario.

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', init); 