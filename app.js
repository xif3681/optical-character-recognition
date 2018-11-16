var program = require('commander');
const {
    ImageClient
} = require('image-node-sdk');

let AppId = '1256966544'; // 腾讯云 AppId
let SecretId = 'AKID1dAZnwAjNuHVeiBKsFQTYgsFkEjIpKXm'; // 腾讯云 SecretId
let SecretKey = 'RuNpQ6oWDwbM7thVN5shWNrPwV4eIPmo'; // 腾讯云 SecretKey

const fs = require('fs');
const path = require('path');

// 从命令行参数中读取待注册子设备名称和子设备产品Key
program
    .version('0.1.0')
    .usage('[options] <image>')
    .arguments('<image>')
    .action(function (image) {
        recognize(image);
    })
    .parse(process.argv);

function recognize(image) {
    let filename = image;

    let imgClient = new ImageClient({AppId, SecretId, SecretKey});
    imgClient.ocrGeneral({
        formData: {
            card_type: 0,
            image: fs.createReadStream(path.join(__dirname, filename))
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
            if (lastHeight != 0 && Math.abs(item.itemcoord.height - lastHeight) > 10 ||
                lastX != 0 && Math.abs(item.itemcoord.x - lastX) > 20) {
                allstring += '\n';
            }
            allstring += item.itemstring;
            lastHeight = item.itemcoord.height;
            lastX = item.itemcoord.x;
        });
        console.log('通用印刷体识别结果');
        console.log(allstring);

    }).catch((e) => {
        console.log(e);
    });
}



