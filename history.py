from flask import Flask, jsonify, request
import mysql.connector
from datetime import datetime, time
from flask_cors import CORS
import os
from dotenv import load_dotenv

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

# Ruta para obtener el historial de ubicaciones
@app.route('/location-history', methods=['POST'])
def get_location_history():
    request_data = request.get_json()
    start_date = request_data.get('start_date')
    end_date = request_data.get('end_date')
    start_time = request_data.get('start_time')
    end_time = request_data.get('end_time')
    address = request_data.get('address')

    connection = None
    cursor = None

    try:
        connection = mysql.connector.connect(**db_config)
        cursor = connection.cursor(dictionary=True)

        # Si se proporciona una dirección, buscar las coordenadas correspondientes
        if address:
            geocode_query = "SELECT latitud, longitud FROM direcciones WHERE direccion = %s LIMIT 1"
            cursor.execute(geocode_query, (address,))
            result = cursor.fetchone()

            if not result:
                return jsonify({"error": "No se encontraron coordenadas para la dirección especificada"}), 404

            latitud = result['latitud']
            longitud = result['longitud']

            # Si solo se proporciona la dirección, buscar las fechas y horas correspondientes
            if not start_date or not end_date or not start_time or not end_time:
                query = '''
                    SELECT DISTINCT fecha, hora
                    FROM ubicaciones
                    WHERE latitud = %s AND longitud = %s
                '''
                cursor.execute(query, (latitud, longitud))
                dates = cursor.fetchall()

                if dates:
                    for date in dates:
                        date['fecha'] = date['fecha'].strftime('%Y-%m-%d')
                        date['hora'] = date['hora'].strftime('%H:%M:%S')
                    return jsonify(dates), 200
                else:
                    return jsonify({"message": "No se encontraron trayectos para la dirección especificada"}), 404
            else:
                # Combina fecha y hora en un solo datetime
                start_datetime = datetime.strptime(f"{start_date} {start_time}", '%Y-%m-%d %H:%M')
                end_datetime = datetime.strptime(f"{end_date} {end_time}", '%Y-%m-%d %H:%M')

                # Validación: si la fecha de finalización es anterior a la fecha de inicio
                if end_datetime < start_datetime:
                    return jsonify({"error": "La fecha y hora de finalización no puede ser anterior a la fecha y hora de inicio"}), 400

                # Modificación de la consulta SQL para manejar fecha y hora por separado
                query = '''SELECT latitud, longitud, fecha, hora
                        FROM ubicaciones
                        WHERE (fecha > %s OR (fecha = %s AND hora >= %s)) AND
                            (fecha < %s OR (fecha = %s AND hora <= %s)) AND
                            latitud = %s AND longitud = %s'''
                cursor.execute(query, (start_datetime.date(), start_datetime.date(), start_datetime.time(),
                                    end_datetime.date(), end_datetime.date(), end_datetime.time(),
                                    latitud, longitud))

                locations = cursor.fetchall()

                for loc in locations:
                    loc['fecha'] = loc['fecha'].strftime('%Y-%m-%d')  # Formato de fecha
                    loc['hora'] = loc['hora'].strftime('%H:%M:%S')  # Formato de hora

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

# Ruta para obtener las fechas y horas basadas en una dirección
@app.route('/location-dates', methods=['POST'])
def get_location_dates():
    request_data = request.get_json()
    address = request_data.get('address')

    if not address:
        return jsonify({"error": "Debe proporcionar una dirección"}), 400

    connection = None
    cursor = None

    try:
        connection = mysql.connector.connect(**db_config)
        cursor = connection.cursor(dictionary=True)

        # Buscar las coordenadas de la dirección
        geocode_query = "SELECT latitud, longitud FROM direcciones WHERE direccion = %s LIMIT 1"
        cursor.execute(geocode_query, (address,))
        result = cursor.fetchone()

        if not result:
            return jsonify({"error": "No se encontraron coordenadas para la dirección especificada"}), 404

        latitud = result['latitud']
        longitud = result['longitud']

        # Buscar las fechas y horas donde pasó por la dirección
        query = '''
            SELECT DISTINCT fecha, hora
            FROM ubicaciones
            WHERE latitud = %s AND longitud = %s
        '''
        cursor.execute(query, (latitud, longitud))
        dates = cursor.fetchall()

        if dates:
            for date in dates:
                date['fecha'] = date['fecha'].strftime('%Y-%m-%d')
                date['hora'] = date['hora'].strftime('%H:%M:%S')
            return jsonify(dates), 200
        else:
            return jsonify({"message": "No se encontraron trayectos para la dirección especificada"}), 404
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
