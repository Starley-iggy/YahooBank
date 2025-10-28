"""
server.py
Flask backend for the Yahoo Bank demo app.

Purpose:
- Provides auth (in-memory users), several API endpoints for banking actions,
  the NPC mini-game, scam endpoint, and serves templates/static files.

To run:
1) python -m venv venv
2) venv\Scripts\activate   # on Windows OR: source venv/bin/activate on mac/linux
3) pip install flask werkzeug
4) python server.py
Then open: http://127.0.0.1:5000

Example credentials:
- alex / 1234
- jamie / password
- user / pass

Security note:
This is an INSECURE demo for learning only.
- secret_key is in code, no CSRF protection, passwords and data stored in-memory.
- Do NOT deploy this to production.
"""

from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from werkzeug.security import generate_password_hash, check_password_hash
import random
import time

app = Flask(__name__, static_folder='static', template_folder='templates')
app.secret_key = "demo-secret-key-yahoobank"  # INSECURE — demo only

# ---------- Configurable constants ----------
SCAM_PRINCE_ODDS = 0.05  # 5% chance for the "Nigerian Prince" reward
NPC_REVENGE_ODDS = 0.05  # 5% chance NPC will revenge and steal small amount
NPC_COOLDOWN_SECONDS = 30  # cooldown for failed mini-game attempts
# You can tweak the above constants.

# ---------- In-memory "database" ----------
users = {
    "alex": {
        "password_hash": generate_password_hash("1234"),
        "balance": 2500.00
    },
    "jamie": {
        "password_hash": generate_password_hash("password"),
        "balance": 1200.50
    },
    "user": {
        "password_hash": generate_password_hash("pass"),
        "balance": 100.00
    }
}

npcs = {
    "merchant": {"balance": 50000.0},
    "shopkeeper": {"balance": 8000.0},
    "trader": {"balance": 6000.0},
    "restaurant_owner": {"balance": 12000.0},
    "taxi_driver": {"balance": 3000.0},
    "banker": {"balance": 100000.0},
    "artist": {"balance": 7000.0},
    "random_rich_user": {"balance": 90000000.0},
    "rich_influencer": {"balance": 150000.0},
    "rapper": {"balance": 250000.0},
    "nurse": {"balance": 300.0},
    "teacher": {"balance": 1200.0},
    "kid_with_lemonade_stand": {"balance": 150.0},
    "student": {"balance": 500.0}
}

npc_cooldowns = {key: 0 for key in npcs.keys()}

activities = {}  # track per-user activity totals

# ---------- Helper functions ----------
def format_euro(amount):
    """Format float as Euro string with commas."""
    return "€{:,.2f}".format(amount)

def current_user():
    return session.get("username")

def require_login_json():
    user = current_user()
    if not user:
        return None, (jsonify({"error": "Not authenticated"}), 401)
    return user, None

def ensure_activities_for(user):
    if user not in activities:
        activities[user] = {"sent": 0.0, "spent": 0.0, "scam_losses": 0.0, "invest": 0.0, "bonus": 0.0}

# ---------- Page routes ----------
@app.route("/")
def index():
    if current_user():
        return redirect(url_for('dashboard'))
    return render_template("index.html")

@app.route("/dashboard")
def dashboard():
    if not current_user():
        return redirect(url_for('index'))
    return render_template("dashboard.html")

# ---------- API: Auth ----------
@app.route("/api/login", methods=["POST"])
def api_login():
    payload = request.get_json() or {}
    username = payload.get("username", "").strip().lower()
    password = payload.get("password", "")
    if not username or not password:
        return jsonify({"error": "Missing username or password"}), 400
    if username not in users:
        return jsonify({"error": "Invalid credentials"}), 401
    user_record = users[username]
    if not check_password_hash(user_record["password_hash"], password):
        return jsonify({"error": "Invalid credentials"}), 401
    session["username"] = username
    ensure_activities_for(username)
    return jsonify({"message": f"Logged in as {username}"}), 200

