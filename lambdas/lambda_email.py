import json
import boto3
from botocore.exceptions import ClientError

ses = boto3.client('ses', region_name='us-east-1')

TU_EMAIL = 'jazzenlajungla@gmail.com'

def lambda_handler(event, context):
    # Manejar preflight CORS (OPTIONS)
    if event.get('requestContext', {}).get('http', {}).get('method') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': cors_headers(),
            'body': ''
        }

    body = json.loads(event.get('body', '{}'))
    name    = body.get('name', '').strip()
    email   = body.get('email', '').strip()
    country = body.get('country', '').strip()
    phone   = body.get('phone', '').strip()
    edition = body.get('edition', '').strip()
    background = body.get('background', '').strip()
    how_heard  = body.get('howHeard', '').strip()

    if not name or not email:
        return {
            'statusCode': 400,
            'headers': cors_headers(),
            'body': json.dumps({'error': 'Faltan campos obligatorios'})
        }

    try:
        # ── Email a vos con todos los datos ──────────────────────────
        ses.send_email(
            Source=TU_EMAIL,
            Destination={'ToAddresses': [TU_EMAIL]},
            Message={
                'Subject': {'Data': f'Nueva solicitud de reserva — {name}'},
                'Body': {'Text': {'Data': (
                    f'Nueva solicitud recibida desde el formulario web.\n\n'
                    f'Nombre:    {name}\n'
                    f'Email:     {email}\n'
                    f'País:      {country}\n'
                    f'Teléfono:  {phone}\n'
                    f'Edición:   {edition}\n'
                    f'Experiencia musical:\n{background}\n\n'
                    f'¿Cómo nos encontró? {how_heard}\n'
                )}}
            }
        )

        # ── Email de confirmación al cliente ─────────────────────────
        ses.send_email(
            Source=TU_EMAIL,
            Destination={'ToAddresses': [email]},
            Message={
                'Subject': {'Data': '¡Recibimos tu solicitud! — Jazz en la Jungla'},
                'Body': {'Text': {'Data': (
                    f'Hola {name},\n\n'
                    'Hemos recibido tu solicitud de reserva para Jazz en la Jungla 2027.\n\n'
                    f'Edición seleccionada: {edition}\n\n'
                    'Nos pondremos en contacto contigo a la brevedad para confirmar tu plaza '
                    'y darte los próximos pasos.\n\n'
                    'Si tenés alguna pregunta, podés responder directamente a este email.\n\n'
                    '— El equipo de Jazz en la Jungla\n'
                    'jazzenlajungla@gmail.com\n'
                    'https://www.instagram.com/jazzenlajungla/'
                )}}
            }
        )

        return {
            'statusCode': 200,
            'headers': cors_headers(),
            'body': json.dumps({'ok': True})
        }

    except ClientError as e:
        print('SES error:', e.response['Error']['Message'])
        return {
            'statusCode': 500,
            'headers': cors_headers(),
            'body': json.dumps({'error': 'No se pudo enviar el email'})
        }


def cors_headers():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    }
