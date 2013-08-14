# tesseract

## a 3D block-packing game in WebGL

Tesseract is a 3-dimensional block-packing game, inspired of course by
that other 2-dimensional block-packing game, and more specifically
[Frac](http://theodor.lauppert.ws/games/frac.htm) and
[Frac4D](http://theodor.lauppert.ws/games/frac4d.htm). Try it out
[here](http://tesseract.js.s3-website-us-east-1.amazonaws.com).

![screenshot](http://tesseract.js.s3-website-us-east-1.amazonaws.com/screenshot.png)

## how to play

Use the arrow keys to move blocks in the X and Z directions
(i.e. along the plane of the floor). Press V to rotate the current
piece. Press the spacebar to drop a piece. Alternatively, use the
number pad to move pieces in 8 different directions (includes
diagonals, with 1, 3, 7, and 9), rotate with 5, and drop with 0.

## game notes

Frac (and Frac4D) both use a slightly odd projection called [oblique,
or cabinet,
projection](http://en.wikipedia.org/wiki/Oblique_projection). Ideally
it should be possible to alter the projection simply by swapping out
the projection matrix with an orthogonal projection, which would allow
more intuitive rotation controls (mouse-look anyone?). There are some
bugs however that have prevented me from making this work perfectly,
so it's not supported right now.

Adding the fourth dimension is a higher priority, and it's not clear
to me that free rotation would make the game easier to play, although
rotation by fixed degrees certainly would. (Frac4D docks the player
points for rotating the board, and I find it extremely disorienting to
rotate while handling a piece in 4-dimensions, so I think there's some
improvement that could be made here, and intend to explore it).

## implementation notes

It's written in JavaScript using WebGL, and depends on the quite nice
[gl-matrix](http://glmatrix.net/) library for matrix math, but nothing
else, except a "modern" browser: I tested with Chrome, Firefox and
Safari on Mac OS X, and they all work, but you might need to fiddle to
enable WebGL depending on your browser and OS. If you find a problem
with it, but [this site](http://get.webgl.org/) works for you, please
let me know!
