import json
import os
import boto3
import uuid
import re
from datetime import datetime, date, timezone
from botocore.exceptions import ClientError

# Configuración vía variables de entorno de Lambda (con valores por defecto
# para no romper el entorno actual si no se establecen).
TABLE_NAME = os.environ.get('DYNAMO_TABLE', 'Contactos-jazzenlajungla')

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(TABLE_NAME)

EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')

# Valores permitidos según los value del HTML
EDICIONES_VALIDAS = {'1', '2'}
ALOJAMIENTOS_VALIDOS = {'shared', 'private'}

MAX_LENGTHS = {
    'name': 150,
    'email': 150,
    'country': 80,
    'phone': 30,
    'background': 4000,
    'howHeard': 80
}

EDAD_MINIMA = 18


def response(status_code, body):
    """Helper para respuestas HTTP. CORS lo gestiona API Gateway."""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json'
        },
        'body': json.dumps(body, ensure_ascii=False)
    }


def calcular_edad(fecha_nac_str):
    try:
        fecha_nac = date.fromisoformat(fecha_nac_str)
    except (ValueError, TypeError):
        return None
    hoy = date.today()
    return hoy.year - fecha_nac.year - ((hoy.month, hoy.day) < (fecha_nac.month, fecha_nac.day))


def lambda_handler(event, context):
    print(f"Body recibido: {event.get('body')}")
    
    try:
        body = json.loads(event.get('body', '{}'))
    except json.JSONDecodeError:
        return response(400, {'error': 'JSON inválido'})
    
    print(f"Body parseado: {body}")
    
    # Extraer campos obligatorios (nombres del frontend)
    name = body.get('name', '').strip()
    email = body.get('email', '').strip().lower()
    dob = body.get('dob', '').strip()
    country = body.get('country', '').strip()
    edition = body.get('edition', '').strip()
    accommodation = body.get('accommodation', '').strip()
    consent = body.get('consent', False)
    
    # Campos opcionales
    phone = body.get('phone', '').strip()
    background = body.get('background', '').strip()
    how_heard = body.get('howHeard', '').strip()
    
    # Validaciones de obligatorios
    if not all([name, email, dob, country, edition, accommodation]):
        return response(400, {'error': 'Faltan campos obligatorios'})
    
    if consent is not True:
        return response(400, {'error': 'Debes aceptar las condiciones para enviar el formulario'})
    
    # Formato email
    if not EMAIL_REGEX.match(email):
        return response(400, {'error': 'Email con formato inválido'})
    
    # Valores de radios
    if edition not in EDICIONES_VALIDAS:
        return response(400, {'error': 'Edición seleccionada no válida'})
    if accommodation not in ALOJAMIENTOS_VALIDOS:
        return response(400, {'error': 'Tipo de alojamiento no válido'})
    
    # Edad
    edad = calcular_edad(dob)
    if edad is None:
        return response(400, {'error': 'Fecha de nacimiento inválida'})
    if edad < EDAD_MINIMA:
        return response(400, {'error': f'Debes tener al menos {EDAD_MINIMA} años para inscribirte'})
    if edad > 120:
        return response(400, {'error': 'Fecha de nacimiento inválida'})
    
    # Longitudes
    if len(name) > MAX_LENGTHS['name']:
        return response(400, {'error': 'Nombre demasiado largo'})
    if len(email) > MAX_LENGTHS['email']:
        return response(400, {'error': 'Email demasiado largo'})
    if len(country) > MAX_LENGTHS['country']:
        return response(400, {'error': 'País demasiado largo'})
    if len(phone) > MAX_LENGTHS['phone']:
        return response(400, {'error': 'Teléfono demasiado largo'})
    if len(background) > MAX_LENGTHS['background']:
        return response(400, {'error': 'Mensaje demasiado largo'})
    if len(how_heard) > MAX_LENGTHS['howHeard']:
        return response(400, {'error': 'Campo demasiado largo'})
    
    # Construir item
    now = datetime.now(timezone.utc)
    item = {
        'id': str(uuid.uuid4()),
        'timestamp': now.isoformat(),
        'fecha_creacion': now.strftime('%Y-%m-%d'),
        'name': name,
        'email': email,
        'dob': dob,
        'edad': edad,
        'country': country,
        'phone': phone or None,
        'edition': edition,
        'accommodation': accommodation,
        'background': background or None,
        'howHeard': how_heard or None,
        'consent': consent,
        'estado': 'pendiente',
        'ip_origen': event.get('requestContext', {}).get('http', {}).get('sourceIp', 'unknown'),
        'user_agent': event.get('headers', {}).get('user-agent', 'unknown')
    }
    
    item = {k: v for k, v in item.items() if v is not None}
    
    try:
        table.put_item(Item=item)
    except ClientError as e:
        print(f"Error DynamoDB: {e.response['Error']['Message']}")
        return response(500, {'error': 'Error interno al guardar. Inténtalo de nuevo.'})
    
    return response(200, {
        'success': True,
        'message': 'Solicitud recibida correctamente. Te contactaremos pronto.',
        'id': item['id']
    })