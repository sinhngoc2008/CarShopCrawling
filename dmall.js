const request = require("request-promise");
const cheerio = require("cheerio");
const fs = require("fs");
const axios = require("axios");
const cron = require("node-cron");

const SLEEP_INTERVAL = 1000;
const API_URL = "https://dev-api.otohanviet.com";

const URL = "https://dautomall.com/Price/PriceBody.do";
const DETAIL_URL = "https://dautomall.com/BuyCar/BuyCarView.do";
const BRAND_URL = "https://dautomall.com/BuyCar/BuyCarDomesticList.do";

const MainName_URL = "https://dautomall.com/Main/CarNameAjax.do";
const MainModel_URL = "https://dautomall.com/Main/CarModelAjax.do";
const MainClass_URL = "https://dautomall.com/Main/CarClassAjax.do";

// sleep handle
async function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

const getPageContent = async (uri) => {
    // console.log(uri);
    const options = {
        method: 'GET',
        uri: uri,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        json: true, // Automatically stringifies the body to JSON
        // text: true,
        transform: async (data) => {
            // console.log(data);
            return await cheerio.load(data, { xmlMode: true, decodeEntities: false });
        },
    };

    return await request(options);
};

// Convert data to otohanviet format
async function convertData(inData){
    var today = new Date();
    var checkDate = today.toJSON().slice(0, 10).replace("-","").replace("-","");
    
    var outData = {
        car_code: inData.id,
        performance_check: 'https://pc.dautomall.com/inc/popup/BuycarPopup_Inspect2.aspx?sCarProductCode='+inData.id+'&sCarProductCheckDate=' + checkDate,
        car_model: inData.model,
        listImage: inData.image,
        car_name: inData.title,
        price: inData.price,
        basic_infr: {
            year_manufacture: inData.specification.date,
            color: inData.specification.color,
            fuel_type: inData.specification.fuel,
            distance_driven: inData.specification.mileage,
            plate_number: inData.specification.plate,
            transmission: inData.specification.transmission,
            presentation_number: inData.specification.presentation
        },
        convenience_infr: ['헤드램프(HID)', '에어백(커튼)', '패들 시프트', '후측방 경보 시스템', '레인센서', '앞좌석 AV 모니터', '통풍시트(뒷좌석)', '루프랙', '파워 도어록', '타이어 공기압센서(TPMS)', '크루즈 컨트롤(일반, 어댑티브)', '커튼/블라인드(뒷좌석, 후방)', '스티어링 휠 리모컨', '전자식 주차브레이크(EPB)', '내비게이션', '자동 에어컨', '뒷좌석 AV 모니터', 'USB 단자', '전동시트(운전석, 동승석)', '헤드업 디스플레이(HUD)', 'CD 플레이어', '차체자세 제어장치(ESC)', 'AUX 단자', '가죽시트', '열선시트', 'ECM 룸미러', '파워 전동 트렁크', '파워 스티어링 휠', '에어백(사이드)', '스마트키', '오토 라이트', '알루미늄 휠', '미끄럼 방지(TCS)', '차선이탈 경보 시스템(LDWS)', '전동 조절 스티어링 휠', '고스트 도어 클로징', '에어백(운전석, 동승석)', '브레이크 잠김 방지(ABS)', '선루프', '전동시트(뒷좌석)', '메모리 시트(운전석, 동승석)', '파워 윈도우', '후방 카메라', '전자제어 서스펜션(ECS)', '360도 어라운드 뷰', '블루투스', '전동접이 사이드 미러', '열선 스티어링 휠', '하이패스', '통풍시트', '주차감지센서', '무선도어 잠금장치', '마사지 시트'],
        primary_image: (inData.image.length > 0)? inData.image[0] : "",
        other_infor: inData.type,
        category_name: inData.brand,
        model_name: inData.model,
        detail_name: inData.class,
        rating: inData.option,
    };


    return {
        data : {
        ...outData,
        source_crawl : 'https://dautomall.com'
    }};
}

/**Save data to server */
async function saveData(data) {
    var count = data.length;
    if(count == 0) return;
    for(var i = 0; i < count; i++)
    {
        var input_data = data[i];
        
        // skip in case of noimage
        if(input_data.image.length < 2) continue;

        // skip in case of no price
        if(input_data.price == 0) continue;

        var convertedData = await convertData(input_data);
        // console.log(convertedData);
        try {
          const response = await axios.post(`${API_URL}/api/cars/save-dautomall`, convertedData );
          console.log(response.data.message);
        } catch (error) {
          console.log("error to save data", error);
        }
        finally{
            await sleep(SLEEP_INTERVAL) /// waiting 1 second.
        }
    }
}

