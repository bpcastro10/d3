from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import json

app = Flask(__name__)
CORS(app)  # Habilitar CORS para todas las rutas

@app.route('/')
def home():
    return jsonify({"status": "ok", "message": "API de análisis de tickets funcionando"})

@app.route('/analyze', methods=['POST'])
def analyze_tickets():
    try:
        # Obtener datos de tickets del request
        tickets_data = request.json.get('tickets', [])
        
        if not tickets_data:
            return jsonify({"error": "No se proporcionaron datos de tickets"}), 400

        # Convertir a DataFrame
        df = pd.DataFrame(tickets_data)
        
        # Convertir created_at a datetime
        df['created_at'] = pd.to_datetime(df['created_at'])
        
        # Análisis de distribución por estado
        status_dist = df['status'].value_counts()
        status_distribution = {
            'status': status_dist.index.tolist(),
            'count': status_dist.values.tolist()
        }
        
        # Análisis de distribución por prioridad
        priority_dist = df['priority'].value_counts()
        priority_distribution = {
            'priority': priority_dist.index.tolist(),
            'count': priority_dist.values.tolist()
        }
        
        # Análisis temporal
        df['date'] = df['created_at'].dt.date
        tickets_by_date = df.groupby('date').size()
        temporal_analysis = {
            'date': [str(date) for date in tickets_by_date.index],
            'count': tickets_by_date.values.tolist()
        }
        
        # Análisis por hora
        df['hour'] = df['created_at'].dt.hour
        hourly_dist = df.groupby('hour').size()
        hourly_distribution = {
            'hours': hourly_dist.index.tolist(),
            'counts': hourly_dist.values.tolist()
        }
        
        # Análisis por día de la semana
        df['weekday'] = df['created_at'].dt.dayofweek
        weekday_dist = df.groupby('weekday').size()
        weekday_distribution = {
            'weekdays': weekday_dist.index.tolist(),
            'counts': weekday_dist.values.tolist()
        }
        
        # Proyección (usando los últimos 7 días)
        last_7_days = df[df['created_at'] >= (datetime.now() - timedelta(days=7))]
        daily_counts = last_7_days.groupby(last_7_days['created_at'].dt.date).size()
        
        if len(daily_counts) > 0:
            avg_tickets = daily_counts.mean()
            std_tickets = daily_counts.std()
            
            # Generar fechas futuras para la proyección
            last_date = max(daily_counts.index)
            future_dates = [last_date + timedelta(days=i+1) for i in range(7)]
            
            projection = {
                'dates': [str(date) for date in future_dates],
                'values': [avg_tickets] * 7,
                'confidence': {
                    'upper': [avg_tickets + std_tickets] * 7,
                    'lower': [max(0, avg_tickets - std_tickets)] * 7
                }
            }
        else:
            projection = None
        
        # Preparar respuesta
        analysis_result = {
            'total_tickets': len(df),
            'status_distribution': status_distribution,
            'priority_distribution': priority_distribution,
            'tickets_by_date': temporal_analysis,
            'hourly_distribution': hourly_distribution,
            'weekday_distribution': weekday_distribution,
            'projection': projection
        }
        
        return jsonify(analysis_result)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True) 