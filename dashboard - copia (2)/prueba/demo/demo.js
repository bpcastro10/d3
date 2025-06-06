// Tooltip global
let globalTooltip = null;

// Para guardar los límites originales de zoom
let originalScales = new WeakMap();

// Configuración global de Chart.js
Chart.defaults.font.family = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
Chart.defaults.color = '#6c757d';
Chart.defaults.borderColor = '#dee2e6';

// Registrar plugins de zoom
Chart.register(ChartZoom);

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

// Configuración de los gráficos
let charts = {
    status: null,
    priority: null,
    temporal: null,
    hourly: null,
    weekday: null,
    projection: null
};

// Datos de ejemplo (simulados)
let mockData = {
    tickets: [],
    lastUpdate: new Date()
};

// Datos de prueba para el gráfico en tiempo real
function generateRealtimeData() {
    const now = new Date();
    const timestamps = [];
    const values = [];
    
    for (let i = 23; i >= 0; i--) {
        const date = new Date(now);
        date.setHours(date.getHours() - i);
        timestamps.push(date.getTime());
        // Generar valores aleatorios entre 5 y 20
        values.push(Math.floor(Math.random() * 15) + 5);
    }
    
    return [timestamps, values];
}

// Datos de prueba para la tendencia de tickets
function generateTrendData() {
    const timestamps = [];
    const values = [];
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-03-15');
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        timestamps.push(new Date(d).getTime());
        // Generar valores aleatorios entre 10 y 50
        values.push(Math.floor(Math.random() * 40) + 10);
    }
    
    return [timestamps, values];
}

// Datos de prueba para la distribución de prioridades
function generatePriorityData() {
    return [
        ['Alta', 'Media', 'Baja'],
        [45, 289, 900]
    ];
}

// Configuración común para los gráficos
const commonChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
        mode: 'index',
        intersect: false
    },
    plugins: {
        zoom: {
            pan: {
                enabled: true,
                mode: 'xy',
                modifierKey: 'ctrl'
            },
            zoom: {
                wheel: {
                    enabled: true,
                    modifierKey: 'ctrl'
                },
                pinch: {
                    enabled: true
                },
                mode: 'xy',
                drag: {
                    enabled: true,
                    backgroundColor: 'rgba(13, 110, 253, 0.1)',
                    borderColor: 'rgba(13, 110, 253, 0.3)',
                    borderWidth: 1
                },
                limits: {
                    x: {min: 'original', max: 'original', minRange: 1},
                    y: {min: 'original', max: 'original', minRange: 1}
                }
            },
            limits: {
                x: {min: 'original', max: 'original', minRange: 1},
                y: {min: 'original', max: 'original', minRange: 1}
            }
        },
        tooltip: {
            enabled: true,
            mode: 'index',
            intersect: false
        }
    }
};

// Plugin para tooltips (solo uno global)
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
                        const date = new Date(u.data[0][idx]);
                        const value = u.data[1][idx];
                        globalTooltip.innerHTML = `${date.toLocaleString()}<br>Valor: ${value}`;
                        globalTooltip.style.display = "block";
                        globalTooltip.style.left = (u.root.getBoundingClientRect().left + left + 10) + "px";
                        globalTooltip.style.top = (u.root.getBoundingClientRect().top + top - 30) + "px";
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

