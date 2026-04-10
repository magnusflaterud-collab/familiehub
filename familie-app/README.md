# 🏠 Familiehub

Familieplanlegger med kalender, middag, kjøleskap, oppgaver, handleliste og chat.

## Prosjektstruktur

```
familie-app/
├── app.py            ← Flask-server og ruter
├── models.py         ← Datamodeller og JSON-lagring
├── requirements.txt  ← Python-avhengigheter
├── instance/
│   └── familiehub_data.json  ← Data (opprettes automatisk)
├── static/
│   ├── style.css     ← All CSS/styling
│   └── app.js        ← All JavaScript
└── templates/
    └── index.html    ← HTML-mal
```

## Første gangs oppsett

```bash
# 1. Installer Flask
pip3 install -r requirements.txt

# 2. Start programmet
python3 app.py
```

Nettleseren åpner seg automatisk på http://127.0.0.1:8765

Trykk **Ctrl+C** for å avslutte.

## VS Code

Åpne mappen i VS Code → trykk **F5** for å starte med debugger.