@app.route("/api/logout", methods=["POST"])
def api_logout():
    session.pop("username", None)
    return jsonify({"message": "Logged out"}), 200

# ---------- API: Account ----------
@app.route("/api/account", methods=["GET"])
def api_account():
    user, err = require_login_json()
    if err:
        return err
    balance = users[user]["balance"]
    ensure_activities_for(user)
    return jsonify({
        "username": user,
        "balance": balance,
        "formatted_balance": format_euro(balance),
        "activities": activities[user]
    }), 200

# ---------- API: Banking actions ----------
@app.route("/api/send", methods=["POST"])
def api_send():
    user, err = require_login_json()
    if err:
        return err
    payload = request.get_json() or {}
    to = payload.get("to", "").strip().lower()
    amount = payload.get("amount")
    if not to:
        return jsonify({"error": "Recipient missing"}), 400
    try:
        amount = float(amount)
    except:
        return jsonify({"error": "Invalid amount"}), 400
    users[user]["balance"] -= amount
    if to in users:
        users[to]["balance"] += amount
    ensure_activities_for(user)
    activities[user]["sent"] += amount
    return jsonify({
        "message": f"Sent {format_euro(amount)} to {to}.",
        "balance": users[user]["balance"],
        "formatted_balance": format_euro(users[user]["balance"])
    }), 200

@app.route("/api/spend", methods=["POST"])
def api_spend():
    user, err = require_login_json()
    if err:
        return err
    payload = request.get_json() or {}
    item = payload.get("item", "Unknown")
    cost = payload.get("cost")
    try:
        cost = float(cost)
    except:
        return jsonify({"error": "Invalid cost"}), 400
    users[user]["balance"] -= cost
    ensure_activities_for(user)
    activities[user]["spent"] += cost
    return jsonify({
        "message": f"Bought {item} for {format_euro(cost)}.",
        "balance": users[user]["balance"],
        "formatted_balance": format_euro(users[user]["balance"])
    }), 200

# ---------- API: Invest ----------
@app.route("/api/invest", methods=["POST"])
def api_invest():
    user, err = require_login_json()
    if err:
        return err

    payload = request.get_json() or {}
    try:
        amount = float(payload.get("amount", 0))
    except:
        return jsonify({"error": "Invalid amount"}), 400
    if amount <= 0:
        return jsonify({"error": "Amount must be positive"}), 400

    # DEBUG
    print(f"[INVEST] User: {user}, Current balance: {users[user]['balance']}, Invest amount: {amount}")

    MAX_GAIN_FACTOR = 2.0
    MAX_LOSS_FACTOR = 2.0

    factor = random.uniform(-MAX_LOSS_FACTOR, MAX_GAIN_FACTOR)
    net_change = amount * factor

    users[user]["balance"] += net_change

    ensure_activities_for(user)
    activities[user]["invest"] += net_change

    print(f"[INVEST] Factor: {factor:.2f}, Net change: {net_change:.2f}, New balance: {users[user]['balance']:.2f}")

    if net_change >= 1:
        message = f"Your investment of {format_euro(amount)} gained {format_euro(net_change)} (factor {factor:.2f})."
    else:
        message = f"Your investment of {format_euro(amount)} lost {format_euro(-net_change)} (factor {factor:.2f})."

    return jsonify({
        "success": True,
        "message": message,
        "balance": users[user]["balance"],
        "formatted_balance": format_euro(users[user]["balance"])
    }), 200

# ---------- API: Gov Bonus ----------
@app.route("/api/govbonus", methods=["POST"])
def api_govbonus():
    user, err = require_login_json()
    if err:
        return err
    amount = round(random.uniform(50, 500), 2)
    users[user]["balance"] += amount
    ensure_activities_for(user)
    activities[user]["bonus"] += amount
    return jsonify({
        "message": f"You received a government bonus of {format_euro(amount)}!",
        "amount": amount,
        "balance": users[user]["balance"],
        "formatted_balance": format_euro(users[user]["balance"])
    }), 200