// Write data to file
async function WriteFile2Disk(filename, data){
    await fs.writeFileSync(filename, JSON.stringify(data), { encoding: "utf8", flag: "w", });
    var time_now = new Date();
    console.log("Finish write file: " + filename + " " + time_now.toLocaleTimeString());
}

/**
 * Get car model for 1 each branch
 *
 * @param {*} uri (Ex: ${URL}page/2)
 */
const getCarModels = (uri, brandID) => {
    // console.log(uri);
    const options = {
        method: 'POST',
        uri: uri,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        formData: {
            sCarCode: brandID,
            pageIndex: 1,
        },
        json: true,
        transform: (body, response, resolveWithFullResponse) => {
            return body.result;
        }
    };
    return request(options);
};

/**
 * Get car class for 1 each branch and 1 model
 *
 * @param {*} uri (Ex: ${URL}page/2)
 */
const getCarClasses = (uri, modelID) => {
    // console.log(uri);
    const options = {
        method: 'POST',
        uri: uri,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        formData: {
            sCarCode: modelID,
            pageIndex: 1,
        },
        json: true,
        transform: (body, response, resolveWithFullResponse) => {
            return body.result;
        }
    };
    return request(options);
};

/**
 * Get option for each classid
 * @param {URL API} uri 
 * @param {classid} classid 
 */
const getCarOptions = (uri, classid) => {
    // console.log(uri);
    const options = {
        method: 'POST',
        uri: uri,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        formData: {
            sCarCode: classid.code,
            pageIndex: 1,
        },
        json: true,
        transform: (body, response, resolveWithFullResponse) => {
            return body.result;
        }
    };
    return request(options);
}

/**
 * Get content for each page
 *
 * @param {*} uri (Ex: ${URL}page/2)
 */
const getPageContent3 = (uri, code1, code2, code3, pageIdx = 1) => {
    // console.log(uri);
    const options = {
        method: 'POST',
        uri: uri,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        formData: {
            // sCarCode: 'A000001',
            // sCarCode2: 'A000029',
            // sCarCode3: 'A020487',
            sCarCode: code1,
            sCarCode2: code2,
            sCarCode3: code3,
            pageIndex: pageIdx
        },
        json: true, // Automatically stringifies the body to JSON
        // text: true,
        transform: (data) => {
            // console.log(data);
            return cheerio.load(data, { xmlMode: true, decodeEntities: false });
        },
    };

    return request(options);
};

const getPageContent4 = (uri, code1, code2, code3, code4, pageIdx = 1) => {
    // console.log(uri);
    const options = {
        method: 'POST',
        uri: uri,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        formData: {
            // sCarCode: 'A000161',
            // sCarCode2: 'A000170',
            // sCarCode3: 'A000171',
            // sCarClassArr: 'A005378',
            sCarCode: code1,
            sCarCode2: code2,
            sCarCode3: code3,
            sCarClassArr: code4,
            pageIndex: pageIdx
        },
        json: true, // Automatically stringifies the body to JSON
        // text: true,
        transform: (data) => {
            // console.log(data);
            return cheerio.load(data, { xmlMode: true, decodeEntities: false });
        },
    };

    return request(options);
};

/**
 * Get list car brand
 */
var getListCarBrands = ($) => {
    var data = [];
    var brand_elements = $('#maker').find("li > a > span");
    // console.log(brand_elements.length)
    // console.log(brand_elements)
    brand_elements.each((idx, element) => {
        var car_code = element.attribs.id.replace("Maker", '');
        var car_name = element.children[0].data;
        data.push({ code: car_code, name: car_name });
    });
    return data;
};

/**
 * Get list car models
 */
var getListCarModels = async (brandID) => {
    var data = [];
    var carmodels = await getCarModels(MainName_URL, brandID);
    await carmodels.forEach(element => {
        data.push({ code: element.sCarCode, name: element.sCarName });
    });
    return data;
};

/**
 * Get list car class
 */
