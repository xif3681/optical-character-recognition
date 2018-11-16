var program = require('commander');

const { ImageClient } = require('image-node-sdk');
const TencentOption = {
    AppId: '1256966544',
    SecretId: 'AKID1dAZnwAjNuHVeiBKsFQTYgsFkEjIpKXm',
    SecretKey: 'RuNpQ6oWDwbM7thVN5shWNrPwV4eIPmo'
};

const AipOcrClient = require("baidu-aip-sdk").ocr;
const BaiduOption = {
    AppId: '14262451',
    ApiKey: 'wpc3NMaBrsH9ZE0SCGGiUNhI',
    SecretKey: 'axCly6rv96dPGlkmwO41xaGCSkNg4eSC'
};

var baiduClient = new AipOcrClient(BaiduOption.AppId, BaiduOption.ApiKey, BaiduOption.SecretKey);

const fs = require('fs');
const path = require('path');

const sharp = require('sharp');

// 从命令行参数中读取待注册子设备名称和子设备产品Key
program
    .version('0.1.0')
    .usage('[options] <image>')
    .arguments('<image>')
    .action(function (image) {
        baiduCrop(image, function (rects) {
            var pathInfo = path.parse(image);
            var subImagePath = path.join(__dirname, pathInfo.dir, pathInfo.name);
            fs.mkdir(subImagePath, function (err) {

            });
                // console.log(pathInfo);
            rects.forEach(function (rect, i) {
                var subImage = path.join(subImagePath, (i+1).toString()+pathInfo.ext);
                // console.log(subImage);
                sharp(image).extract({ left: rect.location.left, top: rect.location.top, width: rect.location.width, height: rect.location.height})
                    .toFile(subImage)
                    .then(info => {
                        // console.log(info);
                        tencentOCR(subImage);
                    })
                    .catch(err => {
                        console.log(err);
                    });
            });
        });
        // tencentOCR(image);
    })
    .parse(process.argv);

function baiduCrop(filename, fn) {

    var image = fs.readFileSync(filename).toString("base64");
    var options = {};
    options["recognize_granularity"] = "big";
    options["language_type"] = "CHN_ENG";
    options["detect_direction"] = "true";
    options["detect_language"] = "true";

    // 带参数调用通用文字识别（含位置信息版）, 图片参数为本地图片
    baiduClient.general(image, options).then(function(result) {
        //console.log("=========================================================================");
        //console.log("带参数调用通用文字识别（含位置信息版）");
        // console.log(JSON.stringify(result));
        var rects = [];
        var irect = -1;
        result.words_result.forEach(function(wordResult) {

            wordResult.direction = wordResult.location.height > wordResult.location.width?"V":"H";
            wordResult.language = isChinese(wordResult.words)?"CHN":"ENG";
            wordResult.wordCount = wordResult.words.length;
            if (wordResult.direction == "V") {
                wordResult.wordWidth = wordResult.location.width;
                wordResult.wordHeight = wordResult.location.height / wordResult.wordCount;
            } else {
                wordResult.wordWidth = wordResult.location.width / wordResult.wordCount;
                wordResult.wordHeight = wordResult.location.height;
            }
            if (irect == -1) {
                rects.push(wordResult);
                irect ++;
            } else {
                if (!mergeRect(rects[irect], wordResult)) {
                    rects.push(wordResult);
                    irect ++;
                }
            }

            // console.log(wordResult);
        });
        var maxRects = [];
        rects.forEach(function (rect) {
            if (maxRects.length == 0) {
                maxRects.push(rect);
            } else {
                var merged = false;
                for (var i = 0; i < maxRects.length; i++) {
                    merged = mergeRect(maxRects[i], rect);
                    if (merged) break;
                }
                if (!merged) {
                    maxRects.push(rect);
                }
            }
        });
        fn(maxRects);

    }).catch(function(err) {
        // 如果发生网络错误
        console.log(err);
    });

    function isChinese(temp)
    {
        var re=/[\u4e00-\u9fa5]/;
        if (re.test(temp))
            return true ;
        return false;
    }

    function mergeRect(rect1, rect2) {
        if (
            rect1.direction == rect2.direction &&
            rect1.language == rect2.language &&
            similarSize(rect1.wordWidth, rect1.wordHeight, rect2.wordWidth, rect2.wordHeight, rect1.direction) &&
            nearLocation(rect1.location, rect2.location, rect1.direction, rect1.wordWidth, rect1.wordHeight)
        ) {
            var minLeft = Math.min(rect1.location.left, rect2.location.left);
            var minTop = Math.min(rect1.location.top, rect2.location.top);
            rect1.location.width = Math.max(rect1.location.left+rect1.location.width, rect2.location.left+rect2.location.width) - minLeft;
            rect1.location.height = Math.max(rect1.location.top+rect1.location.height, rect2.location.top+rect2.location.height) - minTop;
            rect1.location.left = minLeft;
            rect1.location.top = minTop;
            rect1.words += (rect1.language=="ENG"?" ":"") + rect2.words;
            rect1.wordCount = rect1.words.length;

            return true;
        }
        return false;
    }
    function similarSize(width1, height1, width2, height2, direction) {
        var widthDiff = Math.abs(width2 - width1);
        var heightDiff = Math.abs(height2 - height1);
        if (
            widthDiff / Math.min(width1, width2) < 0.15 && direction == "H" ||
            heightDiff / Math.min(height1, height2) < 0.15 && direction == "V"
        ) {
            return true;
        }
        return false;
    }
    function nearLocation(location1, location2, direction, wordWith, wordHeight) {
        if (direction == "V") {
            var topDiff = Math.abs(location1.top - location2.top);
            var right = location1.left - location1.width;
            if (
                topDiff < wordHeight*2.5 &&
                Math.abs(location2.left - right) < wordWith ||
                Math.abs(location2.left - right) < wordWith * 0.15
            ) {
                return true;
            }
        } else {
            var leftDiff = Math.abs(location1.left - location2.left);
            var bottom = location1.top + location1.height;
            // console.log(`${leftDiff/ wordWith}, ${gap}, ${wordHeight}`);
            if (
                leftDiff < wordWith*2.5 &&
                Math.abs(location2.top - bottom) < wordHeight ||
                Math.abs(location2.top - bottom) < wordHeight * 0.15
            ) {
                return true;
            }
        }
        return false;
    }
}

function tencentOCR(image) {

    let imgClient = new ImageClient(TencentOption);
    imgClient.ocrGeneral({
        formData: {
            card_type: 0,
            image: fs.createReadStream(image)
        },
        headers: {
            'content-type': 'multipart/form-data'
        }
    }).then((result) => {
        var resultBody = JSON.parse(result.body);
        // console.log(resultBody.data);

        var allstring = "";
        var lastHeight = 0;
        var lastX = 0;
        resultBody.data.items.forEach(function (item) {
            //console.log(item);

            allstring += item.itemstring;
            lastHeight = item.itemcoord.height;
            lastX = item.itemcoord.x;
        });
        // console.log('通用印刷体识别结果');
        console.log(`${image} ${allstring}`);

    }).catch((e) => {
        console.log(e);
    });
}



