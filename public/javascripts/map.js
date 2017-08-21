
const roundPoint = function(p, prec = 10000) {
  p[0] = Math.floor(p[0] * prec)/prec;
  p[1] = Math.floor(p[1] * prec)/prec;
}


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
        attributions: tileset.ident.split('_')[0] + sounding,
        tileLoadFunction: function(imageTile, src) {
          imageTile.getImage().src = src;
        }
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
  INSPECT_LOCATION: 3,
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
    if (self._charts && self._charts.length > 0
      && ol.extent.containsCoordinate(self._view.calculateExtent(), this._location._point)) {
      self._recenter++;
      self._view.setCenter(self._location._point);
      return this._location;
    }
    this._location.getCharts(this._view.getMaxResolution(), function() {
      if (self._onLocationUpdate) {
        self._onLocationUpdate(self._location._coord);
      }
      self._useLayers(self._location._charts);
      self._recenter++;
      self._view.setCenter(self._location._point);
    });
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

