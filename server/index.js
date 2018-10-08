var express = require('express');
var router = express.Router();
var request = require('request');
var skolevejConfig = require('../../../config/config.js').extensionConfig.skolevej;
var uri = (typeof skolevejConfig.host !== "undefined" ? skolevejConfig.host + "/api/v2/sql/" : "http://127.0.0.1:3000/api/sql/") + skolevejConfig.db;
var radius = typeof skolevejConfig.radius !== "undefined" ? skolevejConfig.radius: 10000;

router.post('/api/extension/findNearest', function (req, response) {
    var sql, postData;
    var point = req.body.p;
    var code = req.body.komkode;

    sql = "SELECT * FROM " + skolevejConfig.table + " WHERE komkode = '" + code + "'::int AND (the_geom && ST_buffer(ST_Transform(ST_GeometryFromText('POINT(" + point[0] + " " + point[1] + ")', 4326), 25832), " + radius + "))";

    postData = "q=" + encodeURIComponent(sql) + "&srs=4326";

    var options = {
        method: 'POST',
        uri: uri,
        form: postData
    };

    console.log(options);

    request.post(options,
        function (err, res, body) {

            if (res.statusCode !== 200) {
                response.header('content-type', 'application/json');
                response.status(res.statusCode).send({
                    success: false,
                    message: "Could not get the sql data."
                });
                return;
            }

            try {
                JSON.parse(body);
            } catch (e) {
                response.status(500).send({
                    success: false,
                    message: "Could not parse JSON response",
                    data: body
                });
                return;
            }

            response.header('content-type', 'application/json');
            response.header('Cache-Control', 'no-cache, no-store, must-revalidate');
            response.header('Expires', '0');
            response.header('X-Powered-By', 'MapCentia Vidi');

            // Route
            // =====
            var points = JSON.parse(body).features;

            var count = 0, routes = [];

            (function iter() {

                if (count === points.length) {

                    // Send response
                    // =============
                    routes.sort(function (a, b) {
                        return (a.length > b.length) ? 1 : ((b.length > a.length) ? -1 : 0);
                    });

                    response.send(routes);

                } else {

                    var sql = "SELECT seq,gid,name,heading,cost,length,geom::GEOMETRY(Linestring,25832) from pgr_fromAtoB('fot.vejmidte_brudt'," +
                        point[0] + "," +
                        point[1] + "," +
                        points[count].geometry.coordinates[0] + "," +
                        points[count].geometry.coordinates[1] + "," +
                        "'" + code + "'" +
                        ")",

                        options = {
                            method: 'POST',
                            uri: "https://gc2.io/api/v1/sql/dk",
                            form: "q=" + sql + "&srs=4326&lifetime=0&client_encoding=UTF8"
                        };

                    console.log(sql);

                    request(options, function (err, res, body) {

                        if (res.statusCode != 200) {
                            console.log(res);
                            response.header('content-type', 'application/json');
                            response.status(res.statusCode).send({
                                success: false,
                                message: "Could not get the sql data."
                            });
                            return;
                        }

                        var json = JSON.parse(body), length = 0;

                        // Calculate length of route
                        // =========================

                        for (var i = 0; i < json.features.length; i++) {
                            length = length + parseFloat(json.features[i].properties.length);
                        }
                        json.length = length;
                        json.name = points[count].properties.navn;
                        routes.push(json);
                        count++;
                        iter();

                    });

                }
            }());
        })
});

router.post('/api/extension/schools', function (req, response) {
    var sql, postData;
    var code = req.body.q;

    sql = "SELECT * FROM " + skolevejConfig.table + " WHERE komkode = '" + code + "'::int";

    postData = "q=" + encodeURIComponent(sql) + "&srs=4326";

    var options = {
        method: 'POST',
        uri: uri,
        form: postData
    };

    console.log(options);

    request.post(options,
        function (err, res, body) {

            if (res.statusCode !== 200) {
                response.header('content-type', 'application/json');
                response.status(res.statusCode).send({
                    success: false,
                    message: "Could not get the sql data."
                });
                return;
            }

            try {
                JSON.parse(body);
            } catch (e) {
                response.status(500).send({
                    success: false,
                    message: "Could not parse JSON response",
                    data: body
                });
                return;
            }

            response.header('content-type', 'application/json');
            response.header('Cache-Control', 'no-cache, no-store, must-revalidate');
            response.header('Expires', '0');
            response.header('X-Powered-By', 'MapCentia Vidi');

            response.send(JSON.parse(body));
        })
});
module.exports = router;