from flask import Flask, jsonify, request
import mysql.connector
from datetime import datetime, time
from flask_cors import CORS
import os  # Importa el módulo s

app = Flask(__name__)
CORS(app, resources={r"/location-history": {"origins": "*"}})

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
    start_date = request_data['start_date']
    end_date = request_data['end_date']
    start_time = request_data['start_time']
    end_time = request_data['end_time']

    # Inicializa las variables para evitar errores en el bloque 'finally'
    connection = None
    cursor = None

    try:
        # Combina fecha y hora en un solo datetime
        start_datetime = datetime.strptime(f"{start_date} {start_time}", '%Y-%m-%d %H:%M')
        end_datetime = datetime.strptime(f"{end_date} {end_time}", '%Y-%m-%d %H:%M')

        # Validación: si la fecha de finalización es anterior a la fecha de inicio
        if end_datetime < start_datetime:
            return jsonify({"error": "La fecha y hora de finalización no puede ser anterior a la fecha y hora de inicio."}), 400

        connection = mysql.connector.connect(**db_config)
        cursor = connection.cursor(dictionary=True)

        # Modificación de la consulta SQL para manejar fecha y hora por separado
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
            loc['fecha'] = loc['fecha'].strftime('%Y-%m-%d')  # Formato de fecha

            # Verifica si 'hora' es un objeto datetime.time
            if isinstance(loc['hora'], time):
                loc['hora'] = loc['hora'].strftime('%H:%M:%S')  # Formato de hora
            else:
                loc['hora'] = str(loc['hora'])  # Maneja el caso de timedelta, si es necesario

        if locations:
            return jsonify(locations), 200
        else:
            return jsonify({"message": "No se encontraron ubicaciones para el rango especificado"}), 404
    except mysql.connector.Error as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        # Verifica que el cursor y la conexión existan antes de cerrarlos
        if cursor:
            cursor.close()
        if connection:
            connection.close()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=60000)
