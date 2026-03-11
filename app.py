from flask import Flask, jsonify, request, session, send_from_directory
from flask_cors import CORS
import os, uuid, random, re, time, requests as http_requests, traceback
from datetime import datetime, date
from functools import wraps
import psycopg2
from psycopg2.extras import RealDictCursor

# ─────────────────────────────────────────────
#  CONFIG
# ─────────────────────────────────────────────
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
DB_HOST     = os.environ.get("DB_HOST",     "aws-1-ap-northeast-2.pooler.supabase.com")
DB_NAME     = os.environ.get("DB_NAME",     "postgres")
DB_USER     = os.environ.get("DB_USER",     "postgres.cqlahdbkrddqrjgxaxws")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "Ganesh@harsha@harshith")
DB_PORT     = os.environ.get("DB_PORT",     "5432")

app = Flask(__name__, static_folder='static', template_folder='templates')
app.secret_key = os.environ.get('SECRET_KEY', 'leaveos-super-secret-2024')
CORS(app, supports_credentials=True)

# ─────────────────────────────────────────────
#  DATABASE HELPERS
# ─────────────────────────────────────────────
def get_db():
    return psycopg2.connect(
        host=DB_HOST, dbname=DB_NAME, user=DB_USER,
        password=DB_PASSWORD, port=DB_PORT,
        cursor_factory=RealDictCursor,
        connect_timeout=15,
        sslmode='require'
    )

def db_query(sql, params=None, fetch='all'):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(sql, params or ())
        conn.commit()
        if fetch == 'one':
            return cur.fetchone()
        elif fetch == 'all':
            return cur.fetchall()
        return None
    except Exception as e:
        conn.rollback()
        print(f"DB ERROR: {e}\nSQL: {sql}\nPARAMS: {params}")
        raise
    finally:
        conn.close()

def row_to_dict(row):
    if row is None:
        return None
    d = dict(row)
    for k, v in d.items():
        if isinstance(v, date):
            d[k] = v.isoformat()
    return d

def rows_to_list(rows):
    return [row_to_dict(r) for r in (rows or [])]

def emp_to_api(e):
    """Convert flat DB row → nested leave_balance / leave_taken shape."""
    if not e:
        return None
    d = row_to_dict(e) if not isinstance(e, dict) else dict(e)
    # dates already converted by row_to_dict; convert any remaining date objs
    for k, v in d.items():
        if isinstance(v, date):
            d[k] = v.isoformat()
    d['leave_balance'] = {
        'annual':  d.pop('annual_balance', 0),
        'sick':    d.pop('sick_balance',   0),
        'casual':  d.pop('casual_balance', 0),
    }
    d['leave_taken'] = {
        'annual':  d.pop('annual_taken', 0),
        'sick':    d.pop('sick_taken',   0),
        'casual':  d.pop('casual_taken', 0),
    }
    d.pop('password', None)
    return d

def leave_to_api(l):
    """Convert leave row to API-safe dict with all dates as strings."""
    if l is None:
        return None
    d = row_to_dict(l) if not isinstance(l, dict) else dict(l)
    # row_to_dict already converts date objects; ensure strings anyway
    for key in ('from_date', 'to_date', 'applied_on'):
        if key in d and d[key]:
            d[key] = str(d[key])
    return d

