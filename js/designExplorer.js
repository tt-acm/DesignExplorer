function unloadPageContent() {
    /*
    	// This function removes current contents from the page
    	// Only base HTML objects will remain in the page afterwards
    	// Use this in case you want to load new data to the page
    */
    overwriteInitialGlobalValues();

    d3.select("div.legend").selectAll("*").remove(); // remove legend

    d3.select("#inputSliders").selectAll("*").remove(); //remove sliders
    d3.select("#inputSliders").append("form").attr("class", "sliders"); // append a form

    d3.select("div#graph").selectAll("*").remove(); //remove left side parallel coord graph
	d3.select("div#radarChart").selectAll("*").remove(); //remove right side graph

    d3.select("div#thumbnails-btm_container").select("div#sorting").selectAll("*").remove(); // remove sorting drop-down
    d3.select("div#thumbnails-btm_container").select("div#sorting").text("");
    d3.select("div#thumbnails-btm_container").select("div#thumbnails-btm").selectAll("*").remove(); // remove thumbnail images

    d3.select("div#thumbnails-side_container").select("div#sorting").selectAll("*").remove(); // remove thumbnail images
    d3.select("div#thumbnails-side_container").select("div#sorting").text("");
    d3.select("div#thumbnails-side_container").select("div#thumbnails-side").selectAll("*").remove(); // remove thumbnail images

    d3.select("div#zoomed").selectAll("*").remove(); //remove zoomed image if any
    d3.select("div#viewer3d").selectAll("*").remove(); //remove any object inside 3D viewer

}

function overwriteInitialGlobalValues() {
    /*
    	// This function initiates all the global values for the page
    	// I'm not sure if this is the best practice in javascript (probably it's not)
    	// Let me (github.com/mostaphaRoudsari) know if you know a better solution
    */

    originalData = ""; //csv as it is imported
    cleanedData = []; //all the columns to be used for parallel coordinates
    inputData = []; // columns with input values - to be used for sliders
    outputData = []; // columns with output values - to be used for radar graph
    slidersInfo = []; // {name:'inputName', tickValues : [sorted set of values]},
    currentSliderValues = {}; // collector for values
    allDataCollector = {};
    slidersMapping = {}; // I collect the data for all the input sliders here so I can use it to remap the sliders later
    ids = []; // Here I collect all data based on a unique ID from inputs
	cleanedParams4pc = {};
	googleFolderLink="";

    rcheight = height = d3.select("#graph").style("height").replace("px", "");

    selectedDataFormatted = [];

    firstRating = true; // variable for star rating

    //set up heights of divs ro default
    windowWidth = window.innerWidth;
    windowHeight = window.innerHeight;
    cleanHeight = windowHeight - 85 - 24; // 2
    cleanWidth = windowWidth - 100;
    graphHeight = cleanHeight / 3;
    zoomedHeight = cleanHeight - graphHeight;

    pcHeight = d3.select("#graph").style("height").replace("px", "");
    // hide zoomed area
    d3.selectAll(".zoomed").transition().duration(1500).style("height", "0px");
    // show btm thumbnail
    d3.select("#thumbnails-btm_container").transition().duration(1000).style("height", (cleanHeight - pcHeight) + "px");
    // hide side thumbnail
    d3.select("#thumbnails-side_container").transition().duration(1500).style("height", "0px");

    
    // re-set the viewer to 2D
    currentView = "2D";
    // set view toggle to 2D
    d3.select("input#toggleView").property("checked", "true");

    initit3DViewer = true;
    d3.select("#zoomed").attr("class", "zoomed");
    d3.select("#viewer3d").attr("class", "zoomed hidden");
}

function getUrlVars() {
    var vars = {};
    var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function (m, key, value) {
        vars[key] = value;
    });
    return vars;
}

var Gkey = "AIzaSyCSrF08UMawxKIb0m4JsA1mYE5NMmP36bY";

function prepareGFolder(folderLink) {

    googleReturnObj ={ //{"fileName":Google Drive ID}
        csvFiles:{},
        imgFiles:{},
        jsonFiles:{},
        settingFiles:{}
    };

    var folder = {
        "DE_PW":"",
        "inLink":"",
        "url": "",
        "type": ""
    }

    folder = folderLink;

    d3.json(folder.url, function (data) {
        var csvFiles = {};
        var imgFiles ={};
        var jsonFiles ={};
        var settingFiles ={};

        if (folder.type=== "GoogleDrive") { //this is google returned obj
            data.files.forEach(function (item) {
                var GLink = "";
                //googleReturnObj[item.name]=item.id

                if(item.mimeType === "text/csv"){
                    GLink = "https://www.googleapis.com/drive/v3/files/" + item.id + "?alt=media&key=" + Gkey;
                    //this item is a data csv file
                    csvFiles[item.name] = GLink;
                    
                }else if(item.mimeType.startsWith("image")){
                    GLink = "https://docs.google.com/uc?id=" + item.id + "&export=download";
                    //this item is a image file
                    imgFiles[item.name] = GLink;

                }else if(item.mimeType === "application/json"){
                    GLink = "https://www.googleapis.com/drive/v3/files/" + item.id + "?alt=media&key=" + Gkey;

                    if (item.name.startsWith("setting")) {
                        //this item is a Design Explore's setting file 
                        settingFiles[item.name] = GLink;
                    } else {
                        //this item is a json model
                        jsonFiles[item.name] = GLink;
                    }
                }

            });

        } else if(folder.type=== "OneDrive") { //this is OneDrive returned obj
            data.children.forEach(function (item) {
                //googleReturnObj[item.name]=item.id
                var fileName = item.name;
                var fileType = item.file.mimeType;
                var fileLink = item["@content.downloadUrl"];

                if(fileName.toLowerCase().endsWith(".csv")){
                    //this item is a data csv file
                    csvFiles[fileName] = fileLink;//{"fileName":"fileURL"}
                    
                }else if(fileType.startsWith("image")){
                    //this item is a image file
                    imgFiles[fileName] = fileLink;

                }else if(fileType === "application/json"){

                    if (fileName.startsWith("setting")) {
                        //this item is a Design Explore's setting file 
                        settingFiles[fileName] = fileLink;
                    } else {
                        //this item is a json model
                        jsonFiles[fileName] = fileLink;
                    }
                }

            });
        }

        $.extend(googleReturnObj.csvFiles, csvFiles);
        $.extend(googleReturnObj.imgFiles, imgFiles);
        $.extend(googleReturnObj.jsonFiles, jsonFiles);
        $.extend(googleReturnObj.settingFiles, settingFiles);

        if (data.nextPageToken !== undefined) {
            
            if (folderLink.search("&pageToken=") > 0) {
                folderLink = folderLink.split("&pageToken=", 1)[0];
            }
            prepareGFolder(folderLink + "&pageToken=" + data.nextPageToken);

        } else { //this is the last page, so return googleReturnObj directly
            
            var csvFile = googleReturnObj.csvFiles["data.csv"];
            
            if (csvFile === undefined) {
                alert("Could not find the data.csv file in this folder, please double check!");
            } else {
                readyToLoad(csvFile);
            }
   
        }


    });
}

