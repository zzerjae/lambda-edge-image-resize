'use strict';

const querystring = require('querystring');

const AWS = require('aws-sdk');
const S3 = new AWS.S3({
    region: "REGION",
    signatureVersion: 'v4'
});
const Sharp = require('sharp');

// set the S3 and API GW endpoints
const BUCKET = 'BUCKET';

exports.handler = async (event, context, callback) => {
    let response = event.Records[0].cf.response;
    let request = event.Records[0].cf.request;
    let headers = request.headers;

    // parse the querystring key-value pairs.
    const params = querystring.parse(request.querystring);
    // If none of the s, t, or q variables is present, just pass the request
    if(!params.s || !params.t || !params.q){
        callback(null, request);
        return;
    }

    // read the S3 key from the path variable.
    // origin/article/201812/063B8D1B27DD4B16A8B94E4127B48B60FCB42ADC92434DF38230DDC533567A65.jpeg
    let key = request.uri.substring(1);

    // parse the firstPrefix, secondPrefix, width, height, type, quality, format, image name
    let match, width, height, type, qual, requiredFormat;
    
    // s=100x100&t=crop&q=100
    const sizeMatch = params.s.split("x");
    const typeMatch = params.t;
    const qualityMatch = params.q;

    match = key.match(/(.*)\.(.*)/);

    width = parseInt(sizeMatch[0], 10);
    height = parseInt(sizeMatch[1], 10);
    type = typeMatch == "crop" ? "cover" : "fill";
    qual = parseInt(qualityMatch, 10)

    // read the accept header to determine if webP is supported.
    let accept = headers['accept']?headers['accept'][0].value:"";
    // correction for jpg required for 'Sharp'
    requiredFormat = accept.includes('webp') ? 'webp' : match[2] == 'jpg' ? 'jpeg' : match[2];

    try {
        // get the source image file
        const s3Object = await S3.getObject({
            Bucket: BUCKET,
            Key: key
        }).promise();

        let resizedImage;

        while(1) {
            resizedImage = await Sharp(s3Object.Body)
                .resize(width, height, { fit: type })
                .toFormat(requiredFormat, { quality: qual })
                .toBuffer();
            
            let byte_length = Buffer.byteLength(resizedImage, 'base64');
            if (byte_length >= 1048000) {
                qual -= 5;
                console.log(`Info: Content-Length is ${byte_length}, ` +
                            `trying again with quality ${qual}. // ` +
                            originalKey);
            }
            else {
                break;
            }
        }
        response.status = 200;
        response.statusDescription = "OK";
        response.body = resizedImage.toString('base64');
        response.bodyEncoding = 'base64';
        response.headers['content-type'] = [
            {
                key: "Content-Type",
                value: "image/" + requiredFormat
            }
        ];

        return callback(null, response);
    }
    catch (err) {
        console.error(err);
        return callback(err);
    }
    
};