// Plugin para zoom con rueda y doble clic (reset)
function zoomPlugin() {
    return {
        hooks: {
            ready: [
                (u) => {
                    let zoomed = false;
                    let xMin, xMax, yMin, yMax;

                    u.over.addEventListener("wheel", (e) => {
                        e.preventDefault();
                        const { width, height } = u.bbox;
                        const { left, top } = u.cursor;

                        if (e.ctrlKey) {
                            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
                            
                            if (!zoomed) {
                                xMin = u.scales.x.min;
                                xMax = u.scales.x.max;
                                yMin = u.scales.y.min;
                                yMax = u.scales.y.max;
                                zoomed = true;
                            }

                            const xRange = xMax - xMin;
                            const yRange = yMax - yMin;
                            const xCenter = left / width * xRange + xMin;
                            const yCenter = top / height * yRange + yMin;

                            u.setScale("x", {
                                min: xCenter - (xCenter - xMin) * zoomFactor,
                                max: xCenter + (xMax - xCenter) * zoomFactor
                            });

                            u.setScale("y", {
                                min: yCenter - (yCenter - yMin) * zoomFactor,
                                max: yCenter + (yMax - yCenter) * zoomFactor
                            });
                        }
                    });

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

// Plugin para zoom in con selección de región (drag)
function dragZoomPlugin() {
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
                    let dragging = false;
                    let dragStart = null;
                    let dragRect = null;

                    u.over.addEventListener('mousedown', (e) => {
                        if (e.button !== 0) return; // solo click izquierdo
                        dragging = true;
                        dragStart = { x: e.offsetX, y: e.offsetY };
                        if (!dragRect) {
                            dragRect = document.createElement('div');
                            dragRect.style.position = 'absolute';
                            dragRect.style.border = '2px dashed #03363d';
                            dragRect.style.background = 'rgba(3,54,61,0.08)';
                            dragRect.style.pointerEvents = 'none';
                            dragRect.style.zIndex = 200;
                            u.root.appendChild(dragRect);
                        }
                    });

                    u.over.addEventListener('mousemove', (e) => {
                        if (!dragging || !dragRect) return;
                        const x1 = Math.min(dragStart.x, e.offsetX);
                        const x2 = Math.max(dragStart.x, e.offsetX);
                        const y1 = Math.min(dragStart.y, e.offsetY);
                        const y2 = Math.max(dragStart.y, e.offsetY);
                        dragRect.style.left = x1 + 'px';
                        dragRect.style.top = y1 + 'px';
                        dragRect.style.width = (x2 - x1) + 'px';
                        dragRect.style.height = (y2 - y1) + 'px';
                        dragRect.style.display = 'block';
                    });

                    window.addEventListener('mouseup', (e) => {
                        if (!dragging || !dragRect) return;
                        dragging = false;
                        dragRect.style.display = 'none';
                        const x1 = Math.min(dragStart.x, e.offsetX);
                        const x2 = Math.max(dragStart.x, e.offsetX);
                        const y1 = Math.min(dragStart.y, e.offsetY);
                        const y2 = Math.max(dragStart.y, e.offsetY);
                        // Convertir a escalas
                        const leftVal = u.posToVal(x1, 'x');
                        const rightVal = u.posToVal(x2, 'x');
                        const topVal = u.posToVal(y1, 'y');
                        const botVal = u.posToVal(y2, 'y');
                        if (Math.abs(x2 - x1) > 10 && Math.abs(y2 - y1) > 10) {
                            u.setScale('x', { min: leftVal, max: rightVal });
                            u.setScale('y', { min: botVal, max: topVal });
                        }
                    });
                }
            ]
        }
    };
}

// Inicializar gráficos
function initCharts() {
    // Gráfico en tiempo real
    const realtimeOpts = {
        ...commonChartOptions,
        title: "Tickets por Hora",
        width: document.getElementById('realtimeTrend').offsetWidth,
    };
    new uPlot(realtimeOpts, generateRealtimeData(), document.getElementById('realtimeTrend'));

    // Gráfico de tendencia
    const trendOpts = {
        ...commonChartOptions,
        title: "Tickets por Día",
        width: document.getElementById('ticketTrend').offsetWidth,
    };
    new uPlot(trendOpts, generateTrendData(), document.getElementById('ticketTrend'));

    // Gráfico de prioridades
    const priorityOpts = {
        ...commonChartOptions,
        title: "Distribución por Prioridad",
        width: document.getElementById('priorityDistribution').offsetWidth,
        scales: {
            x: { auto: true },
            y: { auto: true }
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
            dragZoomPlugin(),
            zoomPlugin()
        ]
    };
    new uPlot(priorityOpts, generatePriorityData(), document.getElementById('priorityDistribution'));
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initCharts);

// Función para generar datos de ejemplo
function generateMockData() {
    const statuses = ['open', 'pending', 'solved', 'closed'];
    const priorities = ['low', 'medium', 'high', 'urgent'];
    const now = new Date();
    
    // Generar 100 tickets aleatorios
    for (let i = 0; i < 100; i++) {
        const created_at = new Date(now - Math.random() * 30 * 24 * 60 * 60 * 1000);
        mockData.tickets.push({
            id: i + 1,
            status: statuses[Math.floor(Math.random() * statuses.length)],
            created_at: created_at.toISOString(),
            subject: `Ticket #${i + 1}`,
            priority: priorities[Math.floor(Math.random() * priorities.length)]
        });
    }
    
    // Mantener solo los últimos 100 tickets
    if (mockData.tickets.length > 100) {
        mockData.tickets = mockData.tickets.slice(-100);
    }
}

// Función para actualizar las métricas principales
function updateMetrics(data) {
    const total = data.tickets.length;
    const today = new Date().toISOString().split('T')[0];
    const todayTickets = data.tickets.filter(t => t.created_at.startsWith(today)).length;
    const pending = data.tickets.filter(t => t.status === 'pending').length;
    const solved = data.tickets.filter(t => t.status === 'solved' || t.status === 'closed').length;
    const resolutionRate = total > 0 ? Math.round((solved / total) * 100) : 0;

    document.getElementById('total-tickets').textContent = total;
    document.getElementById('tickets-hoy').textContent = todayTickets;
    document.getElementById('tickets-pendientes').textContent = pending;
    document.getElementById('tasa-resolucion').textContent = `${resolutionRate}%`;
}

// Función para crear el gráfico de distribución por estado
function createStatusChart(data) {
    const ctx = document.getElementById('status-chart').getContext('2d');
    const statusCounts = data.tickets.reduce((acc, ticket) => {
        acc[ticket.status] = (acc[ticket.status] || 0) + 1;
        return acc;
    }, {});

    if (charts.status) {
        charts.status.destroy();
    }

    charts.status = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(statusCounts),
            datasets: [{
                data: Object.values(statusCounts),
                backgroundColor: [
                    chartColors.primary,
                    chartColors.warning,
                    chartColors.success,
                    chartColors.secondary
                ]
            }]
        },
        options: {
            ...commonChartOptions,
            plugins: {
                ...commonChartOptions.plugins,
                zoom: {
                    ...commonChartOptions.plugins.zoom,
                    enabled: false
                }
            }
        }
    });
}

