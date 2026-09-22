"""Validate pinned GeoNames downloads and prepare canonical reference data only."""
import hashlib
import json
from pathlib import Path
import unicodedata
import zipfile

repo = Path(__file__).resolve().parent.parent
source = repo / '.wrangler' / 'reference-data' / 'geonames'
target = repo / 'packages' / 'db' / 'reference'
manifest = json.loads((source / 'manifest.json').read_text(encoding='utf-8'))
expected_files = {'cities15000.zip', 'admin1CodesASCII.txt', 'countryInfo.txt', 'iso-languagecodes.txt', 'readme.txt'}
if {entry['name'] for entry in manifest['files']} != expected_files:
    raise ValueError('Unexpected reference-data manifest')
for entry in manifest['files']:
    data = (source / entry['name']).read_bytes()
    if len(data) != entry['bytes'] or hashlib.sha256(data).hexdigest() != entry['sha256']:
        raise ValueError('Reference-data integrity check failed: ' + entry['name'])

def records(name):
    for line in (source / name).read_text(encoding='utf-8-sig').splitlines():
        if line and not line.startswith('#'):
            yield line.split('\t')

countries = []
for row in records('countryInfo.txt'):
    # These two entries describe dissolved countries. XK is an explicit GeoNames extension.
    if row[0] in {'AN', 'CS'}:
        continue
    if len(row) < 9 or len(row[0]) != 2:
        raise ValueError('Invalid country record')
    countries.append({'code': row[0], 'name': row[4], 'continent': row[8]})
country_codes = {row['code'] for row in countries}
admins = {row[0]: row[1] for row in records('admin1CodesASCII.txt') if len(row) >= 2}

def search_name(name):
    return ''.join(char for char in unicodedata.normalize('NFKD', name) if not unicodedata.combining(char)).lower()

cities = []
with zipfile.ZipFile(source / 'cities15000.zip') as archive:
    member = archive.getinfo('cities15000.txt')
    if member.file_size > 64 * 1024 * 1024:
        raise ValueError('Unexpected city dataset size')
    for line in archive.read(member).decode('utf-8').splitlines():
        row = line.split('\t')
        if len(row) != 19:
            raise ValueError('Unexpected city columns')
        if row[8] not in country_codes:
            continue
        latitude, longitude = float(row[4]), float(row[5])
        if not (-90 <= latitude <= 90 and -180 <= longitude <= 180) or not row[17]:
            raise ValueError('Invalid city coordinates or timezone')
        cities.append({'id': int(row[0]), 'name': row[1], 'search_name': search_name(row[2]),
                       'region': admins.get(row[8] + '.' + row[10], ''), 'country_code': row[8],
                       'latitude': latitude, 'longitude': longitude, 'timezone': row[17], 'population': int(row[14])})
if len(countries) < 240 or len(cities) < 20000 or len({row['id'] for row in cities}) != len(cities):
    raise ValueError('Incomplete or duplicate geographic dataset')

languages = {}
for row in records('iso-languagecodes.txt'):
    if len(row) >= 4 and len(row[2]) == 2:
        languages[row[2]] = {'code': row[2], 'name': row[3]}
if len(languages) < 180:
    raise ValueError('Incomplete ISO 639-1 list')

target.mkdir(parents=True, exist_ok=True)
for name, content in [('countries.json', countries), ('cities.json', cities), ('languages-source.json', sorted(languages.values(), key=lambda row: row['code']))]:
    temporary = target / (name + '.partial')
    temporary.write_text(json.dumps(content, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    temporary.replace(target / name)
(target / 'GEONAMES-README.txt').write_bytes((source / 'readme.txt').read_bytes())
(target / 'geonames-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'countries': len(countries), 'cities': len(cities), 'languages': len(languages), 'output': str(target)}))
