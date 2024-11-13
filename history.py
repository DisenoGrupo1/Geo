from flask import Flask, jsonify, request
import mysql.connector
from datetime import datetime, timedelta, time
from flask_cors import CORS
import os
from dotenv import load_dotenv

app = Flask(__name__)
CORS(app, resources={r"/location-history": {"origins": "*"}, r"/get-aliases": {"origins": "*"}})
load_dotenv()

db_config = {
    'host': os.getenv('DB_HOST'),
    'user': os.getenv('DB_USER'),
    'password': os.getenv('DB_PASSWORD'),
    'database': os.getenv('DB_NAME')
}

@app.route('/location-history', methods=['POST'])
def get_location_history():
    request_data = request.get_json()
    start_datetime_str = request_data['start']
    end_datetime_str = request_data['end']
    alias = request_data.get('alias', None)  # Alias puede ser None si es "todos"

    connection = None
    cursor = None

    try:
        start_datetime = datetime.strptime(start_datetime_str, '%Y-%m-%dT%H:%M')
        end_datetime = datetime.strptime(end_datetime_str, '%Y-%m-%dT%H:%M')

        if end_datetime < start_datetime:
            return jsonify({"error": "La fecha y hora de finalización no puede ser anterior a la fecha y hora de inicio."}), 400

        connection = mysql.connector.connect(**db_config)
        cursor = connection.cursor(dictionary=True)

        # Construir la consulta SQL
        if alias:
            query = '''SELECT latitud, longitud, fecha, hora, velocidad, rpm, combustible, alias
                       FROM ubicaciones
                       WHERE (fecha > %s OR (fecha = %s AND hora >= %s)) AND
                             (fecha < %s OR (fecha = %s AND hora <= %s)) AND
                             alias = %s'''
            cursor.execute(query, (
                start_datetime.date(), start_datetime.date(), start_datetime.time(),
                end_datetime.date(), end_datetime.date(), end_datetime.time(),
                alias
            ))
        else:
            # Si alias es None, no filtramos por alias
            query = '''SELECT latitud, longitud, fecha, hora, velocidad, rpm, combustible, alias
                       FROM ubicaciones
                       WHERE (fecha > %s OR (fecha = %s AND hora >= %s)) AND
                             (fecha < %s OR (fecha = %s AND hora <= %s))'''
            cursor.execute(query, (
                start_datetime.date(), start_datetime.date(), start_datetime.time(),
                end_datetime.date(), end_datetime.date(), end_datetime.time()
            ))

        locations = cursor.fetchall()

        for loc in locations:
            loc['fecha'] = loc['fecha'].strftime('%Y-%m-%d')
            if isinstance(loc['hora'], str):
                loc['hora'] = datetime.strptime(loc['hora'], '%H:%M:%S').time()
            elif isinstance(loc['hora'], timedelta):
                total_seconds = int(loc['hora'].total_seconds())
                loc['hora'] = (datetime(1, 1, 1) + timedelta(seconds=total_seconds)).time()
            if isinstance(loc['hora'], time):
                loc['hora'] = loc['hora'].strftime('%H:%M:%S')

        if locations:
            return jsonify(locations), 200
        else:
            return jsonify({"message": "No se encontraron ubicaciones para el rango especificado"}), 404
    except mysql.connector.Error as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

@app.route('/get-aliases', methods=['GET'])
def get_aliases():
    connection = None
    cursor = None
    try:
        connection = mysql.connector.connect(**db_config)
        cursor = connection.cursor(dictionary=True)
        
        cursor.execute("SELECT DISTINCT alias FROM aliases")
        aliases = cursor.fetchall()
        
        return jsonify([alias['alias'] for alias in aliases]), 200
    except mysql.connector.Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=60000, debug=True)
