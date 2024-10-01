from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Esto habilita CORS para todas las rutas

@app.route('/dates-at-location', methods=['POST'])
def get_dates_at_location():
    data = request.get_json()
    address = data.get('address', '')
    # Aquí iría la lógica para convertir la dirección a latitud y longitud y buscar en la base de datos
    # Por ahora, simplemente devolveremos un ejemplo de respuesta
    return jsonify({
        "message": "Datos recibidos",
        "address": address,
        "dates": ["2024-10-01 10:00", "2024-10-02 12:00"]  # Ejemplo de fechas
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=50005)
