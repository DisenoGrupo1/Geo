import asyncio
import socket
import hashlib
import uuid
from mysql.connector import pooling
from datetime import datetime
import re
import json
import os
import time
from dotenv import load_dotenv
from websocket_server import WebsocketServer

# Cargar variables de entorno
load_dotenv()

# Variables globales
client_ids = {}
clients = []
location_cache = []
processed_messages = set()
save_lock = asyncio.Lock()
tcp_socket_timeout = 20
NOTIFICATION_THRESHOLD = 5  # Enviar notificaciones cada 5 segundos como máximo
last_notification_time = time.time()
global server  # Definimos server globalmente para que sea accesible

# Crear un pool de conexiones a la base de datos
connection_pool = pooling.MySQLConnectionPool(
    pool_name="mypool",
    pool_size=10,
    host=os.getenv('DB_HOST'),
    user=os.getenv('DB_USER'),
    password=os.getenv('DB_PASSWORD'),
    database=os.getenv('DB_NAME')
)

def generate_client_id():
    """Genera un ID único para el cliente usando UUID."""
    return str(uuid.uuid4())

async def handle_tcp_connection():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as tcp_socket:
        tcp_socket.settimeout(tcp_socket_timeout)
        tcp_socket.bind(("", 16000))
        tcp_socket.listen(5)
        print("Servidor TCP escuchando en el puerto 16000")

        while True:
            try:
                conn, addr = await asyncio.to_thread(tcp_socket.accept)
                print(f"Conexión establecida con {addr}")

                client_id = client_ids.get(addr[0]) or generate_client_id()
                client_ids[addr[0]] = client_id
                
                conn.sendall(f"ID:{client_id}".encode())
                
                asyncio.create_task(handle_client(conn, client_id))
            except socket.timeout:
                print("Tiempo de espera agotado, reintentando...")

async def handle_client(conn, client_id):
    """Maneja la conexión de un cliente TCP."""
    with conn:
        conn.settimeout(15)
        buffer = []
        try:
            while True:
                data = await asyncio.to_thread(conn.recv, 1024)
                if not data:
                    break

                message = data.decode().strip()
                if message and message not in processed_messages:
                    processed_messages.add(message)
                    buffer.append(message)
                    print(f"Datos recibidos de {client_id}: '{message}'")
                    
                    match = re.match(
                        r'Latitude:\s*(-?\d+\.\d+)\s+Longitude:\s*(-?\d+\.\d+)\s+Timestamp:\s*(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+Speed:\s*(\d+(?:\.\d+)?)\s+RPM:\s*(\d+(?:\.\d+)?)\s+Fuel:\s*(\d+(?:\.\d+)?)', 
                        message
                    )
                    
                    if match:
                        latitud, longitud, fecha, hora, velocidad, rpm, fuel = match.groups()
                        location_cache.append((client_id, latitud, longitud, fecha, hora, velocidad, rpm, fuel))
                        await save_locations_in_batch()
                        await notify_clients(client_id, latitud, longitud, fecha, hora, velocidad, rpm, fuel)
                        await asyncio.to_thread(conn.sendall, b"Datos recibidos y guardados.")
                    else:
                        print("Formato de datos incorrecto.")
                        await asyncio.to_thread(conn.sendall, b"Formato de datos incorrecto.")
        except socket.timeout:
            print("Conexión TCP cerrada por timeout.")
        except Exception as e:
            print(f"Error en la conexión TCP con {client_id}: {e}")

async def save_locations_in_batch():
    """Guarda las ubicaciones en la base de datos en lotes."""
    if not location_cache:
        return
    
    async with save_lock:
        try:
            connection = connection_pool.get_connection()
            cursor = connection.cursor()
            cursor.executemany('''INSERT IGNORE INTO ubicaciones (client_id, latitud, longitud, fecha, hora, velocidad, rpm, combustible) 
                                  VALUES (%s, %s, %s, %s, %s, %s, %s, %s)''', location_cache)
            connection.commit()
            location_cache.clear()
            print("Ubicaciones guardadas en la base de datos.")
        except Exception as e:
            print(f"Error al guardar en la base de datos: {e}")
        finally:
            cursor.close()
            connection.close()

async def notify_clients(client_id, latitud, longitud, fecha, hora, velocidad, rpm, fuel):
    """Notifica a los clientes conectados via WebSocket."""
    global last_notification_time
    current_time = time.time()
    
    if current_time - last_notification_time >= NOTIFICATION_THRESHOLD:
        message = json.dumps({
            'client_id': client_id,
            'latitud': latitud, 
            'longitud': longitud, 
            'fecha': fecha, 
            'hora': hora,
            'velocidad': velocidad,
            'rpm': rpm,
            'combustible': fuel
        })
        for client in clients:
            await asyncio.to_thread(server.send_message, client, message)
        last_notification_time = current_time
        print(f"Clientes notificados del ID {client_id}.")

def start_websocket():
    global server
    server = WebsocketServer(port=20000, host='0.0.0.0')
    server.set_fn_new_client(new_client)
    server.set_fn_client_left(client_left)
    server.set_fn_message_received(message_received)
    print("Servidor WebSocket corriendo en el puerto 20000")
    server.run_forever()

def new_client(client, server):
    clients.append(client)
    print(f"Nuevo cliente conectado: {client['id']}")

def client_left(client, server):
    clients.remove(client)
    print(f"Cliente desconectado: {client['id']}")

def message_received(client, server, message):
    print(f"Mensaje recibido de cliente {client['id']}: {message}")

async def main():
    tcp_task = asyncio.create_task(handle_tcp_connection())
    ws_task = asyncio.to_thread(start_websocket)

    try:
        await asyncio.gather(tcp_task, ws_task)
    except KeyboardInterrupt:
        print("Servidor detenido por el usuario.")
    finally:
        tcp_task.cancel()
        ws_task.cancel()

if __name__ == "__main__":
    asyncio.run(main())
