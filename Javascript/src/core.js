/*
#DSV:0.5#
Collision Response - http://elancev.name/oliver/2D%20polygon.htm
*/
/**
 * @file DEngine - Physics Engine for Javascript
 * @author Driconmax <driconmax@gmail.com>
 * @version 1.0
 * @todo Constrains, Convex Colliders, Multiplayer,
 *
 * @module $e
*/

(function(window){

    'use strict';

    /**
    * The DEngine
    */
    var $e = new function(){

        var constants = {
            //g: 6674*Math.pow(10,-11)
            g: 0.01
        };

        var internal = {
            debug: true,
            catchup: false,
            started: false,
            canvas: "",
            ctx: "",
            textcolor: 'black',
            size: 0,
            time: {
                FPS: 1,
                FPScount: 0,
                FPSsum: 0,
                lossedFrames: 0,
                maxFPS: 60,
                minFPS: 20,
                deltaTime: 1,
                startTime: 0,
                behindTime: 0,
                elapsedTime: 0,
                miliseconds: 0,
                speed: 1, //Multiplier
                catchUpTime: 1/8, //S
                intervalClear: 10000, //MS
                elapsedLastClear: 0, //MS
                intervalRestartDelay: 40 //MS
            },
            controlVars: {
                update: {
                    finish: false,
                    exceeded: 0,
                    alert: 50,
                    alerted: false
                },
                start: false
            },
            debugVars: [],
            console: {
                history: [],
                border: false,
                font: '7pt Calibri',
                color: 'black'
            },
            world: {
                gravity: 10,
                drag: 1
            },
            globals: {
                maxForce: 150,
                opacity: 0.9,
                background: "#FFF"
            },
            mouse: {
                over: undefined,
                selected: [],
                obj: undefined,
                click: {
                    left: false,
                    middle: false,
                    right: false
                }
            },
            camera: {
                zoom: 1
            },
            inputs: {},
            layers: [],
            phycs: [],
            threads: {
                phx: {
                    obj: undefined,
                    msgTail: []
                },
                msgId: 0,
                cbTail: {} //id,cb
            },
            user: {}
        };

        //Public Functions start

        /**
        * Starts the engine
        *
        * @param  {element} canvas The html element of the canvas
        * @param  {function} start  The user function to be called when the engine starts
        * @param  {function} update The user function to be called on each frame
        */
        this.init = function(canvas, start, update){
            if(!internal.started){
                if(canvas != undefined && typeof canvas == "object"){
                    if(typeof start == "function" && typeof update == "function"){
                        try {
                            internal.canvas = canvas;
                            internal.ctx = canvas.getContext("2d");
                            internal.size = new this.Vector2(0,0);
                            internal.size.x = canvas.width;
                            internal.size.y = canvas.height;
                            internal.user.start = start;
                            internal.user.udpate = update;
                            Start();
                            internal.started = true;
                        } catch (e) {
                            $d.LogError("The element is not a canvas", e);
                        }
                    } else {
                        $d.LogError("Missing Start/Update functions");
                    }
                } else {
                    $d.LogError("Invalid element");
                }
            } else {
                $d.LogWarning("The engine is already running!");
            }
        };

        this.getInternal = function(){
            return internal;
        }

        this.setTextColor = function(value){
            if($d.ValidateInput(arguments, ["string"])){
                internal.textcolor = value;
            }
        }

        /**
         * Sets the main camera zoom
         * @param {number} value Zoom value
         */
        this.setZoom = function(value){
            if($d.ValidateInput(arguments, ["number"])){
                if(value > 0){
                    internal.camera.zoom = value;
                } else {
                    $d.LogError("The camera Zoom need to be less than 0");
                }
            }
        }

        /**
        * Sets the maximum fps of the engine
        *
        * @param  {number} value MAX FPS
        */
        this.setMaxFPS = function(value){
            if($d.ValidateInput(arguments, ["number"])){
                internal.time.maxFPS = value;
            }
        };

        /**
        * Enables the debug mode
        *
        * @param  {boolean} value On/Off
        */
        this.setDebug = function(value){
            if($d.ValidateInput(arguments, ["boolean"])){
                internal.debug = value;
            }
        };

        /**
        * Sets the speed of the engine (Default: 1)
        *
        * @param  {type} value Speed value
        */
        this.setSpeed = function(value){
            if($d.ValidateInput(arguments, ["number"])){
                internal.time.speed = value;
            }
        };

        /**
        * Sets the gravity for the physics calcs (Default: 9.98)
        *
        * @param  {number} value The gravity aceleration
        */
        this.setGravity = function(value){
            if($d.ValidateInput(arguments, ["number"])){
                internal.world.gravity = value;
                internal.threads.phx.msgTail.push({
                    data: {
                        fn: 'setGravity',
                        value: internal.world.gravity
                    }
                });
            }
        };

        /**
        * Enables the Catch Up function. This function checks if the engine is running slower than the expected speed and tryies to catch up with the expected main timeline
        *
        * @param  {boolean} value On/Off
        */
        this.setCatchUp = function(value){
            if($d.ValidateInput(arguments, ["boolean"])){
                internal.catchUp = value;
            }
        };

        /**
        * Sets the background color (Default: #FFF)
        *
        * @param  {number} value The Color in HEX
        */
        this.setBackground = function(value){
            if($d.ValidateInput(arguments, ["string"])){
                internal.globals.background = value;
            }
        };

        /**
        * Prints the actual engine stats
        */
        this.stats = function(){
            $d.Log("STATS");
            $d.Log("FPS: " + internal.time.FPS);
            $d.Log("Current state: " + ((internal.started)? "Running" : "Stopped"));
            $d.Log("Frame loss count: " + internal.time.lossedFrames);
            $d.Log("Elapsed Time: " + $d.FormatMiliseconds(internal.time.elapsedTime));
            $d.Stats();
        };

        /**
        * Adds a Object2D to the engine in a specified layer
        *
        * @param  {Object2D} The Object2D
        * @param  {number} layer The layer of the object (-50 to 50)
        */
        this.add2DObject = function(obj, layer){
            if($d.ValidateInput(arguments, ["object","number"])){
                if(internal.layers[layer+50] == undefined){
                    internal.layers[layer+50] = [];
                }
                obj.id = internal.layers[layer+50].push(obj);
                obj.layer = layer;
            }
        };

        /**
        * Adds an object to the debug console
        *
        * @param  {string} name     Name to be displayed
        * @param  {object} obj      The object
        * @param  {string[]} vars     The vars that are going to be debugged
        * @param  {number} duration The duration in scren of the Debbug in seconds
        */
        this.addDebugObject = function(name, obj, vars, duration){
            if($d.ValidateInput(arguments, ["string","object","array[string]"],["number"])){
                internal.debugVars.push({
                    name: name,
                    obj: obj,
                    vars: vars,
                    duration: duration
                });
            }
        };

        /**
        * Writes a message to the debug console
        *
        * @param  {string} string Message
        * @param  {number} type   Type of message
        */
        this.writeDebugConsole = function(string, type){
            internal.console.history.push({name: string, type: type});
        };

        /**
        * Checks if the key is pressed
        * 
        * @param  {string}   keyCode The Key Code
        * @return {bool}             Status of the key
        */
        this.getKey = function(keyCode){
            if(internal.inputs[keyCode] != undefined){
                return internal.inputs[keyCode];
            }
            return false;
        }

        //close

        //Private functions start

        function Start(){
            internal.controlVars.update.finish = true;
            var sd = new Date().getTime();
            internal.time.miliseconds = sd;
            //internal.mouse.obj = new $e.Vector2(0,0);

            //Creates a new console
            internal.console.size = new $e.Vector2(50,50);
            internal.console.position = new $e.Vector2(internal.size.x - internal.console.size.x,0);

            //Creates the object for the mouse position
            internal.mouse.obj = new $e.Object2D("Mouse", new $e.Vector2(0, 0), 1, 1, 1);
            internal.mouse.obj.setCollider(new $e.BoxCollider(0.1,0.1), true);

            internal.camera.obj = new $e.BaseObject2D("MainCamera", new $e.Vector2(0,0));

            internal.canvas.addEventListener('mousemove', function(evt) {
                UpdateMousePos(internal.canvas, evt);
            }, false);

            internal.canvas.addEventListener("mousedown", function(evt) {
                UpdateMouseAction(evt, true);
            });

            internal.canvas.addEventListener("mouseup", function(evt) {
                UpdateMouseAction(evt, false);
            });

            window.addEventListener("keydown", function(evt){
                UpdateInputs(evt, true)
            });
            
            window.addEventListener("keyup", function(evt){
                UpdateInputs(evt, false)
            });

            window.addEventListener("mousewheel", function(evt){
                UpdateInputs({ code: "mousewheel" }, evt.wheelDeltaY);
                evt.preventDefault();
            })

            internal.time.interval = StartInterval();
            try{
                internal.user.start({
                    FPS: internal.time.FPS,
                    deltaTime: internal.time.deltaTime,
                    totalTime: internal.time.elapsedTime,
                    selected: internal.mouse.selected,
                    over: internal.mouse.over,
                    screenSize: internal.size,
                    mouse: {
                        pos: internal.mouse.obj.getPos()
                    },
                    camera: internal.camera.obj,
                    zoom: internal.camera.zoom,
                    objects: internal.layers
                });
            } catch(e){
                $d.LogError("Error in User Start function", e);
            }

            internal.threads.phx.obj = new Worker('src/physics.js');

            internal.threads.phx.msgTail.push({
                data: {
                    fn: 'setGravity',
                    value: internal.world.gravity
                }
            });

            internal.threads.phx.msgTail.push({
                data: {
                    fn: 'Start',
                        phycs: internal.phycs,
                        dv2: new $e.Vector2(0,0)
                },
                extra: {
                    cb: function(){
                        if(msg.data != undefined){
                            internal.phycs = msg.data;
                        }
                    }
                }
            });

            internal.threads.phx.obj.onchange = SendThreadMessages(internal.threads.phx);
            internal.threads.phx.obj.onmessage = function(e){ProcessThreadMessages(e)};
        }

        function SendThreadMessages(thread){
            for (var i = 0; i < thread.msgTail.length; i++) {
                if(thread.msgTail[i].extra != undefined && thread.msgTail[i].extra.cb != undefined){
                    thread.msgTail[i].data.id = "CBI" + internal.threads.msgId++;
                    internal.threads.cbTail[thread.msgTail[i].data.id] = thread.msgTail[i].extra.cb;
                }
                thread.obj.postMessage(thread.msgTail[i].data);
            }

            for (var i = thread.msgTail.length - 1; i >= 0; i--) {
                thread.msgTail.shift(i);
            }
        }

        function ProcessThreadMessages(msg){
            if(msg.data != undefined){
                if(internal.threads.cbTail[msg.data.id] != undefined){
                    internal.threads.cbTail[msg.data.id]();
                    if(msg.data.expd){
                        delete internal.threads.cbTail[msg.data.id];
                    }
                }            
            }
        }

        function StartInterval(){
            return setInterval(function(){
                if(internal.controlVars.update.finish){
                    internal.controlVars.update.finish = false;
                    internal.controlVars.update.alerted = false;
                    internal.controlVars.update.exceeded = 0;

                    var d = new Date().getTime();
                    var t = d - internal.time.miliseconds;
                    internal.time.elapsedTime += t;
                    internal.time.elapsedLastClear += t;
                    internal.time.deltaTime = (t/1000) * internal.time.speed;
                    internal.time.miliseconds = d;
                    internal.time.FPS = 1/(internal.time.deltaTime/internal.time.speed);
                    internal.time.FPSsum += internal.time.FPS;
                    internal.time.FPScount++;
                    if(internal.time.FPS > 0 && internal.time.FPS < internal.time.minFPS){
                        if(internal.catchUp){
                            $d.LogWarning("Running behind the main timeline ("+(internal.time.FPS+internal.time.behindTime)+" seconds) trying to catch up at " + internal.time.catchUpTime + " seconds per frame.");
                        }
                        internal.time.behindTime += internal.time.deltaTime;
                        internal.time.deltaTime = 1/internal.time.minFPS;
                    } else {
                        if(internal.time.behindTime > 0){
                            if(internal.catchUp){
                                if(internal.time.behindTime < internal.time.catchUpTime){
                                    internal.time.deltaTime += internal.time.behindTime * internal.time.speed;
                                    internal.time.behindTime = 0;
                                    $d.LogWarning("Main timeline reached.");
                                } else {
                                    internal.time.deltaTime += internal.time.catchUpTime * internal.time.speed;
                                    internal.time.behindTime -= internal.time.catchUpTime * internal.time.speed;
                                }
                            }
                        }

                    }
                    if(internal.time.elapsedLastClear >= internal.time.intervalClear){
                        internal.time.elapsedLastClear = 0;
                        clearInterval(internal.time.interval);
                        ReStartInterval();
                    } else {
                        Update();
                    }
                } else {
                    internal.controlVars.update.exceeded++;
                    internal.time.lossedFrames++;
                    if(internal.controlVars.update.exceeded >= internal.controlVars.update.alert){
                        $d.LogWarning("Loosing frames, consider using a lower maxFPS("+internal.time.FPS+") value or reivew your code.");
                        internal.controlVars.update.alerted = true;
                    }
                }
            }, 1000/internal.time.maxFPS);
        }

        function ReStartInterval(){
            setTimeout(function(){
                internal.controlVars.update.finish = true;
                internal.time.interval = StartInterval();
            }, internal.time.intervalRestartDelay);
        }

        function Update(){
            try{
                internal.user.udpate({
                    FPS: internal.time.FPS,
                    deltaTime: internal.time.deltaTime,
                    totalTime: internal.time.elapsedTime,
                    selected: internal.mouse.selected,
                    over: internal.mouse.over,
                    screenSize: internal.size,
                    mouse: {
                        pos: internal.mouse.obj.getPos()
                    },
                    camera: internal.camera.obj,
                    zoom: internal.camera.zoom,
                    objects: internal.layers
                });
                internal.inputs["mousewheel"] = 0;
            } catch(e){
                $d.LogError("Error in User Update function", e);
            }
            //UpdatePhysics();
            SendThreadMessages(internal.threads.phx);
            DrawObjects();
            //DrawFPS();
            DrawMousePosition();
            DrawDebug();
            DrawConsole();
            internal.controlVars.update.finish = true;
        }

        function DrawFPS(){
            internal.ctx.font = "12px Arial";
            internal.ctx.fillStyle = "#000";
            //internal.ctx.fillText("FPS: " + Math.ceil(internal.time.FPSsum / internal.time.FPScount),10,10);
            internal.ctx.fillText("FPS: " + Math.round(internal.time.FPS),10,10);
        }

        function DrawMousePosition(){
            var msg = 'Mouse position: ' + internal.mouse.obj.getPos().toString(0);
            internal.ctx.font = '8pt Calibri';
            internal.ctx.fillStyle = internal.textcolor;
            internal.ctx.fillText(msg, 10, 25);
        }

        function DrawConsole(){

        }

        function DrawDebug(){
            var offset = 0;
            for(var i = internal.debugVars.length - 1; i >= 0; i--){
                if(internal.debugVars[i].duration == undefined || internal.debugVars[i].duration > 0){
                    var finalObj = internal.debugVars[i].obj;
                    for(var x = 0; x < internal.debugVars[i].vars.length; x++){
                        finalObj = finalObj[internal.debugVars[i].vars[x]];
                    }
                    var msg = "";
                    if(finalObj.x != undefined){
                        msg = internal.debugVars[i].name + ":\t" + finalObj.toString(2);
                    } else {
                        msg = internal.debugVars[i].name + ":\t" + finalObj;
                    }
                    internal.ctx.font = '7pt Calibri';
                    internal.ctx.fillStyle = 'black';
                    internal.ctx.fillText(msg, 10, internal.size.y - 10*(internal.debugVars.length - i - offset));
                    if(internal.debugVars[i].duration != undefined){
                        internal.debugVars[i].duration--;
                    }
                } else {
                    offset++;
                }
            }
        }

        function UpdateMousePos(canvas, evt) {
            var rect = canvas.getBoundingClientRect();
            internal.mouse.obj.setPos(new $e.Vector2((evt.clientX - rect.left + internal.camera.obj.getPos().x) * (1/internal.camera.zoom), (internal.size.y - evt.clientY + rect.top - internal.camera.obj.getPos().y) * (1/internal.camera.zoom)));
            
            internal.threads.phx.msgTail.push({
                data: {
                    fn: 'CheckCollision',
                    obj: internal.mouse.obj,
                },
                extra: {
                    cb: function(msg){
                        internal.mouse.over = msg;
                    },
                    expd: true
                }
            });
        }

        function UpdateMouseAction(evt, active){
            switch(evt.button){
                case 0:
                    internal.mouse.click.left = active;
                    internal.inputs.ClickLeft = active;
                    if(active){
                        if(internal.mouse.over != undefined){
                            if(internal.mouse.over.collider.selectable){
                                if(evt.shiftKey){
                                    var ind = internal.mouse.selected.indexOf(internal.mouse.over);
                                    if(ind != -1){
                                        var last = internal.mouse.selected.slice(ind+1);
                                        internal.mouse.selected.splice(0,ind);
                                        for(var i = 0; i < last.length; i++){
                                            internal.mouse.selected.push(last[i]);
                                        }
                                    } else {
                                        internal.mouse.selected.push(internal.mouse.over);
                                    }
                                } else {
                                    internal.mouse.selected = [internal.mouse.over];
                                }
                            }
                        } else {
                            internal.mouse.selected = [];
                        }
                    }
                    break;
                case 1:
                    internal.mouse.click.middle = active;
                    internal.inputs.ClickMiddle = active;
                    break;
                case 2:
                    internal.mouse.click.right = active;
                    internal.inputs.ClickRight = active;
                    break;
                default:
                    break;
            }
        }

        function UpdateInputs(evt, press){
            if(evt.code == "mousewheel"){
                internal.inputs[evt.code] += press;
            } else {
                internal.inputs[evt.code] = press;
            }
            if(evt.code != "F11")
                if(evt.preventDefault != undefined)
                    evt.preventDefault();
        }

        function DrawObjects(){
            internal.size.x = internal.ctx.canvas.width = internal.canvas.clientWidth;
            internal.size.y = internal.ctx.canvas.height = internal.canvas.clientHeight;
            internal.ctx.globalAlpha = internal.globals.opacity;
            internal.ctx.fillStyle = internal.globals.background;
            internal.ctx.fillRect(0,0,internal.size.x, internal.size.y);
            internal.ctx.globalAlpha = 1;
            for(var i = 0; i < internal.layers.length; i++){
                for(var f = 0; f < internal.layers[i].length; f++){
                    //var timeoutTime = 1000*(i+1)*(f+1);
                    //$d.Log(timeoutTime);
                    //setTimeout(Draw(internal.layers[i][f]), timeoutTime);
                    Draw(internal.layers[i][f]);
                }
            }
        }

        function Draw(obj){
            if(internal.debug){
                internal.ctx.fillStyle = obj.color;
                var tv = new $e.Vector2((obj.getPos().x-internal.camera.obj.getPos().x) * internal.camera.zoom + (internal.size.x *  internal.camera.zoom / 2), (internal.size.y - obj.getPos().y + internal.camera.obj.getPos().y) * internal.camera.zoom + (internal.size.y * internal.camera.zoom / 2));
                tv.toFixed(0);
                //internal.ctx.translate(tv.x, tv.y);
                internal.ctx.setTransform(internal.camera.zoom,0,0,internal.camera.zoom,tv.x,tv.y);
                var rot = obj.rotation * Math.PI / 180;
                internal.ctx.rotate(-rot);
                if(internal.mouse.over == obj){
                    internal.ctx.shadowBlur = 2;
                    internal.ctx.shadowColor = "#3c84c1";
                }
                if(obj.texture != undefined){
                    internal.ctx.drawImage(obj.texture.getTexture(), -obj.texture.size.x/2, -obj.texture.size.y/2, obj.texture.size.x, obj.texture.size.y);
                } else {
                    if(obj.collider != undefined && obj.collider.type == 1){
                        //internal.ctx.arc(0, 0, obj.collider.radius/4, 0, 2*Math.PI);
                        //internal.ctx.fill();
                        internal.ctx.fillRect(- 10/2, - 10/2, 10, 10);
                    } else {
                        internal.ctx.fillRect(- 10/2, - 10/2, 10, 10);
                    }
                }

                if(internal.debug){
                    internal.ctx.globalAlpha = 0.1;
                    internal.ctx.fillStyle = "#F22";
                    internal.ctx.beginPath();
                    internal.ctx.arc(obj.pivot.x, -obj.pivot.y, 5, 0, 2*Math.PI);
                    internal.ctx.fill();
                    internal.ctx.globalAlpha = internal.globals.opacity;
                    if(obj.collider != undefined) {
                        internal.ctx.beginPath();
                        if(obj.collider.type == 1){
                            internal.ctx.arc(0, 0, obj.collider.radius, 0, 2*Math.PI);
                        } else {
                            internal.ctx.moveTo(obj.collider.vertexs[obj.collider.vertexs.length-1].x, obj.collider.vertexs[obj.collider.vertexs.length-1].y);
                            for(var i = 0; i < obj.collider.vertexs.length; i++){
                                internal.ctx.lineTo(obj.collider.vertexs[i].x, obj.collider.vertexs[i].y);
                            }
                        }
                        //internal.ctx.strokeStyle = '#0F4';

                        internal.ctx.strokeStyle = '#F00';
                        internal.ctx.stroke();
                        internal.ctx.fillStyle = "#FA0";
                        if(obj.collider.contactPoint != undefined){
                            internal.ctx.fillRect(obj.collider.vertexs[obj.collider.contactPoint].x - 2, (obj.collider.vertexs[obj.collider.contactPoint].y) - 2, 4, 4);
                        }
                    }
                }
                internal.ctx.rotate(rot);
                internal.ctx.font = '6pt Calibri';
                internal.ctx.fillStyle = internal.textcolor;
                internal.ctx.fillText(obj.name, 0, 0);
                //internal.ctx.translate(-tv.x, -tv.y);
                internal.ctx.setTransform(1,0,0,1,0,0);
                internal.ctx.shadowBlur = 0;
                //$d.Log(obj.name + "\tX: " + obj.getPos().x + "\tY: " + obj.getPos().y);
            }
        }

        //close

        //DEngine Objects start

        //initClass();

        
        //close

    }

    window.$e = $e; 


})(window);
