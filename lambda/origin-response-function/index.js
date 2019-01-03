'use strict';

const http = require('http');
const https = require('https');
const querystring = require('querystring');

const AWS = require('aws-sdk');
const S3 = new AWS.S3({
    region: "REGION",
    signatureVersion: 'v4'
});
const Sharp = require('sharp');

// set the S3 and API GW endpoints
const BUCKET = "BUCKET";

exports.handler = async (event, context, callback) => {
    let response = event.Records[0].cf.response;

    // check if image is not present
    if (response.status == 404) {
        let request = event.Records[0].cf.request;

        // read the required path.
        // /origin/article/201812/300x300/crop/100/webp/063B8D1B27DD4B16A8B94E4127B48B60FCB42ADC92434DF38230DDC533567A65.jpeg
        let path = request.uri;

        // read the S3 key from the path variable.
        // origin/article/201812/300x300/crop/100/webp/063B8D1B27DD4B16A8B94E4127B48B60FCB42ADC92434DF38230DDC533567A65.jpeg
        let key = path.substring(1);

        // parse the firstPrefix, secondPrefix, width, height, type, quality, format, image name
        let match, prefix, width, height, type, qual, requiredFormat, imageName, originalKey;

        match = key.match(/(.*)\/(\d+)x(\d+)\/(.*)\/(\d+)\/(.*)\/(.*)/);

        prefix = match[1];
        width = parseInt(match[2], 10);
        height = parseInt(match[3], 10);
        type = match[4] == "crop" ? "cover" : "fill";
        qual = parseInt(match[5], 10) 
        // correction for jpg required for 'Sharp'
        requiredFormat = match[6] == "jpg" ? "jpeg" : match[6];
        imageName = match[7];
        originalKey = prefix + "/" + imageName;

        try {
            // get the source image file
            const s3Object = await S3.getObject({
                Bucket: BUCKET,
                Key: originalKey
            }).promise();

            let resizedImage;

            while(1) {
                resizedImage = await Sharp(s3Object.Body)
                    .resize(width, height, { fit: type })
                    .toFormat(requiredFormat, { quality: qual })
                    .toBuffer();
                
                let byte_length = Buffer.byteLength(resizedImage, 'base64');
                if (byte_length >= 1024000) {
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
    }
    else {
        // allow the response to pass through
        callback(null, response);
    }
};