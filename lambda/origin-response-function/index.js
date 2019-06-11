'use strict';

const querystring = require('querystring');
const aws = require('aws-sdk');
const s3 = new aws.S3({
  region: 'YOUR_REGION',
  signatureVersion: 'v4'
});
const sharp = require('sharp');

// Image types that can be handled by Sharp
const supportImageTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'tiff'];

exports.handler = async (event, context, callback) => {
  const { config, request, response } = event.Records[0].cf;

  // select origin bucket
  const bucket = 'YOUR_BUCKET';

  // check if image is present and not cached.
  if (response.status == 200) {
    // parse the querystring key-value pairs.
    const params = querystring.parse(request.querystring);
    // If none of the s, t, or q variables is present, just pass the request
    if (!params.s || !params.t || !params.q) {
      callback(null, response);
      return;
    }

    // read the S3 key from the path variable.
    // assets/images/sample.jpeg
    let key = decodeURIComponent(request.uri).substring(1);

    // parse the width, height, type, quality, format, image name
    let width, height, type, quality, requiredFormat;

    // s=100x100&t=enlargement&q=100(&f=webp)
    const sizeMatch = params.s.split('x');
    const typeMatch = params.t;
    const qualityMatch = params.q;
    const formatMatch = params.f;

    let originalFormat = key.match(/(.*)\.(.*)/)[2].toLowerCase();

    if (
      !supportImageTypes.some(type => {
        return type == originalFormat;
      })
    ) {
      responseUpdate(403, "Forbidden", "Unsupported image type", [
        { key: "Content-Type", value: "text/plain" }
      ]);
      callback(null, response);
      return;
    }

    width = parseInt(sizeMatch[0], 10);
    height = parseInt(sizeMatch[1], 10);
    type = typeMatch == "crop" ? "cover" : typeMatch;
    quality = parseInt(qualityMatch, 10);

    // correction for jpg required for 'Sharp'
    originalFormat = originalFormat == "jpg" ? "jpeg" : originalFormat;
    requiredFormat =
      formatMatch == "webp"
        ? "webp"
        : originalFormat == "jpg"
          ? "jpeg"
          : originalFormat;

    try {
      // get the source image file
      const s3Object = await s3
        .getObject({
          Bucket: bucket,
          Key: key
        })
        .promise();
      if (s3Object.ContentLength == 0) {
        responseUpdate(404, "Not Found", "The image does not exist.", [
          { key: "Content-Type", value: "text/plain" }
        ]);
        callback(null, response);
        return;
      }

      let metaData,
        resizedImage,
        byteLength = 0;

      if (requiredFormat != "jpeg" && requiredFormat != "webp") {
        console.log(`Info: image format is ${requiredFormat}, trying to jpeg.`);
        requiredFormat = "jpeg";
      }
      while (1) {
        resizedImage = await sharp(s3Object.Body).rotate();
        metaData = await resizedImage.metadata();

        if (metaData.width > width || metaData.height > height) {
          resizedImage.resize(width, height, { fit: type });
        }
        if (byteLength >= 1046528 || originalFormat != requiredFormat) {
          resizedImage.toFormat(requiredFormat, { quality: quality });
        }
        resizedImage = await resizedImage.toBuffer();

        byteLength = Buffer.byteLength(resizedImage, "base64");
        if (byteLength == metaData.size) {
          callback(null, response);
          return;
        }
        if (byteLength >= 1046528) {
          quality -= 10;
          console.log(
            `Info: Content-Length is ${byteLength}, ` +
            `trying again with quality ${quality}. // ` +
            bucket +
            " ## " +
            key
          );
        } else {
          break;
        }
      }

      responseUpdate(
        200,
        "OK",
        resizedImage.toString("base64"),
        [{ key: "Content-Type", value: "image/" + requiredFormat }],
        "base64"
      );
      response.headers["cache-control"] = [
        { key: "cache-control", value: "max-age=31536000" }
      ];
      return callback(null, response);
    } catch (err) {
      console.log(
        `for debugging. key, params === ${key} === q=${params.q}&s=${
        params.s
        }&t=${params.t}`
      );
      console.error(err);
      callback(null, response);
      return;
    }
  } else {
    // allow the response to pass through
    callback(null, response);
    return;
  }

  function responseUpdate(
    status,
    statusDescription,
    body,
    contentHeader,
    bodyEncoding = undefined
  ) {
    response.status = status;
    response.statusDescription = statusDescription;
    response.body = body;
    response.headers["content-type"] = contentHeader;
    if (bodyEncoding) {
      response.bodyEncoding = bodyEncoding;
    }
  }
};