"""
app.py — Familiehub webserver
Kjør: python3 app.py
"""

import threading
import webbrowser
from flask import Flask, jsonify, render_template, request

from models import load_data, save_data

app = Flask(__name__)


# ─── SIDER ────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


# ─── API ──────────────────────────────────────────────────────────────────────

@app.route("/api/data", methods=["GET"])
def get_data():
    return jsonify(load_data())


@app.route("/api/data", methods=["POST"])
def post_data():
    data = request.get_json(force=True)
    save_data(data)
    return jsonify({"ok": True})


# ─── START ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    PORT = 8765
    url = f"http://127.0.0.1:{PORT}"

    print("=" * 50)
    print("  🏠  Familiehub starter...")
    print(f"  📡  Adresse: {url}")
    print("  ✋  Trykk Ctrl+C for å avslutte")
    print("=" * 50)

    threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    app.run(host="127.0.0.1", port=PORT, debug=False)
