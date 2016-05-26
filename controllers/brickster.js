var app = require('../app');

function log_msg(msg) {
    console.log(msg);

    app.locals.connections.forEach(function (connObj) {
        connObj.ws.emit('log message', msg);
    });
}

function BTBrick(address) {
    this.btSerial = new (require('bluetooth-serial-port')).BluetoothSerialPort();
    this.address = address;
    this.serial_channel = 1;

    this.RED_CHANNEL = 0;
    this.BLUE_CHANNEL = 1;

    this.RED_FULL_FWD = 'Q';
    this.RED_FULL_REV = 'R';
    this.RED_PWR_UP = 'A';
    this.RED_PWR_DOWN = 'B';
    this.RED_STOP = 'C';
    this.RED_FLOAT = 'P';

    this.BLUE_FULL_FWD = 'd';
    this.BLUE_FULL_REV = 'h';
    this.BLUE_PWR_UP = 'D';
    this.BLUE_PWR_DOWN = 'H';
    this.BLUE_STOP = 'L';
    this.BLUE_FLOAT = '`';

    this.maxoutput = 7;

    this.redFliped = false;
    this.blueFliped = false;
}


BTBrick.btbricks = {};
exports.btbricks = BTBrick.btbricks;

BTBrick.prototype.isConnected = function () {
    return (this.btSerial.connection !== undefined);
};

BTBrick.prototype.disconnect = function () {
    this.btSerial.close();
};

BTBrick.prototype.connect = function (callback) {

    if (this.btSerial.connection == undefined) {
        log_msg('connect');

        this.btSerial.connect(this.address, this.serial_channel, function () {
            if (callback) callback(null);
        }, function () {
            log_msg('cannot connect');
        });
    } else {
        log_msg('already connected');
        if (callback) callback(null);
    }
};

BTBrick.prototype.flip = function (channel) {
    if (channel == this.RED_CHANNEL) {
        this.redFliped = !this.redFliped;
    }
    else {
        this.blueFliped = !this.blueFliped;
    }
};


BTBrick.prototype.powerUp = function (channel) {
    if (channel == this.RED_CHANNEL) {
        this.btSerial.write(new Buffer(this.redFliped ? this.RED_PWR_DOWN : this.RED_PWR_UP, 'utf-8'), function (err, bytesWritten) {
            if (err) log_msg('error moving red channel: ' + err);
        });
    }
    else if (channel == this.BLUE_CHANNEL) {
        this.btSerial.write(new Buffer(this.blueFliped ? this.BLUE_PWR_DOWN : this.BLUE_PWR_UP, 'utf-8'), function (err, bytesWritten) {
            if (err) log_msg('error moving blue channel: ' + err);
        });
    }
};

BTBrick.prototype.powerDown = function (channel) {
    if (channel == this.RED_CHANNEL) {
        this.btSerial.write(new Buffer(this.redFliped ? this.RED_PWR_UP : this.RED_PWR_DOWN, 'utf-8'), function (err, bytesWritten) {
            if (err) log_msg('error moving red channel: ' + err);
        });
    }
    else if (channel == this.BLUE_CHANNEL) {
        this.btSerial.write(new Buffer(this.blueFliped ? this.BLUE_PWR_UP : this.BLUE_PWR_DOWN, 'utf-8'), function (err, bytesWritten) {
            if (err) log_msg('error moving blue channel: ' + err);
        });
    }
};

BTBrick.prototype.fullForward = function (channel) {
    if (channel == this.RED_CHANNEL) {
        this.btSerial.write(new Buffer(this.redFliped ? this.RED_FULL_REV : this.RED_FULL_FWD, 'utf-8'), function (err, bytesWritten) {
            if (err) log_msg('error moving red channel: ' + err);
        });
        log_msg('Moving forward red channel');
    }
    else if (channel == this.BLUE_CHANNEL) {
        this.btSerial.write(new Buffer(this.blueFliped ? this.BLUE_FULL_REV : this.BLUE_FULL_FWD, 'utf-8'), function (err, bytesWritten) {
            if (err) log_msg('error moving blue channel: ' + err);
        });
        log_msg('Moving forward blue channel');
    }
};


BTBrick.prototype.fullBackward = function (channel) {
    if (channel == this.RED_CHANNEL) {
        this.btSerial.write(new Buffer(this.redFliped ? this.RED_FULL_FWD : this.RED_FULL_REV, 'utf-8'), function (err, bytesWritten) {
            if (err) log_msg('error moving red channel: ' + err);
        });
        log_msg('Moving backward red channel');
    }
    else if (channel == this.BLUE_CHANNEL) {
        this.btSerial.write(new Buffer(this.blueFliped ? this.BLUE_FULL_FWD : this.BLUE_FULL_REV, 'utf-8'), function (err, bytesWritten) {
            if (err) log_msg('error moving blue channel: ' + err);
        });
        log_msg('Moving backward blue channel');
    }
};

BTBrick.prototype.stop = function (channel) {
    if (channel == this.RED_CHANNEL) {
        this.btSerial.write(new Buffer(this.RED_STOP, 'utf-8'), function (err, bytesWritten) {
            if (err) log_msg('error stopping red channel: ' + err);
        });
        log_msg('Stopping red channel');
    }
    else if (channel == this.BLUE_CHANNEL) {
        this.btSerial.write(new Buffer(this.BLUE_STOP, 'utf-8'), function (err, bytesWritten) {
            if (err) log_msg('error stopping blue channel: ' + err);
        });
        log_msg('Stopping blue channel');
    }
};

exports.scan = function () {
    log_msg('BTBrick startScanning');

    var innerScan = function () {
        var btScanner = new (require('bluetooth-serial-port')).BluetoothSerialPort();
        btScanner.on('found', function (address, name) {
            if (name == 'HC-06') {
                btScanner.findSerialPortChannel(address, function (serial_channel) {
                    var s = BTBrick.btbricks[address];
                    if (!s) {
                        s = new BTBrick(address);
                        s.serial_channel = serial_channel;
                        BTBrick.btbricks[address] = s;
                        log_msg('found BTBrick with address:' + address);
                    }
                }, function () {
                    log_msg('could not find serial channel for BTBrick ' + address);
                });
            }
        });
        btScanner.inquire();
    };

    innerScan();

    // setInterval (function () {
    //     innerScan();
    // },10000);
};

