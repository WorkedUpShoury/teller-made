# postgresql connection logic
import psycopg2
import os

def get_db_connection():
    conn = psycopg2.connect(
        host="localhost",
        database="tellermade",
        user="postgres",
        # password=os.getenv("POSTGRES_PASSWORD") or "Samu@1234",
        password="Samu@1234",
        port="5432"
    )
    return conn
