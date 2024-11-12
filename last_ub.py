from flask import Flask, jsonify
import mysql.connector
from datetime import datetime
from flask_cors import CORS
import os
from dotenv import load_dotenv

#Cargar variables de entorno
load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/last_location": {"origins": "*"}})


db_config = {
    'host': os.getenv('DB_HOST'),
    'user': os.getenv('DB_USER'),
    'password': os.getenv('DB_PASSWORD'),
    'database': os.getenv('DB_NAME')
}

@app.route('/last_location', methods=['GET'])
def get_last_location():
    try:
        connection = mysql.connector.connect(**db_config)
        cursor = connection.cursor(dictionary=True)

        # Selecciona la última ubicación de cada carro identificada por `client_id`
        cursor.execute('''
            SELECT client_id, latitud, longitud, fecha, hora, alias
            FROM ubicaciones
            WHERE (client_id, fecha, hora) IN (
                SELECT client_id, MAX(fecha), MAX(hora)
                FROM ubicaciones
                GROUP BY client_id
            )
        ''')

        last_locations = cursor.fetchall()
        for location in last_locations:
            location['fecha'] = location['fecha'].strftime('%Y-%m-%d')
            location['hora'] = location['hora'].strftime('%H:%M:%S') if isinstance(location['hora'], datetime) else str(location['hora'])
        
        return jsonify(last_locations), 200
    except mysql.connector.Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        connection.close()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=50000)  # Ejecuta el servidor en el puerto 50000