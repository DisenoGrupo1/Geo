from flask import Flask, jsonify, request
import mysql.connector
from datetime import datetime, time
from flask_cors import CORS
import os
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Configuración de la base de datos
db_config = {
    'host': os.getenv('DB_HOST'),
    'user': os.getenv('DB_USER'),
    'password': os.getenv('DB_PASSWORD'),
    'database': os.getenv('DB_NAME')
}

# Ruta para obtener el historial de ubicaciones o búsqueda por ubicación
@app.route('/location-search', methods=['POST'])
def location_search():
    request_data = request.get_json()
    
    # Comprobar si se recibió dirección (latitud y longitud)
    latitud = request_data.get('latitud')
    longitud = request_data.get('longitud')
    
    # Comprobar si se recibió fecha y hora
    start_date = request_data.get('start_date')
    end_date = request_data.get('end_date')
    start_time = request_data.get('start_time')
    end_time = request_data.get('end_time')
    
    connection = None
    cursor = None

    try:
        connection = mysql.connector.connect(**db_config)
        cursor = connection.cursor(dictionary=True)

        if latitud and longitud and not (start_date and end_date and start_time and end_time):
            # Caso 1: Solo latitud y longitud, sin fechas ni horas
            query = '''SELECT latitud, longitud, fecha, hora
                       FROM ubicaciones
                       WHERE ABS(latitud - %s) < 0.01 AND ABS(longitud - %s) < 0.01'''
            cursor.execute(query, (latitud, longitud))
            locations = cursor.fetchall()

            if locations:
                # Enviar las fechas y horas en el formato (dd,mm,aaaa - hh,mm,am/pm)
                for loc in locations:
                    loc['fecha'] = loc['fecha'].strftime('%d,%m,%Y')
                    loc['hora'] = loc['hora'].strftime('%I:%M %p')
                return jsonify(locations), 200
            else:
                return jsonify({"message": "No se encontraron ubicaciones para la dirección especificada."}), 404

        elif start_date and end_date and start_time and end_time:
            # Caso 2: Fechas y horas proporcionadas (con o sin dirección)
            start_datetime = datetime.strptime(f"{start_date} {start_time}", '%Y-%m-%d %H:%M')
            end_datetime = datetime.strptime(f"{end_date} {end_time}", '%Y-%m-%d %H:%M')

            # Validación: si la fecha de finalización es anterior a la fecha de inicio
            if end_datetime < start_datetime:
                return jsonify({"error": "La fecha y hora de finalización no puede ser anterior a la fecha y hora de inicio"}), 400

            if latitud and longitud:
                # Caso 3: Búsqueda por latitud, longitud y rango de fechas/horas
                query = '''SELECT latitud, longitud, fecha, hora
                           FROM ubicaciones
                           WHERE (fecha > %s OR (fecha = %s AND hora >= %s)) AND
                                 (fecha < %s OR (fecha = %s AND hora <= %s)) AND
                                 ABS(latitud - %s) < 0.01 AND ABS(longitud - %s) < 0.01'''
                cursor.execute(query, (start_datetime.date(), start_datetime.date(), start_datetime.time(),
                                       end_datetime.date(), end_datetime.date(), end_datetime.time(),
                                       latitud, longitud))
            else:
                # Caso 4: Solo búsqueda por rango de fechas/horas (sin dirección)
                query = '''SELECT latitud, longitud, fecha, hora
                           FROM ubicaciones
                           WHERE (fecha > %s OR (fecha = %s AND hora >= %s)) AND
                                 (fecha < %s OR (fecha = %s AND hora <= %s))'''
                cursor.execute(query, (start_datetime.date(), start_datetime.date(), start_datetime.time(),
                                       end_datetime.date(), end_datetime.date(), end_datetime.time()))

            locations = cursor.fetchall()

            if locations:
                for loc in locations:
                    loc['fecha'] = loc['fecha'].strftime('%Y-%m-%d')  # Formato de fecha
                    loc['hora'] = loc['hora'].strftime('%H:%M:%S')     # Formato de hora
                return jsonify(locations), 200
            else:
                return jsonify({"message": "No se encontraron ubicaciones para el rango especificado"}), 404
        else:
            return jsonify({"error": "Por favor, proporcione una dirección (latitud y longitud) o un rango de fechas y horas"}), 400

    except mysql.connector.Error as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=60000)
