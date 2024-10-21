from flask import Flask, jsonify, request
import mysql.connector
from datetime import datetime, timedelta, time
from flask_cors import CORS
import os
from dotenv import load_dotenv

app = Flask(__name__)
CORS(app)
load_dotenv()

# Configuración de la base de datos usando variables de entorno
db_config = {
    'host': os.getenv('DB_HOST'),
    'user': os.getenv('DB_USER'),
    'password': os.getenv('DB_PASSWORD'),
    'database': os.getenv('DB_NAME')
}

@app.route('/location-history', methods=['POST'])
def get_location_history():
    request_data = request.get_json()
    start_datetime_str = request_data['start']  # Formato: "YYYY-MM-DD HH:MM"
    end_datetime_str = request_data['end']  # Formato: "YYYY-MM-DD HH:MM"

    connection = None
    cursor = None

    try:
        # Convertir cadenas a datetime
        start_datetime = datetime.strptime(start_datetime_str, '%Y-%m-%dT%H:%M')
        end_datetime = datetime.strptime(end_datetime_str, '%Y-%m-%dT%H:%M')

        # Validación de fechas
        if end_datetime < start_datetime:
            return jsonify({"error": "La fecha y hora de finalización no puede ser anterior a la fecha y hora de inicio."}), 400

        connection = mysql.connector.connect(**db_config)
        cursor = connection.cursor(dictionary=True)

        query = '''SELECT latitud, longitud, fecha, hora
                   FROM ubicaciones
                   WHERE (fecha > %s OR (fecha = %s AND hora >= %s)) AND
                         (fecha < %s OR (fecha = %s AND hora <= %s))'''
        
        cursor.execute(query, (
            start_datetime.date(), start_datetime.date(), start_datetime.time(),
            end_datetime.date(), end_datetime.date(), end_datetime.time()
        ))

        locations = cursor.fetchall()

        for loc in locations:
            # Formato de fecha
            loc['fecha'] = loc['fecha'].strftime('%Y-%m-%d')  
            
            # Verifica si loc['hora'] es un objeto de tipo 'time', 'str' o 'timedelta'
            if isinstance(loc['hora'], str):  # Si es una cadena, conviértelo a un objeto time
                loc['hora'] = datetime.strptime(loc['hora'], '%H:%M:%S').time()
            elif isinstance(loc['hora'], timedelta):  # Si es un timedelta, maneja el caso
                # Convertir timedelta a segundos y luego a tiempo
                total_seconds = int(loc['hora'].total_seconds())
                loc['hora'] = (datetime(1, 1, 1) + timedelta(seconds=total_seconds)).time()
            
            # Asegúrate de que loc['hora'] sea de tipo time antes de formatear
            if isinstance(loc['hora'], time):
                loc['hora'] = loc['hora'].strftime('%H:%M:%S')  # Formato de hora

        if locations:
            return jsonify(locations), 200
        else:
            return jsonify({"message": "No se encontraron ubicaciones para el rango especificado"}), 404
    except mysql.connector.Error as e:
        print(f"Error de la base de datos: {str(e)}")
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        print(f"Error inesperado: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=60000, debug=True)
