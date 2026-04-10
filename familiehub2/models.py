"""models.py — Database operations for Familiehub"""

import sqlite3, hashlib, secrets, json
from pathlib import Path

DB_PATH = Path(__file__).parent / 'instance' / 'familie.db'

COLORS = [
    {'color': '#D4537E', 'bg': '#FBEAF0', 'text': '#72243E'},
    {'color': '#185FA5', 'bg': '#E6F1FB', 'text': '#0C447C'},
    {'color': '#1D9E75', 'bg': '#E1F5EE', 'text': '#085041'},
    {'color': '#7F77DD', 'bg': '#EEEDFE', 'text': '#3C3489'},
    {'color': '#E06B2E', 'bg': '#FEF0E8', 'text': '#7A3010'},
    {'color': '#2E86AB', 'bg': '#E3F4FA', 'text': '#0D4A63'},
    {'color': '#C0392B', 'bg': '#FDECEA', 'text': '#7B241C'},
    {'color': '#8E44AD', 'bg': '#F5EEF8', 'text': '#6C3483'},
]

def _db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(str(DB_PATH))
    c.row_factory = sqlite3.Row
    return c

def init_db():
    with _db() as db:
        db.executescript("""
            CREATE TABLE IF NOT EXISTS families (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT    NOT NULL,
                invite_code TEXT    UNIQUE NOT NULL
            );
            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                name          TEXT    NOT NULL,
                email         TEXT    UNIQUE,
                password_hash TEXT,
                role          TEXT    NOT NULL DEFAULT 'child',
                family_id     INTEGER REFERENCES families(id),
                color         TEXT    DEFAULT '#185FA5',
                bg_color      TEXT    DEFAULT '#E6F1FB',
                text_color    TEXT    DEFAULT '#0C447C',
                initials      TEXT    DEFAULT '?'
            );
            CREATE TABLE IF NOT EXISTS cal_events (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                family_id  INTEGER NOT NULL,
                title      TEXT    NOT NULL,
                date       TEXT    NOT NULL,
                time       TEXT    DEFAULT '',
                place      TEXT    DEFAULT '',
                type       TEXT    DEFAULT 'familie',
                who        TEXT    DEFAULT '[]',
                created_by INTEGER
            );
            CREATE TABLE IF NOT EXISTS chores (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                family_id INTEGER NOT NULL,
                name      TEXT    NOT NULL,
                who_id    INTEGER,
                date      TEXT    NOT NULL,
                pts       INTEGER DEFAULT 2,
                done      INTEGER DEFAULT 0,
                done_by   INTEGER
            );
            CREATE TABLE IF NOT EXISTS dinners (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                family_id   INTEGER NOT NULL,
                name        TEXT    NOT NULL,
                date        TEXT    NOT NULL,
                ingredients TEXT    DEFAULT '[]'
            );
            CREATE TABLE IF NOT EXISTS fridge_items (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                family_id INTEGER NOT NULL,
                name      TEXT    NOT NULL,
                qty       REAL    DEFAULT 1,
                unit      TEXT    DEFAULT 'stk',
                section   TEXT    DEFAULT 'fridge'
            );
            CREATE TABLE IF NOT EXISTS groceries (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                family_id INTEGER NOT NULL,
                name      TEXT    NOT NULL,
                checked   INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS messages (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                family_id  INTEGER NOT NULL,
                user_id    INTEGER,
                text       TEXT    NOT NULL,
                created_at TEXT    DEFAULT (datetime('now'))
            );
        """)

# ── Helpers ───────────────────────────────────────────────────────────────────
def _color(idx):  return COLORS[idx % len(COLORS)]
def _initials(n): parts = n.strip().split(); return (parts[0][0] + (parts[-1][0] if len(parts)>1 else '')).upper()

def hash_pw(pw):
    salt = secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac('sha256', pw.encode(), salt.encode(), 100000)
    return salt + ':' + h.hex()

def check_pw(pw, stored):
    try:
        salt, h = stored.split(':', 1)
        return hashlib.pbkdf2_hmac('sha256', pw.encode(), salt.encode(), 100000).hex() == h
    except Exception: return False

