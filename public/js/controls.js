var bcc = bcc || zebra.namespace("bcc");
bcc("controls");

(function() {

    var pkg = bcc.controls;


    eval(zebra.Import("ui", "layout", "ui.designer"));

    pkg.guid = function(){
        return 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'.replace(/[xy]/g, function(c){
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    };

    pkg.createTip = function (txt) {
        var l = new Label(txt.indexOf("\n") >= 0 ? new zebra.data.Text(txt) : txt);
        l.setColor("#D27272");
        l.setFont(zebra.ui.boldFont);
        l.setBorder(new Border(zebra.util.rgb.gray));
        l.setBackground("#fff");
        l.setPadding(2);
        return l;
    };

    zebra.ready(function() {

        pkg.zebCtx = new zCanvas();

        pkg.zebCtx.setLocation(0, 0);
        pkg.zebCtx.fullScreen();

        pkg.menuLayerFocus = true;

        pkg.menuLayer=new (zebra.Class(BaseLayer, [
            function() {
                this.$super("BCC-MENU");
                this.setLayout(new RasterLayout());

                this.layerKeyPressed = function(keyCode,mask){
                    if (!pkg.menuLayerFocus) return false;
                    this.activate(true);
                    if (this.kids.length>0 && typeof(this.kids[this.kids.length-1].keyPressed)!="undefined")
                    {
                        var event = new zebra.ui.KeyEvent(this,zebra.ui.KeyEvent.PRESSED,keyCode,'',mask);
                        this.kids[this.kids.length-1].keyPressed(event);
                        this.kids[this.kids.length-1].requestFocus();
                    }
                    return true;
                };
            }
        ]))();


        pkg.blockLayer=new (zebra.Class(BaseLayer, [
            function() {
                this.$super("BCC-BLOCK");
                this.setLayout(new RasterLayout());

                this.layerKeyPressed = function(keyCode,mask){
                    return false;
                };
            }
        ]))();

        var root = pkg.zebCtx.root.properties({
            border: new Border("white", 0, 0),
            padding: 0});


        root.setLayout(new BorderLayout());

        pkg.touchPanel=new Panel();
        pkg.touchPanel.setLayout(new BorderLayout());

        root.add(CENTER,pkg.touchPanel);

        pkg.logArea=new TextArea("Start Logging...\n");
        pkg.logArea.setPreferredSize(-1,100);

        root.add(BOTTOM,pkg.logArea);


        var backing=new Panel({
            border: new Border("#CCCCCC", 1, 3),
            layout: new BorderLayout()
        });
        backing.setPreferredSize(window.innerWidth,window.innerHeight);
        backing.toPreferredSize();
        backing.setBackground("rgba(0,0,0,0.4)");
        pkg.blockLayer.add(backing);
        pkg.zebCtx.add(pkg.blockLayer);


        pkg.ws_connected=false;
        var ws;

        pkg.uuid=pkg.guid();

        ws = io.connect('http://' + location.host + '/', {'sync disconnect on unload': true });


        ws.on('log message', function (msg) {
            pkg.logArea.setValue(pkg.logArea.getValue()+msg+'\n');
        });
        ws.on('connect', function () {
            pkg.ws_connected=ws.connected;
            ws.emit('set com', pkg.uuid);
            pkg.blockLayer.removeMe();
        });
        ws.on('disconnect', function () {
            pkg.ws_connected=ws.connected;
            backing.setPreferredSize(window.innerWidth,window.innerHeight);
            backing.toPreferredSize();
            pkg.zebCtx.add(pkg.blockLayer);
        });

        var workspace=new Panel(new FlowLayout(LEFT,BOTTOM));
        pkg.touchPanel.add(CENTER, workspace);

        ws.on('sbrick connected', function (brick_id, connected)
        {
            if (!connected)
            {
                var errorModal = new pkg.Modal("sBrick connection");
                var tmpPanel=new Panel(new BorderLayout());
                tmpPanel.add(TOP,new Label(""));
                tmpPanel.add(CENTER,new Label("            sBrick is no longer connected!"));
                errorModal.setZebraContent(tmpPanel);
                errorModal.setLocation((pkg.touchPanel.width / 2) -150, 50);
                errorModal.setSize(300, 150);
                errorModal.show();
                return;
            }
            var list = new List(['Channel A', 'Channel B', 'Channel C', 'Channel D', 'Blink LED'], true);

            list.setViewProvider(new zebra.Dummy([
                function getView(list, item, index)
                {
                    var render;

                    if (item=='-')
                    {
                        render = new Render();
                        render.paint = function(g,x,y,w,h,c) {
                            g.setColor("#AAAAAA");
                            g.drawLine(0, y, list.width, y);
                        };

                        return render;
                    }
                    else
                    {
                        while (item.length<20) item+=' ';
                        render =  new TextRender(item);
                        render.setColor("rgb(34, 34 ,34)");
                        render.setFont(new Font("14px Verdana, Arial, sans-serif"));
                        return render;
                    }

                }
            ]));

            list.isItemSelectable = function(i) {
                return list.model.d[i]!='-';
            };

            var triggered=false;
            var infoWin = new Panel({
                border: new Border("#CCCCCC", 1, 3),
                layout: new BorderLayout()
            });
            infoWin.setPadding(0);
            infoWin.defaultWidth = -1;
            infoWin.$this = this;
            infoWin.setBackground("white");
            infoWin.border.width=5;
            infoWin.border.gap=3;
            infoWin.add(CENTER, list);
            list.bind(function (src, prev) {
                if (triggered) return;
                triggered=true;

                infoWin.removeMe();
                pkg.menuLayer.removeMe();

                var selected=src.model.d[src.selectedIndex];

                if (selected == 'Blink LED') {
                    ws.emit('sbrick led', pkg.uuid, brick_id);
                    return;
                }

                var port=0;
                if (selected == 'Channel B') port = 1;
                else if (selected == 'Channel C') port = 2;
                else if (selected == 'Channel D') port = 3;

                var slider=new pkg.Slider();
                slider.orient = VERTICAL;
                slider.max=520;
                slider.value=260;
                slider.brick_id=brick_id;
                slider.port=port;

                var isReset=false;


                slider.bind(function (slider, value) {
                    if (!isReset) ws.emit('sbrick move', pkg.uuid,slider.brick_id,slider.port,(value-260)*-1);
                    isReset=false;
                });

                var slider_thumb=new Image();
                slider_thumb.src='/images/slider_thumb_vert.png';
                slider_thumb.onload=function() {
                    var slider_thumb_pressed = new Image();
                    slider_thumb_pressed.src='/images/slider_thumb_pressed_vert.png';
                    slider_thumb_pressed.onload=function() {

                        slider.extend([
                            function mousePressed(e) {
                                this.$super(e);

                                slider.views['bundle'] = new Picture(slider_thumb_pressed);
                                slider.highlighted = true;
                                slider.vrp();
                            },
                            function mouseReleased(e) {
                                slider.views['bundle'] = new Picture(slider_thumb);
                                slider.highlighted = false;
                                slider.vrp();
                            },
                            function mouseDragEnded(e) {
                                this.$super(e);
                            }
                        ]);

                        slider.views['bundle'] = new Picture(slider_thumb);


                        var reset=new ActionButton("STOP");
                        reset.extend([
                            function setSize(w,h) {
                                this.$super(50,30);
                            },
                            function setLocation(x,y)
                            {
                                this.$super(x+15,y);
                            }
                        ]);
                        reset.bind(function (src) {
                            isReset=true;
                            ws.emit('sbrick stop', pkg.uuid,slider.brick_id,slider.port);
                            slider.setValue(260);
                        });

                        var holder = new Panel(new BorderLayout());
                        holder.extend([
                            function setSize(w,h) {
                                this.$super(80,280);
                            }
                        ]);

                        holder.add(CENTER,slider);
                        holder.add(BOTTOM,reset);


                        workspace.add(holder);
                    };
                };

            });
            infoWin.toPreferredSize();

            // screen centered
            infoWin.setLocation((pkg.touchPanel.width/2)-100,(pkg.touchPanel.height/2)-100);


            pkg.menuLayer.add(infoWin);
            pkg.zebCtx.add(pkg.menuLayer);
        });

        ws.on('all sbricks', function (sbricks, token)
        {
            if (!sbricks || sbricks.length==0)
            {
                var errorModal = new pkg.Modal("sBrick detection");
                var tmpPanel=new Panel(new BorderLayout());
                tmpPanel.add(TOP,new Label(""));
                tmpPanel.add(CENTER,new Label("                      No sBricks Found!"));
                errorModal.setZebraContent(tmpPanel);
                errorModal.setLocation((pkg.touchPanel.width / 2) -150, 50);
                errorModal.setSize(300, 150);
                errorModal.show();
                return;
            }
            var list = new List(sbricks, true);

            list.setViewProvider(new zebra.Dummy([
                function getView(list, item, index)
                {
                    var render;

                    if (item=='-')
                    {
                        render = new Render();
                        render.paint = function(g,x,y,w,h,c) {
                            g.setColor("#AAAAAA");
                            g.drawLine(0, y, list.width, y);
                        };

                        return render;
                    }
                    else
                    {
                        while (item.length<20) item+=' ';
                        render =  new TextRender(item);
                        render.setColor("rgb(34, 34 ,34)");
                        render.setFont(new Font("14px Verdana, Arial, sans-serif"));
                        return render;
                    }

                }
            ]));

            list.isItemSelectable = function(i) {
                return list.model.d[i]!='-';
            };

            var triggered=false;
            var infoWin = new Panel({
                border: new Border("#CCCCCC", 1, 3),
                layout: new BorderLayout()
            });
            infoWin.setPadding(0);
            infoWin.defaultWidth = -1;
            infoWin.$this = this;
            infoWin.setBackground("white");
            infoWin.border.width=5;
            infoWin.border.gap=3;
            infoWin.add(CENTER, list);
            list.bind(function (src, prev) {
                if (triggered) return;
                triggered=true;

                infoWin.removeMe();
                pkg.menuLayer.removeMe();

                var selected=src.model.d[src.selectedIndex];
                ws.emit('sbrick connect', pkg.uuid, selected);

            });
            infoWin.toPreferredSize();

            // screen centered
            infoWin.setLocation((pkg.touchPanel.width/2)-100,(pkg.touchPanel.height/2)-100);


            pkg.menuLayer.add(infoWin);
            pkg.zebCtx.add(pkg.menuLayer);
        });


        ws.on('btbrick connected', function (brick_id, connected) {
            if (!connected) {
                var errorModal = new pkg.Modal("BTBrick connection");
                var tmpPanel = new Panel(new BorderLayout());
                tmpPanel.add(TOP, new Label(""));
                tmpPanel.add(CENTER, new Label("            BTBrick is no longer connected!"));
                errorModal.setZebraContent(tmpPanel);
                errorModal.setLocation((pkg.touchPanel.width / 2) - 150, 50);
                errorModal.setSize(300, 150);
                errorModal.show();
                return;
            }
            var list = new List(['RED', 'BLUE'], true);

            list.setViewProvider(new zebra.Dummy([
                function getView(list, item, index) {
                    var render;

                    if (item == '-') {
                        render = new Render();
                        render.paint = function (g, x, y, w, h, c) {
                            g.setColor("#AAAAAA");
                            g.drawLine(0, y, list.width, y);
                        };

                        return render;
                    }
                    else {
                        while (item.length < 20) item += ' ';
                        render = new TextRender(item);
                        render.setColor("rgb(34, 34 ,34)");
                        render.setFont(new Font("14px Verdana, Arial, sans-serif"));
                        return render;
                    }

                }
            ]));

            list.isItemSelectable = function (i) {
                return list.model.d[i] != '-';
            };

            var triggered = false;
            var infoWin = new Panel({
                border: new Border("#CCCCCC", 1, 3),
                layout: new BorderLayout()
            });
            infoWin.setPadding(0);
            infoWin.defaultWidth = -1;
            infoWin.$this = this;
            infoWin.setBackground("white");
            infoWin.border.width = 5;
            infoWin.border.gap = 3;
            infoWin.add(CENTER, list);
            list.bind(function (src, prev) {
                if (triggered) return;
                triggered = true;

                infoWin.removeMe();
                pkg.menuLayer.removeMe();

                var selected = src.model.d[src.selectedIndex];
                var port = 0;
                if (selected == 'BLUE') port = 1;

                var slider = new pkg.Slider();
                slider.orient = VERTICAL;
                slider.max = 14;
                slider.value = 7;
                slider.brick_id = brick_id;
                slider.port = port;

                var isReset = false;


                slider.bind(function (slider, prev) {
                    if (!isReset) {
                        var value = slider.getValue();

                        if (prev == value) return;

                        if (value > 7 && prev <= 7) {
                            ws.emit('btbrick fullforward', pkg.uuid, slider.brick_id, slider.port);
                            while (value < 14) {
                                setTimeout(function () {
                                    ws.emit('btbrick powerdown', pkg.uuid, slider.brick_id, slider.port);
                                }, 5);
                                value++;
                            }
                            return;
                        }

                        if (value < 7 && prev >= 7) {
                            ws.emit('btbrick fullbackward', pkg.uuid, slider.brick_id, slider.port);
                            while (value > 0) {
                                setTimeout(function () {
                                    ws.emit('btbrick powerup', pkg.uuid, slider.brick_id, slider.port);
                                }, 5);
                                value--;
                            }
                            return;
                        }

                        if (value == 7) {
                            ws.emit('btbrick stop', pkg.uuid, slider.brick_id, slider.port);
                            return;
                        }
                        if (value < 7) {
                            if (value > prev) {
                                while (value > prev)
                                {
                                    setTimeout(function () {
                                        ws.emit('btbrick powerup', pkg.uuid, slider.brick_id, slider.port);
                                    }, 5);
                                    value--;
                                }
                            }
                            else {
                                while (value < prev)
                                {
                                    setTimeout(function () {
                                        ws.emit('btbrick powerdown', pkg.uuid, slider.brick_id, slider.port);
                                    }, 5);
                                    value++;
                                }
                            }
                            return;
                        }

                        if (value > 7) {
                            if (value > prev) {
                                while (value > prev) {
                                    setTimeout(function () {
                                        ws.emit('btbrick powerup', pkg.uuid, slider.brick_id, slider.port);
                                    }, 5);
                                    value--;
                                }
                            }
                            else {
                                while (value < prev) {
                                    setTimeout(function () {
                                        ws.emit('btbrick powerdown', pkg.uuid, slider.brick_id, slider.port);
                                    }, 5);
                                    value++;
                                }
                            }
                            return;
                        }

                    }
                    isReset = false;
                });

                var slider_thumb = new Image();
                slider_thumb.src = '/images/slider_thumb_vert.png';
                slider_thumb.onload = function () {
                    var slider_thumb_pressed = new Image();
                    slider_thumb_pressed.src = '/images/slider_thumb_pressed_vert.png';
                    slider_thumb_pressed.onload = function () {

                        slider.extend([
                            function mousePressed(e) {
                                this.$super(e);

                                slider.views['bundle'] = new Picture(slider_thumb_pressed);
                                slider.highlighted = true;
                                slider.vrp();
                            },
                            function mouseReleased(e) {
                                slider.views['bundle'] = new Picture(slider_thumb);
                                slider.highlighted = false;
                                slider.vrp();
                            },
                            function mouseDragEnded(e) {
                                this.$super(e);
                            }
                        ]);

                        slider.views['bundle'] = new Picture(slider_thumb);


                        var reset = new ActionButton("STOP");
                        reset.extend([
                            function setSize(w, h) {
                                this.$super(50, 30);
                            },
                            function setLocation(x, y) {
                                this.$super(x + 15, y);
                            }
                        ]);
                        reset.bind(function (src) {
                            isReset = true;
                            ws.emit('btbrick stop', pkg.uuid, slider.brick_id, slider.port);
                            slider.setValue(7);
                        });

                        var holder = new Panel(new BorderLayout());
                        holder.extend([
                            function setSize(w, h) {
                                this.$super(80, 280);
                            }
                        ]);

                        holder.add(CENTER, slider);
                        holder.add(BOTTOM, reset);


                        workspace.add(holder);
                    };
                };

            });
            infoWin.toPreferredSize();

            // screen centered
            infoWin.setLocation((pkg.touchPanel.width / 2) - 100, (pkg.touchPanel.height / 2) - 100);


            pkg.menuLayer.add(infoWin);
            pkg.zebCtx.add(pkg.menuLayer);
        });

        ws.on('all btbricks', function (btbricks, token) {
            if (!btbricks || btbricks.length == 0) {
                var errorModal = new pkg.Modal("BTBrick detection");
                var tmpPanel = new Panel(new BorderLayout());
                tmpPanel.add(TOP, new Label(""));
                tmpPanel.add(CENTER, new Label("                      No BTBricks Found!"));
                errorModal.setZebraContent(tmpPanel);
                errorModal.setLocation((pkg.touchPanel.width / 2) - 150, 50);
                errorModal.setSize(300, 150);
                errorModal.show();
                return;
            }
            var list = new List(btbricks, true);

            list.setViewProvider(new zebra.Dummy([
                function getView(list, item, index) {
                    var render;

                    if (item == '-') {
                        render = new Render();
                        render.paint = function (g, x, y, w, h, c) {
                            g.setColor("#AAAAAA");
                            g.drawLine(0, y, list.width, y);
                        };

                        return render;
                    }
                    else {
                        while (item.length < 20) item += ' ';
                        render = new TextRender(item);
                        render.setColor("rgb(34, 34 ,34)");
                        render.setFont(new Font("14px Verdana, Arial, sans-serif"));
                        return render;
                    }

                }
            ]));

            list.isItemSelectable = function (i) {
                return list.model.d[i] != '-';
            };

            var triggered = false;
            var infoWin = new Panel({
                border: new Border("#CCCCCC", 1, 3),
                layout: new BorderLayout()
            });
            infoWin.setPadding(0);
            infoWin.defaultWidth = -1;
            infoWin.$this = this;
            infoWin.setBackground("white");
            infoWin.border.width = 5;
            infoWin.border.gap = 3;
            infoWin.add(CENTER, list);
            list.bind(function (src, prev) {
                if (triggered) return;
                triggered = true;

                infoWin.removeMe();
                pkg.menuLayer.removeMe();

                var selected = src.model.d[src.selectedIndex];
                ws.emit('btbrick connect', pkg.uuid, selected);

            });
            infoWin.toPreferredSize();

            // screen centered
            infoWin.setLocation((pkg.touchPanel.width / 2) - 100, (pkg.touchPanel.height / 2) - 100);


            pkg.menuLayer.add(infoWin);
            pkg.zebCtx.add(pkg.menuLayer);
        });


        var p = new Panel();
        p.setPreferredSize(41, window.innerHeight);
        p.setBorder("plain");
        p.cursorType = Cursor.HAND;
        p.setBackground(new Radial("#333","rgba(41, 41, 41, 0.6)"));
        p.setPadding(0);
        p.setLayout(new FlowLayout(CENTER, BOTTOM, VERTICAL, 4));
        p.mouseMoved = function(e) {pkg.zebCtx.root.vrp();}; // for IE mainly

        var row=new Panel();
        row.setLayout(new BorderLayout(1,1));
        row.extend([
            function setLocation(x,y)
            {
                this.$super(x+1,y-38);
            }
        ]);
        p.add(row);
        p.extend([
            function setLocation(x,y)
            {
                this.$super(x-1,y-1);
            }
        ]);

        var i = new ImagePan('/images/sbrick.png');
        i.setPreferredSize(30,30);
        var button = new Button(i);

        button.setPreferredSize(36,36);
        button.tooltip=pkg.createTip('List sBricks');
        button.cursorType = Cursor.HAND;

        button.setCanHaveFocus(false);

        button.setBackground(new ViewSet({
            "over": "#E0E4EA",
            "pressed.out": "#E0E4EA",
            "pressed.over": "#D27272",
            "out": "#fff",
            "disabled" : "#ddd"
        }));

        //button.mouseMoved = function(e) {pkg.zebCtx.root.vrp();};

        button.bind(function (src) {
            ws.emit('sbrick list', pkg.uuid);
        });
        row.add(CENTER,button);
        p.add(row);


        var rowLed=new Panel();
        rowLed.setLayout(new BorderLayout(1,1));
        rowLed.extend([
            function setLocation(x,y)
            {
                this.$super(x+1,y-78);
            }
        ]);
        p.add(rowLed);
        p.extend([
            function setLocation(x,y)
            {
                this.$super(x-1,y-1);
            }
        ]);

        var iLed = new ImagePan('/images/sbrick.png');
        iLed.setPreferredSize(30,30);

        var buttonLed = new Button(iLed);

        buttonLed.setPreferredSize(36,36);
        buttonLed.tooltip=pkg.createTip('Test sBricks');
        buttonLed.cursorType = Cursor.HAND;

        buttonLed.setCanHaveFocus(false);

        buttonLed.setBackground(new ViewSet({
            "over": "#E0E4EA",
            "pressed.out": "#E0E4EA",
            "pressed.over": "#D27272",
            "out": "#fff",
            "disabled" : "#ddd"
        }));

        //button.mouseMoved = function(e) {pkg.zebCtx.root.vrp();};

        buttonLed.bind(function (src) {
            ws.emit('sbrick list', pkg.uuid, 'LED');
        });
        rowLed.add(CENTER,buttonLed);
        p.add(rowLed);


        row = new Panel();
        row.setLayout(new BorderLayout(1, 1));
        row.extend([
            function setLocation(x, y) {
                this.$super(x + 1, y - 118);
            }
        ]);
        p.add(row);
        p.extend([
            function setLocation(x, y) {
                this.$super(x - 1, y - 1);
            }
        ]);

        i = new ImagePan('/images/btbrick.png');
        i.setPreferredSize(30, 30);
        var button = new Button(i);

        button.setPreferredSize(36, 36);
        button.tooltip = pkg.createTip('List BTBricks');
        button.cursorType = Cursor.HAND;

        button.setCanHaveFocus(false);

        button.setBackground(new ViewSet({
            "over": "#E0E4EA",
            "pressed.out": "#E0E4EA",
            "pressed.over": "#D27272",
            "out": "#fff",
            "disabled": "#ddd"
        }));

        //button.mouseMoved = function(e) {pkg.zebCtx.root.vrp();};

        button.bind(function (src) {
            ws.emit('btbrick list', pkg.uuid);
        });
        row.add(CENTER, button);
        p.add(row);

        pkg.touchPanel.add(LEFT,p);




        pkg.ShadowRender = zebra.Class(zebra.ui.Render, [
            function (target) {
                this.$super(target);
                this.shadowOffsetX = this.shadowOffsetY = 4;
                this.shadowBlur = 2;
                this.shadowColor = "rgba(0,0,0,0.1)";
                this.left = this.top = 0;
                this.right = this.bottom = 4;
            },

            function setup(shadowOffsetX, shadowOffsetY, shadowBlur, shadowColor) {
                this.shadowOffsetX = shadowOffsetX == null ? 0 : shadowOffsetX;
                this.shadowOffsetY = shadowOffsetY == null ? 0 : shadowOffsetY;
                this.shadowBlur = shadowBlur == null ? 15 : shadowBlur;
                this.shadowColor = shadowColor == null ? "#E5E5E5" : shadowColor;
            },

            function getTop() {
                return this.top + (this.target != null && this.target.getTop != null ? this.target.getTop() : 0);
            },

            function getLeft() {
                return this.left + (this.target != null && this.target.getLeft != null ? this.target.getLeft() : 0);
            },

            function getRight() {
                return this.right + (this.target != null && this.target.getRight != null ? this.target.getRight() : 0);
            },

            function getBottom() {
                return this.bottom + (this.target != null && this.target.getBottom != null ? this.target.getBottom() : 0);
            },

            function paint(g, x, y, w, h, t) {
                g.shadowColor = this.shadowColor;
                g.shadowOffsetX = this.shadowOffsetX;
                g.shadowOffsetY = this.shadowOffsetY;
                g.shadowBlur = this.shadowBlur;

                x += this.left;
                y += this.top;
                w = w - this.left - this.right;
                h = h - this.top - this.bottom;

                if (this.target.outline != null) {
                    this.target.outline(g, x, y, w, h, t);
                    g.setColor("#F5F5F5");
                    g.fill();
                }

                g.shadowColor = undefined;
                g.shadowOffsetX = 0;
                g.shadowOffsetY = 0;
                g.shadowBlur = 0;

                this.target.paint(g, x, y, w, h, t);
            }
        ]);


        var BaseModal = zebra.Class(zebra.ui.Window, [
            function (title) {
                var p = new Panel(new BorderLayout());
                this.bottomPanel = new Panel(new FlowLayout(RIGHT, CENTER, HORIZONTAL, 10));
                this.bottomPanel.setPadding(5, 5, 0, 5);
                var cancel = new Button("Close");
                cancel.setPreferredSize(70, 30);
                cancel.bind(function (src) {
                    src.parent.parent.parent.removeMe();
                });

                this.bottomPanel.add(cancel);

                this.borderTop = function (g, x1, y1, w, h, d) {
                    var x2 = x1 + w - 1, y2 = y1 + h - 1;
                    g.setColor("#fff");
                    g.drawLine(x1 - 1, y1 + 1, x2 + 1, y1 + 1);
                    g.setColor("#dedfde");
                    g.drawLine(x1 - 1, y1, x2 + 1, y1);
                };

                p.add(BOTTOM, this.bottomPanel);
                this.$super(title, p);

                this.setBorder(new pkg.ShadowRender(this.border));
                this.bg = null;
            },
            function setZebraContent(panel) {
                if (typeof(this.content) != "undefined") this.content.removeMe();
                if (!zebra.instanceOf(panel, Tabs)) this.bottomPanel.setBorder(this.borderTop);
                panel.setBackground("white");
                this.content = panel;
                this.root.add(CENTER, this.content);
                return this.content;
            },
            function addApplyButton(text, apply_cb) {
                var apply = new ActionButton(text);
                apply.setPreferredSize(apply.kids[0].view.font.stringWidth(text) + 30, 30);
                apply.requestFocusIn();
                apply.bind(function (src) {
                    if (apply_cb) {
                        if (!(apply_cb() == false)) {
                            src.parent.parent.parent.removeMe();
                        }
                    }
                    else src.parent.parent.parent.removeMe();
                });

                this.bottomPanel.add(apply);
            },
            function show(zebraContext, close_cb, open_cb) {
                showWindow(zebraContext, "modal", this, {
                    winOpened: function (layer, win, isOpened) {
                        if (isOpened) {

                            if (open_cb) open_cb();
                        }
                        else {

                            zebraContext.root.vrp();
                            if (close_cb) close_cb();
                        }
                    }
                });
            },
            function mouseDragStarted(e) {
                this.$super(e);
                this.bottomPanel.kids[0].requestFocus();
            }
        ]);

        pkg.Modal = zebra.Class(BaseModal, [
            function show(close_cb, open_cb) {
                this.$super(pkg.zebCtx, close_cb, open_cb);
            }
        ]);

        pkg.Slider = zebra.Class(Slider,[
            function() {
                this.$super();

                this.border = null;
                this.highlighted=false;
                this.setShowScale(false);
                this.setShowTitle(false);
                this.setScaleStep(1);

                this.paint = function (g) {
                    if (this.pl == null) {
                        this.pl = Array(this.intervals.length);
                        for (var i = 0, l = this.min; i < this.pl.length; i++) {
                            l += this.intervals[i];
                            this.pl[i] = this.value2loc(l);
                        }
                    }

                    var left = this.getLeft(), top = this.getTop(),
                        right = this.getRight(), bottom = this.getBottom(),
                        bnv = this.views["bundle"],
                        bs = bnv.getPreferredSize(),
                        w = this.width - left - right - 2,
                        h = this.height - top - bottom - 2;

                    var leftX = left + ~~((w - this.psW) / 2) + 1, bx = leftX;

                    //var topY = top + ~~((h - this.psH) / 2) + 1, by = topY;
                    var pointerY=this.getBundleLoc(this.value);

                    if (this.highlighted) g.setColor("rgba(210, 119, 198, 0.6)");
                    else g.setColor("gray");
                    g.fillRect(leftX + 12, top, 10, h);

                    if (this.isEnabled === true) {
                        g.setColor("#D2D0D0");
                        g.fillRect(leftX + 13, top + 2, 8, pointerY);
                        g.setColor("#D2D0D0");
                        g.fillRect(leftX+13, top + 1 + pointerY, 8, h - (2+pointerY));
                    }

                    leftX += bs.width;
                    //topY += bs.height;

                    //this.paintNums(g, topY);
                    //bnv.paint(g, pointerX, by, bs.width, bs.height, this);
                    this.paintNums(g, leftX);
                    bnv.paint(g, bx, this.getBundleLoc(this.value), bs.width, bs.height, this);
                };

            }

        ]);


    });

}());
