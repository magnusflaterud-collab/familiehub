"""app.py — Familiehub Flask server"""

import threading, webbrowser
from functools import wraps
from flask import Flask, render_template, request, redirect, url_for, session, jsonify, flash
import models

app = Flask(__name__)
app.secret_key = 'fh-change-this-secret-in-production-2026'
models.init_db()

# ── Auth helpers ──────────────────────────────────────────────────────────────
def login_required(f):
    @wraps(f)
    def dec(*a, **kw):
        if 'uid' not in session: return redirect(url_for('login'))
        return f(*a, **kw)
    return dec

def cur_user(): return models.get_user(session['uid']) if 'uid' in session else None
def fid():      u = cur_user(); return u['family_id'] if u else None
def uid():      return session.get('uid')

# ── Pages ─────────────────────────────────────────────────────────────────────
@app.route('/')
def index(): return redirect(url_for('dashboard') if 'uid' in session else url_for('login'))

@app.route('/login', methods=['GET','POST'])
def login():
    if request.method == 'POST':
        u = models.get_user_by_email(request.form.get('email','').strip())
        if u and u['password_hash'] and models.check_pw(request.form.get('password',''), u['password_hash']):
            session['uid'] = u['id']
            return redirect(url_for('dashboard'))
        flash('Feil e-post eller passord','error')
    return render_template('login.html')

@app.route('/register', methods=['GET','POST'])
def register():
    if request.method == 'POST':
        name     = request.form.get('name','').strip()
        email    = request.form.get('email','').strip()
        password = request.form.get('password','')
        action   = request.form.get('action')
        if not all([name, email, password]):
            flash('Fyll inn alle felt','error'); return render_template('register.html')
        if models.get_user_by_email(email):
            flash('E-postadressen er allerede i bruk','error'); return render_template('register.html')
        if action == 'create':
            fn = request.form.get('family_name','').strip()
            if not fn: flash('Fyll inn familienavn','error'); return render_template('register.html')
            family_id, _ = models.create_family(fn)
            color_idx = 0
        elif action == 'join':
            code   = request.form.get('invite_code','').strip()
            family = models.get_family_by_invite(code)
            if not family: flash('Ugyldig invitasjonskode','error'); return render_template('register.html')
            family_id  = family['id']
            color_idx  = models.count_members(family_id)
        else:
            flash('Velg et alternativ','error'); return render_template('register.html')
        session['uid'] = models.create_user(name, email, password, 'parent', family_id, color_idx)
        return redirect(url_for('dashboard'))
    return render_template('register.html')

@app.route('/logout')
def logout(): session.clear(); return redirect(url_for('login'))

@app.route('/dashboard')
@login_required
def dashboard():
    u = cur_user()
    return render_template('dashboard.html',
        user    = u,
        family  = models.get_family(u['family_id']),
        members = models.get_members(u['family_id'])
    )

@app.route('/family')
@login_required
def family_page():
    u = cur_user()
    return render_template('family.html',
        user    = u,
        family  = models.get_family(u['family_id']),
        members = models.get_members(u['family_id'])
    )

@app.route('/family/add-child', methods=['POST'])
@login_required
def add_child():
    u = cur_user()
    if u['role'] != 'parent': flash('Kun foreldre kan legge til barn','error'); return redirect(url_for('family_page'))
    name = request.form.get('name','').strip()
    if name:
        models.add_child(u['family_id'], name, models.count_members(u['family_id']))
        flash(f'{name} er lagt til!','success')
    return redirect(url_for('family_page'))

@app.route('/family/remove/<int:mid>', methods=['POST'])
@login_required
def remove_member(mid):
    u = cur_user()
    if u['role'] == 'parent' and mid != u['id']:
        models.remove_member(mid, u['family_id'])
    return redirect(url_for('family_page'))

@app.route('/family/promote/<int:mid>', methods=['POST'])
@login_required
def promote(mid):
    u = cur_user()
    if u['role'] == 'parent': models.update_role(mid, u['family_id'], 'parent')
    return redirect(url_for('family_page'))

# ── API ───────────────────────────────────────────────────────────────────────
@app.route('/api/calendar')
@login_required
def api_calendar():
    f, t = request.args.get('from',''), request.args.get('to','')
    return jsonify({
        'events':  models.get_events(fid(), f, t),
        'chores':  models.get_chores(fid(), f, t),
        'dinners': models.get_dinners(fid(), f, t),
        'members': models.get_members(fid()),
    })

