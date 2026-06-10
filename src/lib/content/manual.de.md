SecurityPortal ist ein öffentliches, schreibgeschütztes Portal für CSAF-2.0-Sicherheitshinweise.
Diese Seite erklärt, wie das Portal genutzt wird und wie direkt auf die REST-API zugegriffen werden kann.

---

## Durchsuchen und Filtern

Die Startseite zeigt die zuletzt veröffentlichten Sicherheitshinweise.
Verwenden Sie die Filter-Seitenleiste, um Ergebnisse einzugrenzen:

- **Volltext** — Schlüsselwörter in Titeln, Hinweisen und Produktnamen.
- **CVE-ID** — exakte CVE-Kennung, z. B. `CVE-2024-12345`.
- **CVSS-Score** — Mindest- und/oder Höchstwert des Basisscores (0,0 – 10,0).
- **Veröffentlichungsdatum** — Von-/Bis-Bereich für `current_release_date`.
- **Schweregrad** — Keiner / Niedrig / Mittel / Hoch / Kritisch (aus CVSS-v3-Basisscore abgeleitet).
- **Herausgeber** — Der CSAF-Dokumentherausgeber.
- **Hersteller / Produkt** — Produkt- und Herstellernamen aus dem Produktbaum.
- **Kategorie** — CSAF-Dokumentkategorie (z. B. `csaf_base`, `csaf_security_advisory`).
- **TLP** — Traffic-Light-Protocol-Label.
- **Sprache** — Dokumentsprache.

Alle aktiven Filter werden in der URL-Query-Zeichenkette gespeichert, sodass gefilterte Ansichten als Lesezeichen gespeichert oder geteilt werden können.

Ein Klick auf den Titel eines Sicherheitshinweises öffnet die Detailansicht mit der vollständigen, menschenlesbaren HTML-Darstellung über die CSAF-Webview-Komponente.

---

## REST-API

Die maschinenlesbare REST-API wird unter `/api` bereitgestellt. Eine interaktive OpenAPI-Referenz ist unter **[/api/docs](/api/docs)** verfügbar.

### Basis-URL

Alle Endpunkte sind relativ zum Portal-Root, z. B. `https://example.com/api/advisories`.

---

### Sicherheitshinweise

#### Sicherheitshinweise auflisten

```
GET /api/advisories
```

Gibt die neueste veröffentlichbare Revision jedes Sicherheitshinweises zurück, paginiert.

**Query-Parameter:**

| Parameter   | Typ    | Beschreibung                                            |
| ----------- | ------ | ------------------------------------------------------- |
| `q`         | string | Volltextsuchanfrage                                     |
| `cve`       | string | CVE-ID-Filter (exakt)                                   |
| `severity`  | string | Eines von `none`, `low`, `medium`, `high`, `critical`   |
| `score_min` | float  | Minimaler CVSS-Basisscore                               |
| `score_max` | float  | Maximaler CVSS-Basisscore                               |
| `from`      | date   | Beginn des Veröffentlichungszeitraums (`YYYY-MM-DD`)    |
| `to`        | date   | Ende des Veröffentlichungszeitraums (`YYYY-MM-DD`)      |
| `product`   | string | Produktname-Filter                                      |
| `vendor`    | string | Herstellername-Filter                                   |
| `publisher` | string | Herausgeber-Filter                                      |
| `tlp`       | string | TLP-Label-Filter                                        |
| `category`  | string | CSAF-Dokumentkategorie-Filter                           |
| `lang`      | string | Sprachcode-Filter                                       |
| `limit`     | int    | Seitengröße (Standard 20, max. 100)                     |
| `offset`    | int    | Paginierungs-Offset (max. 10.000)                       |
| `sort`      | string | Sortierfeld; unterstützte Werte: `severity`, `released` |
| `order`     | string | `asc` oder `desc` (Standard `desc`)                     |
| `format`    | string | `json` (Standard) oder `csv`                            |

**Antwort (JSON, Status 200):**

```json
{
  "total": 42,
  "advisories": [
    {
      "id": 1,
      "tracking_id": "PORTAL-2024-001",
      "publisher": "Example Corp",
      "title": "Kritische Sicherheitslücke in Example Software",
      "severity": "critical",
      "cvss_score": 9.8,
      "current_release_date": "2024-06-01T00:00:00Z",
      "initial_release_date": "2024-05-15T00:00:00Z",
      "tlp": "WHITE",
      "category": "csaf_security_advisory",
      "lang": "de",
      "cves": ["CVE-2024-12345"],
      "_links": {
        "self": "/api/advisories/Example%20Corp/PORTAL-2024-001"
      }
    }
  ],
  "_links": {
    "self": "/api/advisories?limit=20&offset=0",
    "first": "/api/advisories?limit=20&offset=0",
    "next": "/api/advisories?limit=20&offset=20"
  }
}
```

