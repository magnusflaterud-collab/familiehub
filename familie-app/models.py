"""
models.py — Datamodeller og lagring for Familiehub
"""

import json
from pathlib import Path

DATA_FILE = Path(__file__).parent / "instance" / "familiehub_data.json"

DEFAULT_DATA = {
    "dinners": [
        {"day": 0, "name": "Taco mandag",      "ingredients": ["tortillas", "kjøttdeig", "ost", "salsa", "rømme"]},
        {"day": 2, "name": "Pasta Bolognese",  "ingredients": ["pasta", "kjøttdeig", "tomater", "løk", "hvitløk"]},
        {"day": 3, "name": "Laks og poteter",  "ingredients": ["laks", "poteter", "sitron", "dill", "smør"]},
        {"day": 5, "name": "Hjemmelaget pizza","ingredients": ["mel", "gjær", "tomatsaus", "mozzarella", "pepperoni"]},
        {"day": 6, "name": "Kyllingsuppe",     "ingredients": ["kylling", "gulrøtter", "selleri", "løk", "nudler"]},
    ],
    "fridgeItems": [
        {"name": "Smør",      "qty": 2,  "unit": "pakker", "section": "fridge"},
        {"name": "Melk",      "qty": 3,  "unit": "liter",  "section": "fridge"},
        {"name": "Egg",       "qty": 10, "unit": "stk",    "section": "fridge"},
        {"name": "Mozzarella","qty": 1,  "unit": "pakker", "section": "fridge"},
        {"name": "Løk",       "qty": 5,  "unit": "stk",    "section": "pantry"},
        {"name": "Hvitløk",   "qty": 8,  "unit": "fedd",   "section": "pantry"},
        {"name": "Pasta",     "qty": 2,  "unit": "pakker", "section": "pantry"},
        {"name": "Tomater",   "qty": 1,  "unit": "boks",   "section": "pantry"},
        {"name": "Kjøttdeig", "qty": 2,  "unit": "pakker", "section": "freezer"},
        {"name": "Kylling",   "qty": 1,  "unit": "pakker", "section": "freezer"},
    ],
    "chores": [
        {"id": 1, "name": "Støvsuge stuen",       "who": "mamma", "day": 0, "pts": 2, "done": False, "doneBy": None},
        {"id": 2, "name": "Vaske badet",          "who": "pappa", "day": 1, "pts": 3, "done": False, "doneBy": None},
        {"id": 3, "name": "Rydde barnerommet",    "who": "Karoline",  "day": 1, "pts": 2, "done": False, "doneBy": None},
        {"id": 4, "name": "Tømme oppvaskmaskinen","who": "Magnus",  "day": 2, "pts": 1, "done": True,  "doneBy": "liam"},
        {"id": 5, "name": "Kaste søppel",         "who": "pappa", "day": 2, "pts": 2, "done": True,  "doneBy": "pappa"},
        {"id": 6, "name": "Handle mat",           "who": "mamma", "day": 5, "pts": 3, "done": False, "doneBy": None},
        {"id": 7, "name": "Klippe plenen",        "who": "pappa", "day": 5, "pts": 5, "done": False, "doneBy": None},
        {"id": 8, "name": "Dekke bordet",         "who": "Kristian",  "day": 3, "pts": 1, "done": False, "doneBy": None},
        {"id": 9, "name": "Brette klesvask",      "who": "emma",  "day": 4, "pts": 2, "done": False, "doneBy": None},
    ],
    "familyEvents": [
        {"id": 1, "title": "Emmas fotballkamp", "date": 18, "month": "Apr",
         "time": "15:00", "place": "Idrettshallen", "type": "sport",
         "who": ["emma", "mamma", "pappa"]},
        {"id": 2, "title": "Bestemor på besøk", "date": 20, "month": "Apr",
         "time": "13:00", "place": "Hjemme", "type": "familie",
         "who": ["mamma", "pappa", "emma", "liam"]},
    ],
    "calExtras":       [{"day": 5, "type": "shop", "title": "Handle mat"}],
    "manualGroceries": [],
    "chatMsgs": [
        {"from": "bot",   "text": "Hei! Skriv 'poengliste' for å se ukens ledertavle, eller spør om middager, handleliste og oppgaver."},
        {"from": "emma",  "text": "Har noen sett den blå hetten min?"},
        {"from": "pappa", "text": "Tror den er i tørketrommelen!"},
    ],
    "choreNextId":  10,
    "eventNextId":  5,
    "currentUser":  "mamma",
}


def load_data() -> dict:
    """Les data fra JSON-fil. Returnerer standarddata hvis filen ikke finnes."""
    if DATA_FILE.exists():
        try:
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    return dict(DEFAULT_DATA)


def save_data(data: dict) -> None:
    """Skriv data til JSON-fil."""
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
