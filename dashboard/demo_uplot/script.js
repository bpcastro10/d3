// Objeto para almacenar instancias de uPlot
let charts = {
    status: null,
    priority: null,
    temporal: null,
    hourly: null,
    weekday: null,
    projection: null
};

// Colores para los gráficos
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

// Configuración común básica para uPlot
const commonUPlotOptions = {
    responsive: true,
    plugins: [], // Plugins se añadirán individualmente donde sea necesario
     // Opciones de zoom y pan nativas de uPlot para la demo
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

// Tooltip global para la demo
let globalTooltip = null;

// Plugin para tooltips (adaptado de assets/app.js)
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
                             } else { // Para gráficos categóricos
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
                             globalTooltip.style.left = (chartRect.left + left + window.scrollX + 10) + "px"; // Ajustar por scroll
                             globalTooltip.style.top = (chartRect.top + top + window.scrollY - 30) + "px"; // Ajustar por scroll
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

// Para guardar los límites originales de zoom (para doble clic)
let originalScales = new WeakMap();

// Plugin para doble clic (reset zoom) - Adaptado de assets/app.js
function zoomResetPlugin() {
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

// --- Simulación de datos (adaptado de demo/demo.js y estructura del backend) ---
function generateSimulatedData() {
    const statuses = ['open', 'pending', 'solved', 'closed'];
    const priorities = ['low', 'medium', 'high', 'urgent'];
    const now = new Date();
    const numTickets = 500; // Generar más tickets para mejor visualización
    const tickets = [];

    for (let i = 0; i < numTickets; i++) {
        // Distribuir tickets en los últimos 30 días, con más actividad reciente
        const daysAgo = Math.floor(Math.random() * 30 * Math.random()); // Más probabilidad en días recientes
        const created_at = new Date(now);
        created_at.setDate(now.getDate() - daysAgo);
        created_at.setHours(Math.floor(Math.random() * 24));
        created_at.setMinutes(Math.floor(Math.random() * 60));
        created_at.setSeconds(Math.floor(Math.random() * 60));

        tickets.push({
            id: i + 1,
            status: statuses[Math.floor(Math.random() * statuses.length)],
            created_at: created_at.toISOString(),
            subject: `Ticket #${i + 1} (Simulado)`,
            priority: priorities[Math.floor(Math.random() * priorities.length)]
        });
    }

    // Simular la estructura de respuesta del endpoint /analyze del backend
    const analysisResult = {
        total_tickets: tickets.length,
        status_distribution: { status: [], count: [] },
        priority_distribution: { priority: [], count: [] },
        tickets_by_date: { date: [], count: [] },
        hourly_distribution: { hours: [], counts: [] },
        weekday_distribution: { weekdays: [], counts: [] },
        projection: null // Calcularemos la proyección después de obtener tickets_by_date
    };

    // Calcular distribuciones
    const statusCounts = tickets.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {});
    analysisResult.status_distribution.status = Object.keys(statusCounts);
    analysisResult.status_distribution.count = Object.values(statusCounts);

    const priorityCounts = tickets.reduce((acc, t) => { acc[t.priority] = (acc[t.priority] || 0) + 1; return acc; }, {});
    analysisResult.priority_distribution.priority = Object.keys(priorityCounts);
    analysisResult.priority_distribution.count = Object.values(priorityCounts);

    const ticketsByDateCounts = tickets.reduce((acc, t) => { const date = t.created_at.split('T')[0]; acc[date] = (acc[date] || 0) + 1; return acc; }, {});
    const sortedDates = Object.keys(ticketsByDateCounts).sort();
    analysisResult.tickets_by_date.date = sortedDates;
    analysisResult.tickets_by_date.count = sortedDates.map(date => ticketsByDateCounts[date]);

    const hourlyCounts = tickets.reduce((acc, t) => { const hour = new Date(t.created_at).getHours(); acc[hour] = (acc[hour] || 0) + 1; return acc; }, {});
    const sortedHours = Array.from({length: 24}, (_, i) => i); // Asegurar todas las horas de 0 a 23
     analysisResult.hourly_distribution.hours = sortedHours;
     analysisResult.hourly_distribution.counts = sortedHours.map(hour => hourlyCounts[hour] || 0);

    const weekdayCounts = tickets.reduce((acc, t) => { const weekday = new Date(t.created_at).getDay(); acc[weekday] = (acc[weekday] || 0) + 1; return acc; }, {});
    const sortedWeekdays = Array.from({length: 7}, (_, i) => i); // Asegurar todos los días de 0 a 6 (Domingo a Sábado)
     analysisResult.weekday_distribution.weekdays = sortedWeekdays;
     analysisResult.weekday_distribution.counts = sortedWeekdays.map(day => weekdayCounts[day] || 0);

    // Calcular proyección (simple, basado en el promedio de los últimos 7 días simulados)
     const last7DaysCounts = analysisResult.tickets_by_date.count.slice(-7);
     if (last7DaysCounts.length > 0) {
          const avg = last7DaysCounts.reduce((a, b) => a + b, 0) / last7DaysCounts.length;
          // Simular un std deviation simple, o usar 0 si solo hay 1 punto
          const std = last7DaysCounts.length > 1 ? Math.sqrt(last7DaysCounts.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / (last7DaysCounts.length - 1)) : 0;

          const futureDates = Array.from({length: 7}, (_, i) => {
              const date = new Date(sortedDates[sortedDates.length - 1]);
              date.setDate(date.getDate() + i + 1);
              return date.toISOString().split('T')[0];
          });

          analysisResult.projection = {
              dates: futureDates,
              values: futureDates.map(() => avg), // Proyección simple como el promedio
              confidence: {
                  upper: futureDates.map(() => avg + std), // Límite superior basado en avg + std
                  lower: futureDates.map(() => Math.max(0, avg - std)) // Límite inferior basado en avg - std (mínimo 0)
              }
          };
     }

    return analysisResult;
}

// --- Funciones de actualización y creación de gráficos (adaptadas de assets/app.js) ---

// Función para actualizar las métricas principales
function updateMetrics(data) {
    console.log("Updating metrics with data:", data);
    if (data) {
        document.getElementById('total-tickets').textContent = data.total_tickets !== undefined ? data.total_tickets : 'N/A';

         if (data.tickets_by_date && data.tickets_by_date.date && data.tickets_by_date.count) {
              // Calcular tickets hoy desde los datos simulados
               const today = new Date().toISOString().split('T')[0];
              let ticketsToday = 0;
              const todayIndex = data.tickets_by_date.date.findIndex(d => d === today);
              if (todayIndex !== -1) {
                  ticketsToday = data.tickets_by_date.count[todayIndex];
              }
               document.getElementById('tickets-hoy').textContent = ticketsToday;
         }

         // Para tickets pendientes y tasa de resolución, simular datos o dejar placeholders
          document.getElementById('tickets-pendientes').textContent = Math.floor(data.total_tickets * 0.15); // Ejemplo simulado
          const solved = data.total_tickets - parseInt(document.getElementById('tickets-pendientes').textContent);
          const resolutionRate = data.total_tickets > 0 ? Math.round((solved / data.total_tickets) * 100) : 0;
          document.getElementById('tasa-resolucion').textContent = `${resolutionRate}%`;
    }
}

// Función para crear el gráfico de distribución por estado (barras uPlot)
function createStatusChart(data) {
    console.log("Creating Status Chart (uPlot)", data);
    const container = document.getElementById('status-chart');
    if (!container) return;

    if (charts.status) { charts.status.destroy(); container.innerHTML = ''; }

    if (data && data.status_distribution && data.status_distribution.status && data.status_distribution.count) {
        const labels = data.status_distribution.status;
        const counts = data.status_distribution.count;
        const xValues = Array.from(labels.keys());
        const yValues = counts;

        const opts = {
            ...commonUPlotOptions,
            title: "Distribución por Estado",
            width: container.offsetWidth,
            height: 350,
            scales: { x: { }, y: { auto: true, min: 0 } },
            series: [ {}, { label: "Cantidad", stroke: chartColors.primary, fill: "rgba(13, 110, 253, 0.2)", paths: uPlot.paths.bars({ size: [0.6, 0.1] }), points: { show: false } }, ],
            axes: [ { values: labels, side: 2 }, { size: (u, values, space) => u.axisFontSize } ],
            plugins: [tooltipPlugin()]
        };

        const plotData = [xValues, yValues];
        charts.status = new uPlot(opts, plotData, container);
    } else { container.innerHTML = '<p>No hay datos disponibles para el gráfico de estado.</p>'; }
}

// Función para crear el gráfico de distribución por prioridad (barras uPlot)
function createPriorityChart(data) {
    console.log("Creating Priority Chart (uPlot)", data);
    const container = document.getElementById('priority-chart');
    if (!container) return;

    if (charts.priority) { charts.priority.destroy(); container.innerHTML = ''; }

    if (data && data.priority_distribution && data.priority_distribution.priority && data.priority_distribution.count) {
        const labels = data.priority_distribution.priority;
        const counts = data.priority_distribution.count;
        const xValues = Array.from(labels.keys());
        const yValues = counts;

        const opts = {
            ...commonUPlotOptions,
            title: "Distribución por Prioridad",
            width: container.offsetWidth,
            height: 350,
            scales: { x: { }, y: { auto: true, min: 0 } },
            series: [ {}, { label: "Cantidad", stroke: chartColors.info, fill: "rgba(13, 202, 240, 0.2)", paths: uPlot.paths.bars({ size: [0.6, 0.1] }), points: { show: false } }, ],
            axes: [ { values: labels, side: 2 }, { size: (u, values, space) => u.axisFontSize } ],
            plugins: [tooltipPlugin()]
        };

        const plotData = [xValues, yValues];
        charts.priority = new uPlot(opts, plotData, container);
    } else { container.innerHTML = '<p>No hay datos disponibles para el gráfico de prioridad.</p>'; }
}

// Función para crear el gráfico temporal (Tickets por Día - uPlot)
function createTemporalChart(data) {
    console.log("Creating Temporal Chart (uPlot)", data);
    const container = document.getElementById('temporal-chart');
    if (!container) return;

    if (charts.temporal) { charts.temporal.destroy(); container.innerHTML = ''; }

    if (data && data.tickets_by_date && data.tickets_by_date.date && data.tickets_by_date.count) {
        const dates = data.tickets_by_date.date.map(d => new Date(d).getTime() / 1000); // uPlot usa timestamps en segundos
        const counts = data.tickets_by_date.count;

        const opts = {
            ...commonUPlotOptions,
            title: "Tickets por Día",
            width: container.offsetWidth,
            height: 350,
            scales: { x: { time: true }, y: { auto: true, min: 0 } },
            series: [ {}, { label: "Tickets por día", stroke: chartColors.primary, width: 2, fill: "rgba(13, 110, 253, 0.1)" }, ],
            axes: [ { values: (u, ticks, space) => ticks.map(ts => uPlot.fmtDate(new Date(ts * 1000), "{MMM} {DD}")) }, { size: (u, values, space) => u.axisFontSize } ],
            plugins: [tooltipPlugin(), zoomResetPlugin()]
        };

        charts.temporal = new uPlot(opts, [dates, counts], container);
    } else { container.innerHTML = '<p>No hay datos disponibles para el gráfico temporal.</p>'; }
}

// Función para crear el gráfico por hora (uPlot)
function createHourlyChart(data) {
    console.log("Creating Hourly Chart (uPlot)", data);
    const container = document.getElementById('hourly-chart');
    if (!container) return;

    if (charts.hourly) { charts.hourly.destroy(); container.innerHTML = ''; }

    if (data && data.hourly_distribution && data.hourly_distribution.hours && data.hourly_distribution.counts) {
        const hours = data.hourly_distribution.hours;
        const counts = data.hourly_distribution.counts;

        const opts = {
            ...commonUPlotOptions,
            title: "Distribución por Hora",
            width: container.offsetWidth,
            height: 350,
            scales: { x: { }, y: { auto: true, min: 0 } },
            series: [ {}, { label: "Tickets por hora", stroke: chartColors.info, width: 2, fill: "rgba(13, 202, 240, 0.1)" }, ],
            axes: [ { values: hours, label: "Hora del día (0-23)" }, { size: (u, values, space) => u.axisFontSize } ],
            plugins: [tooltipPlugin(), zoomResetPlugin()]
        };

        charts.hourly = new uPlot(opts, [hours, counts], container);
    } else { container.innerHTML = '<p>No hay datos disponibles para el gráfico por hora.</p>'; }
}

// Función para crear el gráfico por día de la semana (barras uPlot)
function createWeekdayChart(data) {
    console.log("Creating Weekday Chart (uPlot)", data);
    const container = document.getElementById('weekday-chart');
    if (!container) return;

    if (charts.weekday) { charts.weekday.destroy(); container.innerHTML = ''; }

    if (data && data.weekday_distribution && data.weekday_distribution.weekdays && data.weekday_distribution.counts) {
        const weekdays = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const rawWeekdays = data.weekday_distribution.weekdays;
        const counts = data.weekday_distribution.counts;

        const sortedData = rawWeekdays.map((day, index) => ({ day: day, count: counts[index] })).sort((a, b) => a.day - b.day);
        const sortedWeekdaysLabels = sortedData.map(item => weekdays[item.day]);
        const sortedCounts = sortedData.map(item => item.count);

        const opts = {
            ...commonUPlotOptions,
            title: "Distribución por Día de la Semana",
            width: container.offsetWidth,
            height: 350,
            scales: { x: { }, y: { auto: true, min: 0 } },
            series: [ {}, { label: "Tickets por día", stroke: chartColors.warning, fill: "rgba(255, 193, 7, 0.2)", paths: uPlot.paths.bars({ size: [0.6, 0.1] }), points: { show: false } }, ],
            axes: [ { values: sortedWeekdaysLabels, side: 2 }, { size: (u, values, space) => u.axisFontSize } ],
             plugins: [tooltipPlugin()]
        };

        const plotData = [Array.from(sortedData.keys()), sortedCounts];
        charts.weekday = new uPlot(opts, plotData, container);
    } else { container.innerHTML = '<p>No hay datos disponibles para el gráfico por día de la semana.</p>'; }
}

// Función para crear el gráfico de proyección (uPlot)
function createProjectionChart(data) {
    console.log("Creating Projection Chart (uPlot)", data);
    const container = document.getElementById('projection-chart');
    if (!container) return;

    if (charts.projection) { charts.projection.destroy(); container.innerHTML = ''; }

    if (data && data.tickets_by_date && data.tickets_by_date.date && data.tickets_by_date.count && data.projection) {
        const dates = data.tickets_by_date.date.map(d => new Date(d).getTime() / 1000);
        const counts = data.tickets_by_date.count;
        const futureDates = data.projection.dates.map(d => new Date(d).getTime() / 1000);
        const projectionValues = data.projection.values;
        const upperLimits = data.projection.confidence.upper;
        const lowerLimits = data.projection.confidence.lower;

        const allDates = [...dates, ...futureDates];

        // Datos para las líneas de proyección (extendidas)
        const avgLineData = allDates.map((dateTs) => { const futureIndex = futureDates.indexOf(dateTs); if (futureIndex !== -1) return projectionValues[futureIndex]; const last7DaysCounts = counts.slice(-7); const avg = last7DaysCounts.reduce((a, b) => a + b, 0) / last7DaysCounts.length; return avg; });
        const upperLineData = allDates.map((dateTs) => { const futureIndex = futureDates.indexOf(dateTs); if (futureIndex !== -1) return upperLimits[futureIndex]; const last7DaysCounts = counts.slice(-7); const avg = last7DaysCounts.reduce((a, b) => a + b, 0) / last7DaysCounts.length; const std = last7DaysCounts.length > 1 ? Math.sqrt(last7DaysCounts.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / (last7DaysCounts.length - 1)) : 0; return avg + std; });
         const lowerLineData = allDates.map((dateTs) => { const futureIndex = futureDates.indexOf(dateTs); if (futureIndex !== -1) return lowerLimits[futureIndex]; const last7DaysCounts = counts.slice(-7); const avg = last7DaysCounts.reduce((a, b) => a + b, 0) / last7DaysCounts.length; const std = last7DaysCounts.length > 1 ? Math.sqrt(last7DaysCounts.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / (last7DaysCounts.length - 1)) : 0; const lower = avg - std; return lower < 0 ? 0 : lower; });

        // Datos para Tickets reales (hasta la última fecha histórica)
        const realTicketsData = allDates.map((dateTs) => { const historicalIndex = dates.indexOf(dateTs); if (historicalIndex !== -1) return counts[historicalIndex]; return null; });

        const opts = {
            ...commonUPlotOptions,
            title: "Proyección de Tickets",
            width: container.offsetWidth,
            height: 350,
            scales: { x: { time: true }, y: { auto: true, min: 0 } },
            series: [ {}, { label: "Proyección", stroke: chartColors.success, width: 2, dash: [5, 5] }, { label: "Límite superior", stroke: chartColors.warning, width: 1, dash: [2, 2] }, { label: "Límite inferior", stroke: chartColors.danger, width: 1, dash: [2, 2] }, { label: "Tickets reales", stroke: chartColors.primary, width: 2, fill: "rgba(13, 110, 253, 0.1)" }, ],
            axes: [ { values: (u, ticks, space) => ticks.map(ts => uPlot.fmtDate(new Date(ts * 1000), "{MMM} {DD}")) }, { size: (u, values, space) => u.axisFontSize } ],
            plugins: [tooltipPlugin(), zoomResetPlugin()]
        };

        const plotData = [allDates, avgLineData, upperLineData, lowerLineData, realTicketsData];
        charts.projection = new uPlot(opts, plotData, container);

    } else { container.innerHTML = '<p>No hay datos disponibles para el gráfico de proyección.</p>'; }
}

// Función para actualizar todos los gráficos
function updateCharts(data) {
    console.log("Updating charts with data:", data);
    Object.keys(charts).forEach(key => {
        if (charts[key]) {
            try { charts[key].destroy(); } catch (e) { console.error(`Error destroying chart ${key}:`, e); }
            charts[key] = null;
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

// Inicialización de la demo
document.addEventListener('DOMContentLoaded', () => {
    console.log('Demo DOM loaded');
    const simulatedData = generateSimulatedData();
    updateMetrics(simulatedData);
    updateCharts(simulatedData);
}); 