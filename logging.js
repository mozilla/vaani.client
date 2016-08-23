/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var Metrics = require('cd-metrics');
const domain = require('domain');
const d = domain.create();
d.on('error', (er) => {
    console.error('Caught error on cd-metrics', er);
});

var logger = function() {
    var args = Array.from(arguments);
    process.stdout.write(args.join(' ') + '\n');
};


module.exports = {
    metrics : null,
    clientId : null,
    options  : null,
    setup: function (clientId){
        this.clientId = clientId;

        this.options = {
            locale: 'pt-br',
            os: 'osx',
            os_version: 'elcapitan',
            device: 'pc',
            app_name: 'vaani-test',
            app_version: '0.1',
            app_update_channel: 'develop',
            app_build_id: '0.1',
            app_platform: 'node',
            arch: 'x64',
            logger: logger
        };

        this.metrics = new Metrics(this.clientId, this.options);
    },

    addmetric : function (category, action, label, value){

        d.run(() => {
            parseInt(value) ? this.metrics.recordEventAsync(category, action, label, value) :
                this.metrics.recordFloatingPointEventAsync(category, action, label, value);

        });
    }

}