# ─────────────────────────────────────────────
# ─────────────────────────────────────────────
#  SCHEMA + SEED
# ─────────────────────────────────────────────
def init_db():
    conn = get_db()
    try:
        cur = conn.cursor()

        # Drop all tables and recreate fresh — guarantees correct schema
        cur.execute("DROP TABLE IF EXISTS leaves    CASCADE")
        cur.execute("DROP TABLE IF EXISTS employees CASCADE")
        cur.execute("DROP TABLE IF EXISTS managers  CASCADE")
        conn.commit()

        cur.execute("""
            CREATE TABLE managers (
                id         TEXT PRIMARY KEY,
                name       TEXT NOT NULL,
                email      TEXT UNIQUE NOT NULL,
                phone      TEXT DEFAULT \'\',
                password   TEXT DEFAULT \'\',
                role       TEXT DEFAULT \'manager\',
                department TEXT NOT NULL,
                verified   BOOLEAN DEFAULT TRUE
            )
        """)
        cur.execute("""
            CREATE TABLE employees (
                id             TEXT PRIMARY KEY,
                name           TEXT NOT NULL,
                email          TEXT UNIQUE NOT NULL,
                phone          TEXT DEFAULT \'\',
                password       TEXT DEFAULT \'\',
                role           TEXT DEFAULT \'employee\',
                department     TEXT NOT NULL,
                position       TEXT NOT NULL,
                manager_id     TEXT REFERENCES managers(id) ON DELETE SET NULL,
                join_date      DATE DEFAULT CURRENT_DATE,
                verified       BOOLEAN DEFAULT TRUE,
                annual_balance INT DEFAULT 15,
                sick_balance   INT DEFAULT 7,
                casual_balance INT DEFAULT 3,
                annual_taken   INT DEFAULT 0,
                sick_taken     INT DEFAULT 0,
                casual_taken   INT DEFAULT 0
            )
        """)
        cur.execute("""
            CREATE TABLE leaves (
                id           TEXT PRIMARY KEY,
                employee_id  TEXT REFERENCES employees(id) ON DELETE CASCADE,
                manager_id   TEXT REFERENCES managers(id)  ON DELETE SET NULL,
                type         TEXT NOT NULL,
                from_date    DATE NOT NULL,
                to_date      DATE NOT NULL,
                days         INT  NOT NULL,
                reason       TEXT NOT NULL,
                status       TEXT DEFAULT \'pending\',
                applied_on   DATE DEFAULT CURRENT_DATE,
                manager_note TEXT DEFAULT \'\'
            )
        """)
        conn.commit()
        print("Tables created.")

        # Seed managers
        cur.execute("INSERT INTO managers (id,name,email,phone,password,department) VALUES (%s,%s,%s,%s,%s,%s)",
            ('mgr1','Sarah Mitchell','sarah@company.com','9876543210','manager123','Engineering'))
        cur.execute("INSERT INTO managers (id,name,email,phone,password,department) VALUES (%s,%s,%s,%s,%s,%s)",
            ('mgr2','James Parker','james@company.com','9876543211','manager123','Marketing'))

        # Seed employees
        emps = [
            ('emp1','Alex Johnson',  'alex@company.com',  '9876543212','emp123','Engineering','Senior Developer',  'mgr1','2021-03-15',12,5,3,3,1,1),
            ('emp2','Priya Sharma',  'priya@company.com', '9876543213','emp123','Engineering','Frontend Developer', 'mgr1','2022-06-01',15,7,3,2,0,0),
            ('emp3','Marcus Lee',    'marcus@company.com','9876543214','emp123','Engineering','DevOps Engineer',    'mgr1','2020-09-10',10,4,3,8,3,2),
            ('emp4','Nina Patel',    'nina@company.com',  '9876543215','emp123','Engineering','QA Engineer',        'mgr1','2023-01-20',14,6,3,1,2,0),
            ('emp5','Daniel Cruz',   'daniel@company.com','9876543216','emp123','Marketing',  'Marketing Lead',     'mgr2','2021-11-05',13,5,3,4,1,2),
            ('emp6','Sophie Wang',   'sophie@company.com','9876543217','emp123','Marketing',  'Content Strategist', 'mgr2','2022-03-14',14,6,3,1,0,1),
        ]
        for e in emps:
            cur.execute("""INSERT INTO employees
                (id,name,email,phone,password,department,position,manager_id,join_date,
                 annual_balance,sick_balance,casual_balance,annual_taken,sick_taken,casual_taken)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""", e)

        # Seed leaves
        lvs = [
            ('lv1', 'emp1','mgr1','annual','2025-01-06','2025-01-10',5,'Family vacation',  'approved','2024-12-20','Approved. Enjoy!'),
            ('lv2', 'emp1','mgr1','sick',  '2025-03-03','2025-03-03',1,'Fever and cold',   'approved','2025-03-03','Get well soon.'),
            ('lv3', 'emp2','mgr1','annual','2025-02-14','2025-02-15',2,'Personal trip',    'approved','2025-02-08',''),
            ('lv4', 'emp3','mgr1','annual','2025-04-01','2025-04-08',6,'Annual holiday',   'approved','2025-03-20','Approved'),
            ('lv5', 'emp3','mgr1','sick',  '2025-05-15','2025-05-17',3,'Medical procedure','approved','2025-05-14',''),
            ('lv6', 'emp4','mgr1','sick',  '2025-06-10','2025-06-11',2,'Severe migraine',  'approved','2025-06-10','Take rest'),
            ('lv7', 'emp1','mgr1','casual','2025-07-04','2025-07-04',1,'Personal errand',  'pending', '2025-07-01',''),
            ('lv8', 'emp2','mgr1','casual','2025-07-10','2025-07-10',1,'Home repair',      'pending', '2025-07-07',''),
            ('lv9', 'emp5','mgr2','annual','2025-06-20','2025-06-23',4,'Family event',     'approved','2025-06-10','Approved'),
            ('lv10','emp6','mgr2','annual','2025-08-01','2025-08-02',2,'Personal travel',  'rejected','2025-07-25','Critical deadline period'),
        ]
        for l in lvs:
            cur.execute("""INSERT INTO leaves
                (id,employee_id,manager_id,type,from_date,to_date,days,reason,status,applied_on,manager_note)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""", l)

        conn.commit()
        print("Database seeded successfully.")
    finally:
        conn.close()