---

#### Herausgeber-Sammlung

```
GET /api/advisories/{publisher}
```

Listet Sicherheitshinweise eines bestimmten Herausgebers auf. Akzeptiert die gleichen Query-Parameter wie die globale Liste (außer `publisher`).

Das Segment `{publisher}` wird URL-kodiert; der Wert muss exakt dem Feld `publisher` in den Advisorydaten entsprechen.

---

#### Sicherheitshinweis-Detail (Herausgeber-spezifischer Permalink)

```
GET /api/advisories/{publisher}/{trackingid}
```

Gibt das gespeicherte CSAF-JSON für die neueste veröffentlichbare Revision des Sicherheitshinweises zurück, identifiziert durch `(publisher, tracking_id)`.

Dies ist das **kanonische Permalink**-Format. Die Tracking-ID kann Doppelpunkte und andere URL-sichere Zeichen enthalten (z. B. `RHSA-2024:5101`); kodieren Sie diese beim Erstellen von URLs (`%3A` für `:`).

**Statuscodes:**

| Status   | Bedeutung                                                                 |
| -------- | ------------------------------------------------------------------------- |
| 200      | Sicherheitshinweis gefunden; Inhalt ist das CSAF-JSON-Dokument            |
| 404      | Nicht gefunden oder nicht veröffentlichbar                                |
| 410 Gone | Sicherheitshinweis wurde zurückgezogen; Inhalt ist der Withdrawn-Envelope |

**Withdrawn-Envelope (410):**

```json
{
  "withdrawn": true,
  "tracking_id": "PORTAL-2024-001",
  "withdrawn_at": "2024-07-01T12:00:00Z"
}
```

Ein zurückgezogener Sicherheitshinweis ist nicht mehr veröffentlicht, sein Permalink bleibt aber erhalten und gibt 410 zurück, damit Aufrufer zwischen "nie existiert" (404) und "war veröffentlicht, jetzt zurückgezogen" (410) unterscheiden können.

---

#### Dokumente

```
GET /api/documents/{id}
```

Gibt das gespeicherte CSAF-JSON anhand der internen numerischen Dokument-ID zurück. Dies ist ein interner Endpunkt auf Revisionsebene; bevorzugen Sie den herausgeberspezifischen Permalink für stabile externe Links.

---

### Facetten

```
GET /api/facets
```

Gibt Einzelwerte und Häufigkeiten für jede filterbare Facette zurück und berücksichtigt dabei den aktuell aktiven Filterzustand. Akzeptiert die gleichen Query-Parameter wie die Sicherheitshinweisliste.

**Beispielantwort:**

```json
{
  "severity": [
    { "value": "critical", "count": 5 },
    { "value": "high", "count": 12 }
  ],
  "publisher": [{ "value": "Example Corp", "count": 17 }]
}
```

---

### Atom-Feeds

Das Portal stellt Atom-1.0-Feeds für Feed-Reader bereit.

#### Globaler Feed

```
GET /api/feed.atom
```

Die neuesten veröffentlichbaren, nicht zurückgezogenen Sicherheitshinweise (Standard 25 Einträge, max. 100). Akzeptiert `limit` als Query-Parameter.

#### Herausgeber-spezifischer Feed

```
GET /api/advisories/{publisher}/feed.atom
```

Derselbe Feed, auf einen einzelnen Herausgeber beschränkt.

Feed-Einträge enthalten: kanonische Permalink-ID, Titel, Aktualisierungsdatum, Veröffentlichungsdatum, alternativer Link zur Webdetailseite und eine reinen Text-Zusammenfassung (Titel + CVEs + Schweregrad). Der Freitext der Sicherheitshinweise ist **nicht** im Feed enthalten.

---

### Health

```
GET /api/health
```

Gibt den Gesundheitsstatus des API-Dienstes zurück, einschließlich Datenbankverfügbarkeit und Zeitpunkt des letzten erfolgreichen Ingestionszyklus.

---

## OpenAPI-Referenz

Eine vollständige, maschinenlesbare OpenAPI-3.1-Beschreibung der API ist unter **[/api/openapi.json](/api/openapi.json)** verfügbar.

Ein interaktiver Redoc-Viewer ist unter **[/api/docs](/api/docs)** verfügbar.
