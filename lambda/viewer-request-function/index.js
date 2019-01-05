'use strict';

const querystring = require('querystring');

exports.handler = (event, context, callback) => {
    const request = event.Records[0].cf.request;
    const headers = request.headers;
    
    // parse the querystring key-value pairs.
    const params = querystring.parse(request.querystring);

    // If none of the s, t, or q variables is present, just pass the request
    if(!params.s || !params.t || !params.q){
        callback(null, request);
        return;
    }
    // read the accept header to determine if webP is supported.
    let accept = headers['accept']?headers['accept'][0].value:"";

    // check support for webp
    if (accept.includes('webp')) {
        request.querystring += '&f=webp'
    }

    callback(null, request);
};