var getListCarClassess = async (modelID) => {
    var data = [];
    var carmodels = await getCarClasses(MainModel_URL, modelID);
    await carmodels.forEach(element => {
        data.push({ code: element.sCarCode, name: element.sCarName });
    });
    return data;
};



/**
 * Get page count
 * @param {*} $ 
 * @returns 
 */
var getPageCount = ($) => {
    var pagination = $(".pageWp .pagination .NextNext");
    var PageCount = parseInt(pagination.attr("onclick").replace('parent.linkPage(', '').replace('); return false;', ''));
    // console.log("Totla page count: " +  PageCount);
    return PageCount;
};
var processGetPageCount = async (brandid, modelid, classid) => {
    var pageCount = 0;
    await getPageContent3(`${URL}`, brandid, modelid, classid, 1).then(async ($) => {
        pageCount = await getPageCount($);
    });
    return pageCount;
};
/**
 * Get all car item in a page of search list
 * @param {*} $ 
 * @returns 
 */
var getQueryItems = ($) => {
    var items = $("body").find("tr");
    var codes = [];
    items.each((_, c) => {
        if (c.attribs["onclick"] != undefined) {
            var onclickItems = c.attribs["onclick"];
            // console.log(onclickItems);

            var parts = onclickItems.replace("fn_CarProductDetailView('", "").replace("')", "").split("', '");

            // console.log(parts[0], parts[1]);
            codes.push({ carcode: parts[0], usercode: parts[1] });
        }
    });
    return codes;
};

var processgetQueryItems = async (brandid, modelid, classid, pageid) => {
    var items = []
    await getPageContent3(`${URL}`, brandid, modelid, classid, pageid).then(async ($) => {
        items = await getQueryItems($);
    });
    return items;
};
var processgetQueryItemsOption = async (brandid, modelid, classid, option, pageid) => {
    var items = []
    await getPageContent4(`${URL}`, brandid, modelid, classid, option, pageid).then(async ($) => {
        items = await getQueryItems($);
    });
    return items;
};
/**
 * Replace space function
 * @param {} str 
 * @returns 
 */
function replaceNbsps(str) {
    return str.replace("&nbsp;", " ").replace(/\s/g, '');
}
/**
 * Get car detail
 * @param {} $ 
 */
