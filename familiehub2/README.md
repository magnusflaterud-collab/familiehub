# 🏠 Familiehub

Familieplanlegger med innlogging, uendelig kalender, oppgaver, middag, kjøleskap, handleliste og chat.

## Prosjektstruktur

```
familiehub/
├── app.py           ← Flask-server og ruter
├── models.py        ← Database (SQLite)
├── requirements.txt
├── instance/
│   └── familie.db   ← Opprettes automatisk
├── static/
│   ├── style.css
│   └── app.js
└── templates/
    ├── base.html
    ├── login.html
    ├── register.html
    ├── dashboard.html
    └── family.html
```

## Oppsett

```bash
# 1. Installer Flask
pip3 install -r requirements.txt

# 2. Start
python3 app.py
```

Åpner http://127.0.0.1:8765 automatisk.

## Brukerroller
- **Forelder** — full tilgang, kan legge til barn og administrere familien
- **Barn** — legges til av forelder, trenger ikke passord

## Invitere familiemedlemmer
1. Gå til **Familie ⚙** øverst
2. Del invitasjonskoden
3. Nye foreldre registrerer seg med koden
