/**
 * tesseract application code
 */
;(function(window) {
    var requestAnimationFrame =
            window.requestAnimationFrame ||
            window.mozRequestAnimationFrame ||
            window.webkitRequestAnimationFrame ||
            window.msRequestAnimationFrame;

    // offsets in pixels added to all drawing (from lower left)
    var WORLD_OFFSET_X = 150;
    var WORLD_OFFSET_Y = 50;

    // block dims in px
    var BLOCK_SIZE = 25;

    // board dims in blocks
    var BOARD_HEIGHT = 13;
    var BOARD_WIDTH = 5;
    var BOARD_DEPTH = 5;

    var YELLOW  = new Float32Array([1,     1,   0, 1]);
    var WHITE   = new Float32Array([1,     1,   1, 1]);
    var PURPLE  = new Float32Array([0.8,   0, 0.8, 1]);
    var BLUE    = new Float32Array([0,     0, 0.8, 1]);
    var GREEN   = new Float32Array([0,   0.8,   0, 1]);
    var ORANGE1 = new Float32Array([0.9, 0.3, 0.1, 1]);
    var RED     = new Float32Array([0.8,   0,   0, 1]);
    var DARK_YELLOW = new Float32Array([0.9, 0.8, 0.1, 1]);

    // individual grid lines dims in px
    var GRID_THICKNESS = 2;

    // indices into vertex attribute array (positions)
    var solidIndex, solidCount, wireIndex, wireCount;
    var guideBackIndex, guideBackCount, guideSideIndex, guideSideCount;

    // gl context and compiled shader program
    var gl, program;

    var grid; // game grid lines (static background)
    var board; // game board (actual data, dynamically updated)
    var piece; // currently "live" piece
    var guide; // helpful guides at the top of the grid, to help orient the board and piece

    // number of layers cleared
    var layers = 0;

    // width, depth, height and color of shapes
    var shapes = [
        {w: 1, d: 1, h: 1, c: PURPLE},
        {w: 1, d: 1, h: 2, c: BLUE},
        {w: 1, d: 1, h: 3, c: GREEN},
        {w: 1, d: 1, h: 4, c: ORANGE1},
        {w: 2, d: 2, h: 1, c: RED},
        {w: 2, d: 2, h: 2, c: DARK_YELLOW},
        {w: 2, d: 2, h: 3, c: PURPLE}
    ];

    var debug = false;
    function log(s) {
        if(debug) {
            console.log(s);
        }
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
        mat4.translate(this.model, this.model, vec3.fromValues(WORLD_OFFSET_X, WORLD_OFFSET_Y, 0));
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

    /**
     * highlighted squares in grid indicating position of live piece in world: position, width and depth in blocks
     */
    function Guide(piece) {
        var x = Infinity, z = Infinity;
        piece.offsets.forEach(function(offset) {
            if(offset[0] < x) {
                x = offset[0];
            }
            if(offset[2] < z) {
                z = offset[2];
            }
        });
        var pos = vec3.fromValues(piece.base[0]+x, BOARD_HEIGHT-1, piece.base[2]+z);
        var w = piece.w;
        var d = piece.d;

        this.sides = []; // for left side of grid
        this.backs = []; // for back of grid
        var thing;
        for(var i = 0; i < w; i++) {
            thing = new Thing(guideBackIndex, guideBackCount, WHITE, WebGLRenderingContext.TRIANGLES);
            thing.move(BLOCK_SIZE * (pos[0] + i), BLOCK_SIZE * pos[1], 0);
            this.backs.push(thing);
        }
        for(var j = 0; j < d; j++) {
            thing = new Thing(guideSideIndex, guideSideCount, WHITE, WebGLRenderingContext.TRIANGLES);
            thing.move(0, BLOCK_SIZE * pos[1], BLOCK_SIZE * (pos[2] + j));
            this.sides.push(thing);
        }
    }
    Guide.prototype.draw = function(gl, program) {
        this.backs.forEach(function(back){
            back.draw(gl, program);
        });
        this.sides.forEach(function(side){
            side.draw(gl, program);
        });
    };
    Guide.prototype.move = function(x, y, z) {
        // move guides on back only by X, on side only by Z.
        // fixes the guides flush to the top of the grid
        this.backs.forEach(function(back){
            back.move(x * BLOCK_SIZE, 0, 0);
        });
        this.sides.forEach(function(side){
            side.move(0, 0, z * BLOCK_SIZE);
        });
    };

    /**
     * A colored block, the component making up pieces
     * position in blocks, Float32Array color
     */
    function Block(pos, color) {
        this.pos = pos;
        this.color = color;
        // blocks consist of a colored solid part and a white wireframe part
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

    /**
     * A game piece, always a rectangular solid: w x d x h
     */
    function Piece(base, w, d, h, color) {
        function makeOffsets(w, d, h) {
            var res = [];
            for(var x = 0; x < w; x++) {
                for(var y = 0; y > -h; y--) {
                    for(var z = 0; z < d; z++) {
                        res.push(vec3.fromValues(x, y, z));
                    }
                }
            }
            return res;
        }

        // pieces are defined by a base position...
        this.base = base;
        this.w = w;
        this.d = d;
        this.h = h;
        this.color = color;
        // ...and a list of offsets from that position
        this.offsets = makeOffsets(w, d, h);
        this.rotation = 0;
        this.makeBlocks();
        // for example, the square piece:
        //   ox
        //   xx
        // where `o` is base, would have the offsets:
        // [(0,0,0),(1,0,0),(0,-1,0),(1,-1,0)]
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
    /**
     * rotate the piece semi-intelligently
     * dir should be 1 or -1, forward and backward rotations
     */
    Piece.prototype.rotate = function(dir) {
        log('rotate('+dir+')');
        if(dir < 0) {
            this.rotation--;
        }
        // pick an axis to rotate around
        switch(this.rotation % 3) {
            case 0: this.rotateZ(dir); break;
            case 1: this.rotateY(dir); break;
            case 2: this.rotateX(dir); break;
        }
        if(dir > 0) {
            this.rotation++;
        }
    };
    Piece.prototype.rotateX = function(dir) {
        log('rotateX('+dir+')');
        var mat = mat4.create();
        mat4.rotateX(mat, mat, dir * Math.PI/2);
        this.transformMat4(mat);
        this.updateDims();
        return true;
    };
    Piece.prototype.rotateY = function(dir) {
        log('rotateY('+dir+')');
        var mat = mat4.create();
        mat4.rotateY(mat, mat, dir * Math.PI/2);
        this.transformMat4(mat);
        this.updateDims();
        return true;
    };
    Piece.prototype.rotateZ = function(dir) {
        log('rotateZ('+dir+')');
        var mat = mat4.create();
        mat4.rotateZ(mat, mat, dir * Math.PI/2);
        this.transformMat4(mat);
        this.updateDims();
        return true;
    };
    Piece.prototype.updateDims = function() {
        var left = 0;
        var right = 0;
        var top = 0;
        var bot = 0;
        var front = 0;
        var back = 0;
        this.offsets.forEach(function(offset) {
            if(offset[0] < left) {
                left = offset[0];
            }
            if(offset[1] < bot) {
                bot = offset[1];
            }
            if(offset[2] < back) {
                back = offset[2];
            }
            if(offset[0] > right) {
                right = offset[0];
            }
            if(offset[1] > top) {
                top = offset[1];
            }
            if(offset[2] > front) {
                front = offset[2];
            }
        });
        this.w = right - left + 1;
        this.d = front - back + 1;
        this.h = top - bot + 1;
    };

    /**
     * 3-dimensional game board, keeps track of frozen pieces for collision detection and filling layers
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
    Board.prototype.count = function() {
        var count = 0;
        for(var x = 0; x < this.w; x++) {
            for(var y = 0; y < this.h; y++) {
                for(var z = 0; z < this.d; z++) {
                    if(this.get(x, y, z)) {
                        count++;
                    }
                }
            }
        }
        return count;
    };
    /**
     * return false if the piece is out of bounds --
     * colliding with a frozen block or outside the grid
     * otherwise true
     */
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

    /**
     * init function called once on document load
     */
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

        // geometry for the guides
        var guideBackGeo = makeBack(BLOCK_SIZE);
        var guideSideGeo = makeSide(BLOCK_SIZE);

        grid = new Thing(0, gridGeom.count(), YELLOW, gl.TRIANGLES);
        mat4.translate(grid.model, grid.model, vec3.fromValues(0, 0, 1));

        solidIndex = gridGeom.count();
        solidCount = cubeSolidGeom.count();
        wireIndex = gridGeom.count() + cubeSolidGeom.count();
        wireCount = cubeWireGeom.count();

        guideBackIndex = gridGeom.count() + cubeSolidGeom.count() + cubeWireGeom.count();
        guideBackCount = guideBackGeo.count();
        guideSideIndex = gridGeom.count() + cubeSolidGeom.count() + cubeWireGeom.count() + guideBackGeo.count();
        guideSideCount = guideSideGeo.count();

        board = new Board(BOARD_WIDTH, BOARD_DEPTH, BOARD_HEIGHT);
        piece = randomPiece();
        guide = new Guide(piece);

        // upload all the geometry
        var geometry = gridGeom.combine(cubeSolidGeom, cubeWireGeom, guideBackGeo, guideSideGeo);
        pushData(gl, geometry.flatten());
        updateAttrib(gl, program, 'pos', 4);

        document.body.addEventListener('keydown', handle);
        draw();
        togglePause();
    }

    function randomPiece() {
        var next = Math.floor(Math.random() * shapes.length);
        var offsets = shapes[next];
        return new Piece(vec3.fromValues(0, BOARD_HEIGHT-1, 0), shapes[next].w, shapes[next].d, shapes[next].h, shapes[next].c);
    }

    function togglePause() {
        if(update.intervalOn) {
            log('(paused)');
            clearInterval(update.intervalID);
            update.intervalOn = false;
        } else {
            log('(unpaused)');
            update.intervalID = setInterval(update, 750);
            update.intervalOn = true;
        }
    }

    /**
     * handle keydown events
     */
    function handle(evt) {
        if(redraw.on) {
            redraw.on = false;
            return;
        }
        var x = 0, y = 0, z = 0;
        switch(evt.keyCode) {
            /**
             * Main game input
             */
            case 37: /* left */  x = -1; break;
            case 38: /* up */    z = -1; break;
            case 39: /* right */ x =  1; break;
            case 40: /* down  */ z =  1; break;

            case 49: case 97: /* 1 */ x = -1; z =  1; break;
            case 50: case 98: /* 2 */ z =  1;         break;
            case 51: case 99: /* 3 */ x =  1; z =  1; break;
            case 52: case 100: /* 4 */ x = -1;         break;
            case 54: case 102: /* 6 */ x =  1;         break;
            case 55: case 103: /* 7 */ x = -1; z = -1; break;
            case 56: case 104: /* 8 */         z = -1; break;
            case 57: case 105: /* 9 */ x = -1; z = -1; break;

            case 80: /* P */ togglePause(); break;

            case 96: case 32: /* Space: drop the piece */
                while(board.rangeCheck(piece)) {
                    piece.move(0, -1, 0);
                }
                piece.move(0, 1, 0);
                break;

            case 53: case 101: /* 5 */
            case 86: /* V */
                piece.rotate(1);
                while(!board.rangeCheck(piece)) {
                    piece.rotate(1);
                }
                guide = new Guide(piece);
                break;

            /**
             * debug input
             */
            case 16: /* Shift */
                if(debug) {
                    piece = randomPiece();
                    guide = new Guide(piece);
                }
                break;

            case 87: /* W */
                if(debug) {
                    y = 1;
                }
                break;

            case 83: /* S */
                if(debug) {
                    y = -1;
                }
                break;

            case 65: /* A */
                if(debug) {
                    update();
                }
                break;

            case 90: /* Z */
                if(debug) {
                    piece.rotateZ(1);
                    if(!board.rangeCheck(piece)) {
                        piece.rotateZ(1);
                    }
                }
                break;

            case 67: /* C */
                if(debug) {
                    piece.rotateY(1);
                    if(!board.rangeCheck(piece)) {
                        piece.rotateY(1);
                    }
                }
                break;

            case 88: /* X */
                if(debug) {
                    piece.rotateX(1);
                    if(!board.rangeCheck(piece)) {
                        piece.rotateX(1);
                    }
                }
            break;

            default: console.log(evt.keyCode);
            break;
        }

        piece.move(x, y, z);
        guide.move(x, y, z);
        if(!board.rangeCheck(piece)) {
            piece.move(-x, -y, -z);
            guide.move(-x, -y, -z);
        }
    }

    /**
     * update the game state, called to drop the piece one step
     */
    function update() {
        // try to move the piece down
        piece.move(0, -1, 0);
        if(!board.rangeCheck(piece)) {
            // piece collided with frozen blocks, freeze the piece
            piece.move(0, 1, 0);
            board.addPiece(piece);

            // check for cleared layers
            var deleted = false;
            for(var y = 0; y < BOARD_HEIGHT; ) {
                if(board.checkLevel(y)) {
                    deleted = true;
                    board.deleteLevel(y);
                    layers++;
                } else {
                    y++;
                }
            }
            if(deleted) {
                redraw();
            }
            var score = document.getElementById('score');
            score.innerHTML = 'layers: ' + layers;

            // set up the next piece
            piece = randomPiece();
            guide = new Guide(piece);
            if(!board.rangeCheck(piece)) { // new piece collides, game over
                togglePause();
                var status = document.getElementById('status');
                status.innerHTML = 'game over!';
            }
        }
    }

    /**
     * call to start a slow redraw of the board
     */
    function redraw() {
        log('redraw start ' + redraw.counter);
        togglePause();
        redraw.on = true;
        redraw.counter = 0;
        redraw.id = setInterval(function() {
            redraw.counter++;
            if(!redraw.on || redraw.counter >= board.count()) {
                log('redraw done ' + redraw.counter);
                clearInterval(redraw.id);
                redraw.on = false;
                redraw.id = undefined;
                redraw.counter = 0;
                togglePause();
            }
        }, 100);
    }
    redraw.on = false;
    redraw.id = undefined;
    redraw.counter = 0;

    /**
     * draw the whole scene, looping via requestAnimationFrame
     */
    function draw() {
        requestAnimationFrame(draw);

        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        grid.draw(gl, program);

        // draw the piece location help indicators (white squares at top of grid)
        guide.draw(gl, program);

        var drawn = 0;
        // after drawing the grid, draw the field of frozen pieces along with the live piece
        // draw from back to front, left to right, bottom to top.
        // interleave drawing the blocks in the live piece with the field
        // *should* be greatly able to simplify this logic and use WebGL depth buffer
        for(var y = 0; y < board.h; y++) {
            for(var z = 0; z < board.d; z++) {
                for(var x = 0; x < board.w; x++) {

                    if(board.get(x, y, z)) {
                        // if currently doing a redraw, draw up to redraw.counter blocks then stop
                        if(redraw.on && drawn >= redraw.counter) {
                            return;
                        }
                        // draw a single block
                        board.get(x, y, z).draw(gl, program);
                        drawn++;
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

    }

    window.main = main;
})(window);
