/*
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
*/

/* Test MPIN - test driver and function exerciser for MPIN API Functions */

var CTX = require("../../index");

var ctx = new CTX("BN254CX");

/* Test M-Pin */

var RAW = [];
var i;

var rng = new ctx.RAND();
rng.clean();
for (i = 0; i < 100; i++) {
    RAW[i] = i;
}

rng.seed(100, RAW);

var sha = ctx.MPIN.HASH_TYPE;

var S = [];
var SST = [];
var TOKEN = [];
var PERMIT = [];
var SEC = [];
var xID = [];
var xCID = [];
var X = [];
var Y = [];
var E = [];
var F = [];
var HCID = [];
var HID = [];
var HTID = [];

/* Set configuration */
var PINERROR = true;

/* Trusted Authority set-up */
ctx.MPIN.RANDOM_GENERATE(rng, S);
console.log("M-Pin Master Secret s: 0x" + ctx.MPIN.bytestostring(S));

/* Create Client Identity */
var IDstr = "testUser@miracl.com";
var CLIENT_ID = ctx.MPIN.stringtobytes(IDstr);
HCID = ctx.MPIN.HASH_ID(sha, CLIENT_ID); /* Either Client or TA calculates Hash(ID) - you decide! */

console.log("Client ID= " + ctx.MPIN.bytestostring(CLIENT_ID));

/* Client and Server are issued secrets by DTA */
ctx.MPIN.GET_SERVER_SECRET(S, SST);
console.log("Server Secret SS: 0x" + ctx.MPIN.bytestostring(SST));

ctx.MPIN.GET_CLIENT_SECRET(S, HCID, TOKEN);
console.log("Client Secret CS: 0x" + ctx.MPIN.bytestostring(TOKEN));

/* Client extracts PIN from secret to create Token */
var pin = 1234;
console.log("Client extracts PIN= " + pin);
var rtn = ctx.MPIN.EXTRACT_PIN(sha, CLIENT_ID, pin, TOKEN);
if (rtn != 0) {
    console.log("Failed to extract PIN ");
}

console.log("Client Token TK: 0x" + ctx.MPIN.bytestostring(TOKEN));

var date = ctx.MPIN.today();
/* Client gets "Time Token" permit from DTA */
ctx.MPIN.GET_CLIENT_PERMIT(sha, date, S, HCID, PERMIT);
console.log("Time Permit TP: 0x" + ctx.MPIN.bytestostring(PERMIT));

/* This encoding makes Time permit look ctx.RANDom - Elligator squared */
ctx.MPIN.ENCODING(rng, PERMIT);
console.log("Encoded Time Permit TP: 0x" + ctx.MPIN.bytestostring(PERMIT));
ctx.MPIN.DECODING(PERMIT);
console.log("Decoded Time Permit TP: 0x" + ctx.MPIN.bytestostring(PERMIT));

pin = 1234;

/* Set date=0 and PERMIT=null if time permits not in use

Client First pass: Inputs CLIENT_ID, optional RNG, pin, TOKEN and PERMIT. Output xID = x.H(CLIENT_ID) and re-combined secret SEC
If PERMITS are is use, then date!=0 and PERMIT is added to secret and xCID = x.(H(CLIENT_ID)+H_T(date|H(CLIENT_ID)))
ctx.RANDom value x is supplied externally if RNG=null, otherwise generated and passed out by RNG

If Time Permits OFF set xCID = null, HTID=null and use xID and HID only
If Time permits are ON, AND pin error detection is required then all of xID, xCID, HID and HTID are required
If Time permits are ON, AND pin error detection is NOT required, set xID=null, HID=null and use xCID and HTID only.


*/
var pxID = xID;
var pxCID = xCID;
var pHID = HID;
var pHTID = HTID;
var pE = E;
var pF = F;
var pPERMIT = PERMIT;

if (date != 0) {
    if (!PINERROR) {
        pxID = null;
        //	pHID=null;
    }
} else {
    pPERMIT = null;
    pxCID = null;
    pHTID = null;
}
if (!PINERROR) {
    pE = null;
    pF = null;
}

console.log("MPIN Multi Pass ");
rtn = ctx.MPIN.CLIENT_1(sha, date, CLIENT_ID, rng, X, pin, TOKEN, SEC, pxID, pxCID, pPERMIT);
if (rtn != 0) {
    console.error("FAILURE: CLIENT_1 rtn: " + rtn);
    process.exit(-1);
}
/* Server calculates H(ID) and H(T|H(ID)) (if time permits enabled), and maps them to points on the curve HID and HTID resp. */
ctx.MPIN.SERVER_1(sha, date, CLIENT_ID, pHID, pHTID);

/* Server generates ctx.RANDom number Y and sends it to Client */
ctx.MPIN.RANDOM_GENERATE(rng, Y);

/* Client Second Pass: Inputs Client secret SEC, x and y. Outputs -(x+y)*SEC */
rtn = ctx.MPIN.CLIENT_2(X, Y, SEC);
if (rtn != 0) {
    console.error("FAILURE: CLIENT_2 rtn: " + rtn);
    process.exit(-1);
}
/* Server Second pass. Inputs hashed client id, ctx.RANDom Y, -(x+y)*SEC, xID and xCID and Server secret SST. E and F help kangaroos to find error. */
/* If PIN error not required, set E and F = NULL */
rtn = ctx.MPIN.SERVER_2(date, pHID, pHTID, Y, SST, pxID, pxCID, SEC, pE, pF);

if (rtn != 0) {
    console.error("FAILURE: SERVER_1 rtn: " + rtn);
    process.exit(-1);
}
if (rtn == ctx.MPIN.BAD_PIN) {
    console.log("Server says - Bad Pin.");
    if (PINERROR) {
        var err = ctx.MPIN.KANGAROO(E, F);
        if (err != 0) {
            console.log("(Client PIN is out by " + err + ")");
        }
    }
} else {
    console.log("Server says - PIN is good! You really are " + IDstr);
}

console.log("SUCCESS");