# ── Families ──────────────────────────────────────────────────────────────────
def create_family(name):
    code = secrets.token_urlsafe(6).upper()[:8]
    with _db() as db:
        cur = db.execute("INSERT INTO families (name,invite_code) VALUES (?,?)", (name, code))
        return cur.lastrowid, code

def get_family(fid):
    with _db() as db:
        r = db.execute("SELECT * FROM families WHERE id=?", (fid,)).fetchone()
        return dict(r) if r else None

def get_family_by_invite(code):
    with _db() as db:
        r = db.execute("SELECT * FROM families WHERE invite_code=?", (code.strip().upper(),)).fetchone()
        return dict(r) if r else None

# ── Users ─────────────────────────────────────────────────────────────────────
def count_members(fid):
    with _db() as db:
        return db.execute("SELECT COUNT(*) FROM users WHERE family_id=?", (fid,)).fetchone()[0]

def create_user(name, email, password, role, fid, color_idx=0):
    c = _color(color_idx)
    with _db() as db:
        cur = db.execute(
            "INSERT INTO users (name,email,password_hash,role,family_id,color,bg_color,text_color,initials) VALUES (?,?,?,?,?,?,?,?,?)",
            (name, email, hash_pw(password), role, fid, c['color'], c['bg'], c['text'], _initials(name))
        )
        return cur.lastrowid

def add_child(fid, name, color_idx):
    c = _color(color_idx)
    with _db() as db:
        cur = db.execute(
            "INSERT INTO users (name,role,family_id,color,bg_color,text_color,initials) VALUES (?,?,?,?,?,?,?)",
            (name, 'child', fid, c['color'], c['bg'], c['text'], _initials(name))
        )
        return cur.lastrowid

def get_user_by_email(email):
    with _db() as db:
        r = db.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
        return dict(r) if r else None

def get_user(uid):
    with _db() as db:
        r = db.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
        return dict(r) if r else None

def get_members(fid):
    with _db() as db:
        rows = db.execute("SELECT * FROM users WHERE family_id=? ORDER BY role DESC, id", (fid,)).fetchall()
        return [dict(r) for r in rows]

def remove_member(uid, fid):
    with _db() as db: db.execute("DELETE FROM users WHERE id=? AND family_id=?", (uid, fid))

def update_role(uid, fid, role):
    with _db() as db: db.execute("UPDATE users SET role=? WHERE id=? AND family_id=?", (role, uid, fid))

# ── Calendar events ───────────────────────────────────────────────────────────
def get_events(fid, from_d, to_d):
    with _db() as db:
        rows = db.execute("SELECT * FROM cal_events WHERE family_id=? AND date>=? AND date<=? ORDER BY date,time", (fid,from_d,to_d)).fetchall()
        return [{**dict(r), 'who': json.loads(r['who'])} for r in rows]

def create_event(fid, title, date, time, place, typ, who, created_by):
    with _db() as db:
        cur = db.execute("INSERT INTO cal_events (family_id,title,date,time,place,type,who,created_by) VALUES (?,?,?,?,?,?,?,?)",
                         (fid,title,date,time,place,typ,json.dumps(who),created_by))
        return cur.lastrowid

def delete_event(eid, fid):
    with _db() as db: db.execute("DELETE FROM cal_events WHERE id=? AND family_id=?", (eid,fid))

# ── Chores ────────────────────────────────────────────────────────────────────
def get_chores(fid, from_d, to_d):
    with _db() as db:
        rows = db.execute(
            "SELECT c.*,u.name as who_name,u.color,u.bg_color,u.text_color,u.initials as who_initials "
            "FROM chores c LEFT JOIN users u ON c.who_id=u.id "
            "WHERE c.family_id=? AND c.date>=? AND c.date<=? ORDER BY c.date", (fid,from_d,to_d)).fetchall()
        return [dict(r) for r in rows]

def create_chore(fid, name, who_id, date, pts):
    with _db() as db:
        cur = db.execute("INSERT INTO chores (family_id,name,who_id,date,pts) VALUES (?,?,?,?,?)", (fid,name,who_id,date,pts))
        return cur.lastrowid

def toggle_chore(cid, fid, done_by):
    with _db() as db:
        r = db.execute("SELECT done FROM chores WHERE id=? AND family_id=?", (cid,fid)).fetchone()
        if r:
            nd = 0 if r['done'] else 1
            db.execute("UPDATE chores SET done=?,done_by=? WHERE id=?", (nd, done_by if nd else None, cid))

