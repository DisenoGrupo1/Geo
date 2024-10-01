from flask import Flask, jsonify, request
import mysql.connector
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# Configuración de la base de datos
db_config = {
    'host': os.getenv('DB_HOST'),
    'user': os.getenv('DB_USER'),
    'password': os.getenv('DB_PASSWORD'),
    'database': os.getenv('DB_NAME')
}


# Ruta para obtener el historial de ubicaciones basado en fechas y horas
@app.route('/location-history', methods=['POST'])
def get_location_history():
    request_data = request.get_json()
    start_date = request_data['start_date']
    end_date = request_data['end_date']
    start_time = request_data['start_time']
    end_time = request_data['end_time']
    address = request_data['address']
     # Combina fecha y hora en un solo datetime
    start_datetime = datetime.strptime(f"{start_date} {start_time}", '%Y-%m-%d %H:%M')
    end_datetime = datetime.strptime(f"{end_date} {end_time}", '%Y-%m-%d %H:%M')

    # Validación: si la fecha de finalización es anterior a la fecha de inicio
    if end_datetime < start_datetime:
        return jsonify({"error": "La fecha y hora de finalización no puede ser anterior a la fecha y hora de inicio"}),>

    connection = None
    cursor = None

    try:
        connection = mysql.connector.connect(**db_config)
        cursor = connection.cursor(dictionary=True)


        query = '''SELECT latitud, longitud, fecha

                   FROM ubicaciones
                   WHERE direccion = %s AND
                         (fecha > %s OR (fecha = %s AND hora >= %s)) AND
                         (fecha < %s OR (fecha = %s AND hora <= %s))'''
        cursor.execute(query, (address, start_datetime.date(), start_datetime.date(), start_datetime.time(),
                               end_datetime.date(), end_datetime.date(), end_datetime.time()))

        locations = cursor.fetchall()

        for loc in locations:
            loc['fecha'] = loc['fecha'].strftime('%Y-%m-%d')  # Formato de fecha

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

if __name__ == '__main__':

    app.run(host='0.0.0.0', port=60000)

