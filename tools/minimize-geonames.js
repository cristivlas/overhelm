const geonames = require(__dirname + '/geonames.json');

// blame Canada
const provinces = [
  { code: '01', abbr: 'AB' },  // Alberta
  { code: '02', abbr: 'BC' },  // British Columbia
  { code: '03', abbr: 'MB' },  // Manitoba
  { code: '04', abbr: 'NB' },  // New Brunswick
  { code: '07', abbr: 'NS' },  // Nova Scotia
  { code: '08', abbr: 'ON' },  // Ontario
  { code: '09', abbr: 'PE' },  // Prince Edward Island
  { code: '10', abbr: 'QC' },  // Quebec
  { code: '11', abbr: 'SK' },  // Saskatchewan,
  { code: '12', abbr: 'YT' },  // Yukon Territory
  { code: '13', abbr: 'NT' },  // Northwest Territories
  { code: '14', abbr: 'NU' },  // Nunavut
]

geonames.sort(function(a, b) {
  if (a.state < b.state) {
    return -1;
  }
  if (a.state > b.state) {
    return 1;
  }
  return a.name.localeCompare(b.name);
});

let output = [];

for (let i = 0; i != geonames.length; ) {
  let j = i;
  const g = geonames[i];

  for (; j != geonames.length; ++j) {
    if (g.name !== geonames[j].name) {
      break;
    }
    if (g.state !== geonames[j].state) {
      break;
    }
  }
  let p = provinces.find(function(elem) {
    return elem.code===g.state;
  });
  if (p) {
    g.state = p.abbr;
  }
  output.push({
    name: g.name,
    elevation: g.elevation,
    lat: g.lat,
    lon: g.lon,
    state: g.state,
    code: g.code,
    tz: g.tz
  });
  i = j;
}
console.error(output.length);
console.log(JSON.stringify(output));
