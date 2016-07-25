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


    setup: function(wakeword, config, audiotools, resetlisten){
        this.wakeword = wakeword;
        this.config = config;
        this.audiotools = audiotools;
        this.resetlisten = resetlisten;
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
            this.secret.evernote.authtoken = process.env.EVERNOTE_OAUTH_TOKEN;
        }
    },

    connectServer: function (){

        var wstream;
        var isWav;

        // if we need to apply gain, we setup sox first to give it time to start
        if (this.config.micgain > 0) this.audiotools.setupSox();

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
        });

        ws.on('message', (data, flags) => {
            if (!isWav){
                console.log(data); //-- TODO add score to metrics
                isWav = true;
                this.resetlisten();
            } else {
                wstream.write(data);
            }
        });

        ws.on('close', () => {
            if (wstream) wstream.end();
            if (!this.connectionfailed) this.audiotools.playresponse();
            if (this.config.logaudios) logStream.close();
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

        if (this.config.micgain > 0) {
            // here we get the Promise back
            this.audiotools.feedSox(captureddata,streamServer,this._wspush);
        } else {
            streamServer.write(captureddata);
            this._wspush();
        }

    },

    endStreamToServer : function () {
        if (ws.readyState == ws.OPEN) {
            ws.send('EOS');
        }
        if (this.config.logaudios) logStream.close();
    }
}