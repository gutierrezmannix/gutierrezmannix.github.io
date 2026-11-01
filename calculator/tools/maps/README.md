# Built-in maps: how `src/maps/*.json.gz` are made

These steps need the internet and Node. The regular build (`tools/build.py`) does not need them: it only embeds the
files in `src/maps/`.

1. **Tools.** Install mapshaper in a folder outside the repository (`npm install mapshaper@0.7.101`), and set
   `MAPSHAPER` to its `node_modules/.bin/mapshaper`.
2. **Every country's first level** (geoBoundaries gbOpen ADM1, the simplified files):

   ```sh
   curl -o meta.csv https://raw.githubusercontent.com/wmgeolab/geoBoundaries/main/releaseData/geoBoundariesOpen-meta.csv
   node calculator/tools/maps/fetch-adm1.mjs meta.csv adm1
   ```

   Each country is simplified in proportion to its size. The interval is the country's diagonal divided by 1,400
   (150 m to 8 km). The build then simplified again at the diagonal divided by 750, which is enough for a
   whole-country map 860 px wide. Re-run mapshaper on `adm1/*.topojson` with `-simplify interval=<diag·1000/750>`,
   where the diagonal (in km) is in `adm1/_log.tsv`.
3. **Names in other languages:** Natural Earth admin-1 attributes. Download
   `ne_10m_admin_1_states_provinces.geojson` from `nvkelso/natural-earth-vector` and keep only the properties, as
   `ne1-props.json`.
4. **Mexico (INEGI 2023):** download the 32 state files from `PhantomInsights/mexico-geojson`, folder `2023/states/`.
   Then:

   ```sh
   mapshaper -i states/*.json combine-files -merge-layers force -filter-fields CVEGEO,CVE_ENT,NOMGEO,NOM_ENT -o all.json format=geojson
   mapshaper -i all.json -clean -simplify interval=400 keep-shapes -rename-layers mun -dissolve CVE_ENT copy-fields=NOM_ENT + name=states -o mx.topojson format=topojson quantization=60000 target=*
   ```

5. **Pack:** put `adm1/`, `meta.csv`, `ne1-props.json` and `mx.topojson` in one folder, then run:

   ```sh
   node calculator/tools/maps/pack.mjs <that folder>
   ```

The result is:

| File | Size | What it holds |
|---|---|---|
| `src/maps/adm1.json.gz` | 673 KB | 197 countries, 3,204 areas, 2,856 of them with alternate names |
| `src/maps/mex.json.gz` | 324 KB | 32 states and 2,475 municipalities |
