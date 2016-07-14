#!/usr/bin/env sh
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

set -e

rm -f *.pem

openssl req -new -x509 -days 9999 -config ca.cnf -passout "env:PASSWORD" -keyout ca-key.pem -out ca-crt.pem

openssl genrsa -des3 -passout "env:PASSWORD" -out server-key.pem 4096
openssl req -new -config server.cnf -passin "env:PASSWORD" -key server-key.pem -out server-csr.pem
openssl x509 -req -extfile server.cnf -days 999 -passin "env:PASSWORD" -in server-csr.pem -CA ca-crt.pem -CAkey ca-key.pem -CAcreateserial -out server-crt.pem

openssl genrsa -des3 -passout "env:PASSWORD" -out client-key.pem 4096
openssl req -new -config client.cnf -passin "env:PASSWORD" -key client-key.pem -out client-csr.pem
openssl x509 -req -extfile client.cnf -days 999 -passin "env:PASSWORD" -in client-csr.pem -CA ca-crt.pem -CAkey ca-key.pem -CAcreateserial -out client-crt.pem

openssl verify -CAfile ca-crt.pem client-crt.pem

rm -f *csr.pem