function MP_getGoogleIDandLoad(dataMethod) {
    var serverFolderLink;
    // if(isGoodForLoading ==0) return;
    document.getElementById('csv-file').value = "";

    if (dataMethod === "URL") {
        var GfolderORUrl = getUrlVars().GFOLDER;
        document.getElementById("folderLink").value = "";
        if (GfolderORUrl.search("/") == -1) {
            //GfolderORUrl is google folder ID
            serverFolderLink = "https://drive.google.com/drive/folders/" + GfolderORUrl;
        } else {
            serverFolderLink = GfolderORUrl;
        }

    } else {
        serverFolderLink = document.getElementById("folderLink").value;
    }

    checkInputLink(serverFolderLink, function (d) {
        _folderInfo = d; //set global foler obj

        if (d.type === "userServerLink") {
            //this is a user's server link, and load csv directly
            readyToLoad(d.url + "/data.csv");
        }else {
            //this is from Google or MS
            prepareGFolder(d);
        }

        //console.log(link);
    })

}

function changeLabelSize(size) {
    if (size == "largeLabel") {
        d3.selectAll(".label")
            .style("font-size", "95%");
    } else if (size == "mediumLabel") {
        d3.selectAll(".label")
            .style("font-size", "85%");
    } else if (size == "smallLabel") {
        d3.selectAll(".label")
            .style("font-size", "75%");
    }
}

function checkInputLink(link, callback){
    var folderLinkObj = {
        "DE_PW":"",
        "inLink":"",
        "url":"",
        "type":""
    }

    if (link.includes("google.com")) {

        var GFolderID = getGFolderID(link);
        folderLinkObj.DE_PW = "DE_G"; 
        folderLinkObj.url ="https://www.googleapis.com/drive/v3/files?q=%27" + GFolderID + "%27+in+parents&key=" +Gkey;
        folderLinkObj.type = "GoogleDrive";

    }else if (link.includes("1drv.ms")){

        //"https://1drv.ms/f/s!Avr4WH-N5Us-hNEf3V-AWTUuvsVZBQ"; 
        //document.getElementById("folderLinkID").value = serverFolderLink;
        folderLinkObj.DE_PW = "DE_O";
        folderLinkObj.url = "https://api.onedrive.com/v1.0/shares/u!" + encodeUrl(link) +"/root?expand=children";
        folderLinkObj.type = "OneDrive";

    }else{
        folderLinkObj.DE_PW = "DE_S";
        folderLinkObj.url = link;
        folderLinkObj.type = "userServerLink";
    } 

    makeStudyCaseId(link, function name(d) {
        folderLinkObj.DE_PW +=d;
        })
    folderLinkObj.inLink = link;
    callback(folderLinkObj);

}

function encodeUrl(url) {
    var link = btoa(url).slice(0,-1).replace('/','_').replace('+','-');
    return link;
}

function decodeUrl(encodedString) {
    
    var url = atob(encodedString).replace('_','/').replace('-','+');
    return url;
}

function getGFolderID(link) {
    var linkID;

    if (link.includes("google.com")) {

        if (link.includes("?usp=sharing")) {
            linkID = link.replace("?usp=sharing", "");
        } else if (link.includes("open?id=")) {
            linkID = link.replace("open?id=", "");
        } else {
            linkID = link;
        }

        linkID = linkID.split("/");
        linkID = linkID[linkID.length - 1];

    } else {
        //server link or ms
        linkID = link;
    }

    return linkID;
}


function makeStudyCaseId(rawUrl, callback){

    var longUrl=rawUrl;
    var request = gapi.client.urlshortener.url.insert({
      'resource': {
      'longUrl': longUrl
    }
    });
    request.execute(function(response) 
    {
        var DE_PW ="";
        if(response.id != null)
        {
            //response.id:  https://goo.gl/bMOO
            DE_PW = response.id.split("/");
            DE_PW = DE_PW[DE_PW.length-1];  //DE_PW: bMOO
            
        }
        else
        {
            DE_PW = encodeUrl(rawUrl)
        }

        //console.log(DE_PW);
        callback(DE_PW);
 
    });
 }
