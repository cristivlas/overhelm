const buildLayers = function(resp, viewMaxRes) {
  charts = [];

  let hMax = null;
  let maxRes = viewMaxRes;

  JSON.parse(resp).map(function(tileset) {
    if (!hMax) {
      hMax = tileset.height;
    }
    maxRes = Math.ceil((tileset.height * viewMaxRes) / hMax);

    const url = 'tiles/noaa/' + tileset.ident + '/{z}/{x}/{y}';
    const sounding = tileset.sounding ? ' Soundings in ' + tileset.sounding : '';
    const layer = new ol.layer.Tile({
      source: new ol.source.XYZ({
        url: url,
        attributions: tileset.ident.split('_')[0] + sounding
      }),
      maxResolution: maxRes,
      opacity: .8
    });
    layer.ident = tileset.ident;
    layer.upper = tileset.upper;
    layer.lower = tileset.lower;

    charts.push(layer);
  })

  let prev = null;
  for (i = app.layers.charts.length - 1; i >= 0; --i) {
    let layer = app.layers.charts[i];
    if (prev) {
      if (layer.getMaxResolution() / prev.getMaxResolution() > 2) {
        layer.setMinResolution(prev.getMaxResolution());
      }
      else {
        layer.setMinResolution(prev.getMinResolution());
      }
    }
    //console.log(i, layer.ident, layer.getMinResolution(), layer.getMaxResolution());
    prev = layer;
  }
  return charts;
}


class Location {
  constructor(coord) {
    this._coord = coord;
    this._point = ol.proj.fromLonLat(coord);
    this._charts = [];
  }

  equals(coord) {
    return this._coord[0]===coord[0] && this._coord[1]===coord[1];
  }

  getCharts(viewMaxRes, callback) {
    if (this._charts.length > 0) {
      return callback();
    }
    const url = 'charts/noaa/loc/' + this._coord[0] + '/' + this._coord[1];
    const loc = this;
    const xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function() {
      if (xmlHttp.readyState===4 && xmlHttp.status===200) {
        loc._charts = buildLayers(xmlHttp.responseText, viewMaxRes);
        callback();
      }
    }
    xmlHttp.open('GET', url);
    xmlHttp.send();
  }
}


const Mode = {
  CURRENT_LOCATION: 1,
  INSPECT_LOCATION: 2,
  SHOW_DESTINATION: 3
}



class Map {
  constructor(opts) {
    this._defaultZoom = 12;
    this._updating = 0;
    this._recenter = 0;
    this._mode = Mode.INSPECT_LOCATION;
    this._location = new Location(opts.coord);

    this._view = new ol.View({
      zoom: this._defaultZoom,
      minZoom: 3,
      maxZoom: 18,
      enableRotation: false,
      center: this._location._point
    })
    this._view.on('change:center', this._updateView.bind(this));
    this._view.on('change:resolution', this._updateView.bind(this));

    this._map = new ol.Map({
      target: opts.target,
      layers: [ this._baseLayer() ],
      view: this._view
    })
  }

  _baseLayer() {
    return new ol.layer.Tile({
      source: new ol.source.XYZ({url:'tiles/wikimedia/osm-intl/{z}/{x}/{y}'})
    })
  }

  _updateView() {
    if (this._updating) {
      return;
    }
    this._updating++;
    if (this._recenter > 0) {
      this._recenter--;  
    }
    else {
      const extent = this._view.calculateExtent();
      const minLonLat = ol.proj.transform([extent[0], extent[1]], 'EPSG:3857', 'EPSG:4326');
      const maxLonLat = ol.proj.transform([extent[2], extent[3]], 'EPSG:3857', 'EPSG:4326');
      const viewMaxRes = this._view.getMaxResolution();
      const map = this;
      const url = 'charts/noaa/ext/' + minLonLat[0] + '/' + minLonLat[1]
          + '/' + maxLonLat[0] + '/' + maxLonLat[1];

      const xmlHttp = new XMLHttpRequest();

      xmlHttp.onreadystatechange = function() {
        if (xmlHttp.readyState===4 && xmlHttp.status===200) {

          if (map._chartset !== xmlHttp.responseText) {
            map._chartset = xmlHttp.responseText;
            map._useLayers(buildLayers(map._chartset, viewMaxRes));
          }
        }
      }
      xmlHttp.open('GET', url);
      xmlHttp.send();
      
    }

    this._updating--;
  }

  _showLocation(mode) {
    this._mode = mode;
    self = this;
    this._location.getCharts(this._view.getMaxResolution(), function() {
      self._useLayers(self._location._charts);
      self._recenter = true;
      self._view.setCenter(self._location._point);
    });
  }

  _useLayers(charts) {
    if (this._charts) {
      for (let i = 0; i != this._charts.length; ++i) {
        const chart = this._charts[i];
        this._map.removeLayer(chart);
      }
    }
    this._charts = charts;
    for (let i = 0; i != this._charts.length; ++i) {
      const chart = this._charts[i];
      this._map.addLayer(chart);
    }
  }

  showCurrentLocation() {
    this._location = this._currentLocation;
    this._showLocation(Mode.CURRENT_LOCATION);
  }
  
  showDestination() {
    this._location = this._destLocation;
    this._showLocation(Mode.SHOW_DESTINATION);
  }

  showInspectLocation() {
    this._location = this._inspectLocation;
    this._showLocation(Mode.INSPECT_LOCATION);
  }

  setCurrentLocation(coord) {
    this._currentLocation = new Location(coord);
  }

  setInspectLocation(coord) {
    this._inspectLocation = new Location(coord);
  }
  
  setDestination(location) {
    this._destLocation = location;
  }

}

