# Yahoo Bank — Web Banking Game
<img width="1529" height="344" alt="Yahoobank banner2" src="https://github.com/user-attachments/assets/b3ce01e0-3ffe-4584-8923-82bd1ec93ff9" />


[![Python](https://img.shields.io/badge/Python-3.11-blue?logo=python)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-2.3.2-orange?logo=flask)](https://flask.palletsprojects.com/)
[![GitHub stars](https://img.shields.io/github/stars/Starley/Yahoo-Bank?style=social)](https://github.com/Starley/Yahoo-Bank)



**Yahoo Bank** is een interactieve, educatieve webapplicatie waarmee je het concept van online bankieren en financiële acties kunt leren. Deze demo is volledig in-memory en bedoeld voor leerdoeleinden. **Niet voor productiegebruik.**



---

##  Features

- **Login & Auth**  
  - In-memory gebruikers en hashed wachtwoorden (demo).  
  - Voorbeeldaccounts: `alex/1234`, `jamie/password`, `user/pass`.  

- **Dashboard & Accountbeheer**  
  - Saldo bekijken, activiteiten bijhouden.  
  - Acties: **Send**, **Spend**, **Invest**, **Gov Bonus**.

- **Investering Simulatie**  
  - Investeer en zie hoe het kan **winnen of verliezen**.  
  - Max verlies = 100% van investering; max winst = 100%.  
  - Instelbare factor range in `server.py`.

- **Scam Popups**  
  - Random “Nigerian Prince” events (€10,000 beloning).  
  - Of verlies 50–90% van je saldo.  
  - Popups verschijnen elke 2–4 minuten of via knop.

- **NPC “Scam Others” Mini-game**  
  - Interacteer met NPCs (merchant, banker, etc.)  
  - Simpele math challenges → succes of falen.  
  - 30s cooldown bij mislukte pogingen.  
  - Kans op NPC “revenge” die kleine bedragen steelt.

- **Activity Chart**  
  - Realtime visualisatie via Chart.js.  
  - Transacties: Send, Spend, Invest, Scam, Bonus.

- **Dark Mode & Responsiveness**  
  - Modern, clean design.  
  - Dark mode toggle op login- en dashboardpagina.

 ## Bestand Structuur ##

  ### yahoo bank/
│
├─ server.py # Flask backend

├─ templates/

│ ├─ index.html # Loginpagina

│ └─ dashboard.html # Hoofd-dashboard

├─ static/

│ ├─ style.css # Alle CSS (light/dark mode)

│ └─ script.js # JS logica, API calls, Chart.js

└─ README.md # Dit bestand

## How to Play

Login met een van de voorbeeldaccounts.

Verken de dashboard opties:

Send: stuur geld naar andere gebruikers.

Spend: koop items.

Invest: investeer en zie je balans stijgen of dalen.

Gov Bonus: ontvang een willekeurige bonus tussen €50–€500.

NPC Mini-game: klik een NPC, los de math challenge op, win of verlies geld.

Scam Alert: klik de popup → probeer geluk of verlies geld.

Toggle dark mode met de knop rechtsboven.

## Quick Start / Test Checklist ##
Start server en login als alex/1234.

Stuur geld naar een andere gebruiker → check balans update.

Koop een item → balans verminderd.

Investeer een bedrag → zie winst of verlies.

Klik Gov Bonus → ontvang random bedrag.

NPC mini-game: correct antwoord → win geld; fout → verlies 90% + cooldown.

Scam Alert popup: probeer Send Money → verlies 50–90% of win €10,000.

Toggle Dark Mode → controleer dat het op login en dashboard werkt.

## Configuratie ##

SCAM_PRINCE_ODDS = 0.05       # Kans op €10,000

NPC_REVENGE_ODDS = 0.05       # Kans NPC revenge

NPC_COOLDOWN_SECONDS = 30     # Cooldown voor mini game

MIN_INVEST_FACTOR = 0.0       # Factor: 0 = verlies 100%

MAX_INVEST_FACTOR = 2.0       # Factor: 2 = winst 100%


## Beveiliging / Disclaimer ## 

- In-memory demo geen persistente opslag.
- Demo secret_key, geen CSRF bescherming.
- Geen echte wachtwoorden gebruiken.
- Niet geschikt voor productie.


##  Author

**Starley Igbinomwhaia Briggs** 

fully designed, coded and deployed by me, Starley as a learning project.