var getCarDetail = ($) => {
    var data = {
        title: '',
        image: [],
        price: '',
        type: '',
        location: '',
        specification: {
            date: '',
            color: '',
            fuel: '',
            mileage: '',
            plate: '',
            transmission: '',
            presentation: ''
        },
        seller: {
            id: '',
            name: '',
            phone: '',
            certificate: '',
            finished: '',
            inprogress: '',
            address: ''
        },
        convenience_infr: ['앞좌석 AV 모니터', '통풍시트(뒷좌석)', '주차감지센서', '헤드램프(HID)', '패들 시프트', '후측방 경보 시스템', '자동 에어컨', '뒷좌석 AV 모니터', 'USB 단자', '전동시트(운전석, 동승석)', '고스트 도어 클로징', '에어백(운전석, 동승석)', '브레이크 잠김 방지(ABS)', '차체자세 제어장치(ESC)', 'AUX 단자', '가죽시트', '열선시트', '루프랙', '파워 도어록', '크루즈 컨트롤(일반, 어댑티브)', '타이어 공기압센서(TPMS)', '에어백(커튼)', '레인센서', '스티어링 휠 리모컨', '전자식 주차브레이크(EPB)', '내비게이션', '무선도어 잠금장치', '마사지 시트', '파워 전동 트렁크', '파워 스티어링 휠', '에어백(사이드)', '스마트키', '오토 라이트', '알루미늄 휠', '미끄럼 방지(TCS)', '차선이탈 경보 시스템(LDWS)', '전동 조절 스티어링 휠', 'ECM 룸미러', '전자제어 서스펜션(ECS)', '360도 어라운드 뷰', '블루투스', '선루프', '전동시트(뒷좌석)', '메모리 시트(운전석, 동승석)', '후방 카메라', '헤드업 디스플레이(HUD)', 'CD 플레이어', '전동접이 사이드 미러', '열선 스티어링 휠', '하이패스', '통풍시트', '파워 윈도우', '커튼/블라인드(뒷좌석, 후방)'],
        performance_check: ''
    };

    {// Get car title
        var title = $(".sellcarBox .infoWp .secTop").find("h3").text();
        data.title = title.trim();
    }

    {// specification at title
        var detail_spec = $(".sellcarBox .infoWp .wd60p .detailType.ellipsis").html().trim();
        var detail_specs = $(".sellcarBox .infoWp .secTop .wd60p .tags").find('span');
        var date = replaceNbsps(detail_specs[0].children[0].data.trim());
        
        var mileage = detail_specs[1].children[0].data.toString().trim().replace('km','');
        var numbermileage = Number(mileage.replace(/[^0-9]/g, "")) || 0;

        var fuel = detail_specs[2].children[0].data.trim();
        var location = detail_specs[3].children[0].data.trim();

        data.type = detail_spec;
        data.specification.fuel = fuel;
        data.specification.date = date;
        data.specification.mileage = numbermileage;
        data.location = location;
    }

    {// Get detail specs

        var tb2 = $("#basic_infr .tb02");
        var tr = $(tb2).find("tr");

        // First row
        var row1 = tr[0];
        var td1 = $(row1).find("td");
        if (td1[0].children[0] != undefined) {
            data.specification.date = replaceNbsps(td1[0].children[0].data).trim();
        }
        if (td1[1].children[0] != undefined) {
            data.specification.color = (td1[1].children[0].data).trim();
        }

        // Second row
        var row2 = tr[1];
        var td2 = $(row2).find("td");
        if (td2[0].children[0] != undefined) {
            data.specification.fuel = td2[0].children[0].data.trim();
        }
        if (td2[1].children[0] != undefined) {
            mileage = td2[1].children[0].data.trim().replace("km", "");
            data.specification.mileage = Number(mileage.replace(/[^0-9]/g, "")) || 0;
        }

        // Third row 
        var row3 = tr[2];
        var td3 = $(row3).find("td");
        if (td3[0].children[0] != undefined) {
            data.specification.plate = td3[0].children[0].data.trim();
        }
        if (td3[1].children[0] != undefined) {
            data.specification.transmission = td3[1].children[0].data.trim();
        }

        // Fourth row 
        var row4 = tr[3];
        var td4 = $(row4).find("td");
        if (td4[0].children[0] != undefined) {
            data.specification.presentation = td4[0].children[0].data.trim();
        }
    }

    {// Get price
        var price = $(".sellcarBox .infoWp .price .org.ft_exo").text();
        data.price = Number(price.replace(/[^0-9]/g, "")) || 0;
    }

    {// Get image list
        var imagePart = $(".sellcarBox .carDetail.inner.mt30 .imgWp .container .product__slider-main").find('div ')
        imagePart.each((idx, e) => {
            if (e.attribs.style !== undefined) {
                var image_url = e.attribs.style.toString().replace("background-image: url(", "").replace(")", "");
                data.image.push(image_url);
            }
        });
    }

    {// Get seller info
        data.seller.name = replaceNbsps($(".profile_inf .name").text().trim()).replace("상사딜러", " 상사딜러");
        data.seller.phone = $(".profile_inf .telno").text().trim();
        data.seller.certificate = $(".profile_inf .part").text().trim();

        var performance = $(".profile_inf .tags").find("b");
        if (performance[0] != undefined) {
            data.seller.inprogress = performance[0].children[0].data.trim();
        }
        if (performance[1] != undefined) {
            data.seller.finished = performance[1].children[0].data.trim();
        }

        var address = $(".togomap_wp").find("span");
        var floor = address[0].children[0].data;
        var room = address[1].children[0].data;
        var office_name = address[2].children[0].data;
        data.seller.address = floor + " " + room + "호 " + office_name;
    }
    // console.log(data);
    return data;
};


var processGetCarDetail = async (carcode, usercode) => {
    var result = [];
    await getPageContent(`${DETAIL_URL}?sCarProductCode=${carcode}&sUserCode=${usercode}`).then((detail) => {
        // console.log(detail.html());
        result = getCarDetail(detail);
    });
    return result;
};

