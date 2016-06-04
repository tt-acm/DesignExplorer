// Heavily influenced by Mike Bostock's Scatter Matrix example
// http://mbostock.github.io/d3/talk/20111116/iris-splom.html
//

ScatterMatrix = function(url, data, dom_id, el) {
  this.__url = url;
  if (data === undefined || data === null) { this.__data = undefined; }
  else { this.__data = d3.csv.parse(data); }
  this.__cell_size = 80;
  if (dom_id === undefined) { this.__dom_id = 'body'; }
  else { this.__dom_id = "#"+dom_id; }
  if (el)
    this.__dom_id = el;
};

ScatterMatrix.prototype.cellSize = function(n) {
  this.__cell_size = n;
  return this;
};

ScatterMatrix.prototype.onData = function(cb) {
  if (this.__data) { cb(); return; }
  var self = this;
  d3.csv(self.__url, function(data) {
    self.__data = data;
    cb();
  });
};

ScatterMatrix.prototype._numeric_to_str_key = function(k) { return k+'_'; };
ScatterMatrix.prototype._is_numeric_str_key = function(k) { return k[k.length-1] === '_'; };
ScatterMatrix.prototype._str_to_numeric_key = function(k) {
  if (this._is_numeric_str_key(k)) { return k.slice(0, k.length-1); }
  return null;
};

