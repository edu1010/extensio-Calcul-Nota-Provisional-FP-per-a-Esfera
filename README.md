# Càlcul Nota Provisional FP (Esfer@)

Extensió de Chrome (Manifest V3) que calcula la **qualificació provisional (QMP)**
dels mòduls **0223 Aplicacions Ofimàtiques** i **1664 Digitalització aplicada als
sectors productius** a Esfer@, com a mitjana ponderada dels RAs segons la programació.

## Fórmules

**0223 · Aplicacions Ofimàtiques**

```
QMP = 0,05·RA1 + 0,15·RA2 + 0,15·RA3 + 0,15·RA4 + 0,10·RA5
    + 0,10·RA6 + 0,10·RA7 + 0,05·RA8 + 0,05·RA9 + 0,10·EM
```

**1664 · Digitalització aplicada als sectors productius**

```
QMP = 0,12·RA1 + 0,28·RA2 + 0,24·RA3 + 0,24·RA4 + 0,12·RA5
```

## Funcionament

- S'injecta a les pantalles d'avaluació final (per grup/alumne i per grup/matèria).
- Mostra un panell lateral (es pot moure a esquerra o dreta) amb el desglossament
  de cada RA, el seu pes, la nota i l'aportació ponderada.
- Calcula la QMP i la nota arrodonida (1–10), amb un botó **Aplica** que escriu el
  valor al camp *Qualificació provisional*.
- Es recalcula automàticament en canviar les notes o l'alumne.

## Afegir fórmules d'altres assignatures

A més dels dos mòduls de fàbrica, **qualsevol mòdul** que aparegui a la pantalla
es pot configurar:

- Els mòduls sense fórmula es mostren amb un editor per definir-la.
- Els mòduls amb fórmula tenen un botó **✎** per editar-la.

S'escriu com una expressió, amb coma o punt decimal i en qualsevol ordre:

```
QM = RA1*0,1 + RA2*0,2 + RA3*0,2 + RA4*0,2 + RA5*0,2 + EM*0,1
```

L'editor detecta els RAs presents, valida el format i mostra la suma de pesos
(idealment 1). Les fórmules pròpies es desen a `chrome.storage`, tenen prioritat
sobre les de fàbrica i es poden esborrar per tornar a l'estat original.

### Criteri de notes

| Estat del RA | Tractament |
|---|---|
| Assolit-5 … Assolit-10 | Valor numèric 5 … 10 |
| No assolit (NA) | Compta com a **0** (marcat en vermell) |
| En procés / Pendent / PQ / NP / buit | **Pendent** → resultat incomplet, *Aplica* desactivat |

## Instal·lació

1. `chrome://extensions` → activa **Mode de desenvolupador**.
2. **Carrega una extensió sense empaquetar** → selecciona aquesta carpeta.
3. Obre una fitxa d'avaluació a Esfer@; el panell apareix al lateral.

## Fitxers

| Fitxer | Descripció |
|---|---|
| `manifest.json` | Configuració MV3 i patrons d'URL |
| `content.js` | Lògica de càlcul i panell |
| `popup.html` / `popup.js` | Interruptor i fórmules |