def delete_chore(cid, fid):
    with _db() as db: db.execute("DELETE FROM chores WHERE id=? AND family_id=?", (cid,fid))

def get_all_chores(fid):
    with _db() as db:
        rows = db.execute(
            "SELECT c.*,u.name as who_name,u.color,u.bg_color,u.text_color,u.initials as who_initials "
            "FROM chores c LEFT JOIN users u ON c.who_id=u.id WHERE c.family_id=? ORDER BY c.done,c.date", (fid,)).fetchall()
        return [dict(r) for r in rows]

# ── Dinners ───────────────────────────────────────────────────────────────────
def get_dinners(fid, from_d, to_d):
    with _db() as db:
        rows = db.execute("SELECT * FROM dinners WHERE family_id=? AND date>=? AND date<=? ORDER BY date", (fid,from_d,to_d)).fetchall()
        return [{**dict(r), 'ingredients': json.loads(r['ingredients'])} for r in rows]

def create_dinner(fid, name, date, ingredients):
    with _db() as db:
        cur = db.execute("INSERT INTO dinners (family_id,name,date,ingredients) VALUES (?,?,?,?)", (fid,name,date,json.dumps(ingredients)))
        return cur.lastrowid

def delete_dinner(did, fid):
    with _db() as db: db.execute("DELETE FROM dinners WHERE id=? AND family_id=?", (did,fid))

# ── Fridge ────────────────────────────────────────────────────────────────────
def get_fridge(fid):
    with _db() as db:
        rows = db.execute("SELECT * FROM fridge_items WHERE family_id=? ORDER BY section,name", (fid,)).fetchall()
        return [dict(r) for r in rows]

def add_fridge(fid, name, qty, unit, section):
    with _db() as db:
        cur = db.execute("INSERT INTO fridge_items (family_id,name,qty,unit,section) VALUES (?,?,?,?,?)", (fid,name,qty,unit,section))
        return cur.lastrowid

def update_fridge(iid, fid, delta):
    with _db() as db: db.execute("UPDATE fridge_items SET qty=MAX(0,qty+?) WHERE id=? AND family_id=?", (delta,iid,fid))

def delete_fridge(iid, fid):
    with _db() as db: db.execute("DELETE FROM fridge_items WHERE id=? AND family_id=?", (iid,fid))

# ── Groceries ─────────────────────────────────────────────────────────────────
def get_groceries(fid):
    with _db() as db:
        rows = db.execute("SELECT * FROM groceries WHERE family_id=? ORDER BY checked,id", (fid,)).fetchall()
        return [dict(r) for r in rows]

def add_grocery(fid, name):
    with _db() as db:
        cur = db.execute("INSERT INTO groceries (family_id,name) VALUES (?,?)", (fid,name))
        return cur.lastrowid

def toggle_grocery(gid, fid):
    with _db() as db:
        r = db.execute("SELECT checked FROM groceries WHERE id=? AND family_id=?", (gid,fid)).fetchone()
        if r: db.execute("UPDATE groceries SET checked=? WHERE id=?", (0 if r['checked'] else 1, gid))

def delete_grocery(gid, fid):
    with _db() as db: db.execute("DELETE FROM groceries WHERE id=? AND family_id=?", (gid,fid))

def clear_checked(fid):
    with _db() as db: db.execute("DELETE FROM groceries WHERE family_id=? AND checked=1", (fid,))

# ── Messages ──────────────────────────────────────────────────────────────────
def get_messages(fid, limit=60):
    with _db() as db:
        rows = db.execute(
            "SELECT m.*,u.name as user_name,u.color,u.bg_color,u.text_color,u.initials "
            "FROM messages m LEFT JOIN users u ON m.user_id=u.id "
            "WHERE m.family_id=? ORDER BY m.created_at DESC LIMIT ?", (fid,limit)).fetchall()
        return list(reversed([dict(r) for r in rows]))

def add_message(fid, uid, text):
    with _db() as db:
        cur = db.execute("INSERT INTO messages (family_id,user_id,text) VALUES (?,?,?)", (fid,uid,text))
        return cur.lastrowid