# ---------- API: Scam ----------
@app.route("/api/scam", methods=["POST"])
def api_scam():
    user, err = require_login_json()
    if err:
        return err
    chance = random.random()
    if chance <= SCAM_PRINCE_ODDS:
        reward = 10000.00
        users[user]["balance"] += reward
        ensure_activities_for(user)
        activities[user]["bonus"] += reward
        return jsonify({
            "message": f"The Nigerian Prince blessed your account with {format_euro(reward)}! ",
            "balance": users[user]["balance"],
            "formatted_balance": format_euro(users[user]["balance"]),
            "princed": True
        }), 200
    current = users[user]["balance"]
    percent = random.uniform(0.5, 0.9)
    stolen = round(current * percent, 2)
    users[user]["balance"] -= stolen
    ensure_activities_for(user)
    activities[user]["scam_losses"] += stolen
    return jsonify({
        "message": f"You got scammed and lost {format_euro(stolen)}!",
        "balance": users[user]["balance"],
        "formatted_balance": format_euro(users[user]["balance"]),
        "stolen": stolen
    }), 200

# ---------- API: NPC Mini-game ----------
@app.route("/api/npcs", methods=["GET"])
def api_npcs():
    user, err = require_login_json()
    if err:
        return err
    return jsonify({"npcs": list(npcs.keys())}), 200

@app.route("/api/scam_mini_game", methods=["POST"])
def api_scam_mini_game():
    user, err = require_login_json()
    if err:
        return err
    payload = request.get_json() or {}
    target = payload.get("target")
    success_flag = payload.get("success", False)

    if target not in npcs:
        return jsonify({"error": "Invalid target"}), 400

    now = time.time()
    cooldown_until = npc_cooldowns.get(target, 0)
    if now < cooldown_until:
        remaining = int(cooldown_until - now)
        return jsonify({"error": f"Target under cooldown. Try again in {remaining} seconds."}), 400

    # NPC revenge chance
    revenge_roll = random.random()
    if revenge_roll <= NPC_REVENGE_ODDS:
        revenge_amount = round(random.uniform(100, 1000), 2)
        users[user]["balance"] -= revenge_amount
        ensure_activities_for(user)
        activities[user]["scam_losses"] += revenge_amount
        return jsonify({
            "success": False,
            "message": f"The {target.replace('_',' ')} got suspicious and REVENGED you for {format_euro(revenge_amount)}!",
            "balance": users[user]["balance"],
            "formatted_balance": format_euro(users[user]["balance"])
        }), 200

    if success_flag:
        npc_balance = npcs[target]["balance"]
        pct = random.uniform(0.2, 0.7)
        stolen = round(npc_balance * pct, 2)
        npcs[target]["balance"] -= stolen
        users[user]["balance"] += stolen
        ensure_activities_for(user)
        return jsonify({
            "success": True,
            "message": f"Success! You scammed the {target.replace('_',' ')} for {format_euro(stolen)}.",
            "amount": stolen,
            "balance": users[user]["balance"],
            "formatted_balance": format_euro(users[user]["balance"])
        }), 200
    else:
        player_balance = users[user]["balance"]
        penalty = round(player_balance * 0.9, 2)
        users[user]["balance"] -= penalty
        npc_cooldowns[target] = now + NPC_COOLDOWN_SECONDS
        ensure_activities_for(user)
        activities[user]["scam_losses"] += penalty
        return jsonify({
            "success": False,
            "message": f"Failed attempt! You lost {format_euro(penalty)} and the {target.replace('_',' ')} is on alert for {NPC_COOLDOWN_SECONDS} seconds.",
            "balance": users[user]["balance"],
            "formatted_balance": format_euro(users[user]["balance"]),
            "cooldown_seconds": NPC_COOLDOWN_SECONDS
        }), 200

if __name__ == "__main__":
    print("Starting Yahoo Bank demo app on http://127.0.0.1:5000")
    print("Example logins: alex/1234, jamie/password, user/pass")
    app.run(debug=True)