ScatterMatrix.prototype.render = function () {
  var self = this;

  var container = d3.select(this.__dom_id).append('div')
                    .attr('class', 'scatter-matrix-container');
  var control = container.append('div')
                         .attr('class', 'scatter-matrix-control');
  var svg = container.append('div')
                     .attr('class', 'scatter-matrix-svg')
                     .html('<em>Loading data...</em>');

  this.onData(function() {
    var data = self.__data;

    // Divide variables into string and numeric variables

    var string_variables = [];
    var original_numeric_variables = [];
    self.__string_variable_values = {};
    self.__numeric_variables = [];
	
	
    for (k in data[0]) {
      var is_numeric = true;
      data.forEach(function(d) {
        var v = d[k];
        if (isNaN(+v)) is_numeric = false;
      });
      if (is_numeric) {
		  
		    
		  
        self.__numeric_variables.push(k);
        original_numeric_variables.push(k);
      }
      else {
		  
		  
		//if (k !="img" and k != "threeD"){
			string_variables.push(k);
			self.__string_variable_values[k] = [];
		//}
      }
    }

    // For string variables, make a numeric counterpart that has as value the
    // index of the value

    data.forEach(function(d) {
      for (var j in string_variables) {
        var k = string_variables[j];
        var value = d[k];
        if (self.__string_variable_values[k].indexOf(value) < 0)
          self.__string_variable_values[k].push(value);
      }
    });

    // sort, then assign index
    for (var j in string_variables) {
      var k = string_variables[j];
      self.__string_variable_values[k].sort();
    }
    data.forEach(function(d) {
      for (var j in string_variables) {
        var k = string_variables[j];
        var value = d[k];
        var index = self.__string_variable_values[k].indexOf(value);
        d[self._numeric_to_str_key(k)] = index;
      }
    });
	console.log(string_variables);

//console.log(string_variables);//------------------------------------------------------------------
	
    for (var j in string_variables) {
      var k = string_variables[j];
      self.__numeric_variables.push(self._numeric_to_str_key(k));
    }

    // Add controls on the left

    var size_control = control.append('div').attr('class', 'scatter-matrix-size-control');
    var color_control = control.append('div').attr('class', 'scatter-matrix-color-control');
    var filter_control = control.append('div').attr('class', 'scatter-matrix-filter-control');
    var variable_control = control.append('div').attr('class', 'scatter-matrix-variable-control');
    var drill_control = control.append('div').attr('class', 'scatter-matrix-drill-control');

    // shared control states
    var to_include = self.__numeric_variables.slice(-3, -1);
    var color_variable = undefined;
    var selected_colors = undefined;
    var drill_variables = [];

    function set_filter(variable) {
      filter_control.selectAll('*').remove();
      if (variable) {
        // Get unique values for this variable
        var values = [];
        data.forEach(function(d) {
          var v = d[variable];
          if (values.indexOf(v) < 0) { values.push(v); }
        });

        selected_colors = values.slice(0, 5);

        var filter_li =
          filter_control
            .append('p').text('Filter by '+variable+': ')
            .append('ul')
            .selectAll('li')
            .data(values)
            .enter().append('li');

        filter_li.append('input')
                   .attr('type', 'checkbox')
                   .attr('checked', function(d, i) {
                     if (selected_colors.indexOf(d) >= 0)
                       return 'checked';
                     return null;
                   })
                   .on('click', function(d, i) {
                     var new_selected_colors = [];
                     for (var j in selected_colors) {
                       var v = selected_colors[j];
                       if (v !== d || this.checked) { new_selected_colors.push(v); } 
                     }
                     if (this.checked) { new_selected_colors.push(d); }
                     selected_colors = new_selected_colors;
                     self.__draw(self.__cell_size, svg, color_variable,
                                 selected_colors, to_include, drill_variables);
                   });
        filter_li.append('label')
                   .html(function(d) { return d; });
      }
    }

    size_a = size_control.append('p').text('Change plot size: ');
    size_a.append('a')
          .attr('href', 'javascript:void(0);')
          .html('-')
          .on('click', function() {
            self.__cell_size *= 0.75;
            self.__draw(self.__cell_size, svg, color_variable, selected_colors, to_include, drill_variables);
          });
    size_a.append('span').html('&nbsp;');
    size_a.append('a')
          .attr('href', 'javascript:void(0);')
          .html('+')
          .on('click', function() {
            self.__cell_size *= 1.25;
            self.__draw(self.__cell_size, svg, color_variable, selected_colors, to_include, drill_variables);
          });

    color_control.append('p').text('Select a variable to color:');
    color_control
      .append('ul')
      .selectAll('li')
      .data([undefined].concat(string_variables))
      .enter().append('li')
        .append('a')
          .attr('href', 'javascript:void(0);')
          .text(function(d) { return d ? d : 'None'; })
          .on('click', function(d, i) {
            color_variable = d;
            set_filter(d);
            self.__draw(self.__cell_size, svg, color_variable, selected_colors, to_include, drill_variables);
          });

    var variable_li =
      variable_control
        .append('p').text('Include variables: ')
        .append('ul')
        .selectAll('li')
        .data(self.__numeric_variables)
        .enter().append('li');

    variable_li.append('input')
               .attr('type', 'checkbox')
               .attr('checked', function(d, i) { if (to_include.indexOf(d) >= 0) return "checked"; return null; })
               .on('click', function(d, i) {
                 var new_to_include = [];
                 for (var j in to_include) {
                   var v = to_include[j];
                   if (v !== d || this.checked) { new_to_include.push(v); } 
                 }
                 if (this.checked) { new_to_include.push(d); }
                 to_include = new_to_include;
                 self.__draw(self.__cell_size, svg, color_variable, selected_colors, to_include, drill_variables);
               });
    variable_li.append('label')
               .html(function(d) {
                 var i = self.__numeric_variables.indexOf(d)+1;
                 return ''+i+': '+d;
               });

    drill_li = 
      drill_control
        .append('p').text('Drill and Expand: ')
        .append('ul')
        .selectAll('li')
        .data(original_numeric_variables.concat(string_variables))
        .enter().append('li');

    drill_li.append('input')
            .attr('type', 'checkbox')
            .on('click', function(d, i) {
               var new_drill_variables = [];
               for (var j in drill_variables) {
                 var v = drill_variables[j];
                 if (v !== d || this.checked) { new_drill_variables.push(v); } 
               }
               if (this.checked) { new_drill_variables.push(d); }
               drill_variables = new_drill_variables;
               self.__draw(self.__cell_size, svg, color_variable, selected_colors, to_include, drill_variables);
             });
    drill_li.append('label')
            .html(function(d) { return d; });

    self.__draw(self.__cell_size, svg, color_variable, selected_colors, to_include, drill_variables);
  });
};

