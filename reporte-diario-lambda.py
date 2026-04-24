import boto3
import csv
import io
from datetime import datetime, timezone, timedelta
from botocore.exceptions import ClientError

# Configuración
TABLE_NAME = 'Contactos-jazzenlajungla'
SENDER = 'jazzenlajungla@gmail.com'  # Identidad verificada como remitente
RECIPIENT = 'jazzenlajungla@gmail.com'  # Identidad verificada como destinatario
AWS_REGION = 'us-east-1'

dynamodb = boto3.resource('dynamodb')
ses = boto3.client('ses', region_name=AWS_REGION)
table = dynamodb.Table(TABLE_NAME)


def scan_all_items(table):
    """
    Hace scan completo a una tabla DynamoDB, manejando la paginación.
    DynamoDB limita cada respuesta a 1 MB; si hay más, devuelve un token
    para continuar. Esta función junta todas las páginas.
    """
    items = []
    response = table.scan()
    items.extend(response.get('Items', []))
    
    while 'LastEvaluatedKey' in response:
        response = table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
        items.extend(response.get('Items', []))
    
    return items


def generar_csv(items):
    """
    Genera un CSV en memoria (sin escribirlo a disco) a partir
    de los items de DynamoDB.
    """
    # Definimos el orden de las columnas. Los items pueden tener campos
    # distintos entre sí (DynamoDB es schema-less), así que fijamos las columnas.
    columnas = [
        'fecha_creacion', 'timestamp', 'name', 'email', 'dob', 'edad',
        'country', 'phone', 'edition', 'accommodation',
        'background', 'howHeard', 'consent', 'estado', 'id'
    ]
    
    # io.StringIO = un "archivo" que vive en memoria, como un buffer de texto
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=columnas, extrasaction='ignore')
    writer.writeheader()
    
    # Ordenamos por timestamp descendente (los más nuevos arriba)
    items_ordenados = sorted(items, key=lambda x: x.get('timestamp', ''), reverse=True)
    
    for item in items_ordenados:
        # Convertir tipos que no son serializables directamente (Decimal, etc.)
        row = {col: str(item.get(col, '')) for col in columnas}
        writer.writerow(row)
    
    return buffer.getvalue()


def contar_estadisticas(items):
    """Genera estadísticas simples para el cuerpo del email."""
    total = len(items)
    hoy = datetime.now(timezone.utc).date()
    ayer = hoy - timedelta(days=1)
    
    # Contar nuevas de las últimas 24h
    nuevas_hoy = 0
    for item in items:
        try:
            ts = datetime.fromisoformat(item.get('timestamp', ''))
            if ts.date() >= ayer:
                nuevas_hoy += 1
        except (ValueError, TypeError):
            continue
    
    # Contar por estado
    pendientes = sum(1 for i in items if i.get('estado') == 'pendiente')
    
    # Contar por edición
    ed1 = sum(1 for i in items if i.get('edition') == '1')
    ed2 = sum(1 for i in items if i.get('edition') == '2')
    
    # Contar por alojamiento
    shared = sum(1 for i in items if i.get('accommodation') == 'shared')
    private = sum(1 for i in items if i.get('accommodation') == 'private')
    
    return {
        'total': total,
        'nuevas_24h': nuevas_hoy,
        'pendientes': pendientes,
        'edicion_1': ed1,
        'edicion_2': ed2,
        'tienda_compartida': shared,
        'tienda_privada': private
    }


def enviar_email_con_csv(csv_content, stats):
    """
    Envía un email con el CSV adjunto usando SES.
    Para adjuntos, hay que usar send_raw_email (más complejo que send_email).
    """
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from email.mime.application import MIMEApplication
    
    fecha = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    
    # Crear el mensaje multipart
    msg = MIMEMultipart()
    msg['Subject'] = f'Reporte diario Jazz en la Jungla - {fecha}'
    msg['From'] = SENDER
    msg['To'] = RECIPIENT
    
    # Cuerpo del email en HTML
    cuerpo_html = f"""
    <html>
    <body style="font-family: Arial, sans-serif;">
        <h2>Reporte diario de solicitudes</h2>
        <p>Fecha: {fecha}</p>
        
        <h3>Estadísticas</h3>
        <ul>
            <li><strong>Total de solicitudes:</strong> {stats['total']}</li>
            <li><strong>Nuevas en las últimas 24h:</strong> {stats['nuevas_24h']}</li>
            <li><strong>Pendientes de contactar:</strong> {stats['pendientes']}</li>
        </ul>
        
        <h3>Por edición</h3>
        <ul>
            <li>Edición 1 (Feb 15-20): {stats['edicion_1']}</li>
            <li>Edición 2 (Feb 22-27): {stats['edicion_2']}</li>
        </ul>
        
        <h3>Por alojamiento</h3>
        <ul>
            <li>Tienda compartida: {stats['tienda_compartida']}</li>
            <li>Tienda privada: {stats['tienda_privada']}</li>
        </ul>
        
        <p>El listado completo está en el CSV adjunto.</p>
        
        <p style="color: #666; font-size: 12px;">
            Generado automáticamente por Jazz en la Jungla AWS infra.
        </p>
    </body>
    </html>
    """
    
    msg.attach(MIMEText(cuerpo_html, 'html'))
    
    # Adjuntar el CSV
    adjunto = MIMEApplication(csv_content.encode('utf-8'))
    adjunto.add_header(
        'Content-Disposition',
        'attachment',
        filename=f'solicitudes_{fecha}.csv'
    )
    msg.attach(adjunto)
    
    # Enviar con send_raw_email
    try:
        response = ses.send_raw_email(
            Source=SENDER,
            Destinations=[RECIPIENT],
            RawMessage={'Data': msg.as_string()}
        )
        print(f"Email enviado. MessageId: {response['MessageId']}")
        return True
    except ClientError as e:
        print(f"Error al enviar email: {e.response['Error']['Message']}")
        raise


def lambda_handler(event, context):
    print("Iniciando reporte diario")
    
    # 1. Leer todos los items de DynamoDB
    items = scan_all_items(table)
    print(f"Items leídos: {len(items)}")
    
    # 2. Si no hay datos, enviar un email indicándolo y salir
    if len(items) == 0:
        print("No hay solicitudes aún. No se envía email.")
        return {'status': 'ok', 'mensaje': 'sin datos'}
    
    # 3. Generar el CSV
    csv_content = generar_csv(items)
    print(f"CSV generado ({len(csv_content)} caracteres)")
    
    # 4. Calcular estadísticas
    stats = contar_estadisticas(items)
    
    # 5. Enviar el email con el CSV adjunto
    enviar_email_con_csv(csv_content, stats)
    
    return {
        'status': 'ok',
        'items_enviados': len(items),
        'estadisticas': stats
    }