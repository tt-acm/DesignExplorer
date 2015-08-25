//some changes taken from: http://bl.ocks.org/nbremer/6506614
//wraps text to a new line if longer than width
//source: http://bl.ocks.org/mbostock/7555321
function wrap(text, width) {
    text.each(function() {
        var text = d3.select(this),
            words = text.text().split(/\s+/).reverse(),
            word,
            line = [],
            lineNumber = 0,
            lineHeight = 1.1, //ems
            y = text.attr("y"),
            x = text.attr("x"),
            dy = 0.32,
            tspan = text.text(null).append("tspan").attr("x", x).attr("y", y).attr("dy", dy + "em");
        
        while (word = words.pop()) {
            line.push(word);
            tspan.text(line.join(" "));
            if (tspan.node().getComputedTextLength() > width) {
                line.pop();
                tspan.text(line.join(" "));
                line = [word];
                tspan = text.append("tspan").attr("x", x).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
            }
        }
    })
}

var RadarChart = {
  defaultConfig: {
    containerClass: 'radar-chart',
    w: 600,
    h: 600,
    factor: 0.95,
    factorLegend: 1,
    levels: 3,
    levelTick: false,
    TickLength: 10,
    maxValue: 0,
    radians: 2 * Math.PI,
    color: d3.scale.category10(),
    axisLine: true,
    axisText: true,
    circles: true,
    radius: 5,
    translateX: 0,
    translateY: 0,
    extraWidthX: 0,
    extraWidthY: 0,
    backgroundTooltipColor: "#555",
    backgroundTooltipOpacity: "0.7",
    tooltipColor: "white",
    axisJoin: function(d, i) {
      return d.className || i;
    },
    transitionDuration: 300
  },
  chart: function() {
    // default config
    var cfg = Object.create(RadarChart.defaultConfig);
    
    function radar(selection) {
      selection.each(function(data) {
        var container = d3.select(this);

        // allow simple notation
        data = data.map(function(datum) {
          if(datum instanceof Array) {
            datum = {axes: datum};
          }

          return datum;
        });

        var maxValue = Math.max(cfg.maxValue, d3.max(data, function(d) {
          return d3.max(d.axes, function(o){ return o.value; });
        }));

        var allAxis = data[0].axes.map(function(i, j){ return {name: i.axis, xOffset: (i.xOffset)?i.xOffset:0, yOffset: (i.yOffset)?i.yOffset:0}; });
        var total = allAxis.length;
        var radius = cfg.factor * Math.min(cfg.w / 2, cfg.h / 2);
        var radius2 = Math.min(cfg.w / 2, cfg.h / 2);

        container.classed(cfg.containerClass, 1);

        function getPosition(i, range, factor, func){
          factor = typeof factor !== 'undefined' ? factor : 1;
          return range * (1 - factor * func(i * cfg.radians / total));
        }
        function getHorizontalPosition(i, range, factor){
          return getPosition(i, range, factor, Math.sin);
        }
        function getVerticalPosition(i, range, factor){
          return getPosition(i, range, factor, Math.cos);
        }

        // levels && axises
        var levelFactors = d3.range(0, cfg.levels).map(function(level) {
          return radius * ((level + 1) / cfg.levels);
        });

        var levelGroups = container.selectAll('g.level-group').data(levelFactors);

        levelGroups.enter().append('g');
        levelGroups.exit().remove();

        levelGroups.attr('class', function(d, i) {
          return 'level-group level-group-' + i;
        });

        var levelLine = levelGroups.selectAll('.level').data(function(levelFactor) {
          return d3.range(0, total).map(function() { return levelFactor; });
        });

        levelLine.enter().append('line');
        levelLine.exit().remove();

        if (cfg.levelTick){
          levelLine
          .attr('class', 'level')
          .attr('x1', function(levelFactor, i){
            if (radius == levelFactor) {
              return getHorizontalPosition(i, levelFactor);
            } else {
              return getHorizontalPosition(i, levelFactor) + (cfg.TickLength / 2) * Math.cos(i * cfg.radians / total);
            }
          })
          .attr('y1', function(levelFactor, i){
            if (radius == levelFactor) {
              return getVerticalPosition(i, levelFactor);
            } else {
              return getVerticalPosition(i, levelFactor) - (cfg.TickLength / 2) * Math.sin(i * cfg.radians / total);
            }
          })
          .attr('x2', function(levelFactor, i){
            if (radius == levelFactor) {
              return getHorizontalPosition(i+1, levelFactor);
            } else {
              return getHorizontalPosition(i, levelFactor) - (cfg.TickLength / 2) * Math.cos(i * cfg.radians / total);
            }
          })
          .attr('y2', function(levelFactor, i){
            if (radius == levelFactor) {
              return getVerticalPosition(i+1, levelFactor);
            } else {
              return getVerticalPosition(i, levelFactor) + (cfg.TickLength / 2) * Math.sin(i * cfg.radians / total);
            }
          })
          .attr('transform', function(levelFactor) {
            return 'translate(' + (cfg.w/2-levelFactor) + ', ' + (cfg.h/2-levelFactor) + ')';
          });
        }
        else{
          levelLine
          .attr('class', 'level')
          .attr('x1', function(levelFactor, i){ return getHorizontalPosition(i, levelFactor); })
          .attr('y1', function(levelFactor, i){ return getVerticalPosition(i, levelFactor); })
          .attr('x2', function(levelFactor, i){ return getHorizontalPosition(i+1, levelFactor); })
          .attr('y2', function(levelFactor, i){ return getVerticalPosition(i+1, levelFactor); })
          .attr('transform', function(levelFactor) {
            return 'translate(' + (cfg.w/2-levelFactor) + ', ' + (cfg.h/2-levelFactor) + ')';
          });
        }
        if(cfg.axisLine || cfg.axisText) {
          var axis = container.selectAll('.axis').data(allAxis);

          var newAxis = axis.enter().append('g');
          if(cfg.axisLine) {
            newAxis.append('line');
          }
          if(cfg.axisText) {
            newAxis.append('text');
          }

          axis.exit().remove();

          axis.attr('class', 'axis');

          if(cfg.axisLine) {
            axis.select('line')
              .attr('x1', cfg.w/2)
              .attr('y1', cfg.h/2)
              .attr('x2', function(d, i) { return (cfg.w/2-radius2)+getHorizontalPosition(i, radius2, cfg.factor); })
              .attr('y2', function(d, i) { return (cfg.h/2-radius2)+getVerticalPosition(i, radius2, cfg.factor); });
          }

          if(cfg.axisText) {
            axis.select('text')
              .attr('class', function(d, i){
                var p = getHorizontalPosition(i, 0.5);
                var v = getVerticalPosition(i, 0.5);

                return 'legend ' +
                  ((p < 0.4) ? 'left ' : ((p > 0.6) ? 'right ' : 'middle ')) +
                  ((v < 0.4) ? 'top' : ((v > 0.6) ? 'bottom' : 'middle'));
              })
              .attr('dy', function(d, i) {
                var p = getVerticalPosition(i, 0.5);
                return ((p < 0.1) ? '1em' : ((p > 0.9) ? '0' : '0.5em'));
              })
              .text(function(d) { return d.name; })
              .attr('x', function(d, i){ return d.xOffset+ (cfg.w/2-radius2)+getHorizontalPosition(i, radius2, cfg.factorLegend); })
              .attr('y', function(d, i){ return d.yOffset+ (cfg.h/2-radius2)+getVerticalPosition(i, radius2, cfg.factorLegend); });

            //manual adjustments
            d3.select("#radarChart").selectAll(".legend").call(wrap, 50);
            d3.select("#radarChart").selectAll(".legend").filter(".left")
              .attr("transform", "translate(-10, -10)");
            d3.select("#radarChart").selectAll(".legend").filter(".right")
              .attr("transform", "translate(0, -3)");
            d3.select("#radarChart").selectAll(".legend").filter(".top")
              .attr("transform", "translate(0, -3)");
            d3.select("#radarChart").selectAll(".legend").filter(".bottom")
              .attr("transform", "translate(0, 3)");
          }
        }

        // content
        data.forEach(function(d){
          d.axes.forEach(function(axis, i) {
            axis.x = (cfg.w/2-radius2)+getHorizontalPosition(i, radius2, (parseFloat(Math.max(axis.value, 0))/maxValue)*cfg.factor);
            axis.y = (cfg.h/2-radius2)+getVerticalPosition(i, radius2, (parseFloat(Math.max(axis.value, 0))/maxValue)*cfg.factor);
          });
        });
        var polygon = container.selectAll(".area").data(data, cfg.axisJoin);

        polygon.enter().append('polygon')
          .classed({area: 1, 'd3-enter': 1})
          .on('mouseover', function (dd){
            d3.event.stopPropagation();
            container.classed('focus', 1);
            d3.select(this).classed('focused', 1);
          })
          .on('mouseout', function(){
            d3.event.stopPropagation();
            container.classed('focus', 0);
            d3.select(this).classed('focused', 0);
          });

        polygon.exit()
          .classed('d3-exit', 1) // trigger css transition
          .transition().duration(cfg.transitionDuration)
            .remove();

        polygon
          .each(function(d, i) {
            var classed = {'d3-exit': 0}; // if exiting element is being reused
            classed['radar-chart-serie' + i] = 1;
            if(d.className) {
              classed[d.className] = 1;
            }
            d3.select(this).classed(classed);
          })
          // styles should only be transitioned with css
          .style('stroke', function(d, i) { return cfg.color(i); })
          .style('fill', function(d, i) { return cfg.color(i); })
          .transition().duration(cfg.transitionDuration)
            // svg attrs with js
            .attr('points',function(d) {
              return d.axes.map(function(p) {
                return [p.x, p.y].join(',');
              }).join(' ');
            })
            .each('start', function() {
              d3.select(this).classed('d3-enter', 0); // trigger css transition
            });

        if(cfg.circles && cfg.radius) {

          var circleGroups = container.selectAll('g.circle-group').data(data, cfg.axisJoin);

          circleGroups.enter().append('g').classed({'circle-group': 1, 'd3-enter': 1});
          circleGroups.exit()
            .classed('d3-exit', 1) // trigger css transition
            .transition().duration(cfg.transitionDuration).remove();

          circleGroups
            .each(function(d) {
              var classed = {'d3-exit': 0}; // if exiting element is being reused
              if(d.className) {
                classed[d.className] = 1;
              }
              d3.select(this).classed(classed);
            })
            .transition().duration(cfg.transitionDuration)
              .each('start', function() {
                d3.select(this).classed('d3-enter', 0); // trigger css transition
              });

          var circle = circleGroups.selectAll('.circle').data(function(datum, i) {
            return datum.axes.map(function(d) { return [d, i]; });
          });

          circle.enter().append('circle')
            .classed({circle: 1, 'd3-enter': 1})
            .on('mouseover', function(dd){
              d3.event.stopPropagation();
              //container.classed('focus', 1);
              //container.select('.area.radar-chart-serie'+dd[1]).classed('focused', 1);
            })
            .on('mouseout', function(dd){
              d3.event.stopPropagation();
              container.classed('focus', 0);
              //container.select('.area.radar-chart-serie'+dd[1]).classed('focused', 0);
              //No idea why previous line breaks tooltip hovering area after hoverin point.
            });

          circle.exit()
            .classed('d3-exit', 1) // trigger css transition
            .transition().duration(cfg.transitionDuration).remove();

          circle
            .each(function(d) {
              var classed = {'d3-exit': 0}; // if exit element reused
              classed['radar-chart-serie'+d[1]] = 1;
              d3.select(this).classed(classed);
            })
            // styles should only be transitioned with css
            .style('fill', function(d) { return cfg.color(d[1]); })
            .transition().duration(cfg.transitionDuration)
              // svg attrs with js
              .attr('r', cfg.radius)
              .attr('cx', function(d) {
                return d[0].x;
              })
              .attr('cy', function(d) {
                return d[0].y;
              })
              .each('start', function() {
                d3.select(this).classed('d3-enter', 0); // trigger css transition
              });
          
          //Make sure layer order is correct
          var poly_node = polygon.node();
          poly_node.parentNode.appendChild(poly_node);

          var cg_node = circleGroups.node();
          cg_node.parentNode.appendChild(cg_node);
          
        }
      });
    }

    radar.config = function(value) {
      if(!arguments.length) {
        return cfg;
      }
      if(arguments.length > 1) {
        cfg[arguments[0]] = arguments[1];
      }
      else {
        d3.entries(value || {}).forEach(function(option) {
          cfg[option.key] = option.value;
        });
      }
      return radar;
    };

    return radar;
  },
  draw: function(id, d, options) {
    var chart = RadarChart.chart().config(options);
    var cfg = chart.config();

    d3.select(id).select('svg').remove();

    var g = d3.select(id)
      .append("svg")
      .attr("width", cfg.w + cfg.extraWidthX)
      .attr("height", cfg.h + cfg.extraWidthY)
      .append("g")
      .attr("transform", "translate(" + cfg.translateX + "," + cfg.translateY + ")")
      .datum(d)
      .call(chart);
  }
};
