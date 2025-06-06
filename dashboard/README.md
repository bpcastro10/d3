# Dashboard de Análisis de Tickets de Zendesk

Este proyecto proporciona un dashboard ligero y eficiente para analizar datos de tickets de Zendesk, utilizando el ZAF Client API y procesamiento de datos con Python.

## Características

- Visualización en tiempo real de datos de tickets
- Análisis estadístico de tickets
- Filtrado por rango de fechas
- Gráficos de tendencias y distribución
- Interfaz ligera y responsiva

## Requisitos

### Backend
- Python 3.8+
- FastAPI
- Polars
- Uvicorn

### Frontend
- Navegador web moderno
- Zendesk Support

## Instalación

1. Clonar el repositorio:
```bash
git clone [url-del-repositorio]
cd dashboard
```

2. Instalar dependencias de Python:
```bash
pip install -r requirements.txt
```

3. Configurar el backend:
```bash
cd backend
uvicorn main:app --reload
```

4. Empaquetar la aplicación Zendesk:
   - Comprimir los archivos en la carpeta `assets/` y `manifest.json`
   - Subir el paquete a Zendesk como una aplicación privada

## Estructura del Proyecto

```
dashboard/
├── backend/
│   └── main.py
├── assets/
│   ├── iframe.html
│   ├── app.js
│   └── styles.css
├── manifest.json
├── requirements.txt
└── README.md
```

## Uso

1. Instalar la aplicación en Zendesk Support
2. Acceder al dashboard desde la barra lateral de tickets
3. Seleccionar el rango de fechas deseado
4. Los gráficos y estadísticas se actualizarán automáticamente

## Desarrollo

### Backend
El backend está construido con FastAPI y utiliza Polars para el procesamiento eficiente de datos. Los endpoints principales son:

- `POST /analyze`: Analiza los datos de tickets y devuelve estadísticas

### Frontend
El frontend es una aplicación Zendesk que utiliza:
- ZAF Client API para obtener datos
- Chart.js para visualizaciones
- CSS moderno para el diseño

## Interacción con la API (usando curl)

Aquí se muestran ejemplos de cómo interactuar con la API utilizando `curl`. Nota: la autenticación basada en tokens no está implementada en la versión actual de estos endpoints públicos.

**Obtener información básica de la API:**
```bash
curl "http://localhost:8000/"
```

**Obtener datos de prueba:**
```bash
curl "http://localhost:8000/test-data"
```

**Enviar datos de tickets para análisis:**
Utiliza este endpoint para enviar un array de objetos ticket en formato JSON. La API procesará estos datos y devolverá las estadísticas.
```bash
curl -X POST "http://localhost:8000/analyze" \
     -H "Content-Type: application/json" \
     -d '[{"id": 1, "status": "open", "created_at": "2024-03-15T10:00:00Z", "subject": "Test", "priority": "high"}, {"id": 2, "status": "pending", "created_at": "2024-03-16T12:00:00Z", "subject": "Test 2", "priority": "medium"}]'
```

## Contribuir

1. Fork el repositorio
2. Crear una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir un Pull Request

## Licencia

Este proyecto está licenciado bajo la Licencia MIT - ver el archivo LICENSE para más detalles. 