// Función para crear el gráfico de distribución por prioridad
function createPriorityChart(data) {
    const ctx = document.getElementById('priority-chart').getContext('2d');
    const priorityCounts = data.tickets.reduce((acc, ticket) => {
        acc[ticket.priority] = (acc[ticket.priority] || 0) + 1;
        return acc;
    }, {});

    if (charts.priority) {
        charts.priority.destroy();
    }

    charts.priority = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(priorityCounts),
            datasets: [{
                data: Object.values(priorityCounts),
                backgroundColor: [
                    chartColors.success,
                    chartColors.info,
                    chartColors.warning,
                    chartColors.danger
                ]
            }]
        },
        options: {
            ...commonChartOptions,
            plugins: {
                ...commonChartOptions.plugins,
                zoom: {
                    ...commonChartOptions.plugins.zoom,
                    enabled: false
                }
            }
        }
    });
}

// Función para crear el gráfico temporal
function createTemporalChart(data) {
    const ctx = document.getElementById('temporal-chart').getContext('2d');
    const dates = [...new Set(data.tickets.map(t => t.created_at.split('T')[0]))].sort();
    const counts = dates.map(date => 
        data.tickets.filter(t => t.created_at.startsWith(date)).length
    );

    if (charts.temporal) {
        charts.temporal.destroy();
    }

    charts.temporal = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Tickets por día',
                data: counts,
                borderColor: chartColors.primary,
                backgroundColor: 'rgba(13, 110, 253, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            ...commonChartOptions,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day'
                    }
                },
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Función para crear el gráfico por hora
function createHourlyChart(data) {
    const ctx = document.getElementById('hourly-chart').getContext('2d');
    const hourlyCounts = data.tickets.reduce((acc, ticket) => {
        const hour = new Date(ticket.created_at).getHours();
        acc[hour] = (acc[hour] || 0) + 1;
        return acc;
    }, {});

    const hours = Array.from({length: 24}, (_, i) => i);
    const counts = hours.map(hour => hourlyCounts[hour] || 0);

    if (charts.hourly) {
        charts.hourly.destroy();
    }

    charts.hourly = new Chart(ctx, {
        type: 'line',
        data: {
            labels: hours.map(h => `${h}:00`),
            datasets: [{
                label: 'Tickets por hora',
                data: counts,
                borderColor: chartColors.info,
                backgroundColor: 'rgba(13, 202, 240, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            ...commonChartOptions,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Función para crear el gráfico por día de la semana
function createWeekdayChart(data) {
    const ctx = document.getElementById('weekday-chart').getContext('2d');
    const weekdays = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const weekdayCounts = data.tickets.reduce((acc, ticket) => {
        const weekday = new Date(ticket.created_at).getDay();
        acc[weekday] = (acc[weekday] || 0) + 1;
        return acc;
    }, {});

    const counts = weekdays.map((_, i) => weekdayCounts[i] || 0);

    if (charts.weekday) {
        charts.weekday.destroy();
    }

    charts.weekday = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: weekdays,
            datasets: [{
                label: 'Tickets por día de la semana',
                data: counts,
                backgroundColor: chartColors.warning,
                borderColor: chartColors.warning,
                borderWidth: 1
            }]
        },
        options: {
            ...commonChartOptions,
            plugins: {
                ...commonChartOptions.plugins,
                zoom: {
                    ...commonChartOptions.plugins.zoom,
                    enabled: false
                }
            }
        }
    });
}

// Función para crear el gráfico de proyección
function createProjectionChart(data) {
    const ctx = document.getElementById('projection-chart').getContext('2d');
    const dates = [...new Set(data.tickets.map(t => t.created_at.split('T')[0]))].sort();
    const counts = dates.map(date => 
        data.tickets.filter(t => t.created_at.startsWith(date)).length
    );

    // Calcular proyección simple (usando el promedio y std de los últimos 7 días reales)
    const last7DaysCounts = counts.slice(-7);
    const avg = last7DaysCounts.reduce((a, b) => a + b, 0) / last7DaysCounts.length;
    const std = Math.sqrt(last7DaysCounts.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / last7DaysCounts.length);

    const futureDates = Array.from({length: 7}, (_, i) => {
        const date = new Date(dates[dates.length - 1]);
        date.setDate(date.getDate() + i + 1);
        return date.toISOString().split('T')[0];
    });

    const allDates = [...dates, ...futureDates];
    const avgLineData = allDates.map(() => avg);
    const upperLineData = allDates.map(() => avg + std);
    const lowerLineData = allDates.map(() => avg - std < 0 ? 0 : avg - std); // Asegurar que el límite inferior no sea negativo

    if (charts.projection) {
        charts.projection.destroy();
    }

    charts.projection = new Chart(ctx, {
        type: 'line',
        data: {
            labels: allDates,
            datasets: [
                {
                    label: 'Proyección',
                    data: avgLineData,
                    borderColor: chartColors.success,
                    backgroundColor: 'rgba(25, 135, 84, 0.1)',
                    fill: false,
                    borderDash: [5, 5]
                },
                {
                    label: 'Límite superior',
                    data: upperLineData,
                    borderColor: chartColors.warning,
                    backgroundColor: 'rgba(255, 193, 7, 0.1)',
                    fill: false,
                    borderDash: [2, 2]
                },
                {
                    label: 'Límite inferior',
                    data: lowerLineData,
                    borderColor: chartColors.danger,
                    backgroundColor: 'rgba(220, 53, 69, 0.1)',
                    fill: false,
                    borderDash: [2, 2]
                },
                {
                    label: 'Tickets reales',
                    data: [...counts, ...Array(futureDates.length).fill(null)],
                    borderColor: chartColors.primary,
                    backgroundColor: 'rgba(13, 110, 253, 0.1)',
                    fill: false,
                    tension: 0.4
                }
            ]
        },
        options: {
            ...commonChartOptions,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day'
                    }
                },
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Función para actualizar todos los gráficos
function updateCharts(data) {
    createStatusChart(data);
    createPriorityChart(data);
    createTemporalChart(data);
    createHourlyChart(data);
    createWeekdayChart(data);
    createProjectionChart(data);
}

// Función para simular actualizaciones en tiempo real
function simulateRealTimeUpdates() {
    setInterval(() => {
        // Agregar un nuevo ticket aleatorio
        const statuses = ['open', 'pending', 'solved', 'closed'];
        const priorities = ['low', 'medium', 'high', 'urgent'];
        const newTicket = {
            id: mockData.tickets.length + 1,
            status: statuses[Math.floor(Math.random() * statuses.length)],
            created_at: new Date().toISOString(),
            subject: `Ticket #${mockData.tickets.length + 1}`,
            priority: priorities[Math.floor(Math.random() * priorities.length)]
        };
        
        mockData.tickets.push(newTicket);
        mockData.lastUpdate = new Date();
        
        // Mantener solo los últimos 100 tickets
        if (mockData.tickets.length > 100) {
            mockData.tickets = mockData.tickets.slice(-100);
        }
        
        // Actualizar la interfaz
        updateMetrics(mockData);
        updateCharts(mockData);
    }, 50000); // Actualizar cada 5 segundos
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    generateMockData();
    updateMetrics(mockData);
    updateCharts(mockData);
    simulateRealTimeUpdates();
}); 