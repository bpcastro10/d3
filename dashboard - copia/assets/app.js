const client = ZAFClient.init();
let ticketTrendPlot = null;
let priorityDistributionPlot = null;
let realtimePlot = null;

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

// Plugin para tooltips
function tooltipPlugin() {
    return {
        hooks: {
            setCursor: [
                (u) => {
                    const { left, top } = u.cursor;
                    const tooltip = document.createElement("div");
                    tooltip.className = "uplot-tooltip";
                    tooltip.style.position = "absolute";
                    tooltip.style.left = left + "px";
                    tooltip.style.top = top + "px";
                    tooltip.style.background = "white";
                    tooltip.style.padding = "8px";
                    tooltip.style.border = "1px solid #d8dcde";
                    tooltip.style.borderRadius = "4px";
                    tooltip.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
                    tooltip.style.pointerEvents = "none";
                    tooltip.style.zIndex = "100";
                    
                    const idx = u.cursor.idx;
                    if (idx !== null) {
                        const date = new Date(u.data[0][idx]);
                        const value = u.data[1][idx];
                        tooltip.innerHTML = `${date.toLocaleTimeString()}<br>Tickets: ${value}`;
                    }
                    
                    document.body.appendChild(tooltip);
                    return () => tooltip.remove();
                }
            ]
        }
    };
}

// Plugin para zoom
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
                        if (zoomed) {
                            u.setScale("x", { min: xMin, max: xMax });
                            u.setScale("y", { min: yMin, max: yMax });
                            zoomed = false;
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

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', init); 