#  UTILITY HELPERS
# ─────────────────────────────────────────────
def new_id(prefix='id'):
    return f"{prefix}_{uuid.uuid4().hex[:8]}"

def calc_working_days(from_date, to_date):
    start = datetime.strptime(from_date, '%Y-%m-%d').date()
    end   = datetime.strptime(to_date,   '%Y-%m-%d').date()
    count = 0
    cur   = start
    while cur <= end:
        if cur.weekday() < 5:
            count += 1
        cur = date.fromordinal(cur.toordinal() + 1)
    return count

def is_valid_email(email):
    if not re.match(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$', email):
        return False
    blocked = ['mailinator.com','tempmail.com','guerrillamail.com','throwaway.email',
               'yopmail.com','sharklasers.com','trashmail.com','maildrop.cc']
    domain = email.split('@')[1].lower()
    return domain not in blocked

# ─────────────────────────────────────────────
#  OTP STORE (in-memory)
# ─────────────────────────────────────────────
_otp_store = {}

def generate_otp(identifier, purpose='login'):
    otp = str(random.randint(100000, 999999))
    _otp_store[f"{purpose}:{identifier}"] = {'otp': otp, 'expires': time.time() + 300}
    return otp

def verify_otp(identifier, otp, purpose='login'):
    key    = f"{purpose}:{identifier}"
    record = _otp_store.get(key)
    if not record:
        return False, 'OTP not found or expired'
    if time.time() > record['expires']:
        _otp_store.pop(key, None)
        return False, 'OTP has expired'
    if record['otp'] != otp.strip():
        return False, 'Incorrect OTP'
    _otp_store.pop(key, None)
    return True, 'OK'

def send_otp_notification(identifier, otp, purpose='login'):
    print(f"\n{'='*40}\nOTP [{purpose}] for {identifier}: {otp}\n{'='*40}\n")

# ─────────────────────────────────────────────
#  AUTH DECORATOR
# ─────────────────────────────────────────────
def login_required(role=None):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            if 'user_id' not in session:
                return jsonify({'error': 'Unauthorized'}), 401
            if role and session.get('role') != role:
                return jsonify({'error': 'Forbidden'}), 403
            return f(*args, **kwargs)
        return wrapper
    return decorator

# ─────────────────────────────────────────────
#  GLOBAL ERROR HANDLER
# ─────────────────────────────────────────────
@app.errorhandler(Exception)
def handle_exception(e):
    traceback.print_exc()
    return jsonify({'error': str(e)}), 500

# ─────────────────────────────────────────────
#  STATIC / HEALTH
# ─────────────────────────────────────────────
@app.route('/')
def index():
    return send_from_directory('templates', 'index.html')

@app.route('/static/<path:path>')
def static_files(path):
    return send_from_directory('static', path)

@app.route('/api/health')
def health():
    try:
        db_query("SELECT 1 AS ok", fetch='one')
        return jsonify({'status': 'ok', 'db': 'connected'})
    except Exception as e:
        return jsonify({'status': 'error', 'db': str(e)}), 500

# ─────────────────────────────────────────────
#  AUTH ROUTES
# ─────────────────────────────────────────────
@app.route('/api/auth/login', methods=['POST'])
def login():
    data     = request.json or {}
    email    = data.get('email', '').strip().lower()
    password = data.get('password', '').strip()

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400
    if not is_valid_email(email):
        return jsonify({'error': 'Please enter a valid email address'}), 400

    user = row_to_dict(db_query(
        "SELECT * FROM managers WHERE LOWER(email)=%s AND password=%s",
        (email, password), fetch='one'))
    role = 'manager'

    if not user:
        user = row_to_dict(db_query(
            "SELECT * FROM employees WHERE LOWER(email)=%s AND password=%s",
            (email, password), fetch='one'))
        role = 'employee'

    if not user:
        return jsonify({'error': 'Invalid email or password'}), 401

    otp = generate_otp(email, purpose='login')
    send_otp_notification(email, otp, purpose='login')

    session['pending_user_id']    = user['id']
    session['pending_user_role']  = role
    session['pending_user_email'] = email

    return jsonify({
        'requires_otp': True,
        'message': f'OTP sent to {email[:3]}***{email.split("@")[1]}',
        'otp_dev': otp
    })

@app.route('/api/auth/verify-otp', methods=['POST'])
def verify_login_otp():
    data  = request.json or {}
    otp   = data.get('otp', '').strip()
    email = session.get('pending_user_email')

    if not email:
        return jsonify({'error': 'No pending login. Please log in again.'}), 400

    ok, msg = verify_otp(email, otp, purpose='login')
    if not ok:
        return jsonify({'error': msg}), 401

    uid  = session.pop('pending_user_id')
    role = session.pop('pending_user_role')
    session.pop('pending_user_email', None)
    session['user_id'] = uid
    session['role']    = role

    if role == 'manager':
        user = row_to_dict(db_query("SELECT * FROM managers WHERE id=%s", (uid,), fetch='one'))
    else:
        user = row_to_dict(db_query("SELECT * FROM employees WHERE id=%s", (uid,), fetch='one'))

    session['name'] = user['name']
    return jsonify({
        'id':         user['id'],
        'name':       user['name'],
        'role':       role,
        'email':      user['email'],
        'department': user.get('department', '')
    })

@app.route('/api/auth/resend-otp', methods=['POST'])
def resend_otp():
    email = session.get('pending_user_email')
    if not email:
        return jsonify({'error': 'No pending login'}), 400
    otp = generate_otp(email, purpose='login')
    send_otp_notification(email, otp, purpose='login')
    return jsonify({'message': 'OTP resent', 'otp_dev': otp})

@app.route('/api/auth/forgot-password', methods=['POST'])
def forgot_password():
    data  = request.json or {}
    email = data.get('email', '').strip().lower()
    if not email:
        return jsonify({'error': 'Email is required'}), 400
    if not is_valid_email(email):
        return jsonify({'error': 'Please enter a valid email address'}), 400

    mgr = db_query("SELECT id FROM managers WHERE LOWER(email)=%s", (email,), fetch='one')
    emp = db_query("SELECT id FROM employees WHERE LOWER(email)=%s", (email,), fetch='one')
    if mgr or emp:
        otp = generate_otp(email, purpose='reset')
        send_otp_notification(email, otp, purpose='reset')
        return jsonify({
            'message': f'Password reset OTP sent to {email[:3]}***{email.split("@")[1]}',
            'otp_dev': otp
        })
    return jsonify({'message': 'If this email exists, an OTP has been sent.'})

@app.route('/api/auth/verify-reset-otp', methods=['POST'])
def verify_reset_otp():
    data  = request.json or {}
    email = data.get('email', '').strip().lower()
    otp   = data.get('otp', '').strip()
    if not email or not otp:
        return jsonify({'error': 'Email and OTP are required'}), 400
    ok, msg = verify_otp(email, otp, purpose='reset')
    if not ok:
        return jsonify({'error': msg}), 401
    session['reset_email']   = email
    session['reset_granted'] = True
    return jsonify({'ok': True})

@app.route('/api/auth/reset-password', methods=['POST'])
def reset_password():
    data      = request.json or {}
    new_pass  = data.get('password', '').strip()
    new_pass2 = data.get('confirm_password', '').strip()
    email     = session.get('reset_email')

    if not session.get('reset_granted') or not email:
        return jsonify({'error': 'Unauthorized. Please complete OTP verification first.'}), 401
    if not new_pass or len(new_pass) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400
    if new_pass != new_pass2:
        return jsonify({'error': 'Passwords do not match'}), 400

    mgr = db_query("SELECT id FROM managers WHERE LOWER(email)=%s", (email,), fetch='one')
    if mgr:
        db_query("UPDATE managers SET password=%s WHERE LOWER(email)=%s", (new_pass, email), fetch=None)
    else:
        db_query("UPDATE employees SET password=%s WHERE LOWER(email)=%s", (new_pass, email), fetch=None)

    session.pop('reset_email', None)
    session.pop('reset_granted', None)
    return jsonify({'ok': True, 'message': 'Password updated successfully'})

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'ok': True})

