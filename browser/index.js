/**
 * @fileoverview Description of file, its uses and information
 * about its dependencies.
 */

'use strict';


const MODULE_ID = 'skolevej';

/**
 *
 * @type {*|exports|module.exports}
 */
var cloud;


/**
 *
 * @type {*|exports|module.exports}
 */
var utils;

/**
 *
 * @type {*|exports|module.exports}
 */
var backboneEvents;


/**
 * @type {string}
 */
var db = "geofyn";

/**
 *
 * @type {*|exports|module.exports}
 */
var search = require('./../../../browser/modules/search/danish');

/**
 *
 */
var process;

var clearRoutes;

var cleanUp;

var switchLayer;

var store;

var routeLayers = [];

module.exports = module.exports = {

    /**
     *
     * @param o
     * @returns {exports}
     */
    set: function (o) {
        cloud = o.cloud;
        utils = o.utils;
        backboneEvents = o.backboneEvents;
        return this;
    },

    /**
     *
     */
    init: function () {

        const me = this;

        // Listen to on event
        backboneEvents.get().on(`on:${MODULE_ID}`, function () {
            // Turn info click off
            backboneEvents.get().trigger("off:infoClick");
            console.info("Starting findNearest");
        });

        backboneEvents.get().on(`off:all`, () => {
            // me.off();
            // me.removePointLayer();
            // backboneEvents.get().trigger("clear:search");
            console.info("Stopping findNearest");
        });

        // Listen to process events
        // ========================

        backboneEvents.get().on("start:findNearestProcess", function () {
            $("#findnearest-places i").show();
            console.info("Starting findNearestProcess");
        });

        backboneEvents.get().on("stop:findNearestProcess", function () {
            $("#findnearest-places i").hide();
            console.info("Stopping findNearestProcess");
        });

        $(document).arrive('[data-skolevej-id]', function (e, data) {
            $(this).on("change", function (e) {
                switchLayer($(e.target).data("skolevej-id"), $(e.target).prop(`checked`));
                e.stopPropagation();

            });
        });

        utils.createMainTab(MODULE_ID, "Skoleveje", "Skriv en startadresse i feltet. Trafiksikre veje til kommunens skoler kan derefter vises på kortet, ved at klikke fluebenet til på listen. Strækninger via stier bliver vist med grønt og via vej bliver vist med rødt. Bemærk, at der ikke tages højde for trafikretning. Baseret på GeoDanmark vejmidter.", require('./../../../browser/modules/height')().max, "bi bi-sign-turn-left", false, MODULE_ID);

        // Append to DOM
        //==============

        $(`#${MODULE_ID}`).append(dom);

        // Init search with custom callback
        // ================================

        search.init(function () {
            cloud.get().map.addLayer(this.layer);
            me.addPointLayer(this.layer.toGeoJSON().features["0"].properties.kommunekode);
            process(this.layer.toGeoJSON().features["0"].geometry.coordinates, this.layer.toGeoJSON().features["0"].properties.kommunekode);

        }, "findnearest-custom-search", true);

    },
    addPointLayer: function (code) {
        const id = "_findNearestPoints";

        try {
            this.removePointLayer()
        } catch (e) {
        }

        const iconOptions = {
            icon: 'fa-graduation-cap',
            markerColor: 'green',
            prefix: 'fa'
        }
        store = new geocloud.sqlStore({
            jsonp: false,
            method: "POST",
            host: "",
            db: "",
            uri: "/api/extension/schools",
            clickable: true,
            id: id,
            name: id,
            lifetime: 0,
            base64: false,
            sql: code,
            pointToLayer: function (feature, latlng) {
                return L.marker(latlng, {
                    icon: L.AwesomeMarkers.icon(iconOptions)
                });
            },
            onEachFeature: function (feature, layer) {
                layer._vidi_type = "query_draw";
                layer._vidi_marker = true;
                layer._vidi_awesomemarkers = iconOptions;
                layer.bindPopup(feature.properties['navn']);
            },
            onLoad: function () {
                cloud.get().zoomToExtentOfgeoJsonStore(this);
            }
        });
        // Add the geojson layer to the layercontrol
        cloud.get().addGeoJsonStore(store);
        store.load();
    },

    removePointLayer: function () {
        if (store) {
            store.reset();
        }
    },

    /**
     * Turns conflict off and resets DOM
     */
    off: function () {
        // Clean up
        clearRoutes();
        cleanUp();
    }
};

