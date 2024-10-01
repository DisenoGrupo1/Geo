from flask import Flask, request, jsonify
from datetime import datetime
import sqlite3  # o cualquier otra librería que estés utilizando para tu base de datos

app = Flask(__name__)

@app.route('/location-history', methods=['POST'])
def get_location_history():
    data = request.get_json()
    start_date = data['start_date']
    end_date = data['end_date']
    start_time = data['start_time']
    end_time = data['end_time']
    address = data['address']
    
    start_datetime = f"{start_date} {start_time}"
    end_datetime = f"{end_date} {end_time}"
    
    # Aquí conectas a tu base de datos y realizas la consulta
    conn = sqlite3.connect('your_database.db')
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT latitud, longitud, fecha
        FROM historial_ubicaciones
        WHERE direccion = ? AND fecha BETWEEN ? AND ?
    """, (address, start_datetime, end_datetime))
    
    results = cursor.fetchall()
    
    # Cierra la conexión a la base de datos
    conn.close()

    # Convierte los resultados a un formato adecuado
    locations = [{'latitud': lat, 'longitud': lon, 'fecha': fecha} for lat, lon, fecha in results]
    
    return jsonify(locations)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=60000)