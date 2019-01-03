'use strict';

const querystring = require('querystring');

exports.handler = (event, context, callback) => {
    const request = event.Records[0].cf.request;
    const headers = request.headers;
    
    // parse the querystring key-value pairs.
    const params = querystring.parse(request.querystring);

    // fetch the uri of original image
    let fwdUri = request.uri;

    // If none of the s, t, or q variables is present, just pass the request
    if(!params.s || !params.t || !params.q){
        callback(null, request);
        return;
    }

    // read the parameter values
    const sizeMatch = params.s.split("x");
    const typeMatch = params.t;
    const qualityMatch = params.q;

    // set the width and height parameters
    let width = sizeMatch[0];
    let height = sizeMatch[1];

    //parse the prefix, image name and extension from the uri.
    // In our case
    // /origin/article/201812/063B8D1B27DD4B16A8B94E4127B48B60FCB42ADC92434DF38230DDC533567A65.jpeg
    const match = fwdUri.match(/(.*)\/(.*)\.(.*)/);

    let prefix = match[1];
    let imageName = match[2];
    let extension = match[3];

    // read the accept header to determine if webP is supported.
    let accept = headers['accept']?headers['accept'][0].value:"";

    let url = [];
    // build the new uri to be forwarded upstream
    url.push(prefix);
    url.push(width+"x"+height);
    url.push(typeMatch);
    url.push(qualityMatch);


    // check support for webp
    if (accept.includes('webp')) {
        url.push('webp');
    }
    else {
        url.push(extension);
    }
    url.push(imageName+"."+extension);

    fwdUri = url.join("/");

    // final modified url is of format
    // /origin/article/201812/300x300/crop/100/webp/063B8D1B27DD4B16A8B94E4127B48B60FCB42ADC92434DF38230DDC533567A65.jpeg
    request.uri = fwdUri;
    callback(null, request);
};