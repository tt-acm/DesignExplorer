
# scatter-matrix.js

scatter-matrix.js (SM) is a JavaScript library for drawing scatterplot matrix.
SM handles matrix data in CSV format: rows represent samples and columns
represent observations. SM interprets the first row as a header. All numeric
columns appear as rows and columns of the scatterplot matrix.

SM is a simple extension/generalization of [Mike Bostock's scatterplot matrix
example](http://mbostock.github.io/d3/talk/20111116/iris-splom.html).
Additional features include

  * User can color dots by values of a non-numeric observation.
  * User can filter data by values of a non-numeric observation.
  * User can decide what numeric observations to include in the matrix.
  * User can expand the matrix and view data by fixing one or more observations at set values.

For demo, see http://benjiec.github.io/scatter-matrix/demo/demo.html

