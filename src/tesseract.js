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
    var BOARD_WIDTH = 2;
    var BOARD_DEPTH = 2;

    var YELLOW = new Float32Array([1, 1, 0, 1]);
    var GREEN = new Float32Array([0, 0.8, 0, 1]);
    var WHITE = new Float32Array([1, 1, 1, 1]);

    function randColor() {
        var r = Math.random();
        var g = Math.random();
        var b = Math.random();
        return new Float32Array([r, g, b, 1]);
    }

    // individual grid lines dims in px
    var GRID_THICKNESS = 2;

    // indices into vertex attribute array (positions)
    var solidIndex, solidCount, wireIndex, wireCount;

    // gl context and compiled shader program
    var gl, program;

    var grid; // game grid lines (static background)
    var board; // game board (actual data, dynamically updated)
    var piece; // currently "live" piece

    function rangeCheck(x, y, z) {
        var inside = x >= 0 && x < BOARD_WIDTH && y >= 0 && y < BOARD_HEIGHT && z >= 0 && z < BOARD_DEPTH;
        return inside && !board.get(x, y, z);
    }

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
        // adjust into view on screen
        mat4.translate(this.model, this.model, vec3.fromValues(50, 50, 0));
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

    /**
     * 3-dimensional game board
     */
    function Board(w, d, h) {
        this.w = w;
        this.d = d;
        this.h = h;
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
     * Call fn on each block, in the order from bottom to top, back to
     * front, left to right
     */
    Board.prototype.forEach = function(fn) {
        for(var y = 0; y < this.h; y++) {
            for(var z = 0; z < this.d; z++) {
                for(var x = 0; x < this.w; x++) {
                    fn(this.get(x, y, z));
                }
            }
        }
    };
    /**
     * Returns true if this level is filled
     */
    Board.prototype.checkLevel = function(i) {
        var level = this.board[i];
        for(var x = 0; x < this.w; x++) {
            for(var z = 0; z < this.d; z++) {
                if(!level[x][z]) {
                    return false;
                }
            }
        }
        return true;
    };
    /**
     * Delete a level and move levels above it down
     */
    Board.prototype.deleteLevel = function(i) {
        this.board[i] = this.board[i + 1];
        for(var k = 0; k < this.board[i].length; k++) {
            for(var l = 0; l < this.board[i][k].length; l++) {
                if(this.board[i][k][l]) {
                    this.board[i][k][l].move(0, -1, 0);
                }
            }
        }

        for(var j = i + 1; j < this.h - 1; j++) {
            this.board[j] = this.board[j + 1];
            for(k = 0; k < this.board[j].length; k++) {
                for(l = 0; l < this.board[j][k].length; l++) {
                    if(this.board[j][k][l]) {
                        this.board[j][k][l].move(0, -1, 0);
                    }
                }
            }
        }
        this.board[this.h - 1] = new Array(this.w);
        for(var x = 0; x < this.w; x++) {
            this.board[this.h - 1][x] = new Array(this.d);
        }
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
        mat4.translate(grid.model, grid.model, vec3.fromValues(0, 0, 1));

        solidIndex = gridGeom.count();
        solidCount = cubeSolidGeom.count();
        wireIndex = gridGeom.count() + cubeSolidGeom.count();
        wireCount = cubeWireGeom.count();

        board = new Board(BOARD_WIDTH, BOARD_DEPTH, BOARD_HEIGHT);
        piece = new Block(0, BOARD_HEIGHT-1, 0, randColor());
        board.set(0, BOARD_HEIGHT-1, 0, piece);

        // upload all the geometry
        var geometry = gridGeom.combine(cubeSolidGeom, cubeWireGeom);
        pushData(gl, geometry.flatten());
        updateAttrib(gl, program, 'pos', 4);

        document.body.addEventListener('keydown', handle);
        draw();

        setInterval(update, 500);
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
        if(rangeCheck(piece.x + x, piece.y + y, piece.z + z)) {
            board.set(piece.x, piece.y, piece.z, undefined);
            piece.move(x, y, z);
            board.set(piece.x, piece.y, piece.z, piece);
        }
    }

    /**
     * update the game state
     */
    function update() {
        // move the piece down, if possible
        if(rangeCheck(piece.x, piece.y - 1, piece.z)) {
            board.set(piece.x, piece.y, piece.z, undefined);
            piece.move(0, -1, 0);
            board.set(piece.x, piece.y, piece.z, piece);
        } else { // else the piece is at rest, create a new piece, check for cleared level
            for(var y = 0; y < BOARD_HEIGHT; ) {
                if(board.checkLevel(y)) {
                    console.log('deleting level ' + y);
                    board.deleteLevel(y);
                } else {
                    y++;
                }
            }
            piece = new Block(0, BOARD_HEIGHT-1, 0, randColor());
            board.set(0, BOARD_HEIGHT-1, 0, piece);
        }
    }

    /**
     * draw the whole scene, then loop via requestAnimationFrame
     */
    function draw() {
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        grid.draw(gl, program);
        board.forEach(function(block) {
            if(block) {
                block.draw(gl, program);
            }
        });

        requestAnimationFrame(draw);
    }

    window.main = main;
})(window);
