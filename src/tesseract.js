;(function(window) {
    var gl;
    var program;

    var gridThing;
    var cubeThing;

    var requestAnimationFrame =
        window.requestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.msRequestAnimationFrame;

    /**
     * 3-dimensional game board
     */
    function Board(w, d, h) {
        var board = new Array(h);
        for(var i = 0; i < h; i++) {
            board[i] = new Array(w);
            for(var j = 0; j < w; j++) {
                board[i][j] = new Array(d);
            }
        }
        this.board = board;
    }
    Board.prototype.get = function(x, y, z) {
        return this.board[y][x][z];
    };
    Board.prototype.set = function(x, y, z, thing) {
        this.board[y][x][z] = thing;
    };

    /**
     * thing that can be drawn.
     * includes an index and count for the position vertex array
     * a color, a type (gl.TRIANGLES, gl.TRIANGLE_STRIP, etc) and a model matrix
     */
    function Thing(idx, ct, color, type) {
        this.idx = idx;
        this.ct = ct;
        this.color = color;
        this.type = type;
        this.model = mat4.create();
    }
    Thing.prototype.move = function(x, y, z) {
        var v = vec3.fromValues(x, y, z);
        mat4.translate(this.model, this.model, v);
    };
    Thing.prototype.draw = function(gl, pgm) {
        var loc = gl.getUniformLocation(program, 'umodel');
        gl.uniformMatrix4fv(loc, false, this.model);

        loc = gl.getUniformLocation(pgm, 'ucolor');
        gl.uniform4fv(loc, this.color);
        gl.drawArrays(this.type, this.idx, this.ct);
    };

    /**
     * compose a solid thing and a wireframe thing to form a Cube thing
     */
    function Cube(solid, wireframe) {
        this.solid = solid;
        this.wireframe = wireframe;
    }
    Cube.prototype.move = function(x, y, z) {
        this.solid.move(x, y, z);
        this.wireframe.move(x, y, z);
    };
    Cube.prototype.draw = function(gl, pgm) {
        this.solid.draw(gl, pgm);
        this.wireframe.draw(gl, pgm);
    };

    function main() {
        // compatibility boilerplate
        if(!window.WebGLRenderingContext) {
            document.body.innerHTML = "<p>uh oh, looks like your browser doesn't support <a href='http://get.webgl.org/'>WebGL</a></p>";
            return;
        }
        var canvas = document.getElementById('canvas');
        gl = canvas.getContext('experimental-webgl');
        if(!gl) {
            document.body.innerHTML = "<p>uh oh, failed to initialize WebGL! <a href='http://get.webgl.org/troubleshooting'>halp</a></p>";
            return;
        }

        gl.disable(gl.CULL_FACE);

        // set up shaders
        var vshader = document.getElementById('vertex').textContent;
        var fshader = document.getElementById('fragment').textContent;
        program = createProgram(gl, vshader, fshader);
        gl.useProgram(program);

        // prepare and load projection matrix
        var oblique = new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0.5*Math.sin(rad(-50)), 0.5*Math.sin(rad(-50)), 0, 0,
            0, 0, 0, 1
        ]);
        var ortho = mat4.create();
        mat4.ortho(ortho, 0, canvas.width, 0, canvas.height, -canvas.width/2, canvas.width/2);
        mat4.multiply(ortho, ortho, oblique);
        var loc = gl.getUniformLocation(program, 'uproj');
        gl.uniformMatrix4fv(loc, false, ortho);

        // create game grid
        var grid = makeGrid(2, 100, 25, 4, 13);
        var gridColor = new Float32Array([1, 1, 0, 1]);
        gridThing = new Thing(0, grid.count(), gridColor, gl.TRIANGLES);
        gridThing.move(50, 50, 0);

        // create cube, includes solid part
        var solid = makeCube(25);
        var solidThing = new Thing(grid.count(), solid.count(), new Float32Array([0, 0.8, 0, 1]), gl.TRIANGLES);

        // ... and wireframe part
        var wireframe = makeWireframeCube(25);
        var wireframeThing = new Thing(grid.count() + solid.count(), wireframe.count(), new Float32Array([1, 1, 1, 1]), gl.LINE_STRIP);

        cubeThing = new Cube(solidThing, wireframeThing);
        cubeThing.move(50, 50, 25);

        // upload all the geometry
        var geo = grid.union(solid, wireframe);
        pushData(gl, geo.flatten());
        updateAttrib(gl, program, 'pos', 4);

        document.body.addEventListener('keydown', handle);
        draw();
    }

    /**
     * handle keydown events
     */
    function handle(evt) {
        var x = 0, y = 0, z = 0;
        switch(evt.keyCode) {
            case 87: /* W */ break;
            case 83: /* S */ break;
            case 65: /* A */ break;
            case 68: /* D */ break;
            case 81: /* Q */ break;
            case 69: /* E */ break;

            case 37: /* left */  x = -25; break;
            case 38: /* up */    z = -25; break;
            case 39: /* right */ x =  25; break;
            case 40: /* down  */ z =  25; break;

            default: // console.log(evt.keyCode);
            break;
        }
        cubeThing.move(x, y, z);
    }

    /**
     * draw the whole scene, then loop via requestAnimationFrame
     */
    function draw() {
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gridThing.draw(gl, program);
        cubeThing.draw(gl, program);

        requestAnimationFrame(draw);
    }

    window.main = main;
})(window);