ScatterMatrix.prototype.__draw =
  function(cell_size, container_el, color_variable, selected_colors, to_include, drill_variables) {
  var self = this;
  this.onData(function() {
    var data = self.__data;

    // filter data by selected colors
    if (color_variable && selected_colors) {
      data = [];
      self.__data.forEach(function(d) {
        if (selected_colors.indexOf(d[color_variable]) >= 0) { data.push(d); }
      });
    }

    container_el.selectAll('*').remove();

    // If no data, don't do anything
    if (data.length == 0) { return; }

    // Parse headers from first row of data
    var variables_to_draw = to_include.slice(0);

    // Get values of the string variable
    var colors = [];
    if (color_variable) {
      // Using self.__data (all data), instead of data (data to be drawn), so
      // our css classes are consistent when we filter by value.
      self.__data.forEach(function(d) {
        var s = d[color_variable];
        if (colors.indexOf(s) < 0) { colors.push(s); }
      });
    }

    function color_class(d) {
      var c = d;
      if (color_variable && d[color_variable]) { c = d[color_variable]; }
      return colors.length > 0 ? 'color-'+colors.indexOf(c) : 'color-2';
    }

    // Size parameters
    var size = cell_size, padding = 10,
        axis_width = 20, axis_height = 15, legend_width = 200, label_height = 15;

    // Get x and y scales for each numeric variable
    var x = {}, y = {};
    variables_to_draw.forEach(function(trait) {
      // Coerce values to numbers.
      data.forEach(function(d) { d[trait] = +d[trait]; });

      var value = function(d) { return d[trait]; },
          domain = [d3.min(data, value), d3.max(data, value)],
          range_x = [padding / 2, size - padding / 2],
          range_y = [padding / 2, size - padding / 2];

      x[trait] = d3.scale.linear().domain(domain).range(range_x);
      y[trait] = d3.scale.linear().domain(domain).range(range_y.reverse());
    });

    // When drilling, user select one or more variables. The first drilled
    // variable becomes the x-axis variable for all columns, and each column
    // contains only data points that match specific values for each of the
    // drilled variables other than the first.

    var drill_values = [];
    var drill_degrees = []
    drill_variables.forEach(function(variable) {
      // Skip first one, since that's just the x axis
      if (drill_values.length == 0) {
        drill_values.push([]);
        drill_degrees.push(1);
      }
      else {
        var values = [];
        data.forEach(function(d) {
          var v = d[variable];
          if (v !== undefined && values.indexOf(v) < 0) { values.push(v); }
        });
        values.sort();
        drill_values.push(values);
        drill_degrees.push(values.length);
      }
    });
    var total_columns = 1;
    drill_degrees.forEach(function(d) { total_columns *= d; });

    // Pick out stuff to draw on horizontal and vertical dimensions

    if (drill_variables.length > 0) {
      // First drill is now the x-axis variable for all columns
      x_variables = [];
      for (var i=0; i<total_columns; i++) {
        x_variables.push(drill_variables[0]);
      }
    }
    else
      x_variables = variables_to_draw.slice(0);

    if (drill_variables.length > 0) {
      // Don't draw any of the "drilled" variables in vertical dimension
      y_variables = [];
      variables_to_draw.forEach(function(variable) {
        if (drill_variables.indexOf(variable) < 0) { y_variables.push(variable); }
      });
    }
    else
      y_variables = variables_to_draw.slice(0);
    y_variables = y_variables.reverse();
    var filter_descriptions = 0;
    if (drill_variables.length > 1) {
      filter_descriptions = drill_variables.length-1;
    }

    // Formatting for axis
    var intf = d3.format('d');
    var fltf = d3.format('.f');
    var scif = d3.format('.1e');

    // Brush - for highlighting regions of data
    var brush = d3.svg.brush()
        .on("brushstart", brushstart)
        .on("brush", brush)
        .on("brushend", brushend);

    // Root panel
    var svg = container_el.append("svg:svg")
        .attr("width", label_height + size * x_variables.length + axis_width + padding + legend_width)
        .attr("height", size * y_variables.length + axis_height + label_height + label_height*filter_descriptions)
      .append("svg:g")
        .attr("transform", "translate("+label_height+",0)");

    // Push legend to the side
    var legend = svg.selectAll("g.legend")
        .data(colors)
      .enter().append("svg:g")
        .attr("class", "legend")
        .attr("transform", function(d, i) {
          return "translate(" + (label_height + size * x_variables.length + padding) + "," + (i*20+10) + ")";
        });

    legend.append("svg:circle")
        .attr("class", function(d, i) { return color_class(d); })
        .attr("r", 3);

    legend.append("svg:text")
        .attr("x", 12)
        .attr("dy", ".31em")
        .text(function(d) { return d; });

    var shorten = function (s) {
      if (s.length > 16)
        return s.slice(0, 12)+'...'+s.slice(s.length-8, s.length);
      return s;
    };

    var reshape_axis = function (axis, k) {
      if (self._is_numeric_str_key(k)) {
        var sk = self._str_to_numeric_key(k);
        axis.tickFormat(function(d) { return self.__string_variable_values[sk][d]; });
        if (self.__string_variable_values[sk].length < 10)
          axis.ticks(self.__string_variable_values[sk].length);
        else
          axis.ticks(2);
      }
      else
        axis.ticks(5)
            .tickFormat(function (d) {
                          if (Math.abs(+d) > 10000 || (Math.abs(d) < 0.001 && Math.abs(d) != 0)) { return scif(d); }
                          if (parseInt(d) == +d) { return intf(d); }
                          return fltf(d);
                        });
      return axis;
    };

    // Draw X-axis
    svg.selectAll("g.x.axis")
        .data(x_variables)
      .enter().append("svg:g")
        .attr("class", "x axis")
        .attr("transform", function(d, i) { return "translate(" + i * size + ",0)"; })
        .each(function(k) {
          var axis = reshape_axis(d3.svg.axis(), k);
          axis.tickSize(size * y_variables.length);
          d3.select(this).call(axis.scale(x[k]).orient('bottom'));
        });

    // Draw Y-axis
    svg.selectAll("g.y.axis")
        .data(y_variables)
      .enter().append("svg:g")
        .attr("class", "y axis")
        .attr("transform", function(d, i) { return "translate(0," + i * size + ")"; })
        .each(function(k) {
          var axis = reshape_axis(d3.svg.axis(), k);
          axis.tickSize(size * x_variables.length);
          d3.select(this).call(axis.scale(y[k]).orient('right'));
        });

    // Draw scatter plot

    var cell = svg.selectAll("g.cell")
        .data(cross(x_variables, y_variables))
      .enter().append("svg:g")
        .attr("class", "cell")
        .attr("transform", function(d) { return "translate(" + d.i * size + "," + d.j * size + ")"; })
        .each(plot);

    // Add titles for y variables
    cell.filter(function(d) { return d.i == 0; }).append("svg:text")
        .attr("x", padding-size)
        .attr("y", -label_height)
        .attr("dy", ".71em")
        .attr("transform", function(d) { return "rotate(-90)"; })
        .text(function(d) {
          var s = self.__numeric_variables.indexOf(d.y)+1;
          s = ''+s+': '+d.y;
          return shorten(s);
        });

    function plot(p) {
      // console.log(p);

      var data_to_draw = data;

      // If drilling, compute what values of the drill variables correspond to
      // this column.
      //
      var filter = {};
      if (drill_variables.length > 1) {
        var column = p.i;

        var cap = 1;
        for (var i=drill_variables.length-1; i > 0; i--) {
          var var_name = drill_variables[i];
          var var_value = undefined;

          if (i == drill_variables.length-1) {
            // for the last drill variable, we index by %
            var_value = drill_values[i][column % drill_degrees[i]];
          }
          else {
            // otherwise divide by capacity of subsequent variables to get value array index
            var_value = drill_values[i][parseInt(column/cap)];
          }

          filter[var_name] = var_value;
          cap *= drill_degrees[i];
        }

        data_to_draw = [];
        data.forEach(function(d) {
          var pass = true;
          for (k in filter) { if (d[k] != filter[k]) { pass = false; break; } }
          if (pass === true) { data_to_draw.push(d); }
        });
      }

      var cell = d3.select(this);

      // Frame
      cell.append("svg:rect")
          .attr("class", "frame")
          .attr("x", padding / 2)
          .attr("y", padding / 2)
          .attr("width", size - padding)
          .attr("height", size - padding);

      // Scatter plot dots
      cell.selectAll("circle")
          .data(data_to_draw)
        .enter().append("svg:circle")
          .attr("class", function(d) { return color_class(d); })
          .attr("cx", function(d) { return x[p.x](d[p.x]); })
          .attr("cy", function(d) { return y[p.y](d[p.y]); })
          .attr("r", 3);

      // Add titles for x variables and drill variable values
      if (p.j == y_variables.length-1) {
        cell.append("svg:text")
            .attr("x", padding)
            .attr("y", size+axis_height)
            .attr("dy", ".71em")
            .text(function(d) {
              var s = self.__numeric_variables.indexOf(d.x)+1;
              s = ''+s+': '+d.x;
              return shorten(s);
            });

        if (drill_variables.length > 1) {
          var i = 0;
          for (k in filter) {
            i += 1;
            cell.append("svg:text")
                .attr("x", padding)
                .attr("y", size+axis_height+label_height*i)
                .attr("dy", ".71em")
                .text(function(d) { return shorten(filter[k]+': '+k); });
          }
        }
      }

      // Brush
      cell.call(brush.x(x[p.x]).y(y[p.y]));
    }

    // Clear the previously-active brush, if any
    function brushstart(p) {
      if (brush.data !== p) {
        cell.call(brush.clear());
        brush.x(x[p.x]).y(y[p.y]).data = p;
      }
    }

    // Highlight selected circles
    function brush(p) {
      var e = brush.extent();
      svg.selectAll(".cell circle").attr("class", function(d) {
        return e[0][0] <= d[p.x] && d[p.x] <= e[1][0]
            && e[0][1] <= d[p.y] && d[p.y] <= e[1][1]
            ? color_class(d) : null;
      });
    }

    // If brush is empty, select all circles
    function brushend() {
      if (brush.empty()) svg.selectAll(".cell circle").attr("class", function(d) {
        return color_class(d);
      });
    }

    function cross(a, b) {
      var c = [], n = a.length, m = b.length, i, j;
      for (i = -1; ++i < n;) for (j = -1; ++j < m;) c.push({x: a[i], i: i, y: b[j], j: j});
      return c;
    }
  }); 

};