@app.route('/api/auth/me')
def me():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    uid  = session['user_id']
    role = session['role']
    if role == 'manager':
        user = row_to_dict(db_query("SELECT * FROM managers WHERE id=%s", (uid,), fetch='one'))
        if not user:
            return jsonify({'error': 'User not found'}), 404
        user.pop('password', None)
        user['role'] = 'manager'
    else:
        user = emp_to_api(db_query("SELECT * FROM employees WHERE id=%s", (uid,), fetch='one'))
        if not user:
            return jsonify({'error': 'User not found'}), 404
        user['role'] = 'employee'
    return jsonify(user)

# ─────────────────────────────────────────────
#  MANAGER ROUTES
# ─────────────────────────────────────────────
@app.route('/api/manager/dashboard')
@login_required('manager')
def manager_dashboard():
    mgr_id = session['user_id']
    today  = date.today().isoformat()
    month  = date.today().month

    employees = rows_to_list(db_query(
        "SELECT * FROM employees WHERE manager_id=%s", (mgr_id,)))
    emp_ids = [e['id'] for e in employees]

    if not emp_ids:
        return jsonify({
            'stats': {'total_employees': 0, 'pending_requests': 0,
                      'approved_this_month': 0, 'on_leave_today': 0},
            'recent_leaves': [], 'pending_leaves': [], 'team_status': []
        })

    ph = ','.join(['%s'] * len(emp_ids))
    leaves = rows_to_list(db_query(
        f"SELECT * FROM leaves WHERE employee_id IN ({ph})", emp_ids))
    leaves = [leave_to_api(l) for l in leaves]

    stats = {
        'total_employees':     len(employees),
        'pending_requests':    sum(1 for l in leaves if l['status'] == 'pending'),
        'approved_this_month': sum(1 for l in leaves
            if l['status'] == 'approved' and
               datetime.strptime(l['from_date'], '%Y-%m-%d').month == month),
        'on_leave_today':      sum(1 for l in leaves
            if l['status'] == 'approved' and
               l['from_date'] <= today <= l['to_date'])
    }

    emp_map = {e['id']: e for e in employees}
    for l in leaves:
        l['employee_name'] = emp_map.get(l['employee_id'], {}).get('name', '?')

    recent  = sorted(leaves, key=lambda x: x['applied_on'], reverse=True)[:10]
    pending = [l for l in leaves if l['status'] == 'pending']

    team_status = []
    for e in employees:
        on_leave    = any(l for l in leaves
                          if l['employee_id'] == e['id'] and l['status'] == 'approved'
                          and l['from_date'] <= today <= l['to_date'])
        has_pending = any(l for l in leaves
                          if l['employee_id'] == e['id'] and l['status'] == 'pending')
        team_status.append({
            'id': e['id'], 'name': e['name'], 'position': e['position'],
            'status': 'on_leave' if on_leave else ('pending' if has_pending else 'active')
        })

    return jsonify({'stats': stats, 'recent_leaves': recent,
                    'pending_leaves': pending, 'team_status': team_status})

