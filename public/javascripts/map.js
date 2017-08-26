const roundPoint = function(p, prec = 10000) {
  p[0] = Math.floor(p[0] * prec)/prec;
  p[1] = Math.floor(p[1] * prec)/prec;
}


/**
 * Get all NOAA charts metadata
 */
const getNOAAChartsMeta = function(callback) {
  const url = 'charts/noaa/';
  const xmlHttp = new XMLHttpRequest();

  xmlHttp.onreadystatechange = function() {
    if (xmlHttp.readyState===4) {
      if (xmlHttp.status===200) {
        const charts = JSON.parse(xmlHttp.responseText);
        for (let i = 0; i != charts.length; ++i) {
          let c = charts[i];
          let points = []
          if (!c.poly) {
            let coord = c.lower;
            points.push(ol.proj.fromLonLat([parseFloat(coord[0]), parseFloat(coord[1])]))
            coord = c.upper;
            points.push(ol.proj.fromLonLat([parseFloat(coord[0]), parseFloat(coord[1])]))
          }
          else {
            c.poly.forEach(function(coord) {
              points.push(ol.proj.fromLonLat([parseFloat(coord[1]), parseFloat(coord[0])]))
            })
          }
          points.push(points[0]);
          c.poly = new ol.geom.Polygon([points]);
        }
        callback(null, charts);
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


// compute height as degrees of latitude

const getHeight = function(chart) {
  return Math.abs(chart.upper[1] - chart.lower[1]); 
}

const getCharts = function(tilesets, center) {
  let charts = []
  for (let i = 0; i != tilesets.length; ++i) {
    const t = tilesets[i];
    if (t.poly.intersectsCoordinate(center)) {
      charts.push(t);
    }
  }
  charts.sort(function(a, b) {
    //if (a.scale < b.scale) return -1;
    //if (a.scale > b.scale) return 1;
    const h1 = getHeight(a);
    const h2 = getHeight(b);
    if (h1 < h2) return -1;
    if (h1 > h2) return 1;
    return 0;
  });
  return charts;
}


const makeLayers = function(charts, minRes, maxRes) {
  let layers = []
  if (charts.length===0) {
    return layers;
  }
  const lastChart = charts[charts.length-1];
  const maxHeight = getHeight(lastChart);

  for (let i = 0; i != charts.length; ++i) {
    const tileset = charts[i];
    tileset.minRes = i > 0 ? charts[i-1].maxRes : minRes;
    tileset.maxRes = Math.ceil(maxRes * getHeight(tileset) / maxHeight);

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
    layers.push(layer);
  }
  return layers;
}


class Location {
  constructor(coord) {
    roundPoint(coord);
    this._coord = coord;
    this._point = ol.proj.fromLonLat(coord);
  }

  equals(coord) {
    roundPoint(coord);
    return this._coord[0]===coord[0] && this._coord[1]===coord[1];
  }
}


const Mode = {
  CURRENT_LOCATION: 1,
  INSPECT_LOCATION: 2,
  SHOW_DESTINATION: 4
}


class Map {
  constructor(opts) {
    this._chartsMeta = null;
    this._defaultZoom = opts.defaultZoom || 12;
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

    this._view.on('change:center', this._updateView.bind(this));

    this._map = new ol.Map({
      target: opts.target,
      layers: [ this._baseLayer() ],
      view: this._view,
      controls: ol.control.defaults({
        rotate: false,
        attributionOptions: {
          collapsible: false,
        }}
      ).extend(opts.controls),
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

  _updateView() {
    const center = this._view.getCenter();
    if (this._lastCenter
      && ol.extent.containsCoordinate(this._view.calculateExtent(), this._lastCenter)) {
      return;
    }
    const updateLayers = function(self, charts) {
      self._updating = true;
      self._lastCenter = center;
      const minRes = self._view.getMinResolution();
      const maxRes = self._view.getMaxResolution();
      self._useLayers(makeLayers(charts, minRes, maxRes));

      if (self._onUpdateView) {
        self._onUpdateView();
      }
      self._updating = false;
    } // updateLayers

    if (this._chartsMeta) {
      const charts = getCharts(this._chartsMeta, center);
      updateLayers(this, charts);
    }
    else {
      getNOAAChartsMeta(function(err, result) {
        if (err) {
          throw err;
        }
        this._chartsMeta = result;
        const charts = getCharts(this._chartsMeta, center);
        updateLayers(this, charts);
      }.bind(this))
    }
  }

  _showLocation(mode) {
    this._view.setCenter(this._location._point);

    if (this._onLocationUpdate) {
      this._onLocationUpdate(this._location._coord);
    }
    return this._location;
  }

  _useLayers(charts) {
    if (this._charts) {
      for (let i = 0; i != this._charts.length; ++i) {
        const chart = this._charts[i];
        if (!this._map.removeLayer(chart)) {
          alert('Layer not found');
        }
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
      if (!this._map.removeLayer(this._posMarks)) {
        return;
      }
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

