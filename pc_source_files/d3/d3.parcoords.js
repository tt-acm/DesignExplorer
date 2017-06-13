d3.parcoords = function (config) {
    var __ = {
        data: [],
        highlighted: [],
        yscaleDomains: {},
        yscaleTicks: {},
        dimensions: {},
        dimensionTitleRotation: 0,
        brushed: false,
        brushedColor: null,
        alphaOnBrushed: 0.0,
        mode: "default",
        rate: 20,
        width: 600,
        height: 300,
        margin: {
            top: 24,
            right: 0,
            bottom: 12,
            left: 0
        },
        nullValueSeparator: "undefined", // set to "top" or "bottom"
        nullValueSeparatorPadding: {
            top: 8,
            right: 0,
            bottom: 8,
            left: 0
        },
        color: "#069",
        composite: "source-over",
        alpha: 0.7,
        bundlingStrength: 0.5,
        bundleDimension: null,
        smoothness: 0.0,
        showControlPoints: false,
        hideAxis: [],
        flipAxes: [],
        animationTime: 300 // How long it takes to flip the axis when you double click
    };

    __.chartSize=[__.width,__.height]; 

    extend(__, config);

    if (config && config.dimensionTitles) {
        console.warn("dimensionTitles passed in config is deprecated. Add title to dimension object.");
        d3.entries(config.dimensionTitles).forEach(function (d) {
            if (__.dimensions[d.key]) {
                __.dimensions[d.key].title = __.dimensions[d.key].title ? __.dimensions[d.key].title : d.value;
            } else {
                __.dimensions[d.key] = {
                    title: d.value
                };
            }
        });
    }
    var pc = function (selection) {
        selection = pc.selection = d3.select(selection);

        __.width = selection[0][0].clientWidth;
        __.height = selection[0][0].clientHeight;

        // canvas data layers
        ["marks", "foreground", "brushed", "highlight"].forEach(function (layer) {
            canvas[layer] = selection
                .append("canvas")
                .attr("class", layer)[0][0];
            ctx[layer] = canvas[layer].getContext("2d");
        });

        // svg tick and brush layers
        pc.svg = selection
            .append("svg")
            .attr("width", __.width)
            .attr("height", __.height)
            .append("svg:g")
            .attr("transform", "translate(" + __.margin.left + "," + __.margin.top + ")");

        return pc;
    };
    var events = d3.dispatch.apply(this, ["render", "resize", "highlight", "brush", "brushend", "brushstart", "axesreorder"].concat(d3.keys(__))),
        w = function () {
            return __.width - __.margin.right - __.margin.left;
        },
        h = function () {
            return __.height - __.margin.top - __.margin.bottom;
        },
        flags = {
            brushable: false,
            reorderable: false,
            axes: false,
            interactive: false,
            debug: false
        },
        xscale = d3.scale.ordinal(),
        dragging = {},
        line = d3.svg.line(),
        axis = d3.svg.axis().orient("left").ticks(5),
        g, // groups for axes, brushes
        ctx = {},
        canvas = {},
        clusterCentroids = [];

    // side effects for setters
    var side_effects = d3.dispatch.apply(this, d3.keys(__))
        .on("composite", function (d) {
            ctx.foreground.globalCompositeOperation = d.value;
            ctx.brushed.globalCompositeOperation = d.value;
        })
        .on("alpha", function (d) {
            ctx.foreground.globalAlpha = d.value;
            ctx.brushed.globalAlpha = d.value;
        })
        .on("brushedColor", function (d) {
            ctx.brushed.strokeStyle = d.value;
        })
        .on("width", function (d) {
            pc.resize();
            //pc.reRender();
        })
        .on("height", function (d) {
            pc.resize();
            //pc.reRender();
        })
        .on("chartSize", function (d) {
            __.width = d.value[0];
            __.height = d.value[1];
            // pc.resize();
            // console.log(d.value);
            pc.resize();
            //pc.reRender();
            //pc.reRender();
        })
        .on("margin", function (d) {
            pc.resize();
        })
        .on("rate", function (d) {
            brushedQueue.rate(d.value);
            foregroundQueue.rate(d.value);
        })
        .on("dimensions", function (d) {
            __.dimensions = pc.applyDimensionDefaults(d3.keys(d.value));
            //console.log(__.dimensions);
            xscale.domain(pc.getOrderedDimensionKeys());
            pc.sortDimensions();
            if (flags.interactive) {
                pc.render().updateAxes();
            }
        })
        .on("bundleDimension", function (d) {
            if (!d3.keys(__.dimensions).length) pc.detectDimensions();
            pc.autoscale();
            if (typeof d.value === "number") {
                if (d.value < d3.keys(__.dimensions).length) {
                    __.bundleDimension = __.dimensions[d.value];
                } else if (d.value < __.hideAxis.length) {
                    __.bundleDimension = __.hideAxis[d.value];
                }
            } else {
                __.bundleDimension = d.value;
            }

            __.clusterCentroids = compute_cluster_centroids(__.bundleDimension);
            if (flags.interactive) {
                pc.render();
            }
        })
        .on("hideAxis", function (d) {
            pc.dimensions(pc.applyDimensionDefaults());
            pc.dimensions(without(__.dimensions, d.value));
        })
        .on("flipAxes", function (d) {

            if (d.value && d.value.length) {
                d.value.forEach(function (axis) {
                    //console.log(axis);
                    flipAxisAndUpdatePCP(axis);
                });
                //pc.updateAxes(0);
            }
        });

    // expose the state of the chart
    pc.state = __;
    pc.flags = flags;

    // create getter/setters
    getset(pc, __, events);

    // expose events
    d3.rebind(pc, events, "on");

    // getter/setter with event firing
    function getset(obj, state, events) {
        d3.keys(state).forEach(function (key) {
            obj[key] = function (x) {
                if (!arguments.length) {
                    return state[key];
                }
                if (key === 'dimensions' && Object.prototype.toString.call(x) === '[object Array]') {
                    console.warn("pc.dimensions([]) is deprecated, use pc.dimensions({})");
                    x = pc.applyDimensionDefaults(x);
                }
                var old = state[key];
                state[key] = x;
                side_effects[key].call(pc, {
                    "value": x,
                    "previous": old
                });
                events[key].call(pc, {
                    "value": x,
                    "previous": old
                });
                return obj;
            };
        });
    }

    function extend(target, source) {
        for (var key in source) {
            target[key] = source[key];
        }
        return target;
    }

    function without(arr, items) {
        items.forEach(function (el) {
            delete arr[el];
        });
        return arr;
    }
    /** adjusts an axis' default range [h()+1, 1] if a NullValueSeparator is set */
    function getRange() {
        if (__.nullValueSeparator == "bottom") {
            return [h() + 1 - __.nullValueSeparatorPadding.bottom - __.nullValueSeparatorPadding.top, 1];
        } else if (__.nullValueSeparator == "top") {
            return [h() + 1, 1 + __.nullValueSeparatorPadding.bottom + __.nullValueSeparatorPadding.top];
        }
        return [h() + 1, 1];
    }

    pc.autoscale = function () {
        // yscale
        var defaultScales = {
            "date": function (k) {
                var counts = {};
                var extent = d3.extent(__.data, function (d) {
                    counts[d[k]] ++;
                    return d[k] ? d[k].getTime() : null;
                });

                var tickKeys = Object.keys(counts);
                __.yscaleTicks[k] = {name:k, namewithnospace:k, originalTickValues:tickKeys, tickValues:tickKeys};

                // special case if single value
                if (extent[0] === extent[1]) {
                    return d3.scale.ordinal()
                        .domain([extent[0]])
                        .rangePoints(getRange());
                }
                
                if (__.yscaleDomains[k] !== undefined) {
                    extent = __.yscaleDomains[k];
                }

                return d3.time.scale()
                    .domain(extent)
                    .range(getRange());
            },
            "number": function (k) {
                var counts = {};

                var extent = d3.extent(__.data, function (d) {
                    counts[d[k]] ++;
                    return +d[k];
                });

                var tickKeys = Object.keys(counts);
                __.yscaleTicks[k] = {name:k, namewithnospace:k, originalTickValues:tickKeys, tickValues:tickKeys};

                if (k == "Rating") {
                    extent = [0, 5];
                }

                // special case if single value
                if (extent[0] === extent[1]) {
                    return d3.scale.ordinal()
                        .domain([extent[0]])
                        .rangePoints(getRange());
                }

                if (__.yscaleDomains[k] !== undefined) { //yscalDomains is set by user or flipped
                    extent = __.yscaleDomains[k];
                    //console.log(extent);
                }

                return d3.scale.linear()
                    .domain(extent)
                    .range(getRange());
            },
            "string": function (k) {


                var counts = {},
                    domain = [];

                // Let's get the count for each value so that we can sort the domain based
                // on the number of items for each value.
                __.data.map(function (p) {
                    if (p[k] === undefined && __.nullValueSeparator !== "undefined") {
                        return; // null values will be drawn beyond the horizontal null value separator!
                    }
                    if (counts[p[k]] === undefined) {
                        counts[p[k]] = 1;
                        domain.push(p[k])
                    } else {
                        counts[p[k]] = counts[p[k]] + 1;
                    }
                });

                if (__.yscaleDomains[k] === undefined) {
                    __.yscaleDomains[k] = domain;
                    //console.log(domain);
                }


                
                __.yscaleTicks[k] = domain;

                return d3.scale.ordinal()
                    .domain(__.yscaleDomains[k])
                    .rangePoints(getRange());
            }
        };


        d3.keys(__.dimensions).forEach(function (k) {
            // if (!__.dimensions[k].yscale){
            __.dimensions[k].yscale = defaultScales[__.dimensions[k].type](k);
            // }
        });

        // xscale
        xscale.rangePoints([0, w()], 1);

        // Retina display, etc.
        var devicePixelRatio = window.devicePixelRatio || 1;

        // canvas sizes
        pc.selection.selectAll("canvas")
            .style("margin-top", __.margin.top + "px")
            .style("margin-left", __.margin.left + "px")
            .style("width", (w() + 2) + "px")
            .style("height", (h() + 2) + "px")
            .attr("width", (w() + 2) * devicePixelRatio)
            .attr("height", (h() + 2) * devicePixelRatio);

        // default styles, needs to be set when canvas width changes
        ctx.foreground.strokeStyle = __.color;
        ctx.foreground.lineWidth = 1.2;
        ctx.foreground.globalCompositeOperation = __.composite;
        ctx.foreground.globalAlpha = __.alpha;
        ctx.foreground.scale(devicePixelRatio, devicePixelRatio);
        ctx.brushed.strokeStyle = __.brushedColor;
        ctx.brushed.lineWidth = 1.2;
        ctx.brushed.globalCompositeOperation = __.composite;
        ctx.brushed.globalAlpha = __.alpha;
        ctx.brushed.scale(devicePixelRatio, devicePixelRatio);
        ctx.highlight.lineWidth = 4;
        ctx.highlight.scale(devicePixelRatio, devicePixelRatio);

        return this;
    };

    pc.scale = function (d, domain) {
        __.dimensions[d].yscale.domain(domain);
        return this;
    };

    pc.flip = function (d) {
        //__.dimensions[d].yscale.domain().reverse();                               // does not work

        if (__.dimensions[d].type != "string") {
            var flippedDomain = __.dimensions[d].yscale.domain().reverse();

            __.dimensions[d].yscale.domain(flippedDomain); // works
            __.yscaleDomains[d] = flippedDomain;

        } else {
            console.log(__.dimensions[d].yscale.domain());
        }


        return this;
    };

    pc.commonScale = function (global, type) {
        var t = type || "number";
        if (typeof global === 'undefined') {
            global = true;
        }

        // try to autodetect dimensions and create scales
        if (!d3.keys(__.dimensions).length) {
            pc.detectDimensions();
        }
        pc.autoscale();

        // scales of the same type
        var scales = d3.keys(__.dimensions).filter(function (p) {
            return __.dimensions[p].type == t;
        });

        if (global) {
            var extent = d3.extent(scales.map(function (d, i) {
                return __.dimensions[d].yscale.domain();
            }).reduce(function (a, b) {
                return a.concat(b);
            }));

            scales.forEach(function (d) {
                __.dimensions[d].yscale.domain(extent);
            });

        } else {
            scales.forEach(function (d) {
                __.dimensions[d].yscale.domain(d3.extent(__.data, function (d) {
                    return +d[k];
                }));
            });
        }

        // update centroids
        if (__.bundleDimension !== null) {
            pc.bundleDimension(__.bundleDimension);
        }

        return this;
    };
    pc.detectDimensions = function () {
        pc.dimensions(pc.applyDimensionDefaults());
        return this;
    };

    pc.applyDimensionDefaults = function (dims) {
        var types = pc.detectDimensionTypes(__.data);
        dims = dims ? dims : d3.keys(types);
        var newDims = {};
        var currIndex = 0;
        dims.forEach(function (k) {
            newDims[k] = __.dimensions[k] ? __.dimensions[k] : {};
            //Set up defaults
            newDims[k].index = newDims[k].index != null ? newDims[k].index : currIndex;
            newDims[k].orient = newDims[k].orient ? newDims[k].orient : 'left';
            newDims[k].ticks = newDims[k].ticks != null ? newDims[k].ticks : 5;
            newDims[k].innerTickSize = newDims[k].innerTickSize != null ? newDims[k].innerTickSize : 6;
            newDims[k].outerTickSize = newDims[k].outerTickSize != null ? newDims[k].outerTickSize : 0;
            newDims[k].tickPadding = newDims[k].tickPadding != null ? newDims[k].tickPadding : 3;
            newDims[k].type = newDims[k].type ? newDims[k].type : types[k];

            
            //newDims[k].yscale.domain //domain is setted by autoscale
            
            currIndex++;
        });
        //console.log(newDims);
        return newDims;
    };

    pc.getOrderedDimensionKeys = function () {
        return d3.keys(__.dimensions).sort(function (x, y) {
            return d3.ascending(__.dimensions[x].index, __.dimensions[y].index);
        });
    };

    // a better "typeof" from this post: http://stackoverflow.com/questions/7390426/better-way-to-get-type-of-a-javascript-variable
    pc.toType = function (v) {
        return ({}).toString.call(v).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
    };

    // try to coerce to number before returning type
    pc.toTypeCoerceNumbers = function (v) {
        if ((parseFloat(v) == v) && (v != null)) {
            return "number";
        }
        return pc.toType(v);
    };

    // attempt to determine types of each dimension based on first row of data
    pc.detectDimensionTypes = function (data) {
        var types = {};
        d3.keys(data[0])
            .forEach(function (col) {
                types[isNaN(Number(col)) ? col : parseInt(col)] = pc.toTypeCoerceNumbers(data[0][col]);
            });
        return types;
    };
    pc.render = function () {
        //console.log("rended");
        // try to autodetect dimensions and create scales
        if (!d3.keys(__.dimensions).length) {
            pc.detectDimensions();
        }
        pc.autoscale();

        pc.render[__.mode]();

        events.render.call(this);
        return this;
    };

    pc.reRender = function () {
        //console.log("rended");
        // try to autodetect dimensions and create scales
        if (!d3.keys(__.dimensions).length) {
            pc.detectDimensions();
        }
        var highlightedData = pc.highlighted();

        

        //pc.autoscale();
        pc.updateAxes();

        pc.render[__.mode]();

        events.render.call(this);

        if (highlightedData.length > 0) {
            pc.highlight(highlightedData);
        }
        return this;
    };

    pc.renderBrushed = function () {
        if (!d3.keys(__.dimensions).length) pc.detectDimensions();

        pc.renderBrushed[__.mode]();

        events.render.call(this);
        return this;
    };

    function isBrushed() {
        if (__.brushed && __.brushed.length !== __.data.length)
            return true;

        var object = brush.currentMode().brushState();

        for (var key in object) {
            if (object.hasOwnProperty(key)) {
                return true;
            }
        }
        return false;
    }

    pc.render.default = function () {
        pc.clear('foreground');
        pc.clear('highlight');

        pc.renderBrushed.default();

        __.data.forEach(path_foreground);
    };

    var foregroundQueue = d3.renderQueue(path_foreground)
        .rate(50)
        .clear(function () {
            pc.clear('foreground');
            pc.clear('highlight');
        });

    pc.render.queue = function () {
        pc.renderBrushed.queue();

        foregroundQueue(__.data);
    };

    pc.renderBrushed.default = function () {
        pc.clear('brushed');

        if (isBrushed()) {
            __.brushed.forEach(path_brushed);
        } else {
            __.brushed = false;
            d3.select("canvas.foreground").classed("hidden", false);
        }


        if (typeof (__.highlighted[0]) == "object") {
            //console.log(__.highlighted.length);
            d3.select("canvas.brushed").classed("faded", true);
        } else {
            d3.select("canvas.brushed").classed("faded", false);
        }

    };

    var brushedQueue = d3.renderQueue(path_brushed)
        .rate(50)
        .clear(function () {
            pc.clear('brushed');
        });

    pc.renderBrushed.queue = function () {
        if (isBrushed()) {
            d3.select("canvas.foreground").classed("hidden", true);
            brushedQueue(__.brushed);
        } else {
            brushedQueue([]); // This is needed to clear the currently brushed items
            d3.select("canvas.foreground").classed("hidden", false);
            __.brushed = false;
        }



        if (typeof (__.highlighted[0]) == "object") {
            //console.log(__.highlighted.length);
            d3.select("canvas.brushed").classed("faded", true);
        } else {
            d3.select("canvas.brushed").classed("faded", false);
        }


    };

    function compute_cluster_centroids(d) {

        var clusterCentroids = d3.map();
        var clusterCounts = d3.map();
        // determine clusterCounts
        __.data.forEach(function (row) {
            var scaled = __.dimensions[d].yscale(row[d]);
            if (!clusterCounts.has(scaled)) {
                clusterCounts.set(scaled, 0);
            }
            var count = clusterCounts.get(scaled);
            clusterCounts.set(scaled, count + 1);
        });

        __.data.forEach(function (row) {
            d3.keys(__.dimensions).map(function (p, i) {
                var scaled = __.dimensions[d].yscale(row[d]);
                if (!clusterCentroids.has(scaled)) {
                    var map = d3.map();
                    clusterCentroids.set(scaled, map);
                }
                if (!clusterCentroids.get(scaled).has(p)) {
                    clusterCentroids.get(scaled).set(p, 0);
                }
                var value = clusterCentroids.get(scaled).get(p);
                value += __.dimensions[p].yscale(row[p]) / clusterCounts.get(scaled);
                clusterCentroids.get(scaled).set(p, value);
            });
        });

        return clusterCentroids;

    }

    function compute_centroids(row) {
        var centroids = [];

        var p = d3.keys(__.dimensions);
        var cols = p.length;
        var a = 0.5; // center between axes
        for (var i = 0; i < cols; ++i) {
            // centroids on 'real' axes
            var x = position(p[i]);
            var y = __.dimensions[p[i]].yscale(row[p[i]]);
            centroids.push($V([x, y]));

            // centroids on 'virtual' axes
            if (i < cols - 1) {
                var cx = x + a * (position(p[i + 1]) - x);
                var cy = y + a * (__.dimensions[p[i + 1]].yscale(row[p[i + 1]]) - y);
                if (__.bundleDimension !== null) {
                    var leftCentroid = __.clusterCentroids.get(__.dimensions[__.bundleDimension].yscale(row[__.bundleDimension])).get(p[i]);
                    var rightCentroid = __.clusterCentroids.get(__.dimensions[__.bundleDimension].yscale(row[__.bundleDimension])).get(p[i + 1]);
                    var centroid = 0.5 * (leftCentroid + rightCentroid);
                    cy = centroid + (1 - __.bundlingStrength) * (cy - centroid);
                }
                centroids.push($V([cx, cy]));
            }
        }

        return centroids;
    }

    function compute_control_points(centroids) {

        var cols = centroids.length;
        var a = __.smoothness;
        var cps = [];

        cps.push(centroids[0]);
        cps.push($V([centroids[0].e(1) + a * 2 * (centroids[1].e(1) - centroids[0].e(1)), centroids[0].e(2)]));
        for (var col = 1; col < cols - 1; ++col) {
            var mid = centroids[col];
            var left = centroids[col - 1];
            var right = centroids[col + 1];

            var diff = left.subtract(right);
            cps.push(mid.add(diff.x(a)));
            cps.push(mid);
            cps.push(mid.subtract(diff.x(a)));
        }
        cps.push($V([centroids[cols - 1].e(1) + a * 2 * (centroids[cols - 2].e(1) - centroids[cols - 1].e(1)), centroids[cols - 1].e(2)]));
        cps.push(centroids[cols - 1]);

        return cps;

    };
    pc.shadows = function () {
        flags.shadows = true;
        pc.alphaOnBrushed(0.1);
        pc.render();
        return this;
    };

    // draw dots with radius r on the axis line where data intersects
    pc.axisDots = function (r) {
        var r = r || 0.1;
        var ctx = pc.ctx.marks;
        var startAngle = 0;
        var endAngle = 2 * Math.PI;
        ctx.globalAlpha = d3.min([1 / Math.pow(__.data.length, 1 / 2), 1]);
        __.data.forEach(function (d) {
            d3.entries(__.dimensions).forEach(function (p, i) {
                ctx.beginPath();
                ctx.arc(position(p), __.dimensions[p.key].yscale(d[p]), r, startAngle, endAngle);
                ctx.stroke();
                ctx.fill();
            });
        });
        return this;
    };

    // draw single cubic bezier curve
    function single_curve(d, ctx) {

        var centroids = compute_centroids(d);
        var cps = compute_control_points(centroids);

        ctx.moveTo(cps[0].e(1), cps[0].e(2));
        for (var i = 1; i < cps.length; i += 3) {
            if (__.showControlPoints) {
                for (var j = 0; j < 3; j++) {
                    ctx.fillRect(cps[i + j].e(1), cps[i + j].e(2), 2, 2);
                }
            }
            ctx.bezierCurveTo(cps[i].e(1), cps[i].e(2), cps[i + 1].e(1), cps[i + 1].e(2), cps[i + 2].e(1), cps[i + 2].e(2));
        }
    };

    // draw single polyline
    function color_path(d, ctx) {
        ctx.beginPath();
        if ((__.bundleDimension !== null && __.bundlingStrength > 0) || __.smoothness > 0) {
            single_curve(d, ctx);
        } else {
            single_path(d, ctx);
        }
        ctx.stroke();
    };

    // draw many polylines of the same color
    function paths(data, ctx) {
        ctx.clearRect(-1, -1, w() + 2, h() + 2);
        ctx.beginPath();
        data.forEach(function (d) {
            if ((__.bundleDimension !== null && __.bundlingStrength > 0) || __.smoothness > 0) {
                single_curve(d, ctx);
            } else {
                single_path(d, ctx);
            }
        });
        ctx.stroke();
    };

    // returns the y-position just beyond the separating null value line
    function getNullPosition() {
        if (__.nullValueSeparator == "bottom") {
            return h() + 1;
        } else if (__.nullValueSeparator == "top") {
            return 1;
        } else {
            console.log("A value is NULL, but nullValueSeparator is not set; set it to 'bottom' or 'top'.");
        }
        return h() + 1;
    };

    function single_path(d, ctx) {
        d3.entries(__.dimensions).forEach(function (p, i) { //p isn't really p
            if (i == 0) {
                ctx.moveTo(position(p.key), typeof d[p.key] == 'undefined' ? getNullPosition() : __.dimensions[p.key].yscale(d[p.key]));
            } else {
                ctx.lineTo(position(p.key), typeof d[p.key] == 'undefined' ? getNullPosition() : __.dimensions[p.key].yscale(d[p.key]));
            }
        });
    };

    function path_brushed(d, i) {
        if (__.brushedColor !== null) {
            ctx.brushed.strokeStyle = d3.functor(__.brushedColor)(d, i);
        } else {
            ctx.brushed.strokeStyle = d3.functor(__.color)(d, i);
        }
        return color_path(d, ctx.brushed)
    }

    function path_foreground(d, i) {
        ctx.foreground.strokeStyle = d3.functor(__.color)(d, i);
        return color_path(d, ctx.foreground);
    }

    function path_highlight(d, i) {
        ctx.highlight.strokeStyle = d3.functor(__.color)(d, i);
        return color_path(d, ctx.highlight);
    }
    pc.clear = function (layer) {
        ctx[layer].clearRect(0, 0, w() + 2, h() + 2);

        // This will make sure that the foreground items are transparent
        // without the need for changing the opacity style of the foreground canvas
        // as this would stop the css styling from working
        if (layer === "brushed" && isBrushed()) {
            ctx.brushed.fillStyle = pc.selection.style("background-color");
            ctx.brushed.globalAlpha = 1 - __.alphaOnBrushed;
            ctx.brushed.fillRect(0, 0, w() + 2, h() + 2);
            ctx.brushed.globalAlpha = __.alpha;
        }
        return this;
    }
    d3.rebind(pc, axis, "ticks", "orient", "tickValues", "tickSubdivide", "tickSize", "tickPadding", "tickFormat");

    function flipAxisAndUpdatePCP(dimension) {
        // console.log(__.dimensions[dimension].yscale.domain());
        var g = pc.svg.selectAll(".dimension");
        if (pc.brushMode() === "1D-axes" || pc.brushMode() === "1D-axes-multi") {
            var state = pc.brushExtents();
        }

        if (__.dimensions[dimension].type != "string") {
            pc.flip(dimension);
            console.log(dimension + " flipped to:" + __.dimensions[dimension].yscale.domain());
        } else {
            console.log(__.dimensions[dimension].yscale.domain());
        }



        d3.select(this.parentElement)
            .transition()
            .duration(__.animationTime)
            .call(axis.scale(__.dimensions[dimension].yscale));
        if (pc.brushMode() === "1D-axes" || pc.brushMode() === "1D-axes-multi") {
            pc.brushExtents(state);
        }

        pc.reRender();
    }

    function rotateLabels() {
        var delta = d3.event.deltaY;
        delta = delta < 0 ? -5 : delta;
        delta = delta > 0 ? 5 : delta;

        __.dimensionTitleRotation += delta;
        pc.svg.selectAll("text.label")
            .attr("transform", "translate(0,-5) rotate(" + __.dimensionTitleRotation + ")");
        d3.event.preventDefault();
    }

    function dimensionLabels(d) {
        return __.dimensions[d].title ? __.dimensions[d].title : d; // dimension display names
    }

    pc.createAxes = function () {
        if (g) pc.removeAxes();

        // Add a group element for each dimension.
        g = pc.svg.selectAll(".dimension")
            .data(pc.getOrderedDimensionKeys(), function (d) {
                return d;
            })
            .enter().append("svg:g")
            .attr("id", function (d) {return "dim_"+string_as_unicode_escape(d);})
            .attr("class", "dimension")
            .attr("transform", function (d) {
                return "translate(" + xscale(d) + ")";
            });

        // Add an axis and title.
        g.append("svg:g")
            .attr("class", "axis")
            .attr("transform", "translate(0,0)")
            .each(function (d) {
                d3.select(this).call(pc.applyAxisConfig(axis, __.dimensions[d]));
            })
            .append("svg:text")
            .attr({
                "text-anchor": "middle",
                "y": 0,
                "transform": "translate(0,-5) rotate(" + __.dimensionTitleRotation + ")",
                "x": 0,
                "class": "label"
            })
            .text(dimensionLabels)
            .on("dblclick", flipAxisAndUpdatePCP)
            .on("wheel", rotateLabels);

        if (__.nullValueSeparator == "top") {
            pc.svg.append("line")
                .attr("x1", 0)
                .attr("y1", 1 + __.nullValueSeparatorPadding.top)
                .attr("x2", w())
                .attr("y2", 1 + __.nullValueSeparatorPadding.top)
                .attr("stroke-width", 1)
                .attr("stroke", "#777")
                .attr("fill", "none")
                .attr("shape-rendering", "crispEdges");
        } else if (__.nullValueSeparator == "bottom") {
            pc.svg.append("line")
                .attr("x1", 0)
                .attr("y1", h() + 1 - __.nullValueSeparatorPadding.bottom)
                .attr("x2", w())
                .attr("y2", h() + 1 - __.nullValueSeparatorPadding.bottom)
                .attr("stroke-width", 1)
                .attr("stroke", "#777")
                .attr("fill", "none")
                .attr("shape-rendering", "crispEdges");
        }

        flags.axes = true;
        return this;
    };

    pc.removeAxes = function () {
        g.remove();
        g = undefined;
        return this;
    };

    pc.updateAxes = function (animationTime) {
        if (typeof animationTime === 'undefined') {
            animationTime = __.animationTime;
        }

        var g_data = pc.svg.selectAll(".dimension").data(pc.getOrderedDimensionKeys());
        //console.log(g_data);
        // Enter
        g_data.enter().append("svg:g")
            .attr("id", function (d) {return "dim_"+d;})
            .attr("class", "dimension")
            .attr("transform", function (p) {
                return "translate(" + position(p) + ")";
            })
            .style("opacity", 0)
            .append("svg:g")
            .attr("class", "axis")
            .attr("transform", "translate(0,0)")
            .each(function (d) {
                d3.select(this).call(pc.applyAxisConfig(axis, __.dimensions[d]))
            })
            .append("svg:text")
            .attr({
                "text-anchor": "middle",
                "y": 0,
                "transform": "translate(0,-5) rotate(" + __.dimensionTitleRotation + ")",
                "x": 0,
                "class": "label"
            })
            .text(dimensionLabels)
            .on("dblclick", flipAxisAndUpdatePCP)
            .on("wheel", rotateLabels);

        // Update
        g_data.attr("opacity", 0);
        g_data.select(".axis")
            .transition()
            .duration(animationTime)
            .each(function (d) {
                d3.select(this).call(pc.applyAxisConfig(axis, __.dimensions[d]));
            });
        g_data.select(".label")
            .transition()
            .duration(animationTime)
            .text(dimensionLabels)
            .attr("transform", "translate(0,-5) rotate(" + __.dimensionTitleRotation + ")");

        // Exit
        g_data.exit().remove();

        g = pc.svg.selectAll(".dimension");
        g.transition().duration(animationTime)
            .attr("transform", function (p) {
                return "translate(" + position(p) + ")";
            })
            .style("opacity", 1);

        pc.svg.selectAll(".axis")
            .transition()
            .duration(animationTime)
            .each(function (d) {
                //console.log(pc.applyAxisConfig(axis, __.dimensions[d]));
                d3.select(this).call(pc.applyAxisConfig(axis, __.dimensions[d]));
            });

        if (flags.brushable) pc.brushable();
        if (flags.reorderable) pc.reorderable();
        if (pc.brushMode() !== "None") {
            var mode = pc.brushMode();
            pc.brushMode("None");
            pc.brushMode(mode);
        }
        return this;
    };

    pc.applyAxisConfig = function (axis, dimension) {
        //console.log(dimension.yscale.domain());
        //console.log(dimension.tickValues);
        //console.log(dimension.tickFormat);

        return axis.scale(dimension.yscale)
            .orient(dimension.orient)
            .ticks(dimension.ticks)
            .tickValues(dimension.tickValues)
            .innerTickSize(dimension.innerTickSize)
            .outerTickSize(dimension.outerTickSize)
            .tickPadding(dimension.tickPadding)
            .tickFormat(dimension.tickFormat);
    };

    // Jason Davies, http://bl.ocks.org/1341281
    pc.reorderable = function () {
        if (!g) pc.createAxes();

        g.style("cursor", "move")
            .call(d3.behavior.drag()
                .on("dragstart", function (d) {
                    dragging[d] = this.__origin__ = xscale(d);
                })
                .on("drag", function (d) {
                    dragging[d] = Math.min(w(), Math.max(0, this.__origin__ += d3.event.dx));
                    pc.sortDimensions();
                    xscale.domain(pc.getOrderedDimensionKeys());
                    pc.render();
                    g.attr("transform", function (d) {
                        return "translate(" + position(d) + ")";
                    });
                })
                .on("dragend", function (d) {
                    // Let's see if the order has changed and send out an event if so.
                    var i = 0,
                        j = __.dimensions[d].index,
                        elem = this,
                        parent = this.parentElement;

                    while ((elem = elem.previousElementSibling) != null) ++i;
                    if (i !== j) {
                        events.axesreorder.call(pc, pc.getOrderedDimensionKeys());
                        // We now also want to reorder the actual dom elements that represent
                        // the axes. That is, the g.dimension elements. If we don't do this,
                        // we get a weird and confusing transition when updateAxes is called.
                        // This is due to the fact that, initially the nth g.dimension element
                        // represents the nth axis. However, after a manual reordering,
                        // without reordering the dom elements, the nth dom elements no longer
                        // necessarily represents the nth axis.
                        //
                        // i is the original index of the dom element
                        // j is the new index of the dom element
                        if (i > j) { // Element moved left
                            parent.insertBefore(this, parent.children[j - 1]);
                        } else { // Element moved right
                            if ((j + 1) < parent.children.length) {
                                parent.insertBefore(this, parent.children[j + 1]);
                            } else {
                                parent.appendChild(this);
                            }
                        }
                    }

                    delete this.__origin__;
                    delete dragging[d];
                    d3.select(this).transition().attr("transform", "translate(" + xscale(d) + ")");
                    pc.render();
                }));
        flags.reorderable = true;
        return this;
    };

    // Reorder dimensions, such that the highest value (visually) is on the left and
    // the lowest on the right. Visual values are determined by the data values in
    // the given row.
    pc.reorder = function (rowdata) {
        var firstDim = pc.getOrderedDimensionKeys()[0];

        pc.sortDimensionsByRowData(rowdata);
        // NOTE: this is relatively cheap given that:
        // number of dimensions < number of data items
        // Thus we check equality of order to prevent rerendering when this is the case.
        var reordered = false;
        reordered = firstDim !== pc.getOrderedDimensionKeys()[0];

        if (reordered) {
            xscale.domain(pc.getOrderedDimensionKeys());
            var highlighted = __.highlighted.slice(0);
            pc.unhighlight();

            g.transition()
                .duration(1500)
                .attr("transform", function (d) {
                    return "translate(" + xscale(d) + ")";
                });
            pc.render();

            // pc.highlight() does not check whether highlighted is length zero, so we do that here.
            if (highlighted.length !== 0) {
                pc.highlight(highlighted);
            }
        }
    }

    pc.sortDimensionsByRowData = function (rowdata) {
        var copy = __.dimensions;
        var positionSortedKeys = d3.keys(__.dimensions).sort(function (a, b) {
            var pixelDifference = __.dimensions[a].yscale(rowdata[a]) - __.dimensions[b].yscale(rowdata[b]);

            // Array.sort is not necessarily stable, this means that if pixelDifference is zero
            // the ordering of dimensions might change unexpectedly. This is solved by sorting on
            // variable name in that case.
            if (pixelDifference === 0) {
                return a.localeCompare(b);
            } // else
            return pixelDifference;
        });
        __.dimensions = {};
        positionSortedKeys.forEach(function (p, i) {
            __.dimensions[p] = copy[p];
            __.dimensions[p].index = i;
        });
    };

    pc.sortDimensions = function () {
        var copy = __.dimensions;
        var positionSortedKeys = d3.keys(__.dimensions).sort(function (a, b) {
            return position(a) - position(b);
        });
        __.dimensions = {};
        positionSortedKeys.forEach(function (p, i) {
            __.dimensions[p] = copy[p];
            __.dimensions[p].index = i;
        });
    };

    // pairs of adjacent dimensions
    pc.adjacent_pairs = function (arr) {
        var ret = [];
        for (var i = 0; i < arr.length - 1; i++) {
            ret.push([arr[i], arr[i + 1]]);
        }
        return ret;
    };

    var brush = {
        modes: {
            "None": {
                install: function (pc) {}, // Nothing to be done.
                uninstall: function (pc) {}, // Nothing to be done.
                selected: function () {
                    return [];
                }, // Nothing to return
                brushState: function () {
                    return {};
                }
            }
        },
        mode: "None",
        predicate: "AND",
        currentMode: function () {
            return this.modes[this.mode];
        }
    };

    // This function can be used for 'live' updates of brushes. That is, during the
    // specification of a brush, this method can be called to update the view.
    //
    // @param newSelection - The new set of data items that is currently contained
    //                       by the brushes
    function brushUpdated(newSelection) {
        __.brushed = newSelection;
        events.brush.call(pc, __.brushed);
        pc.renderBrushed();
    }

    function brushPredicate(predicate) {
        if (!arguments.length) {
            return brush.predicate;
        }

        predicate = String(predicate).toUpperCase();
        if (predicate !== "AND" && predicate !== "OR") {
            throw "Invalid predicate " + predicate;
        }

        brush.predicate = predicate;
        __.brushed = brush.currentMode().selected();
        pc.renderBrushed();
        return pc;
    }

    pc.brushModes = function () {
        return Object.getOwnPropertyNames(brush.modes);
    };

    pc.brushMode = function (mode) {
        if (arguments.length === 0) {
            return brush.mode;
        }

        if (pc.brushModes().indexOf(mode) === -1) {
            throw "pc.brushmode: Unsupported brush mode: " + mode;
        }

        // Make sure that we don't trigger unnecessary events by checking if the mode
        // actually changes.
        if (mode !== brush.mode) {
            // When changing brush modes, the first thing we need to do is clearing any
            // brushes from the current mode, if any.
            if (brush.mode !== "None") {
                pc.brushReset();
            }

            // Next, we need to 'uninstall' the current brushMode.
            brush.modes[brush.mode].uninstall(pc);
            // Finally, we can install the requested one.
            brush.mode = mode;

            // Reference brushmode object for later use at resize() function
            brushmodeObject = brush.modes[brush.mode];
            brush.modes[brush.mode].install();
            if (mode === "None") {
                delete pc.brushPredicate;
            } else {
                pc.brushPredicate = brushPredicate;
            }
        }

        return pc;
    };

    // brush mode: 1D-Axes

    (function () {
        var brushes = {};

        function is_brushed(p) {
            return !brushes[p].empty();
        }

        // data within extents
        function selected() {
            var actives = d3.keys(__.dimensions).filter(is_brushed),
                extents = actives.map(function (p) {
                    return brushes[p].extent();
                });

            // We don't want to return the full data set when there are no axes brushed.
            // Actually, when there are no axes brushed, by definition, no items are
            // selected. So, let's avoid the filtering and just return false.
            //if (actives.length === 0) return false;

            // Resolves broken examples for now. They expect to get the full dataset back from empty brushes
            if (actives.length === 0) return __.data;

            // test if within range
            var within = {
                "date": function (d, p, dimension) {
                    if (typeof __.dimensions[p].yscale.rangePoints === "function") { // if it is ordinal
                        return extents[dimension][0] <= __.dimensions[p].yscale(d[p]) && __.dimensions[p].yscale(d[p]) <= extents[dimension][1]
                    } else {
                        return extents[dimension][0] <= d[p] && d[p] <= extents[dimension][1]
                    }
                },
                "number": function (d, p, dimension) {
                    if (typeof __.dimensions[p].yscale.rangePoints === "function") { // if it is ordinal
                        return extents[dimension][0] <= __.dimensions[p].yscale(d[p]) && __.dimensions[p].yscale(d[p]) <= extents[dimension][1]
                    } else {
                        return extents[dimension][0] <= d[p] && d[p] <= extents[dimension][1]
                    }
                },
                "string": function (d, p, dimension) {
                    return extents[dimension][0] <= __.dimensions[p].yscale(d[p]) && __.dimensions[p].yscale(d[p]) <= extents[dimension][1]
                }
            };

            return __.data
                .filter(function (d) {
                    switch (brush.predicate) {
                        case "AND":
                            return actives.every(function (p, dimension) {
                                return within[__.dimensions[p].type](d, p, dimension);
                            });
                        case "OR":
                            return actives.some(function (p, dimension) {
                                return within[__.dimensions[p].type](d, p, dimension);
                            });
                        default:
                            throw "Unknown brush predicate " + __.brushPredicate;
                    }
                });
        };

        function brushExtents(extents) {
            if (typeof (extents) === 'undefined') {
                var extents = {};
                d3.keys(__.dimensions).forEach(function (d) {
                    var brush = brushes[d];
                    if (brush !== undefined && !brush.empty()) {
                        var extent = brush.extent();
                        extent.sort(d3.ascending);
                        extents[d] = extent;
                    }
                });
                return extents;
            } else {
                //first get all the brush selections
                var brushSelections = {};
                g.selectAll('.brush')
                    .each(function (d) {
                        brushSelections[d] = d3.select(this);

                    });

                // loop over each dimension and update appropriately (if it was passed in through extents)
                d3.keys(__.dimensions).forEach(function (d) {
                    if (extents[d] === undefined) {
                        return;
                    }

                    var brush = brushes[d];
                    if (brush !== undefined) {
                        //update the extent
                        brush.extent(extents[d]);

                        //redraw the brush
                        brushSelections[d]
                            .transition()
                            .duration(0)
                            .call(brush);

                        //fire some events
                        brush.event(brushSelections[d]);
                    }
                });

                //redraw the chart
                pc.renderBrushed();

                return pc;
            }
        }

        function brushFor(axis) {
            var brush = d3.svg.brush();

            brush
                .y(__.dimensions[axis].yscale)
                .on("brushstart", function () {
                    if (d3.event.sourceEvent !== null) {
                        events.brushstart.call(pc, __.brushed);
                        d3.event.sourceEvent.stopPropagation();
                    }
                })
                .on("brush", function () {
                    brushUpdated(selected());
                })
                .on("brushend", function () {
                    events.brushend.call(pc, __.brushed);
                });

            brushes[axis] = brush;
            return brush;
        };

        function brushReset(dimension) {
            if (dimension === undefined) {
                __.brushed = false;
                if (g) {
                    g.selectAll('.brush')
                        .each(function (d) {
                            d3.select(this)
                                .transition()
                                .duration(0)
                                .call(brushes[d].clear());
                        });
                    pc.renderBrushed();
                }
            } else {
                if (g) {
                    g.selectAll('.brush')
                        .each(function (d) {
                            if (d != dimension) return;
                            d3.select(this)
                                .transition()
                                .duration(0)
                                .call(brushes[d].clear());
                            brushes[d].event(d3.select(this));
                        });
                    pc.renderBrushed();
                }
            }
            return this;
        };

        function install() {
            if (!g) pc.createAxes();

            // Add and store a brush for each axis.
            g.append("svg:g")
                .attr("class", "brush")
                .each(function (d) {
                    d3.select(this).call(brushFor(d));
                })
                .selectAll("rect")
                .style("visibility", null)
                .attr("x", -15)
                .attr("width", 30);

            pc.brushExtents = brushExtents;
            pc.brushReset = brushReset;
            return pc;
        }

        brush.modes["1D-axes"] = {
            install: install,
            uninstall: function () {
                g.selectAll(".brush").remove();
                brushes = {};
                delete pc.brushExtents;
                delete pc.brushReset;
            },
            selected: selected,
            brushState: brushExtents
        }
    })();


    pc.interactive = function () {
        flags.interactive = true;
        return this;
    };

    // expose a few objects
    pc.xscale = xscale;
    pc.ctx = ctx;
    pc.canvas = canvas;
    pc.g = function () {
        return g;
    };

    // rescale for height, width and margins
    // TODO:210 currently assumes chart is brushable, and destroys old brushes
    pc.resize = function () {
        // reference the current brushMode
        var currentBrushMode = pc.brushMode();

        // reinstalling brushes when resizing currently works for "1D-axes" and "1D-axes-multi"
        if (currentBrushMode === "1D-axes" || currentBrushMode === "1D-axes-multi") {
            //store the current brush state
            var brushModeState = pc.brushExtents();
        }

        // selection size
        pc.selection.select("svg")
            .attr("width", __.width)
            .attr("height", __.height)
        pc.svg.attr("transform", "translate(" + __.margin.left + "," + __.margin.top + ")");

        // scales
        //pc.autoscale();
        
        if (isBrushed()) {
            pc.autoscale();
            pc.renderBrushed();
        } else {
            pc.render();
            //pc.reRender();
        }

        // axes, destroys old brushes.
        if (g) pc.createAxes();
        if (flags.brushable) pc.brushable();
        if (flags.reorderable) pc.reorderable();

        // reinstalling brushes when resizing currently works for "1D-axes" and "1D-axes-multi"
        // createAxes() destroyed the brush elements, reinstall them and restore the brush state
        if (currentBrushMode === "1D-axes" || currentBrushMode === "1D-axes-multi") {
            // install() recreates the brush elements and their events, assigns empty brush extents
            brushmodeObject.install();
            // set the empty brush extents to the saved brush state
            pc.brushExtents(brushModeState);
        }

        events.resize.call(this, {
            width: __.width,
            height: __.height,
            margin: __.margin
        });

        return this;
    };

    pc.reset = function(){
        __.yscaleDomains = {};
    }

    pc.update = function () {
        // reference the current brushMode
        // var currentBrushMode = pc.brushMode();
        //
        // // reinstalling brushes when resizing currently works for "1D-axes" and "1D-axes-multi"
        // if (currentBrushMode === "1D-axes" || currentBrushMode === "1D-axes-multi") {
        //     //store the current brush state
        //     var brushModeState = pc.brushExtents();
        // }

        if (isBrushed()) {
            pc.renderBrushed();
        } else {
            pc.Render();
        }

        // axes, destroys old brushes.
        if (flags.brushable) pc.brushable();
        if (flags.reorderable) pc.reorderable();
        //
        // // reinstalling brushes when resizing currently works for "1D-axes" and "1D-axes-multi"
        // // createAxes() destroyed the brush elements, reinstall them and restore the brush state
        // if (currentBrushMode === "1D-axes" || currentBrushMode === "1D-axes-multi") {
        //     // install() recreates the brush elements and their events, assigns empty brush extents
        //     brushmodeObject.install();
        //     // set the empty brush extents to the saved brush state
        //     pc.brushExtents(brushModeState);
        // }
        return this;
    };
    // highlight an array of data
    pc.highlight = function (data) {
        if (arguments.length === 0) {
            return __.highlighted;
        }

        __.highlighted = data;
        pc.clear("highlight");
        if (__.brushed) {
            //console.log("brushed");
            d3.select(canvas.brushed).classed("faded", true);
            d3.select(canvas.foreground).classed("hidden", true);
        } else {
            d3.select(canvas.foreground).classed("faded", true);
        }

        data.forEach(path_highlight);
        events.highlight.call(this, data);
        return this;
    };

    // clear highlighting
    pc.unhighlight = function () {
        __.highlighted = [];

        pc.clear("highlight");
        d3.selectAll([canvas.foreground, canvas.brushed]).classed("faded", false);
        return this;
    };

    // calculate 2d intersection of line a->b with line c->d
    // points are objects with x and y properties
    pc.intersection = function (a, b, c, d) {
        return {
            x: ((a.x * b.y - a.y * b.x) * (c.x - d.x) - (a.x - b.x) * (c.x * d.y - c.y * d.x)) / ((a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x)),
            y: ((a.x * b.y - a.y * b.x) * (c.y - d.y) - (a.y - b.y) * (c.x * d.y - c.y * d.x)) / ((a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x))
        };
    };

    function position(d) {
        if (xscale.range().length === 0) {
            xscale.rangePoints([0, w()], 1);
        }
        var v = dragging[d];
        return v == null ? xscale(d) : v;
    }
    pc.version = "0.7.0";
    // this descriptive text should live with other introspective methods
    pc.toString = function () {
        return "Parallel Coordinates: " + d3.keys(__.dimensions).length + " dimensions (" + d3.keys(__.data[0]).length + " total) , " + __.data.length + " rows";
    };

    return pc;
};

