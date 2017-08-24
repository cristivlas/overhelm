const roundPoint = function(p, prec = 10000) {
  p[0] = Math.floor(p[0] * prec)/prec;
  p[1] = Math.floor(p[1] * prec)/prec;
}

const buildLayers = function(resp, viewMaxRes) {
  //console.log(resp)
  charts = [];

  let hMax = null;
  let maxRes = viewMaxRes;

  JSON.parse(resp).map(function(tileset) {
    if (!hMax) {
      hMax = tileset.height; // expect tilesets to be sorted in descending order
    }
    maxRes = Math.ceil((tileset.height * viewMaxRes) / hMax);

    const url = 'tiles/noaa/' + tileset.ident + '/{z}/{x}/{y}';
    const sounding = tileset.sounding ? ' Soundings in ' + tileset.sounding : '';
    const layer = new ol.layer.Tile({
      source: new ol.source.XYZ({
        url: url,
        attributions: tileset.ident.split('_')[0] + sounding,
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
  for (i = charts.length - 1; i >= 0; --i) {
    let layer = charts[i];
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


const getTilesetInfo = function(callback) {
  const url = 'charts/noaa/';
  const xmlHttp = new XMLHttpRequest();

  xmlHttp.onreadystatechange = function() {
    if (xmlHttp.readyState===4) {
      if (xmlHttp.status===200) {
        callback(null, JSON.parse(xmlHttp.responseText));
      }
      else {
        let err = new Error(xmlHttp.responseText);
        err.status = xmlHttp.status;
        callback(err);
      }
    }
  }
  xmlHttp.open('GET', url);
  xmlHttp.send();
}


const getChartsForCoord = function(tilesets, coord, maxRes) {
  console.log(coord)
  //const lon = coord[0];
  //const lat = coord[1];
  let sets = []
  let charts = []
  for (let i = 0; i != tilesets.length; ++i) {
    const t = tilesets[i];
    if (!t.poly) {
      continue;
    }
    let points = []
    t.poly.forEach(function(coord) {
      points.push(ol.proj.fromLonLat([parseFloat(coord[1]), parseFloat(coord[0])]))
    })
    points.push(points[0])
    const poly = new ol.geom.Polygon([points]);
    if (poly.intersectsCoordinate(coord)) { 
    //if (t.lower[0] < lon && t.lower[1] < lat && t.upper[0] > lon && t.upper[1] > lat) {
      sets.push(t);
    }
  }
  sets.sort(function(a, b) {
    if (a.scale < b.scale) return -1;
    if (a.scale > b.scale) return 1;
    return 0;
  });
  const maxScale = sets[sets.length-1].scale;
  for (let i = 1; i != sets.length; ++i) {
    const tileset = sets[i];
    sets[i].maxRes = maxRes * sets[i].scale / maxScale;
    sets[i].minRes = sets[i-1].maxRes;

    const url = 'tiles/noaa/' + tileset.ident + '/{z}/{x}/{y}';
    const sounding = tileset.sounding ? ' Soundings in ' + tileset.sounding : '';
    const layer = new ol.layer.Tile({
      source: new ol.source.XYZ({
        url: url,
        attributions: tileset.ident.split('_')[0] + sounding,
      }),
      minResolution: tileset.minRes,
      maxResolution: tileset.maxRes,
      opacity: .8
    });
    layer.ident = tileset.ident;
    charts.push(layer);
  }
  console.log(JSON.stringify(sets, null, 2))
  return charts;
}


class Location {
  constructor(coord) {
    roundPoint(coord);
    this._coord = coord;
    this._point = ol.proj.fromLonLat(coord);
    this._charts = [];
  }

  equals(coord) {
    roundPoint(coord);
    return this._coord[0]===coord[0] && this._coord[1]===coord[1];
  }

  getCharts(viewMaxRes, callback) {
    if (this._charts.length > 0) {
      return callback();
    }
    const url = 'charts/noaa/loc/' + this._coord[0] + '/' + this._coord[1];
    const self = this;
    const xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function() {
      if (xmlHttp.readyState===4 && xmlHttp.status===200) {
        self._charts = buildLayers(xmlHttp.responseText, viewMaxRes);
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
  SHOW_DESTINATION: 4
}



class Map {
  constructor(opts) {
    this._defaultZoom = opts.defaultZoom || 12;
    this._updating = 0;
    this._recenter = 0;
    this._rotateView = false;
    this._mode = Mode.INSPECT_LOCATION;
    this._lastInteraction = null;
    this._onLocationUpdate = opts.onLocationUpdate;
    this._onUpdateView = opts.onUpdateView;
    this._tilesetInfo = null;

    this._view = new ol.View({
      zoom: this._defaultZoom,
      minZoom: 3,
      maxZoom: 18,
      enableRotation: false,
      center: this._location ? this._location._point : null
    })

    this._view.on('change:center', this._updateView.bind(this, null));
    this._view.on('change:resolution', function() {
      this._updateView(true);
    }.bind(this))
    //this._view.on('change:center', this._updateView2.bind(this, null));

    this._map = new ol.Map({
      target: opts.target,
      layers: [ this._baseLayer() ],
      view: this._view,
      controls: ol.control.defaults({
        rotate: false,
        attributionOptions: {
          collapsible: false,
        }}
      ).extend(opts.controls)
    })
    this._map.on('pointerdrag', this._updateInteraction.bind(this));
    this._map.on('pointermove', this._updateInteraction.bind(this));
  }

  _baseLayer() {
    return new ol.layer.Tile({
      source: new ol.source.XYZ({url:'tiles/wikimedia/osm-intl/{z}/{x}/{y}'})
    })
  }

  _updateInteraction() {
    this._lastInteraction = new Date();
  }

  _updateView2() {
    const center = this._view.getCenter();
    const maxRes = this._view.getMaxResolution();

    if (this._tilesetInfo) {
      const layers = getChartsForCoord(this._tilesetInfo, center, maxRes);
      this._useLayers(layers);
    }
    else {
      self = this
      getTilesetInfo(function(err, result) {
        this._tilesetInfo = result;
        const layers = getChartsForCoord(this._tilesetInfo, center, maxRes);
        self._useLayers(layers);
      }.bind(this))
    }
  }

  _updateView(resolutionChanged) {
    if (this._updating) {
      return;
    }
    
    if (this._recenter > 0) {
      this._recenter--;
    }
    else {
      ++this._updating;
      const extent = this._view.calculateExtent();

      if (!resolutionChanged) {
        if (ol.extent.containsCoordinate(extent, this._location._point)) {
          --this._updating;
          return;
        }
      }

      const minLonLat = ol.proj.transform([extent[0], extent[1]], 'EPSG:3857', 'EPSG:4326');
      const maxLonLat = ol.proj.transform([extent[2], extent[3]], 'EPSG:3857', 'EPSG:4326');
      roundPoint(minLonLat)
      roundPoint(maxLonLat)

      const viewMaxRes = this._view.getMaxResolution();
      const url = 'charts/noaa/ext/' + minLonLat[0] + '/' + minLonLat[1]
          + '/' + maxLonLat[0] + '/' + maxLonLat[1];
 
      const self = this;
      const xmlHttp = new XMLHttpRequest();

      xmlHttp.onreadystatechange = function() {
        if (xmlHttp.readyState===4) {
          if (xmlHttp.status===200) {
            if (self._chartset !== xmlHttp.responseText) {
              self._chartset = xmlHttp.responseText;
              self._useLayers(buildLayers(self._chartset, viewMaxRes));
            }
          }
          --self._updating;
          if (self._onUpdateView) {
            const coord = ol.proj.transform(self._view.getCenter(), 'EPSG:3857', 'EPSG:4326');
            self._onUpdateView({center:coord});
          }
        }
      }
      xmlHttp.open('GET', url);
      xmlHttp.send();
    }
  }


  _showLocation(mode) {
    const self = this;
    self._mode = mode;
    this._location.getCharts(this._view.getMaxResolution(), function() {
      if (self._onLocationUpdate) {
        self._onLocationUpdate(self._location._coord);
      }
      self._useLayers(self._location._charts);
      self._recenter++;
      self._view.setCenter(self._location._point);
    });
    //this._view.setCenter(this._location._point);
    return this._location;
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
    this.updateFeatures();
  }

  updateFeatures() {
    this._updateCourseLayer();
    this._updatePositionLayer();
  }

  _newCourseLayer() {
    if (!this._destLocation || !this._currentLocation) {
      return null;
    }
    const pos = this._currentLocation._point;
    const dest = this._destLocation._point;

    return new ol.layer.Vector({
      source: new ol.source.Vector({
        features: [
          new ol.Feature({
            geometry: new ol.geom.LineString([pos, dest])
          }),
          new ol.Feature({
            geometry: new ol.geom.Point(dest)
          }),
        ]
      }),
      style: new ol.style.Style({
        stroke: new ol.style.Stroke({
          color: '#00D700',
          width: 5
        }),
        image: new ol.style.Icon({
          anchor: [0.5, 1],
          anchorXUnits: 'fraction',
          anchorYUnits: 'fraction',
          src: 'images/pointer.png'
        })
      })
    });
  }

  _updateCourseLayer() {
    if (this._course) {
      this._map.removeLayer(this._course)
    }
    this._course = this._newCourseLayer();
    if (this._course) {
      this._map.addLayer(this._course);
    }
  }

  _updatePositionLayer() {
    if (this._posMarks) {
      this._map.removeLayer(this._posMarks);
    }
    this._posMarks = this._newPosLayer();
    if (this._posMarks) {
      this._map.addLayer(this._posMarks);
    }
  }

  _rotate() {
    let rotation = 0;
    if (this._rotateView) {
      this._view.rotate(2 * Math.PI - geolocation.rotation, this._currentLocation._point);
    }
    else {
      rotation = geolocation.rotation;
    }
    return rotation;
  }

  _newPosLayer() {
    let features = [];

    if (this._currentLocation) {
      const iconCurrentLoc = new ol.Feature({
        geometry: new ol.geom.Point(this._currentLocation._point),
      });
      const iconUrl = 'images/compass4.png';
      const rotation = this._rotate();

      const iconStyle = new ol.style.Style({
        image: new ol.style.Icon({
          anchor: [0.5, 0.5],
          anchorXUnits: 'fraction',
          anchorYUnits: 'fraction',
          src: iconUrl,
          rotateWithView: !this._rotateView,
          rotation: rotation,
        })
      });
      iconCurrentLoc.setStyle(iconStyle);
      features.push(iconCurrentLoc);
    }
    if (this._inspectLocation) {
      const iconInspectLoc = new ol.Feature({
        geometry: new ol.geom.Point(this._inspectLocation._point)
      });
      const iconStyle = new ol.style.Style({
        image: new ol.style.Icon({
          anchor: [0.5, 0.5],
          anchorXUnits: 'fraction',
          anchorYUnits: 'fraction',
          src: 'images/view.png',
          rotateWithView: !this._rotateView,
          rotation: 0,
        })
      });
      iconInspectLoc.setStyle(iconStyle);
      features.push(iconInspectLoc);
    }
    if (features.length===0) {
      return null;
    }
    return new ol.layer.Vector({
      source: new ol.source.Vector({
        features: features
      })
    });
  }

  showCurrentLocation(force) {
    if (force) {
      this._lastInteraction = null;
    }
    else if (this._lastInteraction) {
      const now = new Date();
      if (now.getTime() < this._lastInteraction.getTime() + 60000) {
        return;
      }
    }
    this._location = this._currentLocation;
    return this._showLocation(Mode.CURRENT_LOCATION);
  }
  
  showDestination() {
    this._location = this._destLocation;
    return this._showLocation(Mode.SHOW_DESTINATION);
  }

  showInspectLocation() {
    this._rotateView = false;
    this._view.setRotation(0);
    this._location = this._inspectLocation;
    return this._showLocation(Mode.INSPECT_LOCATION);
  }

  setCurrentLocation(coord) {
    if (!this._currentLocation || !this._currentLocation.equals(coord)) {
      this._currentLocation = new Location(coord);
    }
    return this._currentLocation;
  }

  setInspectLocation(coord) {
    if (!this._inspectLocation || !this._inspectLocation.equals(coord)) {
      this._inspectLocation = new Location(coord);
    }
    return this._inspectLocation;
  }
  
  setDestination(loc) {
    if (!loc) {
      loc = this._inspectLocation;
    }
    this._lastInteraction = null;
    return this._destLocation = loc;
  }

  removeDestination() {
    this._destLocation = null;
    this._lastInteraction = null;
  }

  toggleRotation() {
    this._rotateView ^= true;
    if (!this._rotateView) {
      this._view.setRotation(0);
    }
    return this._rotateView;
  }

  addOverlay(overlay) {
    return this._map.addOverlay(overlay);
  }

  on(event, callback) {
    return this._map.on(event, callback);
  }

  getView() {
    return this._map.getView();
  }

  render() {
    return this._map.render();
  }
}

