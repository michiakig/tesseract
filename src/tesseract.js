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
    var BOARD_WIDTH = 5;
    var BOARD_DEPTH = 5;

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

    function makeOffsets(w, d, h) {
        var res = [];
        var origin = vec3.fromValues(0, 0, 0);
        res.push(origin);
        for(var x = 0; x < w; x++) {
            for(var y = 0; y < h; y++) {
                for(var z = 0; z < d; z++) {
                    res.push(vec3.fromValues(x - Math.floor(w/2), y - Math.floor(h/2), z - Math.floor(d/2)));
                }
            }
        }
        return res;
    }

    var pieceOffsets = [
        makeOffsets(1, 1, 1),
        makeOffsets(2, 1, 1),
        makeOffsets(3, 1, 1),
        makeOffsets(4, 1, 1),

        makeOffsets(2, 2, 1),
        makeOffsets(2, 2, 2),
        makeOffsets(3, 2, 2)
    ];

    var pieceColors = [
        [0.8,0,0.8,1],
        [0,0,0.8,1],
        [0,0.8,0,1],
        [0.9,0.26,0.07,1],

        [0.8,0,0,1],
        [0.9,0.8,0.1,1],
        [0.8,0,0.8,1]

    ].map(function(offset){ return vec4.fromValues.apply(vec4, offset); });

    function makePiece(shape, base) {
        return new Piece(base, pieceOffsets[shape], pieceColors[shape]);
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

    function Block(pos, color) {
        this.pos = pos;
        this.color = color;
        this.solid = new Thing(solidIndex, solidCount, this.color, WebGLRenderingContext.TRIANGLES);
        this.wire = new Thing(wireIndex, wireCount, WHITE, WebGLRenderingContext.LINE_STRIP);
        this.solid.move(pos[0] * BLOCK_SIZE, pos[1] * BLOCK_SIZE, pos[2] * BLOCK_SIZE);
        this.wire.move(pos[0] * BLOCK_SIZE, pos[1] * BLOCK_SIZE, pos[2] * BLOCK_SIZE);
    }
    Block.prototype.move = function(x, y, z) {
        this.pos[0] += x;
        this.pos[1] += y;
        this.pos[2] += z;
        this.solid.move(x * BLOCK_SIZE, y * BLOCK_SIZE, z * BLOCK_SIZE);
        this.wire.move(x * BLOCK_SIZE, y * BLOCK_SIZE, z * BLOCK_SIZE);
    };
    Block.prototype.draw = function(gl, program) {
        this.solid.draw(gl, program);
        this.wire.draw(gl, program);
    };

    /**
     * compare two blocks based on position, front to back, left to
     * right, bottom to top
     */
    function compare(a, b) {
        var ax = a.pos[0];
        var ay = a.pos[1];
        var az = a.pos[2];
        var bx = b.pos[0];
        var by = b.pos[1];
        var bz = b.pos[2];
        if(az < bz) {
            return -1;
        } else if(az > bz) {
            return 1;
        } else if(ax < bx) {
            return -1;
        } else if(ax > bx) {
            return 1;
        } else if(ay < by) {
            return -1;
        } else if(ay > by) {
            return 1;
        } else {
            return 0;
        }
    }

    function Piece(base, offsets, color) {
        this.base = base;
        this.offsets = offsets;
        this.color = color;
        this.makeBlocks();
    }
    Piece.prototype.makeBlocks = function() {
        this.blocks = this.offsets.map(function(off) {
            var pos = vec4.clone(this.base);
            vec4.add(pos, pos, off);
            return new Block(pos, this.color);
        }.bind(this));
        this.blocks.sort(compare);
    };
    Piece.prototype.move = function(x, y, z) {
        this.blocks.forEach(function(block) {
            block.move(x, y, z);
        });
        this.base[0] += x;
        this.base[1] += y;
        this.base[2] += z;
    };
    Piece.prototype.draw = function(gl, program) {
        this.blocks.forEach(function(block) {
            block.draw(gl, program);
        });
    };
    Piece.prototype.transformMat4 = function(mat) {
        this.offsets.forEach(function(offset) {
            vec3.transformMat4(offset, offset, mat);
            for(var i = 0; i < offset.length; i++) {
                offset[i] = Math.round(offset[i]);
            }
        });
        this.makeBlocks();
    };
    Piece.prototype.rotate = function(dir) {
        if(arguments.length < 1) {
            dir = 1;
        }
        switch(this.rotation % 3) {
            case 0: this.rotateX(dir); break;
            case 1: this.rotateY(dir); break;
            case 2: this.rotateZ(dir); break;
            default:
               throw new Error("Assertion failed, should never happen");
               break;
        }
        this.rotation++;
    };
    Piece.prototype.rotateX = function(dir) {
        if(arguments.length < 1) {
            dir = 1;
        }
        console.log('rotateX');
        var mat = mat4.create();
        mat4.rotateX(mat, mat, dir * Math.PI/2);
        this.transformMat4(mat);
    };
    Piece.prototype.rotateY = function(dir) {
        if(arguments.length < 1) {
            dir = 1;
        }
        console.log('rotateY');
        var mat = mat4.create();
        mat4.rotateY(mat, mat, dir * Math.PI/2);
        this.transformMat4(mat);
    };
    Piece.prototype.rotateZ = function(dir) {
        if(arguments.length < 1) {
            dir = 1;
        }
        console.log('rotateZ');
        var mat = mat4.create();
        mat4.rotateZ(mat, mat, dir * Math.PI/2);
        this.transformMat4(mat);
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
    Board.prototype.rangeCheck = function(piece) {
        for(var i in piece.blocks) {
            var block = piece.blocks[i];
            var outside = block.pos[0] < 0 || block.pos[0] >= BOARD_WIDTH || block.pos[1] < 0 || block.pos[1] >= BOARD_HEIGHT || block.pos[2] < 0 || block.pos[2] >= BOARD_DEPTH;
            if(outside || board.get(block.pos[0], block.pos[1], block.pos[2])) {
                return false;
            }
        }

        return true;
    };
    Board.prototype.get = function(x, y, z) {
        return this.board[y][x][z];
    };
    Board.prototype.set = function(x, y, z, thing) {
        this.board[y][x][z] = thing;
    };

    Board.prototype.addPiece = function(piece) {
        var that = this;
        piece.blocks.forEach(function(block) {
            that.set(block.pos[0], block.pos[1], block.pos[2], block);
        });
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
        var next = Math.floor(Math.random() * pieceOffsets.length);
        var offsets = pieceOffsets[next];
        piece = new Piece(vec3.fromValues(3, BOARD_HEIGHT-3, 2), pieceOffsets[next], pieceColors[next]);

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
            case 65: /* A */ update(); break;
            case 68: /* D */ break;
            case 81: /* Q */ break;
            case 69: /* E */ break;

            case 32: /* Space */
                while(board.rangeCheck(piece)) {
                    piece.move(0, -1, 0);
                }
                piece.move(0, 1, 0);
                break;

            case 86: /* V */
                piece.rotate(1);
                if(!board.rangeCheck(piece)) {
                    piece.rotate(-1);
                }
                break;

            case 90: /* Z */
                piece.rotateZ(1);
                if(!board.rangeCheck(piece)) {
                    piece.rotateZ(-1);
                }
                break;

            case 67: /* C */
                piece.rotateY();
                if(!board.rangeCheck(piece)) {
                    piece.rotateY();
                }
                break;

            case 88: /* X */
                piece.rotateX(1);
                if(!board.rangeCheck(piece)) {
                    piece.rotateX(-1);
                }
            break;

            case 37: /* left */  x = -1; break;
            case 38: /* up */    z = -1; break;
            case 39: /* right */ x =  1; break;
            case 40: /* down  */ z =  1; break;

            default: // console.log(evt.keyCode);
            break;
        }
        piece.move(x, y, z);
        if(!board.rangeCheck(piece)) {
            piece.move(-x, -y, -z);
        }
    }

    /**
     * update the game state
     */
    function update() {
        // try to move the piece down
        piece.move(0, -1, 0);
        if(!board.rangeCheck(piece)) {
            piece.move(0, 1, 0);
            board.addPiece(piece);

            for(var y = 0; y < BOARD_HEIGHT; ) {
                if(board.checkLevel(y)) {
                    board.deleteLevel(y);
                } else {
                    y++;
                }
            }
            var next = Math.floor(Math.random() * pieceOffsets.length);
            var offsets = pieceOffsets[next];
            piece = new Piece(vec3.fromValues(3, BOARD_HEIGHT-3, 2), pieceOffsets[next], pieceColors[next]);
        }
    }

    /**
     * draw the whole scene, then loop via requestAnimationFrame
     */
    function draw() {
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        grid.draw(gl, program);
        for(var y = 0; y < board.h; y++) {
            for(var z = 0; z < board.d; z++) {
                for(var x = 0; x < board.w; x++) {
                    if(board.get(x, y, z)) {
                        board.get(x, y, z).draw(gl, program);
                    } else {
                        for(var i in piece.blocks) {
                            if(piece.blocks[i].pos[0] === x && piece.blocks[i].pos[1] === y && piece.blocks[i].pos[2] === z) {
                                piece.blocks[i].draw(gl, program);
                            }
                        }
                    }
                }
            }
        }

        requestAnimationFrame(draw);
    }

    window.main = main;
})(window);
