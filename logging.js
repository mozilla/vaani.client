/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var Metrics = require('cd-metrics');

var logger = function() {
    var args = Array.from(arguments);
    process.stdout.write(args.join(' ') + '\n');
};


module.exports = {
    metrics : null,
    clientId : null,
    options  : null,

    setup: function(clientId){
        this.clientId = clientId;

        this.options = {
            locale: 'locale',
            os: 'os',
            os_version: 'os_version',
            device: 'device',
            app_name: 'app_name',
            app_version: 'app_version',
            app_update_channel: 'app_update_channel',
            app_build_id: 'app_build_id',
            app_platform: 'app_platform',
            arch: 'arch',
            logger: logger
        };

        process.stdout.write("Instantiating Metrics object\n");
        this.metrics = new Metrics(this.clientId, this.options);
    },

    addmetric : function(category, action, label, value_integer){
        this.metrics.recordEvent(category, action, label, value_integer);
        process.stdout.write("Recording event...\n");

    }

}