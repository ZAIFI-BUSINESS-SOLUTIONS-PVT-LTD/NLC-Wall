"""Run this once to push the updated pledge texts into the database.
Usage:  python reset_pledge.py
"""
import sqlite3, json, pathlib
from pledge_defaults import PLEDGE_TAMIL, PLEDGE_HINDI, PLEDGE_ENGLISH, DEFAULT_DURATION_SECONDS

new_config = json.dumps({
    "tamil": PLEDGE_TAMIL,
    "hindi": PLEDGE_HINDI,
    "english": PLEDGE_ENGLISH,
    "duration_seconds": DEFAULT_DURATION_SECONDS,
})

db_path = pathlib.Path(__file__).parent.parent / "signwall.db"
with sqlite3.connect(db_path) as conn:
    existing = conn.execute("SELECT value FROM config WHERE key='pledge_config'").fetchone()
    if existing:
        conn.execute("UPDATE config SET value=? WHERE key='pledge_config'", (new_config,))
        print("✓ pledge_config updated in database.")
    else:
        conn.execute("INSERT INTO config (key, value) VALUES ('pledge_config', ?)", (new_config,))
        print("✓ pledge_config inserted into database.")
    conn.commit()

print("Done. Restart the server for changes to take effect.")