///////////////////////////////////////////////////////////////////////////
// Crawl Detail data with only 3 parameters
// Brand -> Model -> Class
///////////////////////////////////////////////////////////////////////////
var processGetClassDetail = async (brand, model, classid) => {
    console.log("Processing: " + brand.code + " " + model.code + " " + classid.code);
    console.log("Processing: " + brand.name + " " + model.name + " " + classid.name);
    /**
     * Get dautomall page content
     */
    var PageCount = await processGetPageCount(brand.code, model.code, classid.code);
    console.log("Total page: " + PageCount);

    var total_items = [];
    var total_details = [];
    for (var pageID = 1; pageID <= PageCount; pageID++) {
        console.log("Processing page: " + pageID);

        var Items = await processgetQueryItems(brand.code, model.code, classid.code, pageID);
        total_items.push(Items);

        for (var id = 0; id < Items.length; id++) {
            var item = Items[id];
            var car_detail = await processGetCarDetail(item.carcode, item.usercode);
            car_detail.brandid = brand.code;
            car_detail.brand = brand.name;
            car_detail.modelid = model.code;
            car_detail.model = model.name;
            car_detail.classid = classid.code;
            car_detail.class = classid.name;
            car_detail.id = item.carcode;
            car_detail.seller.id = item.usercode;
            total_details.push(car_detail);
        }
    }

    var filename = "Data/" + brand.code + "." + model.code + "." + classid.code + ".json";
    // await WriteFile2Disk(filename, total_details);
    await saveData(total_details);
};



///////////////////////////////////////////////////////////////////////////
// Crawl Detail data with 4 parameters
// Brand -> Model -> Class -> Option
///////////////////////////////////////////////////////////////////////////
var processGetClassDetailOption = async (brand, model, classid, option) => {
    try{
    console.log("Processing: " + brand.code + " " + model.code + " " + classid.code + " " + option.code);
    console.log("Processing: " + brand.name + " " + model.name + " " + classid.name + " " + option.name);
    /**
     * Get dautomall page content
     */
    var PageCount = await processGetPageCount(brand.code, model.code, classid.code);
    console.log("Total page: " + PageCount);

    var total_items = [];
    var total_details = [];
    for (var pageID = 1; pageID <= PageCount; pageID++) {
        console.log("Processing page: " + pageID);

        var Items = await processgetQueryItemsOption(brand.code, model.code, classid.code, option.code, pageID);
        total_items.push(Items);

        for (var id = 0; id < Items.length; id++) {
            var item = Items[id];
            var car_detail = await processGetCarDetail(item.carcode, item.usercode, option);
            car_detail.brandid = brand.code;
            car_detail.brand = brand.name;
            car_detail.modelid = model.code;
            car_detail.model = model.name;
            car_detail.classid = classid.code;
            car_detail.class = classid.name;
            car_detail.optionid = option.code;
            car_detail.option = option.name;
            car_detail.id = item.carcode;
            car_detail.seller.id = item.usercode;
            total_details.push(car_detail);
        }
    }

    var filename = "Data/" + brand.code + "." + model.code + "." + classid.code + "." + option.code + ".json";
    // await WriteFile2Disk(filename, total_details);
    await saveData(total_details);
}
catch(error)
{
    console.log(error)
}
};

var processGetOptions = async (classid) => {
    var data = [];
    var caroptions = await getCarOptions(MainClass_URL, classid);
    await caroptions.forEach(element => {
        data.push({ code: element.sCarCode, name: element.sCarName });
    });
    return data;
};


////////////////////////////////////////////////////////
/// Query to get all car brand ID
// Brand -> Model -> Class
////////////////////////////////////////////////////////
var CrawlData = () => {
    getPageContent(`${BRAND_URL}`).then(async ($) => {

        // get list brand such as Kia, Huyndai....
        var listBrands = getListCarBrands($)

        ////////////////////////////////////////////////////////
        // Get detail of each Brand
        ////////////////////////////////////////////////////////
        var brandCount = listBrands.length;
        for (var brandID = 0; brandID < brandCount; brandID++) {
            var brand = listBrands[brandID];
            var models = await getListCarModels(brand.code);

            ////////////////////////////////////////////////////////
            // Get detail of each Model
            ////////////////////////////////////////////////////////
            var modelCount = models.length;
            for (var modelID = 0; modelID < modelCount; modelID++) {
                var model = models[modelID];
                var classes = await getListCarClassess(model.code);

                ////////////////////////////////////////////////////////
                // Get detail of each Class
                ////////////////////////////////////////////////////////
                var classCount = classes.length;
                for (var classID = 0; classID < classCount; classID++) {
                    var classid = classes[classID];
                    await processGetClassDetail(brand, model, classid);
                    console.log("==================================");

                }
            }
        }
    });
};

