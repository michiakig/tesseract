;(function(window) {
    var requestAnimationFrame =
            window.requestAnimationFrame ||
            window.mozRequestAnimationFrame ||
            window.webkitRequestAnimationFrame ||
            window.msRequestAnimationFrame;

    // block dims in px
    var BLOCK_SIZE = 25;

    // board dims in blocks
    var BOARD_HEIGHT = 13;
    var BOARD_WIDTH = 4;
    var BOARD_DEPTH = 4;

    var YELLOW = new Float32Array([1, 1, 0, 1]);
    var GREEN = new Float32Array([0, 0.8, 0, 1]);
    var WHITE = new Float32Array([1, 1, 1, 1]);

    // individual grid lines dims in px
    var GRID_THICKNESS = 2;

    // gl context and compiled shader program
    var gl, program;

    var grid;
    var thing;

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

    function Piece(things) {
        this.things = things;
    }
    Piece.prototype.add = function(thing) {
        this.things.push(thing);
    };
    Piece.prototype.move = function(x, y, z) {
        this.things.forEach(function(thing) {
            thing.move(x, y, z);
        });
    };
    Piece.prototype.draw = function(gl, pgm) {
        this.things.forEach(function(thing) {
            thing.draw(gl, pgm);
        });
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

        // create geometry for game grid
        var gridGeom = makeGrid(GRID_THICKNESS, BLOCK_SIZE, BOARD_WIDTH, BOARD_DEPTH, BOARD_HEIGHT);
        var cubeSolidGeom = makeCube(BLOCK_SIZE); // create geometry for solid part of cube
        var cubeWireGeom = makeWireframeCube(BLOCK_SIZE); // ... and wireframe part

        grid = new Thing(0, gridGeom.count(), YELLOW, gl.TRIANGLES);
        grid.move(BLOCK_SIZE * 2, BLOCK_SIZE * 2, 0);

        var solid1 = new Thing(gridGeom.count(), cubeSolidGeom.count(), GREEN, gl.TRIANGLES);
        var wire1 = new Thing(gridGeom.count() + cubeSolidGeom.count(), cubeWireGeom.count(), WHITE, gl.LINE_STRIP);
        var cube1 = new Cube(solid1, wire1);

        thing = new Piece([cube1]);
        thing.move(BLOCK_SIZE * 2, BLOCK_SIZE * 2, 25);

        // upload all the geometry
        var geometry = gridGeom.combine(cubeSolidGeom, cubeWireGeom);
        pushData(gl, geometry.flatten());
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
            case 87: /* W */ y = 25; break;
            case 83: /* S */ y = -25; break;
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
        thing.move(x, y, z);
    }

    /**
     * draw the whole scene, then loop via requestAnimationFrame
     */
    function draw() {
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        grid.draw(gl, program);
        thing.draw(gl, program);

        requestAnimationFrame(draw);
    }

    window.main = main;
})(window);