cleanUp = function () {
    clearRoutes();
    $("#findnearest-result").empty();
};

switchLayer = function (name, visible) {
    if (visible) {
        cloud.get().map.addLayer(cloud.get().getLayersByName(name));
    } else {
        cloud.get().map.removeLayer(cloud.get().getLayersByName(name));
    }
};

/**
 *
 * @param p
 */
process = function (p, code) {
    cleanUp();
    backboneEvents.get().trigger("start:findNearestProcess");

    var xhr = $.ajax({
        method: "POST",
        url: "/api/extension/findNearest",
        data: JSON.stringify({"db": db, "p": p, "komkode": code}),
        dataType: "json",
        scriptCharset: "utf-8",
        contentType: "application/json; charset=utf-8",
        success: function (response) {
            var lg, id;
            $("#findnearest-result").empty();
            backboneEvents.get().trigger("stop:findNearestProcess");
            for (var i = 0; i < response.length; i++) {
                lg = L.geoJson(response[i], {
                    style: function (feature) {
                        return {
                            color: (function getColor(d) {
                                return d === 'Sti' ? '#00ff00' : '#ff0000';
                            }(feature.properties.name)),
                            weight: 5,
                            dashArray: '',
                            opacity: 0.8
                        };
                    },
                    onEachFeature: function (feature, layer) {
                        layer._vidi_type = "query_result";
                        layer.on({
                            mouseover: function () {
                                console.log("HEJ")
                            },
                            mouseout: function () {

                            }
                        });
                    },
                    clickable: true
                });
                id = "_route_" + i;
                lg.id = id;
                routeLayers.push(cloud.get().layerControl.addOverlay(lg, id));
                $("#findnearest-result").append('<div class="form-check"><label class="form-check-label" style="width: calc(100% - 50px);"><input class="form-check-input" type="checkbox" id="' + id + '" data-skolevej-id="' + id + '"><span>' + response[i].name + ' (' + Math.round(response[i].length) + ' m)</span></label></div>')
            }
            console.log(routeLayers);
        },
        error: function () {
            backboneEvents.get().trigger("stop:findNearestProcess");
        }
    })
};

clearRoutes = function () {
    var i, layer;
    for (i = 0; i < routeLayers.length; i++) {
        layer = cloud.get().getLayersByName("_route_" + i);
        cloud.get().map.removeLayer(layer);
        cloud.get().layerControl.removeLayer(layer);
    }
    routeLayers = [];
};


/**
 *
 * @type {string}
 */
var dom =
    `<div role="tabpanel">
        <div id="findnearest-places" class="places" style="position: relative; margin-bottom: 20px;">
            <input id="findnearest-custom-search" class="findnearest-custom-search custom-search typeahead form-control" type="text"
                   placeholder="Adresse">
                <i style="position:absolute;right:8px;top:13px;display:none"
                   class="spinner-border spinner-border-sm text-primary"></i>
        </div>
        <div id="findnearest-result-panel" role="tabpanel">
            <div style="margin-bottom: 10px">
                <span
                    style="display: inline-block; background-color: #00ff00; width: 20px; height: 5px; margin: 2px 5px 2px 2px"></span><span>På sti</span>
                <span
                    style="display: inline-block; background-color: #ff0000; width: 20px; height: 5px; margin: 2px 5px 2px 20px"></span><span>På vej</span>
            </div>
            <div id="findnearest-result">
            </div>
            `;