d3.renderQueue = (function (func) {
    var _queue = [], // data to be rendered
        _rate = 10, // number of calls per frame
        _clear = function () {}, // clearing function
        _i = 0; // current iteration

    var rq = function (data) {
        if (data) rq.data(data);
        rq.invalidate();
        _clear();
        rq.render();
    };

    rq.render = function () {
        _i = 0;
        var valid = true;
        rq.invalidate = function () {
            valid = false;
        };

        function doFrame() {
            if (!valid) return true;
            if (_i > _queue.length) return true;

            // Typical d3 behavior is to pass a data item *and* its index. As the
            // render queue splits the original data set, we'll have to be slightly
            // more carefull about passing the correct index with the data item.
            var end = Math.min(_i + _rate, _queue.length);
            for (var i = _i; i < end; i++) {
                func(_queue[i], i);
            }
            _i += _rate;
        }

        d3.timer(doFrame);
    };

    rq.data = function (data) {
        rq.invalidate();
        _queue = data.slice(0);
        return rq;
    };

    rq.rate = function (value) {
        if (!arguments.length) return _rate;
        _rate = value;
        return rq;
    };

    rq.remaining = function () {
        return _queue.length - _i;
    };

    // clear the canvas
    rq.clear = function (func) {
        if (!arguments.length) {
            _clear();
            return rq;
        }
        _clear = func;
        return rq;
    };

    rq.invalidate = function () {};

    return rq;
});