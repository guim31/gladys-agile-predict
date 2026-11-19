# Octopus Agile Forecast

Octopus-Agile-Strompreise für die Tage **nach** den veröffentlichten
voraussagen, um Waschmaschine, Warmwasserbereiter, Batterie oder das Laden des
Autos bis zu einer Woche im Voraus zu planen.

Die Prognose stammt von [AgilePredict](https://agilepredict.com), einem
kostenlosen Dienst, der den britischen Day-Ahead-Großhandelspreis per
maschinellem Lernen voraussagt und daraus mit den von Octopus veröffentlichten
Formeln den Agile-Bezugspreis jeder Region berechnet, halbstündlich, bis etwa
eine Woche im Voraus.

Ohne Agile-Vertrag zum Vergleich entwickelt: Rückmeldungen willkommen. Nicht
mit Octopus Energy oder AgilePredict verbunden.

## Überblick

- Ein Gerät pro gewählter Region, zum Beispiel **Agile-Prognose London**: der
  Prognosepreis der laufenden Halbstunde, der mittlere, niedrigste und höchste
  Preis der nächsten 24 Stunden und der nächsten 7 Tage, Beginn und
  Durchschnittspreis des günstigsten Blocks aufeinanderfolgender Stunden, wann
  die Prognose erstellt wurde und wie weit sie reicht.
- Ein Dashboard-Widget: die Prognosekurve der nächsten 2, 4 oder 7 Tage.
- Zwei Szenen-Auslöser: Die günstigsten prognostizierten Stunden beginnen, der
  Prognosepreis fällt unter eine Schwelle.
- Eine Szenen-Aktion: die günstigsten prognostizierten Stunden innerhalb einer
  Frist finden.

Die Preise sind Agile-**Bezugspreise**, **inkl. MwSt.**, ohne Grundgebühr. Das
Gerät zeigt sie in **£/kWh** (Gladys kennt keine Einheit in Pence: 0,2551
bedeutet 25,51 p/kWh); Widget, Auslöser und Szenen-Aktion rechnen in
**p/kWh**.

Das ist eine **Prognose**, nicht die veröffentlichten Preise: Octopus
veröffentlicht die echten Agile-Preise des nächsten Tages gegen 16 Uhr
(britische Zeit). Für diese und für deinen Zähler nutze die
Octopus-Energy-Integration neben dieser: Diese hier ergänzt nur die
folgenden Tage.

## Voraussetzungen

- Gladys Assistant 5.3.0 oder neuer.
- Internetzugang für Gladys: Die Prognose kommt von agilepredict.com. Kein
  Konto, kein Schlüssel.

## Installation

1. Öffne in Gladys **Integrationen → Von GitHub installieren**.
2. Gib `https://github.com/guim31/gladys-agile-predict` ein.
3. Hake in den Einstellungen der Integration deine **Region** an.
4. Öffne den Tab **Entdecken** der Integration und füge das Gerät hinzu.
5. Füge das Widget **Octopus-Agile-Prognose** zu einem Dashboard hinzu.

## Konfiguration

- **Regionen**: die Region deines Zählers, der Buchstabe am Ende deines
  Agile-Tarifcodes (`E-1R-AGILE-24-10-01-C` ist London, C). A bis P sind die
  vierzehn Verteilnetzgebiete, X der Landesdurchschnitt. Ein Gerät pro
  angehakter Region; ist keine angehakt, wartet die Integration und sagt es.
- **Länge des günstigsten Blocks** (30 Minuten bis 8 Stunden, standardmäßig 3
  Stunden) und **Günstigsten Block suchen in** (den nächsten 12 Stunden bis 7
  Tagen, standardmäßig 24 Stunden): der Block, den die Geräte zeigen.
- **Sprache der Funktionsnamen** (standardmäßig Französisch): wird beim
  Hinzufügen des Geräts verwendet; die Namen ändern sich danach nicht mehr.

## Das Prognosegerät

| Funktion                               | Bedeutung                                                    |
| -------------------------------------- | ------------------------------------------------------------ |
| Prognosepreis jetzt (£/kWh)            | der Prognosepreis der laufenden Halbstunde                   |
| Mittel / Tiefst / Höchst nächste 24 h  | über die 48 Halbstunden ab der aktuellen                     |
| Mittel / Tiefst / Höchst nächste 7 Tg. | über die 336 Halbstunden ab der aktuellen                    |
| Beginn des günstigsten Blocks          | Wochentag und Uhrzeit (UK), z. B. `Di. 03:00`                |
| Mittel günstigster Block (£/kWh)       | der mittlere Prognosepreis dieses Blocks                     |
| Prognose erstellt / Prognose bis       | wann AgilePredict sie erstellt hat, und ihr letzter Zeitraum |

Die Uhrzeiten sind britische Zeit (Europe/London), die Uhr der
Agile-Halbstunden.

## Dashboard-Widget

Die Prognosekurve der nächsten 2 oder 4 Tage (eine Stufe pro Halbstunde) oder
7 Tage (eine Stufe pro Stunde: das Dashboard nimmt höchstens 300 Punkte), mit
markiertem niedrigstem und höchstem Zeitraum; drei Kacheln in p/kWh (jetzt,
Mittel der nächsten 24 Stunden und der nächsten 7 Tage); der günstigste Block,
der Prognosezeitpunkt und das Ende der Prognose. Die Einstellung **Region**
wählt die Region (standardmäßig die erste in der Konfiguration angehakte);
Kacheln und Statuszeilen lassen sich ausblenden.

## Szenen-Auslöser

Beide Auslöser haben einen Pflichtfilter **Region** und lösen nur für die in
der Konfiguration angehakten Regionen aus.

### Die günstigsten prognostizierten Stunden beginnen

Löst aus, wenn die günstigste Folge von N aufeinanderfolgenden Stunden (30
Minuten bis 8 Stunden) der nächsten 12, 24 oder 48 Stunden beginnt: Bis zu
diesem Horizont ist nichts Günstigeres prognostiziert. Danach bleibt dieselbe
Wahl still, bis der Horizont vorbei ist: Bei einen ganzen Tag fallenden Preisen
würde der günstigste Block sonst jede halbe Stunde „jetzt“ beginnen. Variablen:
Durchschnittspreis (p/kWh), Beginn und Ende (HH:MM).

### Der Prognosepreis fällt unter eine Schwelle

Löst zu Beginn einer Reihe von Halbstunden unter der Schwelle (0 bis 40 p/kWh)
aus, wenn die Halbstunde davor darüber lag. Variablen: der Preis der
Halbstunde (p/kWh), die Zahl der Stunden unter der Schwelle, Beginn und Ende
(HH:MM).

## Szenen-Aktion

**Günstigste prognostizierte Stunden finden**: in einer Region die günstigste
Folge von N aufeinanderfolgenden Stunden (30 Minuten bis 8 Stunden) ab jetzt,
innerhalb der nächsten 6 Stunden bis 7 Tage. Ausgaben: gefunden, beginnt
jetzt, Startdatum (JJJJ-MM-TT), Beginn und Ende (HH:MM), Durchschnittspreis
(p/kWh), Minuten bis zum Beginn. Eine in der Konfiguration nicht angehakte
Region wird bei Bedarf gelesen. Ohne bekannte Prognose (Quelle nicht
erreichbar) schlägt die Aktion rot fehl.

## Szenen-Beispiele

- **Warmwasserbereiter**: Auslöser „Die günstigsten prognostizierten Stunden
  beginnen“ (Region C, 3 Stunden, nichts Günstigeres in den nächsten 24
  Stunden) → Steckdose des Warmwasserbereiters einschalten; eine zweite Szene
  schaltet sie drei Stunden später aus.
- **Auto laden**: jeden Abend um 20 Uhr Aktion „Günstigste prognostizierte
  Stunden finden“ (Region C, 4 Stunden innerhalb von 48 Stunden) → Nachricht
  „laden am {start_date} um {start_time}“ senden.
- **Negative Preise**: Auslöser „Der Prognosepreis fällt unter eine Schwelle“
  (Region C, 0 p/kWh) → benachrichtigen.

## Aktualisierung und Nutzung der Quelle

Jede genutzte Region wird einmal pro Stunde gelesen (`/api/{Region}?days=8`,
etwa 35 KB). AgilePredict ist ein kostenloser Hobbydienst: Er erlaubt etwa 60
Anfragen pro Minute und Adresse und bittet um sparsames Abfragen, da neue
Prognosen ein paar Mal am Tag kommen. Nach einem Fehler folgen die nächsten
Versuche nach 5, 10, 20, 40 und dann 60 Minuten; die zuletzt gelesene Prognose
bleibt so lange in Gebrauch. Eine vom Widget oder der Szenen-Aktion bei Bedarf
gelesene Region wird 24 Stunden lang weiter gelesen. Prognose von AgilePredict
(agilepredict.com): nenne die Quelle, wenn du ihre Zahlen teilst.

## Fehlerbehebung

- **Die Integration verlangt eine Region**: Hake in ihren Einstellungen
  mindestens eine Region an.
- **Die Integration zeigt einen Fehlerstatus**: Die Prognose ist nicht lesbar
  (AgilePredict seit 2 Stunden nicht erreichbar) oder reicht weniger als einen
  Tag voraus (der Dienst veröffentlicht nicht mehr). Die zuletzt gelesene
  Prognose bleibt in Gebrauch.
- **Kein Zustand am Gerät**: Füge das Gerät über den Tab Entdecken hinzu und
  nutze dann die Aktion **Prognose jetzt lesen**.
- Alle Details in den Protokollen der Integration, mit `LOG_LEVEL=debug`.

## Einschränkungen

- Eine Prognose ist kein Preis: Rechne mit Abweichungen von mehreren Pence,
  mehr für die fernsten Tage oder bei ungewöhnlichem Wetter. Die Website von
  AgilePredict zeigt ihre bisherige Genauigkeit.
- Nur Bezugspreise (keine Agile-Outgoing-Einspeisepreise), inkl. MwSt. zum
  aktuellen Haushaltssatz.
- Die Prognose hängt von einem kostenlosen Hobbydienst ab: Er kann langsamer
  werden oder eingestellt werden.
