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

    // indices into vertex attribute array (positions)
    var solidIndex, solidCount, wireIndex, wireCount;

    // gl context and compiled shader program
    var gl, program;

    var grid;
    var thing;

    /**
     * Low-level thing that can be drawn. includes an index and count
     * for the position vertex array, a color, a type (TRIANGLES,
     * TRIANGLE_STRIP, etc)
     */
    function Thing(index, count, color, type) {
        this.index = index;
        this.count = count;
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
        gl.drawArrays(this.type, this.index, this.count);
    };

    function Block(x, y, z, color) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.solid = new Thing(solidIndex, solidCount, color, WebGLRenderingContext.TRIANGLES);
        this.wire = new Thing(wireIndex, wireCount, WHITE, WebGLRenderingContext.LINE_STRIP);
        this.solid.move(x * BLOCK_SIZE, y * BLOCK_SIZE, z * BLOCK_SIZE);
        this.wire.move(x * BLOCK_SIZE, y * BLOCK_SIZE, z * BLOCK_SIZE);
    }
    Block.prototype.move = function(x, y, z) {
        this.x += x;
        this.y += y;
        this.z += z;
        this.solid.move(x * BLOCK_SIZE, y * BLOCK_SIZE, z * BLOCK_SIZE);
        this.wire.move(x * BLOCK_SIZE, y * BLOCK_SIZE, z * BLOCK_SIZE);
    };
    Block.prototype.draw = function(gl, program) {
        this.solid.draw(gl, program);
        this.wire.draw(gl, program);
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

        solidIndex = gridGeom.count();
        solidCount = cubeSolidGeom.count();
        wireIndex = gridGeom.count() + cubeSolidGeom.count();
        wireCount = cubeWireGeom.count();

        thing = new Block(0, 0, 0, GREEN);
        thing.move(2, 2, 1);

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
            case 87: /* W */ y = 1; break;
            case 83: /* S */ y = -1; break;
            case 65: /* A */ break;
            case 68: /* D */ break;
            case 81: /* Q */ break;
            case 69: /* E */ break;

            case 37: /* left */  x = -1; break;
            case 38: /* up */    z = -1; break;
            case 39: /* right */ x =  1; break;
            case 40: /* down  */ z =  1; break;

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