////////////////////////////////////////////////////////
/// Query to get all car
// Brand -> Model -> Class -> Option
////////////////////////////////////////////////////////
var CrawlDataOption = () => {
    getPageContent(`${BRAND_URL}`).then(async ($) => {

        // get list brand such as Kia, Huyndai....
        var listBrands = getListCarBrands($);

        ////////////////////////////////////////////////////////
        // Get detail of each Brand
        ////////////////////////////////////////////////////////
        var brandCount = listBrands.length;
        for (var brandID = 0; brandID < brandCount; brandID++) {
            var brand = listBrands[brandID];
            var models = await getListCarModels(brand.code);

            ////////////////////////////////////////////////////////
            // Get detail of each Model
            ////////////////////////////////////////////////////////
            var modelCount = models.length;
            for (var modelID = 0; modelID < modelCount; modelID++) {
                var model = models[modelID];
                var classes = await getListCarClassess(model.code);

                ////////////////////////////////////////////////////////
                // Get detail of each Class
                ////////////////////////////////////////////////////////
                var classCount = classes.length;
                for (var classID = 0; classID < classCount; classID++) {
                    var classid = classes[classID];
                    var options = await processGetOptions(classid);
                    
                    ////////////////////////////////////////////////////////
                    // Get detail of each Option
                    ////////////////////////////////////////////////////////
                    var optionCount = options.length;
                    for (var optionID = 0; optionID < optionCount; optionID++) {
                        var option = options[optionID];
                        await processGetClassDetailOption(brand, model, classid, option);
                    }
                    console.log("==================================");

                }
            }
        }
    });
};

////////////////////////////////////////////////////////
/// Run Test Data
////////////////////////////////////////////////////////
var TestData = () => {
    getPageContent(`${BRAND_URL}`).then(async ($) => {
        // get list brand such as Kia, Huyndai....
        var listBrands = getListCarBrands($)

        ////////////////////////////////////////////////////////
        // Get detail of each Brand
        ////////////////////////////////////////////////////////
        var brand = listBrands[2];
        var models = await getListCarModels(brand.code);

        ////////////////////////////////////////////////////////
        // Get detail of each Model
        ////////////////////////////////////////////////////////
        var model = models[1];
        var classes = await getListCarClassess(model.code);

        ////////////////////////////////////////////////////////
        // Get detail of each Class
        ////////////////////////////////////////////////////////
        var classid = classes[0];
        var options = await processGetOptions(classid);

        await processGetClassDetail(brand, model, classid, options);
        console.log("==================================");
    });
};

////////////////////////////////////////////////////////
/// Run Test Data With 4 parameters
////////////////////////////////////////////////////////
var TestDataOption = () => {
    getPageContent(`${BRAND_URL}`).then(async ($) => {
        // get list brand such as Kia, Huyndai....
        var listBrands = getListCarBrands($)

        ////////////////////////////////////////////////////////
        // Get detail of each Brand
        ////////////////////////////////////////////////////////
        var brand = listBrands[7];
        var models = await getListCarModels(brand.code);

        ////////////////////////////////////////////////////////
        // Get detail of each Model
        ////////////////////////////////////////////////////////
        var model = models[8];
        var classes = await getListCarClassess(model.code);
        // console.log(classes);

        ////////////////////////////////////////////////////////
        // Get detail of each Class
        ////////////////////////////////////////////////////////
        var classid = classes[1];
        var options = await processGetOptions(classid);

        ////////////////////////////////////////////////////////
        // Get detail of each Option
        ////////////////////////////////////////////////////////
        var optionCount = options.length;
        for (var optionID = 0; optionID < optionCount; optionID++) {
            var option = options[optionID];
            // var option = options[2];
            await processGetClassDetailOption(brand, model, classid, option);
        }
        console.log("==================================");
    });
};

var Run = async () => {
    console.time("Start crawling DAutoMall");
    // CrawlData();
    // TestData();
    await CrawlDataOption();
    // TestDataOption();
    console.timeEnd("Finish!!!");
};

// start crawling at 0h:0m:0s
const CRON_SCHEDULE = "0 0 * * *";

if (false) { 
    Run();
}
else {
    cron.schedule(CRON_SCHEDULE, async () => {
        Run();
    });
}
