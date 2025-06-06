from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import polars as pl
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Any
from pydantic import BaseModel
from sklearn.linear_model import LinearRegression

app = FastAPI(
    title="Dashboard API",
    description="API para el dashboard de análisis de tickets",
    version="1.0.0"
)

# Configurar CORS para permitir solicitudes desde Zendesk
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción, especificar el dominio de Zendesk
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TicketData(BaseModel):
    id: int
    status: str
    created_at: str
    subject: str
    priority: str

# Datos de ejemplo para pruebas
MOCK_TICKETS = [
    {
        "id": 1,
        "status": "open",
        "created_at": "2024-03-15T10:00:00Z",
        "subject": "Problema con el sistema",
        "priority": "high"
    },
    {
        "id": 2,
        "status": "pending",
        "created_at": "2024-03-15T11:30:00Z",
        "subject": "Solicitud de soporte",
        "priority": "medium"
    }
]

@app.get("/")
async def root():
    """Endpoint raíz que devuelve información básica de la API"""
    return {
        "message": "Bienvenido a la API del Dashboard",
        "endpoints": {
            "/docs": "Documentación Swagger",
            "/test-data": "Obtener datos de prueba",
            "/analyze": "Analizar tickets (POST)"
        }
    }

@app.get("/test-data")
async def get_test_data():
    """Endpoint para obtener datos de prueba"""
    return MOCK_TICKETS

@app.post("/analyze")
async def analyze_tickets(tickets: List[TicketData]):
    """
    Analiza los tickets y devuelve estadísticas.
    
    Ejemplo de uso con curl:
    ```bash
    curl -X POST "http://localhost:8000/analyze" \
         -H "Content-Type: application/json" \
         -d '[{"id": 1, "status": "open", "created_at": "2024-03-15T10:00:00Z", "subject": "Test", "priority": "high"}]'
    ```
    """
    try:
        # Convertir los datos a un DataFrame de Polars
        df = pl.DataFrame([ticket.dict() for ticket in tickets])
        
        # Convertir created_at a datetime
        df = df.with_columns(pl.col("created_at").str.strptime(pl.Datetime, "%Y-%m-%dT%H:%M:%SZ"))
        
        # Análisis básico
        analysis = {
            "total_tickets": len(df),
            "status_distribution": df.groupby("status").count().to_dict(as_series=False),
            "priority_distribution": df.groupby("priority").count().to_dict(as_series=False),
            "tickets_by_date": df.groupby(pl.col("created_at").dt.date()).count().to_dict(as_series=False),
        }
        
        # Análisis temporal
        dates = df["created_at"].dt.date().unique().sort()
        counts = df.groupby(pl.col("created_at").dt.date()).count()["count"]
        
        # Estadísticas diarias
        daily_stats = {
            "mean": float(counts.mean()),
            "std": float(counts.std()),
            "min": float(counts.min()),
            "max": float(counts.max()),
            "median": float(counts.median()),
            "q1": float(counts.quantile(0.25)),
            "q3": float(counts.quantile(0.75))
        }
        analysis["daily_statistics"] = daily_stats
        
        # Análisis por hora
        hourly_counts = df.groupby(pl.col("created_at").dt.hour()).count()["count"]
        analysis["hourly_distribution"] = {
            "hours": hourly_counts.index.tolist(),
            "counts": hourly_counts.values.tolist(),
            "statistics": {
                "mean": float(hourly_counts.mean()),
                "std": float(hourly_counts.std()),
                "min": float(hourly_counts.min()),
                "max": float(hourly_counts.max())
            }
        }
        
        # Análisis por día de la semana
        df = df.with_columns(pl.col("created_at").dt.weekday().alias("weekday"))
        weekday_counts = df.groupby("weekday").count()["count"]
        analysis["weekday_distribution"] = {
            "weekdays": weekday_counts.index.tolist(),
            "counts": weekday_counts.values.tolist(),
            "statistics": {
                "mean": float(weekday_counts.mean()),
                "std": float(weekday_counts.std()),
                "min": float(weekday_counts.min()),
                "max": float(weekday_counts.max())
            }
        }
        
        # Proyección usando regresión lineal
        if len(counts) > 7:
            X = np.array(range(len(counts))).reshape(-1, 1)
            y = counts.values
            model = LinearRegression()
            model.fit(X, y)
            
            # Proyectar 7 días más
            future_X = np.array(range(len(counts), len(counts) + 7)).reshape(-1, 1)
            future_y = model.predict(future_X)
            
            projection = {
                "dates": [(dates[-1] + timedelta(days=i+1)).isoformat() for i in range(7)],
                "values": future_y.tolist(),
                "confidence": {
                    "upper": (future_y + daily_stats["std"]).tolist(),
                    "lower": (future_y - daily_stats["std"]).tolist()
                }
            }
            analysis["projection"] = projection
        
        return analysis
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 