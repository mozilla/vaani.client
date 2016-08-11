/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

// load modules and initialize some vars
const fs = require('fs');
const websocket = require('ws')
const url = require('url');
const MemoryStream = require('memorystream');
var ws;
var logStream;
var streamServer;

module.exports = {

    wakeword: null,
    config: null,
    audiotools: null,
    connectionfailed: null,
    resetlisten: null,
    secret: null,
    logging: null,


    setup: function(wakeword, config, audiotools, resetlisten, logging){
        this.wakeword = wakeword;
        this.config = config;
        this.audiotools = audiotools;
        this.resetlisten = resetlisten;
        this.logging = logging;

        this.secret =  JSON.parse(process.env.VAANI_CONFIG || fs.readFileSync("secret.json"));

        // creating logs folder if necessary
        if ((this.config.logaudios)) {
            if (!fs.existsSync('logsaudio')){
                fs.mkdirSync('logsaudio');
            }
        }

        // If an environment variable defines the oauth token, use that one
        // instead of the one in the config file. The vaani.setup server sets this
        // environment variable in /lib/systemd/system/vaani.service.d/evernote.conf.
        // When vaani.setup starts us with systemd, we'll get the user's current
        // oauth token that way.
        if (process.env.EVERNOTE_OAUTH_TOKEN) {
            this.secret.evernote = this.secret.evernote || {};
            this.secret.evernote.authtoken = process.env.EVERNOTE_OAUTH_TOKEN;
        }

        // If we are going to be amplifying the audio data, convert
        // from decibels to the amplification factor now
        if (this.config.micgain) {
            this.amplification =
                this.audiotools.amplificationFactor(this.config.micgain);
            console.log('Configured gain of', this.config.micgain,
                        'will multiply audio samples by', this.amplification);
        }
    },

    connectServer: function (){

        var wstream;
        var isWav;

        streamServer = new MemoryStream();
        var ssldir = this.config.ssldir;
        var server = this.config.vaaniserver;
        server = url.parse(server, true, false);
        server.query.authtoken = this.secret.evernote.authtoken;
        server.pathname = '/';
        var secure = server.protocol === 'wss:';
        server = url.format(server);
        this.connectionfailed = false;

        var options = {
            rejectUnauthorized: false
        };

        if (secure) {
            options.key =  fs.readFileSync(ssldir + 'client-key.pem');
            options.cert = fs.readFileSync(ssldir + 'client-crt.pem');
            options.ca =   fs.readFileSync(ssldir + 'ca-crt.pem');
            options.passphrase = this.secret.passphrase;
        }

        ws = new websocket(server, null, options);

        // if we are set to save the audiofiles, then we create it
        if (this.config.logaudios) logStream  = fs.createWriteStream("logsaudio/" +  new Date().getTime(), {'flags': 'a'});

        ws.on('open', () => {
            isWav = false;
            wstream = fs.createWriteStream('output.wav');
        });

        ws.on('error', (error) => {
          console.log('Error Websocket', error);
          this.connectionfailed = true;
          this.resetlisten();
          this.audiotools.playerror();
          this.logging.addmetric("ws", "error", error, -1);
        });

        ws.on('message', (data, flags) => {
            if (!isWav){
                this.audiotools.endsound();
                try {
                    console.log('server response', data);
                    var parsedresponse = JSON.parse(data);
                    this.logging.addmetric("ws", "stt_json", "ok", parsedresponse.confidence);
                } catch (e) {
                    console.error("server response isn't a valid JSON string");
                }
                isWav = true;
                this.resetlisten();
            } else {
                wstream.write(data);
            }
        });

        ws.on('close', () => {
            console.log('Closing connection with the server'); 
            if (wstream) wstream.end();
            if (!this.connectionfailed) this.audiotools.playresponse();
            if (this.config.logaudios) logStream.close();
            this.logging.addmetric("ws", "close_play", "ok", 1);
        });
    },

    _wspush: function(){
        if (ws.readyState === ws.OPEN) {
            let samples;
            while ((samples = streamServer.read(this.config.VAD_BYTES))) {
                // stream the samples
                ws.send(samples);
                // log the samples
                if (this.config.logaudios) logStream.write(samples);
            }
        }
    },

    streamToServer: function (captureddata) {
        if (this.amplification) {
            this.audiotools.amplify(captureddata, this.amplification)
        }

        streamServer.write(captureddata);
        this._wspush();
    },

    endStreamToServer : function () {
        if (ws.readyState == ws.OPEN) {
            ws.send('EOS');
        }
        if (this.config.logaudios) logStream.close();
    }
}
