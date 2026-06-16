import psycopg2
import sys

try:
    conn = psycopg2.connect("postgresql://postgres:localpassword@localhost:5432/cineflow")
    cur = conn.cursor()
    cur.execute("DELETE FROM scheduled_scenes WHERE scene_id IN (SELECT id FROM scenes WHERE project_id = 'd0b7f09b-3f77-4f66-96ec-58da322306f9')")
    print(f"Deleted {cur.rowcount} rows")
    conn.commit()
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