@app.route('/api/manager/employees', methods=['GET'])
@login_required('manager')
def get_employees():
    mgr_id = session['user_id']
    emps   = db_query("SELECT * FROM employees WHERE manager_id=%s ORDER BY name", (mgr_id,))
    return jsonify([emp_to_api(e) for e in (emps or [])])

@app.route('/api/manager/employees', methods=['POST'])
@login_required('manager')
def create_employee():
    data   = request.json or {}
    mgr_id = session['user_id']
    mgr    = row_to_dict(db_query("SELECT * FROM managers WHERE id=%s", (mgr_id,), fetch='one'))

    required = ['name', 'email', 'password', 'position']
    if any(not data.get(f) for f in required):
        return jsonify({'error': 'Missing required fields'}), 400
    if not is_valid_email(data['email']):
        return jsonify({'error': 'Invalid email address'}), 400

    existing = db_query("SELECT id FROM employees WHERE LOWER(email)=%s",
                        (data['email'].lower(),), fetch='one')
    if existing:
        return jsonify({'error': 'Email already exists'}), 409

    eid = new_id('emp')
    db_query("""INSERT INTO employees
        (id,name,email,phone,password,department,position,manager_id,join_date,
         annual_balance,sick_balance,casual_balance)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
        (eid, data['name'].strip(), data['email'].strip().lower(),
         data.get('phone', ''), data['password'], mgr['department'],
         data['position'].strip(), mgr_id,
         data.get('join_date', date.today().isoformat()),
         int(data.get('annual_days', 15)),
         int(data.get('sick_days', 7)),
         int(data.get('casual_days', 3))), fetch=None)

    emp = db_query("SELECT * FROM employees WHERE id=%s", (eid,), fetch='one')
    return jsonify(emp_to_api(emp)), 201

@app.route('/api/manager/employees/<emp_id>', methods=['DELETE'])
@login_required('manager')
def delete_employee(emp_id):
    mgr_id = session['user_id']
    emp    = db_query("SELECT id FROM employees WHERE id=%s AND manager_id=%s",
                      (emp_id, mgr_id), fetch='one')
    if not emp:
        return jsonify({'error': 'Not found'}), 404
    db_query("DELETE FROM employees WHERE id=%s", (emp_id,), fetch=None)
    return jsonify({'ok': True})

@app.route('/api/manager/employees/<emp_id>', methods=['GET'])
@login_required('manager')
def get_employee_detail(emp_id):
    mgr_id = session['user_id']
    emp    = db_query("SELECT * FROM employees WHERE id=%s AND manager_id=%s",
                      (emp_id, mgr_id), fetch='one')
    if not emp:
        return jsonify({'error': 'Not found'}), 404
    leaves = rows_to_list(db_query(
        "SELECT * FROM leaves WHERE employee_id=%s ORDER BY applied_on DESC", (emp_id,)))
    return jsonify({
        'employee': emp_to_api(emp),
        'leaves':   [leave_to_api(l) for l in leaves]
    })

@app.route('/api/manager/leaves', methods=['GET'])
@login_required('manager')
def manager_leaves():
    mgr_id = session['user_id']
    status = request.args.get('status', '')
    ltype  = request.args.get('type', '')
    q      = request.args.get('q', '').lower()

    sql    = """SELECT l.*, e.name AS employee_name, e.position
                FROM leaves l JOIN employees e ON l.employee_id = e.id
                WHERE l.manager_id = %s"""
    params = [mgr_id]

    if status:
        sql += " AND l.status = %s"; params.append(status)
    if ltype:
        sql += " AND l.type = %s"; params.append(ltype)

    sql += " ORDER BY l.applied_on DESC"
    leaves = rows_to_list(db_query(sql, params))
    result = [leave_to_api(l) for l in leaves]

    if q:
        result = [l for l in result
                  if q in l.get('employee_name', '').lower() or q in l.get('reason', '').lower()]

    return jsonify(result)

@app.route('/api/manager/leaves/<leave_id>/decision', methods=['POST'])
@login_required('manager')
def decide_leave(leave_id):
    mgr_id = session['user_id']
    data   = request.json or {}
    action = data.get('status')
    note   = data.get('manager_note', '')

    if action not in ('approved', 'rejected'):
        return jsonify({'error': 'Invalid action'}), 400

    leave = row_to_dict(db_query(
        "SELECT * FROM leaves WHERE id=%s AND manager_id=%s",
        (leave_id, mgr_id), fetch='one'))
    if not leave:
        return jsonify({'error': 'Leave not found'}), 404
    if leave['status'] != 'pending':
        return jsonify({'error': 'Already decided'}), 409

    db_query("UPDATE leaves SET status=%s, manager_note=%s WHERE id=%s",
             (action, note, leave_id), fetch=None)

    if action == 'approved':
        ltype = leave['type']  # 'annual', 'sick', or 'casual'
        days  = leave['days']
        # Use safe column mapping — no dynamic column names in SQL
        col_map = {
            'annual': ('annual_balance', 'annual_taken'),
            'sick':   ('sick_balance',   'sick_taken'),
            'casual': ('casual_balance', 'casual_taken'),
        }
        if ltype in col_map:
            bal_col, taken_col = col_map[ltype]
            db_query(
                f"UPDATE employees SET {bal_col} = GREATEST(0, {bal_col} - %s), "
                f"{taken_col} = {taken_col} + %s WHERE id=%s",
                (days, days, leave['employee_id']), fetch=None)

    leave['status']       = action
    leave['manager_note'] = note
    return jsonify({'ok': True, 'leave': leave_to_api(leave)})

@app.route('/api/manager/analytics')
@login_required('manager')
def manager_analytics():
    mgr_id = session['user_id']
    emps   = rows_to_list(db_query(
        "SELECT * FROM employees WHERE manager_id=%s", (mgr_id,)))
    leaves = rows_to_list(db_query("""
        SELECT l.*, e.name AS employee_name
        FROM leaves l JOIN employees e ON l.employee_id = e.id
        WHERE l.manager_id=%s AND l.status='approved'""", (mgr_id,)))

    by_type = {'annual': 0, 'sick': 0, 'casual': 0}
    for l in leaves:
        t = l.get('type', '')
        if t in by_type:
            by_type[t] += l['days']

    by_employee = []
    for e in emps:
        days = sum(l['days'] for l in leaves if l['employee_id'] == e['id'])
        by_employee.append({'name': e['name'], 'days': days})
    by_employee.sort(key=lambda x: x['days'], reverse=True)

    by_month = [0] * 12
    for l in leaves:
        m = datetime.strptime(str(l['from_date']), '%Y-%m-%d').month - 1
        by_month[m] += l['days']

    total = sum(by_type.values())
    return jsonify({
        'by_type':          by_type,
        'by_employee':      by_employee,
        'by_month':         by_month,
        'total_days':       total,
        'total_leaves':     len(leaves),
        'avg_per_employee': round(total / len(emps), 1) if emps else 0
    })

@app.route('/api/manager/calendar')
@login_required('manager')
def manager_calendar():
    mgr_id = session['user_id']
    leaves = rows_to_list(db_query("""
        SELECT l.*, e.name AS employee_name
        FROM leaves l JOIN employees e ON l.employee_id = e.id
        WHERE l.manager_id=%s AND l.status IN ('approved','pending')""", (mgr_id,)))
    return jsonify([leave_to_api(l) for l in leaves])

# ─────────────────────────────────────────────
#  EMPLOYEE ROUTES
# ─────────────────────────────────────────────
@app.route('/api/employee/dashboard')
@login_required('employee')
def employee_dashboard():
    emp_id = session['user_id']
    emp    = db_query("SELECT * FROM employees WHERE id=%s", (emp_id,), fetch='one')
    if not emp:
        return jsonify({'error': 'Not found'}), 404

    mgr    = row_to_dict(db_query(
        "SELECT * FROM managers WHERE id=%s", (emp['manager_id'],), fetch='one'))
    leaves = rows_to_list(db_query(
        "SELECT * FROM leaves WHERE employee_id=%s ORDER BY applied_on DESC", (emp_id,)))
    leaves = [leave_to_api(l) for l in leaves]

    return jsonify({
        'employee':     emp_to_api(emp),
        'manager_name': mgr['name'] if mgr else 'N/A',
        'leaves':       leaves,
        'stats': {
            'approved': sum(1 for l in leaves if l['status'] == 'approved'),
            'pending':  sum(1 for l in leaves if l['status'] == 'pending'),
            'rejected': sum(1 for l in leaves if l['status'] == 'rejected'),
        }
    })

@app.route('/api/employee/leaves', methods=['GET'])
@login_required('employee')
def employee_leaves():
    emp_id = session['user_id']
    status = request.args.get('status', '')
    q      = request.args.get('q', '').lower()

    sql    = "SELECT * FROM leaves WHERE employee_id=%s"
    params = [emp_id]
    if status:
        sql += " AND status=%s"; params.append(status)
    sql += " ORDER BY applied_on DESC"

    leaves = [leave_to_api(l) for l in rows_to_list(db_query(sql, params))]
    if q:
        leaves = [l for l in leaves
                  if q in l['reason'].lower() or q in l['type']]
    return jsonify(leaves)

@app.route('/api/employee/leaves', methods=['POST'])
@login_required('employee')
def apply_leave():
    data      = request.json or {}
    emp_id    = session['user_id']
    ltype     = data.get('type', '').strip()
    from_date = data.get('from_date', '').strip()
    to_date   = data.get('to_date', '').strip()
    reason    = data.get('reason', '').strip()

    if not all([ltype, from_date, to_date, reason]):
        return jsonify({'error': 'All fields required'}), 400
    if ltype not in ('annual', 'sick', 'casual'):
        return jsonify({'error': 'Invalid leave type'}), 400
    if from_date > to_date:
        return jsonify({'error': 'End date must be after start date'}), 400

    days = calc_working_days(from_date, to_date)
    if days < 1:
        return jsonify({'error': 'No working days in selected range'}), 400

    emp = row_to_dict(db_query("SELECT * FROM employees WHERE id=%s", (emp_id,), fetch='one'))
    bal_col = f"{ltype}_balance"
    if emp[bal_col] < days:
        return jsonify({'error': f'Insufficient {ltype} leave balance ({emp[bal_col]} days left)'}), 400

    overlap = db_query("""SELECT id FROM leaves
        WHERE employee_id=%s AND status != 'rejected'
        AND NOT (to_date < %s::date OR from_date > %s::date)""",
        (emp_id, from_date, to_date), fetch='one')
    if overlap:
        return jsonify({'error': 'Overlapping leave request exists'}), 409

    lid = new_id('lv')
    db_query("""INSERT INTO leaves
        (id,employee_id,manager_id,type,from_date,to_date,days,reason,status,applied_on,manager_note)
        VALUES (%s,%s,%s,%s,%s::date,%s::date,%s,%s,'pending',CURRENT_DATE,'')""",
        (lid, emp_id, emp['manager_id'], ltype, from_date, to_date, days, reason),
        fetch=None)

    leave = db_query("SELECT * FROM leaves WHERE id=%s", (lid,), fetch='one')
    return jsonify(leave_to_api(leave)), 201

@app.route('/api/employee/leaves/<leave_id>', methods=['DELETE'])
@login_required('employee')
def cancel_leave(leave_id):
    emp_id = session['user_id']
    leave  = db_query("SELECT * FROM leaves WHERE id=%s AND employee_id=%s",
                      (leave_id, emp_id), fetch='one')
    if not leave:
        return jsonify({'error': 'Not found'}), 404
    if leave['status'] != 'pending':
        return jsonify({'error': 'Can only cancel pending requests'}), 409
    db_query("UPDATE leaves SET status='rejected', manager_note='Cancelled by employee' WHERE id=%s",
             (leave_id,), fetch=None)
    return jsonify({'ok': True})

@app.route('/api/employee/profile')
@login_required('employee')
def employee_profile():
    emp_id = session['user_id']
    emp    = db_query("SELECT * FROM employees WHERE id=%s", (emp_id,), fetch='one')
    if not emp:
        return jsonify({'error': 'Not found'}), 404
    mgr    = row_to_dict(db_query(
        "SELECT * FROM managers WHERE id=%s", (emp['manager_id'],), fetch='one'))
    leaves = rows_to_list(db_query(
        "SELECT * FROM leaves WHERE employee_id=%s", (emp_id,)))
    return jsonify({
        'employee':     emp_to_api(emp),
        'manager_name': mgr['name'] if mgr else 'N/A',
        'leave_stats': {
            'total':    len(leaves),
            'approved': sum(1 for l in leaves if l['status'] == 'approved'),
            'pending':  sum(1 for l in leaves if l['status'] == 'pending'),
            'rejected': sum(1 for l in leaves if l['status'] == 'rejected'),
        }
    })

# ─────────────────────────────────────────────
#  AI PROXY (Google Gemini)
# ─────────────────────────────────────────────
def call_groq(messages):
    url = "https://api.groq.com/openai/v1/chat/completions"
    payload = {
        "model": "llama-3.1-8b-instant",
        "messages": messages,
        "max_tokens": 800,
        "temperature": 0.7
    }
    last_err = None
    for attempt in range(3):
        try:
            resp = http_requests.post(
                url,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {GROQ_API_KEY}"
                },
                json=payload,
                timeout=45
            )
            return resp
        except Exception as e:
            last_err = e
            time.sleep(2 * (attempt + 1))
    raise last_err

def extract_groq_text(result):
    # result might be a string if JSON parsing failed
    if isinstance(result, str):
        return None, f"Groq returned unexpected response: {result[:200]}"
    if not isinstance(result, dict):
        return None, "Invalid response from Groq."
    # Check for API error
    error = result.get("error")
    if error:
        if isinstance(error, dict):
            msg = error.get("message", str(error))
        else:
            msg = str(error)
        return None, f"Groq API error: {msg}"
    choices = result.get("choices", [])
    if not choices:
        return None, f"No choices in Groq response: {str(result)[:200]}"
    message = choices[0].get("message")
    if not message:
        return None, "No message in Groq response."
    text = message.get("content", "").strip()
    return (text, None) if text else (None, "Empty content from Groq.")

@app.route("/api/ai/chat", methods=["POST"])
def ai_chat():
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    data     = request.json or {}
    system   = data.get("system", "")
    messages = data.get("messages", [])

    groq_messages = []
    if system:
        groq_messages.append({"role": "system", "content": system})
    for m in messages:
        groq_messages.append({"role": m["role"], "content": m["content"]})

    try:
        resp = call_groq(groq_messages)
        print(f"Groq status: {resp.status_code}, body: {resp.text[:300]}")
        result = resp.json() if resp.headers.get("content-type","").startswith("application/json") else resp.text
        text, err = extract_groq_text(result)
        if err:
            return jsonify({"error": err}), 500
        return jsonify({"reply": text})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/ai/draft", methods=["POST"])
def ai_draft():
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    data = request.json or {}
    groq_messages = [{"role": "user", "content": data.get("prompt", "")}]
    try:
        resp = call_groq(groq_messages)
        print(f"Groq status: {resp.status_code}, body: {resp.text[:300]}")
        result = resp.json() if resp.headers.get("content-type","").startswith("application/json") else resp.text
        text, err = extract_groq_text(result)
        if err:
            return jsonify({"error": err}), 500
        return jsonify({"reply": text})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ─────────────────────────────────────────────
#  STARTUP
# ─────────────────────────────────────────────
try:
    init_db()
    print("✅ Connected to Supabase PostgreSQL")
except Exception as e:
    print(f"❌ Database connection failed: {e}")

if __name__ == '__main__':
    print("\n🏢 LeaveOS → http://localhost:5000\n")
    app.run(debug=False, port=int(os.environ.get('PORT', 5000)))