@app.route('/api/events', methods=['POST'])
@login_required
def api_events_post():
    d = request.get_json()
    i = models.create_event(fid(), d['title'], d['date'], d.get('time',''), d.get('place',''), d.get('type','familie'), d.get('who',[]), uid())
    return jsonify({'id': i})

@app.route('/api/events/<int:eid>', methods=['DELETE'])
@login_required
def api_events_del(eid): models.delete_event(eid, fid()); return jsonify({'ok':True})

@app.route('/api/chores', methods=['GET'])
@login_required
def api_chores_all(): return jsonify(models.get_all_chores(fid()))

@app.route('/api/chores', methods=['POST'])
@login_required
def api_chores_post():
    d = request.get_json()
    i = models.create_chore(fid(), d['name'], d['who_id'], d['date'], d.get('pts',2))
    return jsonify({'id': i})

@app.route('/api/chores/<int:cid>/toggle', methods=['POST'])
@login_required
def api_chores_toggle(cid): models.toggle_chore(cid, fid(), uid()); return jsonify({'ok':True})

@app.route('/api/chores/<int:cid>', methods=['DELETE'])
@login_required
def api_chores_del(cid): models.delete_chore(cid, fid()); return jsonify({'ok':True})

@app.route('/api/dinners', methods=['POST'])
@login_required
def api_dinners_post():
    d = request.get_json()
    i = models.create_dinner(fid(), d['name'], d['date'], d.get('ingredients',[]))
    return jsonify({'id': i})

@app.route('/api/dinners/<int:did>', methods=['DELETE'])
@login_required
def api_dinners_del(did): models.delete_dinner(did, fid()); return jsonify({'ok':True})

@app.route('/api/fridge', methods=['GET'])
@login_required
def api_fridge_get(): return jsonify(models.get_fridge(fid()))

@app.route('/api/fridge', methods=['POST'])
@login_required
def api_fridge_post():
    d = request.get_json()
    i = models.add_fridge(fid(), d['name'], d.get('qty',1), d.get('unit','stk'), d.get('section','fridge'))
    return jsonify({'id': i})

@app.route('/api/fridge/<int:iid>', methods=['PATCH'])
@login_required
def api_fridge_patch(iid):
    models.update_fridge(iid, fid(), request.get_json().get('delta',0))
    return jsonify(models.get_fridge(fid()))

@app.route('/api/fridge/<int:iid>', methods=['DELETE'])
@login_required
def api_fridge_del(iid): models.delete_fridge(iid, fid()); return jsonify({'ok':True})

@app.route('/api/groceries', methods=['GET'])
@login_required
def api_groc_get(): return jsonify(models.get_groceries(fid()))

@app.route('/api/groceries', methods=['POST'])
@login_required
def api_groc_post():
    d = request.get_json()
    i = models.add_grocery(fid(), d['name'])
    return jsonify({'id': i})

@app.route('/api/groceries/<int:gid>/toggle', methods=['POST'])
@login_required
def api_groc_toggle(gid): models.toggle_grocery(gid, fid()); return jsonify({'ok':True})

@app.route('/api/groceries/<int:gid>', methods=['DELETE'])
@login_required
def api_groc_del(gid): models.delete_grocery(gid, fid()); return jsonify({'ok':True})

@app.route('/api/groceries/clear', methods=['POST'])
@login_required
def api_groc_clear(): models.clear_checked(fid()); return jsonify({'ok':True})

@app.route('/api/messages', methods=['GET'])
@login_required
def api_msg_get(): return jsonify(models.get_messages(fid()))

@app.route('/api/messages', methods=['POST'])
@login_required
def api_msg_post():
    d = request.get_json()
    i = models.add_message(fid(), uid(), d['text'])
    return jsonify({'id': i})

# ── Start ─────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    PORT = 8765
    url  = f'http://127.0.0.1:{PORT}'
    print('='*50)
    print(f'  🏠  Familiehub: {url}')
    print('  ✋  Ctrl+C for å avslutte')
    print('='*50)
    threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    app.run(host='127.0.0.1', port=PORT, debug=False)
